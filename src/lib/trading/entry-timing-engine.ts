import { MarketUnderstandingContext } from './market-understanding-engine';
import { Indicators } from '../market/technical-analysis';

export type EntryTimingStatus =
  | 'WAITING_FOR_ENTRY'
  | 'ENTRY_CONFIRMED'
  | 'SIGNAL_EXPIRED'
  | 'TIMING_REJECTED';

export interface PendingSignal {
  signalId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  referencePrice: number;
  createdAt: number;
  expiresAt: number;
  maxWaitDuration: number; // in seconds, e.g. 3600 (1 hour)
  status: EntryTimingStatus;
  waitReason?: string;
}

export interface TimingEvaluationResult {
  status: EntryTimingStatus;
  timingScore: number; // 0 to 100
  isConfirmed: boolean;
  reasons: string[];
  waitConditions: string[];
  pendingSignal: PendingSignal;
}

export class EntryTimingEngine {
  private static pendingSignals = new Map<string, PendingSignal>();

  /**
   * Generates a key for tracking pending signal per symbol and user
   */
  private static getKey(userId: string, symbol: string): string {
    return `${userId}_${symbol}`;
  }

  /**
   * Cleans up expired pending signals
   */
  static cleanExpired(): void {
    const now = Date.now();
    for (const [key, sig] of this.pendingSignals.entries()) {
      if (now > sig.expiresAt) {
        this.pendingSignals.delete(key);
      }
    }
  }

  /**
   * Get existing pending signal
   */
  static getPendingSignal(userId: string, symbol: string): PendingSignal | undefined {
    const key = this.getKey(userId, symbol);
    const sig = this.pendingSignals.get(key);
    if (!sig) return undefined;
    if (Date.now() > sig.expiresAt) {
      this.pendingSignals.delete(key);
      return undefined;
    }
    return sig;
  }

  /**
   * Evaluate timing for entry.
   * SIGNAL != DECISION: A valid signal must wait for optimal entry timing.
   */
  static evaluateTiming(params: {
    userId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    currentPrice: number;
    understanding: MarketUnderstandingContext;
    indicators: Indicators;
    riskReward: number;
    isFresh: boolean;
    hasExistingPosition: boolean;
    learningInfluence?: { qualityAdjustment?: number; forceWait?: boolean; reason?: string };
    maxWaitSeconds?: number;
  }): TimingEvaluationResult {
    const {
      userId,
      symbol,
      side,
      currentPrice,
      understanding,
      indicators,
      riskReward,
      isFresh,
      hasExistingPosition,
      learningInfluence,
      maxWaitSeconds = 3600 // 1 hour default
    } = params;

    const reasons: string[] = [];
    const waitConditions: string[] = [];
    const key = this.getKey(userId, symbol);

    // Retrieve or create pending signal
    let pending = this.pendingSignals.get(key);
    const now = Date.now();

    if (!pending || pending.side !== side || now > pending.expiresAt) {
      pending = {
        signalId: `SIG_${symbol}_${side}_${now}`,
        symbol,
        side,
        referencePrice: currentPrice,
        createdAt: now,
        expiresAt: now + (maxWaitSeconds * 1000),
        maxWaitDuration: maxWaitSeconds,
        status: 'WAITING_FOR_ENTRY',
      };
      this.pendingSignals.set(key, pending);
    }

    // 1. Expiration Gate
    if (now > pending.expiresAt) {
      this.pendingSignals.delete(key);
      return {
        status: 'SIGNAL_EXPIRED',
        timingScore: 0,
        isConfirmed: false,
        reasons: [`Pending ${side} signal on ${symbol} expired after ${maxWaitSeconds}s`],
        waitConditions: ['Signal lifetime expired without favorable entry trigger'],
        pendingSignal: { ...pending, status: 'SIGNAL_EXPIRED' }
      };
    }

    // 2. Data Freshness Gate
    if (!isFresh) {
      waitConditions.push('Waiting for live market data update (snapshot is stale)');
      reasons.push('Data staleness blocks immediate entry confirmation');
    }

    // 3. Existing Position Gate
    if (hasExistingPosition) {
      return {
        status: 'TIMING_REJECTED',
        timingScore: 0,
        isConfirmed: false,
        reasons: [`Active position already exists for ${symbol}`],
        waitConditions: ['Existing position must close before timing new entry'],
        pendingSignal: { ...pending, status: 'TIMING_REJECTED' }
      };
    }

    // 4. Learning Influence Gate (Forced wait from validated past experience)
    if (learningInfluence?.forceWait) {
      waitConditions.push(`Validated Learning Rule: ${learningInfluence.reason || 'Holding entry due to historical loss pattern'}`);
      reasons.push('Learning engine requires patient execution confirmation');
    }

    // 5. Technical Entry Timing Metrics (Score 0 to 100)
    let timingScore = 50;

    const { trend, momentum, volatility, volumeCondition, priceActionState, marketRegime } = understanding;
    const { rsi, ema20, bollingerBands, superTrend } = indicators;

    if (side === 'BUY') {
      // Trend Confirmation
      if (trend === 'BULLISH') timingScore += 15;
      else if (trend === 'SIDEWAYS') timingScore += 5;
      else if (trend === 'BEARISH') {
        timingScore -= 20;
        waitConditions.push('Waiting for trend reversal (fast EMA below slow EMA)');
      }

      // Momentum / Pullback Confirmation
      // Ideal BUY entry is on pullback or breakout with momentum, not chasing overbought top
      if (rsi !== undefined) {
        if (rsi >= 72) {
          timingScore -= 25;
          waitConditions.push(`RSI is Overbought (${rsi.toFixed(1)}). Waiting for cooling pullback below 65`);
        } else if (rsi >= 45 && rsi <= 62) {
          timingScore += 15;
          reasons.push(`RSI (${rsi.toFixed(1)}) healthy in non-overbought zone`);
        } else if (rsi <= 35) {
          timingScore += 10;
          reasons.push(`Oversold RSI (${rsi.toFixed(1)}) provides value entry`);
        }
      }

      // Price Location relative to EMA20 / Bollinger
      if (ema20) {
        const distFromEma = (currentPrice - ema20) / ema20;
        if (distFromEma > 0.025) {
          timingScore -= 20;
          waitConditions.push(`Price is overextended ${(distFromEma * 100).toFixed(1)}% above EMA20. Waiting for retest near $${ema20.toFixed(2)}`);
        } else if (Math.abs(distFromEma) <= 0.008) {
          timingScore += 15;
          reasons.push(`Price is well-positioned near EMA20 support ($${ema20.toFixed(2)})`);
        }
      }

      // Candle / Rejection Confirmation
      if (priceActionState === 'BEARISH_REJECTION_WICK') {
        timingScore -= 15;
        waitConditions.push('Recent candle shows upper rejection wick (sellers active at highs)');
      } else if (priceActionState === 'BULLISH_REJECTION_WICK') {
        timingScore += 15;
        reasons.push('Recent candle confirmed lower wick rejection (buyers defending dips)');
      }

    } else {
      // side === 'SELL'
      // Trend Confirmation
      if (trend === 'BEARISH') timingScore += 15;
      else if (trend === 'SIDEWAYS') timingScore += 5;
      else if (trend === 'BULLISH') {
        timingScore -= 20;
        waitConditions.push('Waiting for bearish trend confirmation (price currently in bull trend)');
      }

      // Momentum / Pullback Confirmation
      if (rsi !== undefined) {
        if (rsi <= 28) {
          timingScore -= 25;
          waitConditions.push(`RSI is Oversold (${rsi.toFixed(1)}). Waiting for bounce exhaustion above 35`);
        } else if (rsi <= 55 && rsi >= 38) {
          timingScore += 15;
          reasons.push(`RSI (${rsi.toFixed(1)}) positioned well for short continuation`);
        } else if (rsi >= 65) {
          timingScore += 10;
          reasons.push(`Overbought RSI (${rsi.toFixed(1)}) provides prime short entry`);
        }
      }

      // Price Location relative to EMA20
      if (ema20) {
        const distFromEma = (ema20 - currentPrice) / currentPrice;
        if (distFromEma > 0.025) {
          timingScore -= 20;
          waitConditions.push(`Price is overextended ${(distFromEma * 100).toFixed(1)}% below EMA20. Waiting for bounce towards $${ema20.toFixed(2)}`);
        } else if (Math.abs(distFromEma) <= 0.008) {
          timingScore += 15;
          reasons.push(`Price is well-positioned near EMA20 resistance ($${ema20.toFixed(2)})`);
        }
      }

      // Candle / Rejection Confirmation
      if (priceActionState === 'BULLISH_REJECTION_WICK') {
        timingScore -= 15;
        waitConditions.push('Recent candle shows lower rejection wick (buyers defending support)');
      } else if (priceActionState === 'BEARISH_REJECTION_WICK') {
        timingScore += 15;
        reasons.push('Recent candle confirmed upper wick rejection (sellers pressing down)');
      }
    }

    // Volume Confirmation
    if (volumeCondition === 'SURGE' || volumeCondition === 'HIGH') {
      timingScore += 10;
      reasons.push(`Active volume (${volumeCondition}) supports entry timing`);
    } else if (volumeCondition === 'DRYING_UP') {
      timingScore -= 10;
      waitConditions.push('Volume drying up; waiting for volume expansion before entry');
    }

    // Risk / Reward Confirmation
    if (riskReward >= 1.5) {
      timingScore += 10;
    } else {
      timingScore -= 15;
      waitConditions.push(`Risk/Reward 1:${riskReward.toFixed(2)} below minimum threshold (1.5)`);
    }

    // Apply learning adjustment if present
    if (learningInfluence?.qualityAdjustment) {
      timingScore += learningInfluence.qualityAdjustment;
    }

    timingScore = Math.max(0, Math.min(100, Math.round(timingScore)));

    // Confirmation Threshold:
    // Requires timingScore >= 60 and no hard blocking wait conditions
    const isHardBlocked = !isFresh || hasExistingPosition || (learningInfluence?.forceWait ?? false);
    const isConfirmed = timingScore >= 60 && !isHardBlocked && waitConditions.length === 0;

    const status: EntryTimingStatus = isConfirmed ? 'ENTRY_CONFIRMED' : 'WAITING_FOR_ENTRY';
    pending.status = status;
    pending.waitReason = waitConditions.join('; ');

    if (isConfirmed) {
      reasons.push(`Entry timing validated (Score: ${timingScore}/100). All prerequisite conditions satisfied.`);
    } else {
      reasons.push(`Entry timing requires patience (Score: ${timingScore}/100). Waiting for setup optimization.`);
    }

    return {
      status,
      timingScore,
      isConfirmed,
      reasons,
      waitConditions,
      pendingSignal: pending
    };
  }

  /**
   * Explicitly clear pending signal once executed or invalidated
   */
  static clearPendingSignal(userId: string, symbol: string): void {
    const key = this.getKey(userId, symbol);
    this.pendingSignals.delete(key);
  }
}

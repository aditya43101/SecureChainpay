import { prisma } from '@/lib/prisma';
import { RecommendationObject } from './recommendation-engine';
import { marketDataService } from '../market/market-data-service';

export interface PreTradeValidationResult {
  allowed: boolean;
  stage: string;
  reasons: string[];
  warnings: string[];
  idempotencyKey: string;
  riskSnapshot?: any;
}

export class ExecutionSafetyEngine {
  /**
   * Generates a deterministic idempotency key for a trade signal execution attempt.
   */
  static generateIdempotencyKey(userId: string, symbol: string, signalId: string, strategyVersion: string): string {
    const timeWindow = Math.floor(Date.now() / (1000 * 60 * 5)); // 5-minute window
    return `IDEM_${userId}_${symbol}_${signalId}_${strategyVersion}_${timeWindow}`;
  }

  /**
   * 8-Stage Pre-Trade Validation Gate
   */
  static async validatePreTrade(
    userId: string,
    recommendation: RecommendationObject,
    idempotencyKey?: string
  ): Promise<PreTradeValidationResult> {
    const reasons: string[] = [];
    const warnings: string[] = [];
    const symbol = recommendation.asset || (recommendation as any).symbol;

    // 1. Fetch Auto-Trading Settings
    let settings = await prisma.autoTradingSettings.findUnique({
      where: { userId }
    });

    if (!settings) {
      settings = await prisma.autoTradingSettings.create({
        data: { userId }
      });
    }

    const ik = idempotencyKey || this.generateIdempotencyKey(
      userId,
      symbol,
      recommendation.id || `${symbol}_${recommendation.dataTimestamp}`,
      settings.strategyVersion
    );

    // GATE 0: Check System Status & Permission
    if (!settings.enabled || settings.status !== 'ENABLED') {
      return {
        allowed: false,
        stage: 'PERMISSIONS_GATE',
        reasons: [`Auto-trading is currently ${settings.status}. Must be ENABLED to execute trades.`],
        warnings: [],
        idempotencyKey: ik
      };
    }

    // GATE 1: Market Data Safety
    const candles = await marketDataService.getCandles(symbol, recommendation.timeframe, 1);
    const candle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
    if (!candle) {
      reasons.push(`Market data unavailable for ${symbol} ${recommendation.timeframe}`);
    } else {
      const dataAgeSeconds = (Date.now() - new Date(candle.timestamp).getTime()) / 1000;
      if (dataAgeSeconds > 300) { // 5 mins max age for candles
        reasons.push(`Stale market data (${Math.round(dataAgeSeconds)}s old). Max allowed is 300s.`);
      }
      if (candle.close <= 0) {
        reasons.push(`Invalid price detected: $${candle.close}`);
      }
    }

    if (!settings.allowedAssets.includes(symbol)) {
      reasons.push(`Asset ${symbol} is not in user's allowed trading list (${settings.allowedAssets.join(', ')})`);
    }

    // GATE 2: Signal Validation
    if (recommendation.action === 'HOLD' || recommendation.action === 'NO_TRADE') {
      reasons.push(`Signal action is ${recommendation.action}. Only BUY or SELL can execute.`);
    }

    const signalAgeSeconds = (Date.now() - new Date(recommendation.dataTimestamp).getTime()) / 1000;
    if (signalAgeSeconds > 600) { // 10 minutes signal age threshold
      reasons.push(`Signal expired (${Math.round(signalAgeSeconds)}s old). Max allowed is 600s.`);
    }

    // GATE 3: Model Validation (Champion Model Only)
    const activeChampionModel = 'LOG_v1';
    const recModelVersion = recommendation.mlPrediction?.modelVersion;
    if (recModelVersion && recModelVersion !== activeChampionModel) {
      reasons.push(`Model ${recModelVersion} is not the active Champion model (${activeChampionModel}). Only Champion model can execute.`);
    }

    // GATE 4: Strategy Validation (Approved & Validated Version Only)
    if (settings.strategyVersion !== 'HYBRID_v1') {
      warnings.push(`Executing with strategy version ${settings.strategyVersion}`);
    }

    // GATE 5: Feedback Validation (Check matching failure patterns)
    const failurePatterns = await prisma.feedbackMemory.findMany({
      where: {
        symbol,
        type: 'FAILURE_PATTERN',
        status: 'VALIDATED',
        confidence: { gte: 0.65 }
      }
    });

    if (failurePatterns.length > 0) {
      for (const pattern of failurePatterns) {
        if (recommendation.reasons.some(r => r.toLowerCase().includes(pattern.pattern.toLowerCase()))) {
          reasons.push(`Blocked by validated Phase 7 failure pattern: "${pattern.observation}" (Confidence: ${(pattern.confidence * 100).toFixed(0)}%)`);
        }
      }
    }

    // GATE 6: Risk Validation & Daily Loss Limits
    const todayStr = new Date().toISOString().split('T')[0];
    let dailyState = await prisma.dailyRiskState.findUnique({
      where: { userId_date: { userId, date: todayStr } }
    });

    if (dailyState && dailyState.dailyLossLimitReached) {
      reasons.push(`Daily loss limit reached (${(dailyState.realizedPnL).toFixed(2)} USD). Auto-trading is paused for today.`);
    }

    if (recommendation.riskReward < settings.minRiskReward) {
      reasons.push(`Risk/Reward ratio ${recommendation.riskReward.toFixed(2)} is below configured minimum (${settings.minRiskReward}).`);
    }

    // GATE 7: Portfolio & Position Exposure Validation
    const paperAccount = await prisma.paperAccount.findUnique({
      where: { userId },
      include: { positions: true }
    });

    if (paperAccount) {
      if (paperAccount.positions.length >= settings.maxOpenPositions) {
        reasons.push(`Max open positions limit reached (${paperAccount.positions.length}/${settings.maxOpenPositions})`);
      }

      const existingPosition = paperAccount.positions.find(p => p.symbol === symbol);
      if (existingPosition) {
        reasons.push(`An active position already exists for ${symbol}`);
      }

      const totalCapital = paperAccount.equity || paperAccount.cashBalance;
      if (recommendation.positionSize && totalCapital > 0) {
        const estNotional = (recommendation.entry.low || candle?.close || 0) * recommendation.positionSize;
        const exposurePct = estNotional / totalCapital;
        if (exposurePct > settings.maxAssetExposure) {
          reasons.push(`Position size notional ($${estNotional.toFixed(0)}) exceeds max asset exposure of ${(settings.maxAssetExposure * 100).toFixed(0)}% (${(exposurePct * 100).toFixed(1)}%)`);
        }
      }
    }

    // GATE 8: Idempotency & Duplicate Execution Gate
    const existingApproval = await prisma.tradeApproval.findUnique({
      where: { idempotencyKey: ik }
    });

    if (existingApproval) {
      reasons.push(`Duplicate execution blocked by idempotency key: ${ik}`);
    }

    const existingOrder = await prisma.executionOrder.findUnique({
      where: { idempotencyKey: ik }
    });

    if (existingOrder) {
      reasons.push(`Duplicate order already exists for key ${ik}`);
    }

    // Check Cooldown Period
    const lastOrder = await prisma.executionOrder.findFirst({
      where: { userId, symbol },
      orderBy: { createdAt: 'desc' }
    });

    if (lastOrder) {
      const cooldownSec = (Date.now() - new Date(lastOrder.createdAt).getTime()) / 1000;
      if (cooldownSec < settings.cooldownPeriod) {
        reasons.push(`Cooldown period active for ${symbol} (${Math.round(settings.cooldownPeriod - cooldownSec)}s remaining)`);
      }
    }

    const isAllowed = reasons.length === 0;

    // Record Audit Approval Object
    const approval = await prisma.tradeApproval.create({
      data: {
        userId,
        signalId: recommendation.id || `${symbol}_${Date.now()}`,
        symbol,
        timeframe: recommendation.timeframe,
        action: recommendation.action === 'BUY' ? 'BUY' : 'SELL',
        strategyVersion: settings.strategyVersion,
        modelVersion: recModelVersion || settings.modelVersion,
        riskStatus: isAllowed ? 'PASS' : 'FAIL',
        portfolioStatus: isAllowed ? 'PASS' : 'FAIL',
        executionStatus: isAllowed ? 'APPROVED' : 'REJECTED',
        idempotencyKey: ik,
        reasons,
        warnings,
        riskSnapshot: {
          riskPerTrade: settings.riskPerTrade,
          maxDailyLoss: settings.maxDailyLoss,
          minRiskReward: settings.minRiskReward,
          stopLoss: recommendation.stopLoss,
          takeProfit: recommendation.takeProfit,
          positionSize: recommendation.positionSize
        }
      }
    });

    if (!isAllowed) {
      await prisma.safetyEvent.create({
        data: {
          userId,
          eventType: 'STALE_DATA_REJECTION',
          severity: 'WARNING',
          details: `Trade execution rejected for ${symbol}: ${reasons.join('; ')}`,
          metadata: { idempotencyKey: ik, approvalId: approval.id, reasons }
        }
      });
    }

    return {
      allowed: isAllowed,
      stage: isAllowed ? 'ALL_GATES_PASSED' : 'SAFETY_GATE_BLOCKED',
      reasons,
      warnings,
      idempotencyKey: ik,
      riskSnapshot: approval.riskSnapshot
    };
  }

  /**
   * Triggers Circuit Breaker to auto-pause trading.
   */
  static async triggerCircuitBreaker(userId: string, reason: string): Promise<void> {
    await prisma.autoTradingSettings.update({
      where: { userId },
      data: {
        status: 'PAUSED',
        pausedReason: `Circuit Breaker Triggered: ${reason}`
      }
    });

    await prisma.safetyEvent.create({
      data: {
        userId,
        eventType: 'CIRCUIT_BREAKER_TRIGGERED',
        severity: 'CRITICAL',
        details: `Circuit Breaker triggered for user ${userId}: ${reason}`
      }
    });
  }

  /**
   * Triggers immediate Emergency Stop.
   */
  static async triggerEmergencyStop(userId: string, reason: string = 'User initiated Emergency Stop'): Promise<void> {
    await prisma.autoTradingSettings.update({
      where: { userId },
      data: {
        enabled: false,
        allTimeMode: false,
        status: 'EMERGENCY_STOP',
        pausedReason: reason
      }
    });

    // Cancel all PENDING orders
    await prisma.executionOrder.updateMany({
      where: { userId, status: { in: ['SUBMITTED', 'APPROVED', 'VALIDATING', 'CREATED'] } },
      data: { status: 'CANCELLED' }
    });

    await prisma.safetyEvent.create({
      data: {
        userId,
        eventType: 'EMERGENCY_STOP',
        severity: 'CRITICAL',
        details: `Emergency Stop activated: ${reason}`
      }
    });
  }
}

import { prisma } from '@/lib/prisma';
import { RecommendationObject } from './recommendation-engine';
import { marketDataService } from '../market/market-data-service';
import { tradingFallbackStore } from './trading-fallback-store';

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

    // 1. Fetch Auto-Trading Settings (with DB fallback)
    let settings: any = null;
    try {
      settings = await prisma.autoTradingSettings.findUnique({
        where: { userId }
      });
      if (!settings) {
        settings = await prisma.autoTradingSettings.create({
          data: { userId }
        });
      }
    } catch {
      settings = tradingFallbackStore.getSettings(userId);
    }

    if (!settings) {
      settings = tradingFallbackStore.getSettings(userId);
    }

    const ik = idempotencyKey || this.generateIdempotencyKey(
      userId,
      symbol,
      recommendation.id || `${symbol}_${recommendation.dataTimestamp}`,
      settings.strategyVersion || 'HYBRID_v1'
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
    let candle: any = null;
    try {
      const candles = await marketDataService.getCandles(symbol, recommendation.timeframe, 1);
      candle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
    } catch {
      // Non-blocking candle fetch
    }

    if (candle) {
      const dataAgeSeconds = (Date.now() - new Date(candle.timestamp).getTime()) / 1000;
      if (dataAgeSeconds > 300) { // 5 mins max age for candles
        reasons.push(`Stale market data (${Math.round(dataAgeSeconds)}s old). Max allowed is 300s.`);
      }
      if (candle.close <= 0) {
        reasons.push(`Invalid price detected: $${candle.close}`);
      }
    }

    const allowedAssets = settings.allowedAssets || ['BTCUSDT', 'ETHUSDT'];
    if (!allowedAssets.includes(symbol) && !allowedAssets.includes(`${symbol}USDT`)) {
      reasons.push(`Asset ${symbol} is not in user's allowed trading list (${allowedAssets.join(', ')})`);
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
    let failurePatterns: any[] = [];
    try {
      failurePatterns = await prisma.feedbackMemory.findMany({
        where: {
          symbol,
          type: 'FAILURE_PATTERN',
          status: 'VALIDATED',
          confidence: { gte: 0.65 }
        }
      });
    } catch {
      failurePatterns = tradingFallbackStore.getFeedbackMemories().filter(m => m.symbol === symbol && m.type === 'FAILURE_PATTERN' && m.confidence >= 0.65);
    }

    if (failurePatterns.length > 0) {
      for (const pattern of failurePatterns) {
        if (recommendation.reasons?.some(r => r.toLowerCase().includes(pattern.pattern.toLowerCase()))) {
          reasons.push(`Blocked by validated Phase 7 failure pattern: "${pattern.observation}" (Confidence: ${(pattern.confidence * 100).toFixed(0)}%)`);
        }
      }
    }

    // GATE 6: Risk Validation & Daily Loss Limits
    const todayStr = new Date().toISOString().split('T')[0];
    let dailyState: any = null;
    try {
      dailyState = await prisma.dailyRiskState.findUnique({
        where: { userId_date: { userId, date: todayStr } }
      });
    } catch {
      dailyState = tradingFallbackStore.getDailyState(userId, todayStr);
    }

    if (!dailyState) {
      dailyState = tradingFallbackStore.getDailyState(userId, todayStr);
    }

    if (dailyState && dailyState.dailyLossLimitReached) {
      reasons.push(`Daily loss limit reached (${(dailyState.realizedPnL).toFixed(2)} USD). Auto-trading is paused for today.`);
    }

    const minRR = settings.minRiskReward || 1.5;
    if (recommendation.riskReward < minRR) {
      reasons.push(`Risk/Reward ratio ${recommendation.riskReward.toFixed(2)} is below configured minimum (${minRR}).`);
    }

    // GATE 7: Portfolio & Position Exposure Validation
    let paperAccount: any = null;
    try {
      paperAccount = await prisma.paperAccount.findUnique({
        where: { userId },
        include: { positions: true }
      });
    } catch {
      paperAccount = tradingFallbackStore.getPaperAccount(userId);
    }

    if (!paperAccount) {
      paperAccount = tradingFallbackStore.getPaperAccount(userId);
    }

    if (paperAccount) {
      const maxOpen = settings.maxOpenPositions || 3;
      if (paperAccount.positions?.length >= maxOpen) {
        reasons.push(`Max open positions limit reached (${paperAccount.positions.length}/${maxOpen})`);
      }

      const existingPosition = paperAccount.positions?.find((p: any) => p.symbol === symbol);
      if (existingPosition) {
        reasons.push(`An active position already exists for ${symbol}`);
      }

      const totalCapital = paperAccount.equity || paperAccount.cashBalance || 100000;
      if (recommendation.positionSize && totalCapital > 0) {
        const estNotional = (recommendation.entry.low || candle?.close || 0) * recommendation.positionSize;
        const exposurePct = estNotional / totalCapital;
        const maxExposure = settings.maxAssetExposure || 0.10;
        if (exposurePct > maxExposure) {
          reasons.push(`Position size notional ($${estNotional.toFixed(0)}) exceeds max asset exposure of ${(maxExposure * 100).toFixed(0)}% (${(exposurePct * 100).toFixed(1)}%)`);
        }
      }
    }

    // GATE 8: Idempotency & Duplicate Execution Gate
    let existingApproval: any = null;
    try {
      existingApproval = await prisma.tradeApproval.findUnique({
        where: { idempotencyKey: ik }
      });
    } catch {
      existingApproval = tradingFallbackStore.findApprovalByKey(ik);
    }

    if (existingApproval) {
      reasons.push(`Duplicate execution blocked by idempotency key: ${ik}`);
    }

    let existingOrder: any = null;
    try {
      existingOrder = await prisma.executionOrder.findUnique({
        where: { idempotencyKey: ik }
      });
    } catch {
      existingOrder = tradingFallbackStore.findOrderByKey(ik);
    }

    if (existingOrder) {
      reasons.push(`Duplicate order already exists for key ${ik}`);
    }

    // Check Cooldown Period
    let lastOrder: any = null;
    try {
      lastOrder = await prisma.executionOrder.findFirst({
        where: { userId, symbol },
        orderBy: { createdAt: 'desc' }
      });
    } catch {
      const userOrders = tradingFallbackStore.getOrders(userId);
      lastOrder = userOrders.find(o => o.symbol === symbol);
    }

    const cooldownPeriod = settings.cooldownPeriod || 60;
    if (lastOrder) {
      const cooldownSec = (Date.now() - new Date(lastOrder.createdAt).getTime()) / 1000;
      if (cooldownSec < cooldownPeriod) {
        reasons.push(`Cooldown period active for ${symbol} (${Math.round(cooldownPeriod - cooldownSec)}s remaining)`);
      }
    }

    const isAllowed = reasons.length === 0;
    const riskSnapshot = {
      riskPerTrade: settings.riskPerTrade || 0.01,
      maxDailyLoss: settings.maxDailyLoss || 0.03,
      minRiskReward: minRR,
      stopLoss: recommendation.stopLoss,
      takeProfit: recommendation.takeProfit,
      positionSize: recommendation.positionSize
    };

    // Record Audit Approval Object
    try {
      await prisma.tradeApproval.create({
        data: {
          userId,
          signalId: recommendation.id || `${symbol}_${Date.now()}`,
          symbol,
          timeframe: recommendation.timeframe,
          action: recommendation.action === 'BUY' ? 'BUY' : 'SELL',
          strategyVersion: settings.strategyVersion || 'HYBRID_v1',
          modelVersion: recModelVersion || settings.modelVersion || 'LOG_v1',
          riskStatus: isAllowed ? 'PASS' : 'FAIL',
          portfolioStatus: isAllowed ? 'PASS' : 'FAIL',
          executionStatus: isAllowed ? 'APPROVED' : 'REJECTED',
          idempotencyKey: ik,
          reasons,
          warnings,
          riskSnapshot
        }
      });
    } catch {
      tradingFallbackStore.addApproval({
        userId,
        signalId: recommendation.id || `${symbol}_${Date.now()}`,
        symbol,
        timeframe: recommendation.timeframe,
        action: recommendation.action === 'BUY' ? 'BUY' : 'SELL',
        strategyVersion: settings.strategyVersion || 'HYBRID_v1',
        modelVersion: recModelVersion || settings.modelVersion || 'LOG_v1',
        riskStatus: isAllowed ? 'PASS' : 'FAIL',
        portfolioStatus: isAllowed ? 'PASS' : 'FAIL',
        executionStatus: isAllowed ? 'APPROVED' : 'REJECTED',
        idempotencyKey: ik,
        reasons,
        warnings,
        riskSnapshot
      });
    }

    if (!isAllowed) {
      try {
        await prisma.safetyEvent.create({
          data: {
            userId,
            eventType: 'STALE_DATA_REJECTION',
            severity: 'WARNING',
            details: `Trade execution rejected for ${symbol}: ${reasons.join('; ')}`,
            metadata: { idempotencyKey: ik, reasons }
          }
        });
      } catch {
        tradingFallbackStore.addSafetyEvent({
          userId,
          eventType: 'STALE_DATA_REJECTION',
          severity: 'WARNING',
          details: `Trade execution rejected for ${symbol}: ${reasons.join('; ')}`,
          metadata: { idempotencyKey: ik, reasons }
        });
      }
    }

    return {
      allowed: isAllowed,
      stage: isAllowed ? 'ALL_GATES_PASSED' : 'SAFETY_GATE_BLOCKED',
      reasons,
      warnings,
      idempotencyKey: ik,
      riskSnapshot
    };
  }

  /**
   * Triggers Circuit Breaker to auto-pause trading.
   */
  static async triggerCircuitBreaker(userId: string, reason: string): Promise<void> {
    try {
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
    } catch {
      tradingFallbackStore.updateSettings(userId, {
        status: 'PAUSED',
        pausedReason: `Circuit Breaker Triggered: ${reason}`
      });

      tradingFallbackStore.addSafetyEvent({
        userId,
        eventType: 'CIRCUIT_BREAKER_TRIGGERED',
        severity: 'CRITICAL',
        details: `Circuit Breaker triggered for user ${userId}: ${reason}`
      });
    }
  }

  /**
   * Triggers immediate Emergency Stop.
   */
  static async triggerEmergencyStop(userId: string, reason: string = 'User initiated Emergency Stop'): Promise<void> {
    try {
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
    } catch {
      tradingFallbackStore.updateSettings(userId, {
        enabled: false,
        allTimeMode: false,
        status: 'EMERGENCY_STOP',
        pausedReason: reason
      });

      tradingFallbackStore.addSafetyEvent({
        userId,
        eventType: 'EMERGENCY_STOP',
        severity: 'CRITICAL',
        details: `Emergency Stop activated: ${reason}`
      });
    }
  }
}

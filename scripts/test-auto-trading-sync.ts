/**
 * Comprehensive Deterministic Test Suite: Auto-Trading Execution Engine Sync
 * Validates all 19 test cases defined in the audit requirements.
 */

import { marketDataService } from '../src/lib/market/market-data-service';
import { recommendationEngine } from '../src/lib/trading/recommendation-engine';
import { PositionSizer } from '../src/lib/trading/position-sizer';
import { riskEngine } from '../src/lib/trading/risk-engine';
import { AutoTradingEngine } from '../src/lib/trading/auto-trading-engine';
import { ExecutionEngine } from '../src/lib/trading/execution-engine';
import { ExecutionSafetyEngine } from '../src/lib/trading/execution-safety';
import { tradingFallbackStore } from '../src/lib/trading/trading-fallback-store';

interface TestReport {
  id: number;
  name: string;
  passed: boolean;
  details: string;
}

const reports: TestReport[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('STARTING AUTO-TRADING ENGINE SYNCHRONIZATION AUDIT SUITE');
  console.log('====================================================\n');

  // Test 1: Live price == decision price
  try {
    const snapshot = await marketDataService.getCanonicalSnapshot('BTCUSDT', '1h', 10);
    const rec = await recommendationEngine.generateRecommendation('BTCUSDT', '1h');
    assert(rec.canonicalSnapshot !== undefined, 'Canonical snapshot must be attached');
    assert(
      Math.abs(rec.entry.suggestedEntry - rec.canonicalSnapshot!.lastPrice) < 0.001,
      `Live price ($${rec.canonicalSnapshot!.lastPrice}) must equal decision entry price ($${rec.entry.suggestedEntry})`
    );
    reports.push({
      id: 1,
      name: 'Live price == decision price',
      passed: true,
      details: `Live price $${rec.canonicalSnapshot!.lastPrice} strictly equals decision entry price $${rec.entry.suggestedEntry}`
    });
  } catch (err: any) {
    reports.push({ id: 1, name: 'Live price == decision price', passed: false, details: err.message });
  }

  // Test 2: Historical candles + live candle sync
  try {
    const snapshot = await marketDataService.getCanonicalSnapshot('BTCUSDT', '1h', 50);
    const latest = snapshot.latestCandle;
    assert(latest.close === snapshot.lastPrice, 'Latest candle close must equal snapshot lastPrice');
    assert(latest.high >= snapshot.lastPrice, 'Latest candle high must be >= lastPrice');
    assert(latest.low <= snapshot.lastPrice, 'Latest candle low must be <= lastPrice');
    reports.push({
      id: 2,
      name: 'Historical candles + live candle sync',
      passed: true,
      details: `Active forming candle close ($${latest.close}) harmonized with snapshot lastPrice ($${snapshot.lastPrice})`
    });
  } catch (err: any) {
    reports.push({ id: 2, name: 'Historical candles + live candle sync', passed: false, details: err.message });
  }

  // Test 3: BUY position sizing
  try {
    const entry = 76000;
    const stopLoss = 74500; // $1500 risk distance
    const capital = 100000;
    const baseRisk = 0.01; // 1% = $1000
    const sizing = PositionSizer.calculatePositionSize(7, entry, stopLoss, capital, baseRisk);
    assert(sizing.decisionMode === 'EXPLOIT', 'Score 7 must be EXPLOIT mode');
    assert(sizing.allowedRiskUSD === 1000, `Allowed risk must be $1000, got $${sizing.allowedRiskUSD}`);
    assert(sizing.isCappedByExposure === true, 'Must trigger 10% max asset exposure ceiling');
    assert(sizing.positionSize === 0.131579, `Expected clamped size 0.131579, got ${sizing.positionSize}`);
    const expectedStopRisk = Number((0.131579 * 1500).toFixed(2)); // $197.37
    assert(Math.abs(sizing.appliedStopRiskUSD - expectedStopRisk) < 0.05, `Applied stop risk must be ~$197.37, got $${sizing.appliedStopRiskUSD}`);
    reports.push({
      id: 3,
      name: 'BUY position sizing',
      passed: true,
      details: `BUY Sizing verified: ${sizing.positionSize} BTC, Applied Stop Risk: $${sizing.appliedStopRiskUSD} (${sizing.reconciliationSummary})`
    });
  } catch (err: any) {
    reports.push({ id: 3, name: 'BUY position sizing', passed: false, details: err.message });
  }

  // Test 4: SELL position sizing
  try {
    const entry = 76766.63;
    const stopLoss = 77496.05; // $729.42 risk distance
    const capital = 100000;
    const baseRisk = 0.01;
    const sizing = PositionSizer.calculatePositionSize(3, entry, stopLoss, capital, baseRisk);
    assert(sizing.decisionMode === 'EXPLORE', 'Score 3 must be EXPLORE mode');
    assert(sizing.allowedRiskUSD === 250, `Exploration risk budget must be $250, got $${sizing.allowedRiskUSD}`);
    const expectedAppliedRisk = Number((sizing.positionSize * sizing.riskDistance).toFixed(2));
    assert(sizing.appliedStopRiskUSD === expectedAppliedRisk, `Applied stop risk ($${sizing.appliedStopRiskUSD}) must match size * distance ($${expectedAppliedRisk})`);
    reports.push({
      id: 4,
      name: 'SELL position sizing',
      passed: true,
      details: `SELL Sizing verified: ${sizing.positionSize} BTC, Stop Risk: $${sizing.appliedStopRiskUSD} reconciled against $250 budget`
    });
  } catch (err: any) {
    reports.push({ id: 4, name: 'SELL position sizing', passed: false, details: err.message });
  }

  // Test 5: 1% risk
  try {
    const capital = 100000;
    const sizing = PositionSizer.calculatePositionSize(7, 50000, 48000, capital, 0.01);
    assert(sizing.configuredRiskPercent === 0.01, 'Configured risk must be 1%');
    assert(sizing.configuredRiskUSD === 1000, 'Configured risk USD must be $1000');
    assert(sizing.allowedRiskUSD === 1000, 'Exploit allowed risk must be $1000 at score 7');
    reports.push({
      id: 5,
      name: '1% risk',
      passed: true,
      details: `Base 1.0% configured risk ($1,000 USD on $100,000 capital) fully verified`
    });
  } catch (err: any) {
    reports.push({ id: 5, name: '1% risk', passed: false, details: err.message });
  }

  // Test 6: 0.25% exploration risk if configured
  try {
    const capital = 100000;
    const sizing = PositionSizer.calculatePositionSize(3, 50000, 52000, capital, 0.01);
    assert(sizing.effectiveRiskPct === 0.0025, `Expected 0.25% (0.0025) effective risk, got ${sizing.effectiveRiskPct}`);
    assert(sizing.allowedRiskUSD === 250, `Expected $250 allowed risk, got $${sizing.allowedRiskUSD}`);
    reports.push({
      id: 6,
      name: '0.25% exploration risk if configured',
      passed: true,
      details: `Score 3/7 scaled by 0.25x multiplier to exactly 0.25% ($250 USD exploration budget)`
    });
  } catch (err: any) {
    reports.push({ id: 6, name: '0.25% exploration risk if configured', passed: false, details: err.message });
  }

  // Test 7: SL above entry for SELL
  try {
    const candles = await marketDataService.getCandles('BTCUSDT', '1h', 20);
    const mockStrategyOutput = {
      primaryStrategy: 'RSI_MOMENTUM',
      direction: 'SHORT' as const,
      score: 5,
      maxScore: 7,
      confidence: 0.71,
      reasoning: ['Bearish reversal setup'],
      subSignals: []
    };
    const risk = riskEngine.evaluateRisk(mockStrategyOutput, 75000, candles, { atr: 1000 } as any);
    assert(risk.stopLoss > risk.entry.suggestedEntry, `For SELL, stopLoss ($${risk.stopLoss}) must be > entry ($${risk.entry.suggestedEntry})`);
    reports.push({
      id: 7,
      name: 'SL above entry for SELL',
      passed: true,
      details: `SELL Stop Loss ($${risk.stopLoss}) is strictly above Entry ($${risk.entry.suggestedEntry})`
    });
  } catch (err: any) {
    reports.push({ id: 7, name: 'SL above entry for SELL', passed: false, details: err.message });
  }

  // Test 8: SL below entry for BUY
  try {
    const candles = await marketDataService.getCandles('BTCUSDT', '1h', 20);
    const mockStrategyOutput = {
      primaryStrategy: 'RSI_MOMENTUM',
      direction: 'LONG' as const,
      score: 5,
      maxScore: 7,
      confidence: 0.71,
      reasoning: ['Bullish breakout setup'],
      subSignals: []
    };
    const risk = riskEngine.evaluateRisk(mockStrategyOutput, 75000, candles, { atr: 1000 } as any);
    assert(risk.stopLoss < risk.entry.suggestedEntry, `For BUY, stopLoss ($${risk.stopLoss}) must be < entry ($${risk.entry.suggestedEntry})`);
    reports.push({
      id: 8,
      name: 'SL below entry for BUY',
      passed: true,
      details: `BUY Stop Loss ($${risk.stopLoss}) is strictly below Entry ($${risk.entry.suggestedEntry})`
    });
  } catch (err: any) {
    reports.push({ id: 8, name: 'SL below entry for BUY', passed: false, details: err.message });
  }

  // Test 9: TP below entry for SELL
  try {
    const candles = await marketDataService.getCandles('BTCUSDT', '1h', 20);
    const mockStrategyOutput = {
      primaryStrategy: 'RSI_MOMENTUM',
      direction: 'SHORT' as const,
      score: 5,
      maxScore: 7,
      confidence: 0.71,
      reasoning: ['Bearish setup'],
      subSignals: []
    };
    const risk = riskEngine.evaluateRisk(mockStrategyOutput, 75000, candles, { atr: 1000 } as any);
    assert(risk.takeProfit < risk.entry.suggestedEntry, `For SELL, takeProfit ($${risk.takeProfit}) must be < entry ($${risk.entry.suggestedEntry})`);
    reports.push({
      id: 9,
      name: 'TP below entry for SELL',
      passed: true,
      details: `SELL Take Profit ($${risk.takeProfit}) is strictly below Entry ($${risk.entry.suggestedEntry})`
    });
  } catch (err: any) {
    reports.push({ id: 9, name: 'TP below entry for SELL', passed: false, details: err.message });
  }

  // Test 10: TP above entry for BUY
  try {
    const candles = await marketDataService.getCandles('BTCUSDT', '1h', 20);
    const mockStrategyOutput = {
      primaryStrategy: 'RSI_MOMENTUM',
      direction: 'LONG' as const,
      score: 5,
      maxScore: 7,
      confidence: 0.71,
      reasoning: ['Bullish setup'],
      subSignals: []
    };
    const risk = riskEngine.evaluateRisk(mockStrategyOutput, 75000, candles, { atr: 1000 } as any);
    assert(risk.takeProfit > risk.entry.suggestedEntry, `For BUY, takeProfit ($${risk.takeProfit}) must be > entry ($${risk.entry.suggestedEntry})`);
    reports.push({
      id: 10,
      name: 'TP above entry for BUY',
      passed: true,
      details: `BUY Take Profit ($${risk.takeProfit}) is strictly above Entry ($${risk.entry.suggestedEntry})`
    });
  } catch (err: any) {
    reports.push({ id: 10, name: 'TP above entry for BUY', passed: false, details: err.message });
  }

  // Test 11: R:R calculation
  try {
    const candles = await marketDataService.getCandles('BTCUSDT', '1h', 20);
    const mockStrategyOutput = {
      primaryStrategy: 'RSI_MOMENTUM',
      direction: 'LONG' as const,
      score: 6,
      maxScore: 7,
      confidence: 0.85,
      reasoning: ['Bullish setup'],
      subSignals: []
    };
    const risk = riskEngine.evaluateRisk(mockStrategyOutput, 75000, candles, { atr: 1000 } as any);
    const expectedRR = Number((Math.abs(risk.takeProfit - 75000) / Math.abs(75000 - risk.stopLoss)).toFixed(2));
    assert(Math.abs(risk.riskRewardRatio - expectedRR) <= 0.02, `R:R calculation mismatch: got ${risk.riskRewardRatio}, expected ${expectedRR}`);
    assert(risk.riskRewardRatio >= 1.5, `R:R must be >= 1.5, got ${risk.riskRewardRatio}`);
    reports.push({
      id: 11,
      name: 'R:R calculation',
      passed: true,
      details: `Risk:Reward verified as 1:${risk.riskRewardRatio} (>= 1:1.5 requirement)`
    });
  } catch (err: any) {
    reports.push({ id: 11, name: 'R:R calculation', passed: false, details: err.message });
  }

  // Test 12: Stale market data
  try {
    tradingFallbackStore.updateSettings('test-user', { enabled: true, status: 'ENABLED' });
    const staleSnapshot = {
      symbol: 'BTCUSDT',
      timestamp: new Date().toISOString(),
      lastPrice: 76000,
      bid: 75990,
      ask: 76010,
      latestCandle: {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: new Date(Date.now() - 10000 * 1000).toISOString(),
        open: 75800,
        high: 76100,
        low: 75700,
        close: 76000,
        volume: 500
      },
      candleTimestamp: new Date(Date.now() - 10000 * 1000).toISOString(),
      timeframe: '1h',
      dataSource: 'BINANCE_LIVE' as const,
      dataVersion: 'STALE_SNAP_TEST',
      isStale: true,
      stalenessAgeSeconds: 10000,
      candles: []
    };

    const mockRec: any = {
      id: 'REC_STALE_TEST',
      asset: 'BTCUSDT',
      timeframe: '1h',
      action: 'BUY',
      strength: 'HIGH',
      decisionMode: 'EXPLOIT',
      entry: { type: 'ZONE', low: 75900, high: 76100, suggestedEntry: 76000 },
      stopLoss: 74500,
      takeProfit: 78000,
      riskReward: 2.0,
      positionSize: 0.1,
      positionValueUSD: 7600,
      strategy: 'HYBRID_v1',
      score: 6,
      maxScore: 7,
      riskAssessment: { status: 'PASS', riskLevel: 'LOW', reasons: [], warnings: [] },
      canonicalSnapshot: staleSnapshot,
      timestamp: new Date().toISOString(),
      dataTimestamp: staleSnapshot.candleTimestamp
    };

    const validation = await ExecutionSafetyEngine.validatePreTrade('test-user', mockRec);
    assert(validation.allowed === false, 'Stale data must not be allowed to execute');
    assert(validation.reasons.some(r => r.includes('MARKET_DATA_STALE')), `Expected MARKET_DATA_STALE reason, got: ${validation.reasons.join(', ')}`);
    reports.push({
      id: 12,
      name: 'Stale market data detection',
      passed: true,
      details: `Stale snapshot (10,000s old) successfully intercepted and rejected with MARKET_DATA_STALE`
    });
  } catch (err: any) {
    reports.push({ id: 12, name: 'Stale market data detection', passed: false, details: err.message });
  }

  // Test 13: Duplicate execution
  try {
    const testUserId = `test-user-${Date.now()}`;
    tradingFallbackStore.updateSettings(testUserId, { enabled: true, status: 'ENABLED', riskPerTrade: 0.01 });

    const rec = await recommendationEngine.generateRecommendation('BTCUSDT', '1h', testUserId);
    (rec as any).id = `SIG_IDEM_${Date.now()}`;
    if (rec.action !== 'BUY' && rec.action !== 'SELL') {
      rec.action = 'BUY';
      rec.riskAssessment.status = 'PASS';
    }

    const res1 = await ExecutionEngine.processTradeRecommendation(testUserId, rec);
    assert(res1.executed === true, `First execution should succeed: ${res1.message}`);

    const res2 = await ExecutionEngine.processTradeRecommendation(testUserId, rec);
    const wasBlockedByIdempotency = res2.executed === false && (res2.message.includes('Duplicate') || res2.validation.reasons.some(r => r.includes('Duplicate')));
    assert(wasBlockedByIdempotency || res2.orderResult?.reason?.includes('idempotency'), `Duplicate order must be blocked: ${res2.message}`);
    reports.push({
      id: 13,
      name: 'Duplicate execution prevention',
      passed: true,
      details: `Idempotency key successfully guarded against duplicate order placement: ${res2.message}`
    });
  } catch (err: any) {
    reports.push({ id: 13, name: 'Duplicate execution prevention', passed: false, details: err.message });
  }

  // Test 14: Concurrent monitoring cycles
  try {
    const testUserId = `concurrent-user-${Date.now()}`;
    tradingFallbackStore.updateSettings(testUserId, { enabled: true, status: 'ENABLED' });

    const p1 = AutoTradingEngine.runMonitoringCycle(testUserId);
    const p2 = AutoTradingEngine.runMonitoringCycle(testUserId);
    const [r1, r2] = await Promise.all([p1, p2]);

    const oneWasBusy = r1.status === 'BUSY' || r2.status === 'BUSY' || r1.logs.some(l => l.includes('mutex')) || r2.logs.some(l => l.includes('mutex'));
    assert(oneWasBusy, 'One of the concurrent cycles must be rejected by the mutex lock');
    reports.push({
      id: 14,
      name: 'Concurrent monitoring cycles lock',
      passed: true,
      details: `Mutex lock successfully caught overlapping cycle and prevented race condition`
    });
  } catch (err: any) {
    reports.push({ id: 14, name: 'Concurrent monitoring cycles lock', passed: false, details: err.message });
  }

  // Test 15: Paper approval without execution
  try {
    const testUserId = `approval-user-${Date.now()}`;
    tradingFallbackStore.updateSettings(testUserId, { enabled: false, status: 'DISABLED' });
    const todayStr = new Date().toISOString().split('T')[0];
    const initialDaily = tradingFallbackStore.getDailyState(testUserId, todayStr);
    const initialTrades = initialDaily.totalTrades || 0;

    await recommendationEngine.generateRecommendation('BTCUSDT', '1h', testUserId);
    
    const dailyAfter = tradingFallbackStore.getDailyState(testUserId, todayStr);
    assert(dailyAfter.totalTrades === initialTrades, `Today trades must remain ${initialTrades}, got ${dailyAfter.totalTrades}`);
    reports.push({
      id: 15,
      name: 'Paper approval without execution',
      passed: true,
      details: `Approved candidate setup verified while Today's Trades strictly remained 0 (Awaiting Execution)`
    });
  } catch (err: any) {
    reports.push({ id: 15, name: 'Paper approval without execution', passed: false, details: err.message });
  }

  // Test 16: Successful paper execution
  try {
    const testUserId = `exec-user-${Date.now()}`;
    tradingFallbackStore.updateSettings(testUserId, { enabled: true, status: 'ENABLED', riskPerTrade: 0.01 });
    const todayStr = new Date().toISOString().split('T')[0];
    const beforeDaily = tradingFallbackStore.getDailyState(testUserId, todayStr);
    const beforeCount = beforeDaily.totalTrades || 0;

    const rec = await recommendationEngine.generateRecommendation('BTCUSDT', '1h', testUserId);
    rec.action = 'BUY';
    rec.riskAssessment.status = 'PASS';

    const execResult = await ExecutionEngine.processTradeRecommendation(testUserId, rec);
    assert(execResult.executed === true, `Execution should succeed: ${execResult.message}`);

    const afterDaily = tradingFallbackStore.getDailyState(testUserId, todayStr);
    assert(afterDaily.totalTrades === beforeCount + 1, `Today's Trades must increment to ${beforeCount + 1}, got ${afterDaily.totalTrades}`);
    reports.push({
      id: 16,
      name: 'Successful paper execution',
      passed: true,
      details: `Execution opened position and incremented Today's Trades from ${beforeCount} to ${afterDaily.totalTrades}`
    });
  } catch (err: any) {
    reports.push({ id: 16, name: 'Successful paper execution', passed: false, details: err.message });
  }

  // Test 17: Execution failure
  try {
    const testUserId = `fail-user-${Date.now()}`;
    tradingFallbackStore.updateSettings(testUserId, { enabled: true, status: 'ENABLED', maxAssetExposure: 0.01 });
    const rec = await recommendationEngine.generateRecommendation('BTCUSDT', '1h', testUserId);
    rec.action = 'BUY';
    rec.positionSize = 5.0;

    const result = await ExecutionEngine.processTradeRecommendation(testUserId, rec);
    assert(result.executed === false, 'Execution should be blocked by exposure safety gate');
    reports.push({
      id: 17,
      name: 'Execution failure safety gate',
      passed: true,
      details: `Safety gate correctly blocked execution: ${result.message}`
    });
  } catch (err: any) {
    reports.push({ id: 17, name: 'Execution failure safety gate', passed: false, details: err.message });
  }

  // Test 18: BTC
  try {
    const btcSnapshot = await marketDataService.getCanonicalSnapshot('BTCUSDT', '1h');
    assert(btcSnapshot.lastPrice > 10000, `BTC price must be reasonable, got ${btcSnapshot.lastPrice}`);
    assert(btcSnapshot.symbol === 'BTCUSDT', 'Symbol must be BTCUSDT');
    const rec = await recommendationEngine.generateRecommendation('BTCUSDT', '1h');
    assert(rec.asset === 'BTCUSDT', 'Recommendation must be for BTCUSDT');
    reports.push({
      id: 18,
      name: 'BTC/USDT End-to-End pipeline',
      passed: true,
      details: `BTC pipeline verified: Price $${btcSnapshot.lastPrice}, Score ${rec.score}/7, Mode: ${rec.decisionMode}`
    });
  } catch (err: any) {
    reports.push({ id: 18, name: 'BTC/USDT End-to-End pipeline', passed: false, details: err.message });
  }

  // Test 19: ETH
  try {
    const ethSnapshot = await marketDataService.getCanonicalSnapshot('ETHUSDT', '1h');
    assert(ethSnapshot.lastPrice > 500, `ETH price must be reasonable, got ${ethSnapshot.lastPrice}`);
    assert(ethSnapshot.symbol === 'ETHUSDT', 'Symbol must be ETHUSDT');
    const rec = await recommendationEngine.generateRecommendation('ETHUSDT', '1h');
    assert(rec.asset === 'ETHUSDT', 'Recommendation must be for ETHUSDT');
    reports.push({
      id: 19,
      name: 'ETH/USDT End-to-End pipeline',
      passed: true,
      details: `ETH pipeline verified: Price $${ethSnapshot.lastPrice}, Score ${rec.score}/7, Mode: ${rec.decisionMode}`
    });
  } catch (err: any) {
    reports.push({ id: 19, name: 'ETH/USDT End-to-End pipeline', passed: false, details: err.message });
  }

  // SUMMARY
  console.log('\n====================================================');
  console.log('AUDIT TEST RESULTS SUMMARY');
  console.log('====================================================');
  let passedCount = 0;
  for (const r of reports) {
    const status = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`[Test ${r.id.toString().padStart(2, '0')}] ${status} - ${r.name}`);
    console.log(`         Details: ${r.details}`);
    if (r.passed) passedCount++;
  }
  console.log('====================================================');
  console.log(`TOTAL: ${passedCount}/${reports.length} TESTS PASSED`);
  console.log('====================================================\n');

  if (passedCount !== reports.length) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});

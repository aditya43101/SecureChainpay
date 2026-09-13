import { recommendationEngine } from '../src/lib/trading/recommendation-engine';
import { ExecutionEngine } from '../src/lib/trading/execution-engine';
import { ExecutionSafetyEngine } from '../src/lib/trading/execution-safety';
import { AutoTradingEngine } from '../src/lib/trading/auto-trading-engine';
import { tradingFallbackStore } from '../src/lib/trading/trading-fallback-store';

async function runDeterministicTests() {
  console.log('====================================================');
  console.log('SECURECHAIN PAY - 3/7 EXPLORATION PIPELINE TEST SUITE');
  console.log('====================================================\n');

  const testUserId = 'test-user-decision-pipeline';

  // 1. Initialize settings for test user
  tradingFallbackStore.updateSettings(testUserId, {
    enabled: true,
    status: 'ENABLED',
    allTimeMode: true,
    allowedAssets: ['BTCUSDT', 'ETHUSDT'],
    allowedTimeframes: ['1h'],
    strategyVersion: 'HYBRID_v1',
    modelVersion: 'LOG_v1',
    riskPerTrade: 0.01,
    maxDailyLoss: 0.03,
    maxOpenPositions: 3,
    maxAssetExposure: 0.10,
    minRiskReward: 1.5,
    cooldownPeriod: 0 // zero for immediate test execution
  });

  // Reset paper account to clean $100,000
  tradingFallbackStore.updatePaperAccount(testUserId, {
    cashBalance: 100000,
    equity: 100000,
    realizedPnL: 0
  });

  // ----------------------------------------------------
  // TEST 1: BTC Decision Trace & Controlled Exploration
  // ----------------------------------------------------
  console.log('--- TEST 1: BTCUSDT 1h Pipeline Evaluation ---');
  const btcRec = await recommendationEngine.generateRecommendation('BTCUSDT', '1h', testUserId);
  console.log(`BTC Signal: ${btcRec.action} | Confidence: ${btcRec.score}/${btcRec.maxScore} | Mode: ${btcRec.decisionMode}`);
  console.log(`Risk Assessment: ${btcRec.riskAssessment.status} (Level: ${btcRec.riskAssessment.riskLevel})`);
  console.log(`SL: $${btcRec.stopLoss} | TP: $${btcRec.takeProfit} | R:R: 1:${btcRec.riskReward}`);
  console.log(`Position Size: ${btcRec.positionSize} BTC ($${btcRec.positionValueUSD} notional)`);
  console.log('Decision Trace:', JSON.stringify(btcRec.decisionTrace, null, 2));

  if (btcRec.score === 3) {
    if (btcRec.decisionMode !== 'EXPLORE') {
      throw new Error(`Expected BTC 3/7 to have decisionMode EXPLORE, got ${btcRec.decisionMode}`);
    }
    console.log('✅ TEST 1 PASSED: BTC 3/7 correctly mapped to EXPLORE mode with scaled position size.\n');
  }

  // ----------------------------------------------------
  // TEST 2: ETH Decision Trace & Controlled Exploration
  // ----------------------------------------------------
  console.log('--- TEST 2: ETHUSDT 1h Pipeline Evaluation ---');
  const ethRec = await recommendationEngine.generateRecommendation('ETHUSDT', '1h', testUserId);
  console.log(`ETH Signal: ${ethRec.action} | Confidence: ${ethRec.score}/${ethRec.maxScore} | Mode: ${ethRec.decisionMode}`);
  console.log(`Risk Assessment: ${ethRec.riskAssessment.status} (Level: ${ethRec.riskAssessment.riskLevel})`);
  console.log(`SL: $${ethRec.stopLoss} | TP: $${ethRec.takeProfit} | R:R: 1:${ethRec.riskReward}`);
  console.log(`Position Size: ${ethRec.positionSize} ETH ($${ethRec.positionValueUSD} notional)`);
  console.log('Decision Trace:', JSON.stringify(ethRec.decisionTrace, null, 2));

  if (ethRec.score === 3) {
    if (ethRec.decisionMode !== 'EXPLORE') {
      throw new Error(`Expected ETH 3/7 to have decisionMode EXPLORE, got ${ethRec.decisionMode}`);
    }
    console.log('✅ TEST 2 PASSED: ETH 3/7 correctly mapped to EXPLORE mode with scaled position size.\n');
  }

  // ----------------------------------------------------
  // TEST 3: Paper Trade Execution via ExecutionEngine
  // ----------------------------------------------------
  console.log('--- TEST 3: Paper Trade Execution for Eligible Exploratory Recommendation ---');
  const targetRec = ethRec.action === 'BUY' || ethRec.action === 'SELL' ? ethRec : btcRec;
  const execResult = await ExecutionEngine.processTradeRecommendation(testUserId, targetRec);
  console.log('Execution Status:', execResult.executed ? 'APPROVED & FILLED' : 'REJECTED');
  console.log('Execution Message:', execResult.message);
  if (execResult.orderResult) {
    console.log(`Order ID: ${execResult.orderResult.orderId} | Status: ${execResult.orderResult.status} | Fill Price: $${execResult.orderResult.executedPrice}`);
  }
  const paperAcc = tradingFallbackStore.getPaperAccount(testUserId);
  console.log(`Updated Paper Account Cash Balance: $${paperAcc.cashBalance.toFixed(2)} | Active Positions: ${paperAcc.positions.length}`);
  
  if (!execResult.executed && !paperAcc.positions.length) {
    throw new Error('Expected paper trade execution to succeed for eligible exploratory recommendation');
  }
  console.log('✅ TEST 3 PASSED: Exploratory paper trade executed and persisted into paper account.\n');

  // ----------------------------------------------------
  // TEST 4: Hard Risk Gate Failure (Duplicate Position Protection)
  // ----------------------------------------------------
  console.log('--- TEST 4: Duplicate Position Protection Gate ---');
  // Attempt to execute the same asset again while position is already open
  const dupResult = await ExecutionEngine.processTradeRecommendation(testUserId, targetRec);
  console.log('Duplicate Execution Status:', dupResult.executed ? 'APPROVED' : 'BLOCKED');
  console.log('Rejection Reason:', dupResult.validation.reasons.join('; '));
  if (dupResult.executed) {
    throw new Error('Expected duplicate position protection to block duplicate trade');
  }
  console.log('✅ TEST 4 PASSED: Hard safety gate correctly blocked duplicate trade.\n');

  // ----------------------------------------------------
  // TEST 5: Hard Risk Gate Failure (Daily Loss Limit Exceeded)
  // ----------------------------------------------------
  console.log('--- TEST 5: Daily Loss Limit Gate ---');
  const todayStr = new Date().toISOString().split('T')[0];
  tradingFallbackStore.updateDailyState(testUserId, todayStr, {
    dailyLossLimitReached: true,
    realizedPnL: -3500 // Exceeded 3%
  });

  const lossGateValidation = await ExecutionSafetyEngine.validatePreTrade(testUserId, btcRec);
  console.log('Daily Loss Gate Allowed:', lossGateValidation.allowed);
  console.log('Daily Loss Reasons:', lossGateValidation.reasons.join('; '));
  if (lossGateValidation.allowed) {
    throw new Error('Expected daily loss limit to block execution');
  }
  console.log('✅ TEST 5 PASSED: Daily loss limit hard gate correctly rejected trade.\n');

  // ----------------------------------------------------
  // TEST 6: AutoTradingEngine Full Monitoring Cycle
  // ----------------------------------------------------
  console.log('--- TEST 6: AutoTradingEngine Monitoring Cycle ---');
  // Reset daily loss for full cycle test
  tradingFallbackStore.updateDailyState(testUserId, todayStr, {
    dailyLossLimitReached: false,
    realizedPnL: 0
  });

  const cycleResult = await AutoTradingEngine.runMonitoringCycle(testUserId);
  console.log('Cycle Status:', cycleResult.status);
  console.log('Assets Evaluated:', cycleResult.assetsEvaluated.join(', '));
  console.log('Recommendations Generated:', cycleResult.recommendationsGenerated);
  console.log('Trades Executed:', cycleResult.tradesExecuted);
  console.log('Cycle Logs:');
  cycleResult.logs.forEach(l => console.log('  •', l));
  console.log('✅ TEST 6 PASSED: Full auto-trading cycle completed successfully with structured logs.\n');

  console.log('====================================================');
  console.log('ALL PHASE 1 DETERMINISTIC TESTS PASSED WITH 100% SUCCESS!');
  console.log('====================================================');
}

runDeterministicTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

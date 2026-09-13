/**
 * SecureChain Pay — Phase 3 Test Suite:
 * Outcome Learning + Pattern Intelligence Engine
 * 
 * Verifies:
 * 1. Feature Extraction & Normalization (Raw + Categorical)
 * 2. Deterministic Loss Analysis (Non-causal phrasing)
 * 3. Deterministic Win Analysis
 * 4. Repeated Loss Pattern Discovery (10 BTC trades: 8 loss, 2 win -> LOSING_PATTERN)
 * 5. Repeated Win Pattern Discovery (15 ETH trades: 11 win, 4 loss -> WINNING_PATTERN)
 * 6. Minimum Sample Size Enforcement (1 trade -> Insufficient evidence, no candidate)
 * 7. Duplicate Pattern Prevention (Canonical fingerprinting & in-place update)
 * 8. Asset Isolation (BTC patterns != ETH patterns)
 * 9. Direction Isolation (LONG patterns != SHORT patterns)
 * 10. Pattern Drift Detection (Deteriorating recent performance -> DEGRADING)
 * 11. Confidence Calibration (1/7 to 7/7 metrics + CONFIDENCE_CALIBRATION_EVENT)
 * 12. Candidate Lesson Generation & Grounding (Anti-hallucination verification)
 * 13. Phase 4 Preparation Interfaces (Query & backtest dataset readiness)
 * 14. Strategy Immutability Guarantee (Zero automated strategy mutation)
 */

import { PatternIntelligenceEngine, NormalizedFeatures, PatternRecord } from '../src/lib/trading/pattern-intelligence-engine';
import { OutcomeIntelligenceService } from '../src/lib/trading/outcome-intelligence';
import { PaperTradeOutcomeRecord } from '../src/lib/trading/paper-trade-lifecycle';
import { tradingFallbackStore } from '../src/lib/trading/trading-fallback-store';

let testsPassed = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`, detail ? detail : '');
    throw new Error(`Test failed: ${testName}`);
  }
}

// Helper to construct mock completed paper trade records
function makeMockTrade(params: {
  tradeId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  pnl: number;
  rsi: number;
  volatility: number;
  regime?: string;
  decisionMode?: 'EXPLORATION' | 'EXPLOITATION';
  confidenceScore?: number;
  holdingDurationMinutes?: number;
  mae?: number;
  mfe?: number;
  macdHist?: number;
  exitReason?: string;
}): PaperTradeOutcomeRecord {
  const isWin = params.pnl > 0.05;
  const isLoss = params.pnl < -0.05;
  const outcome = isWin ? 'WIN' : (isLoss ? 'LOSS' : 'BREAKEVEN');

  return {
    tradeId: params.tradeId,
    positionId: `pos_${params.tradeId}`,
    orderId: `ord_${params.tradeId}`,
    userId: 'test-user-p3',
    symbol: params.symbol,
    side: params.side,
    strategyId: 'STRAT_HYBRID',
    strategyVersion: 'v1.0.0',
    timeframe: '1h',
    decisionMode: params.decisionMode || 'EXPLOITATION',
    confidenceScore: params.confidenceScore ?? 5,
    entryPrice: 50000,
    exitPrice: 50000 + (params.side === 'LONG' ? params.pnl : -params.pnl),
    stopLoss: 49000,
    takeProfit: 52000,
    quantity: 0.1,
    positionSizeUSDT: 5000,
    realizedPnL: params.pnl,
    returnPercent: (params.pnl / 5000) * 100,
    feesUSDT: 2.5,
    outcome,
    exitReason: params.exitReason || (isLoss ? 'STOP_LOSS' : 'TAKE_PROFIT'),
    holdingDurationMinutes: params.holdingDurationMinutes ?? 45,
    mae: params.mae ?? (isLoss ? 1.8 : 0.3),
    mfe: params.mfe ?? (isWin ? 2.5 : 0.4),
    entrySnapshot: {
      snapshotId: `snap_in_${params.tradeId}`,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      tradeId: params.tradeId,
      symbol: params.symbol,
      side: params.side,
      indicators: {
        rsi: params.rsi,
        ema20: 50200,
        ema50: 50000,
        macd: { macd: 12, signal: 10, histogram: params.macdHist ?? 2.0 },
        volatility: params.volatility,
        adx: 28,
        atr: 120,
      },
      market: {
        currentPrice: 50000,
        volume: 1500,
        marketRegime: params.regime || 'TRENDING_BULLISH',
      },
    },
    exitSnapshot: {
      snapshotId: `snap_out_${params.tradeId}`,
      timestamp: new Date().toISOString(),
      tradeId: params.tradeId,
      exitPrice: 50000 + (params.side === 'LONG' ? params.pnl : -params.pnl),
      realizedPnL: params.pnl,
      returnPercent: (params.pnl / 5000) * 100,
      marketRegime: params.regime || 'TRENDING_BULLISH',
      exitReason: params.exitReason || (isLoss ? 'STOP_LOSS' : 'TAKE_PROFIT'),
    },
    openedAt: new Date(Date.now() - 3600000).toISOString(),
    closedAt: new Date().toISOString(),
  };
}

async function runPhase3Tests() {
  console.log('\n============================================================');
  console.log('🧪 SECURECHAIN PAY — PHASE 3 TEST SUITE');
  console.log('   Outcome Learning + Pattern Intelligence Engine');
  console.log('============================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Feature Extraction & Normalization
  // --------------------------------------------------------------------------
  console.log('--- Test 1: Feature Extraction & Normalization ---');
  const sampleTrade = makeMockTrade({
    tradeId: 'tr_feat_1',
    symbol: 'BTCUSDT',
    side: 'LONG',
    pnl: -85.0,
    rsi: 74.5, // Overbought
    volatility: 42.0, // High
    regime: 'HIGH_VOLATILITY',
    confidenceScore: 3,
    decisionMode: 'EXPLORATION',
    macdHist: -0.05, // Bearish
  });

  const feat = PatternIntelligenceEngine.extractFeatures(sampleTrade);
  assert(feat.symbol === 'BTCUSDT', 'Raw symbol preserved');
  assert(feat.rsi === 74.5, 'Raw RSI preserved');
  assert(feat.rsiBucket === 'OVERBOUGHT', 'Normalized RSI bucket = OVERBOUGHT');
  assert(feat.volatilityBucket === 'HIGH', 'Normalized Volatility bucket = HIGH');
  assert(feat.confidenceBucket === '3/7', 'Normalized Confidence bucket = 3/7');
  assert(feat.decisionMode === 'EXPLORATION', 'Decision mode categorized as EXPLORATION');
  assert(feat.macdDirection === 'BEARISH', 'MACD direction normalized to BEARISH');

  // --------------------------------------------------------------------------
  // TEST 2: Deterministic Loss Analysis
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Deterministic Loss Analysis ---');
  const lossAnalysis = PatternIntelligenceEngine.analyzeLoss(feat, sampleTrade.tradeId);
  assert(lossAnalysis.lossAmount === 85.0, 'Loss amount correctly computed');
  assert(lossAnalysis.candidateFactors.length > 0, 'Candidate factors identified');
  const factorNames = lossAnalysis.candidateFactors.map(f => f.factor);
  assert(factorNames.includes('LATE_ENTRY') || factorNames.includes('HIGH_VOLATILITY') || factorNames.includes('WEAK_MOMENTUM'),
    'Loss factors include expected conditions (LATE_ENTRY / HIGH_VOLATILITY / WEAK_MOMENTUM)');
  assert(!lossAnalysis.nonCausalSummary.includes('caused by') && !lossAnalysis.nonCausalSummary.includes('causes'),
    'Loss summary maintains objective non-causal language');

  // --------------------------------------------------------------------------
  // TEST 3: Deterministic Win Analysis
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Deterministic Win Analysis ---');
  const winTrade = makeMockTrade({
    tradeId: 'tr_win_1',
    symbol: 'ETHUSDT',
    side: 'LONG',
    pnl: 140.0,
    rsi: 56.0, // Healthy
    volatility: 22.0, // Normal
    regime: 'TRENDING_BULLISH',
    macdHist: 0.12, // Bullish
    mae: 0.2,
    mfe: 2.8,
  });

  const winFeat = PatternIntelligenceEngine.extractFeatures(winTrade);
  const winAnalysis = PatternIntelligenceEngine.analyzeWin(winFeat, winTrade.tradeId);
  assert(winAnalysis.gainAmount === 140.0, 'Gain amount correctly computed');
  assert(winAnalysis.favorableFactors.some(f => f.factor === 'TREND_ALIGNMENT' || f.factor === 'BALANCED_MOMENTUM_ENTRY'),
    'Win analysis captured favorable conditions');

  // --------------------------------------------------------------------------
  // TEST 4: Repeated Loss Pattern Discovery (10 BTC trades: 8 loss, 2 win)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: Repeated Loss Pattern Discovery ---');
  const btcLosingBatch: PaperTradeOutcomeRecord[] = [];
  for (let i = 0; i < 10; i++) {
    const isLoss = i < 8;
    btcLosingBatch.push(makeMockTrade({
      tradeId: `btc_loss_${i}`,
      symbol: 'BTCUSDT',
      side: 'LONG',
      pnl: isLoss ? -65.0 : 45.0,
      rsi: 75.0,
      volatility: 45.0,
      regime: 'HIGH_VOLATILITY',
      macdHist: -0.04,
      decisionMode: 'EXPLORATION',
      confidenceScore: 3,
    }));
  }

  const btcDiscovery = PatternIntelligenceEngine.discoverPatterns(btcLosingBatch, 5);
  assert(btcDiscovery.patterns.length === 1, 'Exactly 1 candidate pattern discovered for uniform cluster');
  const btcPattern = btcDiscovery.patterns[0];
  assert(btcPattern.patternType === 'LOSING_PATTERN', 'Pattern classified as LOSING_PATTERN');
  assert(btcPattern.sampleCount === 10, 'Sample count = 10');
  assert(btcPattern.winCount === 2, 'Win count = 2');
  assert(btcPattern.lossCount === 8, 'Loss count = 8');
  assert(btcPattern.winRate === 20.0, 'Win rate = 20.0%');
  assert(btcPattern.status === 'CANDIDATE', 'Pattern status = CANDIDATE');
  assert(btcPattern.isCandidateForStrategyAdjustment === true, 'Pattern flagged for Phase 4 strategy review');

  // --------------------------------------------------------------------------
  // TEST 5: Repeated Win Pattern Discovery (15 ETH trades: 11 win, 4 loss)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Repeated Win Pattern Discovery ---');
  const ethWinningBatch: PaperTradeOutcomeRecord[] = [];
  for (let i = 0; i < 15; i++) {
    const isWin = i < 11;
    ethWinningBatch.push(makeMockTrade({
      tradeId: `eth_win_${i}`,
      symbol: 'ETHUSDT',
      side: 'LONG',
      pnl: isWin ? 110.0 : -40.0,
      rsi: 58.0,
      volatility: 22.0,
      regime: 'TRENDING_BULLISH',
      macdHist: 0.15,
      decisionMode: 'EXPLOITATION',
      confidenceScore: 6,
    }));
  }

  const ethDiscovery = PatternIntelligenceEngine.discoverPatterns(ethWinningBatch, 5);
  assert(ethDiscovery.patterns.length === 1, 'Exactly 1 candidate winning pattern discovered');
  const ethPattern = ethDiscovery.patterns[0];
  assert(ethPattern.patternType === 'WINNING_PATTERN', 'Pattern classified as WINNING_PATTERN');
  assert(ethPattern.sampleCount === 15, 'Sample count = 15');
  assert(ethPattern.winCount === 11, 'Win count = 11');
  assert(ethPattern.lossCount === 4, 'Loss count = 4');
  assert(ethPattern.winRate === 73.3, 'Win rate = 73.3%');
  assert(ethPattern.status === 'CANDIDATE', 'Pattern status = CANDIDATE');

  // --------------------------------------------------------------------------
  // TEST 6: Minimum Sample Size Enforcement
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: Minimum Sample Size Enforcement ---');
  const singleTrade = [makeMockTrade({
    tradeId: 'single_tr_1',
    symbol: 'SOLUSDT',
    side: 'LONG',
    pnl: -120.0,
    rsi: 80.0,
    volatility: 70.0,
  })];
  const singleDiscovery = PatternIntelligenceEngine.discoverPatterns(singleTrade, 5);
  assert(singleDiscovery.patterns.length === 0, 'No candidate pattern created for single trade (n < 5)');
  assert(singleDiscovery.insufficientEvidenceTrades === 1, 'Single trade marked as insufficientEvidenceTrades');

  // --------------------------------------------------------------------------
  // TEST 7: Duplicate Pattern Prevention & Canonical Fingerprint
  // --------------------------------------------------------------------------
  console.log('\n--- Test 7: Duplicate Pattern Prevention ---');
  const combinedBatch = [...btcLosingBatch, makeMockTrade({
    tradeId: 'btc_loss_extra',
    symbol: 'BTCUSDT',
    side: 'LONG',
    pnl: -70.0,
    rsi: 75.0,
    volatility: 45.0,
    regime: 'HIGH_VOLATILITY',
    macdHist: -0.04,
    decisionMode: 'EXPLORATION',
    confidenceScore: 3,
  })];
  const updatedDiscovery = PatternIntelligenceEngine.discoverPatterns(combinedBatch, 5);
  assert(updatedDiscovery.patterns.length === 1, 'Pattern count remains 1 (no duplicate pattern created)');
  assert(updatedDiscovery.patterns[0].sampleCount === 11, 'Sample count updated from 10 to 11');
  assert(updatedDiscovery.patterns[0].fingerprint === btcPattern.fingerprint, 'Canonical fingerprint remains identical');

  // --------------------------------------------------------------------------
  // TEST 8: Asset Isolation (BTC vs ETH)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 8: Asset Isolation ---');
  const btcAndEthBatch = [...btcLosingBatch, ...ethWinningBatch];
  const dualDiscovery = PatternIntelligenceEngine.discoverPatterns(btcAndEthBatch, 5);
  assert(dualDiscovery.patterns.length === 2, 'Two isolated patterns discovered (BTC and ETH segregated)');
  const btcFound = dualDiscovery.patterns.find(p => p.symbol.includes('BTC'));
  const ethFound = dualDiscovery.patterns.find(p => p.symbol.includes('ETH'));
  assert(btcFound?.patternType === 'LOSING_PATTERN', 'BTC pattern is LOSING');
  assert(ethFound?.patternType === 'WINNING_PATTERN', 'ETH pattern is WINNING');

  // --------------------------------------------------------------------------
  // TEST 9: Direction Isolation (LONG vs SHORT)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 9: Direction Isolation ---');
  const btcShortTrade = makeMockTrade({
    tradeId: 'btc_short_1',
    symbol: 'BTCUSDT',
    side: 'SHORT',
    pnl: 150.0,
    rsi: 75.0,
    volatility: 45.0,
  });
  const shortFp = PatternIntelligenceEngine.computeFingerprint(PatternIntelligenceEngine.extractFeatures(btcShortTrade));
  assert(shortFp !== btcPattern.fingerprint, 'LONG and SHORT fingerprints are strictly distinct');
  assert(shortFp.includes('_SHORT_'), 'SHORT fingerprint contains _SHORT_ identifier');

  // --------------------------------------------------------------------------
  // TEST 10: Pattern Drift Detection
  // --------------------------------------------------------------------------
  console.log('\n--- Test 10: Pattern Drift Detection ---');
  // Construct a pattern that had 20 wins historically (100% win rate), but recent 10 trades were all losses (0% win rate)
  const driftingBatch: PaperTradeOutcomeRecord[] = [];
  for (let i = 0; i < 20; i++) {
    driftingBatch.push(makeMockTrade({
      tradeId: `drift_hist_${i}`,
      symbol: 'BTCUSDT',
      side: 'LONG',
      pnl: 100.0,
      rsi: 55.0,
      volatility: 20.0,
      regime: 'TRENDING_BULLISH',
      decisionMode: 'EXPLOITATION',
    }));
  }
  for (let i = 0; i < 10; i++) {
    driftingBatch.push(makeMockTrade({
      tradeId: `drift_recent_${i}`,
      symbol: 'BTCUSDT',
      side: 'LONG',
      pnl: -90.0,
      rsi: 55.0,
      volatility: 20.0,
      regime: 'TRENDING_BULLISH',
      decisionMode: 'EXPLOITATION',
    }));
  }
  const driftDiscovery = PatternIntelligenceEngine.discoverPatterns(driftingBatch, 5);
  assert(driftDiscovery.patterns.length === 1, 'Drifting pattern identified');
  const driftPat = driftDiscovery.patterns[0];
  assert(driftPat.isDegrading === true, 'isDegrading flag triggered (recent win rate dropped > 25%)');
  assert(driftPat.status === 'DEGRADING', 'Pattern status updated to DEGRADING');

  // --------------------------------------------------------------------------
  // TEST 11: Confidence Calibration (1/7 to 7/7) & Mis-calibration Event
  // --------------------------------------------------------------------------
  console.log('\n--- Test 11: Confidence Calibration Engine ---');
  const calibrationBatch: PaperTradeOutcomeRecord[] = [];
  // 3/7: 10 trades, 3 wins (30% win rate)
  for (let i = 0; i < 10; i++) {
    calibrationBatch.push(makeMockTrade({ tradeId: `cal_3_${i}`, symbol: 'BTCUSDT', side: 'LONG', pnl: i < 3 ? 50 : -50, confidenceScore: 3, rsi: 50, volatility: 25 }));
  }
  // 5/7: 10 trades, 7 wins (70% win rate)
  for (let i = 0; i < 10; i++) {
    calibrationBatch.push(makeMockTrade({ tradeId: `cal_5_${i}`, symbol: 'BTCUSDT', side: 'LONG', pnl: i < 7 ? 80 : -40, confidenceScore: 5, rsi: 50, volatility: 25 }));
  }
  // 7/7: 10 trades, 2 wins (20% win rate) -> Severe miscalibration!
  for (let i = 0; i < 10; i++) {
    calibrationBatch.push(makeMockTrade({ tradeId: `cal_7_${i}`, symbol: 'BTCUSDT', side: 'LONG', pnl: i < 2 ? 100 : -70, confidenceScore: 7, rsi: 50, volatility: 25 }));
  }

  const calResult = PatternIntelligenceEngine.calibrateConfidence(calibrationBatch);
  assert(calResult.tierStats.length === 7, 'Stats computed for all 7 confidence tiers');
  const t3 = calResult.tierStats.find(t => t.score === 3);
  const t5 = calResult.tierStats.find(t => t.score === 5);
  const t7 = calResult.tierStats.find(t => t.score === 7);

  assert(t3?.winRate === 30.0, 'Tier 3/7 win rate = 30%');
  assert(t5?.winRate === 70.0, 'Tier 5/7 win rate = 70%');
  assert(t7?.winRate === 20.0, 'Tier 7/7 win rate = 20%');
  assert(t7?.isUnderperforming === true, 'Tier 7/7 flagged as isUnderperforming');
  assert(calResult.calibrationEvents.some(e => e.tier === '7/7'), 'CONFIDENCE_CALIBRATION_EVENT emitted for 7/7 tier');

  // --------------------------------------------------------------------------
  // TEST 12: Candidate Lesson Generation & Grounding Verification
  // --------------------------------------------------------------------------
  console.log('\n--- Test 12: Candidate Lesson Generation & Grounding ---');
  const lesson = PatternIntelligenceEngine.generateCandidateLesson(btcPattern);
  assert(lesson.status === 'CANDIDATE', 'Lesson status is CANDIDATE');
  assert(lesson.lesson.includes('historically associated with'), 'Lesson uses observational phrase "historically associated with"');
  assert(lesson.sampleCount === 10, 'Lesson grounded sampleCount matches pattern');

  // Test anti-hallucination verification
  const validCheck = PatternIntelligenceEngine.verifyLessonGrounding(lesson.lesson, btcPattern);
  assert(validCheck.isGrounded === true, 'Legitimate lesson passes grounding verification');

  // Test violation injection
  const hallucinatedLesson = 'BTC LONG entries guarantee 95.0% win rate and causes immense profits across 50 trades.';
  const invalidCheck = PatternIntelligenceEngine.verifyLessonGrounding(hallucinatedLesson, btcPattern);
  assert(invalidCheck.isGrounded === false, 'Hallucinated lesson failed grounding check');
  assert(invalidCheck.violations.length > 0, 'Violations caught (unsupported claim / wrong stats)');

  // --------------------------------------------------------------------------
  // TEST 13: Phase 4 Preparation Interfaces
  // --------------------------------------------------------------------------
  console.log('\n--- Test 13: Phase 4 Preparation Interfaces ---');
  // Save patterns to fallback store
  await PatternIntelligenceEngine.persistDiscoveredPatterns([btcPattern, ethPattern], [lesson]);

  // Feed all mock trades to fallback store
  for (const t of [...btcLosingBatch, ...ethWinningBatch]) {
    tradingFallbackStore.saveTradeOutcome(t);
  }

  const backtestDataset = await OutcomeIntelligenceService.getPatternBacktestDataset(btcPattern.patternId);
  assert(backtestDataset.readyForPhase4Validation === true, 'Pattern backtest dataset ready for Phase 4');
  assert(backtestDataset.trades.length === 10, 'Supporting trades correctly assembled for backtest');

  const comparison = await OutcomeIntelligenceService.comparePatternPerformance(btcPattern.patternId);
  assert(comparison.pattern !== null, 'Pattern comparison retrieved');
  assert(comparison.deltaWinRate < 0, 'Losing pattern shows negative delta vs baseline');

  const adjRecommendation = OutcomeIntelligenceService.generateCandidateStrategyAdjustment(btcPattern);
  assert(adjRecommendation.status === 'PROPOSED_FOR_PHASE_4_BACKTEST', 'Recommendation status = PROPOSED_FOR_PHASE_4_BACKTEST');
  assert(adjRecommendation.disclaimer.includes('Phase 3 proposes candidate adjustments only'), 'Adjustment disclaimer explicitly enforced');

  // --------------------------------------------------------------------------
  // TEST 14: Strategy Immutability Guarantee
  // --------------------------------------------------------------------------
  console.log('\n--- Test 14: Strategy Immutability Guarantee ---');
  const championStrategy = tradingFallbackStore.getChampionStrategy();
  assert(championStrategy.parameters.minScore === 5, 'Champion minScore unchanged (remains 5)');
  assert(championStrategy.parameters.rsiFilter === true, 'Champion rsiFilter unchanged');
  assert(championStrategy.isChampion === true, 'Champion status unchanged');
  assert(championStrategy.versionName === 'HYBRID_v1', 'Strategy version unchanged');

  console.log('\n============================================================');
  console.log(`🎉 ALL ${testsPassed}/${totalTests} PHASE 3 TESTS PASSED SUCCESSFULLY!`);
  console.log('============================================================\n');
}

runPhase3Tests().catch(err => {
  console.error('\n❌ Phase 3 Tests failed:', err);
  process.exit(1);
});

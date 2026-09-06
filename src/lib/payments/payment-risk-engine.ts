/**
 * SecureChain Pay — Payment AI, Fraud Detection & Risk Engine
 * 
 * Architecture:
 * User Behavioral Baseline + Deterministic Rule Engine + ML Anomaly Model = Normalized Risk Score (0-100)
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface UserBehaviorProfile {
  userId: string;
  averageAmount: number;
  medianAmount: number;
  stdDevAmount: number;
  typicalMinAmount: number;
  typicalMaxAmount: number;
  totalTransactionsCount: number;
  knownRecipients: string[]; // List of wallet addresses / UIDs previously paid
  recentVelocity10m: number; // Transactions in last 10 minutes
  recentVelocity1h: number;  // Transactions in last 1 hour
  failedPaymentCount: number;
  walletAgeDays: number;
  lastPaymentAt?: string;
}

export interface RiskFeatureVector {
  amount: number;
  currency: string;
  amountDeviationScore: number; // 0 to 1
  recipientNovelty: boolean;
  velocityScore10m: number;
  velocityScore1h: number;
  failedPaymentRate: number;
  graphAnomalyDetected: boolean;
  timeWindowAnomaly: boolean;
}

export interface RiskFactor {
  code: string;
  field: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
}

export interface PaymentRiskAssessment {
  assessmentId: string;
  timestamp: string;
  userId: string;
  senderAddress: string;
  receiverAddress: string;
  receiverDisplayName?: string;
  amount: number;
  currency: string;
  riskScore: number; // 0 - 100
  riskLevel: RiskLevel;
  recommendation: 'PROCEED' | 'REQUIRE_CONFIRMATION' | 'REQUIRE_EXTRA_VERIFICATION' | 'HOLD_FOR_REVIEW';
  factors: RiskFactor[];
  featureVector: RiskFeatureVector;
  userProfileSummary: {
    typicalRange: string;
    averageAmount: number;
    isNewRecipient: boolean;
  };
  modelVersion: string;
  fallbackModeApplied?: boolean;
}

export const PAYMENT_AI_MODEL_VERSION = 'v1.4.2-adaptive-hybrid';

/**
 * Calculates behavioral stats from historical transactions.
 */
export function computeUserBehaviorProfile(
  userId: string,
  userTransactions: any[], // Raw transactions array
  walletCreatedAtISO?: string
): UserBehaviorProfile {
  const outgoingTxs = userTransactions.filter(
    (t) => t.type === 'debit' || t.type === 'trade' || (t.sender && t.userId === userId)
  );

  const amounts = outgoingTxs.map((t) => Number(t.amount || 0)).filter((a) => a > 0);
  const recipients = new Set<string>();
  outgoingTxs.forEach((t) => {
    if (t.receiver) recipients.add(t.receiver.toLowerCase());
    if (t.payload?.receiverWallet) recipients.add(t.payload.receiverWallet.toLowerCase());
  });

  const count = amounts.length;
  if (count === 0) {
    return {
      userId,
      averageAmount: 500,
      medianAmount: 500,
      stdDevAmount: 200,
      typicalMinAmount: 100,
      typicalMaxAmount: 2000,
      totalTransactionsCount: 0,
      knownRecipients: [],
      recentVelocity10m: 0,
      recentVelocity1h: 0,
      failedPaymentCount: 0,
      walletAgeDays: 30,
    };
  }

  // Sort amounts for median calculation
  const sorted = [...amounts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 500;
  const avg = amounts.reduce((a, b) => a + b, 0) / count;

  // Standard deviation
  const variance = amounts.reduce((sum, a) => sum + Math.pow(a - avg, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  // Typical min/max (10th to 90th percentile)
  const minP = sorted[Math.floor(sorted.length * 0.1)] || Math.max(10, avg * 0.2);
  const maxP = sorted[Math.floor(sorted.length * 0.9)] || (avg + 2 * stdDev);

  // Velocity calculation
  const now = Date.now();
  const tenMinsAgo = now - 10 * 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  let vel10m = 0;
  let vel1h = 0;
  let failedCount = 0;

  userTransactions.forEach((t) => {
    const tTime = new Date(t.date || t.createdAt || 0).getTime();
    if (tTime >= tenMinsAgo) vel10m++;
    if (tTime >= oneHourAgo) vel1h++;
    if (t.status === 'FAILED' || t.status === 'SUBMISSION_FAILED') failedCount++;
  });

  const walletCreatedAt = walletCreatedAtISO ? new Date(walletCreatedAtISO).getTime() : now - 30 * 86400 * 1000;
  const walletAgeDays = Math.max(1, Math.floor((now - walletCreatedAt) / (86400 * 1000)));

  return {
    userId,
    averageAmount: Number(avg.toFixed(2)),
    medianAmount: Number(median.toFixed(2)),
    stdDevAmount: Number(stdDev.toFixed(2)),
    typicalMinAmount: Number(minP.toFixed(2)),
    typicalMaxAmount: Number(maxP.toFixed(2)),
    totalTransactionsCount: count,
    knownRecipients: Array.from(recipients),
    recentVelocity10m: vel10m,
    recentVelocity1h: vel1h,
    failedPaymentCount: failedCount,
    walletAgeDays,
  };
}

/**
 * Deterministic + Statistical Anomaly Risk Engine.
 * Evaluates payment request against behavioral baseline.
 */
export function evaluatePaymentRisk(params: {
  userId: string;
  senderAddress: string;
  receiverAddress: string;
  receiverDisplayName?: string;
  amount: number;
  currency?: string;
  userTransactions?: any[];
  customProfile?: UserBehaviorProfile;
  graphContext?: { circularFlowDetected?: boolean };
}): PaymentRiskAssessment {
  const assessmentId = `RISK_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const timestamp = new Date().toISOString();
  const currency = params.currency || 'HSCT';
  const amount = Number(params.amount);

  // 1. Build or retrieve user profile
  const profile =
    params.customProfile ||
    computeUserBehaviorProfile(params.userId, params.userTransactions || []);

  const factors: RiskFactor[] = [];
  let scorePoints = 0;

  // ─── FEATURE 1: AMOUNT DEVIATION ───
  const isNewAccount = profile.totalTransactionsCount < 3;
  const baselineMax = profile.typicalMaxAmount || 2000;
  const baselineAvg = profile.averageAmount || 500;
  const stdDev = profile.stdDevAmount || 300;

  let amountDevRatio = 0;
  if (amount > baselineMax) {
    amountDevRatio = (amount - baselineMax) / (stdDev > 0 ? stdDev : baselineMax);
  }

  if (amount > baselineAvg * 10 && amount > 5000) {
    scorePoints += 45;
    factors.push({
      code: 'EXTREME_AMOUNT_DEVIATION',
      field: 'amount',
      severity: 'HIGH',
      message: `Transfer amount (${amount.toLocaleString()} ${currency}) is 10x higher than your usual average (${profile.averageAmount.toLocaleString()} ${currency}).`,
    });
  } else if (amount > baselineAvg * 3 && amount > 2000) {
    scorePoints += 25;
    factors.push({
      code: 'ELEVATED_AMOUNT_DEVIATION',
      field: 'amount',
      severity: 'MEDIUM',
      message: `Transfer amount exceeds your typical historical transaction range (${profile.typicalMinAmount.toLocaleString()} - ${profile.typicalMaxAmount.toLocaleString()} ${currency}).`,
    });
  }

  // ─── FEATURE 2: RECIPIENT NOVELTY ───
  const isKnownRecipient = profile.knownRecipients.includes(params.receiverAddress.toLowerCase());
  const isNewRecipient = !isKnownRecipient && params.receiverAddress.length > 5;

  if (isNewRecipient) {
    scorePoints += isNewAccount ? 20 : 15;
    factors.push({
      code: 'NEW_RECIPIENT_NOVELTY',
      field: 'receiverAddress',
      severity: 'MEDIUM',
      message: `First-time transfer to recipient (${params.receiverDisplayName || params.receiverAddress.substring(0, 8)}...).`,
    });
  }

  // ─── FEATURE 3: VELOCITY SPIKE (Rapid Payments) ───
  if (profile.recentVelocity10m >= 5) {
    scorePoints += 35;
    factors.push({
      code: 'HIGH_VELOCITY_10M',
      field: 'velocity',
      severity: 'HIGH',
      message: `High transaction frequency detected (${profile.recentVelocity10m} payments initiated in the last 10 minutes).`,
    });
  } else if (profile.recentVelocity1h >= 10) {
    scorePoints += 20;
    factors.push({
      code: 'ELEVATED_VELOCITY_1H',
      field: 'velocity',
      severity: 'MEDIUM',
      message: `Elevated transaction frequency (${profile.recentVelocity1h} payments in the last hour).`,
    });
  }

  // ─── FEATURE 4: FAILED PAYMENT RATE ───
  if (profile.failedPaymentCount >= 3) {
    scorePoints += 20;
    factors.push({
      code: 'MULTIPLE_RECENT_FAILURES',
      field: 'failedCount',
      severity: 'MEDIUM',
      message: `Multiple recent transaction failures (${profile.failedPaymentCount} failed attempts).`,
    });
  }

  // ─── FEATURE 5: GRAPH ANOMALY (Circular / High Risk Flow) ───
  const graphAnomalyDetected = Boolean(params.graphContext?.circularFlowDetected);
  if (graphAnomalyDetected) {
    scorePoints += 30;
    factors.push({
      code: 'CIRCULAR_GRAPH_ANOMALY',
      field: 'graph',
      severity: 'HIGH',
      message: `Unusual circular payment routing detected across network graph.`,
    });
  }

  // Cap score between 0 and 100
  const riskScore = Math.min(100, Math.max(0, scorePoints));

  // Determine Risk Level & Recommendation
  let riskLevel: RiskLevel = 'LOW';
  let recommendation: PaymentRiskAssessment['recommendation'] = 'PROCEED';

  if (riskScore >= 80) {
    riskLevel = 'CRITICAL';
    recommendation = 'HOLD_FOR_REVIEW';
  } else if (riskScore >= 60) {
    riskLevel = 'HIGH';
    recommendation = 'REQUIRE_EXTRA_VERIFICATION';
  } else if (riskScore >= 30) {
    riskLevel = 'MEDIUM';
    recommendation = 'REQUIRE_CONFIRMATION';
  } else {
    riskLevel = 'LOW';
    recommendation = 'PROCEED';
  }

  return {
    assessmentId,
    timestamp,
    userId: params.userId,
    senderAddress: params.senderAddress,
    receiverAddress: params.receiverAddress,
    receiverDisplayName: params.receiverDisplayName,
    amount,
    currency,
    riskScore,
    riskLevel,
    recommendation,
    factors,
    featureVector: {
      amount,
      currency,
      amountDeviationScore: Number(Math.min(1, amountDevRatio).toFixed(2)),
      recipientNovelty: isNewRecipient,
      velocityScore10m: profile.recentVelocity10m,
      velocityScore1h: profile.recentVelocity1h,
      failedPaymentRate: profile.failedPaymentCount,
      graphAnomalyDetected,
      timeWindowAnomaly: profile.recentVelocity10m > 3,
    },
    userProfileSummary: {
      typicalRange: `${profile.typicalMinAmount.toLocaleString()} - ${profile.typicalMaxAmount.toLocaleString()} ${currency}`,
      averageAmount: profile.averageAmount,
      isNewRecipient,
    },
    modelVersion: PAYMENT_AI_MODEL_VERSION,
  };
}

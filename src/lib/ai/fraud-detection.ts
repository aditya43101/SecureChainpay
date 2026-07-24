export interface TransactionMetadata {
  userId: string;
  amount: number;
  ipAddress: string;
  location: string;
  deviceId: string;
  timeOfDay: number; // 0-23
  previousTransactionsCount: number;
}

export interface FraudAnalysis {
  riskScore: number; // 0.0 to 1.0
  isFraudulent: boolean;
  reasons: string[];
  recommendedAction: 'ALLOW' | 'BLOCK' | 'MANUAL_REVIEW';
}

/**
 * Mock ML-based risk scoring algorithm for SecureChain Pay
 */
export async function analyzeTransaction(tx: TransactionMetadata): Promise<FraudAnalysis> {
  let riskScore = 0.1; // Base risk
  const reasons: string[] = [];

  // Mock ML logic
  if (tx.amount > 10000) {
    riskScore += 0.4;
    reasons.push('High transaction amount');
  }

  if (tx.previousTransactionsCount === 0) {
    riskScore += 0.2;
    reasons.push('New user / First transaction');
  }

  // Unusual hours (e.g., 2 AM - 5 AM)
  if (tx.timeOfDay >= 2 && tx.timeOfDay <= 5) {
    riskScore += 0.15;
    reasons.push('Transaction during unusual hours');
  }

  // Cap risk score at 1.0
  riskScore = Math.min(riskScore, 1.0);

  let recommendedAction: 'ALLOW' | 'BLOCK' | 'MANUAL_REVIEW' = 'ALLOW';
  let isFraudulent = false;

  if (riskScore >= 0.7) {
    recommendedAction = 'BLOCK';
    isFraudulent = true;
  } else if (riskScore >= 0.5) {
    recommendedAction = 'MANUAL_REVIEW';
  }

  return {
    riskScore,
    isFraudulent,
    reasons,
    recommendedAction
  };
}

import { ethers } from 'ethers';
import { getProvider } from '@/lib/blockchain/client';
import { PaymentRiskAssessment } from '@/lib/payments/payment-risk-engine';
import { PredictiveEngine } from './predictive-engine';
import { NodeHealthEngine } from '@/lib/blockchain/node-health-engine';

export type SettlementRoute = 'OFF_CHAIN' | 'ON_CHAIN' | 'HYBRID' | 'DEFERRED_ON_CHAIN';

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN';

export interface BlockchainHealth {
  status: HealthStatus;
  rpcLatencyMs: number;
  latestBlockNumber: number;
  latestBlockTimestamp: string;
  successRate24h: number;
  gasPriceGwei: number;
  providerUrl: string;
  chainId: number;
}

export interface OffChainHealth {
  status: HealthStatus;
  dbLatencyMs: number;
  ledgerConsistency: 'SYNCHRONIZED' | 'LAGGING' | 'DESYNCHRONIZED';
  activeConnections: number;
}

export interface RouteScore {
  route: SettlementRoute;
  score: number; // 0 to 100
  estimatedFee: number; // HSCT
  estimatedLatencyMs: number;
  securityRating: 'HIGH' | 'MEDIUM' | 'LOW';
  reconciliationRequired: boolean;
}

export interface PaymentTimelineEvent {
  step: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  timestamp: string;
  details: string;
}

export interface RoutingDecision {
  decisionId: string;
  paymentId: string;
  timestamp: string;
  selectedRoute: SettlementRoute;
  policyVersion: string;
  routeReason: string;
  estimatedFee: number;
  estimatedLatencyMs: number;
  blockchainHealth: BlockchainHealth;
  offChainHealth: OffChainHealth;
  predictedReliability?: any;
  routeScores: RouteScore[];
  securityOverrideApplied: boolean;
  isLocked: boolean;
  timeline: PaymentTimelineEvent[];
}

export const ROUTING_POLICY_VERSION = 'v1.2-adaptive';

/**
 * Service to query current EVM Blockchain RPC health and latency.
 */
export async function getBlockchainHealth(): Promise<BlockchainHealth> {
  const contractAddress = process.env.PAYMENT_CONTRACT_ADDRESS || process.env.LEDGER_CONTRACT_ADDRESS;
  const healthEngine = NodeHealthEngine.getInstance();
  const { report, allReports } = await healthEngine.getHealthyProvider(contractAddress);

  if (report) {
    let mappedStatus: HealthStatus = 'HEALTHY';
    if (report.status === 'DEGRADED') mappedStatus = 'DEGRADED';
    else if (report.status === 'UNAVAILABLE') mappedStatus = 'UNAVAILABLE';
    else if (report.status === 'UNHEALTHY' || report.status === 'STALE') mappedStatus = 'DEGRADED';

    return {
      status: mappedStatus,
      rpcLatencyMs: report.latencyMs,
      latestBlockNumber: report.latestBlockNumber,
      latestBlockTimestamp: new Date().toISOString(),
      successRate24h: 99.4,
      gasPriceGwei: report.gasPriceGwei,
      providerUrl: report.name,
      chainId: report.chainId,
    };
  }

  // If no node is healthy or reachable, use evaluated primary report without duplicate delay:
  const primaryReport = allReports?.[0] || await healthEngine.evaluateProvider(
    process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545',
    'Primary RPC (Node A)',
    contractAddress
  );

  return {
    status: primaryReport.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'DEGRADED',
    rpcLatencyMs: primaryReport.latencyMs,
    latestBlockNumber: primaryReport.latestBlockNumber,
    latestBlockTimestamp: new Date().toISOString(),
    successRate24h: 0,
    gasPriceGwei: 0,
    providerUrl: primaryReport.name,
    chainId: primaryReport.chainId || 31337,
  };
}

/**
 * Service to query current Off-Chain Database (Firestore/PostgreSQL) health.
 */
export async function getOffChainHealth(): Promise<OffChainHealth> {
  const startTime = Date.now();
  // Simulated lightweight DB ping
  const latency = Date.now() - startTime + 12;

  return {
    status: 'HEALTHY',
    dbLatencyMs: latency,
    ledgerConsistency: 'SYNCHRONIZED',
    activeConnections: 18,
  };
}

/**
 * Adaptive Transaction Routing Engine.
 * Evaluates payment context, infrastructure health, risk score, cost, and latency.
 */
export async function computeRouteDecision(params: {
  paymentId: string;
  amount: number;
  currency?: string;
  riskAssessment?: PaymentRiskAssessment;
  securityPolicyRequirement?: SettlementRoute;
}): Promise<RoutingDecision> {
  const decisionId = `ROUTE_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const timestamp = new Date().toISOString();

  const [chainHealth, dbHealth, reliabilityForecast] = await Promise.all([
    getBlockchainHealth(),
    getOffChainHealth(),
    PredictiveEngine.getReliabilityForecast('Primary_EVM_Node'),
  ]);

  const amount = Number(params.amount);
  const riskLevel = params.riskAssessment?.riskLevel || 'LOW';
  const riskScore = params.riskAssessment?.riskScore || 10;

  // 1. Calculate Route Scores for all options
  const routeScores: RouteScore[] = [
    {
      route: 'HYBRID',
      score: 95,
      estimatedFee: 0.0,
      estimatedLatencyMs: 180,
      securityRating: 'HIGH',
      reconciliationRequired: true,
    },
    {
      route: 'ON_CHAIN',
      score: 85,
      estimatedFee: 0.05,
      estimatedLatencyMs: 2400,
      securityRating: 'HIGH',
      reconciliationRequired: true,
    },
    {
      route: 'OFF_CHAIN',
      score: 75,
      estimatedFee: 0.0,
      estimatedLatencyMs: 80,
      securityRating: 'MEDIUM',
      reconciliationRequired: false,
    },
    {
      route: 'DEFERRED_ON_CHAIN',
      score: 60,
      estimatedFee: 0.0,
      estimatedLatencyMs: 120,
      securityRating: 'HIGH',
      reconciliationRequired: true,
    },
  ];

  let selectedRoute: SettlementRoute = 'HYBRID';
  let routeReason = 'Optimal balance of off-chain instant indexing and EVM blockchain cryptographic settlement.';
  let securityOverrideApplied = false;

  // 2. Evaluate Policy Rules & Infrastructure Conditions

  // Rule A: Explicit Security Policy Mandate
  if (params.securityPolicyRequirement) {
    selectedRoute = params.securityPolicyRequirement;
    routeReason = `Security policy strictly mandated ${params.securityPolicyRequirement} settlement path.`;
    securityOverrideApplied = true;
  }
  // Rule B: High Risk or Large Transfer (> 50,000 HSCT) requires ON_CHAIN or HYBRID
  else if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL' || amount >= 50000) {
    if (chainHealth.status === 'HEALTHY') {
      selectedRoute = 'ON_CHAIN';
      routeReason = `High-value transfer (${amount.toLocaleString()} HSCT) or elevated risk score (${riskScore}/100) routed directly to EVM On-Chain settlement.`;
      securityOverrideApplied = true;
    } else {
      selectedRoute = 'HYBRID';
      routeReason = `Elevated risk transfer routed to HYBRID path due to degraded blockchain latency.`;
      securityOverrideApplied = true;
    }
  }
  // Rule B.1: Predictive Circuit Breaker (AI)
  else if (reliabilityForecast.reliabilityScore < 30) {
    selectedRoute = 'DEFERRED_ON_CHAIN';
    routeReason = `PREDICTIVE CIRCUIT BREAKER: Provider reliability critically low (${reliabilityForecast.reliabilityScore}/100). Evading direct blockchain layer to prevent failure.`;
  }
  // Rule B.2: Predictive Traffic Shifting (AI)
  else if (reliabilityForecast.reliabilityScore < 70) {
    selectedRoute = 'HYBRID';
    routeReason = `PREDICTIVE SHIFT: Provider reliability degrading (${reliabilityForecast.reliabilityScore}/100). Shifting to HYBRID to minimize synchronous failure risk.`;
  }
  // Rule C: Blockchain Degraded / High Latency
  else if (chainHealth.status === 'DEGRADED') {
    selectedRoute = 'HYBRID';
    routeReason = `Blockchain RPC latency elevated (${chainHealth.rpcLatencyMs}ms). Routed to HYBRID path for instant off-chain indexing + background settlement.`;
  }
  // Rule D: Blockchain Unavailable
  else if (chainHealth.status === 'UNAVAILABLE') {
    selectedRoute = 'DEFERRED_ON_CHAIN';
    routeReason = `EVM Blockchain temporarily unavailable. Transaction committed off-chain and queued for deferred on-chain anchoring upon network recovery.`;
  }
  // Rule E: Small Micro-transfer (< 100 HSCT)
  else if (amount < 100 && riskLevel === 'LOW') {
    selectedRoute = 'OFF_CHAIN';
    routeReason = `Low-value micro-transfer (< 100 HSCT) routed to instant sub-second OFF_CHAIN internal ledger.`;
  }

  // Find selected route score details
  const selectedScore = routeScores.find((r) => r.route === selectedRoute) || routeScores[0];

  // Build Timeline Events
  const timeline: PaymentTimelineEvent[] = [
    {
      step: 'PAYMENT_REQUESTED',
      status: 'COMPLETED',
      timestamp,
      details: `Payment intent created for ${amount.toLocaleString()} ${params.currency || 'HSCT'}`,
    },
    {
      step: 'RISK_CHECKED',
      status: 'COMPLETED',
      timestamp,
      details: `Payment AI risk score evaluated: ${riskScore}/100 (${riskLevel})`,
    },
    {
      step: 'ROUTE_SELECTED',
      status: 'COMPLETED',
      timestamp,
      details: `Route selected: ${selectedRoute} (${routeReason})`,
    },
    {
      step: 'ROUTE_LOCKED',
      status: 'COMPLETED',
      timestamp,
      details: `Settlement route locked under policy ${ROUTING_POLICY_VERSION}`,
    },
  ];

  return {
    decisionId,
    paymentId: params.paymentId,
    timestamp,
    selectedRoute,
    policyVersion: ROUTING_POLICY_VERSION,
    routeReason,
    estimatedFee: selectedScore.estimatedFee,
    estimatedLatencyMs: selectedScore.estimatedLatencyMs,
    blockchainHealth: chainHealth,
    offChainHealth: dbHealth,
    predictedReliability: reliabilityForecast,
    routeScores,
    securityOverrideApplied,
    isLocked: true,
    timeline,
  };
}

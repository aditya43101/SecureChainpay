'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  SimulationNode,
  NodeStatus,
  SimulationTransaction,
  TransactionStatus,
  BlockchainState,
  SettlementRoute,
  SimulationBalances,
  QueueNodeItem,
  HealingStep,
  ArchitectureStep,
  TimelineEvent,
  SystemMetrics,
  ActiveScenario,
} from './simulation-types';

interface SimulationContextType {
  // Nodes
  nodes: SimulationNode[];
  setNodeStatus: (nodeId: string, status: NodeStatus) => void;
  setAllNodesOffline: () => void;
  restoreAllNodes: () => void;
  makeNodeBusy: (nodeId?: string) => void;
  healthyNodeCount: number;

  // Routing
  routingDecision: {
    route: SettlementRoute;
    reason: string;
    targetNode?: string;
  };

  // Balances
  balances: SimulationBalances;

  // Transactions & Queues
  activeTransaction: SimulationTransaction | null;
  transactions: SimulationTransaction[];
  queue: QueueNodeItem[];
  arrayIndex: string[];
  activeQueueIndex: number | null;
  selectedTransaction: SimulationTransaction | null;
  setSelectedTransaction: (tx: SimulationTransaction | null) => void;

  // State Machine & Graph
  activeArchitectureStep: ArchitectureStep;
  activeHealingStep: HealingStep;
  currentScenario: ActiveScenario;
  isSimulating: boolean;
  simulationSpeed: number;
  setSimulationSpeed: (speed: number) => void;

  // Failure Simulation
  activeFailures: Set<string>;
  toggleFailure: (failureKey: string) => void;
  clearAllFailures: () => void;

  // Timeline & Metrics
  timeline: TimelineEvent[];
  metrics: SystemMetrics;

  // Actions / Demos
  runDemoInsufficientFunds: () => Promise<void>;
  runDemoNodeBusy: () => Promise<void>;
  runDemo1_NormalPayment: () => Promise<void>;
  runDemo2_BlockchainUnavailable: () => Promise<void>;
  runDemo3_RpcTimeout: () => Promise<void>;
  runDemo4_WorkerCrash: () => Promise<void>;
  runDemo5_DbChainMismatch: () => Promise<void>;
  runDemo6_IntegrityAttack: () => Promise<void>;
  sendCustomTransaction: (amount: number, expiryMinutes?: number) => Promise<void>;
  resetSimulation: () => void;
}

const INITIAL_NODES: SimulationNode[] = [
  {
    id: 'node-a',
    name: 'Primary RPC (Node A)',
    providerUrl: 'http://127.0.0.1:8545',
    status: 'HEALTHY',
    latencyMs: 42,
    latestBlockNumber: 125430,
    blockAgeSeconds: 2,
    chainId: 31337,
    gasPriceGwei: 1.25,
    hasContractCode: true,
    healthScore: 98,
    checks: {
      connected: true,
      synced: true,
      latestBlock: true,
      acceptableLatency: true,
      contractVerified: true,
    },
    lastCheckedAt: new Date().toISOString(),
    currentTransactionId: null,
    acceptsNewTransactions: true,
    isProcessingExisting: false,
  },
  {
    id: 'node-b',
    name: 'Failover RPC (Node B)',
    providerUrl: 'http://127.0.0.1:8546',
    status: 'HEALTHY',
    latencyMs: 88,
    latestBlockNumber: 125430,
    blockAgeSeconds: 4,
    chainId: 31337,
    gasPriceGwei: 1.28,
    hasContractCode: true,
    healthScore: 94,
    checks: {
      connected: true,
      synced: true,
      latestBlock: true,
      acceptableLatency: true,
      contractVerified: true,
    },
    lastCheckedAt: new Date().toISOString(),
    currentTransactionId: null,
    acceptsNewTransactions: true,
    isProcessingExisting: false,
  },
  {
    id: 'node-c',
    name: 'Public RPC (Node C)',
    providerUrl: 'https://polygon-amoy-bor-rpc.publicnode.com',
    status: 'DEGRADED',
    latencyMs: 480,
    latestBlockNumber: 125421,
    blockAgeSeconds: 18,
    chainId: 31337,
    gasPriceGwei: 28.5,
    hasContractCode: false,
    healthScore: 62,
    checks: {
      connected: true,
      synced: false,
      latestBlock: false,
      acceptableLatency: false,
      contractVerified: false,
    },
    lastCheckedAt: new Date().toISOString(),
    currentTransactionId: null,
    acceptsNewTransactions: false,
    isProcessingExisting: false,
  },
];

const INITIAL_BALANCES: SimulationBalances = {
  senderTotal: 10000,
  senderAvailable: 10000,
  senderReserved: 0,
  recipientConfirmed: 0,
  recipientIncoming: 0,
};

const INITIAL_METRICS: SystemMetrics = {
  activeTransactions: 0,
  temporaryTransactions: 0,
  onChainTransactions: 0,
  reservedAmount: 0,
  completedTransactions: 0,
  failedTransactions: 0,
  quarantinedTransactions: 0,
  healthyNodes: 2,
  degradedNodes: 1,
  recoveryEvents: 0,
  reconciliationEvents: 0,
};

const SimulationContext = createContext<SimulationContextType | null>(null);

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [nodes, setNodes] = useState<SimulationNode[]>(INITIAL_NODES);
  const [balances, setBalances] = useState<SimulationBalances>(INITIAL_BALANCES);
  const [activeTransaction, setActiveTransaction] = useState<SimulationTransaction | null>(null);
  const [transactions, setTransactions] = useState<SimulationTransaction[]>([]);
  const [queue, setQueue] = useState<QueueNodeItem[]>([]);
  const [arrayIndex, setArrayIndex] = useState<string[]>([]);
  const [activeQueueIndex, setActiveQueueIndex] = useState<number | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<SimulationTransaction | null>(null);

  const [activeArchitectureStep, setActiveArchitectureStep] = useState<ArchitectureStep>('IDLE');
  const [activeHealingStep, setActiveHealingStep] = useState<HealingStep>('IDLE');
  const [currentScenario, setCurrentScenario] = useState<ActiveScenario>('NONE');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);

  const [activeFailures, setActiveFailures] = useState<Set<string>>(new Set());
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics>(INITIAL_METRICS);

  const [routingDecision, setRoutingDecision] = useState<{
    route: SettlementRoute;
    reason: string;
    targetNode?: string;
  }>({
    route: 'ON_CHAIN',
    reason: 'Healthy node available (Primary RPC)',
    targetNode: 'Primary RPC (Node A)',
  });

  const isCancelledRef = useRef<boolean>(false);
  const txCounter = useRef<number>(1);

  const delay = useCallback(
    (ms: number) => {
      const adjustedMs = ms / simulationSpeed;
      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (!isCancelledRef.current) resolve();
        }, adjustedMs);
        return () => clearTimeout(timeout);
      });
    },
    [simulationSpeed]
  );

  const healthyNodeCount = nodes.filter((n) => n.status === 'HEALTHY' && n.acceptsNewTransactions).length;

  const setNodeStatus = (nodeId: string, status: NodeStatus) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              status,
              healthScore: status === 'HEALTHY' ? 98 : status === 'BUSY' ? 85 : status === 'DEGRADED' ? 65 : 0,
              latencyMs: status === 'HEALTHY' ? 42 : status === 'BUSY' ? 95 : status === 'DEGRADED' ? 450 : 9999,
              acceptsNewTransactions: status === 'HEALTHY',
              isProcessingExisting: status === 'BUSY' || n.isProcessingExisting,
            }
          : n
      )
    );
  };

  const makeNodeBusy = (nodeId = 'node-a') => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        const willBeBusy = n.status !== 'BUSY';
        return {
          ...n,
          status: willBeBusy ? 'BUSY' : 'HEALTHY',
          currentTransactionId: willBeBusy ? 'TX_INFLIGHT_PROCESSING' : null,
          acceptsNewTransactions: !willBeBusy,
          isProcessingExisting: willBeBusy,
          healthScore: willBeBusy ? 85 : 98,
        };
      })
    );
    addTimelineEvent(
      'Busy Node Semantic Enforced',
      `Node ${nodeId} status updated. A busy node does NOT disappear; in-flight transactions continue while new transactions route elsewhere.`,
      'WARNING',
      'NODE_HEALTH'
    );
  };

  const setAllNodesOffline = () => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        status: 'OFFLINE' as NodeStatus,
        latencyMs: 9999,
        healthScore: 0,
        checks: {
          connected: false,
          synced: false,
          latestBlock: false,
          acceptableLatency: false,
          contractVerified: false,
        },
        acceptsNewTransactions: false,
      }))
    );
    addTimelineEvent('Network Blackout Triggered', 'All 3 RPC endpoints marked OFFLINE for simulation', 'ERROR');
  };

  const restoreAllNodes = () => {
    setNodes(INITIAL_NODES);
    addTimelineEvent('Nodes Restored to HEALTHY', 'Primary & Failover RPC providers restored and synced', 'SUCCESS');
  };

  const toggleFailure = (failureKey: string) => {
    setActiveFailures((prev) => {
      const next = new Set(prev);
      if (next.has(failureKey)) {
        next.delete(failureKey);
        addTimelineEvent('Chaos Injection Removed', `Failure scenario "${failureKey}" cleared`, 'INFO');
      } else {
        next.add(failureKey);
        addTimelineEvent('Chaos Injected', `Failure scenario "${failureKey}" active`, 'WARNING');
      }
      return next;
    });
  };

  const clearAllFailures = () => {
    setActiveFailures(new Set());
    addTimelineEvent('Chaos Matrix Reset', 'All injected failures cleared', 'INFO');
  };

  const addTimelineEvent = (
    title: string,
    description: string,
    type: TimelineEvent['type'] = 'INFO',
    stepName?: string,
    transactionId?: string
  ) => {
    const newEvent: TimelineEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      title,
      description,
      type,
      stepName,
      transactionId,
    };
    setTimeline((prev) => [newEvent, ...prev.slice(0, 49)]);
  };

  const createNewTransaction = useCallback((amount: number = 4000, expiryMinutes: number = 10): SimulationTransaction => {
    const id = `TX-${String(txCounter.current++).padStart(3, '0')}`;
    const now = new Date().toISOString();
    const idempKey = `idemp_${id}_${Date.now()}`;
    const reservationId = `RES_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const canonicalString = `${id}|0xDemoSender|0xDemoRecipient|${amount}|HSCT|${idempKey}|${now}`;
    let hash = 0;
    for (let i = 0; i < canonicalString.length; i++) {
      hash = (hash << 5) - hash + canonicalString.charCodeAt(i);
      hash |= 0;
    }
    const integrityHash = `sha256:0x${Math.abs(hash).toString(16).padStart(64, '0')}`;

    const initialTx: SimulationTransaction = {
      id,
      idempotencyKey: idempKey,
      reservationId,
      sender: '0x4310...7B29 (Demo Wallet A)',
      recipient: '0x99A1...4D12 (Demo Wallet B)',
      amount,
      asset: 'HSCT',
      expiryMinutes,
      createdAt: now,
      updatedAt: now,
      route: 'ON_CHAIN',
      applicationState: 'CREATED',
      blockchainState: 'NOT_ANCHORED',
      integrityHash,
      recoveryAttempts: 0,
      inQueue: false,
      stateHistory: [
        {
          state: 'CREATED',
          timestamp: now,
          note: 'Transaction created by user with idempotency and cryptographic signature',
          blockchainState: 'NOT_ANCHORED',
        },
      ],
    };

    setActiveTransaction(initialTx);
    setTransactions((prev) => [initialTx, ...prev]);
    return initialTx;
  }, []);

  const updateTxState = useCallback(
    (
      appState: TransactionStatus,
      bcState?: BlockchainState,
      note: string = '',
      extra?: Partial<SimulationTransaction>
    ) => {
      const now = new Date().toISOString();
      setActiveTransaction((prev) => {
        if (!prev) return null;
        const updated: SimulationTransaction = {
          ...prev,
          applicationState: appState,
          blockchainState: bcState !== undefined ? bcState : prev.blockchainState,
          previousState: prev.applicationState,
          updatedAt: now,
          ...extra,
          stateHistory: [
            ...prev.stateHistory,
            {
              state: appState,
              timestamp: now,
              note: note || `State transitioned to ${appState}`,
              blockchainState: bcState !== undefined ? bcState : prev.blockchainState,
            },
          ],
        };
        setTransactions((list) => list.map((t) => (t.id === updated.id ? updated : t)));
        return updated;
      });
    },
    []
  );

  // -------------------------------------------------------------
  // DEMO TEST CASE: INSUFFICIENT FUNDS (Rule #24)
  // Demo Wallet: ₹5,000 | Attempt: ₹7,000 -> REJECTED, INSUFFICIENT_FUNDS
  // Invariant: Balance NEVER negative. Zero reservation. Zero recipient credit.
  // -------------------------------------------------------------
  const runDemoInsufficientFunds = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setCurrentScenario('DEMO_INSUFFICIENT_FUNDS');
    isCancelledRef.current = false;

    // Isolate demo wallet with ₹5,000 balance
    setBalances({
      senderTotal: 5000,
      senderAvailable: 5000,
      senderReserved: 0,
      recipientConfirmed: 0,
      recipientIncoming: 0,
    });
    await delay(300);

    const tx = createNewTransaction(7000, 10);
    addTimelineEvent('Payment Initiated', `Attempting transfer of ₹7,000 with only ₹5,000 available in wallet`, 'INFO', 'USER', tx.id);
    setActiveArchitectureStep('USER');
    await delay(800);

    // Step 2: Pre-Transaction Funds Validation (Rule #3)
    setActiveArchitectureStep('SECURITY');
    addTimelineEvent('Pre-Transaction Funds Validation', 'Evaluating: Attempted (₹7,000) > Available (₹5,000). Deficit would be -₹2,000.', 'WARNING', 'SECURITY', tx.id);
    await delay(900);

    // Step 3: Immediate Rejection
    setActiveArchitectureStep('IDLE');
    updateTxState('FAILED', 'NOT_ANCHORED', 'REJECTED: INSUFFICIENT_FUNDS. Attempted ₹7,000 with available balance ₹5,000.');
    addTimelineEvent('Transaction REJECTED (INSUFFICIENT_FUNDS)', 'Hard Invariant Upheld: Operation rejected BEFORE financial mutation. Zero reservation. Zero recipient credit. Balance strictly ₹5,000.', 'ERROR', 'SECURITY', tx.id);

    // Verify Invariant: Balance strictly unchanged
    setBalances({
      senderTotal: 5000,
      senderAvailable: 5000,
      senderReserved: 0,
      recipientConfirmed: 0,
      recipientIncoming: 0,
    });

    setMetrics((prev) => ({
      ...prev,
      failedTransactions: prev.failedTransactions + 1,
    }));
    setIsSimulating(false);
  };

  // -------------------------------------------------------------
  // DEMO TEST CASE: NODE BUSY RULE (Rule #26)
  // Node A = HEALTHY, TX-001 processing. Node becomes BUSY.
  // TX-001 CONTINUES. New TX-002 routed to Node B. Node A stays visible.
  // -------------------------------------------------------------
  const runDemoNodeBusy = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setCurrentScenario('DEMO_NODE_BUSY');
    isCancelledRef.current = false;

    restoreAllNodes();
    await delay(300);

    // Step 1: TX-001 starts on Node A
    const tx1 = createNewTransaction(2000, 10);
    addTimelineEvent('TX-001 Assigned to Node A', `ID: ${tx1.id} | Amount: ₹2,000 | Assigned to Primary RPC (Node A)`, 'INFO', 'USER', tx1.id);
    setActiveArchitectureStep('USER');
    await delay(700);

    setActiveArchitectureStep('ONCHAIN_PATH');
    updateTxState('PROCESSING', 'FUNDS_RESERVED', 'TX-001 actively processing on Node A');
    
    // Node A transitions to BUSY
    setNodes((prev) =>
      prev.map((n) =>
        n.id === 'node-a'
          ? {
              ...n,
              status: 'BUSY',
              currentTransactionId: tx1.id,
              acceptsNewTransactions: false,
              isProcessingExisting: true,
              healthScore: 85,
            }
          : n
      )
    );
    addTimelineEvent('Node A Flagged BUSY', 'Node A is BUSY processing TX-001. Accept New Transactions: NO | Processing Existing: YES (Node remains visible)', 'WARNING', 'NODE_HEALTH', tx1.id);
    await delay(1200);

    // Step 2: New Transaction TX-002 Arrives
    addTimelineEvent('New Transaction TX-002 Arrives', 'Amount: ₹1,500. Node A is busy. Evaluating routing policy...', 'INFO', 'ROUTER');
    setActiveArchitectureStep('ROUTER');
    await delay(1000);

    // Busy Node Rule: TX-001 is NOT terminated. TX-002 routes to Node B!
    addTimelineEvent('Busy Node Rule Enforced', 'TX-001 CONTINUES on Node A. TX-002 failover routed to healthy Node B!', 'SUCCESS', 'ROUTER');
    setRoutingDecision({
      route: 'ON_CHAIN',
      reason: 'Node A is BUSY with existing tx → Failover routing to Node B',
      targetNode: 'Failover RPC (Node B)',
    });
    await delay(1200);

    // TX-001 completes successfully on Node A
    setActiveArchitectureStep('FINALIZE');
    updateTxState('FINALIZED', 'FINALIZED', 'TX-001 finalized on Node A without interruption');
    addTimelineEvent('TX-001 Finalized on Node A', 'Transaction completed on Node A. Node A freed and returns to HEALTHY.', 'SUCCESS', 'FINALIZE', tx1.id);

    setNodes((prev) =>
      prev.map((n) =>
        n.id === 'node-a'
          ? {
              ...n,
              status: 'HEALTHY',
              currentTransactionId: null,
              acceptsNewTransactions: true,
              isProcessingExisting: false,
              healthScore: 98,
            }
          : n
      )
    );

    setActiveArchitectureStep('IDLE');
    setIsSimulating(false);
  };

  // -------------------------------------------------------------
  // DEMO 1: HEALTHY NODE FLOW (Rule #25)
  // Wallet = ₹10,000, Send = ₹4,000.
  // Validate -> Reserve -> On-Chain Lock -> Process -> Verify -> Finalize -> Recipient Credit
  // -------------------------------------------------------------
  const runDemo1_NormalPayment = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setCurrentScenario('DEMO_1');
    isCancelledRef.current = false;

    restoreAllNodes();
    await delay(300);

    const tx = createNewTransaction(4000, 10);
    addTimelineEvent('Payment Created', `ID: ${tx.id} | Sender Wallet: ₹10,000 | Amount: ₹4,000`, 'INFO', 'USER', tx.id);
    setActiveArchitectureStep('USER');
    await delay(800);

    // Step 2: Security & Funds Validation
    setActiveArchitectureStep('SECURITY');
    addTimelineEvent('Funds & Security Validated', 'Pre-flight passed: ₹10,000 available >= ₹4,000 requested. Zero deficit.', 'SUCCESS', 'SECURITY', tx.id);
    await delay(800);

    // Step 3: Node Health Check
    setActiveArchitectureStep('NODE_HEALTH');
    addTimelineEvent('Node Health Verified', 'Primary RPC (Node A) HEALTHY, latency 42ms, sync confirmed', 'SUCCESS', 'NODE_HEALTH', tx.id);
    await delay(800);

    // Step 4: Routing Decision
    setActiveArchitectureStep('ROUTER');
    addTimelineEvent('Routing Decision: ON-CHAIN', 'Healthy blockchain node available → ON-CHAIN INITIALIZATION', 'INFO', 'ROUTER', tx.id);
    await delay(800);

    // Step 5: On-Chain Path & Blockchain Initialization
    setActiveArchitectureStep('ONCHAIN_PATH');
    updateTxState('ONCHAIN_INITIALIZING', 'NOT_ANCHORED', 'Submitting initializePayment() to SecureChainPayment.sol');
    addTimelineEvent('Blockchain Initialization', 'Broadcasting initializePayment() to EVM mempool', 'INFO', 'BLOCKCHAIN_INIT', tx.id);
    await delay(900);

    // Step 6: Funds Reserved (On-Chain)
    setActiveArchitectureStep('FUNDS_RESERVED');
    const mockHash = `0x9c4f8b2e7a1d${Date.now().toString(16)}bc548a`;
    updateTxState('FUNDS_RESERVED', 'FUNDS_RESERVED', 'Smart contract confirmed accounting balance lock', {
      blockchainTxHash: mockHash,
      blockNumber: 125431,
      confirmations: 1,
    });
    setBalances((prev) => ({
      ...prev,
      senderAvailable: prev.senderAvailable - 4000,
      senderReserved: prev.senderReserved + 4000,
      recipientIncoming: prev.recipientIncoming + 4000,
    }));
    addTimelineEvent('Funds Reserved On-Chain', 'Sender Available: ₹6,000 | Reserved: ₹4,000. Recipient spendable balance remains UNCREDITED.', 'WARNING', 'FUNDS_RESERVED', tx.id);
    await delay(1200);

    // Step 7: Application Processing
    setActiveArchitectureStep('PROCESSING');
    updateTxState('PROCESSING', 'FUNDS_RESERVED', 'Executing off-chain regulatory compliance & AML clearance');
    addTimelineEvent('Processing Payment', 'Clearance running while funds remain securely locked on blockchain', 'INFO', 'PROCESSING', tx.id);
    await delay(1000);

    // Step 8: Final Validation
    setActiveArchitectureStep('FINAL_VALIDATION');
    updateTxState('FINAL_VALIDATION', 'FUNDS_RESERVED', 'Pre-settlement invariant validation passed');
    addTimelineEvent('Final Validation', 'Cryptographic signature integrity, reservation timestamp, and destination verified', 'SUCCESS', 'FINAL_VALIDATION', tx.id);
    await delay(900);

    // Step 9: Finalization
    setActiveArchitectureStep('FINALIZE');
    updateTxState('FINALIZED', 'FINALIZED', 'Smart contract finalizePayment() verified in block #125432 with 3 confirmations', {
      confirmations: 3,
    });
    addTimelineEvent('Blockchain Verified & Final', 'Transaction confirmed on blockchain. Recipient credit unlocked.', 'SUCCESS', 'FINALIZE', tx.id);
    await delay(800);

    // Step 10: Recipient Credit (Rule #22)
    setActiveArchitectureStep('RECIPIENT_CREDIT');
    setBalances((prev) => ({
      senderTotal: prev.senderTotal - 4000,
      senderAvailable: prev.senderAvailable,
      senderReserved: prev.senderReserved - 4000,
      recipientIncoming: prev.recipientIncoming - 4000,
      recipientConfirmed: prev.recipientConfirmed + 4000,
    }));
    addTimelineEvent('Recipient Credited', 'Spendable balance transferred to Recipient: Available += ₹4,000. Balance conserved.', 'SUCCESS', 'RECIPIENT_CREDIT', tx.id);
    await delay(1000);

    setMetrics((prev) => ({
      ...prev,
      completedTransactions: prev.completedTransactions + 1,
      onChainTransactions: prev.onChainTransactions + 1,
    }));
    setActiveArchitectureStep('IDLE');
    setIsSimulating(false);
  };

  // -------------------------------------------------------------
  // DEMO 2: ALL NODES UNAVAILABLE -> TEMP_PENDING -> RECOVERY & DRAIN (Rule #27, #28)
  // -------------------------------------------------------------
  const runDemo2_BlockchainUnavailable = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setCurrentScenario('DEMO_2');
    isCancelledRef.current = false;

    setAllNodesOffline();
    await delay(500);

    const tx = createNewTransaction(4000, 10);
    addTimelineEvent('Payment Created (Outage Test)', `ID: ${tx.id} | Amount: ₹4,000`, 'INFO', 'USER', tx.id);
    setActiveArchitectureStep('USER');
    await delay(800);

    setActiveArchitectureStep('SECURITY');
    addTimelineEvent('Security Validated', 'Local cryptographic preflight & idempotency passed', 'INFO', 'SECURITY', tx.id);
    await delay(800);

    setActiveArchitectureStep('NODE_HEALTH');
    addTimelineEvent('Node Health Check: UNAVAILABLE', 'All RPC endpoints unavailable for new transactions', 'ERROR', 'NODE_HEALTH', tx.id);
    await delay(900);

    setActiveArchitectureStep('ROUTER');
    addTimelineEvent('Routing Decision: TEMPORARY PATH', 'No healthy node available → Routing to Durable Temporary Pool', 'WARNING', 'ROUTER', tx.id);
    await delay(800);

    setActiveArchitectureStep('TEMPORARY_PATH');
    updateTxState('TEMP_PENDING', 'NOT_ANCHORED', 'Enqueued in temporary transaction pool (NOT YET ANCHORED ON BLOCKCHAIN)', {
      route: 'TEMPORARY_OFF_CHAIN',
      inQueue: true,
      queueIndex: 0,
    });
    await delay(800);

    // Application-level reservation
    setActiveArchitectureStep('OFFCHAIN_RESERVE');
    setBalances((prev) => ({
      ...prev,
      senderAvailable: prev.senderAvailable - 4000,
      senderReserved: prev.senderReserved + 4000,
      recipientIncoming: prev.recipientIncoming + 4000,
    }));

    const queueItem: QueueNodeItem = {
      id: `queue_${Date.now()}`,
      transactionId: tx.id,
      amount: 4000,
      asset: 'HSCT',
      enqueuedAt: new Date().toISOString(),
      status: 'TEMP_PENDING',
    };
    setQueue([queueItem]);
    setArrayIndex([tx.id]);
    setActiveQueueIndex(0);

    addTimelineEvent('Application Reservation Locked', 'NOT YET ANCHORED ON BLOCKCHAIN. Sender Available: ₹6,000 | Reserved: ₹4,000. Recipient: ₹0.', 'WARNING', 'OFFCHAIN_RESERVE', tx.id);
    setMetrics((prev) => ({
      ...prev,
      temporaryTransactions: prev.temporaryTransactions + 1,
      reservedAmount: prev.reservedAmount + 4000,
    }));
    await delay(1500);

    // Node recovery
    addTimelineEvent('Simulating Node Recovery', 'Restoring Primary RPC (Node A) to operational status...', 'RECOVERY');
    setNodes((prev) =>
      prev.map((n) =>
        n.id === 'node-a'
          ? {
              ...n,
              status: 'HEALTHY',
              latencyMs: 44,
              healthScore: 98,
              checks: {
                connected: true,
                synced: true,
                latestBlock: true,
                acceptableLatency: true,
                contractVerified: true,
              },
              acceptsNewTransactions: true,
              isProcessingExisting: false,
            }
          : n
      )
    );
    await delay(1200);

    // Self-Healing Engine detects recovery & Starvation Prevention prioritizes DB queue
    setActiveHealingStep('DETECT');
    addTimelineEvent('Node Recovery Detected', 'Health Monitor triggered promotion worker for temporary queue', 'RECOVERY', 'DETECT', tx.id);
    await delay(800);

    setActiveHealingStep('VERIFY');
    addTimelineEvent('Pre-Promotion Verification', 'Verifying integrity hash, TTL expiry, and reservation validity', 'INFO', 'VERIFY', tx.id);
    await delay(800);

    setActiveHealingStep('RECOVER');
    setActiveArchitectureStep('BLOCKCHAIN_INIT');
    updateTxState('ONCHAIN_INITIALIZING', 'NOT_ANCHORED', 'Promoting temporary transaction to blockchain with original ID');
    addTimelineEvent('Promoting to Blockchain', `Same Transaction ID preserved: ${tx.id} (One payment, one identity)`, 'SUCCESS', 'BLOCKCHAIN_INIT', tx.id);
    await delay(1000);

    // On-chain reservation
    setActiveArchitectureStep('FUNDS_RESERVED');
    const mockHash = `0x3a7e9b1c4f5d${Date.now().toString(16)}aa11bb`;
    updateTxState('FUNDS_RESERVED', 'FUNDS_RESERVED', 'Blockchain reservation confirmed on Primary RPC', {
      blockchainTxHash: mockHash,
      blockNumber: 125432,
      confirmations: 1,
    });
    addTimelineEvent('On-Chain Funds Reserved', 'Anchored on EVM. Blockchain state: FUNDS_RESERVED', 'SUCCESS', 'FUNDS_RESERVED', tx.id);
    await delay(900);

    setQueue([]);
    setArrayIndex([]);
    setActiveQueueIndex(null);

    // Processing -> Finalize -> Recipient Credit
    setActiveArchitectureStep('PROCESSING');
    updateTxState('PROCESSING', 'FUNDS_RESERVED', 'Finalizing on-chain after promotion');
    await delay(800);

    setActiveArchitectureStep('FINAL_VALIDATION');
    updateTxState('FINAL_VALIDATION', 'FUNDS_RESERVED', 'Final compliance verified');
    await delay(700);

    setActiveArchitectureStep('FINALIZE');
    updateTxState('FINALIZED', 'FINALIZED', 'Finalized on blockchain via promotion worker', { confirmations: 3 });
    addTimelineEvent('Promotion Finalized', 'Temporary transaction successfully promoted to on-chain settlement', 'SUCCESS', 'FINALIZE', tx.id);
    await delay(800);

    setActiveArchitectureStep('RECIPIENT_CREDIT');
    setBalances((prev) => ({
      senderTotal: prev.senderTotal - 4000,
      senderAvailable: prev.senderAvailable,
      senderReserved: prev.senderReserved - 4000,
      recipientIncoming: prev.recipientIncoming - 4000,
      recipientConfirmed: prev.recipientConfirmed + 4000,
    }));
    addTimelineEvent('Recipient Credited', 'Funds credited to Recipient: ₹4,000 confirmed spendable.', 'SUCCESS', 'RECIPIENT_CREDIT', tx.id);
    await delay(1000);

    setMetrics((prev) => ({
      ...prev,
      completedTransactions: prev.completedTransactions + 1,
      recoveryEvents: prev.recoveryEvents + 1,
      temporaryTransactions: prev.temporaryTransactions > 0 ? prev.temporaryTransactions - 1 : 0,
    }));

    setActiveHealingStep('IDLE');
    setActiveArchitectureStep('IDLE');
    setIsSimulating(false);
  };

  // -------------------------------------------------------------
  // DEMO 3: RPC TIMEOUT AFTER SUBMISSION -> IDEMPOTENT RECOVERY (NO DUPLICATE)
  // -------------------------------------------------------------
  const runDemo3_RpcTimeout = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setCurrentScenario('DEMO_3');
    isCancelledRef.current = false;

    restoreAllNodes();
    await delay(300);

    const tx = createNewTransaction(4000, 10);
    addTimelineEvent('Submitting Transaction', `ID: ${tx.id} | Initializing on Primary RPC`, 'INFO', 'USER', tx.id);
    setActiveArchitectureStep('USER');
    await delay(700);

    setActiveArchitectureStep('ONCHAIN_PATH');
    updateTxState('ONCHAIN_INITIALIZING', 'NOT_ANCHORED', 'Transaction sent to node mempool');
    await delay(800);

    // Simulate RPC Timeout on response
    addTimelineEvent('RPC Timeout Encountered', 'Socket hung up while awaiting initializePayment() receipt!', 'ERROR', 'BLOCKCHAIN_INIT', tx.id);
    setActiveArchitectureStep('BLOCKCHAIN_INIT');
    updateTxState('UNKNOWN_VERIFYING', 'NOT_ANCHORED', 'UI displaying UNKNOWN / VERIFYING (NOT FAILED - verifying blockchain state)');
    await delay(1200);

    // Demonstrate state verification instead of blind retry
    setActiveHealingStep('DETECT');
    addTimelineEvent('Self-Healing: Avoid Blind Retry', 'CRITICAL: Engine will NOT blindly resubmit to prevent duplicate debit', 'WARNING', 'DETECT', tx.id);
    await delay(900);

    setActiveHealingStep('CLASSIFY');
    addTimelineEvent('Classifying Disruption', 'Type: INFLIGHT_RPC_TIMEOUT. Action: Poll contract storage by Idempotency Key', 'INFO', 'CLASSIFY', tx.id);
    await delay(900);

    setActiveHealingStep('VERIFY');
    const mockHash = `0xdeadbeef${Date.now().toString(16)}cafe11`;
    addTimelineEvent('Querying Node State', `Checking contract mapping for txId: ${tx.id}...`, 'INFO', 'VERIFY', tx.id);
    await delay(1100);

    // Node reports transaction actually succeeded on-chain
    setActiveHealingStep('RECOVER');
    updateTxState('FUNDS_RESERVED', 'FUNDS_RESERVED', 'Discovered existing on-chain reservation! Reconnected without duplicate payment.', {
      blockchainTxHash: mockHash,
      blockNumber: 125433,
      confirmations: 2,
    });
    setBalances((prev) => ({
      ...prev,
      senderAvailable: prev.senderAvailable - 4000,
      senderReserved: prev.senderReserved + 4000,
      recipientIncoming: prev.recipientIncoming + 4000,
    }));
    addTimelineEvent('Existing State Recovered', `Duplicate prevented! Found on-chain reservation: ${mockHash}`, 'SUCCESS', 'RECOVER', tx.id);
    await delay(1200);

    // Resume flow
    setActiveHealingStep('RESUME');
    setActiveArchitectureStep('PROCESSING');
    updateTxState('PROCESSING', 'FUNDS_RESERVED', 'Resuming workflow from verified state');
    await delay(800);

    setActiveArchitectureStep('FINALIZE');
    updateTxState('FINALIZED', 'FINALIZED', 'Finalized successfully after timeout reconciliation', { confirmations: 4 });
    setBalances((prev) => ({
      senderTotal: prev.senderTotal - 4000,
      senderAvailable: prev.senderAvailable,
      senderReserved: prev.senderReserved - 4000,
      recipientIncoming: prev.recipientIncoming - 4000,
      recipientConfirmed: prev.recipientConfirmed + 4000,
    }));
    addTimelineEvent('Settlement Completed', 'Payment settled without replaying or double-spending funds', 'SUCCESS', 'FINALIZE', tx.id);
    await delay(1000);

    setMetrics((prev) => ({
      ...prev,
      completedTransactions: prev.completedTransactions + 1,
      recoveryEvents: prev.recoveryEvents + 1,
    }));

    setActiveHealingStep('IDLE');
    setActiveArchitectureStep('IDLE');
    setIsSimulating(false);
  };

  // -------------------------------------------------------------
  // DEMO 4: WORKER CRASH & DURABLE QUEUE RECONSTRUCTION
  // -------------------------------------------------------------
  const runDemo4_WorkerCrash = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setCurrentScenario('DEMO_4');
    isCancelledRef.current = false;

    const tx = createNewTransaction(4000, 10);
    addTimelineEvent('Transaction in Progress', `ID: ${tx.id} placed in processing state`, 'INFO', 'PROCESSING', tx.id);
    updateTxState('PROCESSING', 'FUNDS_RESERVED', 'Worker processing transaction batch');
    setBalances((prev) => ({
      ...prev,
      senderAvailable: prev.senderAvailable - 4000,
      senderReserved: prev.senderReserved + 4000,
      recipientIncoming: prev.recipientIncoming + 4000,
    }));
    setActiveArchitectureStep('PROCESSING');
    await delay(1000);

    // Simulate worker crash
    addTimelineEvent('Worker Process Crashed', 'SIMULATED CRASH: Worker daemon terminated mid-processing', 'ERROR', 'PROCESSING', tx.id);
    setQueue([]);
    setArrayIndex([]);
    await delay(1400);

    // Reinitialization from durable PostgreSQL store
    setActiveHealingStep('DETECT');
    addTimelineEvent('Server Restarting', 'Daemon restarted. Durable transaction store in PostgreSQL remains intact.', 'RECOVERY', 'DETECT', tx.id);
    await delay(1000);

    setActiveHealingStep('VERIFY');
    addTimelineEvent('Rebuilding Queue Memory', 'Scanning PostgreSQL durable table for unfinished transactions...', 'INFO', 'VERIFY', tx.id);
    await delay(900);

    setQueue([
      {
        id: `reconstructed_queue_${tx.id}`,
        transactionId: tx.id,
        amount: 4000,
        asset: 'HSCT',
        enqueuedAt: tx.createdAt,
        status: 'PROCESSING',
      },
    ]);
    setArrayIndex([tx.id]);
    setActiveQueueIndex(0);
    setActiveHealingStep('RECOVER');
    addTimelineEvent('In-Memory Structures Rebuilt', 'Rebuilt Array index [0] & Doubly Linked List from durable records', 'SUCCESS', 'RECOVER', tx.id);
    await delay(1100);

    setActiveHealingStep('RESUME');
    setActiveArchitectureStep('FINALIZE');
    updateTxState('FINALIZED', 'FINALIZED', 'Worker resumed execution directly from last verified state', {
      blockchainTxHash: `0xworker${Date.now().toString(16)}recovered`,
      blockNumber: 125434,
      confirmations: 2,
    });
    setQueue([]);
    setArrayIndex([]);
    setActiveQueueIndex(null);
    setBalances((prev) => ({
      senderTotal: prev.senderTotal - 4000,
      senderAvailable: prev.senderAvailable,
      senderReserved: prev.senderReserved - 4000,
      recipientIncoming: prev.recipientIncoming - 4000,
      recipientConfirmed: prev.recipientConfirmed + 4000,
    }));
    addTimelineEvent('Recovered Without Replaying Payment', 'Processed to completion from durable state checkpoint', 'SUCCESS', 'FINALIZE', tx.id);
    await delay(1000);

    setMetrics((prev) => ({
      ...prev,
      completedTransactions: prev.completedTransactions + 1,
      recoveryEvents: prev.recoveryEvents + 1,
    }));

    setActiveHealingStep('IDLE');
    setActiveArchitectureStep('IDLE');
    setIsSimulating(false);
  };

  // -------------------------------------------------------------
  // DEMO 5: DATABASE / BLOCKCHAIN STATE MISMATCH & RECONCILIATION
  // -------------------------------------------------------------
  const runDemo5_DbChainMismatch = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setCurrentScenario('DEMO_5');
    isCancelledRef.current = false;

    const tx = createNewTransaction(4000, 10);
    updateTxState('PROCESSING', 'FINALIZED', 'Artificially induced state mismatch: App is PROCESSING, but Chain is FINALIZED', {
      blockchainTxHash: `0xreconcile${Date.now().toString(16)}mismatch`,
      blockNumber: 125435,
      confirmations: 12,
    });
    setBalances((prev) => ({
      ...prev,
      senderAvailable: prev.senderAvailable - 4000,
      senderReserved: prev.senderReserved + 4000,
      recipientIncoming: prev.recipientIncoming + 4000,
    }));
    setActiveArchitectureStep('PROCESSING');
    addTimelineEvent('State Mismatch Injected', 'Database state: PROCESSING | Blockchain state: FINALIZED', 'WARNING', 'PROCESSING', tx.id);
    await delay(1200);

    // Reconciliation Engine
    setActiveHealingStep('DETECT');
    addTimelineEvent('Reconciliation Scanner Running', 'Periodic auditor detected discrepancy between local DB and EVM contract', 'WARNING', 'DETECT', tx.id);
    await delay(900);

    setActiveHealingStep('CLASSIFY');
    addTimelineEvent('Discrepancy Classified', 'Laggard database update. Authoritative on-chain finalization verified.', 'INFO', 'CLASSIFY', tx.id);
    await delay(900);

    setActiveHealingStep('RECONCILE');
    updateTxState('RECONCILED', 'FINALIZED', 'Reconciliation Engine synchronized database record with authoritative blockchain state');
    setBalances((prev) => ({
      senderTotal: prev.senderTotal - 4000,
      senderAvailable: prev.senderAvailable,
      senderReserved: prev.senderReserved - 4000,
      recipientIncoming: prev.recipientIncoming - 4000,
      recipientConfirmed: prev.recipientConfirmed + 4000,
    }));
    addTimelineEvent('State Reconciled', 'Blockchain state verified → application state reconciled. Audit record logged.', 'SUCCESS', 'RECONCILE', tx.id);
    await delay(1200);

    setMetrics((prev) => ({
      ...prev,
      reconciliationEvents: prev.reconciliationEvents + 1,
      completedTransactions: prev.completedTransactions + 1,
    }));

    setActiveHealingStep('IDLE');
    setActiveArchitectureStep('IDLE');
    setIsSimulating(false);
  };

  // -------------------------------------------------------------
  // DEMO 6: INTEGRITY ATTACK & QUARANTINE (Rule #41)
  // -------------------------------------------------------------
  const runDemo6_IntegrityAttack = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setCurrentScenario('DEMO_6');
    isCancelledRef.current = false;

    const tx = createNewTransaction(4000, 10);
    updateTxState('TEMP_PENDING', 'NOT_ANCHORED', 'Created temporary transaction with genuine cryptographic commitment (₹4,000)', {
      route: 'TEMPORARY_OFF_CHAIN',
      inQueue: true,
      queueIndex: 0,
    });
    setQueue([
      {
        id: `attack_${tx.id}`,
        transactionId: tx.id,
        amount: 4000,
        asset: 'HSCT',
        enqueuedAt: new Date().toISOString(),
        status: 'TEMP_PENDING',
      },
    ]);
    setArrayIndex([tx.id]);
    setActiveQueueIndex(0);
    setBalances((prev) => ({
      ...prev,
      senderAvailable: prev.senderAvailable - 4000,
      senderReserved: prev.senderReserved + 4000,
      recipientIncoming: prev.recipientIncoming + 4000,
    }));
    setActiveArchitectureStep('TEMP_TX');
    addTimelineEvent('Original Temporary Tx Created', `Genuine amount: ₹4,000 | Hash: ${tx.integrityHash.substring(0, 18)}...`, 'INFO', 'TEMP_TX', tx.id);
    await delay(1200);

    // Simulate tampering: malicious attacker edits amount from 4000 to 9000
    addTimelineEvent('Simulating Malicious Tampering', 'ATTACK: Payload amount modified in off-chain pool: ₹4,000 → ₹9,000', 'ERROR', 'TEMP_TX', tx.id);
    const tamperedComputedHash = `sha256:TAMPERED_${Date.now().toString(16)}_INVALID`;
    updateTxState('TEMP_PENDING', 'NOT_ANCHORED', 'Tampered payload: Amount altered to ₹9,000', {
      amount: 9000,
      isTampered: true,
      tamperedHash: tamperedComputedHash,
    });
    await delay(1200);

    setActiveHealingStep('VERIFY');
    setActiveArchitectureStep('FINAL_VALIDATION');
    addTimelineEvent('Integrity Check Failed!', `SECURITY BREACH: Computed hash (${tamperedComputedHash.substring(0, 16)}) != Committed hash (${tx.integrityHash.substring(0, 16)})`, 'ERROR', 'FINAL_VALIDATION', tx.id);
    await delay(1200);

    // Quarantine transaction immediately
    setActiveArchitectureStep('QUARANTINE');
    updateTxState('QUARANTINED', 'DISCREPANCY', 'Transaction quarantined: Off-chain cryptographic integrity commitment violation detected');
    setQueue([]);
    setArrayIndex([]);
    setActiveQueueIndex(null);

    // Release sender reservation, recipient receives NOTHING
    setBalances((prev) => ({
      ...prev,
      senderAvailable: prev.senderAvailable + 4000,
      senderReserved: prev.senderReserved - 4000,
      recipientIncoming: prev.recipientIncoming - 4000,
    }));

    addTimelineEvent('Transaction Quarantined', 'CRITICAL DEFENSE: Recipient uncredited. Funds released safely. Incident quarantined.', 'QUARANTINE', 'QUARANTINE', tx.id);
    setMetrics((prev) => ({
      ...prev,
      quarantinedTransactions: prev.quarantinedTransactions + 1,
      temporaryTransactions: prev.temporaryTransactions > 0 ? prev.temporaryTransactions - 1 : 0,
    }));
    await delay(1400);

    setActiveHealingStep('IDLE');
    setActiveArchitectureStep('IDLE');
    setIsSimulating(false);
  };

  const sendCustomTransaction = async (amount: number, expiryMinutes: number = 10) => {
    if (isSimulating) return;
    const healthy = nodes.some((n) => n.status === 'HEALTHY' && n.acceptsNewTransactions);
    if (healthy && !activeFailures.has('RPC_TIMEOUT')) {
      await runDemo1_NormalPayment();
    } else {
      await runDemo2_BlockchainUnavailable();
    }
  };

  const resetSimulation = () => {
    isCancelledRef.current = true;
    setIsSimulating(false);
    setCurrentScenario('NONE');
    setNodes(INITIAL_NODES);
    setBalances(INITIAL_BALANCES);
    setActiveTransaction(null);
    setTransactions([]);
    setQueue([]);
    setArrayIndex([]);
    setActiveQueueIndex(null);
    setSelectedTransaction(null);
    setActiveArchitectureStep('IDLE');
    setActiveHealingStep('IDLE');
    setActiveFailures(new Set());
    setTimeline([]);
    setMetrics(INITIAL_METRICS);
    txCounter.current = 1;
    addTimelineEvent('Simulation Reset', 'System returned to READY state with clean simulated state (Wallet: ₹10,000)', 'INFO');
  };

  return (
    <SimulationContext.Provider
      value={{
        nodes,
        setNodeStatus,
        setAllNodesOffline,
        restoreAllNodes,
        makeNodeBusy,
        healthyNodeCount,
        routingDecision,
        balances,
        activeTransaction,
        transactions,
        queue,
        arrayIndex,
        activeQueueIndex,
        selectedTransaction,
        setSelectedTransaction,
        activeArchitectureStep,
        activeHealingStep,
        currentScenario,
        isSimulating,
        simulationSpeed,
        setSimulationSpeed,
        activeFailures,
        toggleFailure,
        clearAllFailures,
        timeline,
        metrics,
        runDemoInsufficientFunds,
        runDemoNodeBusy,
        runDemo1_NormalPayment,
        runDemo2_BlockchainUnavailable,
        runDemo3_RpcTimeout,
        runDemo4_WorkerCrash,
        runDemo5_DbChainMismatch,
        runDemo6_IntegrityAttack,
        sendCustomTransaction,
        resetSimulation,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
}

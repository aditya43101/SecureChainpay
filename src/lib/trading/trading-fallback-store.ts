/**
 * SecureChain Pay — In-Memory Trading Fallback Store
 * Provides fully persistent, reactive simulated trading data when PostgreSQL/Prisma is unreachable or offline.
 */

export interface FallbackAutoTradingSettings {
  id: string;
  userId: string;
  enabled: boolean;
  status: 'ENABLED' | 'DISABLED' | 'PAUSED' | 'EMERGENCY_STOP';
  mode: 'PAPER' | 'LIVE' | 'AUTO';
  allTimeMode: boolean;
  pausedReason: string | null;
  allowedAssets: string[];
  allowedTimeframes: string[];
  riskPerTrade: number;
  maxDailyLoss: number;
  maxPortfolioExposure: number;
  maxOpenPositions: number;
  maxAssetExposure: number;
  minRiskReward: number;
  cooldownPeriod: number;
  maxSlippage: number;
  strategyVersion: string;
  modelVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface FallbackDailyRiskState {
  id: string;
  userId: string;
  date: string;
  startingBalance: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  dailyLossLimitReached: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FallbackPaperPosition {
  id: string;
  accountId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  averageEntry: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  unrealizedPnL: number;
  openedAt: string;
  updatedAt: string;
}

export interface FallbackPaperOrder {
  id: string;
  accountId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price: number;
  stopLoss: number;
  takeProfit: number;
  fees: number;
  status: 'FILLED' | 'CANCELLED' | 'REJECTED';
  executedAt: string;
}

export interface FallbackPaperAccount {
  id: string;
  userId: string;
  initialBalance: number;
  cashBalance: number;
  equity: number;
  realizedPnL: number;
  positions: FallbackPaperPosition[];
  orders: FallbackPaperOrder[];
  createdAt: string;
  updatedAt: string;
}

export interface FallbackExecutionOrder {
  id: string;
  orderId: string;
  userId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  requestedPrice: number;
  executedPrice: number;
  quantity: number;
  filledQuantity: number;
  status: 'FILLED' | 'PARTIALLY_FILLED' | 'REJECTED' | 'CANCELLED';
  fees: number;
  slippage: number;
  strategyVersion: string;
  modelVersion: string;
  signalId?: string;
  stopLoss?: number;
  takeProfit?: number;
  idempotencyKey?: string;
  createdAt: string;
}

export interface FallbackSafetyEvent {
  id: string;
  userId: string;
  eventType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  details: string;
  metadata?: any;
  createdAt: string;
}

export interface FallbackStrategyVersion {
  id: string;
  versionName: string;
  strategyType: string;
  parameters: any;
  isChampion: boolean;
  isChallenger: boolean;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  createdAt: string;
}

class TradingFallbackStore {
  private settings = new Map<string, FallbackAutoTradingSettings>();
  private dailyStates = new Map<string, FallbackDailyRiskState>();
  private accounts = new Map<string, FallbackPaperAccount>();
  private orders: FallbackExecutionOrder[] = [];
  private safetyEvents: FallbackSafetyEvent[] = [];
  private strategyVersions: FallbackStrategyVersion[] = [
    {
      id: 'strat_champion_1',
      versionName: 'HYBRID_v1',
      strategyType: 'HYBRID',
      parameters: { minScore: 5, rsiFilter: true, mlWeight: 2 },
      isChampion: true,
      isChallenger: false,
      totalReturn: 12.5,
      maxDrawdown: 4.2,
      winRate: 58.3,
      profitFactor: 1.85,
      createdAt: new Date().toISOString()
    }
  ];
  private learningEvents: any[] = [];
  private feedbackMemories: any[] = [];
  private recommendations: any[] = [];
  private approvals: any[] = [];
  private journalEntries: any[] = [];

  constructor() {
    // Initialize default system settings for demo/default users
    this.getSettings('default-user-id');
    this.getSettings('demo-user-id');
  }

  getSettings(userId: string): FallbackAutoTradingSettings {
    let s = this.settings.get(userId);
    if (!s) {
      s = {
        id: `setting_${userId}`,
        userId,
        enabled: false,
        status: 'DISABLED',
        mode: 'PAPER',
        allTimeMode: false,
        pausedReason: null,
        allowedAssets: ['BTCUSDT', 'ETHUSDT'],
        allowedTimeframes: ['1h', '4h'],
        riskPerTrade: 0.01,
        maxDailyLoss: 0.03,
        maxPortfolioExposure: 0.20,
        maxOpenPositions: 3,
        maxAssetExposure: 0.10,
        minRiskReward: 1.5,
        cooldownPeriod: 60,
        maxSlippage: 0.005,
        strategyVersion: 'HYBRID_v1',
        modelVersion: 'LOG_v1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.settings.set(userId, s);
    }
    return { ...s };
  }

  updateSettings(userId: string, partial: Partial<FallbackAutoTradingSettings>): FallbackAutoTradingSettings {
    const current = this.getSettings(userId);
    const updated: FallbackAutoTradingSettings = {
      ...current,
      ...partial,
      updatedAt: new Date().toISOString()
    };
    this.settings.set(userId, updated);
    return { ...updated };
  }

  getDailyState(userId: string, dateStr?: string): FallbackDailyRiskState {
    const date = dateStr || new Date().toISOString().split('T')[0];
    const key = `${userId}_${date}`;
    let state = this.dailyStates.get(key);
    if (!state) {
      state = {
        id: `daily_${key}`,
        userId,
        date,
        startingBalance: 100000,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        dailyLossLimitReached: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.dailyStates.set(key, state);
    }
    return { ...state };
  }

  updateDailyState(userId: string, dateStr: string, partial: Partial<FallbackDailyRiskState>): FallbackDailyRiskState {
    const key = `${userId}_${dateStr}`;
    const current = this.getDailyState(userId, dateStr);
    const updated = {
      ...current,
      ...partial,
      updatedAt: new Date().toISOString()
    };
    this.dailyStates.set(key, updated);
    return { ...updated };
  }

  getPaperAccount(userId: string): FallbackPaperAccount {
    let acc = this.accounts.get(userId);
    if (!acc) {
      acc = {
        id: `paper_acc_${userId}`,
        userId,
        initialBalance: 100000.0,
        cashBalance: 100000.0,
        equity: 100000.0,
        realizedPnL: 0.0,
        positions: [],
        orders: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.accounts.set(userId, acc);
    }
    return { ...acc, positions: [...acc.positions], orders: [...acc.orders] };
  }

  updatePaperAccount(userId: string, partial: Partial<FallbackPaperAccount>): FallbackPaperAccount {
    const acc = this.getPaperAccount(userId);
    const updated = {
      ...acc,
      ...partial,
      updatedAt: new Date().toISOString()
    };
    this.accounts.set(userId, updated);
    return { ...updated };
  }

  addPosition(userId: string, pos: Omit<FallbackPaperPosition, 'id' | 'accountId' | 'openedAt' | 'updatedAt'>): FallbackPaperPosition {
    const acc = this.getPaperAccount(userId);
    const newPos: FallbackPaperPosition = {
      ...pos,
      id: `pos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      accountId: acc.id,
      openedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    acc.positions.push(newPos);
    this.accounts.set(userId, acc);
    return newPos;
  }

  removePosition(userId: string, positionId: string): void {
    const acc = this.getPaperAccount(userId);
    acc.positions = acc.positions.filter(p => p.id !== positionId);
    this.accounts.set(userId, acc);
  }

  addOrder(userId: string, orderData: any): FallbackExecutionOrder {
    const order: FallbackExecutionOrder = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderId: `ORDER_${Date.now()}`,
      userId,
      symbol: orderData.symbol,
      side: orderData.side,
      type: orderData.type || 'MARKET',
      requestedPrice: orderData.requestedPrice || 0,
      executedPrice: orderData.executedPrice || orderData.requestedPrice || 0,
      quantity: orderData.quantity || 0,
      filledQuantity: orderData.filledQuantity || orderData.quantity || 0,
      status: orderData.status || 'FILLED',
      fees: orderData.fees || 0,
      slippage: orderData.slippage || 0,
      strategyVersion: orderData.strategyVersion || 'HYBRID_v1',
      modelVersion: orderData.modelVersion || 'LOG_v1',
      signalId: orderData.signalId,
      stopLoss: orderData.stopLoss,
      takeProfit: orderData.takeProfit,
      idempotencyKey: orderData.idempotencyKey,
      createdAt: new Date().toISOString()
    };
    this.orders.unshift(order);

    // Also add to paper account orders
    const acc = this.getPaperAccount(userId);
    acc.orders.unshift({
      id: order.id,
      accountId: acc.id,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      price: order.executedPrice,
      stopLoss: order.stopLoss || 0,
      takeProfit: order.takeProfit || 0,
      fees: order.fees,
      status: order.status === 'FILLED' ? 'FILLED' : 'REJECTED',
      executedAt: order.createdAt
    });
    this.accounts.set(userId, acc);

    return order;
  }

  getOrders(userId: string, limit = 20): FallbackExecutionOrder[] {
    return this.orders.filter(o => o.userId === userId).slice(0, limit);
  }

  addSafetyEvent(event: Omit<FallbackSafetyEvent, 'id' | 'createdAt'>): FallbackSafetyEvent {
    const newEvent: FallbackSafetyEvent = {
      ...event,
      id: `safe_evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString()
    };
    this.safetyEvents.unshift(newEvent);
    return newEvent;
  }

  getSafetyEvents(userId: string, limit = 10): FallbackSafetyEvent[] {
    return this.safetyEvents.filter(e => e.userId === userId).slice(0, limit);
  }

  getStrategyVersions(): FallbackStrategyVersion[] {
    return [...this.strategyVersions];
  }

  addStrategyVersion(ver: Omit<FallbackStrategyVersion, 'id' | 'createdAt'>): FallbackStrategyVersion {
    const newVer: FallbackStrategyVersion = {
      ...ver,
      id: `strat_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    if (newVer.isChampion) {
      this.strategyVersions.forEach(v => { v.isChampion = false; });
    }
    this.strategyVersions.unshift(newVer);
    return newVer;
  }

  addLearningEvent(event: any): any {
    const newEvt = {
      id: `learn_${Date.now()}`,
      ...event,
      createdAt: new Date().toISOString()
    };
    this.learningEvents.unshift(newEvt);
    return newEvt;
  }

  getLearningEvents(limit = 20): any[] {
    return this.learningEvents.slice(0, limit);
  }

  getFeedbackMemories(limit = 20): any[] {
    return this.feedbackMemories.slice(0, limit);
  }

  addFeedbackMemory(mem: any): any {
    const newMem = {
      id: `mem_${Date.now()}`,
      ...mem,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.feedbackMemories.unshift(newMem);
    return newMem;
  }

  addApproval(approval: any): any {
    const newApp = {
      id: `app_${Date.now()}`,
      ...approval,
      createdAt: new Date().toISOString()
    };
    this.approvals.unshift(newApp);
    return newApp;
  }

  findApprovalByKey(ik: string): any {
    return this.approvals.find(a => a.idempotencyKey === ik) || null;
  }

  findOrderByKey(ik: string): any {
    return this.orders.find(o => o.idempotencyKey === ik) || null;
  }

  addJournalEntry(entry: any): any {
    const newJournal = {
      id: `jrn_${Date.now()}`,
      ...entry,
      createdAt: new Date().toISOString()
    };
    this.journalEntries.unshift(newJournal);
    return newJournal;
  }

  addRecommendation(rec: any): any {
    const newRec = {
      id: `rec_${Date.now()}`,
      ...rec,
      createdAt: new Date().toISOString()
    };
    this.recommendations.unshift(newRec);
    return newRec;
  }

  getRecommendations(symbol?: string, limit = 20): any[] {
    let list = this.recommendations;
    if (symbol) {
      list = list.filter(r => r.symbol === symbol || r.asset === symbol);
    }
    return list.slice(0, limit);
  }
}

// Global singleton instance
declare global {
  // eslint-disable-next-line no-var
  var _tradingFallbackStore: TradingFallbackStore | undefined;
}

export const tradingFallbackStore = globalThis._tradingFallbackStore || new TradingFallbackStore();

if (process.env.NODE_ENV !== 'production') {
  globalThis._tradingFallbackStore = tradingFallbackStore;
}

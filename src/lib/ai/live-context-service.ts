/**
 * SecureChain Pay — Dynamic Live Context Service
 * Retrieves privacy-filtered live user & market state for requested context domains only.
 */

import { prisma } from '@/lib/prisma';
import { getAdminDb } from '@/lib/firebase/admin';
import { ContextDomain } from './intent-classifier';
import { convertHsctToUsd } from '@/lib/currency/currency-service';
import { marketDataService } from '@/lib/market/market-data-service';
import { tradingFallbackStore } from '@/lib/trading/trading-fallback-store';

export interface LiveContextPayload {
  contextGeneratedAt: string;
  userId: string;
  userProfileContext?: any;
  walletContext?: any;
  transactionContext?: any;
  tradingContext?: any;
  riskSafetyContext?: any;
  blockchainContext?: any;
  userSettingsContext?: any;
}

export async function fetchLiveContextForDomains(
  userId: string,
  domains: ContextDomain[],
  targetAsset?: string
): Promise<LiveContextPayload> {
  const generatedAt = new Date().toISOString();
  const payload: LiveContextPayload = {
    contextGeneratedAt: generatedAt,
    userId
  };

  // User profile context
  try {
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    if (dbUser) {
      const fullName = [dbUser.firstName, dbUser.lastName].filter(Boolean).join(' ') || dbUser.email?.split('@')[0] || null;
      payload.userProfileContext = {
        name: fullName,
        email: dbUser.email || null,
        role: dbUser.role
      };
    }
  } catch (_) {}

  const domainSet = new Set(domains);

  // 1. WALLET CONTEXT & PORTFOLIO
  if (domainSet.has('WALLET_CONTEXT') || domainSet.has('PORTFOLIO_CONTEXT')) {
    try {
      const adminDb = getAdminDb();
      const walletSnap = await adminDb
        .collection('users')
        .doc(userId)
        .collection('wallet')
        .doc('data')
        .get();

      if (walletSnap.exists) {
        const data = walletSnap.data() || {};
        payload.walletContext = {
          address: data.address || null,
          keyFingerprint: data.keyFingerprint || null,
          balances: {
            HSCT: data.balances?.HSCT || 0,
            USD: data.balances?.USD || convertHsctToUsd(data.balances?.HSCT || 0),
            BTC: data.balances?.BTC || 0,
            ETH: data.balances?.ETH || 0
          },
          lastBlockNumber: data.lastBlockNumber || 0
        };
      } else {
        payload.walletContext = {
          address: null,
          balances: { HSCT: 0, USD: 0, BTC: 0, ETH: 0 },
          lastBlockNumber: 0
        };
      }
    } catch (err) {
      console.warn('[LiveContext] Failed to fetch wallet context:', err);
    }
  }

  // 2. TRANSACTION CONTEXT (Top 5 Recent Only)
  if (domainSet.has('TRANSACTION_CONTEXT')) {
    try {
      const adminDb = getAdminDb();
      const txsSnap = await adminDb
        .collection('users')
        .doc(userId)
        .collection('transactions')
        .orderBy('blockNumber', 'desc')
        .limit(5)
        .get();

      const recentTxs = txsSnap.docs.map(doc => {
        const d = doc.data();
        return {
          id: d.id,
          amount: d.amount,
          currency: d.currency || d.asset || 'HSCT',
          type: d.type,
          status: d.status,
          date: d.date || d.createdAt,
          description: d.description,
          blockNumber: d.blockNumber
        };
      });

      payload.transactionContext = {
        totalFetched: recentTxs.length,
        recentTransactions: recentTxs
      };
    } catch (err) {
      console.warn('[LiveContext] Failed to fetch transactions context:', err);
    }
  }

  // 3. TRADING, RISK & SAFETY CONTEXT
  if (domainSet.has('TRADING_CONTEXT') || domainSet.has('RISK_CONTEXT') || domainSet.has('SAFETY_CONTEXT')) {
    try {
      let autoSettings: any = null;
      let dailyRisk: any = null;
      let paperAccount: any = null;

      try {
        autoSettings = await prisma.autoTradingSettings.findUnique({
          where: { userId }
        });

        const todayStr = new Date().toISOString().split('T')[0];
        dailyRisk = await prisma.dailyRiskState.findUnique({
          where: { userId_date: { userId, date: todayStr } }
        });

        paperAccount = await prisma.paperAccount.findUnique({
          where: { userId },
          include: { positions: true }
        });
      } catch {
        autoSettings = tradingFallbackStore.getSettings(userId);
        dailyRisk = tradingFallbackStore.getDailyState(userId);
        paperAccount = tradingFallbackStore.getPaperAccount(userId);
      }

      payload.tradingContext = {
        autoTradingEnabled: autoSettings?.enabled || false,
        status: autoSettings?.status || 'DISABLED',
        mode: autoSettings?.mode || 'PAPER',
        allTimeMode: autoSettings?.allTimeMode || false,
        strategyVersion: autoSettings?.strategyVersion || 'HYBRID_v1',
        riskPerTradePct: (autoSettings?.riskPerTrade || 0.01) * 100,
        maxDailyLossPct: (autoSettings?.maxDailyLoss || 0.03) * 100,
        todayRealizedPnL: dailyRisk?.realizedPnL || 0,
        todayTradesCount: dailyRisk?.totalTrades || 0,
        dailyLossLimitReached: dailyRisk?.dailyLossLimitReached || false,
        paperEquity: paperAccount?.equity || 100000,
        openPositionsCount: paperAccount?.positions?.length || 0
      };

      if (targetAsset) {
        const formattedSymbol = targetAsset.endsWith('USDT') ? targetAsset : `${targetAsset}USDT`;
        const ticker = await marketDataService.getTicker(formattedSymbol).catch(() => null);
        if (ticker) {
          payload.tradingContext.activeAssetTicker = {
            symbol: formattedSymbol,
            priceHsct: Number(ticker.price),
            change24h: ticker.change24h
          };
        }
      }
    } catch (err) {
      console.warn('[LiveContext] Failed to fetch trading context:', err);
    }
  }

  // 4. BLOCKCHAIN CONTEXT
  if (domainSet.has('BLOCKCHAIN_CONTEXT')) {
    try {
      const adminDb = getAdminDb();
      const metaSnap = await adminDb.collection('global_chain_meta').doc('chain_state').get();
      if (metaSnap.exists) {
        const meta = metaSnap.data() || {};
        payload.blockchainContext = {
          lastBlockNumber: meta.lastBlockNumber || 0,
          totalBlocks: meta.totalBlocks || 1,
          genesisHash: meta.genesisHash || 'GENESIS_ANCHOR'
        };
      }
    } catch (err) {
      console.warn('[LiveContext] Failed to fetch blockchain context:', err);
    }
  }

  return payload;
}

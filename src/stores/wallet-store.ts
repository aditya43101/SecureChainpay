import { create } from 'zustand';

interface Transaction {
  id: string;
  type: 'send' | 'receive';
  amount: string;
  asset: string;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
  hash: string;
}

interface WalletState {
  address: string | null;
  balance: string;
  isConnected: boolean;
  chainId: number | null;
  transactions: Transaction[];
  connectWallet: (address: string, chainId: number, balance?: string) => void;
  disconnectWallet: () => void;
  updateBalance: (balance: string) => void;
  setChainId: (chainId: number) => void;
  addTransaction: (tx: Transaction) => void;
  updateTransactionStatus: (id: string, status: Transaction['status']) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  balance: '0',
  isConnected: false,
  chainId: null,
  transactions: [],
  connectWallet: (address, chainId, balance = '0') => 
    set({ address, chainId, balance, isConnected: true }),
  disconnectWallet: () => 
    set({ address: null, balance: '0', isConnected: false, chainId: null, transactions: [] }),
  updateBalance: (balance) => set({ balance }),
  setChainId: (chainId) => set({ chainId }),
  addTransaction: (tx) => 
    set((state) => ({ transactions: [tx, ...state.transactions] })),
  updateTransactionStatus: (id, status) =>
    set((state) => ({
      transactions: state.transactions.map(tx => 
        tx.id === id ? { ...tx, status } : tx
      )
    })),
}));

import { WalletCard } from '@/components/dashboard/WalletCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ArrowUpRight, ArrowDownLeft, RefreshCcw, MoreHorizontal } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 fill-mode-both pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2">Overview</h1>
          <p className="text-neutral-400 text-base">Welcome back, your portfolio is up <span className="text-emerald-400 font-medium">+5.2%</span> today.</p>
        </div>
        <div className="flex items-center gap-2 text-sm bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full border border-emerald-500/20 w-fit backdrop-blur-md shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          SecureChain Mainnet
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WalletCard />
        </div>
        <div className="lg:col-span-1">
          <QuickActions />
        </div>
      </div>

      {/* Transactions Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white tracking-tight">Recent Activity</h2>
          <button className="text-sm px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-colors">
            View All
          </button>
        </div>
        
        <div className="bg-neutral-900/40 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-xl">
          <div className="divide-y divide-white/5">
            {TRANSACTIONS.map((tx) => (
              <div key={tx.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-white/[0.03] transition-colors group cursor-pointer">
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    tx.type === 'received' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    tx.type === 'sent' ? 'bg-neutral-800 text-neutral-300 border border-neutral-700' :
                    'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {tx.type === 'received' && <ArrowDownLeft size={24} />}
                    {tx.type === 'sent' && <ArrowUpRight size={24} />}
                    {tx.type === 'swap' && <RefreshCcw size={24} />}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white group-hover:text-emerald-400 transition-colors">{tx.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-neutral-500">{tx.date}</span>
                      <span className="w-1 h-1 rounded-full bg-neutral-700" />
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                        tx.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className={`text-base sm:text-lg font-bold ${tx.type === 'received' ? 'text-emerald-400' : 'text-white'}`}>
                      {tx.amount}
                    </p>
                    <p className="text-sm text-neutral-500 font-medium">{tx.fiatAmount}</p>
                  </div>
                  <button className="hidden sm:flex text-neutral-500 hover:text-white p-2 transition-colors">
                    <MoreHorizontal size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const TRANSACTIONS = [
  {
    id: 1,
    type: 'received',
    title: 'Received USDC',
    date: 'Today, 2:45 PM',
    status: 'Completed',
    amount: '+2,450.00 USDC',
    fiatAmount: '+$2,450.00',
  },
  {
    id: 2,
    type: 'swap',
    title: 'Swapped ETH to BTC',
    date: 'Yesterday, 10:20 AM',
    status: 'Completed',
    amount: '0.45 ETH',
    fiatAmount: '~$1,240.50',
  },
  {
    id: 3,
    type: 'sent',
    title: 'Sent to 0x48a...92b4',
    date: 'Jul 12, 6:15 PM',
    status: 'Completed',
    amount: '-150.00 USDT',
    fiatAmount: '-$150.00',
  },
  {
    id: 4,
    type: 'received',
    title: 'Staking Reward',
    date: 'Jul 10, 1:00 AM',
    status: 'Completed',
    amount: '+12.50 SCR',
    fiatAmount: '+$45.20',
  },
];

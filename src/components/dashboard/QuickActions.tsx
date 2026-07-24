import { Send, Download, RefreshCcw, CreditCard } from 'lucide-react';

export function QuickActions() {
  const actions = [
    { name: 'Send', icon: <Send size={24} />, color: 'from-emerald-400 to-teal-500', shadow: 'shadow-emerald-500/20' },
    { name: 'Receive', icon: <Download size={24} />, color: 'from-blue-400 to-cyan-500', shadow: 'shadow-blue-500/20' },
    { name: 'Swap', icon: <RefreshCcw size={24} />, color: 'from-purple-400 to-pink-500', shadow: 'shadow-purple-500/20' },
    { name: 'Buy Crypto', icon: <CreditCard size={24} />, color: 'from-orange-400 to-rose-500', shadow: 'shadow-orange-500/20' },
  ];

  return (
    <div className="bg-neutral-900/40 border border-white/5 rounded-[2rem] p-6 sm:p-8 h-full flex flex-col justify-between backdrop-blur-xl shadow-xl">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-bold text-white tracking-tight">Quick Actions</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4 flex-1">
        {actions.map((action) => (
          <button 
            key={action.name}
            className="flex flex-col items-center justify-center gap-4 p-5 rounded-3xl bg-neutral-950/50 border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300 group relative overflow-hidden"
          >
            {/* Hover Glow Effect */}
            <div className={`absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
            
            <div className={`w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br ${action.color} shadow-lg ${action.shadow} group-hover:scale-110 transition-transform duration-300 ease-out z-10`}>
              <div className="text-white drop-shadow-md">
                {action.icon}
              </div>
            </div>
            
            <span className="text-sm font-semibold text-neutral-300 group-hover:text-white transition-colors z-10">
              {action.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

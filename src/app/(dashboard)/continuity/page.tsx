'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, AlertTriangle, Zap, CheckCircle2, ShieldCheck, Activity, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function PaymentContinuityDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/continuity');
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      toast.error('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  const runRecovery = async () => {
    toast.info('Starting Recovery Scanner...');
    try {
      const res = await fetch('/api/admin/continuity', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast.success(`Scan complete. Recovered ${json.result.recovered} out of ${json.result.scanned} stuck intents.`);
        fetchMetrics();
      }
    } catch (err) {
      toast.error('Recovery failed');
    }
  };

  const simulateRPCFailure = async (intentId: string) => {
     try {
       const res = await fetch('/api/admin/continuity/simulate', { 
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ action: 'RPC_TIMEOUT', intentId })
       });
       if (res.ok) { toast.success('Simulated RPC Timeout'); fetchMetrics(); }
     } catch (err) { toast.error('Simulation failed'); }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return <div className="p-8 text-center text-white">Loading Continuity Engine...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <ShieldCheck className="text-emerald-400" size={32} />
            Payment Continuity
          </h1>
          <p className="text-neutral-400 mt-1">Fault-tolerant recovery & idempotency engine.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={runRecovery}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-xl hover:bg-emerald-500/30 transition-all"
          >
            <RefreshCw size={18} />
            Run Recovery Scanner
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Processing" value={data?.metrics?.processing || 0} icon={<Activity size={20} />} color="text-blue-400" />
        <MetricCard label="Unknown Outcome" value={data?.metrics?.broadcastUnknown || 0} icon={<AlertTriangle size={20} />} color="text-yellow-400" />
        <MetricCard label="Reconciling" value={data?.metrics?.reconciling || 0} icon={<Search size={20} />} color="text-orange-400" />
        <MetricCard label="Recovered" value={data?.metrics?.recovered || 0} icon={<CheckCircle2 size={20} />} color="text-emerald-400" />
      </div>

      <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6">
         <h2 className="text-xl font-bold mb-4">Active Intents</h2>
         <div className="overflow-x-auto">
           <table className="w-full text-left text-sm">
             <thead>
               <tr className="border-b border-white/10 text-neutral-400">
                 <th className="pb-3 font-medium">Intent ID</th>
                 <th className="pb-3 font-medium">Status</th>
                 <th className="pb-3 font-medium">Amount</th>
                 <th className="pb-3 font-medium">Updated At</th>
                 <th className="pb-3 font-medium">Actions (Chaos Testing)</th>
               </tr>
             </thead>
             <tbody>
               {data?.intents?.map((intent: any) => (
                 <tr key={intent.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                   <td className="py-3 font-mono text-xs text-neutral-300">{intent.id}</td>
                   <td className="py-3">
                     <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(intent.status)}`}>
                       {intent.status}
                     </span>
                   </td>
                   <td className="py-3">${intent.amount}</td>
                   <td className="py-3 text-neutral-400">{new Date(intent.updatedAt).toLocaleTimeString()}</td>
                   <td className="py-3">
                     {intent.status !== 'CONFIRMED' && intent.status !== 'FAILED' && (
                       <button 
                         onClick={() => simulateRPCFailure(intent.id)}
                         className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/30 hover:bg-red-500/40 transition-colors"
                       >
                         Inject Timeout
                       </button>
                     )}
                   </td>
                 </tr>
               ))}
               {(!data?.intents || data.intents.length === 0) && (
                 <tr><td colSpan={5} className="py-4 text-center text-neutral-500">No payment intents found.</td></tr>
               )}
             </tbody>
           </table>
         </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, color }: { label: string, value: number, icon: any, color: string }) {
  return (
    <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
      <div>
        <p className="text-sm text-neutral-400 font-medium">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      </div>
      <div className={`p-3 rounded-xl bg-white/5 ${color}`}>{icon}</div>
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'CONFIRMED': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'FAILED': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'BROADCAST_UNKNOWN': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'RECONCILING': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'PROCESSING': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default: return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30';
  }
}

'use client';

import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, ShieldCheck, Cpu, Database, Zap, RefreshCw, Bot, ChevronRight, ActivitySquare } from 'lucide-react';

export default function PredictiveOpsDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [simulatorScenario, setSimulatorScenario] = useState('LATENCY_SPIKE');
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/predictive');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  const runSimulation = async () => {
    setSimulating(true);
    try {
      const res = await fetch('/api/admin/predictive/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: simulatorScenario, provider: 'Primary_EVM_Node' })
      });
      const json = await res.json();
      if (json.success) setSimulationResult(json.data.impact);
    } catch (e) {
      console.error(e);
    } finally {
      setSimulating(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const { health, forecast, incidents } = data || {};
  const isHealthy = forecast?.riskLevel === 'LOW';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Activity className="text-emerald-400" />
          Predictive Operations Center
        </h1>
        <p className="text-neutral-400 mt-2">Autonomous reliability forecasting and early warning system.</p>
      </div>

      {/* Primary Status Banner */}
      <div className={`p-6 rounded-2xl border ${isHealthy ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-red-950/20 border-red-500/20'} flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${isHealthy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {isHealthy ? <ShieldCheck size={28} /> : <AlertTriangle size={28} />}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">
              System Reliability: {forecast?.reliabilityScore.toFixed(1)}%
            </h2>
            <p className={`text-sm ${isHealthy ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
              Predicted Risk: {forecast?.riskLevel}
            </p>
          </div>
        </div>
        <button onClick={fetchTelemetry} className="p-2 hover:bg-white/5 rounded-lg text-neutral-400 transition-colors">
          <RefreshCw size={20} />
        </button>
      </div>

      {/* Grid: Forecast & Infrastructure */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <ActivitySquare className="text-emerald-400" size={20} />
            Provider Forecast
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
              <div>
                <p className="text-white font-medium">{forecast?.provider}</p>
                <p className="text-sm text-neutral-400">Current Health: {health?.blockchain?.status}</p>
              </div>
              <div className="text-right">
                <p className={`font-bold ${isHealthy ? 'text-emerald-400' : 'text-yellow-400'}`}>{forecast?.riskLevel} RISK</p>
                <p className="text-xs text-neutral-500">Confidence: {(forecast?.confidence * 100).toFixed(0)}%</p>
              </div>
            </div>
            
            <div className="p-4 bg-blue-950/20 border border-blue-500/20 rounded-xl">
               <h4 className="text-sm font-medium text-blue-400 flex items-center gap-2 mb-2">
                 <Bot size={16} /> Routing Recommendation
               </h4>
               <p className="text-sm text-neutral-300">
                 {isHealthy ? "Maintain current routing allocations. Provider stability is high." : "Reduce EVM dependency. Shift non-critical traffic to HYBRID layer to evade potential synchrony failure."}
               </p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Cpu className="text-cyan-400" size={20} />
            Infrastructure Telemetry
          </h3>
          <div className="space-y-3">
             <div className="flex justify-between items-center">
                <span className="text-neutral-400">RPC Latency</span>
                <span className="text-white font-medium">{health?.blockchain?.rpcLatencyMs} ms</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-neutral-400">Gas Price</span>
                <span className="text-white font-medium">{health?.blockchain?.gasPriceGwei} Gwei</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-neutral-400">DB Latency</span>
                <span className="text-white font-medium">{health?.database?.dbLatencyMs} ms</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-neutral-400">Ledger Sync</span>
                <span className="text-emerald-400 font-medium">{health?.database?.ledgerConsistency}</span>
             </div>
          </div>
        </div>
      </div>

      {/* Early Warnings & AI Root Cause */}
      <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <AlertTriangle className="text-yellow-400" size={20} />
          Early Warnings & AI Root Cause
        </h3>
        
        {incidents?.length > 0 ? (
          <div className="space-y-4">
            {incidents.map((incident: any) => (
              <div key={incident.id} className="p-4 bg-white/5 rounded-xl border border-white/5 border-l-2 border-l-yellow-500">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-white font-medium">{incident.description}</h4>
                  <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-md">
                    {incident.severity}
                  </span>
                </div>
                
                {incident.aiExplanation && (
                  <div className="mt-3 p-3 bg-neutral-950 rounded-lg flex items-start gap-3">
                    <Bot className="text-emerald-400 mt-0.5 shrink-0" size={16} />
                    <p className="text-sm text-neutral-300 leading-relaxed italic">
                      "{incident.aiExplanation}"
                    </p>
                  </div>
                )}
                
                <div className="mt-3 text-sm text-neutral-400 flex items-center gap-4">
                   <span>Action: <span className="text-emerald-400">{incident.recommendedAction}</span></span>
                   <span>Policy: {incident.policyDecision}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-neutral-500">
            No active early warnings. System is operating normally.
          </div>
        )}
      </div>

      {/* What-If Simulator */}
      <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Zap className="text-purple-400" size={20} />
          What-If Simulator
        </h3>
        <p className="text-sm text-neutral-400 mb-6">Test how the routing engine and predictive logic will react to simulated infrastructure conditions.</p>
        
        <div className="flex flex-col md:flex-row gap-6">
           <div className="flex-1 space-y-4">
              <label className="block text-sm font-medium text-neutral-300">Failure Scenario</label>
              <select 
                 value={simulatorScenario}
                 onChange={(e) => setSimulatorScenario(e.target.value)}
                 className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                 <option value="LATENCY_SPIKE">RPC Latency Spike (3000ms+)</option>
                 <option value="PROVIDER_FAILURE">Complete Provider Timeout</option>
              </select>
              
              <button 
                 onClick={runSimulation}
                 disabled={simulating}
                 className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                 {simulating ? 'Simulating...' : 'Run Scenario Simulation'}
              </button>
           </div>
           
           <div className="flex-1">
              {simulationResult ? (
                 <div className="p-4 bg-neutral-950 border border-purple-500/30 rounded-xl h-full space-y-4">
                    <h4 className="text-purple-400 font-medium mb-2">Simulated Outcome</h4>
                    <div className="space-y-2">
                       <p className="flex justify-between text-sm">
                          <span className="text-neutral-400">Predicted Reliability:</span>
                          <span className="text-white font-medium">{simulationResult.predictedReliability}/100</span>
                       </p>
                       <p className="flex justify-between text-sm">
                          <span className="text-neutral-400">Expected Delay:</span>
                          <span className="text-white font-medium">{simulationResult.expectedDelay}</span>
                       </p>
                       <p className="flex justify-between text-sm">
                          <span className="text-neutral-400">Recommended Route:</span>
                          <span className="text-emerald-400 font-medium">{simulationResult.recommendedRoute}</span>
                       </p>
                    </div>
                    <div className="pt-2 border-t border-white/10">
                       <p className="text-xs text-neutral-400">
                          The predictive policy engine would autonomously shift {simulationResult.affectedTraffic} of traffic to {simulationResult.recommendedRoute} to evade failure.
                       </p>
                    </div>
                 </div>
              ) : (
                 <div className="h-full flex items-center justify-center p-6 border border-dashed border-white/10 rounded-xl text-neutral-500 text-sm text-center">
                    Select a scenario and click run to view the AI predictive routing response.
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}

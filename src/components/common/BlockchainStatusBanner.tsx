'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface HealthResponse {
  success: boolean;
  isOperational: boolean;
  healthyCount: number;
  totalConfigured: number;
  providers?: Array<{
    name: string;
    status: string;
    latencyMs: number;
    lastError: string | null;
  }>;
}

export function BlockchainStatusBanner() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      const res = await fetch('/api/blockchain/providers/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch {
      // Non-fatal
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  if (!health) return null;

  const isDegradedOrUnavailable = !health.isOperational || health.healthyCount === 0;

  if (!isDegradedOrUnavailable) {
    return null; // Don't clutter UI when all nodes are healthy
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-200 backdrop-blur-md transition-all animate-in fade-in duration-300"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
          </span>
          <span className="font-semibold text-amber-300">
            Blockchain service unavailable — payments requiring blockchain confirmation are temporarily queued.
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-neutral-400">
          <span className="font-mono bg-black/40 px-2 py-0.5 rounded border border-white/5">
            DURABLE QUEUE ACTIVE
          </span>
          <button
            onClick={checkHealth}
            disabled={isChecking}
            className="hover:text-amber-200 transition-colors flex items-center gap-1 text-amber-400/80 hover:text-amber-300"
            title="Retry node health check"
          >
            <RefreshCw size={12} className={isChecking ? 'animate-spin' : ''} />
            <span>Check</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hover:text-white transition-colors flex items-center gap-0.5"
          >
            <span>{isExpanded ? 'Hide Details' : 'Details'}</span>
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {isExpanded && health.providers && (
        <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-amber-500/10 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
          {health.providers.map((p, idx) => (
            <div key={idx} className="bg-black/40 p-2 rounded border border-white/5 space-y-0.5">
              <div className="flex items-center justify-between font-medium">
                <span className="text-white">{p.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                    p.status === 'HEALTHY'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : p.status === 'DEGRADED'
                      ? 'bg-yellow-500/20 text-yellow-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {p.status}
                </span>
              </div>
              <p className="text-neutral-400 text-[10px] truncate">{p.lastError || `${p.latencyMs}ms latency`}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

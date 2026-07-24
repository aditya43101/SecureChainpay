"use client";

import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

const mockTpsData = [
  { time: '00:00', tps: 120 },
  { time: '04:00', tps: 200 },
  { time: '08:00', tps: 150 },
  { time: '12:00', tps: 300 },
  { time: '16:00', tps: 250 },
  { time: '20:00', tps: 180 },
  { time: '24:00', tps: 220 },
];

const mockNodeData = [
  { name: 'US-East', status: 100 },
  { name: 'US-West', status: 100 },
  { name: 'EU-Central', status: 95 },
  { name: 'AP-South', status: 99 },
];

export function ExtendedKPIs() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
     
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* TPS Widget */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 col-span-1 md:col-span-2">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Transactions Per Second (TPS)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockTpsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                itemStyle={{ color: '#38bdf8' }}
              />
              <Line type="monotone" dataKey="tps" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Node Status Widget */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 col-span-1 md:col-span-2">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Node Health (%)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockNodeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                cursor={{ fill: '#334155', opacity: 0.2 }}
              />
              <Bar dataKey="status" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Average Tx Value */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-xl shadow-sm text-white col-span-1 md:col-span-2 lg:col-span-2">
        <h3 className="text-lg font-medium opacity-90 mb-2">Average Tx Value</h3>
        <div className="text-4xl font-bold mb-2">$4,250.00</div>
        <div className="text-sm opacity-80 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          +12.5% from last week
        </div>
      </div>

      {/* Network Uptime */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 col-span-1 md:col-span-2 lg:col-span-2">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Network Uptime</h3>
        <div className="text-4xl font-bold text-emerald-500 mb-2">99.99%</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Last downtime: 45 days ago</div>
      </div>
    </div>
  );
}

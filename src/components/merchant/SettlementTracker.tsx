'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCcw, CheckCircle2, Clock, ArrowRight, Building } from 'lucide-react';

const settlements = [
  {
    id: 'SET-9823',
    amount: 12500.00,
    currency: 'USD',
    method: 'Wire Transfer',
    bank: 'JPMorgan Chase',
    status: 'Completed',
    date: 'Today, 09:30 AM',
    txHash: '0x8f...3a9c'
  },
  {
    id: 'SET-9824',
    amount: 8450.50,
    currency: 'EUR',
    method: 'SEPA',
    bank: 'Deutsche Bank',
    status: 'Processing',
    date: 'Today, 11:15 AM',
    txHash: '0x2b...1f4e'
  },
  {
    id: 'SET-9825',
    amount: 3200.00,
    currency: 'GBP',
    method: 'BACS',
    bank: 'Barclays',
    status: 'Pending',
    date: 'Est. Tomorrow',
    txHash: '0x9a...7d2b'
  }
];

export default function SettlementTracker() {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 lg:p-8 shadow-2xl relative overflow-hidden group h-full flex flex-col">
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-700 pointer-events-none"></div>
      
      <div className="flex justify-between items-center mb-8 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <RefreshCcw className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Fiat Settlements</h2>
            <p className="text-sm text-gray-400">Crypto to Fiat conversion tracking</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-1">Next Auto-Settlement</p>
          <p className="text-sm font-medium text-white flex items-center justify-end gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" /> 14h 22m
          </p>
        </div>
      </div>

      <div className="space-y-4 flex-grow relative z-10">
        {settlements.map((settlement, index) => (
          <motion.div
            key={settlement.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.15 }}
            className="p-4 bg-black/20 border border-white/5 hover:border-white/10 rounded-2xl transition-colors"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white">{settlement.id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 ${
                    settlement.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' :
                    settlement.status === 'Processing' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    {settlement.status === 'Completed' && <CheckCircle2 className="w-3 h-3" />}
                    {settlement.status === 'Processing' && <RefreshCcw className="w-3 h-3 animate-spin-slow" />}
                    {settlement.status === 'Pending' && <Clock className="w-3 h-3" />}
                    {settlement.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{settlement.date}</p>
              </div>
              <div className="text-right">
                <h3 className="text-lg font-bold text-white">
                  {settlement.currency === 'USD' ? '$' : settlement.currency === 'EUR' ? '€' : '£'}
                  {settlement.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-3 border-t border-white/5">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Building className="w-3.5 h-3.5" />
                <span>{settlement.bank}</span>
                <span className="mx-1">•</span>
                <span>{settlement.method}</span>
              </div>
              <button className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                Details <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <button className="w-full mt-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-medium transition-all relative z-10 flex items-center justify-center gap-2">
        View All Settlements
      </button>
    </div>
  );
}

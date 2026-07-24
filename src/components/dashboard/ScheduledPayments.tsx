'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, ArrowUpRight, ArrowDownRight, MoreHorizontal } from 'lucide-react';

const scheduledPayments = [
  {
    id: 1,
    recipient: 'Cloud Hosting Services',
    amount: 150.00,
    currency: 'USDC',
    date: '2026-07-20',
    frequency: 'Monthly',
    status: 'Upcoming',
    type: 'outgoing'
  },
  {
    id: 2,
    recipient: 'Freelance Design',
    amount: 850.50,
    currency: 'USDT',
    date: '2026-07-22',
    frequency: 'One-time',
    status: 'Processing',
    type: 'outgoing'
  },
  {
    id: 3,
    recipient: 'Staking Rewards',
    amount: 45.20,
    currency: 'ETH',
    date: '2026-07-25',
    frequency: 'Weekly',
    status: 'Upcoming',
    type: 'incoming'
  }
];

export default function ScheduledPayments() {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
      
      <div className="flex justify-between items-center mb-6 relative z-10">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Scheduled Payments</h2>
          <p className="text-sm text-gray-400">Manage your recurring and upcoming transfers</p>
        </div>
        <button className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-white">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4 relative z-10">
        {scheduledPayments.map((payment, index) => (
          <motion.div
            key={payment.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            className="group/item flex items-center justify-between p-4 bg-black/20 border border-white/5 hover:border-indigo-500/30 rounded-2xl transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl flex items-center justify-center ${payment.type === 'incoming' ? 'bg-green-500/20 text-green-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                {payment.type === 'incoming' ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-semibold text-white">{payment.recipient}</h3>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {payment.frequency}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`font-bold ${payment.type === 'incoming' ? 'text-green-400' : 'text-white'}`}>
                {payment.type === 'incoming' ? '+' : '-'}{payment.amount.toFixed(2)} <span className="text-xs font-normal text-gray-400">{payment.currency}</span>
              </div>
              <div className="text-xs mt-1">
                <span className={`px-2 py-0.5 rounded-full ${
                  payment.status === 'Upcoming' ? 'bg-blue-500/20 text-blue-400' : 
                  'bg-amber-500/20 text-amber-400'
                }`}>
                  {payment.status}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      <button className="w-full mt-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25 relative z-10 flex items-center justify-center gap-2">
        <Calendar className="w-4 h-4" />
        Schedule New Payment
      </button>
    </div>
  );
}

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, ShoppingCart, Users, Activity } from 'lucide-react';
import InvoiceGenerator from '@/components/merchant/InvoiceGenerator';
import SettlementTracker from '@/components/merchant/SettlementTracker';

export default function MerchantDashboard() {
  const stats = [
    { title: 'Total Revenue', value: '$124,563.00', change: '+14.5%', icon: <DollarSign className="w-6 h-6" />, color: 'from-emerald-400 to-teal-500' },
    { title: 'Transactions', value: '1,432', change: '+8.2%', icon: <ShoppingCart className="w-6 h-6" />, color: 'from-blue-400 to-indigo-500' },
    { title: 'Active Customers', value: '892', change: '+12.4%', icon: <Users className="w-6 h-6" />, color: 'from-purple-400 to-pink-500' },
    { title: 'Conversion Rate', value: '3.4%', change: '-1.2%', icon: <Activity className="w-6 h-6" />, color: 'from-amber-400 to-orange-500' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-10 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Merchant Overview
            </h1>
            <p className="text-gray-400 mt-2">Manage your business, invoices, and settlements.</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium transition-all">
              Download Report
            </button>
            <button className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25">
              New Payment Link
            </button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 relative overflow-hidden group hover:border-white/20 transition-all duration-300"
            >
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity duration-500 -mr-10 -mt-10 pointer-events-none`}></div>
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className={`p-3 rounded-2xl bg-gradient-to-br ${stat.color} bg-opacity-20 backdrop-blur-md border border-white/10 text-white`}>
                  {stat.icon}
                </div>
                <div className={`text-sm font-medium px-2.5 py-1 rounded-full ${
                  stat.change.startsWith('+') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {stat.change}
                </div>
              </div>
              
              <div className="relative z-10">
                <p className="text-sm text-gray-400 font-medium mb-1">{stat.title}</p>
                <h3 className="text-2xl font-bold text-white">{stat.value}</h3>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <InvoiceGenerator />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <SettlementTracker />
          </motion.div>
        </div>
        
      </div>
    </div>
  );
}

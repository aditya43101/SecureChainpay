'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Target, TrendingUp, Award } from 'lucide-react';

const goals = [
  {
    id: 1,
    name: 'New MacBook Pro',
    target: 3000,
    current: 1850,
    currency: 'USDC',
    color: 'from-blue-500 to-indigo-500',
    icon: <Target className="w-5 h-5 text-blue-400" />
  },
  {
    id: 2,
    name: 'Vacation Fund',
    target: 5000,
    current: 4200,
    currency: 'USDT',
    color: 'from-emerald-400 to-teal-500',
    icon: <TrendingUp className="w-5 h-5 text-emerald-400" />
  },
  {
    id: 3,
    name: 'Emergency Reserve',
    target: 10000,
    current: 2500,
    currency: 'DAI',
    color: 'from-purple-500 to-pink-500',
    icon: <Award className="w-5 h-5 text-purple-400" />
  }
];

export default function SavingsGoals() {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/30 transition-all duration-700 pointer-events-none"></div>
      
      <div className="mb-6 relative z-10">
        <h2 className="text-xl font-bold text-white mb-1">Savings Goals</h2>
        <p className="text-sm text-gray-400">Track your progress towards financial targets</p>
      </div>

      <div className="space-y-6 relative z-10">
        {goals.map((goal, index) => {
          const progress = (goal.current / goal.target) * 100;
          return (
            <div key={goal.id} className="bg-black/20 border border-white/5 rounded-2xl p-4 hover:bg-black/30 transition-colors">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    {goal.icon}
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{goal.name}</h3>
                    <p className="text-xs text-gray-400">
                      {goal.current.toLocaleString()} / {goal.target.toLocaleString()} {goal.currency}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white">{progress.toFixed(1)}%</div>
                </div>
              </div>
              
              <div className="h-2 w-full bg-gray-800/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ delay: index * 0.2 + 0.5, duration: 1, ease: "easeOut" }}
                  className={`h-full bg-gradient-to-r ${goal.color} rounded-full relative`}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </motion.div>
              </div>
            </div>
          );
        })}
      </div>
      
      <button className="w-full mt-6 py-3 border border-white/10 hover:bg-white/5 text-white rounded-xl font-medium transition-all relative z-10 flex items-center justify-center gap-2">
        <span>+ Create New Goal</span>
      </button>
    </div>
  );
}

import React from 'react';

const stats = [
  { name: 'Total Users', value: '12,345', change: '+12%', changeType: 'positive' },
  { name: 'Active Wallets', value: '8,234', change: '+5.4%', changeType: 'positive' },
  { name: 'Total Volume', value: '$45.2M', change: '+23%', changeType: 'positive' },
  { name: 'Failed TXs', value: '23', change: '-2%', changeType: 'negative' },
];

export function AdminStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <div
          key={stat.name}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">{stat.name}</h3>
            <span
              className={`inline-flex items-baseline px-2.5 py-0.5 rounded-full text-sm font-medium md:mt-2 lg:mt-0 ${
                stat.changeType === 'positive'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {stat.change}
            </span>
          </div>
          <div className="mt-4 flex items-baseline">
            <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

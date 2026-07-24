import React from 'react';
import { AdminStats } from '@/components/admin/AdminStats';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor your platform's key metrics and recent activity.
        </p>
      </div>

      <AdminStats />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions placeholder */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h2>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                    <span className="text-green-600 text-sm font-medium">TX</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Transfer to 0x{i}abc...def</p>
                    <p className="text-xs text-gray-500">2 mins ago</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">+ {(Math.random() * 10).toFixed(2)} ETH</p>
                  <p className="text-xs text-green-600">Completed</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Status placeholder */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Mainnet Node</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Payment Gateway</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">API Services</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Operational
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

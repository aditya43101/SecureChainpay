import React from 'react';

// Mock data for audit logs
const MOCK_AUDIT_LOGS = [
  { id: 'AL-1001', user: 'admin@securechain.com', action: 'Update Node Config', ip: '192.168.1.105', timestamp: '2026-07-15T14:30:00Z', status: 'Success' },
  { id: 'AL-1002', user: 'system_indexer', action: 'Sync Block #145293', ip: '10.0.0.12', timestamp: '2026-07-15T14:28:15Z', status: 'Success' },
  { id: 'AL-1003', user: 'support@securechain.com', action: 'Reset User Password', ip: '203.0.113.45', timestamp: '2026-07-15T13:15:22Z', status: 'Warning' },
  { id: 'AL-1004', user: 'unknown', action: 'Failed Login Attempt', ip: '198.51.100.22', timestamp: '2026-07-15T12:05:10Z', status: 'Error' },
  { id: 'AL-1005', user: 'admin@securechain.com', action: 'Deploy Smart Contract v2', ip: '192.168.1.105', timestamp: '2026-07-15T10:00:00Z', status: 'Success' },
];

export default function AuditLogsPage() {
  const getStatusClass = (status: string) => {
    if (status === 'Success') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (status === 'Warning') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">System Audit Logs</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Monitor administrative actions and system events.</p>
        </div>
        <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
          Export CSV
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex gap-4">
          <input 
            type="text" 
            placeholder="Search by ID, User, or Action..." 
            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option>All Statuses</option>
            <option>Success</option>
            <option>Warning</option>
            <option>Error</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Log ID</th>
                <th className="px-6 py-4">User / Actor</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">IP Address</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {MOCK_AUDIT_LOGS.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs">{log.id}</td>
                  <td className="px-6 py-4 font-medium">{log.user}</td>
                  <td className="px-6 py-4">{log.action}</td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{log.ip}</td>
                  <td className="px-6 py-4 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={"px-2.5 py-1 rounded-full text-xs font-medium " + getStatusClass(log.status)}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm text-slate-500">
          <span>Showing 1 to 5 of 1,245 entries</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800">1</button>
            <button className="px-3 py-1 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800">2</button>
            <button className="px-3 py-1 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

const MOCK_BLOCKS = [
  { height: 145293, hash: '0x1a2b...3c4d', validator: 'Node_US_East', txns: 124, gasUsed: '1.2M', time: '12 secs ago' },
  { height: 145292, hash: '0x5e6f...7g8h', validator: 'Node_EU_Cent', txns: 89, gasUsed: '0.8M', time: '24 secs ago' },
  { height: 145291, hash: '0x9i0j...1k2l', validator: 'Node_AP_South', txns: 210, gasUsed: '2.1M', time: '36 secs ago' },
  { height: 145290, hash: '0x3m4n...5o6p', validator: 'Node_US_West', txns: 156, gasUsed: '1.5M', time: '48 secs ago' },
];

export default function ExplorerPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">SecureChain Explorer</h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
            Real-time blockchain ledger explorer. Search blocks, transactions, and addresses.
          </p>
          <div className="mt-8 max-w-3xl mx-auto relative">
            <input 
              type="text" 
              placeholder="Search by Block Height, Tx Hash, or Address..."
              className="w-full pl-6 pr-16 py-4 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-lg focus:outline-none focus:border-indigo-500 text-lg dark:text-white transition-colors"
            />
            <button className="absolute right-3 top-3 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
          </div>
        </div>

        {/* Network Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-center">
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Chain ID</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">SC-MAIN-01</div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-center">
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Latest Block</div>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">145,293</div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-center">
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Active Validators</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">42 / 50</div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-center">
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Avg Gas Price</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">12 Gwei</div>
          </div>
        </div>

        {/* Recent Blocks Table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Latest Blocks</h2>
            <button className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline">View All Blocks &rarr;</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Block Height</th>
                  <th className="px-6 py-4 font-medium">Hash</th>
                  <th className="px-6 py-4 font-medium">Validator</th>
                  <th className="px-6 py-4 font-medium">Txns</th>
                  <th className="px-6 py-4 font-medium">Gas Used</th>
                  <th className="px-6 py-4 font-medium">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {MOCK_BLOCKS.map((block) => (
                  <tr key={block.height} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400">#{block.height}</td>
                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">{block.hash}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                        {block.validator}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-900 dark:text-slate-100 font-medium">{block.txns}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{block.gasUsed}</td>
                    <td className="px-6 py-4 text-slate-500">{block.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

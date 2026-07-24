import React from 'react';
import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <Link href="/dashboard" className="text-xl font-bold text-indigo-600">
            SecureChain Admin
          </Link>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <Link
            href="/dashboard"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard/users"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Users
          </Link>
          <Link
            href="/dashboard/transactions"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Transactions
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Settings
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="md:hidden">
            <span className="text-lg font-bold text-indigo-600">Admin</span>
          </div>
          <div className="flex items-center space-x-4 ml-auto">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium">
              A
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

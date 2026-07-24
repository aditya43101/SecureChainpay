'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Download, Plus, Trash2, Send } from 'lucide-react';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  price: number;
}

export default function InvoiceGenerator() {
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', description: 'Premium Subscription', quantity: 1, price: 99.00 }
  ]);
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '' });
  
  const gstRate = 0.18; // 18% GST

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), description: '', quantity: 1, price: 0 }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const gstAmount = subtotal * gstRate;
  const total = subtotal + gstAmount;

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 lg:p-8 shadow-2xl relative overflow-hidden group h-full flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
      
      <div className="flex justify-between items-center mb-8 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Invoice Generator</h2>
            <p className="text-sm text-gray-400">Create & send GST compliant invoices</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 flex-grow relative z-10">
        {/* Customer Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Customer Name</label>
            <input 
              type="text" 
              placeholder="Acme Corp" 
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
              value={customerInfo.name}
              onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Email Address</label>
            <input 
              type="email" 
              placeholder="billing@acme.com" 
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
              value={customerInfo.email}
              onChange={e => setCustomerInfo({...customerInfo, email: e.target.value})}
            />
          </div>
        </div>

        {/* Invoice Items */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-gray-300">Line Items</label>
            <button onClick={addItem} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
              <Plus className="w-3 h-3" /> Add Item
            </button>
          </div>
          
          <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            <AnimatePresence>
              {items.map((item) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex gap-3 items-start"
                >
                  <div className="flex-grow">
                    <input 
                      type="text" 
                      placeholder="Description" 
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    />
                  </div>
                  <div className="w-20">
                    <input 
                      type="number" 
                      min="1"
                      placeholder="Qty" 
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                      value={item.quantity || ''}
                      onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="w-24">
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      placeholder="Price" 
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                      value={item.price || ''}
                      onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <button 
                    onClick={() => removeItem(item.id)}
                    className="p-2.5 text-gray-500 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-xl transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Totals */}
        <div className="border-t border-white/10 pt-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>GST (18%)</span>
            <span>${gstAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-white/5">
            <span>Total</span>
            <span className="text-indigo-400">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 mt-8 relative z-10">
        <button className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 group/btn">
          <Download className="w-4 h-4 text-gray-400 group-hover/btn:text-white transition-colors" />
          Download PDF
        </button>
        <button className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2">
          <Send className="w-4 h-4" />
          Send Invoice
        </button>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}

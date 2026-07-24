'use client';

import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';
import Link from 'next/link';
import CryptoJS from 'crypto-js';

// We need user context to pass userId, assuming there's an auth store or we get it from an API.
// For now, let's use a dummy userId if we can't find one, or we can fetch the user.
import { useAuthStore } from '@/stores/auth-store';

const PRESET_AMOUNTS = [50, 100, 500, 1000];

export default function AddMoneyPage() {
  const { user } = useAuthStore();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'add' | 'withdraw'>('add');
  
  const [amount, setAmount] = useState<string>('100');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // State for Mock Dialog
  const [showMockDialog, setShowMockDialog] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);

  useEffect(() => {
    // Sync login state properly using Firebase onAuthStateChanged
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setCurrentUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  const handleAction = async () => {
    setIsProcessing(true);
    try {
      if (activeTab === 'add') {
        // 1. Create Order via Backend for Add Money
        const res = await fetch('/api/wallet/topup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'CREATE_ORDER',
            amount: Number(amount),
            currency: 'USD'
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create order');

        setCurrentOrder(data.order);
        setShowMockDialog(true);
      } else {
        // Withdraw Mock
        setTimeout(() => {
          setIsProcessing(false);
          setIsSuccess(true);
        }, 1000);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to initiate action.');
      setIsProcessing(false);
    }
  };

  const handleSimulatePayment = async (success: boolean) => {
    setShowMockDialog(false);
    
    if (!success) {
      alert('Payment was cancelled or failed.');
      return;
    }

    setIsProcessing(true);
    try {
      const mockPaymentId = `pay_mock_${Math.random().toString(36).substring(2, 10)}`;
      const mockSecret = 'mock_secret_123'; 
      const signaturePayload = currentOrder.id + "|" + mockPaymentId;
      const signature = CryptoJS.HmacSHA256(signaturePayload, mockSecret).toString(CryptoJS.enc.Hex);

      const verifyRes = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VERIFY_PAYMENT',
          userId: currentUser?.uid || user?.id || 'demo-user-id',
          orderId: currentOrder.id,
          paymentId: mockPaymentId,
          signature: signature,
          amount: Number(amount),
          currency: 'USD'
        })
      });

      const verifyData = await verifyRes.json();
      
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || 'Payment verification failed');
      }

      setIsSuccess(true);
    } catch (error: any) {
      console.error('Payment Error:', error);
      alert(`Payment Failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 font-sans flex flex-col items-center justify-center relative">
      <div className="w-full max-w-xl">
        <Link href="/wallet" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Wallet
        </Link>

        <div className="bg-gray-950/80 backdrop-blur-2xl border border-gray-800/80 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

          {isSuccess ? (
            <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-6 py-10 animate-in fade-in zoom-in duration-500">
              <div className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Success!</h2>
                <p className="text-gray-400 text-lg">
                  Mock ${amount} {activeTab === 'add' ? 'added successfully to' : 'withdrawn successfully from'} wallet!
                </p>
              </div>
              <button onClick={() => { setIsSuccess(false); setAmount('100'); }} className="mt-8 px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors w-full">
                Do another transaction
              </button>
            </div>
          ) : (
            <div className="relative z-10 space-y-8">
              
              {/* Tabs */}
              <div className="flex p-1 bg-black/40 rounded-xl relative z-10 border border-white/5">
                <button 
                  onClick={() => setActiveTab('add')}
                  className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${activeTab === 'add' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Add Money
                </button>
                <button 
                  onClick={() => setActiveTab('withdraw')}
                  className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${activeTab === 'withdraw' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Withdraw Money
                </button>
              </div>

              <div className="text-center">
                <h1 className="text-3xl font-extrabold text-white mb-2">
                  {activeTab === 'add' ? 'Add Money' : 'Withdraw Money'}
                </h1>
                <p className="text-gray-400">
                  {activeTab === 'add' 
                    ? 'Top up your SecureChain wallet securely via Mock Gateway.' 
                    : 'Withdraw funds from your SecureChain wallet to your bank.'}
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Enter Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl text-gray-500 font-bold">$</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 text-white text-4xl font-black py-6 pl-14 pr-6 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-center"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {PRESET_AMOUNTS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setAmount(preset.toString())}
                      className={`py-3 rounded-xl font-medium border transition-all ${
                        amount === preset.toString()
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800 hover:border-gray-700'
                      }`}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 space-y-4 border-t border-gray-800/80">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Amount</span>
                  <span className="text-white font-medium">${Number(amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Processing Fee</span>
                  <span className="text-emerald-400 font-medium">Free</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-white">Total {activeTab === 'add' ? 'to Pay' : 'to Withdraw'}</span>
                  <span className="text-white">${Number(amount || 0).toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleAction}
                disabled={!amount || Number(amount) <= 0 || isProcessing || !currentUser}
                className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-lg shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-3 mt-4"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    {activeTab === 'add' ? 'Proceed to Pay' : 'Confirm Withdrawal'} ${Number(amount || 0).toFixed(2)}
                  </>
                )}
              </button>
              
              {!currentUser && (
                <div className="text-red-400 text-sm text-center">
                  Authentication required to {activeTab === 'add' ? 'add' : 'withdraw'} money. Please log in first.
                </div>
              )}
              
              <div className="flex justify-center items-center gap-2 text-gray-500 text-sm mt-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Secured by SecureChain Pay Mock Gateway
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mock Payment Gateway Dialog (Add Money only) */}
      {showMockDialog && currentOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white text-black w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-blue-600 p-6 flex flex-col items-center justify-center text-white">
              <h2 className="text-2xl font-black mb-1">Razorpay (Mock)</h2>
              <p className="text-blue-100 text-sm opacity-80">Test Environment</p>
            </div>
            
            <div className="p-6 flex flex-col items-center space-y-6">
              <div className="text-center">
                <p className="text-gray-500 text-sm mb-1">Amount Payable</p>
                <h3 className="text-3xl font-bold">${Number(amount).toFixed(2)}</h3>
              </div>
              
              <div className="w-full space-y-3">
                <button 
                  onClick={() => handleSimulatePayment(true)}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors shadow-md"
                >
                  Simulate Success
                </button>
                <button 
                  onClick={() => handleSimulatePayment(false)}
                  className="w-full py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold transition-colors"
                >
                  Simulate Failure
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/stores/wallet-store';

type CryptoAsset = 'BTC' | 'ETH';

export default function TradePage() {
  const { balances, executeTransaction } = useWalletStore();
  const [prices, setPrices] = useState({ BTC: 0, ETH: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<CryptoAsset>('BTC');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  // Fetch prices from CoinGecko
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
        const data = await res.json();
        setPrices({
          BTC: data.bitcoin.usd,
          ETH: data.ethereum.usd
        });
      } catch (err) {
        console.error('Failed to fetch prices', err);
        // Fallback simulated prices if API fails or is rate-limited
        setPrices({ BTC: 64230.50, ETH: 3450.20 });
      } finally {
        setLoading(false);
      }
    };
    
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const price = prices[selectedAsset];
    const totalUsd = numAmount * price;

    if (tradeType === 'buy') {
      if (balances.USD < totalUsd) {
        setError('Insufficient USD balance');
        return;
      }
      try {
        await executeTransaction(
          'trade',
          totalUsd,
          'USD',
          `Bought ${numAmount} ${selectedAsset} for $${totalUsd.toFixed(2)}`,
          { tradeAsset: selectedAsset, tradeAmount: numAmount }
        );
      } catch (err: any) {
        setError(err.message || 'Transaction failed');
        return;
      }
    } else {
      if (balances[selectedAsset] < numAmount) {
        setError(`Insufficient ${selectedAsset} balance`);
        return;
      }
      try {
        await executeTransaction(
          'trade',
          numAmount,
          selectedAsset,
          `Sold ${numAmount} ${selectedAsset} for $${totalUsd.toFixed(2)}`,
          { tradeAsset: 'USD', tradeAmount: totalUsd }
        );
      } catch (err: any) {
        setError(err.message || 'Transaction failed');
        return;
      }
    }

    setAmount('');
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500 mb-2">
            Trade Crypto
          </h1>
          <p className="text-gray-400">Buy and sell cryptocurrency at real-time market prices.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Market Prices */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">Market Prices</h2>
            {loading ? (
              <p className="text-gray-400 animate-pulse">Loading prices...</p>
            ) : (
              <div className="space-y-4">
                <div onClick={() => setSelectedAsset('BTC')} className={`p-4 rounded-xl cursor-pointer transition-colors border ${selectedAsset === 'BTC' ? 'border-orange-500 bg-orange-500/10' : 'border-gray-800 hover:bg-gray-800'}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_currentColor]"></div>
                      <span className="font-semibold text-lg">Bitcoin (BTC)</span>
                    </div>
                    <span className="font-mono text-lg">${prices.BTC.toLocaleString()}</span>
                  </div>
                </div>
                <div onClick={() => setSelectedAsset('ETH')} className={`p-4 rounded-xl cursor-pointer transition-colors border ${selectedAsset === 'ETH' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 hover:bg-gray-800'}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_currentColor]"></div>
                      <span className="font-semibold text-lg">Ethereum (ETH)</span>
                    </div>
                    <span className="font-mono text-lg">${prices.ETH.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Trade Form */}
          <div className="bg-gray-950/80 backdrop-blur border border-gray-800 rounded-2xl p-6">
            <div className="flex bg-gray-900 rounded-lg p-1 mb-6">
              <button 
                onClick={() => setTradeType('buy')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${tradeType === 'buy' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Buy
              </button>
              <button 
                onClick={() => setTradeType('sell')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${tradeType === 'sell' ? 'bg-rose-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Sell
              </button>
            </div>

            <form onSubmit={handleTrade} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Amount in {selectedAsset}
                </label>
                <div className="relative">
                  <input 
                    type="number"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">
                    {selectedAsset}
                  </span>
                </div>
              </div>

              {amount && !isNaN(parseFloat(amount)) && (
                <div className="p-4 bg-gray-900 rounded-xl flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Estimated Total</span>
                  <span className="font-mono font-semibold">${(parseFloat(amount) * prices[selectedAsset]).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}</span>
                </div>
              )}

              {error && <div className="text-rose-500 text-sm font-medium">{error}</div>}

              <button 
                type="submit" 
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                  tradeType === 'buy' 
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(5,150,105,0.4)]'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.4)]'
                }`}
              >
                {tradeType === 'buy' ? 'Buy' : 'Sell'} {selectedAsset}
              </button>
            </form>
            
            <div className="mt-4 pt-4 border-t border-gray-800 text-sm text-gray-500 flex justify-between">
              <span>Available {selectedAsset}: {balances[selectedAsset]}</span>
              <span>Available USD: ${balances.USD.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

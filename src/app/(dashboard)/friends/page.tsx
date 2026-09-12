'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  Search,
  Send,
  Trash2,
  Check,
  Copy,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Star,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';
import { auth } from '@/lib/firebase/client';
import { FriendRecord } from '@/app/api/friends/route';
import { UserSuggestion } from '@/app/api/users/suggestions/route';

export default function FriendsPage() {
  const router = useRouter();
  const authStoreUser = useAuthStore((state) => state.user);
  const walletOwnerUid = useWalletStore((state) => state.ownerUid);

  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search & Add state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [addingFriendUid, setAddingFriendUid] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Helper to resolve current UID
  const getActiveUid = useCallback(() => {
    return (
      auth.currentUser?.uid ||
      authStoreUser?.id ||
      walletOwnerUid ||
      (typeof window !== 'undefined' ? localStorage.getItem('securechain_uid') : null) ||
      ''
    );
  }, [authStoreUser?.id, walletOwnerUid]);

  // Helper to get auth headers
  const getAuthHeaders = useCallback(async () => {
    const uid = getActiveUid();
    let token: string | null = null;
    try {
      token = (await auth.currentUser?.getIdToken()) || null;
    } catch {
      // ignore token read failures
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (uid) headers['x-user-id'] = uid;

    return headers;
  }, [getActiveUid]);

  // Fetch Friends List
  const fetchFriends = useCallback(async () => {
    setIsLoadingFriends(true);
    try {
      const headers = await getAuthHeaders();
      const uid = getActiveUid();

      const res = await fetch(`/api/friends${uid ? `?userId=${encodeURIComponent(uid)}` : ''}`, {
        headers,
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.friends)) {
        setFriends(data.friends);
      }
    } catch (err: any) {
      console.warn('Fetch friends warning:', err);
    } finally {
      setIsLoadingFriends(false);
    }
  }, [getAuthHeaders, getActiveUid]);

  // Fetch Friend Suggestions (All platform users)
  const fetchSuggestions = useCallback(async () => {
    setIsLoadingSuggestions(true);
    try {
      const headers = await getAuthHeaders();
      const uid = getActiveUid();

      const res = await fetch(
        `/api/users/suggestions${uid ? `?currentUid=${encodeURIComponent(uid)}` : ''}`,
        { headers }
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.warn('Fetch suggestions warning:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [getAuthHeaders, getActiveUid]);

  // Initial load and sync on Firebase Auth state changes
  useEffect(() => {
    fetchFriends();
    fetchSuggestions();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        fetchFriends();
        fetchSuggestions();
      }
    });

    return () => unsubscribe();
  }, [fetchFriends, fetchSuggestions]);

  // Live User Search for Adding
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const uid = getActiveUid();
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(query)}&currentUid=${encodeURIComponent(uid)}`
        );
        const data = await res.json();
        if (data.success && Array.isArray(data.results)) {
          setSearchResults(data.results);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, getActiveUid]);

  // Add Friend Handler
  const handleAddFriend = async (targetUser: {
    uid: string;
    username: string;
    displayName?: string;
    walletAddress: string;
  }) => {
    const targetUid = targetUser.uid;
    setAddingFriendUid(targetUid);
    setError(null);
    setSuccess(null);

    try {
      const headers = await getAuthHeaders();
      const currentUid = getActiveUid();

      const res = await fetch('/api/friends', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          friendUid: targetUid,
          username: targetUser.username,
          walletAddress: targetUser.walletAddress,
          currentUid,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(`Added @${data.friend?.username || targetUser.username} to your friends!`);
        setSearchQuery('');
        setSearchResults([]);

        // Optimistically add to local friends list
        setFriends((prev) => {
          if (prev.some((f) => f.friendUid === targetUid)) return prev;
          return [
            {
              friendUid: targetUid,
              username: targetUser.username,
              displayName: targetUser.displayName || targetUser.username,
              walletAddress: targetUser.walletAddress,
              addedAt: new Date().toISOString(),
            },
            ...prev,
          ];
        });

        await fetchFriends();
        setTimeout(() => setSuccess(null), 4000);
      } else {
        setError(data.error || 'Failed to add friend');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add friend');
    } finally {
      setAddingFriendUid(null);
    }
  };

  // Remove Friend Handler
  const handleRemoveFriend = async (friendUid: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from friends?`)) return;

    try {
      const headers = await getAuthHeaders();
      const currentUid = getActiveUid();

      const res = await fetch(
        `/api/friends?friendUid=${encodeURIComponent(friendUid)}&currentUid=${encodeURIComponent(
          currentUid
        )}`,
        {
          method: 'DELETE',
          headers,
        }
      );

      const data = await res.json();
      if (data.success) {
        setFriends((prev) => prev.filter((f) => f.friendUid !== friendUid));
        setSuccess(`Removed ${name} from friends.`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to remove friend');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove friend');
    }
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const isFriend = (uid: string, username: string) => {
    return friends.some(
      (f) =>
        f.friendUid === uid ||
        f.username?.toLowerCase() === username?.toLowerCase()
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-300 pb-32 md:pb-12 text-white px-2 sm:px-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#FEEF8B]/10 border border-[#FEEF8B]/20 text-[#FEEF8B]">
              <Users className="h-6 w-6" />
            </span>
            Friends & P2P Contacts
          </h1>
          <p className="text-neutral-400 text-xs sm:text-sm mt-1">
            Send instant zero-gas payments to friends with Priority #1 sub-second execution.
          </p>
        </div>

        <Link
          href="/wallet/transfer"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#FEEF8B] hover:bg-[#FEF08A] text-neutral-950 font-extrabold rounded-xl text-xs sm:text-sm transition-all shadow-md w-fit active:scale-95"
        >
          <Send size={15} /> Quick Pay Transfer
        </Link>
      </div>

      {/* Highlights Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-4 bg-[#0a0a0a] border border-white/10 rounded-2xl space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Total Friends</span>
          <p className="text-2xl font-black text-white">{friends.length}</p>
          <p className="text-[11px] text-neutral-500">Saved for 1-click zero-fee payment</p>
        </div>
        <div className="p-4 bg-[#0a0a0a] border border-white/10 rounded-2xl space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#FEEF8B]">Priority Level</span>
          <p className="text-2xl font-black text-[#FEEF8B]">Priority #1</p>
          <p className="text-[11px] text-neutral-500">Highest auto-routing transaction priority</p>
        </div>
        <div className="p-4 bg-[#0a0a0a] border border-white/10 rounded-2xl space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">P2P Network</span>
          <p className="text-2xl font-black text-emerald-400">Zero Gas</p>
          <p className="text-[11px] text-neutral-500">Sub-second cryptographic settlement</p>
        </div>
      </div>

      {/* Search & Add Friend Card */}
      <div className="p-5 sm:p-7 bg-[#0a0a0a] border border-white/10 rounded-3xl space-y-4 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <UserPlus size={18} className="text-[#FEEF8B]" /> Add New Friend
          </h2>
          <span className="text-[10px] bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-neutral-400">
            Search by username or 0x address
          </span>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type username (e.g. aditya, rahul, priya) or 0x address..."
            className="w-full bg-black border border-white/10 pl-11 pr-4 py-3.5 rounded-2xl text-white text-sm placeholder:text-neutral-500 focus:outline-none focus:border-[#FEEF8B]/50 transition-colors"
          />
          {isSearching && (
            <RefreshCw size={16} className="animate-spin absolute right-4 top-1/2 -translate-y-1/2 text-[#FEEF8B]" />
          )}
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="space-y-2 p-3 bg-black/90 border border-white/10 rounded-2xl max-h-60 overflow-y-auto custom-scrollbar">
            {searchResults.map((userResult) => {
              const alreadyFriend = isFriend(userResult.uid, userResult.username);
              return (
                <div
                  key={userResult.uid}
                  className="flex items-center justify-between p-3 bg-[#121212] hover:bg-white/5 rounded-xl transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#FEEF8B]/10 border border-[#FEEF8B]/20 text-[#FEEF8B] font-bold flex items-center justify-center text-sm shrink-0">
                      {userResult.displayName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{userResult.displayName}</p>
                      <p className="text-[11px] text-neutral-400 font-mono">@{userResult.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {alreadyFriend ? (
                      <span className="text-[11px] text-emerald-400 font-semibold px-3 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20 flex items-center gap-1">
                        <Check size={12} /> Friend
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={addingFriendUid === userResult.uid}
                        onClick={() => handleAddFriend(userResult)}
                        className="px-3.5 py-1.5 bg-[#FEEF8B] hover:bg-[#FEF08A] text-neutral-950 text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                      >
                        {addingFriendUid === userResult.uid ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <UserPlus size={13} />
                        )}
                        Add Friend
                      </button>
                    )}

                    <Link
                      href={`/wallet/transfer?to=${encodeURIComponent(userResult.username)}`}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
                    >
                      <Send size={11} /> Pay
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Status Alerts */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-xl flex items-center gap-2">
            <Check size={14} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}
      </div>

      {/* ─── SUGGESTED FRIENDS / PLATFORM COMMUNITY ─── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Sparkles size={18} className="text-[#FEEF8B]" />
              <span>Suggested Friends & App Users</span>
              <span className="text-xs font-mono bg-[#FEEF8B]/10 border border-[#FEEF8B]/20 text-[#FEEF8B] px-2 py-0.5 rounded-full">
                {suggestions.length} available
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Users registered on SecureChain Pay. Connect with them for instant 1-click zero-fee transfers.
            </p>
          </div>

          <button
            onClick={fetchSuggestions}
            disabled={isLoadingSuggestions}
            className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={12} className={isLoadingSuggestions ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {isLoadingSuggestions ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-44 bg-white/[0.02] border border-white/5 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-10 px-4 bg-[#0a0a0a] border border-white/10 rounded-3xl text-xs text-neutral-400">
            No suggestions available at the moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggestions.map((suggestion) => {
              const alreadyFriend = isFriend(suggestion.uid, suggestion.username);
              const isAdding = addingFriendUid === suggestion.uid;

              return (
                <div
                  key={suggestion.uid}
                  className="p-5 bg-[#0a0a0a] border border-white/10 hover:border-[#FEEF8B]/30 rounded-3xl space-y-3.5 transition-all hover:shadow-[0_0_20px_rgba(254,239,139,0.06)] group relative flex flex-col justify-between"
                >
                  {/* Top row: Avatar + Name + Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FEF9C3] via-[#FEEF8B] to-[#F5C542] text-neutral-950 font-black text-base flex items-center justify-center shadow-md shrink-0">
                          {suggestion.displayName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        {suggestion.isOnline && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-black rounded-full"
                            title="Online"
                          />
                        )}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <h4 className="text-sm font-extrabold text-white truncate group-hover:text-[#FEEF8B] transition-colors">
                          {suggestion.displayName}
                        </h4>
                        <p className="text-xs text-neutral-400 font-mono truncate">@{suggestion.username}</p>
                      </div>
                    </div>

                    {suggestion.badge && (
                      <span className="text-[10px] font-bold text-[#FEEF8B] bg-[#FEEF8B]/10 border border-[#FEEF8B]/20 px-2 py-0.5 rounded-full shrink-0">
                        {suggestion.badge}
                      </span>
                    )}
                  </div>

                  {/* Bio / Tagline */}
                  {suggestion.bio && (
                    <p className="text-[11px] text-neutral-400 line-clamp-1 italic">
                      &quot;{suggestion.bio}&quot;
                    </p>
                  )}

                  {/* Address Pill */}
                  <div className="flex items-center justify-between p-2.5 bg-black rounded-xl border border-white/5 text-[11px] font-mono">
                    <span className="text-neutral-400 truncate max-w-[180px]">
                      {suggestion.walletAddress
                        ? `${suggestion.walletAddress.substring(0, 8)}...${suggestion.walletAddress.substring(
                            suggestion.walletAddress.length - 6
                          )}`
                        : '0xAddress'}
                    </span>
                    {suggestion.walletAddress && (
                      <button
                        onClick={() => copyAddress(suggestion.walletAddress)}
                        className="text-neutral-400 hover:text-white p-1 transition-colors"
                        title="Copy Wallet Address"
                      >
                        {copiedAddress === suggestion.walletAddress ? (
                          <Check size={12} className="text-emerald-400" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    {alreadyFriend ? (
                      <span className="flex-1 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5">
                        <Check size={13} /> Friend
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isAdding}
                        onClick={() => handleAddFriend(suggestion)}
                        className="flex-1 py-2 bg-[#FEEF8B] hover:bg-[#FEF08A] text-neutral-950 text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                      >
                        {isAdding ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <UserPlus size={13} />
                        )}
                        Add Friend
                      </button>
                    )}

                    <Link
                      href={`/wallet/transfer?to=${encodeURIComponent(suggestion.username)}`}
                      className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 active:scale-95 shrink-0"
                    >
                      <Send size={12} /> Pay
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── YOUR FRIENDS LIST ─── */}
      <div className="space-y-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Your Friends List</span>
            <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded-full text-neutral-300">
              {friends.length}
            </span>
          </h2>
          <button
            onClick={fetchFriends}
            disabled={isLoadingFriends}
            className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={12} className={isLoadingFriends ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {isLoadingFriends ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-36 bg-white/[0.02] border border-white/5 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : friends.length === 0 ? (
          <div className="text-center py-14 px-4 bg-[#0a0a0a] border border-white/10 rounded-3xl space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-neutral-500">
              <Users size={28} />
            </div>
            <h3 className="text-base font-bold text-white">No Friends Added Yet</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Choose from the <span className="text-[#FEEF8B] font-semibold">Suggested Friends</span> section above or search by username to add your first friend for instant Priority #1 payments!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {friends.map((friend) => (
              <div
                key={friend.friendUid}
                className="p-5 bg-[#0a0a0a] border border-white/10 hover:border-[#FEEF8B]/30 rounded-3xl space-y-4 transition-all hover:shadow-[0_0_20px_rgba(254,239,139,0.05)] group relative"
              >
                {/* Priority Star Badge */}
                <span className="absolute top-4 right-4 text-[10px] font-bold text-[#FEEF8B] bg-[#FEEF8B]/10 border border-[#FEEF8B]/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star size={10} className="fill-[#FEEF8B]" /> Priority
                </span>

                <div className="flex items-center gap-3.5 pr-16">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FEF9C3] via-[#FEEF8B] to-[#F5C542] text-neutral-950 font-black text-base flex items-center justify-center shadow-md shrink-0">
                    {friend.displayName?.charAt(0).toUpperCase() || 'F'}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <h4 className="text-sm font-extrabold text-white truncate group-hover:text-[#FEEF8B] transition-colors">
                      {friend.displayName}
                    </h4>
                    <p className="text-xs text-neutral-400 font-mono truncate">@{friend.username}</p>
                  </div>
                </div>

                {/* Address Pill */}
                <div className="flex items-center justify-between p-2.5 bg-black rounded-xl border border-white/5 text-[11px] font-mono">
                  <span className="text-neutral-400 truncate max-w-[200px]">
                    {friend.walletAddress
                      ? `${friend.walletAddress.substring(0, 8)}...${friend.walletAddress.substring(
                          friend.walletAddress.length - 8
                        )}`
                      : 'Address pending'}
                  </span>
                  {friend.walletAddress && (
                    <button
                      onClick={() => copyAddress(friend.walletAddress)}
                      className="text-neutral-400 hover:text-white p-1"
                      title="Copy Address"
                    >
                      {copiedAddress === friend.walletAddress ? (
                        <Check size={12} className="text-emerald-400" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href={`/wallet/transfer?to=${encodeURIComponent(friend.username)}`}
                    className="flex-1 py-2.5 bg-[#FEEF8B] hover:bg-[#FEF08A] text-neutral-950 text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Send size={13} /> Pay Friend
                  </Link>

                  <button
                    onClick={() => handleRemoveFriend(friend.friendUid, friend.displayName)}
                    className="p-2.5 bg-white/5 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/30 text-neutral-400 hover:text-rose-400 rounded-xl transition-all"
                    title="Remove Friend"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

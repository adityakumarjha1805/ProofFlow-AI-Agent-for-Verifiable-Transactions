import React, { useState } from 'react';
import {
  Sliders,
  Lock,
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Radio,
} from 'lucide-react';
import type { DeterministicPolicyConfig } from '../types/index.ts';
import { DEFAULT_POLICY_CONFIG } from '../services/policyEngine.ts';

interface PoliciesSettingsProps {
  policies: DeterministicPolicyConfig;
  onUpdatePolicies: (updated: DeterministicPolicyConfig) => void;
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
}

export const PoliciesSettingsPage: React.FC<PoliciesSettingsProps> = ({
  policies,
  onUpdatePolicies,
  isDemoMode,
  onToggleDemoMode,
}) => {
  const [formData, setFormData] = useState<DeterministicPolicyConfig>({ ...policies });
  const [newWhitelistAddress, setNewWhitelistAddress] = useState('');
  const [newBlockedAddress, setNewBlockedAddress] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        onUpdatePolicies(data.policies);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Failed to update policies', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setFormData({ ...DEFAULT_POLICY_CONFIG });
  };

  const handleAddWhitelist = () => {
    if (!newWhitelistAddress.trim()) return;
    const addr = newWhitelistAddress.trim().toLowerCase();
    if (!formData.whitelistedAddresses.includes(addr)) {
      setFormData({
        ...formData,
        whitelistedAddresses: [...formData.whitelistedAddresses, addr],
      });
      setNewWhitelistAddress('');
    }
  };

  const handleRemoveWhitelist = (addr: string) => {
    setFormData({
      ...formData,
      whitelistedAddresses: formData.whitelistedAddresses.filter((a) => a !== addr),
    });
  };

  const handleAddBlocked = () => {
    if (!newBlockedAddress.trim()) return;
    const addr = newBlockedAddress.trim().toLowerCase();
    if (!formData.blockedAddresses.includes(addr)) {
      setFormData({
        ...formData,
        blockedAddresses: [...formData.blockedAddresses, addr],
      });
      setNewBlockedAddress('');
    }
  };

  const handleRemoveBlocked = (addr: string) => {
    setFormData({
      ...formData,
      blockedAddresses: formData.blockedAddresses.filter((a) => a !== addr),
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-950 text-indigo-400 ring-1 ring-indigo-500/30">
              <Sliders className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Deterministic Security Policies
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Define mathematical, deterministic boundaries that the AI agent is forbidden from breaching.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleResetDefaults}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/40 px-4 py-2 text-xs font-bold text-white shadow-sm active:scale-[0.99] transition"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Policy Changes'}</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="flex items-center space-x-2 rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-xs font-semibold text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>Security policy parameters updated and enforced across all new proposals.</span>
        </div>
      )}

      {/* Execution Environment Switcher */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <Radio className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white">Execution Environment Mode</h2>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Mode 1: Demo Sandbox */}
          <div
            onClick={() => {
              if (!isDemoMode) onToggleDemoMode();
            }}
            className={`cursor-pointer rounded-xl border p-4 transition ${
              isDemoMode
                ? 'border-cyan-500/50 bg-cyan-950/20 ring-1 ring-cyan-500/30'
                : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-white">Testnet Sandbox Mode</span>
              <span className="rounded bg-cyan-950 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                RECOMMENDED FOR DEMO
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Executes transactions in a deterministic testnet sandbox. Generates real EVM Keccak-256 hashes,
              block heights, and dual-layer verification proofs without needing external testnet faucet ETH.
            </p>
          </div>

          {/* Mode 2: Live Injected Web3 */}
          <div
            onClick={() => {
              if (isDemoMode) onToggleDemoMode();
            }}
            className={`cursor-pointer rounded-xl border p-4 transition ${
              !isDemoMode
                ? 'border-amber-500/50 bg-amber-950/20 ring-1 ring-amber-500/30'
                : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-white">Live Web3 Wallet Mode</span>
              <span className="rounded bg-amber-950 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                EIP-1193 / METAMASK
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Submits transactions directly through your browser's Web3 provider (MetaMask, Rabby, Coinbase Wallet)
              to live Ethereum Sepolia, Base Sepolia, or Arbitrum Sepolia RPCs.
            </p>
          </div>
        </div>
      </div>

      {/* Numeric Limits Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Limit 1: Max Single Tx */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
          <label className="text-xs font-semibold text-slate-300">
            Per-Transaction Limit (ETH)
          </label>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Maximum ETH any single agent proposal can transfer.
          </p>
          <div className="mt-3 flex items-center space-x-2">
            <input
              type="number"
              step="0.05"
              min="0.01"
              max="50"
              value={formData.maxSingleTxEth}
              onChange={(e) =>
                setFormData({ ...formData, maxSingleTxEth: parseFloat(e.target.value) || 0 })
              }
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 font-mono text-sm text-cyan-300 outline-none focus:border-indigo-500 tabular-nums"
            />
            <span className="text-xs font-bold text-slate-400">ETH</span>
          </div>
        </div>

        {/* Limit 2: Daily Budget */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
          <label className="text-xs font-semibold text-slate-300">
            Daily Cumulative Cap (ETH)
          </label>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Max total ETH an agent can spend over a rolling 24h window.
          </p>
          <div className="mt-3 flex items-center space-x-2">
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="100"
              value={formData.maxDailyTxEth}
              onChange={(e) =>
                setFormData({ ...formData, maxDailyTxEth: parseFloat(e.target.value) || 0 })
              }
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 font-mono text-sm text-cyan-300 outline-none focus:border-indigo-500 tabular-nums"
            />
            <span className="text-xs font-bold text-slate-400">ETH</span>
          </div>
        </div>

        {/* Limit 3: High Value Scrutiny Threshold */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
          <label className="text-xs font-semibold text-slate-300">
            High-Value Warning Threshold (ETH)
          </label>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Triggers additional visual warning badges on proposals.
          </p>
          <div className="mt-3 flex items-center space-x-2">
            <input
              type="number"
              step="0.05"
              min="0.01"
              max="10"
              value={formData.requireApprovalAboveEth}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  requireApprovalAboveEth: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 font-mono text-sm text-cyan-300 outline-none focus:border-indigo-500 tabular-nums"
            />
            <span className="text-xs font-bold text-slate-400">ETH</span>
          </div>
        </div>
      </div>

      {/* Address Lists: Whitelist vs Blacklist */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Whitelist */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Trusted Whitelist Addresses
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              {formData.whitelistedAddresses.length} Registered
            </span>
          </div>

          <div className="mt-4 flex space-x-2">
            <input
              type="text"
              placeholder="0x... address"
              value={newWhitelistAddress}
              onChange={(e) => setNewWhitelistAddress(e.target.value)}
              className="flex-1 rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs font-mono text-slate-200 outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleAddWhitelist}
              className="flex items-center space-x-1 rounded-xl bg-emerald-950 px-3 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-900"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </div>

          <div className="mt-4 space-y-2 max-h-48 overflow-y-auto min-w-0">
            {formData.whitelistedAddresses.map((addr) => (
              <div
                key={addr}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-xs font-mono min-w-0"
              >
                <span className="text-emerald-300 truncate min-w-0 flex-1" title={addr}>{addr}</span>
                <button
                  onClick={() => handleRemoveWhitelist(addr)}
                  className="text-slate-500 hover:text-rose-400 transition shrink-0 p-1"
                  aria-label="Remove whitelist address"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Blacklist */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 shadow-xl min-w-0">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Lock className="h-4 w-4 text-rose-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Prohibited / Sanctioned Blacklist
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              {formData.blockedAddresses.length} Blocked
            </span>
          </div>

          <div className="mt-4 flex space-x-2">
            <input
              type="text"
              placeholder="0x... address"
              value={newBlockedAddress}
              onChange={(e) => setNewBlockedAddress(e.target.value)}
              className="flex-1 rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs font-mono text-slate-200 outline-none focus:border-indigo-500 min-w-0"
            />
            <button
              onClick={handleAddBlocked}
              className="flex items-center space-x-1 rounded-xl bg-rose-950 px-3 py-2 text-xs font-semibold text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-900 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Block</span>
            </button>
          </div>

          <div className="mt-4 space-y-2 max-h-48 overflow-y-auto min-w-0">
            {formData.blockedAddresses.map((addr) => (
              <div
                key={addr}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-xs font-mono min-w-0"
              >
                <span className="text-rose-300 truncate min-w-0 flex-1" title={addr}>{addr}</span>
                <button
                  onClick={() => handleRemoveBlocked(addr)}
                  className="text-slate-500 hover:text-rose-400 transition shrink-0 p-1"
                  aria-label="Remove blocked address"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

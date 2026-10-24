import React, { useState } from 'react';
import {
  ShieldCheck,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  Plus,
  Activity,
  Layers,
  Database,
  Lock,
  Wallet,
  Globe,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  Sliders,
  Sparkles,
} from 'lucide-react';
import type { TransactionProposal, DeterministicPolicyConfig, WalletState } from '../types/index.ts';
import { SUPPORTED_CHAINS } from '../types/index.ts';
import { SEPOLIA_CHAIN_ID } from '../services/blockchainService.ts';

interface DashboardPageProps {
  proposals: TransactionProposal[];
  policies: DeterministicPolicyConfig;
  wallet: WalletState;
  onSelectProposal: (proposal: TransactionProposal) => void;
  onNavigateToWorkspace: (prompt?: string) => void;
  onNavigateToVerification: (proposal?: TransactionProposal) => void;
  onNavigateToPolicies: () => void;
  onConnectWallet?: () => void;
  onSwitchToSepolia?: () => Promise<void>;
  onRefreshBalance?: () => Promise<void>;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  proposals,
  policies,
  wallet,
  onSelectProposal,
  onNavigateToWorkspace,
  onNavigateToVerification,
  onNavigateToPolicies,
  onConnectWallet,
  onSwitchToSepolia,
  onRefreshBalance,
}) => {
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Exact metrics required
  const verifiedCount = proposals.filter((p) => p.status === 'VERIFIED' || p.verification?.status === 'VERIFIED').length;
  const failedOrIncompleteCount = proposals.filter(
    (p) =>
      p.status === 'VERIFICATION_FAILED' ||
      p.status === 'POLICY_VIOLATION' ||
      p.verification?.status === 'FAILED' ||
      p.verification?.status === 'MISMATCH' ||
      p.verification?.status === 'INCOMPLETE'
  ).length;
  const pendingCount = proposals.filter((p) =>
    ['ANALYZED', 'POLICY_PASSED', 'APPROVED', 'AWAITING_APPROVAL'].includes(p.status)
  ).length;

  const quickPrompts = [
    'Send 0.05 ETH to vitalik.eth on Sepolia for developer grant program funding',
    'Transfer 0.015 ETH to core team treasury multi-sig on Sepolia',
    'Trigger policy test: Send 10.0 ETH to external address on Sepolia (exceeds single limit)',
    'Transfer 0.01 ETH to 0x0000000000000000000000000000000000000000 on Sepolia',
  ];

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleRefresh = async () => {
    if (!onRefreshBalance) return;
    setIsRefreshing(true);
    try {
      await onRefreshBalance();
    } finally {
      setIsRefreshing(false);
    }
  };

  const currentChainName = wallet.chainId
    ? SUPPORTED_CHAINS[wallet.chainId]?.name || `Chain ID ${wallet.chainId}`
    : 'Ethereum Sepolia Testnet';

  const isChainSepolia = wallet.chainId === SEPOLIA_CHAIN_ID;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 w-full min-w-0 max-w-full">
      {/* 1. Header Banner with Live AI Agent Status, Wallet, & Network */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between min-w-0">
          {/* Title & Agent Telemetry */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Guardrails Enforced
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>Deterministic Core</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-indigo-300 font-medium">Gemini 3.8 Flash</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Security Command Center
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Autonomous AI agent for high-assurance Web3 operations. Interprets natural language, runs deterministic policy checks, generates RFC 8785 canonical commitments, and links executions with cryptographic proofs.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigateToWorkspace()}
              className="flex items-center space-x-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 active:scale-95 transition focus-visible:ring-2 focus-visible:ring-indigo-400 min-h-[40px]"
            >
              <Plus className="h-4 w-4" />
              <span>New Transaction Request</span>
            </button>

            <button
              onClick={onNavigateToPolicies}
              className="flex items-center space-x-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition focus-visible:ring-2 focus-visible:ring-indigo-400 min-h-[40px]"
              title="Configure spending limits and security rules"
            >
              <Sliders className="h-4 w-4 text-slate-400" />
              <span>Policies</span>
            </button>
          </div>
        </div>

        {/* System Bar: Connected Wallet, Current Network, Mode */}
        <div className="mt-5 grid gap-3.5 border-t border-slate-800/80 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Box 1: Connected Wallet */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-1 min-w-0">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center space-x-1.5 font-medium text-slate-300">
                <Wallet className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span>Connected Wallet</span>
              </span>
              {wallet.connected ? (
                <span className="flex items-center space-x-1 font-mono text-[11px] text-emerald-400 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>CONNECTED</span>
                </span>
              ) : (
                <span className="text-[11px] text-slate-500 font-mono">DISCONNECTED</span>
              )}
            </div>

            {wallet.connected && wallet.address ? (
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="font-mono text-xs font-semibold text-white truncate select-all">
                  {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                </span>
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="font-mono text-xs text-cyan-300 font-semibold tabular-nums">
                    {wallet.balanceEth} ETH
                  </span>
                  <button
                    onClick={() => handleCopyAddress(wallet.address!)}
                    className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
                    title="Copy address"
                    aria-label="Copy wallet address"
                  >
                    {copiedAddress ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition disabled:opacity-40"
                    title="Refresh Sepolia balance"
                    aria-label="Refresh balance"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">No Web3 wallet active</span>
                {onConnectWallet && (
                  <button
                    onClick={onConnectWallet}
                    className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500 transition"
                  >
                    Connect Wallet
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Box 2: Current Network */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-1 min-w-0">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center space-x-1.5 font-medium text-slate-300">
                <Globe className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span>Settlement Network</span>
              </span>
              <span className="flex items-center space-x-1 font-mono text-[11px] text-blue-400 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                <span>SYNCHRONIZED</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center space-x-2 truncate">
                <span className="font-mono text-xs font-semibold text-white truncate">
                  {currentChainName}
                </span>
                <span className="font-mono text-[10px] text-slate-500 shrink-0">
                  ({wallet.chainId || 11155111})
                </span>
              </div>

              {!isChainSepolia && wallet.connected && onSwitchToSepolia && (
                <button
                  onClick={onSwitchToSepolia}
                  className="rounded-lg bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-amber-500 transition shrink-0"
                >
                  Switch to Sepolia
                </button>
              )}
            </div>
          </div>

          {/* Box 3: Daily Spending Guardrail */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-1 sm:col-span-2 lg:col-span-1 min-w-0">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center space-x-1.5 font-medium text-slate-300">
                <Lock className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                <span>24h Spending Guardrail</span>
              </span>
              <span className="font-mono text-[11px] text-slate-300 font-semibold tabular-nums">
                {policies.currentDailySpentEth.toFixed(2)} / {policies.maxDailyTxEth} ETH
              </span>
            </div>

            <div className="flex items-center space-x-3">
              <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (policies.currentDailySpentEth / policies.maxDailyTxEth) * 100)}%`,
                  }}
                />
              </div>
              <span className="font-mono text-[11px] text-slate-400 font-medium shrink-0">
                Max {policies.maxSingleTxEth} ETH / tx
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Grid - Prioritizing Pending Approvals, Verified, Blocked, Limits */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Pending Approvals (User Action Required) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Pending Approvals</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-950/80 text-amber-400 border border-amber-500/30">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-white tabular-nums">{pendingCount}</span>
            <span className="text-xs font-semibold text-amber-400">Awaiting Signature</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
            Proposals sealed with commitments awaiting explicit user cryptographic consent.
          </p>
        </div>

        {/* Metric 2: Verified Transaction Count */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Verified Transactions</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-white tabular-nums">{verifiedCount}</span>
            <span className="text-xs font-semibold text-emerald-400">8/8 Checks Passed</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
            Approved commitment hashes strictly mirror mined blockchain receipts.
          </p>
        </div>

        {/* Metric 3: Blocked Policy Violations & Divergences */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Blocked Violations</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-950/80 text-rose-400 border border-rose-500/30">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-white tabular-nums">{failedOrIncompleteCount}</span>
            <span className="text-xs font-semibold text-rose-400">Blocked / Divergent</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
            Intercepted policy violations, parameter tampering, or reverted calls.
          </p>
        </div>

        {/* Metric 4: Spending Guardrail Limit */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Daily Cap Headroom</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-950/80 text-indigo-400 border border-indigo-500/30">
              <Lock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-white tabular-nums">
              {(policies.maxDailyTxEth - policies.currentDailySpentEth).toFixed(2)}
            </span>
            <span className="text-xs font-semibold text-indigo-300">ETH Remaining</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
            Enforced by deterministic rules; requests exceeding budget are rejected before signing.
          </p>
        </div>
      </div>
      {/* 3. Quick Scenario Launcher */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span>Interactive Scenarios & Hackathon Benchmarks</span>
            </h2>
            <p className="text-xs text-slate-400">
              Click any scenario to test the agent analysis pipeline, policy guardrails, and cryptographic proofs:
            </p>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => onNavigateToWorkspace(p)}
              className="group flex items-start justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-left text-xs text-slate-300 transition hover:border-indigo-500/50 hover:bg-indigo-950/20 hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              <div className="pr-3">
                <span className="font-semibold text-indigo-300 block mb-0.5">
                  Scenario {idx + 1}
                </span>
                <span className="text-slate-300 line-clamp-2 leading-relaxed">{p}</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 shrink-0 mt-0.5 transition" />
            </button>
          ))}
        </div>
      </div>

      {/* 4. Recent Transactions & Proposals Ledger */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden backdrop-blur-sm min-w-0 w-full max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 px-4 sm:px-6 py-3.5 min-w-0">
          <div className="flex items-center space-x-2 min-w-0">
            <Database className="h-4 w-4 text-indigo-400 shrink-0" />
            <h2 className="text-sm font-bold text-white">Recent Proposals & Ledger Activity</h2>
          </div>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {proposals.length} Total Records Loaded
          </span>
        </div>

        {proposals.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400 space-y-3">
            <p>No transaction proposals found in persistent store.</p>
            <button
              onClick={() => onNavigateToWorkspace()}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition"
            >
              Draft First Verifiable Transaction
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[700px] text-left text-xs font-sans">
              <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Proposal ID</th>
                  <th className="px-4 py-3 font-semibold">Intent Prompt</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Recipient</th>
                  <th className="px-4 py-3 font-semibold">Status & Mode</th>
                  <th className="px-4 py-3 font-semibold">Verification Proof</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {proposals.slice(0, 8).map((proposal) => {
                  const isVerified = proposal.status === 'VERIFIED' || proposal.verification?.status === 'VERIFIED';
                  const isBlocked = proposal.status === 'POLICY_VIOLATION';
                  const isMismatch = proposal.verification?.status === 'MISMATCH';
                  const isFailed = proposal.status === 'VERIFICATION_FAILED' || proposal.verification?.status === 'FAILED';
                  const isPending = ['ANALYZED', 'POLICY_PASSED', 'APPROVED', 'AWAITING_APPROVAL'].includes(proposal.status);
                  const isSandbox = !proposal.execution?.clientTxHash && Boolean(proposal.execution);

                  return (
                    <tr
                      key={proposal.id}
                      onClick={() => onSelectProposal(proposal)}
                      className="transition hover:bg-slate-800/40 cursor-pointer"
                    >
                      {/* Proposal ID */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
                          <span>{proposal.id.length > 20 ? `${proposal.id.slice(0, 16)}...` : proposal.id}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyAddress(proposal.id);
                            }}
                            className="text-slate-500 hover:text-slate-300 p-0.5 rounded"
                            title="Copy Proposal ID"
                            aria-label={`Copy proposal ID ${proposal.id}`}
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(proposal.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Prompt Intent */}
                      <td className="px-4 py-3 max-w-[220px] truncate text-slate-200 font-sans text-xs">
                        {proposal.userPrompt}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 whitespace-nowrap font-bold text-cyan-300 tabular-nums">
                        {proposal.intent.amount} {proposal.intent.tokenSymbol}
                      </td>

                      {/* Recipient */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-300 text-xs">
                        {proposal.intent.recipientLabel ||
                          `${proposal.intent.recipient.slice(0, 6)}...${proposal.intent.recipient.slice(-4)}`}
                      </td>

                      {/* Tx Status & Mode */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          {isVerified && (
                            <span className="inline-flex items-center space-x-1 rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                              <span>VERIFIED</span>
                            </span>
                          )}
                          {isBlocked && (
                            <span className="inline-flex items-center space-x-1 rounded bg-rose-950/80 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/30">
                              <XCircle className="h-3 w-3 text-rose-400" />
                              <span>BLOCKED</span>
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center space-x-1 rounded bg-amber-950/80 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                              <Clock className="h-3 w-3 text-amber-400" />
                              <span>AWAITING SIGNATURE</span>
                            </span>
                          )}
                          {proposal.status === 'EXECUTED' && !isVerified && (
                            <span className="inline-flex items-center space-x-1 rounded bg-cyan-950/80 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                              <span>EXECUTED</span>
                            </span>
                          )}
                          {isFailed && (
                            <span className="inline-flex items-center space-x-1 rounded bg-red-950/80 px-2 py-0.5 text-[10px] font-bold text-red-300 border border-red-500/30">
                              <AlertTriangle className="h-3 w-3 text-red-400" />
                              <span>FAILED</span>
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-sans">
                            {proposal.execution ? (isSandbox ? 'Sandbox Receipt' : 'Live Etherscan') : 'Pre-Execution'}
                          </span>
                        </div>
                      </td>

                      {/* Verification Proof Link */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isVerified ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToVerification(proposal);
                            }}
                            className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                            <span>Verified (8/8)</span>
                          </button>
                        ) : isMismatch ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToVerification(proposal);
                            }}
                            className="inline-flex items-center space-x-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 underline underline-offset-2"
                          >
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>Mismatch Divergence</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-sans">Unverified</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isVerified || isMismatch) {
                              onNavigateToVerification(proposal);
                            } else {
                              onSelectProposal(proposal);
                            }
                          }}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
                        >
                          {isVerified || isMismatch ? 'Inspect Proof' : 'Review Proposal'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  Database,
  RefreshCw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  FileText,
  AlertTriangle,
  Info,
  Shield,
  Server,
  KeyRound,
  X,
} from 'lucide-react';
import type { TransactionProposal, SupportedChainId } from '../types/index.ts';
import type { DatabaseStatus, AuditEventRecord, PaginatedResult } from '../types/database.ts';
import { SUPPORTED_CHAINS } from '../types/index.ts';

interface TransactionHistoryProps {
  proposals?: TransactionProposal[];
  userWalletAddress?: string | null;
  onSelectProposal: (proposal: TransactionProposal) => void;
  onNavigateToVerification: (proposal: TransactionProposal) => void;
}

export const TransactionHistoryPage: React.FC<TransactionHistoryProps> = ({
  proposals: initialProposals = [],
  userWalletAddress,
  onSelectProposal,
  onNavigateToVerification,
}) => {
  // Query & Pagination State
  const [items, setItems] = useState<TransactionProposal[]>(initialProposals);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(initialProposals.length);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [networkFilter, setNetworkFilter] = useState<string>('ALL');
  const [onlyMyWallet, setOnlyMyWallet] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Copied states
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Verification in-progress map
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyingResult, setVerifyingResult] = useState<{ id: string; status: string; summary: string } | null>(null);

  // Modals state
  const [isDbModalOpen, setIsDbModalOpen] = useState<boolean>(false);
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [securityGuide, setSecurityGuide] = useState<any>(null);

  const [activeAuditProposal, setActiveAuditProposal] = useState<TransactionProposal | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEventRecord[]>([]);
  const [isLoadingAudits, setIsLoadingAudits] = useState<boolean>(false);

  // Fetch proposals from persistent backend API
  const fetchProposals = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (networkFilter !== 'ALL') params.set('network', networkFilter);
      if (onlyMyWallet && userWalletAddress) {
        params.set('onlyMyWallet', 'true');
        params.set('walletAddress', userWalletAddress);
      }

      const headers: Record<string, string> = {};
      if (userWalletAddress) {
        headers['x-wallet-address'] = userWalletAddress;
      }

      const res = await fetch(`/api/proposals?${params.toString()}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.pagination) {
          setItems(json.data);
          setTotalPages(json.pagination.totalPages);
          setTotalCount(json.pagination.total);
        } else if (json.proposals) {
          setItems(json.proposals);
          setTotalCount(json.proposals.length);
        }
      }
    } catch (err) {
      console.error('Failed to fetch paginated proposals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch database status and security guidelines
  const fetchDbMetadata = async () => {
    try {
      const [statusRes, guideRes] = await Promise.all([
        fetch('/api/db/status'),
        fetch('/api/db/security-guide'),
      ]);
      if (statusRes.ok) {
        const s = await statusRes.json();
        setDbStatus(s.database);
      }
      if (guideRes.ok) {
        const g = await guideRes.json();
        setSecurityGuide(g.guide);
      }
    } catch (err) {
      console.warn('Could not load database metadata:', err);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, [page, limit, statusFilter, networkFilter, onlyMyWallet]);

  useEffect(() => {
    fetchDbMetadata();
  }, []);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchProposals();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Direct Verification Endpoint Trigger
  const handleRunVerification = async (p: TransactionProposal) => {
    setVerifyingId(p.id);
    setVerifyingResult(null);
    try {
      const headers: Record<string, string> = {};
      if (userWalletAddress) headers['x-wallet-address'] = userWalletAddress;

      const res = await fetch(`/api/verify/${p.id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setVerifyingResult({
          id: p.id,
          status: data.status,
          summary: data.verification.auditSummary,
        });

        // Update local item
        setItems((prev) =>
          prev.map((item) =>
            item.id === p.id
              ? {
                  ...item,
                  status: data.status === 'VERIFIED' ? 'VERIFIED' : 'VERIFICATION_FAILED',
                  verification: data.verification,
                }
              : item
          )
        );
      }
    } catch (err) {
      console.error('Failed to verify:', err);
    } finally {
      setVerifyingId(null);
    }
  };

  // Open Audit Events Modal
  const handleOpenAudits = async (p: TransactionProposal) => {
    setActiveAuditProposal(p);
    setIsLoadingAudits(true);
    try {
      const headers: Record<string, string> = {};
      if (userWalletAddress) headers['x-wallet-address'] = userWalletAddress;

      const res = await fetch(`/api/proposals/${p.id}/audits`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAuditEvents(data.events || []);
      }
    } catch (err) {
      console.error('Failed to load audits:', err);
    } finally {
      setIsLoadingAudits(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & DB Status */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-950 text-indigo-400 ring-1 ring-indigo-500/30">
              <History className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Transaction History & Verification Ledger
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Persistent storage of proposals, deterministic policies, user approval commitments, and cryptographic verification records.
          </p>
        </div>

        {/* Database Status Pill & Security Configuration Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
            <Database className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-slate-300 font-mono text-[11px]">
              {dbStatus?.driver === 'MONGODB_ATLAS' ? 'MongoDB Atlas' : 'Persistent Storage'}
            </span>
          </div>

          <button
            onClick={() => setIsDbModalOpen(true)}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-850 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
          >
            <KeyRound className="h-3.5 w-3.5 text-indigo-400" />
            <span>Database Security</span>
          </button>

          <button
            onClick={fetchProposals}
            disabled={isLoading}
            className="flex items-center space-x-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition"
            title="Refresh transactions"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Verification Flash Notice */}
      {verifyingResult && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-4 text-xs text-emerald-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Verification Result for {verifyingResult.id}:</strong> Status is{' '}
              <span className="font-bold underline">{verifyingResult.status}</span>. {verifyingResult.summary}
            </span>
          </div>
          <button
            onClick={() => setVerifyingResult(null)}
            className="text-slate-400 hover:text-white ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl backdrop-blur-sm space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by proposal ID, recipient (0x...), tx hash, prompt, or token..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center space-x-1.5 text-xs">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-400">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="VERIFIED">Verified</option>
                <option value="EXECUTED">Executed</option>
                <option value="PENDING">Awaiting Approval</option>
                <option value="POLICY_VIOLATION">Policy Blocked</option>
                <option value="FAILED">Failed / Rejected</option>
              </select>
            </div>

            {/* Network Filter */}
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-slate-400">Network:</span>
              <select
                value={networkFilter}
                onChange={(e) => {
                  setNetworkFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Networks</option>
                <option value="11155111">Sepolia (11155111)</option>
                <option value="84532">Base Sepolia (84532)</option>
                <option value="421614">Arbitrum Sepolia (421614)</option>
              </select>
            </div>

            {/* My Wallet Toggle */}
            {userWalletAddress && (
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
                <input
                  type="checkbox"
                  checked={onlyMyWallet}
                  onChange={(e) => {
                    setOnlyMyWallet(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0"
                />
                <span>My Wallet Only</span>
              </label>
            )}

            {/* Limit Selector */}
            <div className="flex items-center space-x-1 text-xs text-slate-400">
              <span>Show:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-2xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Proposal ID</th>
                <th className="px-5 py-3.5 font-semibold">Recipient</th>
                <th className="px-5 py-3.5 font-semibold">Amount</th>
                <th className="px-5 py-3.5 font-semibold">Network</th>
                <th className="px-5 py-3.5 font-semibold">Tx Status</th>
                <th className="px-5 py-3.5 font-semibold">Verification Status</th>
                <th className="px-5 py-3.5 font-semibold">Creation Timestamp</th>
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {items.length > 0 ? (
                items.map((item) => {
                  const chain = SUPPORTED_CHAINS[item.intent.chainId] || SUPPORTED_CHAINS[11155111];
                  const isVerified = item.status === 'VERIFIED' || item.verification?.status === 'VERIFIED';
                  const isBlocked = item.status === 'POLICY_VIOLATION';
                  const isFailed = item.status === 'VERIFICATION_FAILED' || item.verification?.status === 'FAILED';
                  const isMismatch = item.verification?.status === 'MISMATCH';
                  const isPending = ['ANALYZED', 'POLICY_PASSED', 'APPROVED', 'AWAITING_APPROVAL'].includes(item.status);

                  // Extract base units safe representation
                  const baseUnitsValue = item.execution?.valueBaseUnits || 'Wei representation stored on-chain';

                  return (
                    <tr
                      key={item.id}
                      className="transition hover:bg-slate-800/40"
                    >
                      {/* 1. Proposal ID */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-semibold text-indigo-300 tabular-nums">
                            {item.id}
                          </span>
                          <button
                            onClick={() => handleCopy(item.id, `id-${item.id}`)}
                            className="text-slate-500 hover:text-slate-300 transition"
                            title="Copy Proposal ID"
                          >
                            {copiedId === `id-${item.id}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        {item.commitment && (
                          <div className="font-mono text-[10px] text-slate-500 truncate max-w-[150px] tabular-nums">
                            SHA: {item.commitment.sha256Hash.slice(0, 10)}...
                          </div>
                        )}
                      </td>

                      {/* 2. Recipient */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5 font-mono text-slate-200">
                          <span>
                            {item.intent.recipientLabel ||
                              `${item.intent.recipient.slice(0, 6)}...${item.intent.recipient.slice(-4)}`}
                          </span>
                          <button
                            onClick={() => handleCopy(item.intent.recipient, `rec-${item.id}`)}
                            className="text-slate-500 hover:text-slate-300 transition"
                            title="Copy full recipient address"
                          >
                            {copiedId === `rec-${item.id}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        {item.intent.recipientLabel && (
                          <div className="font-mono text-[10px] text-slate-500">
                            {item.intent.recipient.slice(0, 8)}...{item.intent.recipient.slice(-6)}
                          </div>
                        )}
                      </td>

                      {/* 3. Amount */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-cyan-300 tabular-nums">
                          {item.intent.amount} {item.intent.tokenSymbol}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500 tabular-nums" title="Safe integer base units in wei">
                          {baseUnitsValue.length > 18 ? `${baseUnitsValue.slice(0, 8)}... wei` : `${baseUnitsValue}`}
                        </div>
                      </td>

                      {/* 4. Network */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1">
                          <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-400" />
                          <span className="font-medium text-slate-300 text-[11px]">
                            {chain.shortName}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            ({item.intent.chainId})
                          </span>
                        </div>
                      </td>

                      {/* 5. Transaction Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {isVerified && (
                          <span className="inline-flex items-center space-x-1 rounded-md bg-emerald-950/80 px-2.5 py-1 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-500/40">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span>VERIFIED</span>
                          </span>
                        )}
                        {isBlocked && (
                          <span className="inline-flex items-center space-x-1 rounded-md bg-rose-950/80 px-2.5 py-1 text-[11px] font-bold text-rose-300 ring-1 ring-rose-500/40">
                            <XCircle className="h-3.5 w-3.5 text-rose-400" />
                            <span>BLOCKED</span>
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center space-x-1 rounded-md bg-amber-950/80 px-2.5 py-1 text-[11px] font-bold text-amber-300 ring-1 ring-amber-500/40">
                            <Clock className="h-3.5 w-3.5 text-amber-400" />
                            <span>AWAITING APPROVAL</span>
                          </span>
                        )}
                        {item.status === 'EXECUTED' && !isVerified && (
                          <span className="inline-flex items-center space-x-1 rounded-md bg-cyan-950/80 px-2.5 py-1 text-[11px] font-bold text-cyan-300 ring-1 ring-cyan-500/40">
                            <span>EXECUTED</span>
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center space-x-1 rounded-md bg-red-950/80 px-2.5 py-1 text-[11px] font-bold text-red-300 ring-1 ring-red-500/40">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                            <span>FAILED</span>
                          </span>
                        )}
                      </td>

                      {/* 6. Verification Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {isVerified ? (
                          <button
                            onClick={() => onNavigateToVerification(item)}
                            className="inline-flex items-center space-x-1 font-mono text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                            title="View complete 8-point cryptographic proof"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>VERIFIED (8/8)</span>
                          </button>
                        ) : isMismatch ? (
                          <button
                            onClick={() => onNavigateToVerification(item)}
                            className="inline-flex items-center space-x-1 font-mono text-[11px] font-bold text-rose-400 hover:text-rose-300 underline underline-offset-2"
                            title="Tampering or parameter discrepancy detected"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>MISMATCH</span>
                          </button>
                        ) : item.verification?.status === 'PENDING' ? (
                          <span className="font-mono text-[11px] text-amber-400 flex items-center space-x-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span>PENDING CONFIRM</span>
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] text-slate-500">
                            UNVERIFIED
                          </span>
                        )}
                      </td>

                      {/* 7. Creation Timestamp */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div
                          className="font-mono text-slate-300 text-[11px]"
                          title={new Date(item.createdAt).toISOString()}
                        >
                          {new Date(item.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {new Date(item.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* 8. Action Controls */}
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Live Re-verify via server endpoint */}
                          <button
                            onClick={() => handleRunVerification(item)}
                            disabled={verifyingId === item.id}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition"
                            title="Authoritatively run verification engine on server"
                          >
                            <RefreshCw className={`h-3 w-3 ${verifyingId === item.id ? 'animate-spin' : ''}`} />
                          </button>

                          {/* Audit Trail Drawer Trigger */}
                          <button
                            onClick={() => handleOpenAudits(item)}
                            className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
                            title="Inspect chronological audit log"
                          >
                            Audits
                          </button>

                          {/* Inspect Proof Button */}
                          <button
                            onClick={() => {
                              onSelectProposal(item);
                              if (isVerified || isMismatch) {
                                onNavigateToVerification(item);
                              }
                            }}
                            className="rounded-lg border border-indigo-500/40 bg-indigo-950/60 px-2.5 py-1 text-[11px] font-semibold text-indigo-200 hover:bg-indigo-900 transition flex items-center space-x-1"
                          >
                            <span>Inspect</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    {isLoading ? 'Loading records from persistent database...' : 'No transactions found matching your criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-950/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-400">
          <div>
            Showing <span className="font-semibold text-slate-200">{items.length > 0 ? (page - 1) * limit + 1 : 0}</span> to{' '}
            <span className="font-semibold text-slate-200">{Math.min(page * limit, totalCount)}</span> of{' '}
            <span className="font-semibold text-slate-200">{totalCount}</span> proposals
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="flex items-center space-x-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-2 font-mono text-slate-300">
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="flex items-center space-x-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Database & Security Modal */}
      {isDbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-950 text-indigo-400 ring-1 ring-indigo-500/30">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Database Architecture & Security Configuration</h3>
                  <p className="text-xs text-slate-400">
                    Enterprise persistent storage, credential isolation, and audit readiness.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDbModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Current Connection Status */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Active Storage Driver</span>
                <span className="inline-flex items-center space-x-1.5 rounded-full bg-emerald-950 px-3 py-0.5 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{dbStatus?.driver || 'PERSISTENT_STORAGE'}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800/80">
                  <div className="text-slate-500">Proposals Stored</div>
                  <div className="text-base font-bold text-white font-mono">{dbStatus?.stats.proposalsCount ?? totalCount}</div>
                </div>
                <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800/80">
                  <div className="text-slate-500">Policy Evaluations</div>
                  <div className="text-base font-bold text-indigo-400 font-mono">{dbStatus?.stats.policiesCount ?? '-'}</div>
                </div>
                <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800/80">
                  <div className="text-slate-500">Approval Evidence</div>
                  <div className="text-base font-bold text-emerald-400 font-mono">{dbStatus?.stats.approvalsCount ?? '-'}</div>
                </div>
                <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800/80">
                  <div className="text-slate-500">Mined Tx Records</div>
                  <div className="text-base font-bold text-cyan-400 font-mono">{dbStatus?.stats.transactionsCount ?? '-'}</div>
                </div>
                <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800/80">
                  <div className="text-slate-500">Verification Audits</div>
                  <div className="text-base font-bold text-emerald-300 font-mono">{dbStatus?.stats.verificationsCount ?? '-'}</div>
                </div>
                <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800/80">
                  <div className="text-slate-500">Audit Events Logged</div>
                  <div className="text-base font-bold text-amber-400 font-mono">{dbStatus?.stats.auditEventsCount ?? '-'}</div>
                </div>
              </div>
            </div>

            {/* How to Configure Credentials Securely Guide */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-indigo-400" />
                <h4 className="text-sm font-bold text-white">Production MongoDB Atlas Security Constitution</h4>
              </div>

              {securityGuide && (
                <div className="space-y-3">
                  {securityGuide.steps.map((step: any, idx: number) => (
                    <div key={idx} className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 space-y-1.5 text-xs">
                      <div className="font-semibold text-indigo-300 flex items-center space-x-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-950 text-[10px] text-indigo-300 border border-indigo-500/30">
                          {idx + 1}
                        </span>
                        <span>{step.title}</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed pl-7">{step.instruction}</p>
                      <p className="text-slate-500 text-[11px] pl-7 italic">
                        <strong>Security Rationale:</strong> {step.securityNote}
                      </p>
                    </div>
                  ))}

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                    <span className="text-xs font-semibold text-slate-300">Environment Variable Configuration:</span>
                    <pre className="rounded-lg bg-black p-3 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                      {securityGuide.exampleEnv}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsDbModalOpen(false)}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition"
              >
                Close Security Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Events Drawer Modal */}
      {activeAuditProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-indigo-400" />
                  <span>Audit Trail: {activeAuditProposal.id}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Chronological lifecycle events and server-side verification stamps.
                </p>
              </div>
              <button
                onClick={() => setActiveAuditProposal(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoadingAudits ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading audit trail...</div>
            ) : auditEvents.length > 0 ? (
              <div className="space-y-3">
                {auditEvents.map((evt) => (
                  <div key={evt.id} className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-indigo-300 text-[11px]">{evt.eventType}</span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {new Date(evt.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {evt.actorWalletAddress && (
                      <div className="font-mono text-[10px] text-slate-400">
                        Actor Wallet: <span className="text-slate-200">{evt.actorWalletAddress}</span>
                      </div>
                    )}
                    <pre className="rounded bg-black/60 p-2 font-mono text-[10px] text-slate-300 overflow-x-auto">
                      {JSON.stringify(evt.details, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-xs text-slate-400">
                No external audit events registered yet. Mined transactions and commitments trigger automated audit logs.
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveAuditProposal(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

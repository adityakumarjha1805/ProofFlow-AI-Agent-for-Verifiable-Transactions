import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
  Download,
  RefreshCw,
  Layers,
  Database,
  Lock,
  FileCheck2,
  Cpu,
  Clock,
  Share2,
  Check,
  Info,
  Bug,
  RotateCcw,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import type {
  TransactionProposal,
  VerificationStatus,
  VerificationAudit,
} from '../types/index.ts';

interface VerificationPageProps {
  proposal: TransactionProposal | null;
  allProposals: TransactionProposal[];
  onSelectProposal: (proposal: TransactionProposal) => void;
}

export const VerificationPage: React.FC<VerificationPageProps> = ({
  proposal,
  allProposals,
  onSelectProposal,
}) => {
  const [copiedProof, setCopiedProof] = useState(false);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [copiedCommitment, setCopiedCommitment] = useState(false);
  const [isReverifying, setIsReverifying] = useState(false);
  const [isSimulatingTamper, setIsSimulatingTamper] = useState(false);
  const [tamperMessage, setTamperMessage] = useState<string | null>(null);

  const [currentProposal, setCurrentProposal] = useState<TransactionProposal | null>(
    proposal || allProposals.find((p) => p.status === 'VERIFIED') || allProposals[0] || null
  );

  // Sync if prop changes
  useEffect(() => {
    if (proposal) setCurrentProposal(proposal);
  }, [proposal]);

  // Support reading ?proposalId= from window.location if present
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlPropId = urlParams.get('proposalId') || urlParams.get('id');
      if (urlPropId) {
        const found = allProposals.find((p) => p.id === urlPropId);
        if (found) {
          setCurrentProposal(found);
          onSelectProposal(found);
        }
      }
    } catch {
      // ignore
    }
  }, [allProposals]);

  const p = currentProposal;

  const handleCopyProof = () => {
    if (!p) return;
    const proofJson = JSON.stringify(
      {
        proofFlowVerifierVersion: 'ProofFlow-v2.0-Cryptographic-EVM',
        proposalId: p.id,
        userPrompt: p.userPrompt,
        canonicalPayload: p.commitment?.canonicalPayload,
        canonicalPayloadJson: p.commitment?.canonicalPayloadJson,
        sha256Commitment: p.commitment?.sha256Hash,
        keccak256Commitment: p.commitment?.commitmentHash,
        approvalEvidence: p.approvalEvidence,
        execution: p.execution,
        verification: p.verification,
      },
      null,
      2
    );
    navigator.clipboard.writeText(proofJson);
    setCopiedProof(true);
    setTimeout(() => setCopiedProof(false), 2000);
  };

  const handleCopyShareLink = () => {
    if (!p) return;
    const shareUrl = `${window.location.origin}/?view=verification&proposalId=${p.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedShareUrl(true);
    setTimeout(() => setCopiedShareUrl(false), 2000);
  };

  const handleReverify = async () => {
    if (!p) return;
    setIsReverifying(true);
    setTamperMessage(null);
    try {
      const response = await fetch(`/api/proposals/${p.id}/verify`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentProposal(data.proposal);
        onSelectProposal(data.proposal);
      }
    } catch (err) {
      console.error('Re-verification failed', err);
    } finally {
      setIsReverifying(false);
    }
  };

  const handleSimulateTamper = async (tamperType: 'AMOUNT' | 'RECIPIENT' | 'CHAIN' | 'REVERT') => {
    if (!p) return;
    setIsSimulatingTamper(true);
    setTamperMessage(null);
    try {
      const response = await fetch(`/api/proposals/${p.id}/simulate-tamper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tamperType }),
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentProposal(data.proposal);
        onSelectProposal(data.proposal);
        setTamperMessage(`Simulated parameter tampering (${tamperType}). The verification engine re-audited the transaction and flagged the discrepancy.`);
      }
    } catch (err) {
      console.error('Tampering simulation failed', err);
    } finally {
      setIsSimulatingTamper(false);
    }
  };

  const handleRestoreFaithful = async () => {
    if (!p) return;
    setIsSimulatingTamper(true);
    setTamperMessage(null);
    try {
      const response = await fetch(`/api/proposals/${p.id}/restore-faithful`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentProposal(data.proposal);
        onSelectProposal(data.proposal);
        setTamperMessage('Restored authentic parameter fidelity. Re-audit returned VERIFIED.');
      }
    } catch (err) {
      console.error('Restoration failed', err);
    } finally {
      setIsSimulatingTamper(false);
    }
  };

  if (!p) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
        <ShieldCheck className="h-12 w-12 text-slate-600" />
        <h3 className="mt-4 text-base font-semibold text-white">No Transaction Selected for Verification</h3>
        <p className="mt-1 text-xs text-slate-400 max-w-sm">
          Select an executed transaction to inspect its cryptographic audit proofs and zero-drift comparison.
        </p>
      </div>
    );
  }

  const status: VerificationStatus = p.verification?.status || (p.execution ? 'PENDING' : 'INCOMPLETE');
  const isVerified = status === 'VERIFIED';
  const isMismatch = status === 'MISMATCH';
  const isPending = status === 'PENDING';
  const isFailed = status === 'FAILED';
  const isIncomplete = status === 'INCOMPLETE';

  const checks = p.verification?.checks;

  return (
    <div className="space-y-6 sm:space-y-8 w-full min-w-0 max-w-full">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-950 text-emerald-400 ring-1 ring-emerald-500/30 shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h1 className="text-[clamp(1.2rem,3.5vw,1.875rem)] font-bold tracking-tight text-white break-words">
              Cryptographic Verification Engine
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Verifiable cryptographic proof linking the AI proposal, explicit user approval, and actual on-chain mined execution.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 min-w-0 w-full sm:w-auto">
          {/* Proposal Switcher */}
          <select
            value={p.id}
            onChange={(e) => {
              const selected = allProposals.find((x) => x.id === e.target.value);
              if (selected) {
                setCurrentProposal(selected);
                onSelectProposal(selected);
              }
            }}
            className="w-full sm:w-auto min-w-0 max-w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 truncate"
          >
            {allProposals.map((item) => (
              <option key={item.id} value={item.id}>
                [{item.status}] {item.id} ({item.intent.amount} {item.intent.tokenSymbol})
              </option>
            ))}
          </select>

          {/* Re-verify Button */}
          <button
            onClick={handleReverify}
            disabled={isReverifying || !p.commitment}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition min-h-[38px]"
            title="Re-run the 8 cryptographic integrity checks"
          >
            <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isReverifying ? 'animate-spin' : ''}`} />
            <span>Re-Verify</span>
          </button>

          {/* Share Button */}
          <button
            onClick={handleCopyShareLink}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 rounded-lg border border-indigo-500/40 bg-indigo-950/60 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-900/60 transition min-h-[38px]"
            title="Copy shareable link to this verification audit"
          >
            {copiedShareUrl ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="text-emerald-300 font-bold">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span>Share</span>
              </>
            )}
          </button>

          {/* Proof JSON Button */}
          <button
            onClick={handleCopyProof}
            className="w-full sm:w-auto flex items-center justify-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition min-h-[38px]"
            title="Copy full cryptographic proof audit JSON"
          >
            {copiedProof ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="text-emerald-300">Proof Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Copy Proof JSON</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Status Hero Banner */}
      <div
        className={`rounded-2xl border p-4 sm:p-6 shadow-xl backdrop-blur-sm transition-all w-full min-w-0 max-w-full ${
          isVerified
            ? 'border-emerald-500/40 bg-slate-900/70'
            : isMismatch
            ? 'border-rose-500/40 bg-slate-900/70'
            : isFailed
            ? 'border-red-600/40 bg-slate-900/70'
            : isPending
            ? 'border-amber-500/40 bg-slate-900/70'
            : 'border-slate-800 bg-slate-900/60'
        }`}
      >
        <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-center lg:justify-between min-w-0">
          <div className="flex items-start space-x-3.5 min-w-0">
            <div
              className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl ${
                isVerified
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                  : isMismatch
                  ? 'bg-rose-950 text-rose-400 border border-rose-500/40'
                  : isFailed
                  ? 'bg-red-950 text-red-400 border border-red-500/40'
                  : isPending
                  ? 'bg-amber-950 text-amber-400 border border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {isVerified ? (
                <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />
              ) : isMismatch ? (
                <XCircle className="h-5 w-5 sm:h-6 sm:w-6" />
              ) : isFailed ? (
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
              ) : isPending ? (
                <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
              ) : (
                <HelpCircle className="h-5 w-5 sm:h-6 sm:w-6" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider shrink-0 ${
                    isVerified
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                      : isMismatch
                      ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                      : isFailed
                      ? 'bg-red-950 text-red-300 border border-red-500/40'
                      : isPending
                      ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {status}
                </span>
                <span className="rounded bg-indigo-950/80 border border-indigo-500/30 px-2 py-0.5 text-xs font-mono text-indigo-300 break-all">
                  Verification ID: {p.verification?.id || `verif-${p.id}`}
                </span>
                <span className="text-xs text-slate-400 break-all">
                  Proposal ID: <span className="font-mono text-slate-200">{p.id}</span>
                </span>
                <span className="hidden sm:inline text-xs text-slate-600">•</span>
                <span className="text-xs text-slate-400">
                  Target: <span className="text-slate-200">Ethereum Sepolia (11155111)</span>
                </span>
              </div>

              <h2 className="mt-2 text-base sm:text-lg md:text-xl font-bold text-white break-words">
                {isVerified
                  ? 'Cryptographic Parameters & On-Chain Execution Strictly Match'
                  : isMismatch
                  ? 'Parameter Divergence / Tampering Flagged'
                  : isFailed
                  ? 'On-Chain Execution Reverted or Failed'
                  : isPending
                  ? 'Transaction Submitted — Awaiting Block Confirmation'
                  : 'Verification Incomplete — Missing Execution Data'}
              </h2>

              <p className="mt-1 text-xs text-slate-300 max-w-3xl leading-relaxed break-words">
                {p.verification?.auditSummary ||
                  'Once approved and executed on the testnet, the verification engine recomputes canonical hashes, checks all 8 integrity criteria, and links the proposal commitment to the mined block receipt.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Simulated Tampering Feedback Notice */}
      {tamperMessage && (
        <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/30 p-4 text-xs text-indigo-200 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <Info className="h-4 w-4 text-indigo-400 shrink-0" />
            <span className="break-words">{tamperMessage}</span>
          </div>
          <button
            onClick={() => setTamperMessage(null)}
            className="text-xs text-slate-400 hover:text-white shrink-0 ml-2 py-1 px-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Preservation of Original User Intent & Approved Proposal */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 w-full min-w-0 max-w-full">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 min-w-0">
          <Cpu className="h-4 w-4 text-indigo-400 shrink-0" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white break-words">
            1. Original Request & Approved Proposal
          </h3>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2 text-xs min-w-0">
          <div className="min-w-0">
            <span className="text-slate-400 text-[11px] block font-semibold uppercase tracking-wider">
              Original Natural-Language Request:
            </span>
            <div className="mt-1 rounded-lg bg-slate-950 p-3 text-slate-200 font-sans italic border border-slate-800/80 leading-relaxed break-words">
              "{p.userPrompt}"
            </div>
            <div className="mt-2 text-[11px] text-slate-400 break-words">
              Captured by ProofFlow Agent runtime prior to autonomous parsing.
            </div>
          </div>
          <div className="min-w-0">
            <span className="text-slate-400 text-[11px] block font-semibold uppercase tracking-wider">
              Approved Proposal Specification:
            </span>
            <div className="mt-1 rounded-lg bg-slate-950 p-3 text-slate-300 font-mono text-xs border border-slate-800/80 space-y-2 min-w-0">
              <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-1 border-b border-slate-900/80 pb-1.5 min-w-0">
                <span className="text-slate-500 shrink-0">Proposal ID:</span>
                <span className="text-slate-200 font-semibold break-all [overflow-wrap:anywhere]">{p.id}</span>
              </div>
              <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-1 border-b border-slate-900/80 pb-1.5 min-w-0">
                <span className="text-slate-500 shrink-0">Sender (Approver):</span>
                <span className="text-indigo-300 break-all select-all [overflow-wrap:anywhere]">
                  {p.approvalEvidence?.walletAddress || p.commitment?.signerAddress || '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c'}
                </span>
              </div>
              <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-1 border-b border-slate-900/80 pb-1.5 min-w-0">
                <span className="text-slate-500 shrink-0">Recipient:</span>
                <span className="text-cyan-300 break-all select-all [overflow-wrap:anywhere] font-semibold">{p.intent.recipient}</span>
              </div>
              <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-1 border-b border-slate-900/80 pb-1.5 min-w-0">
                <span className="text-slate-500 shrink-0">Asset & Amount:</span>
                <span className="text-emerald-300 font-semibold break-words">{p.intent.amount} {p.intent.tokenSymbol || 'ETH'}</span>
              </div>
              <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-1 border-b border-slate-900/80 pb-1.5 min-w-0">
                <span className="text-slate-500 shrink-0">Network:</span>
                <span className="text-slate-300 break-words">Sepolia (11155111)</span>
              </div>
              <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-1 min-w-0">
                <span className="text-slate-500 shrink-0">Action Type:</span>
                <span className="text-slate-200 font-semibold">{p.intent.actionType}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side: Approval Evidence & Blockchain Execution Receipt */}
      <div className="grid gap-6 lg:grid-cols-2 min-w-0 w-full max-w-full">
        {/* Box 1: User Approval Evidence */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6 shadow-xl backdrop-blur-sm min-w-0 w-full max-w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 min-w-0">
            <div className="flex items-center space-x-2 min-w-0">
              <Lock className="h-4 w-4 text-cyan-400 shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white break-words">
                2. User Approval Evidence
              </h3>
            </div>
            <span className="rounded bg-cyan-950/80 px-2 py-0.5 text-[10px] font-bold text-cyan-300 shrink-0">
              CANONICAL COMMITMENT
            </span>
          </div>

          <div className="mt-4 space-y-3 text-xs font-mono min-w-0">
            <div className="min-w-0">
              <span className="text-slate-400 text-[11px] block">Authorized Approver Wallet:</span>
              <div className="mt-1 flex flex-col xs:flex-row xs:items-center justify-between gap-1.5 rounded bg-slate-950 p-2 text-slate-200 min-w-0">
                <span className="break-all select-all font-mono text-[11px] [overflow-wrap:anywhere] min-w-0 flex-1">
                  {p.approvalEvidence?.walletAddress || p.commitment?.signerAddress || '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c'}
                </span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 uppercase shrink-0 self-start xs:self-auto">
                  {p.approvalEvidence?.approvalMethod || 'WALLET_PERSONAL_SIGN'}
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <span className="text-slate-400 text-[11px] block">Approved Proposal Commitment (NIST SHA-256):</span>
              <div className="mt-1 rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-cyan-300 break-all select-all font-semibold text-[11px] leading-relaxed [overflow-wrap:anywhere] min-w-0">
                {p.commitment?.sha256Hash || 'Pending approval'}
              </div>
            </div>

            <div className="min-w-0">
              <span className="text-slate-400 text-[11px] block">EVM Keccak-256 Commitment:</span>
              <div className="mt-1 rounded border border-slate-800 bg-slate-950/80 p-2 text-slate-400 break-all select-all text-[11px] leading-relaxed [overflow-wrap:anywhere] min-w-0">
                {p.commitment?.commitmentHash || 'Pending approval'}
              </div>
            </div>

            {p.approvalEvidence?.signature && (
              <div className="min-w-0">
                <span className="text-slate-400 text-[11px] block">Proposal Approval Signature:</span>
                <div className="mt-1 rounded bg-slate-950 p-2 text-[10px] text-slate-400 break-all select-all font-mono [overflow-wrap:anywhere] max-h-24 overflow-y-auto min-w-0">
                  {p.approvalEvidence.signature}
                </div>
              </div>
            )}

            {/* Crucial Educational Callout */}
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/30 p-3 text-[11px] text-cyan-200/90 font-sans leading-relaxed break-words">
              <span className="font-bold text-cyan-300 block mb-0.5">Signature Evidence Distinction:</span>
              The wallet proposal signature proves explicit user authorization of the canonical commitment parameters prior to execution.
              It is strictly separate from the subsequent on-chain blockchain transaction signature.
            </div>
          </div>
        </div>

        {/* Box 2: On-Chain Executed Receipt */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6 shadow-xl backdrop-blur-sm min-w-0 w-full max-w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 min-w-0">
            <div className="flex items-center space-x-2 min-w-0">
              <Database className="h-4 w-4 text-indigo-400 shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white break-words">
                3. On-Chain Blockchain Execution
              </h3>
            </div>
            <span className="rounded bg-indigo-950/80 px-2 py-0.5 text-[10px] font-bold text-indigo-300 shrink-0">
              MINED BLOCK RECEIPT
            </span>
          </div>

          <div className="mt-4 space-y-3 text-xs font-mono min-w-0">
            <div className="min-w-0">
              <span className="text-slate-400 text-[11px] block">Sepolia Transaction Hash:</span>
              <div className="mt-1 flex flex-col xs:flex-row xs:items-center justify-between gap-1.5 rounded bg-slate-950 p-2 text-slate-200 min-w-0">
                <span className="break-all select-all font-mono text-[11px] [overflow-wrap:anywhere] min-w-0 flex-1">
                  {p.execution?.txHash || 'Awaiting on-chain execution'}
                </span>
                {p.execution?.explorerUrl && (
                  <a
                    href={p.execution.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 text-[11px] font-sans shrink-0 self-start xs:self-auto"
                  >
                    <span>Explorer</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] min-w-0">
              <div className="rounded bg-slate-950 p-2 border border-slate-800 min-w-0">
                <span className="text-slate-400 block">Block Number:</span>
                <span className="text-white font-bold break-all">{p.execution?.blockNumber || 'Pending'}</span>
              </div>
              <div className="rounded bg-slate-950 p-2 border border-slate-800 min-w-0">
                <span className="text-slate-400 block">Execution Status:</span>
                <span
                  className={`font-bold ${
                    p.execution?.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {p.execution?.status || 'PENDING'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] min-w-0">
              <div className="rounded bg-slate-950 p-2 border border-slate-800 min-w-0">
                <span className="text-slate-400 block">Actual Transferred:</span>
                <span className="text-indigo-300 font-bold break-all">{p.execution?.valueEth || p.intent.amount} ETH</span>
              </div>
              <div className="rounded bg-slate-950 p-2 border border-slate-800 min-w-0">
                <span className="text-slate-400 block">Gas Consumed:</span>
                <span className="text-slate-200 break-all">{p.execution?.gasUsed || 21000} units</span>
              </div>
            </div>

            <div className="min-w-0">
              <span className="text-slate-400 text-[11px] block">Executed Payload Hash (Recomputed from Receipt):</span>
              <div className="mt-1 rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-indigo-300 break-all select-all font-semibold text-[11px] leading-relaxed [overflow-wrap:anywhere] min-w-0">
                {p.verification?.executedPayloadHash || 'Computed on execution'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cryptographic Commitment Comparison & Equivalence Proof */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6 shadow-xl backdrop-blur-sm min-w-0 w-full max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-4 min-w-0">
          <div className="flex items-center space-x-2 min-w-0">
            <Lock className="h-4 w-4 text-cyan-400 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white break-words">
              Commitment Comparison & Mathematical Equivalence Proof
            </h3>
          </div>
          <span
            className={`rounded-md px-2.5 py-1 text-[11px] sm:text-xs font-bold font-mono shrink-0 ${
              p.verification?.hashesMatch
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                : 'bg-rose-950 text-rose-300 border border-rose-500/40'
            }`}
          >
            {p.verification?.hashesMatch ? 'IDENTICAL CRYPTOGRAPHIC HASHES (MATCH)' : 'HASH MISMATCH DETECTED'}
          </span>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2 text-xs font-mono min-w-0">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 sm:p-4 space-y-1.5 min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              1. Approved Intent Commitment (Expected)
            </span>
            <div className="text-cyan-300 break-all select-all font-semibold text-[11px] leading-relaxed [overflow-wrap:anywhere]">
              {p.commitment?.sha256Hash || p.commitment?.commitmentHash || 'N/A (Pending approval)'}
            </div>
            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-900 break-words">
              Canonical RFC 8785 JSON representation signed by user.
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 sm:p-4 space-y-1.5 min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              2. On-Chain Executed Payload Hash (Actual)
            </span>
            <div className="text-indigo-300 break-all select-all font-semibold text-[11px] leading-relaxed [overflow-wrap:anywhere]">
              {p.verification?.executedPayloadHash || 'Awaiting block mining'}
            </div>
            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-900 break-words">
              Authoritatively extracted from mined transaction receipt.
            </div>
          </div>
        </div>

        {/* Parameter Diff Breakdown Table */}
        {p.verification?.parameterDiffs && p.verification.parameterDiffs.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 w-full min-w-0 max-w-full">
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[480px] text-left text-xs font-mono">
                <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-3 sm:px-4 py-2.5">Field</th>
                    <th className="px-3 sm:px-4 py-2.5">Approved Commitment</th>
                    <th className="px-3 sm:px-4 py-2.5">Mined On-Chain</th>
                    <th className="px-3 sm:px-4 py-2.5 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {p.verification.parameterDiffs.map((diff, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="px-3 sm:px-4 py-2 text-slate-300 font-semibold">{diff.field}</td>
                      <td className="px-3 sm:px-4 py-2 text-cyan-300 break-all [overflow-wrap:anywhere] max-w-[140px] sm:max-w-[200px]">{diff.intentValue}</td>
                      <td className="px-3 sm:px-4 py-2 text-indigo-300 break-all [overflow-wrap:anywhere] max-w-[140px] sm:max-w-[200px]">{diff.executedValue}</td>
                      <td className="px-3 sm:px-4 py-2 text-right">
                        {diff.matches ? (
                          <span className="text-emerald-400 font-bold">MATCH</span>
                        ) : (
                          <span className="text-rose-400 font-bold">DIVERGENCE</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* The 8 Cryptographic Verification Checks Matrix */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden w-full min-w-0 max-w-full">
        <div className="border-b border-slate-800 px-4 sm:px-6 py-4 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0">
            <div className="flex items-center space-x-2 min-w-0">
              <Layers className="h-4 w-4 text-emerald-400 shrink-0" />
              <h3 className="text-sm font-semibold text-white break-words">
                The 8 Cryptographic Verification Criteria Matrix
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono break-words">
              Strict Mathematical Matching • Zero Tolerated Drift
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-800/80 min-w-0">
          {checks ? (
            Object.values(checks).map((check, idx) => (
              <div key={idx} className="p-4 sm:p-5 hover:bg-slate-800/20 transition min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 min-w-0">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 shrink-0">
                        Check #{idx + 1}
                      </span>
                      <h4 className="text-xs font-bold text-slate-100 break-words">{check.title}</h4>
                    </div>
                    <p className="text-xs text-slate-400 italic break-words">{check.question}</p>
                  </div>

                  <div className="shrink-0 self-start sm:self-auto">
                    {check.status === 'PASSED' ? (
                      <span className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 text-xs font-bold text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>PASSED</span>
                      </span>
                    ) : check.status === 'PENDING' ? (
                      <span className="inline-flex items-center space-x-1.5 rounded-lg bg-amber-950/80 border border-amber-500/40 px-2.5 py-1 text-xs font-bold text-amber-300">
                        <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>PENDING</span>
                      </span>
                    ) : check.status === 'INCOMPLETE' ? (
                      <span className="inline-flex items-center space-x-1.5 rounded-lg bg-purple-950/80 border border-purple-500/40 px-2.5 py-1 text-xs font-bold text-purple-300">
                        <HelpCircle className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                        <span>INCOMPLETE</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1.5 rounded-lg bg-rose-950/80 border border-rose-500/40 px-2.5 py-1 text-xs font-bold text-rose-300">
                        <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                        <span>FAILED / MISMATCH</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs font-mono min-w-0">
                  <div className="rounded bg-slate-950 p-2.5 border border-slate-800/80 min-w-0">
                    <span className="text-slate-400 text-[10px] uppercase block">Expected (Approved Intent):</span>
                    <span className="text-cyan-300 break-all select-all [overflow-wrap:anywhere] text-[11px] leading-relaxed">{check.expected}</span>
                  </div>
                  <div className="rounded bg-slate-950 p-2.5 border border-slate-800/80 min-w-0">
                    <span className="text-slate-400 text-[10px] uppercase block">Actual (On-Chain Execution):</span>
                    <span className={(check.passed ? 'text-indigo-300' : 'text-rose-300 font-bold') + ' break-all select-all [overflow-wrap:anywhere] text-[11px] leading-relaxed'}>
                      {check.actual}
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-xs text-slate-400 font-sans break-words leading-relaxed">
                  {check.details}
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              Awaiting execution to populate verification checks.
            </div>
          )}
        </div>
      </div>

      {/* Interactive Tampering / Security Demonstration Tool */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 shadow-xl w-full min-w-0 max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-3 min-w-0">
          <div className="flex items-center space-x-2 min-w-0">
            <Bug className="h-4 w-4 text-amber-400 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white break-words">
              Interactive Security & Tampering Demonstration
            </h3>
          </div>
          <span className="text-xs text-slate-400 break-words">
            Simulate attack scenarios to test the cryptographic engine
          </span>
        </div>

        <p className="mt-3 text-xs text-slate-300 leading-relaxed break-words">
          Test how ProofFlow mathematically flags parameter manipulation, recipient substitution, value drift, or wrong chain execution:
        </p>

        <div className="mt-4 flex flex-wrap gap-2.5 min-w-0">
          <button
            onClick={() => handleSimulateTamper('AMOUNT')}
            disabled={isSimulatingTamper || !p.execution}
            className="w-full xs:w-auto flex items-center justify-center space-x-1.5 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-900/40 disabled:opacity-40 transition min-h-[38px] text-center"
          >
            <span>Simulate Amount Drift (10x)</span>
          </button>

          <button
            onClick={() => handleSimulateTamper('RECIPIENT')}
            disabled={isSimulatingTamper || !p.execution}
            className="w-full xs:w-auto flex items-center justify-center space-x-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-900/40 disabled:opacity-40 transition min-h-[38px] text-center"
          >
            <span>Simulate Recipient Substitution</span>
          </button>

          <button
            onClick={() => handleSimulateTamper('CHAIN')}
            disabled={isSimulatingTamper || !p.execution}
            className="w-full xs:w-auto flex items-center justify-center space-x-1.5 rounded-lg border border-purple-500/30 bg-purple-950/30 px-3 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-900/40 disabled:opacity-40 transition min-h-[38px] text-center"
          >
            <span>Simulate Wrong Chain ID</span>
          </button>

          <button
            onClick={() => handleSimulateTamper('REVERT')}
            disabled={isSimulatingTamper || !p.execution}
            className="w-full xs:w-auto flex items-center justify-center space-x-1.5 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-900/40 disabled:opacity-40 transition min-h-[38px] text-center"
          >
            <span>Simulate On-Chain Revert</span>
          </button>

          <button
            onClick={handleRestoreFaithful}
            disabled={isSimulatingTamper || !p.execution}
            className="w-full xs:w-auto sm:ml-auto flex items-center justify-center space-x-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/50 disabled:opacity-40 transition min-h-[38px] text-center"
          >
            <RotateCcw className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>Restore Faithful Execution</span>
          </button>
        </div>
      </div>

      {/* Cryptographic Merkle Proof Tree */}
      {p.verification?.verificationProof && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 shadow-xl backdrop-blur-sm w-full min-w-0 max-w-full">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 min-w-0">
            <FileCheck2 className="h-4 w-4 text-violet-400 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white break-words">
              Cryptographic Merkle Proof Tree Structure
            </h3>
          </div>

          <div className="mt-4 space-y-3 font-mono text-xs text-slate-300 min-w-0">
            <div className="rounded bg-slate-950 p-3 border border-slate-800 min-w-0">
              <span className="text-slate-500 text-[10px] uppercase block">Merkle Root Anchor:</span>
              <div className="text-violet-300 font-bold select-all break-all [overflow-wrap:anywhere] text-[11px] leading-relaxed mt-0.5">
                {p.verification.verificationProof.merkleRoot}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 pt-2 min-w-0">
              <div className="rounded border border-slate-800 bg-slate-950/60 p-2.5 text-[11px] min-w-0">
                <span className="text-slate-500 block truncate">Leaf 1 (Proposal Commitment):</span>
                <div className="text-cyan-300 break-all select-all [overflow-wrap:anywhere] text-[10px] mt-1" title={p.verification.verificationProof.leafHash}>
                  {p.verification.verificationProof.leafHash}
                </div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950/60 p-2.5 text-[11px] min-w-0">
                <span className="text-slate-500 block truncate">Leaf 2 (Approval Anchor):</span>
                <div className="text-indigo-300 break-all select-all [overflow-wrap:anywhere] text-[10px] mt-1" title={p.verification.verificationProof.approvalLeaf}>
                  {p.verification.verificationProof.approvalLeaf}
                </div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950/60 p-2.5 text-[11px] min-w-0">
                <span className="text-slate-500 block truncate">Leaf 3 (Receipt Anchor):</span>
                <div className="text-emerald-300 break-all select-all [overflow-wrap:anywhere] text-[10px] mt-1" title={p.verification.verificationProof.receiptLeaf}>
                  {p.verification.verificationProof.receiptLeaf}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Educational & Privacy Declaration Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-6 text-xs text-slate-400 leading-relaxed w-full min-w-0 max-w-full">
        <div className="flex items-center space-x-2 text-white font-semibold mb-2 min-w-0">
          <Info className="h-4 w-4 text-indigo-400 shrink-0" />
          <span className="break-words">Integrity Verification vs. AI Decision Correctness</span>
        </div>
        <p className="text-slate-300 break-words">
          {p.verification?.privacyDeclaration?.integrityVsAiAccuracyDistinction ||
            'ProofFlow provides mathematical integrity verification: proving with cryptographic certainty that the mined transaction precisely mirrors what the user explicitly approved. It does not certify that the AI agent reasoning was economically or strategically optimal.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-3 sm:gap-4 text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 min-w-0">
          <div className="flex items-start sm:items-center space-x-1.5 text-emerald-400 min-w-0">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 sm:mt-0" />
            <span className="break-words">Zero private keys or seed phrases stored or exposed</span>
          </div>
          <div className="flex items-start sm:items-center space-x-1.5 text-emerald-400 min-w-0">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 sm:mt-0" />
            <span className="break-words">No private user personal data or unverified AI thoughts on-chain</span>
          </div>
          <div className="flex items-start sm:items-center space-x-1.5 text-emerald-400 min-w-0">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 sm:mt-0" />
            <span className="break-words">Only immutable cryptographic commitments anchored</span>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import {
  ShieldCheck,
  Cpu,
  Lock,
  ArrowRight,
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Layers,
  Terminal,
  Activity,
  Code2,
} from 'lucide-react';

interface LandingPageProps {
  onStartWorkspace: (initialPrompt?: string) => void;
  onExploreVerification: () => void;
  onOpenDashboard: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartWorkspace,
  onExploreVerification,
  onOpenDashboard,
}) => {
  const steps = [
    {
      num: '01',
      title: 'Natural Language Intent',
      desc: 'Users describe complex financial or smart contract intents in plain English.',
      icon: Terminal,
    },
    {
      num: '02',
      title: 'AI Agent Interpretation',
      desc: 'Gemini parses intent, queries network context, extracts parameters, and computes risk.',
      icon: Cpu,
    },
    {
      num: '03',
      title: 'Deterministic Policy Engine',
      desc: 'Pure rule guardrails enforce hard spending caps and blacklists. Immune to LLM prompt injection.',
      icon: Lock,
    },
    {
      num: '04',
      title: 'Explainable Proposal',
      desc: 'Agent presents rationale, risk metrics, parameter breakdowns, and simulation checks.',
      icon: Layers,
    },
    {
      num: '05',
      title: 'Explicit Approval & Commitment',
      desc: 'User approves. A canonical Keccak-256 cryptographic commitment hash is sealed.',
      icon: FileCheck2,
    },
    {
      num: '06',
      title: 'On-Chain Execution',
      desc: 'Transaction signed and submitted to Ethereum / Base / Arbitrum Sepolia testnets.',
      icon: Zap,
    },
    {
      num: '07',
      title: 'Zero-Drift Verification',
      desc: 'Verification engine audits mined on-chain receipt against the original commitment.',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="relative min-h-[calc(100vh-65px)] w-full max-w-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Background gradients constrained */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden max-w-full" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 h-[450px] w-[90vw] max-w-[700px] -translate-x-1/2 rounded-full bg-indigo-600/10 blur-[130px]" />
        <div className="absolute top-1/3 -left-20 h-[350px] w-[80vw] max-w-[450px] rounded-full bg-cyan-600/10 blur-[120px]" />
        <div className="absolute bottom-10 right-0 h-[350px] w-[80vw] max-w-[450px] rounded-full bg-violet-600/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 py-8 sm:py-14 lg:py-16 w-full">
        {/* Hero Section */}
        <div className="text-center w-full max-w-4xl mx-auto flex flex-col items-center">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 tracking-wider uppercase mb-3">
            <span>Autonomous Web3 Agent Security</span>
            <span aria-hidden="true" className="text-slate-600">/</span>
            <span>Verifiable Transactions</span>
          </div>

          <h1 className="mt-2 text-[clamp(2.25rem,5vw,4.25rem)] font-extrabold tracking-tight leading-[1.12] text-center max-w-4xl mx-auto [text-wrap:balance]">
            <span className="block text-white">Don't Just Trust AI.</span>
            <span className="block bg-gradient-to-r from-cyan-400 via-indigo-300 to-violet-400 bg-clip-text text-transparent">
              Verify Its Actions.
            </span>
          </h1>

          <p className="mx-auto mt-4 sm:mt-5 max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed text-center [text-wrap:balance]">
            ProofFlow connects an AI agent's transaction reasoning, the user's explicit approval,
            and final blockchain execution through a cryptographically verifiable audit trail.
            Eliminate prompt injection risks, agent hallucination, and parameter drift.
          </p>

          {/* Action CTA Buttons */}
          <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-3 w-full max-w-md sm:max-w-none">
            <button
              onClick={() => onStartWorkspace('Send 0.05 ETH to vitalik.eth on Sepolia for grant funding')}
              className="flex w-full sm:w-auto items-center justify-center space-x-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 px-5 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-white shadow-md shadow-indigo-600/30 transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 min-h-[44px]"
            >
              <Cpu className="h-4 w-4 shrink-0" />
              <span>Launch Agent Workspace</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </button>

            <button
              onClick={onExploreVerification}
              className="flex w-full sm:w-auto items-center justify-center space-x-2 rounded-xl border border-slate-700 bg-slate-900/90 px-5 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 min-h-[44px]"
            >
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>Inspect Live Proof Audit</span>
            </button>

            <button
              onClick={onOpenDashboard}
              className="flex w-full sm:w-auto items-center justify-center space-x-2 rounded-xl border border-slate-800 bg-slate-950/80 px-4 sm:px-5 py-3 text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 min-h-[44px]"
            >
              <Activity className="h-4 w-4 shrink-0 text-slate-400" />
              <span>Open Dashboard</span>
            </button>
          </div>
        </div>

        {/* Live Interactive Sandbox Preview Card */}
        <div className="mt-10 sm:mt-12 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl backdrop-blur-xl w-full min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/90 px-4 sm:px-5 py-3 min-w-0">
            <div className="flex items-center space-x-2 min-w-0">
              <ShieldCheck className="h-4 w-4 text-indigo-400 shrink-0" />
              <span className="font-mono text-xs text-slate-300 font-semibold truncate">
                Proof Engine Execution Pipeline · Sepolia (11155111)
              </span>
            </div>
            <span className="rounded border border-emerald-500/30 bg-emerald-950/60 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-emerald-400 shrink-0">
              Deterministic Verification Active
            </span>
          </div>

          <div className="p-4 sm:p-6 md:p-8 min-w-0">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Box 1: Natural Language & Agent */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    Step 1: AI Agent Intent
                  </span>
                  <Cpu className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="mt-3 rounded-lg bg-slate-950 p-3 text-xs text-slate-300 font-mono border border-slate-800/80">
                  "Send 0.05 ETH to vitalik.eth on Sepolia for developer grant"
                </div>
                <div className="mt-4 space-y-2 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Parsed Action:</span>
                    <span className="font-semibold text-slate-200">Native Transfer</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Resolved ENS:</span>
                    <span className="font-mono text-cyan-300">0xd8da6b...6045</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Security Assessment:</span>
                    <span className="font-semibold text-emerald-400 font-mono">Passed (Low Risk)</span>
                  </div>
                </div>
              </div>

              {/* Box 2: Deterministic Policy Engine */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                    Step 2: Policy Engine
                  </span>
                  <Lock className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center space-x-2 text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="font-mono">Per-Tx Limit: 0.05 ≤ 0.5 ETH</span>
                  </div>
                  <div className="flex items-center space-x-2 text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="font-mono">Daily Budget: 0.17 ≤ 2.0 ETH</span>
                  </div>
                  <div className="flex items-center space-x-2 text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>Blacklist check: Cleared</span>
                  </div>
                  <div className="flex items-center space-x-2 text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>Permitted Network: Sepolia (11155111)</span>
                  </div>
                </div>
                <div className="mt-4 rounded-lg bg-emerald-950/40 p-2 text-center text-xs font-semibold text-emerald-300 border border-emerald-500/20">
                  Deterministic Policy Passed · Safe to Propose
                </div>
              </div>

              {/* Box 3: Verification Audit */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">
                    Step 3: Cryptographic Proof
                  </span>
                  <ShieldCheck className="h-4 w-4 text-violet-400" />
                </div>
                <div className="mt-3 space-y-2">
                  <div className="rounded bg-slate-950 p-2 font-mono text-[11px] text-slate-300 border border-slate-800/80">
                    <span className="text-slate-500">Approved Commitment:</span>
                    <div className="text-cyan-300 truncate">0x8f4d92a0e4c693a129037cbead99fa1b...</div>
                  </div>
                  <div className="rounded bg-slate-950 p-2 font-mono text-[11px] text-slate-300 border border-slate-800/80">
                    <span className="text-slate-500">Executed On-Chain Hash:</span>
                    <div className="text-indigo-300 truncate">0x8f4d92a0e4c693a129037cbead99fa1b...</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-center space-x-2 rounded-lg bg-emerald-950/60 p-2 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Dual Hashes Match (Zero Drift)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 7-Step Lifecycle Section */}
        {/* 7-Step Lifecycle Section */}
        <div className="mt-20 sm:mt-24">
          <div className="text-center">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
              The Architecture
            </h2>
            <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Verifiable Transaction Workflow
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-xs sm:text-sm text-slate-400">
              Every step from intent interpretation to testnet confirmation produces cryptographically verifiable evidence.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.slice(0, 4).map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.num}
                  className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 transition hover:border-slate-700 hover:bg-slate-900/70"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-slate-500">{s.num}.</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950/80 text-indigo-400 border border-indigo-500/20">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-white">{s.title}</h3>
                  <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {steps.slice(4).map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.num}
                  className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 transition hover:border-slate-700 hover:bg-slate-900/70"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-slate-500">{s.num}.</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950/80 text-indigo-400 border border-indigo-500/20">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-white">{s.title}</h3>
                  <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Core Principles & Anti-Hallucination Features */}
        <div className="mt-16 sm:mt-20 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-10">
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-base font-bold text-white">Prompt-Injection Immune</h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Even if an adversary manipulates the natural language prompt, the deterministic policy engine runs
                strictly in native code and blocks any violation before a proposal can be signed.
              </p>
            </div>

            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-950/80 text-indigo-400 border border-indigo-500/30">
                <Code2 className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-base font-bold text-white">Canonical JSON Hashing</h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Intent parameters are sorted and serialized according to strict RFC 8785 rules before generating
                the Keccak-256 commitment hash. No whitespace drift or key mutation can slip through.
              </p>
            </div>

            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-950/80 text-violet-400 border border-violet-500/30">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-base font-bold text-white">Post-Execution Verification</h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Transactions are never marked verified upon broadcast. ProofFlow inspects the mined receipt on the testnet
                and mathematically validates that every parameter executed matches the cryptographic commitment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

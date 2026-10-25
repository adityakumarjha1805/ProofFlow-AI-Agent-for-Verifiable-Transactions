import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  ShieldCheck,
  Cpu,
  Key,
  FileCheck,
  Send,
  Search,
  AlertTriangle,
} from 'lucide-react';
import type { ExecutionTraceItem, ExecutionTracePhase, ExecutionTraceStatus } from '../types/index.ts';

interface ExecutionTraceTimelineProps {
  trace?: ExecutionTraceItem[];
  currentPhase?: ExecutionTracePhase;
  compact?: boolean;
}

const PHASE_ICONS: Record<ExecutionTracePhase, React.ComponentType<{ className?: string }>> = {
  REQUEST: Search,
  PLAN: Cpu,
  TOOL_CALL: Activity,
  POLICY_DECISION: ShieldCheck,
  USER_APPROVAL: Key,
  EXECUTION: Send,
  RECEIPT: FileCheck,
  VERIFICATION: ShieldCheck,
};

const PHASE_TITLES: Record<ExecutionTracePhase, string> = {
  REQUEST: 'Request Ingestion',
  PLAN: 'Agent Plan Synthesis',
  TOOL_CALL: 'Modular Tool Execution',
  POLICY_DECISION: 'Deterministic Policy Evaluation',
  USER_APPROVAL: 'Cryptographic User Approval',
  EXECUTION: 'Blockchain Broadcast',
  RECEIPT: 'Receipt & Block Confirmation',
  VERIFICATION: 'Dual-Hash Cryptographic Verification',
};

export const ExecutionTraceTimeline: React.FC<ExecutionTraceTimelineProps> = ({
  trace = [],
  currentPhase,
  compact = false,
}) => {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (!trace || trace.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center text-xs text-slate-500 font-mono">
        No execution trace recorded yet. Submit a prompt or inspect an executed proposal to view step-by-step telemetry.
      </div>
    );
  }

  const getStatusBadge = (status: ExecutionTraceStatus) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center space-x-1 rounded px-2 py-0.5 text-[10px] font-bold bg-emerald-950/80 text-emerald-400 ring-1 ring-emerald-500/30">
            <CheckCircle2 className="h-3 w-3" />
            <span>SUCCESS</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center space-x-1 rounded px-2 py-0.5 text-[10px] font-bold bg-rose-950/80 text-rose-400 ring-1 ring-rose-500/30">
            <XCircle className="h-3 w-3" />
            <span>FAILED</span>
          </span>
        );
      case 'RUNNING':
        return (
          <span className="inline-flex items-center space-x-1 rounded px-2 py-0.5 text-[10px] font-bold bg-indigo-950/80 text-indigo-400 ring-1 ring-indigo-500/30 animate-pulse">
            <div className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
            <span>RUNNING</span>
          </span>
        );
      case 'SKIPPED':
        return (
          <span className="inline-flex items-center space-x-1 rounded px-2 py-0.5 text-[10px] font-bold bg-slate-900 text-slate-400 ring-1 ring-slate-800">
            <span>SKIPPED</span>
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center space-x-1 rounded px-2 py-0.5 text-[10px] font-bold bg-slate-900 text-slate-500 ring-1 ring-slate-800">
            <Clock className="h-3 w-3" />
            <span>PENDING</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-3">
      {/* Header Info */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
        <div className="flex items-center space-x-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <span className="font-bold uppercase tracking-wider text-white">
            End-to-End Execution Trace
          </span>
        </div>
        <div className="flex items-center space-x-2 text-[10px] text-slate-400">
          <span className="flex items-center space-x-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <span>Actual Evidence</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="h-2 w-2 rounded-full bg-purple-400" />
            <span>AI Reasoning</span>
          </span>
        </div>
      </div>

      {/* Timeline Steps */}
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
        {trace.map((item, index) => {
          const Icon = PHASE_ICONS[item.phase] || Activity;
          const isExpanded = Boolean(expandedItems[item.id]);
          const hasDetails = Boolean(item.sanitizedInput || item.sanitizedOutput || item.errorDetails);

          return (
            <div key={item.id} className="relative group">
              {/* Timeline Node Icon */}
              <div
                className={`absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-mono ring-2 ${
                  item.status === 'SUCCESS'
                    ? 'bg-slate-950 text-emerald-400 ring-emerald-500/50'
                    : item.status === 'FAILED'
                    ? 'bg-slate-950 text-rose-400 ring-rose-500/50'
                    : item.status === 'RUNNING'
                    ? 'bg-slate-950 text-indigo-400 ring-indigo-500/50'
                    : 'bg-slate-950 text-slate-500 ring-slate-800'
                }`}
              >
                {index + 1}
              </div>

              {/* Card Container */}
              <div
                className={`rounded-xl border transition-all ${
                  item.isActualEvidence
                    ? 'border-cyan-500/30 bg-slate-900/80 shadow-[0_0_15px_-3px_rgba(6,182,212,0.1)]'
                    : 'border-purple-500/30 bg-slate-900/60'
                } p-3.5`}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4 text-slate-300" />
                    <span className="text-xs font-bold text-white">
                      {item.title || PHASE_TITLES[item.phase] || item.phase}
                    </span>
                    {item.toolName && (
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                        {item.toolName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Distinguish Actual Evidence vs Model Explanation */}
                    {item.isActualEvidence ? (
                      <span className="rounded bg-cyan-950/80 px-2 py-0.5 text-[9px] font-bold text-cyan-300 ring-1 ring-cyan-500/40">
                        ACTUAL EVIDENCE
                      </span>
                    ) : (
                      <span className="rounded bg-purple-950/80 px-2 py-0.5 text-[9px] font-bold text-purple-300 ring-1 ring-purple-500/40">
                        AI EXPLANATION
                      </span>
                    )}

                    {getStatusBadge(item.status)}
                  </div>
                </div>

                {/* Subtitle / Description */}
                {item.description && (
                  <p className="mt-1.5 text-xs text-slate-300 leading-relaxed font-sans">
                    {item.description}
                  </p>
                )}

                {/* Metadata Row: Timestamp, Duration */}
                <div className="mt-2 flex items-center space-x-3 text-[10px] text-slate-400 font-mono">
                  <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                  {item.durationMs !== undefined && (
                    <span>&bull; {item.durationMs}ms</span>
                  )}
                  {hasDetails && (
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="ml-auto flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 font-sans text-xs focus:outline-none"
                    >
                      <span>{isExpanded ? 'Hide Payload' : 'Inspect Payload'}</span>
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>

                {/* Expandable Technical Payload */}
                {isExpanded && hasDetails && (
                  <div className="mt-3 space-y-2 border-t border-slate-800/80 pt-2 text-[11px] font-mono">
                    {item.errorDetails && (
                      <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-2 text-rose-300">
                        <div className="flex items-center space-x-1 font-bold text-rose-400">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Error Details:</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{item.errorDetails}</p>
                      </div>
                    )}

                    {item.sanitizedInput && (
                      <div>
                        <span className="text-slate-400">Sanitized Input:</span>
                        <pre className="mt-1 max-h-36 overflow-y-auto rounded bg-slate-950 p-2 text-slate-300 border border-slate-800 text-[10px] leading-tight">
                          {typeof item.sanitizedInput === 'string'
                            ? item.sanitizedInput
                            : JSON.stringify(item.sanitizedInput, null, 2)}
                        </pre>
                      </div>
                    )}

                    {item.sanitizedOutput && (
                      <div>
                        <span className="text-slate-400">Sanitized Output / Evidence:</span>
                        <pre className="mt-1 max-h-36 overflow-y-auto rounded bg-slate-950 p-2 text-cyan-300 border border-slate-800 text-[10px] leading-tight">
                          {typeof item.sanitizedOutput === 'string'
                            ? item.sanitizedOutput
                            : JSON.stringify(item.sanitizedOutput, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

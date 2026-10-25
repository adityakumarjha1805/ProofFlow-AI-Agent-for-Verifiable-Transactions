import type {
  SupportedChainId,
  RiskLevel,
  DeterministicPolicyConfig,
  AgentExecutionPlan,
  ExecutionTraceItem,
  PlanStep,
} from '../types/index.ts';

export type { AgentExecutionPlan, ExecutionTraceItem, PlanStep };

export type AgentActionType = 'transfer' | 'contract_call' | 'token_swap' | 'approve' | 'unknown';

export interface ExtractedIntent {
  action: AgentActionType;
  network: string; // e.g. "ethereum-sepolia", "base-sepolia", "arbitrum-sepolia"
  chainId: SupportedChainId;
  asset: string; // "ETH", "USDC", etc.
  amount: string; // "0.05"
  recipient: string; // "0x..."
  recipientLabel?: string;
  calldata?: string;
  userConditions?: string[];
}

export interface ToolExecutionRecord {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  status: 'SUCCESS' | 'ERROR' | 'UNAVAILABLE';
  error?: string;
  executedAt: string;
  durationMs: number;
}

export interface AgentCheckItem {
  id: string;
  category: 'BALANCE' | 'NETWORK' | 'ADDRESS' | 'FEE' | 'POLICY' | 'RISK';
  name: string;
  passed: boolean;
  status: 'PASSED' | 'FAILED' | 'WARNING' | 'UNAVAILABLE';
  details: string;
}

export type AgentStatus =
  | 'proposal_ready'
  | 'needs_clarification'
  | 'policy_blocked'
  | 'security_alert'
  | 'error';

export interface StructuredAgentResponse {
  status: AgentStatus;
  intent: ExtractedIntent;
  checks: AgentCheckItem[];
  risk_level: RiskLevel | 'UNKNOWN';
  missing_information: string[];
  requires_user_approval: boolean;
  explanation: string;
  recommendation?: string;
  toolExecutions: ToolExecutionRecord[];
  clarificationQuestion?: string;
  proposalId?: string;
  plan?: AgentExecutionPlan;
  executionTrace?: ExecutionTraceItem[];
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  toolExecutions?: ToolExecutionRecord[];
  structuredResponse?: StructuredAgentResponse;
  plan?: AgentExecutionPlan;
  executionTrace?: ExecutionTraceItem[];
}

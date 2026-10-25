export type SupportedChainId = 11155111 | 84532 | 421614 | 1;

export interface ChainConfig {
  id: SupportedChainId;
  name: string;
  shortName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrl: string;
  explorerUrl: string;
  isTestnet: boolean;
}

export const SUPPORTED_CHAINS: Record<SupportedChainId, ChainConfig> = {
  11155111: {
    id: 11155111,
    name: 'Ethereum Sepolia Testnet',
    shortName: 'Sepolia',
    nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    isTestnet: true,
  },
  84532: {
    id: 84532,
    name: 'Base Sepolia Testnet',
    shortName: 'Base Sepolia',
    nativeCurrency: { name: 'Base Sepolia ETH', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    isTestnet: true,
  },
  421614: {
    id: 421614,
    name: 'Arbitrum Sepolia Testnet',
    shortName: 'Arb Sepolia',
    nativeCurrency: { name: 'Arbitrum Sepolia ETH', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorerUrl: 'https://sepolia.arbiscan.io',
    isTestnet: true,
  },
  1: {
    id: 1,
    name: 'Ethereum Mainnet',
    shortName: 'Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://cloudflare-eth.com',
    explorerUrl: 'https://etherscan.io',
    isTestnet: false,
  },
};

export type ActionType = 'TRANSFER' | 'CONTRACT_CALL' | 'TOKEN_SWAP' | 'APPROVE';

export interface TransactionIntent {
  rawPrompt: string;
  actionType: ActionType;
  recipient: string;
  recipientLabel?: string;
  amount: string; // formatted decimal string e.g. "0.05"
  tokenSymbol: string;
  chainId: SupportedChainId;
  calldata: string; // '0x' or hex
  purposeExplanation: string;
  estimatedGasEth: string;
  maxPriorityFeePerGasGwei?: string;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskFactor {
  factor: string;
  level: RiskLevel;
  description: string;
  passed: boolean;
}

export interface RiskAssessment {
  overallLevel: RiskLevel;
  riskScore: number; // 0 to 100
  summary: string;
  factors: RiskFactor[];
  simulationResult?: {
    success: boolean;
    balanceChange: string;
    gasUsedEstimate: number;
    warnings: string[];
  };
}

export interface PolicyRuleResult {
  ruleId: string;
  name: string;
  description: string;
  passed: boolean;
  severity: 'BLOCK' | 'WARN';
  message: string;
}

export interface PolicyEvaluation {
  passed: boolean;
  hasBlockingViolations: boolean;
  warningsCount: number;
  evaluatedAt: string;
  results: PolicyRuleResult[];
}

export interface DeterministicPolicyConfig {
  maxSingleTxEth: number;
  maxDailyTxEth: number;
  currentDailySpentEth: number;
  allowedChains: SupportedChainId[];
  whitelistedAddresses: string[];
  blockedAddresses: string[];
  requireApprovalAboveEth: number;
  maxGasPriceGwei: number;
  allowContractInteraction: boolean;
}

export interface CanonicalTransactionData {
  proposalId: string;
  chainId: number;
  sender: string;
  recipient: string;
  asset: string;
  amountInBaseUnits: string; // e.g. "50000000000000000" wei
  transactionType: string;
  calldata: string;
  policyVersion: string;
  proposalTimestamp: string;
}

export interface CryptographicCommitment {
  commitmentHash: string; // Keccak-256 canonical hash
  sha256Hash: string;     // Standard NIST FIPS-180-4 SHA-256
  canonicalPayload: CanonicalTransactionData;
  canonicalPayloadJson: string;
  committedAt: string;
  signerAddress?: string;
  nonce?: number;
  signature?: string;
}

export interface ApprovalEvidence {
  walletAddress: string;
  approvedCommitmentHash: string; // SHA-256 commitment of the canonical proposal
  approvalMethod: 'WALLET_PERSONAL_SIGN' | 'WALLET_EIP712' | 'WALLET_EXPLICIT_CONSENT';
  signature?: string;
  approvedAt: string;
  /** Explicit verification note: Ordinary on-chain tx signatures do not automatically sign proposal commitments */
  distinctFromTxSignature: true;
  userApprovalNotes?: string;
}

export interface ExecutionReceipt {
  txHash: string;
  blockNumber: number;
  from: string;
  to: string;
  valueEth: string;
  valueBaseUnits?: string;
  chainId: SupportedChainId;
  calldata: string;
  gasUsed: number;
  effectiveGasPriceGwei: string;
  status: 'SUCCESS' | 'REVERTED' | 'PENDING';
  explorerUrl: string;
  executedAt: string;
  mode: 'DEMO_TESTNET' | 'LIVE_WALLET';
}

export interface ParameterDiffItem {
  field: string;
  intentValue: string;
  executedValue: string;
  matches: boolean;
  critical: boolean;
}

export type VerificationStatus =
  | 'VERIFIED'
  | 'MISMATCH'
  | 'PENDING'
  | 'FAILED'
  | 'INCOMPLETE';

export interface VerificationCheckItem {
  id: string;
  title: string;
  question: string;
  expected: string;
  actual: string;
  passed: boolean;
  status: 'PASSED' | 'FAILED' | 'PENDING' | 'INCOMPLETE';
  details: string;
}

export interface VerificationAudit {
  id?: string;
  status: VerificationStatus;
  commitmentHash: string;
  sha256CommitmentHash: string;
  executedPayloadHash: string;
  recomputedCommitmentHash: string;
  hashesMatch: boolean;
  parameterDiffs: ParameterDiffItem[];
  checks: {
    commitmentMatch: VerificationCheckItem;
    approverMatch: VerificationCheckItem;
    senderMatch: VerificationCheckItem;
    recipientMatch: VerificationCheckItem;
    amountMatch: VerificationCheckItem;
    chainMatch: VerificationCheckItem;
    receiptSuccess: VerificationCheckItem;
    transactionReferenceValid: VerificationCheckItem;
  };
  discrepancies: string[];
  verifiedAt: string;
  verificationProof: {
    merkleRoot: string;
    leafHash: string;
    approvalLeaf: string;
    receiptLeaf: string;
    proofSteps: string[];
    verifierVersion: string;
  };
  auditSummary: string;
  privacyDeclaration: {
    privateKeyStored: false;
    onChainAiReasoningExposed: false;
    integrityVsAiAccuracyDistinction: string;
  };
}

export type ProposalStatus =
  | 'DRAFT'
  | 'ANALYZED'
  | 'POLICY_PASSED'
  | 'POLICY_VIOLATION'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'VERIFIED'
  | 'VERIFICATION_FAILED';

export type ExecutionTracePhase =
  | 'REQUEST'
  | 'PLAN'
  | 'TOOL_CALL'
  | 'POLICY_DECISION'
  | 'USER_APPROVAL'
  | 'EXECUTION'
  | 'RECEIPT'
  | 'VERIFICATION';

export type ExecutionTraceStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'SKIPPED';

export interface ExecutionTraceItem {
  id: string;
  phase: ExecutionTracePhase;
  title: string;
  timestamp: string;
  status: ExecutionTraceStatus;
  isActualEvidence: boolean;
  toolName?: string;
  description?: string;
  sanitizedInput?: Record<string, unknown> | string;
  sanitizedOutput?: Record<string, unknown> | string;
  errorDetails?: string;
  durationMs?: number;
}

export interface PlanStep {
  id: string;
  stepNumber: number;
  title: string;
  toolToUse?: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  rationale: string;
  outcome?: string;
}

export interface AgentExecutionPlan {
  id: string;
  goal: string;
  steps: PlanStep[];
  currentStepIndex: number;
  isComplete: boolean;
  requiresClarification: boolean;
  clarificationMessage?: string;
  plannedAt: string;
}

export interface TransactionProposal {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ProposalStatus;
  userPrompt: string;
  intent: TransactionIntent;
  riskAssessment: RiskAssessment;
  policyEvaluation: PolicyEvaluation;
  commitment?: CryptographicCommitment;
  approvalEvidence?: ApprovalEvidence;
  execution?: ExecutionReceipt;
  verification?: VerificationAudit;
  approvalNotes?: string;
  plan?: AgentExecutionPlan;
  executionTrace?: ExecutionTraceItem[];
  deterministicEvaluation?: import('../policy/types.ts').DeterministicEvaluationResult;
}

export interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: SupportedChainId | null;
  balanceEth: string;
  networkName: string;
  providerAvailable: boolean;
}

export * from './database.ts';

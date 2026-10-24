import type {
  TransactionIntent,
  RiskAssessment,
  PolicyEvaluation,
  CryptographicCommitment,
  ApprovalEvidence,
  ExecutionReceipt,
  VerificationAudit,
  ProposalStatus,
  VerificationStatus,
  PolicyRuleResult,
  CanonicalTransactionData,
} from './index.ts';

// 1. Transaction Proposal Record
export interface ProposalRecord {
  id: string;                               // Unique proposal ID
  userWalletAddress: string;                // Canonical lowercase address of proposal initiator
  userPrompt: string;                       // Preserved original user request
  intent: TransactionIntent;                // Canonical intent
  amountInBaseUnits: string;                // Safe integer string (e.g. "50000000000000000" wei)
  status: ProposalStatus;                   // Current application proposal status
  riskAssessment: RiskAssessment;
  commitment?: CryptographicCommitment;
  createdAt: string;                        // ISO-8601 creation timestamp
  updatedAt: string;                        // ISO-8601 last update timestamp
  isArchived?: boolean;
}

// 2. Policy Evaluation Record
export interface PolicyEvaluationRecord {
  id: string;                               // Unique record ID (pol-xxx)
  proposalId: string;                       // Reference to ProposalRecord.id
  userWalletAddress: string;
  policyVersion: string;
  passed: boolean;
  hasBlockingViolations: boolean;
  warningsCount: number;
  results: PolicyRuleResult[];
  maxSingleTxEth: number;
  maxDailyTxEth: number;
  evaluatedAt: string;                      // ISO-8601
}

// 3. User Approval Evidence Record
export interface ApprovalEvidenceRecord {
  id: string;                               // Unique record ID (appr-xxx)
  proposalId: string;                       // Reference to ProposalRecord.id
  walletAddress: string;                    // Signer address
  approvedCommitmentHash: string;           // Canonical commitment hash that was approved
  approvalMethod: 'WALLET_PERSONAL_SIGN' | 'WALLET_EIP712' | 'WALLET_EXPLICIT_CONSENT';
  signature?: string;                       // Cryptographic signature over proposal commitment
  distinctFromTxSignature: true;            // Strict architectural flag
  userApprovalNotes?: string;
  approvedAt: string;                       // ISO-8601
}

// 4. Blockchain Transaction Record (Immutable evidence)
export interface BlockchainTransactionRecord {
  id: string;                               // Unique record ID (bctx-xxx)
  proposalId: string;                       // Reference to ProposalRecord.id
  txHash: string;                           // Mined transaction hash (0x + 64 hex characters)
  blockNumber: number;                      // Mined block number
  fromAddress: string;                      // Sender wallet
  toAddress: string;                        // Target recipient
  valueBaseUnits: string;                   // Exact integer base units (wei) as string
  valueEth: string;                         // Human-readable amount
  chainId: number;                          // Chain ID (e.g. 11155111 Sepolia)
  calldata: string;
  gasUsed: number;
  effectiveGasPriceGwei: string;
  status: 'SUCCESS' | 'REVERTED' | 'PENDING';
  explorerUrl: string;
  executedAt: string;                       // ISO-8601
  mode: 'LIVE_WALLET' | 'DEMO_TESTNET';
  isImmutable: true;                        // Immutable blockchain evidence
}

// 5. Verification Result Record
export interface VerificationResultRecord {
  id: string;                               // Unique record ID (vrfy-xxx)
  proposalId: string;                       // Reference to ProposalRecord.id
  txHash: string;
  status: VerificationStatus;               // 'VERIFIED' | 'MISMATCH' | 'PENDING' | 'FAILED' | 'INCOMPLETE'
  isCommitmentValid: boolean;
  isApproverValid: boolean;
  isSenderValid: boolean;
  isRecipientValid: boolean;
  isAmountValid: boolean;
  isChainValid: boolean;
  isReceiptSuccess: boolean;
  isTransactionReferenceValid: boolean;
  recomputedSha256: string;
  auditSummary: string;
  discrepancies: string[];
  auditData: VerificationAudit;
  verifiedAt: string;                       // ISO-8601
  verifiedBy: 'SERVER_AUTHORITATIVE_ENGINE';
}

// 6. Audit Event Record
export type AuditEventType =
  | 'PROPOSAL_CREATED'
  | 'POLICY_EVALUATED'
  | 'COMMITMENT_GENERATED'
  | 'APPROVAL_RECORDED'
  | 'TX_SUBMITTED'
  | 'TX_MINED'
  | 'VERIFICATION_EXECUTED'
  | 'TAMPER_DETECTED'
  | 'SIMULATED_TAMPER_TEST'
  | 'RESTORE_FAITHFUL_TEST'
  | 'PROPOSAL_VIEWED';

export interface AuditEventRecord {
  id: string;                               // Unique audit event ID
  proposalId: string;
  eventType: AuditEventType;
  actorWalletAddress?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, unknown>;
  timestamp: string;                        // ISO-8601
}

// Pagination & Query Interfaces
export interface ProposalQueryFilters {
  page?: number;
  limit?: number;
  status?: string;
  network?: string;
  search?: string;
  walletAddress?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Database Connection Status Information
export interface DatabaseStatus {
  driver: 'MONGODB_ATLAS' | 'PERSISTENT_FILE_STORAGE';
  connected: boolean;
  databaseName: string;
  indexesConfigured: boolean;
  stats: {
    proposalsCount: number;
    policiesCount: number;
    approvalsCount: number;
    transactionsCount: number;
    verificationsCount: number;
    auditEventsCount: number;
  };
  securityInfo: {
    sslEnforced: boolean;
    secretsStoredSeparately: boolean;
    privateKeysBlocked: boolean;
    authEnforced: boolean;
  };
  errorMessage?: string;
}

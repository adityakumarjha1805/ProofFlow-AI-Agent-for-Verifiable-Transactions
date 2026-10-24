export type PolicyDecision =
  | 'APPROVED_FOR_REVIEW'
  | 'REQUIRES_ADDITIONAL_APPROVAL'
  | 'REJECTED'
  | 'INCOMPLETE';

export type CheckStatus = 'PASSED' | 'FAILED' | 'UNKNOWN';

export interface RuleResultItem {
  ruleId: string;
  ruleName: string;
  description: string;
  status: CheckStatus;
  severity: 'BLOCKING' | 'WARNING' | 'ADVISORY';
  message: string;
  details?: Record<string, unknown>;
}

export interface PolicyAuditLogEntry {
  timestamp: string;
  action: string;
  ruleId: string;
  outcome: CheckStatus;
  inputValues: Record<string, unknown>;
  reason: string;
}

export interface TokenPrecisionConfig {
  symbol: string;
  decimals: number;
}

export const KNOWN_TOKEN_PRECISION: Record<string, TokenPrecisionConfig> = {
  ETH: { symbol: 'ETH', decimals: 18 },
  WETH: { symbol: 'WETH', decimals: 18 },
  USDC: { symbol: 'USDC', decimals: 6 },
  USDT: { symbol: 'USDT', decimals: 6 },
  DAI: { symbol: 'DAI', decimals: 18 },
};

export interface DeterministicPolicySchema {
  policyVersion: string;
  allowedNetworks: string[];
  allowedAssets: string[];
  // Amounts stored as strict decimal strings to avoid float inaccuracies
  maximumTransactionAmount: Record<string, string>;
  maximumDailySpending: Record<string, string>;
  currentDailySpending: Record<string, string>;
  requireApprovalAbove: Record<string, string>;
  requireApproval: boolean;
  blockUnknownRisk: boolean;
  maxFeeGwei: string;
  whitelistedRecipients: string[];
  blacklistedRecipients: string[];
}

export interface TotalCostCalculation {
  asset: string;
  amountBaseUnit: string; // e.g. wei as BigInt string
  feeBaseUnit: string;
  totalBaseUnit: string;
  formattedAmount: string;
  formattedFee: string;
  formattedTotal: string;
  balanceBaseUnit?: string;
  isSufficientBalance: boolean;
}

export interface DeterministicEvaluationResult {
  policyVersion: string;
  proposalId: string;
  overallDecision: PolicyDecision;
  individualRuleResults: RuleResultItem[];
  passedChecks: string[];
  failedChecks: string[];
  unknownChecks: string[];
  totalCost: TotalCostCalculation;
  auditLog: PolicyAuditLogEntry[];
  evaluationTimestamp: string;
  summaryExplanation: string;
}

export interface PolicyEvaluationInput {
  proposalId: string;
  network: string;
  asset: string;
  amount: string; // decimal string e.g. "0.05"
  recipient: string;
  senderAddress?: string;
  availableBalance?: string; // decimal string
  estimatedFeeEth?: string;
  calldata?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
  rawPrompt?: string;
}

import type {
  TransactionIntent,
  DeterministicPolicyConfig,
  PolicyEvaluation,
  PolicyRuleResult,
} from '../types/index.ts';

export const DEFAULT_POLICY_CONFIG: DeterministicPolicyConfig = {
  maxSingleTxEth: 0.5,
  maxDailyTxEth: 2.0,
  currentDailySpentEth: 0.12,
  allowedChains: [11155111, 84532, 421614], // Sepolia, Base Sepolia, Arb Sepolia
  whitelistedAddresses: [
    '0xd8da6bf26964af9d7eed9e03e53415d37aa96045', // vitalik.eth
    '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c', // Treasury Multi-sig
    '0x000000000000000000000000000000000000dead', // Burn address
  ],
  blockedAddresses: [
    '0x0000000000000000000000000000000000000000', // Zero address trap
    '0x111111125421ca6dc452d289314280a0f8842a65', // Example flagged malicious address
  ],
  requireApprovalAboveEth: 0.1,
  maxGasPriceGwei: 50,
  allowContractInteraction: true,
};

/**
 * Validates whether an Ethereum address format is syntactically valid
 */
export function isValidAddress(address: string): boolean {
  if (!address) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

/**
 * Deterministic policy engine: checks all rules against the transaction intent
 */
export function evaluatePolicy(
  intent: TransactionIntent,
  config: DeterministicPolicyConfig = DEFAULT_POLICY_CONFIG
): PolicyEvaluation {
  const results: PolicyRuleResult[] = [];
  const normalizedRecipient = intent.recipient.toLowerCase().trim();
  const txAmount = parseFloat(intent.amount) || 0;

  // 1. Syntactic Address Check
  const addressValid = isValidAddress(normalizedRecipient);
  results.push({
    ruleId: 'SYNTAX_VALID_ADDRESS',
    name: 'Valid EVM Address Syntax',
    description: 'Target address must be a valid 40-character hex EVM address',
    passed: addressValid,
    severity: 'BLOCK',
    message: addressValid
      ? `Recipient format verified: ${normalizedRecipient.slice(0, 8)}...`
      : `Invalid address structure: "${intent.recipient}"`,
  });

  // 2. Blocked / Malicious Address Check
  const isBlocked = config.blockedAddresses
    .map((a) => a.toLowerCase().trim())
    .includes(normalizedRecipient);
  results.push({
    ruleId: 'SANCTION_OR_BLOCKED_ADDRESS',
    name: 'Sanction & Blacklist Guard',
    description: 'Recipient must not be on the prohibited or zero-address list',
    passed: !isBlocked,
    severity: 'BLOCK',
    message: isBlocked
      ? `Blocked address detected! ${normalizedRecipient} is restricted.`
      : 'Recipient passed blacklist & sanctions check.',
  });

  // 3. Maximum Single Transaction Limit
  const underSingleLimit = txAmount <= config.maxSingleTxEth;
  results.push({
    ruleId: 'MAX_SINGLE_TX_LIMIT',
    name: 'Per-Transaction Limit',
    description: `Transaction value must not exceed ${config.maxSingleTxEth} ETH`,
    passed: underSingleLimit,
    severity: 'BLOCK',
    message: underSingleLimit
      ? `Amount (${txAmount} ETH) is within maximum limit of ${config.maxSingleTxEth} ETH.`
      : `Limit exceeded: Requested ${txAmount} ETH exceeds policy maximum of ${config.maxSingleTxEth} ETH.`,
  });

  // 4. Daily Cumulative Budget Check
  const projectedDailySpend = config.currentDailySpentEth + txAmount;
  const underDailyLimit = projectedDailySpend <= config.maxDailyTxEth;
  results.push({
    ruleId: 'DAILY_CUMULATIVE_LIMIT',
    name: 'Daily Spending Cap',
    description: `Cumulative daily volume must stay under ${config.maxDailyTxEth} ETH`,
    passed: underDailyLimit,
    severity: 'BLOCK',
    message: underDailyLimit
      ? `Projected daily total (${projectedDailySpend.toFixed(3)} ETH) is within ${config.maxDailyTxEth} ETH limit.`
      : `Daily cap breach: Projected ${projectedDailySpend.toFixed(3)} ETH would exceed daily limit (${config.maxDailyTxEth} ETH).`,
  });

  // 5. Allowed Networks Guard
  const chainAllowed = config.allowedChains.includes(intent.chainId);
  results.push({
    ruleId: 'PERMITTED_NETWORK',
    name: 'Allowed Blockchain Network',
    description: 'Transaction must target an authorized testnet or mainnet network',
    passed: chainAllowed,
    severity: 'BLOCK',
    message: chainAllowed
      ? `Network (Chain ID: ${intent.chainId}) is permitted.`
      : `Network chainId ${intent.chainId} is not in the allowed list: [${config.allowedChains.join(', ')}]`,
  });

  // 6. Whitelisted Recipient Advisory
  const isWhitelisted = config.whitelistedAddresses
    .map((a) => a.toLowerCase().trim())
    .includes(normalizedRecipient);
  results.push({
    ruleId: 'TRUSTED_ADDRESS_BOOK',
    name: 'Known Beneficiary Verification',
    description: 'Advisory check whether recipient is registered in trusted contacts',
    passed: isWhitelisted,
    severity: 'WARN',
    message: isWhitelisted
      ? 'Recipient is a registered trusted beneficiary.'
      : 'Recipient is not in your address book. Extra visual review recommended.',
  });

  // 7. High Value Explicit Confirmation Requirement
  const requiresHighValueWarning = txAmount >= config.requireApprovalAboveEth;
  results.push({
    ruleId: 'HIGH_VALUE_THRESHOLD',
    name: 'High-Value Multi-Factor Warning',
    description: `Transactions above ${config.requireApprovalAboveEth} ETH require heightened scrutiny`,
    passed: !requiresHighValueWarning,
    severity: 'WARN',
    message: requiresHighValueWarning
      ? `Amount (${txAmount} ETH) exceeds threshold (${config.requireApprovalAboveEth} ETH) requiring high attention.`
      : 'Standard transaction value threshold satisfied.',
  });

  // Compute final verdict
  const blockingViolations = results.filter((r) => !r.passed && r.severity === 'BLOCK');
  const warnings = results.filter((r) => !r.passed && r.severity === 'WARN');

  return {
    passed: blockingViolations.length === 0,
    hasBlockingViolations: blockingViolations.length > 0,
    warningsCount: warnings.length,
    evaluatedAt: new Date().toISOString(),
    results,
  };
}

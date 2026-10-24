import { isAddress, getAddress } from 'viem';
import type {
  DeterministicPolicySchema,
  DeterministicEvaluationResult,
  PolicyEvaluationInput,
  RuleResultItem,
  PolicyAuditLogEntry,
  TotalCostCalculation,
  PolicyDecision,
  CheckStatus,
} from './types.ts';
import { KNOWN_TOKEN_PRECISION } from './types.ts';

export const DEFAULT_DETERMINISTIC_POLICY: DeterministicPolicySchema = {
  policyVersion: '2.0.0-DETERMINISTIC',
  allowedNetworks: ['ethereum-sepolia', 'base-sepolia', 'arbitrum-sepolia'],
  allowedAssets: ['ETH', 'WETH', 'USDC'],
  maximumTransactionAmount: {
    ETH: '0.5',
    WETH: '0.5',
    USDC: '1500.0',
  },
  maximumDailySpending: {
    ETH: '2.0',
    WETH: '2.0',
    USDC: '5000.0',
  },
  currentDailySpending: {
    ETH: '0.12',
    WETH: '0.0',
    USDC: '0.0',
  },
  requireApprovalAbove: {
    ETH: '0.1',
    WETH: '0.1',
    USDC: '300.0',
  },
  requireApproval: true, // Required for all MVP transactions
  blockUnknownRisk: true,
  maxFeeGwei: '50',
  whitelistedRecipients: [
    '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // vitalik.eth
    '0x71C6bF12F455ddfe62Ec542866b595Fa6B78d91C', // Treasury Multi-sig
  ],
  blacklistedRecipients: [
    '0x0000000000000000000000000000000000000000', // Zero address trap
    '0x000000000000000000000000000000000000dEaD', // Burn address
    '0x111111125421ca6dc452d289314280a0f8842a65', // Flagged malicious address
  ],
};

/**
 * Arbitrary-precision base unit conversion without floating-point math.
 * Converts "0.05" with 18 decimals to 50000000000000000n wei.
 */
export function parseBaseUnits(amountStr: string, decimals: number): bigint {
  const trimmed = (amountStr || '').trim();
  if (!trimmed) {
    throw new Error('Amount cannot be empty');
  }

  // Reject negative amounts or non-numeric strings
  if (trimmed.startsWith('-') || !/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid numeric amount representation: "${trimmed}"`);
  }

  const [whole, fraction = ''] = trimmed.split('.');

  // Enforce decimal precision limit
  if (fraction.length > decimals) {
    throw new Error(
      `Fractional precision (${fraction.length} decimals) exceeds asset limit of ${decimals} decimals.`
    );
  }

  const paddedFraction = fraction.padEnd(decimals, '0');
  const integerString = `${whole}${paddedFraction}`.replace(/^0+(?=\d)/, '');

  return BigInt(integerString || '0');
}

/**
 * Formats base units to human readable decimal string without float math.
 */
export function formatBaseUnits(baseUnit: bigint, decimals: number): string {
  const isNegative = baseUnit < 0n;
  const abs = isNegative ? -baseUnit : baseUnit;
  const str = abs.toString().padStart(decimals + 1, '0');
  const whole = str.slice(0, str.length - decimals);
  const fraction = str.slice(str.length - decimals).replace(/0+$/, '');

  const formatted = fraction.length > 0 ? `${whole}.${fraction}` : whole;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Network-aware address validation
 */
export function validateNetworkAddress(address: string, network: string): { valid: boolean; reason?: string } {
  const trimmed = (address || '').trim();
  if (!trimmed) {
    return { valid: false, reason: 'Recipient address is empty' };
  }

  const normNetwork = network.toLowerCase();

  // EVM-compatible chains
  if (
    normNetwork.includes('sepolia') ||
    normNetwork.includes('ethereum') ||
    normNetwork.includes('base') ||
    normNetwork.includes('arbitrum') ||
    normNetwork.includes('optimism') ||
    normNetwork.includes('polygon')
  ) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      return { valid: false, reason: `Address is not a valid 40-character hex EVM address for ${network}` };
    }
    return { valid: true };
  }

  // Solana format check
  if (normNetwork.includes('solana')) {
    if (!/^[1-9A-HJ-NP-za-km-z]{32,44}$/.test(trimmed)) {
      return { valid: false, reason: `Address is not a valid Base58 Solana address` };
    }
    return { valid: true };
  }

  // Bitcoin format check
  if (normNetwork.includes('bitcoin') || normNetwork.includes('btc')) {
    if (!/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/.test(trimmed)) {
      return { valid: false, reason: `Address is not a valid Bitcoin address` };
    }
    return { valid: true };
  }

  // Fallback EVM
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return { valid: true };
  }

  return { valid: false, reason: `Unsupported address format for network "${network}"` };
}

/**
 * Pure Deterministic Transaction Policy Engine
 * Evaluates proposals against explicit immutable rules with BigInt precision.
 */
export function evaluateTransactionPolicy(
  input: PolicyEvaluationInput,
  policy: DeterministicPolicySchema = DEFAULT_DETERMINISTIC_POLICY
): DeterministicEvaluationResult {
  const results: RuleResultItem[] = [];
  const auditLog: PolicyAuditLogEntry[] = [];
  const timestamp = new Date().toISOString();

  const asset = (input.asset || 'ETH').toUpperCase().trim();
  const network = (input.network || '').toLowerCase().trim();
  const tokenConfig = KNOWN_TOKEN_PRECISION[asset] || { symbol: asset, decimals: 18 };
  const decimals = tokenConfig.decimals;

  function addResult(
    ruleId: string,
    ruleName: string,
    description: string,
    status: CheckStatus,
    severity: 'BLOCKING' | 'WARNING' | 'ADVISORY',
    message: string,
    details?: Record<string, unknown>
  ) {
    results.push({ ruleId, ruleName, description, status, severity, message, details });
    auditLog.push({
      timestamp,
      action: 'EVALUATE_RULE',
      ruleId,
      outcome: status,
      inputValues: details || {},
      reason: message,
    });
  }

  // Rule 1: Allowed Networks Check
  const isNetworkAllowed = policy.allowedNetworks.includes(network);
  if (!network) {
    addResult(
      'RULE_NETWORK_ALLOWED',
      'Permitted Blockchain Network',
      'Target network must be configured in policy whitelist',
      'UNKNOWN',
      'BLOCKING',
      'Blockchain network parameter is missing or unspecified',
      { network, allowed: policy.allowedNetworks }
    );
  } else if (!isNetworkAllowed) {
    addResult(
      'RULE_NETWORK_ALLOWED',
      'Permitted Blockchain Network',
      'Target network must be configured in policy whitelist',
      'FAILED',
      'BLOCKING',
      `Network "${network}" is not permitted. Allowed: [${policy.allowedNetworks.join(', ')}]`,
      { network, allowed: policy.allowedNetworks }
    );
  } else {
    addResult(
      'RULE_NETWORK_ALLOWED',
      'Permitted Blockchain Network',
      'Target network must be configured in policy whitelist',
      'PASSED',
      'BLOCKING',
      `Network "${network}" is authorized.`,
      { network }
    );
  }

  // Rule 2: Allowed Asset Check
  const isAssetAllowed = policy.allowedAssets.includes(asset);
  if (!asset) {
    addResult(
      'RULE_ASSET_ALLOWED',
      'Permitted Asset Whitelist',
      'Transfer asset must be in allowed list',
      'UNKNOWN',
      'BLOCKING',
      'Asset identifier is missing',
      { asset, allowed: policy.allowedAssets }
    );
  } else if (!isAssetAllowed) {
    addResult(
      'RULE_ASSET_ALLOWED',
      'Permitted Asset Whitelist',
      'Transfer asset must be in allowed list',
      'FAILED',
      'BLOCKING',
      `Asset "${asset}" is not allowed. Permitted assets: [${policy.allowedAssets.join(', ')}]`,
      { asset, allowed: policy.allowedAssets }
    );
  } else {
    addResult(
      'RULE_ASSET_ALLOWED',
      'Permitted Asset Whitelist',
      'Transfer asset must be in allowed list',
      'PASSED',
      'BLOCKING',
      `Asset "${asset}" is recognized with ${decimals} decimals.`,
      { asset, decimals }
    );
  }

  // Rule 3: Parameter Validation & Decimal Precision
  let amountBaseUnit = 0n;
  let isAmountValid = false;
  if (!input.amount || input.amount.trim() === '') {
    addResult(
      'RULE_PARAMETER_VALIDATION',
      'Transaction Parameter Syntax',
      'Amount must be a valid non-empty number',
      'FAILED',
      'BLOCKING',
      'Transaction amount is missing or empty',
      { amount: input.amount }
    );
  } else {
    try {
      amountBaseUnit = parseBaseUnits(input.amount, decimals);
      if (amountBaseUnit <= 0n) {
        addResult(
          'RULE_PARAMETER_VALIDATION',
          'Transaction Parameter Syntax',
          'Amount must be strictly greater than zero',
          'FAILED',
          'BLOCKING',
          `Transaction amount must be greater than zero. Received: ${input.amount}`,
          { amount: input.amount, baseUnit: amountBaseUnit.toString() }
        );
      } else {
        isAmountValid = true;
        addResult(
          'RULE_PARAMETER_VALIDATION',
          'Transaction Parameter Syntax',
          'Parameters conform to decimal precision and non-zero constraints',
          'PASSED',
          'BLOCKING',
          `Amount ${input.amount} ${asset} parsed to integer base units (${amountBaseUnit.toString()}) without float precision loss.`,
          { amount: input.amount, baseUnit: amountBaseUnit.toString() }
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid amount parsing';
      addResult(
        'RULE_PARAMETER_VALIDATION',
        'Transaction Parameter Syntax',
        'Amount must conform to asset decimal precision without float math',
        'FAILED',
        'BLOCKING',
        msg,
        { amount: input.amount, decimals }
      );
    }
  }

  // Calldata format check
  if (input.calldata && input.calldata !== '0x' && !/^0x[a-fA-F0-9]*$/.test(input.calldata)) {
    addResult(
      'RULE_CALLDATA_SYNTAX',
      'Calldata Hexadecimal Syntax',
      'Smart contract calldata must be valid 0x-prefixed hex string',
      'FAILED',
      'BLOCKING',
      'Malformed transaction calldata syntax',
      { calldata: input.calldata }
    );
  }

  // Rule 4: Recipient Address Validation & Blacklist/Whitelist
  const recipientAddr = (input.recipient || '').trim();
  const addressCheck = validateNetworkAddress(recipientAddr, network);
  if (!addressCheck.valid) {
    addResult(
      'RULE_RECIPIENT_VALIDATION',
      'Recipient Address Syntax',
      'Target address must conform to the destination blockchain format',
      'FAILED',
      'BLOCKING',
      addressCheck.reason || 'Invalid recipient address',
      { recipient: recipientAddr, network }
    );
  } else {
    // Check blacklist / sanctions
    const normalizedRecipient = recipientAddr.toLowerCase();
    const isBlacklisted = policy.blacklistedRecipients
      .map((a) => a.toLowerCase().trim())
      .includes(normalizedRecipient);

    if (isBlacklisted) {
      addResult(
        'RULE_SANCTIONS_BLACKLIST',
        'Prohibited / Blacklisted Address Guard',
        'Recipient must not be on the prohibited or null-address list',
        'FAILED',
        'BLOCKING',
        `Recipient address ${recipientAddr} is strictly prohibited by security policy.`,
        { recipient: recipientAddr }
      );
    } else {
      addResult(
        'RULE_SANCTIONS_BLACKLIST',
        'Prohibited / Blacklisted Address Guard',
        'Recipient passed blacklist and sanctions screening',
        'PASSED',
        'BLOCKING',
        'Recipient address cleared sanctions & blacklist check.',
        { recipient: recipientAddr }
      );
    }

    // Whitelist check (Advisory)
    const isWhitelisted = policy.whitelistedRecipients
      .map((a) => a.toLowerCase().trim())
      .includes(normalizedRecipient);

    addResult(
      'RULE_TRUSTED_WHITELIST',
      'Trusted Beneficiary Whitelist',
      'Advisory check if recipient address is a pre-registered contact',
      isWhitelisted ? 'PASSED' : 'UNKNOWN',
      'ADVISORY',
      isWhitelisted
        ? 'Recipient is registered in your trusted address book.'
        : 'Recipient is not in your address book. Extra visual review advised.',
      { recipient: recipientAddr, whitelisted: isWhitelisted }
    );
  }

  // Rule 5: Maximum Single Transaction Amount Check (Zero-Float BigInt)
  const maxLimitStr = policy.maximumTransactionAmount[asset] || policy.maximumTransactionAmount['ETH'] || '0.5';
  let maxLimitBaseUnit = 0n;
  try {
    maxLimitBaseUnit = parseBaseUnits(maxLimitStr, decimals);
    if (isAmountValid) {
      if (amountBaseUnit > maxLimitBaseUnit) {
        addResult(
          'RULE_MAX_TRANSACTION_AMOUNT',
          'Maximum Single Transaction Cap',
          `Transaction value must not exceed ${maxLimitStr} ${asset}`,
          'FAILED',
          'BLOCKING',
          `Amount (${input.amount} ${asset}) exceeds maximum single limit of ${maxLimitStr} ${asset}.`,
          { amount: input.amount, limit: maxLimitStr, amountBaseUnit: amountBaseUnit.toString(), limitBaseUnit: maxLimitBaseUnit.toString() }
        );
      } else {
        addResult(
          'RULE_MAX_TRANSACTION_AMOUNT',
          'Maximum Single Transaction Cap',
          `Transaction value within policy cap (${maxLimitStr} ${asset})`,
          'PASSED',
          'BLOCKING',
          `Amount ${input.amount} ${asset} <= ${maxLimitStr} ${asset} cap.`,
          { amount: input.amount, limit: maxLimitStr }
        );
      }
    }
  } catch (err) {
    addResult(
      'RULE_MAX_TRANSACTION_AMOUNT',
      'Maximum Single Transaction Cap',
      'Failed to parse policy maximum limit',
      'UNKNOWN',
      'BLOCKING',
      'Could not evaluate maximum transaction amount limit',
      {}
    );
  }

  // Rule 6: Maximum Daily Spending Limit Check (Zero-Float BigInt)
  const maxDailyStr = policy.maximumDailySpending[asset] || policy.maximumDailySpending['ETH'] || '2.0';
  const currentDailyStr = policy.currentDailySpending[asset] || policy.currentDailySpending['ETH'] || '0.0';
  try {
    const maxDailyBaseUnit = parseBaseUnits(maxDailyStr, decimals);
    const currentDailyBaseUnit = parseBaseUnits(currentDailyStr, decimals);
    const projectedDailyBaseUnit = currentDailyBaseUnit + amountBaseUnit;

    if (isAmountValid) {
      if (projectedDailyBaseUnit > maxDailyBaseUnit) {
        addResult(
          'RULE_DAILY_SPENDING_CAP',
          'Daily Cumulative Spending Cap',
          `Cumulative daily volume must not exceed ${maxDailyStr} ${asset}`,
          'FAILED',
          'BLOCKING',
          `Projected daily total (${formatBaseUnits(projectedDailyBaseUnit, decimals)} ${asset}) would exceed daily cap of ${maxDailyStr} ${asset}.`,
          {
            currentDaily: currentDailyStr,
            projectedDaily: formatBaseUnits(projectedDailyBaseUnit, decimals),
            cap: maxDailyStr,
          }
        );
      } else {
        addResult(
          'RULE_DAILY_SPENDING_CAP',
          'Daily Cumulative Spending Cap',
          `Cumulative daily volume within cap (${maxDailyStr} ${asset})`,
          'PASSED',
          'BLOCKING',
          `Projected daily spend (${formatBaseUnits(projectedDailyBaseUnit, decimals)} ${asset}) is within ${maxDailyStr} ${asset} budget.`,
          { projectedDaily: formatBaseUnits(projectedDailyBaseUnit, decimals), cap: maxDailyStr }
        );
      }
    }
  } catch (err) {
    addResult(
      'RULE_DAILY_SPENDING_CAP',
      'Daily Cumulative Spending Cap',
      'Failed to parse daily limits',
      'UNKNOWN',
      'BLOCKING',
      'Could not evaluate daily limit',
      {}
    );
  }

  // Rule 7: Estimated Fee and Total Cost vs. Available Balance
  let estimatedFeeBaseUnit = 0n;
  const estimatedFeeEth = input.estimatedFeeEth || '0.00042';
  try {
    estimatedFeeBaseUnit = parseBaseUnits(estimatedFeeEth, 18);
  } catch {
    estimatedFeeBaseUnit = 420000000000000n; // ~0.00042 ETH default
  }

  // Total cost base unit calculation (if native ETH)
  const isNativeAsset = asset === 'ETH';
  const totalCostBaseUnit = isNativeAsset ? amountBaseUnit + estimatedFeeBaseUnit : amountBaseUnit;

  let balanceBaseUnit = 0n;
  let isBalanceChecked = false;
  let isSufficient = true;

  if (input.availableBalance) {
    try {
      balanceBaseUnit = parseBaseUnits(input.availableBalance, decimals);
      isBalanceChecked = true;
      if (totalCostBaseUnit > balanceBaseUnit) {
        isSufficient = false;
        addResult(
          'RULE_TOTAL_COST_AND_BALANCE',
          'Total Cost & Balance Sufficiency',
          'Account balance must cover amount plus maximum estimated gas fees',
          'FAILED',
          'BLOCKING',
          `Insufficient funds: Required total is ${formatBaseUnits(totalCostBaseUnit, decimals)} ${asset} (Amount: ${input.amount} + Fee: ${estimatedFeeEth}), but available balance is ${input.availableBalance} ${asset}.`,
          {
            amount: input.amount,
            estimatedFee: estimatedFeeEth,
            totalCost: formatBaseUnits(totalCostBaseUnit, decimals),
            balance: input.availableBalance,
          }
        );
      } else {
        addResult(
          'RULE_TOTAL_COST_AND_BALANCE',
          'Total Cost & Balance Sufficiency',
          'Account balance covers amount plus estimated gas fees',
          'PASSED',
          'BLOCKING',
          `Total cost (${formatBaseUnits(totalCostBaseUnit, decimals)} ${asset}) is covered by available balance (${input.availableBalance} ${asset}).`,
          {
            totalCost: formatBaseUnits(totalCostBaseUnit, decimals),
            balance: input.availableBalance,
          }
        );
      }
    } catch {
      // Balance parsing failure
    }
  }

  if (!isBalanceChecked) {
    addResult(
      'RULE_TOTAL_COST_AND_BALANCE',
      'Total Cost & Balance Sufficiency',
      'Account balance check',
      'UNKNOWN',
      'WARNING',
      'Available wallet balance was not provided for pre-flight verification.',
      { estimatedFee: estimatedFeeEth }
    );
  }

  // Rule 8: Risk Assessment Integrity Check
  const risk = input.riskLevel || 'UNKNOWN';
  if (risk === 'UNKNOWN') {
    if (policy.blockUnknownRisk) {
      addResult(
        'RULE_UNKNOWN_RISK_GUARD',
        'Zero-Unknown Risk Policy',
        'Transactions with unknown or unverifiable risk are blocked',
        'FAILED',
        'BLOCKING',
        'Transaction risk could not be reliably determined. Policy blocks unverified risk transactions.',
        { riskLevel: risk }
      );
    } else {
      addResult(
        'RULE_UNKNOWN_RISK_GUARD',
        'Zero-Unknown Risk Policy',
        'Risk status warning',
        'UNKNOWN',
        'WARNING',
        'Risk rating is unknown. Heightened manual review required.',
        { riskLevel: risk }
      );
    }
  } else if (risk === 'CRITICAL') {
    addResult(
      'RULE_UNKNOWN_RISK_GUARD',
      'Critical Risk Flag',
      'Critical risk transactions are stopped',
      'FAILED',
      'BLOCKING',
      'Transaction triggered critical on-chain security alert.',
      { riskLevel: risk }
    );
  } else {
    addResult(
      'RULE_UNKNOWN_RISK_GUARD',
      'Zero-Unknown Risk Policy',
      'Risk evaluation verified',
      'PASSED',
      'BLOCKING',
      `On-chain risk factor score confirmed as ${risk}.`,
      { riskLevel: risk }
    );
  }

  // Rule 9: Additional Manual Approval Threshold
  const additionalApprovalAboveStr = policy.requireApprovalAbove[asset] || '0.1';
  let requiresAdditionalApproval = false;
  try {
    const additionalBaseUnit = parseBaseUnits(additionalApprovalAboveStr, decimals);
    if (amountBaseUnit >= additionalBaseUnit) {
      requiresAdditionalApproval = true;
      addResult(
        'RULE_ADDITIONAL_APPROVAL_THRESHOLD',
        'High-Value Additional Review Requirement',
        `Amounts above ${additionalApprovalAboveStr} ${asset} require heightened review`,
        'PASSED',
        'WARNING',
        `Amount (${input.amount} ${asset}) meets or exceeds high-value threshold (${additionalApprovalAboveStr} ${asset}).`,
        { amount: input.amount, threshold: additionalApprovalAboveStr }
      );
    }
  } catch {
    // threshold parse
  }

  // Rule 10: Mandatory Explicit User Review for MVP
  addResult(
    'RULE_EXPLICIT_USER_CONSENT',
    'Mandatory User Approval Gate',
    'All initial MVP transactions require explicit user approval before commitment sealing',
    'PASSED',
    'BLOCKING',
    'Explicit user approval gate is mandatory. Autonomous execution is disabled.',
    { requireApproval: policy.requireApproval }
  );

  // Group passed, failed, and unknown checks
  const passedChecks = results.filter((r) => r.status === 'PASSED').map((r) => r.ruleId);
  const failedChecks = results.filter((r) => r.status === 'FAILED').map((r) => r.ruleId);
  const unknownChecks = results.filter((r) => r.status === 'UNKNOWN').map((r) => r.ruleId);

  // Calculate Overall Decision
  const hasBlockingFailures = results.some((r) => r.status === 'FAILED' && r.severity === 'BLOCKING');
  const hasBlockingUnknowns = results.some((r) => r.status === 'UNKNOWN' && r.severity === 'BLOCKING');
  const hasWarnings = results.some((r) => r.severity === 'WARNING' && r.status !== 'PASSED') || requiresAdditionalApproval;

  let overallDecision: PolicyDecision = 'APPROVED_FOR_REVIEW';
  let summaryExplanation = '';

  if (hasBlockingFailures) {
    overallDecision = 'REJECTED';
    const failedRules = results.filter((r) => r.status === 'FAILED' && r.severity === 'BLOCKING');
    summaryExplanation = `Policy violation: ${failedRules.map((f) => f.message).join(' | ')}`;
  } else if (hasBlockingUnknowns) {
    overallDecision = 'INCOMPLETE';
    summaryExplanation = 'Policy evaluation incomplete: essential parameters or required on-chain data are missing/unknown.';
  } else if (hasWarnings) {
    overallDecision = 'REQUIRES_ADDITIONAL_APPROVAL';
    summaryExplanation = 'Policy checks passed, but transaction requires additional scrutiny due to value thresholds or warnings.';
  } else {
    overallDecision = 'APPROVED_FOR_REVIEW';
    summaryExplanation = 'All deterministic policy rules satisfied. Transaction is eligible for user review and cryptographic commitment sealing.';
  }

  const totalCost: TotalCostCalculation = {
    asset,
    amountBaseUnit: amountBaseUnit.toString(),
    feeBaseUnit: estimatedFeeBaseUnit.toString(),
    totalBaseUnit: totalCostBaseUnit.toString(),
    formattedAmount: input.amount || '0',
    formattedFee: formatBaseUnits(estimatedFeeBaseUnit, 18),
    formattedTotal: formatBaseUnits(totalCostBaseUnit, decimals),
    balanceBaseUnit: isBalanceChecked ? balanceBaseUnit.toString() : undefined,
    isSufficientBalance: isSufficient,
  };

  return {
    policyVersion: policy.policyVersion,
    proposalId: input.proposalId,
    overallDecision,
    individualRuleResults: results,
    passedChecks,
    failedChecks,
    unknownChecks,
    totalCost,
    auditLog,
    evaluationTimestamp: timestamp,
    summaryExplanation,
  };
}

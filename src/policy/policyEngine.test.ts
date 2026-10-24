import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateTransactionPolicy,
  parseBaseUnits,
  formatBaseUnits,
  validateNetworkAddress,
  DEFAULT_DETERMINISTIC_POLICY,
} from './policyEngine.ts';
import type { PolicyEvaluationInput } from './types.ts';

test('parseBaseUnits accurately parses decimal strings to BigInt without float math', () => {
  // 18 decimals (ETH)
  assert.equal(parseBaseUnits('0.05', 18), 50000000000000000n);
  assert.equal(parseBaseUnits('1.000000000000000001', 18), 1000000000000000001n);
  assert.equal(parseBaseUnits('100', 18), 100000000000000000000n);

  // 6 decimals (USDC)
  assert.equal(parseBaseUnits('50.25', 6), 50250000n);
  assert.equal(parseBaseUnits('0.000001', 6), 1n);

  // Reject fractional precision exceeding allowed decimals
  assert.throws(() => parseBaseUnits('0.1234567', 6), /exceeds asset limit/);

  // Reject negative amounts
  assert.throws(() => parseBaseUnits('-0.5', 18), /Invalid numeric amount/);
});

test('formatBaseUnits formats BigInt back to human readable decimal strings', () => {
  assert.equal(formatBaseUnits(50000000000000000n, 18), '0.05');
  assert.equal(formatBaseUnits(1000000000000000001n, 18), '1.000000000000000001');
  assert.equal(formatBaseUnits(50250000n, 6), '50.25');
});

test('1. Amount below the limit passes policy evaluation', () => {
  const input: PolicyEvaluationInput = {
    proposalId: 'prop-test-01',
    network: 'ethereum-sepolia',
    asset: 'ETH',
    amount: '0.04', // Below 0.5 ETH cap
    recipient: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    availableBalance: '1.5',
    estimatedFeeEth: '0.00042',
    riskLevel: 'LOW',
  };

  const result = evaluateTransactionPolicy(input, DEFAULT_DETERMINISTIC_POLICY);
  assert.equal(result.overallDecision, 'APPROVED_FOR_REVIEW');
  assert.ok(result.passedChecks.includes('RULE_MAX_TRANSACTION_AMOUNT'));
  assert.equal(result.failedChecks.length, 0);
  assert.ok(result.auditLog.length > 5);
});

test('2. Amount above the limit is strictly REJECTED', () => {
  const input: PolicyEvaluationInput = {
    proposalId: 'prop-test-02',
    network: 'ethereum-sepolia',
    asset: 'ETH',
    amount: '1.5', // Exceeds 0.5 ETH limit
    recipient: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    availableBalance: '5.0',
    estimatedFeeEth: '0.00042',
    riskLevel: 'LOW',
  };

  const result = evaluateTransactionPolicy(input, DEFAULT_DETERMINISTIC_POLICY);
  assert.equal(result.overallDecision, 'REJECTED');
  assert.ok(result.failedChecks.includes('RULE_MAX_TRANSACTION_AMOUNT'));
  assert.ok(result.summaryExplanation.includes('exceeds maximum single limit'));
});

test('3. Invalid recipient format is strictly REJECTED', () => {
  const input: PolicyEvaluationInput = {
    proposalId: 'prop-test-03',
    network: 'ethereum-sepolia',
    asset: 'ETH',
    amount: '0.05',
    recipient: 'not-a-valid-0x-address',
    availableBalance: '1.0',
    riskLevel: 'LOW',
  };

  const result = evaluateTransactionPolicy(input, DEFAULT_DETERMINISTIC_POLICY);
  assert.equal(result.overallDecision, 'REJECTED');
  assert.ok(result.failedChecks.includes('RULE_RECIPIENT_VALIDATION'));
});

test('4. Unsupported blockchain network is strictly REJECTED', () => {
  const input: PolicyEvaluationInput = {
    proposalId: 'prop-test-04',
    network: 'unsupported-chain-999',
    asset: 'ETH',
    amount: '0.05',
    recipient: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    availableBalance: '1.0',
    riskLevel: 'LOW',
  };

  const result = evaluateTransactionPolicy(input, DEFAULT_DETERMINISTIC_POLICY);
  assert.equal(result.overallDecision, 'REJECTED');
  assert.ok(result.failedChecks.includes('RULE_NETWORK_ALLOWED'));
});

test('5. Missing amount results in INCOMPLETE / REJECTED status', () => {
  const input: PolicyEvaluationInput = {
    proposalId: 'prop-test-05',
    network: 'ethereum-sepolia',
    asset: 'ETH',
    amount: '', // Missing amount
    recipient: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    availableBalance: '1.0',
    riskLevel: 'LOW',
  };

  const result = evaluateTransactionPolicy(input, DEFAULT_DETERMINISTIC_POLICY);
  assert.equal(result.overallDecision, 'REJECTED');
  assert.ok(result.failedChecks.includes('RULE_PARAMETER_VALIDATION'));
});

test('6. Insufficient funds (amount + fee > balance) is strictly REJECTED', () => {
  const input: PolicyEvaluationInput = {
    proposalId: 'prop-test-06',
    network: 'ethereum-sepolia',
    asset: 'ETH',
    amount: '0.45',
    recipient: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    availableBalance: '0.40', // Insufficient: 0.40 < 0.45 + 0.00042
    estimatedFeeEth: '0.00042',
    riskLevel: 'LOW',
  };

  const result = evaluateTransactionPolicy(input, DEFAULT_DETERMINISTIC_POLICY);
  assert.equal(result.overallDecision, 'REJECTED');
  assert.ok(result.failedChecks.includes('RULE_TOTAL_COST_AND_BALANCE'));
  assert.equal(result.totalCost.isSufficientBalance, false);
});

test('7. Failed policy check (blacklisted recipient) is strictly REJECTED', () => {
  const input: PolicyEvaluationInput = {
    proposalId: 'prop-test-07',
    network: 'ethereum-sepolia',
    asset: 'ETH',
    amount: '0.01',
    recipient: '0x0000000000000000000000000000000000000000', // Blacklisted zero address
    availableBalance: '1.0',
    riskLevel: 'LOW',
  };

  const result = evaluateTransactionPolicy(input, DEFAULT_DETERMINISTIC_POLICY);
  assert.equal(result.overallDecision, 'REJECTED');
  assert.ok(result.failedChecks.includes('RULE_SANCTIONS_BLACKLIST'));
});

test('8. Unknown risk with blockUnknownRisk enabled is REJECTED or INCOMPLETE', () => {
  const input: PolicyEvaluationInput = {
    proposalId: 'prop-test-08',
    network: 'ethereum-sepolia',
    asset: 'ETH',
    amount: '0.05',
    recipient: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    availableBalance: '1.0',
    riskLevel: 'UNKNOWN', // Unknown risk
  };

  const result = evaluateTransactionPolicy(input, DEFAULT_DETERMINISTIC_POLICY);
  assert.equal(result.overallDecision, 'REJECTED');
  assert.ok(result.failedChecks.includes('RULE_UNKNOWN_RISK_GUARD'));
});

test('9. Transaction parameter modification / tampering detection', () => {
  // Original valid input
  const originalInput: PolicyEvaluationInput = {
    proposalId: 'prop-test-09',
    network: 'ethereum-sepolia',
    asset: 'ETH',
    amount: '0.05',
    recipient: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    availableBalance: '1.0',
    riskLevel: 'LOW',
  };

  const validResult = evaluateTransactionPolicy(originalInput, DEFAULT_DETERMINISTIC_POLICY);
  assert.equal(validResult.overallDecision, 'APPROVED_FOR_REVIEW');

  // Modified parameter (adversarial injection altered calldata or recipient)
  const tamperedInput: PolicyEvaluationInput = {
    ...originalInput,
    calldata: 'malformed_non_hex_calldata', // Parameter injection
  };

  const tamperedResult = evaluateTransactionPolicy(tamperedInput, DEFAULT_DETERMINISTIC_POLICY);
  assert.equal(tamperedResult.overallDecision, 'REJECTED');
  assert.ok(tamperedResult.failedChecks.includes('RULE_CALLDATA_SYNTAX'));
});

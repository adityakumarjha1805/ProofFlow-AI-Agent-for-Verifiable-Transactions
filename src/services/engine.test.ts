import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePolicy, isValidAddress, DEFAULT_POLICY_CONFIG } from './policyEngine.ts';
import { createCryptographicCommitment, canonicalizeJson } from './canonicalSerialization.ts';
import { verifyTransaction } from './verificationEngine.ts';
import type { TransactionIntent, ExecutionReceipt } from '../types/index.ts';

test('canonicalizeJson sorts keys deterministically', () => {
  const obj1 = { b: 2, a: 1, c: { z: 26, y: 25 } };
  const obj2 = { a: 1, c: { y: 25, z: 26 }, b: 2 };

  assert.equal(canonicalizeJson(obj1), canonicalizeJson(obj2));
  assert.equal(canonicalizeJson(obj1), '{"a":1,"b":2,"c":{"y":25,"z":26}}');
});

test('isValidAddress properly validates EVM addresses', () => {
  assert.equal(isValidAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045'), true);
  assert.equal(isValidAddress('0x0000000000000000000000000000000000000000'), true);
  assert.equal(isValidAddress('not-an-address'), false);
  assert.equal(isValidAddress('0x123'), false);
});

test('policyEngine permits valid transaction under limits', () => {
  const intent: TransactionIntent = {
    rawPrompt: 'Send 0.05 ETH to vitalik',
    actionType: 'TRANSFER',
    recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
    amount: '0.05',
    tokenSymbol: 'ETH',
    chainId: 11155111,
    calldata: '0x',
    purposeExplanation: 'Grant transfer',
    estimatedGasEth: '0.00042',
  };

  const evaluation = evaluatePolicy(intent, DEFAULT_POLICY_CONFIG);
  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.hasBlockingViolations, false);
});

test('policyEngine blocks transactions exceeding max single limit', () => {
  const intent: TransactionIntent = {
    rawPrompt: 'Send 5 ETH to vitalik',
    actionType: 'TRANSFER',
    recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
    amount: '5.0', // exceeds DEFAULT_POLICY_CONFIG.maxSingleTxEth (0.5)
    tokenSymbol: 'ETH',
    chainId: 11155111,
    calldata: '0x',
    purposeExplanation: 'Large transfer',
    estimatedGasEth: '0.00042',
  };

  const evaluation = evaluatePolicy(intent, DEFAULT_POLICY_CONFIG);
  assert.equal(evaluation.passed, false);
  assert.equal(evaluation.hasBlockingViolations, true);
  const violation = evaluation.results.find((r) => r.ruleId === 'MAX_SINGLE_TX_LIMIT');
  assert.equal(violation?.passed, false);
});

test('policyEngine blocks prohibited blacklisted address', () => {
  const intent: TransactionIntent = {
    rawPrompt: 'Send 0.01 ETH to 0x0000000000000000000000000000000000000000',
    actionType: 'TRANSFER',
    recipient: '0x0000000000000000000000000000000000000000',
    amount: '0.01',
    tokenSymbol: 'ETH',
    chainId: 11155111,
    calldata: '0x',
    purposeExplanation: 'Zero transfer',
    estimatedGasEth: '0.00042',
  };

  const evaluation = evaluatePolicy(intent, DEFAULT_POLICY_CONFIG);
  assert.equal(evaluation.passed, false);
  const blockRule = evaluation.results.find((r) => r.ruleId === 'SANCTION_OR_BLOCKED_ADDRESS');
  assert.equal(blockRule?.passed, false);
});

test('cryptographic commitment and verification engine match when execution is faithful', () => {
  const intent: TransactionIntent = {
    rawPrompt: 'Send 0.05 ETH to vitalik.eth',
    actionType: 'TRANSFER',
    recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
    amount: '0.05',
    tokenSymbol: 'ETH',
    chainId: 11155111,
    calldata: '0x',
    purposeExplanation: 'Grant transfer',
    estimatedGasEth: '0.00042',
  };

  const commitment = createCryptographicCommitment(
    intent,
    '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c',
    1
  );
  assert.ok(commitment.commitmentHash.startsWith('0x'));

  const execution: ExecutionReceipt = {
    txHash: '0x3c78b4b732561937ff7b05d15a5f1e7d8050e8f77d33b49e29a994efc8d1979b',
    blockNumber: 5938472,
    from: '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c',
    to: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
    valueEth: '0.05',
    chainId: 11155111,
    calldata: '0x',
    gasUsed: 21000,
    effectiveGasPriceGwei: '12.4',
    status: 'SUCCESS',
    explorerUrl: 'https://sepolia.etherscan.io/tx/0x3c78...',
    executedAt: new Date().toISOString(),
    mode: 'DEMO_TESTNET',
  };

  const audit = verifyTransaction(intent, commitment, execution);
  assert.equal(audit.status, 'VERIFIED');
  assert.equal(audit.hashesMatch, true);
  assert.ok(audit.auditSummary.includes('Transaction cryptographically verified'));
});

test('verification engine flags parameter tampering / drift', () => {
  const intent: TransactionIntent = {
    rawPrompt: 'Send 0.05 ETH to recipient A',
    actionType: 'TRANSFER',
    recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
    amount: '0.05',
    tokenSymbol: 'ETH',
    chainId: 11155111,
    calldata: '0x',
    purposeExplanation: 'Transfer',
    estimatedGasEth: '0.00042',
  };

  const commitment = createCryptographicCommitment(intent);

  // Altered on-chain execution (e.g. 0.5 ETH instead of 0.05 ETH!)
  const tamperedExecution: ExecutionReceipt = {
    txHash: '0xabc123...',
    blockNumber: 5938473,
    from: '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c',
    to: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
    valueEth: '0.5', // Tampered!
    chainId: 11155111,
    calldata: '0x',
    gasUsed: 21000,
    effectiveGasPriceGwei: '12.4',
    status: 'SUCCESS',
    explorerUrl: 'https://sepolia.etherscan.io/tx/0xabc...',
    executedAt: new Date().toISOString(),
    mode: 'DEMO_TESTNET',
  };

  const audit = verifyTransaction(intent, commitment, tamperedExecution);
  assert.equal(audit.status, 'MISMATCH');
  assert.equal(audit.hashesMatch, false);
  const amountDiff = audit.parameterDiffs.find((d) => d.field.includes('Value'));
  assert.equal(amountDiff?.matches, false);
});

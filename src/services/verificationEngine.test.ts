import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTransaction } from './verificationEngine.ts';
import {
  canonicalizeJson,
  createCryptographicCommitment,
  convertToBaseUnits,
  computeSha256,
  CURRENT_POLICY_VERSION,
} from './canonicalSerialization.ts';
import type {
  TransactionIntent,
  CryptographicCommitment,
  ExecutionReceipt,
  ApprovalEvidence,
} from '../types/index.ts';

const mockIntent: TransactionIntent = {
  rawPrompt: 'Send 0.05 ETH to vitalik.eth on Sepolia',
  actionType: 'TRANSFER',
  recipient: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  amount: '0.05',
  tokenSymbol: 'ETH',
  chainId: 11155111,
  calldata: '0x',
  purposeExplanation: 'Community test grant',
  estimatedGasEth: '0.00042',
};

const approverWallet = '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c';
const proposalId = 'prop-test-12345';
const timestamp = '2026-10-21T12:00:00.000Z';

function setupValidCommitment(): CryptographicCommitment {
  return createCryptographicCommitment(mockIntent, {
    proposalId,
    signerAddress: approverWallet,
    nonce: 101,
    policyVersion: CURRENT_POLICY_VERSION,
    proposalTimestamp: timestamp,
  });
}

function setupValidApprovalEvidence(commitment: CryptographicCommitment): ApprovalEvidence {
  return {
    walletAddress: approverWallet,
    approvedCommitmentHash: commitment.sha256Hash,
    approvalMethod: 'WALLET_PERSONAL_SIGN',
    signature: '0x3c78a0112233445566778899aabbccddeeff00112233445566778899aabbccddeeff1b',
    approvedAt: timestamp,
    distinctFromTxSignature: true,
    userApprovalNotes: 'Approved canonical proposal via Web3 wallet',
  };
}

function setupValidExecution(): ExecutionReceipt {
  return {
    txHash: '0x3c78b4b732561937ff7b05d15a5f1e7d8050e8f77d33b49e29a994efc8d1979b',
    blockNumber: 11950380,
    from: approverWallet,
    to: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    valueEth: '0.05',
    valueBaseUnits: '50000000000000000',
    chainId: 11155111,
    calldata: '0x',
    gasUsed: 21000,
    effectiveGasPriceGwei: '14.5',
    status: 'SUCCESS',
    explorerUrl: 'https://sepolia.etherscan.io/tx/0x3c78...',
    executedAt: new Date().toISOString(),
    mode: 'LIVE_WALLET',
  };
}

test('Verification Engine: 1. Canonical Serialization Invariance & Determinism', () => {
  const payload1 = {
    amountInBaseUnits: '50000000000000000',
    asset: 'ETH',
    calldata: '0x',
    chainId: 11155111,
    policyVersion: 'proof-flow-policy-v1.0',
    proposalId: 'prop-test-1',
    proposalTimestamp: '2026-10-21T00:00:00Z',
    recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
    sender: '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c',
    transactionType: 'NATIVE_TRANSFER',
  };

  // Re-order properties completely
  const payload2 = {
    transactionType: 'NATIVE_TRANSFER',
    sender: '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c',
    recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
    proposalTimestamp: '2026-10-21T00:00:00Z',
    proposalId: 'prop-test-1',
    policyVersion: 'proof-flow-policy-v1.0',
    chainId: 11155111,
    calldata: '0x',
    asset: 'ETH',
    amountInBaseUnits: '50000000000000000',
  };

  const json1 = canonicalizeJson(payload1);
  const json2 = canonicalizeJson(payload2);
  assert.equal(json1, json2);

  const hash1 = computeSha256(json1);
  const hash2 = computeSha256(json2);
  assert.equal(hash1, hash2);
  assert.ok(hash1.startsWith('0x'));
  assert.equal(hash1.length, 66); // 0x + 64 hex chars
});

test('Verification Engine: 2. Convert base units handles high precision decimals without float math drift', () => {
  assert.equal(convertToBaseUnits('0.05'), '50000000000000000');
  assert.equal(convertToBaseUnits('1'), '1000000000000000000');
  assert.equal(convertToBaseUnits('0.000000000000000001'), '1'); // 1 wei
  assert.equal(convertToBaseUnits('0'), '0');
});

test('Verification Engine: 3. Perfectly faithful execution yields VERIFIED status and passes all 8 checks', () => {
  const commitment = setupValidCommitment();
  const approvalEvidence = setupValidApprovalEvidence(commitment);
  const execution = setupValidExecution();

  const audit = verifyTransaction({
    intent: mockIntent,
    proposalId,
    commitment,
    approvalEvidence,
    execution,
    expectedApprover: approverWallet,
  });

  assert.equal(audit.status, 'VERIFIED');
  assert.equal(audit.hashesMatch, true);
  assert.equal(audit.discrepancies.length, 0);

  // Check all 8 explicit checks
  assert.equal(audit.checks.commitmentMatch.passed, true);
  assert.equal(audit.checks.commitmentMatch.status, 'PASSED');
  assert.equal(audit.checks.approverMatch.passed, true);
  assert.equal(audit.checks.senderMatch.passed, true);
  assert.equal(audit.checks.recipientMatch.passed, true);
  assert.equal(audit.checks.amountMatch.passed, true);
  assert.equal(audit.checks.chainMatch.passed, true);
  assert.equal(audit.checks.receiptSuccess.passed, true);
  assert.equal(audit.checks.transactionReferenceValid.passed, true);

  // Merkle proof check
  assert.ok(audit.verificationProof.merkleRoot.startsWith('0x'));
  assert.equal(audit.verificationProof.proofSteps.length, 4);
});

test('Verification Engine: 4. MODIFIED AMOUNT triggers MISMATCH status with critical discrepancy', () => {
  const commitment = setupValidCommitment();
  const approvalEvidence = setupValidApprovalEvidence(commitment);
  const tamperedExecution: ExecutionReceipt = {
    ...setupValidExecution(),
    valueEth: '0.5', // Approved was 0.05!
    valueBaseUnits: '500000000000000000',
  };

  const audit = verifyTransaction({
    intent: mockIntent,
    proposalId,
    commitment,
    approvalEvidence,
    execution: tamperedExecution,
  });

  assert.equal(audit.status, 'MISMATCH');
  assert.equal(audit.checks.amountMatch.passed, false);
  assert.equal(audit.checks.amountMatch.status, 'FAILED');
  assert.ok(audit.discrepancies.some((d) => d.includes('Amount altered') || d.includes('TAMPERING')));
  assert.ok(audit.auditSummary.includes('VERIFICATION MISMATCH'));
});

test('Verification Engine: 5. MODIFIED RECIPIENT triggers MISMATCH status with address substitution alert', () => {
  const commitment = setupValidCommitment();
  const approvalEvidence = setupValidApprovalEvidence(commitment);
  const attackerAddress = '0x1111111111111111111111111111111111111111';
  const substitutedExecution: ExecutionReceipt = {
    ...setupValidExecution(),
    to: attackerAddress,
  };

  const audit = verifyTransaction({
    intent: mockIntent,
    proposalId,
    commitment,
    approvalEvidence,
    execution: substitutedExecution,
  });

  assert.equal(audit.status, 'MISMATCH');
  assert.equal(audit.checks.recipientMatch.passed, false);
  assert.equal(audit.checks.recipientMatch.status, 'FAILED');
  assert.ok(audit.discrepancies.some((d) => d.includes('Recipient altered') || d.includes('TAMPERING')));
});

test('Verification Engine: 6. WRONG CHAIN ID triggers MISMATCH status', () => {
  const commitment = setupValidCommitment();
  const approvalEvidence = setupValidApprovalEvidence(commitment);
  const wrongChainExecution: ExecutionReceipt = {
    ...setupValidExecution(),
    chainId: 1 as any, // Executed on Mainnet instead of Sepolia 11155111
  };

  const audit = verifyTransaction({
    intent: mockIntent,
    proposalId,
    commitment,
    approvalEvidence,
    execution: wrongChainExecution,
  });

  assert.equal(audit.status, 'MISMATCH');
  assert.equal(audit.checks.chainMatch.passed, false);
  assert.equal(audit.checks.chainMatch.status, 'FAILED');
  assert.ok(audit.discrepancies.some((d) => d.includes('Wrong network') || d.includes('Chain ID')));
});

test('Verification Engine: 7. FAILED ON-CHAIN TRANSACTION (Reverted) triggers FAILED status', () => {
  const commitment = setupValidCommitment();
  const approvalEvidence = setupValidApprovalEvidence(commitment);
  const revertedExecution: ExecutionReceipt = {
    ...setupValidExecution(),
    status: 'REVERTED',
  };

  const audit = verifyTransaction({
    intent: mockIntent,
    proposalId,
    commitment,
    approvalEvidence,
    execution: revertedExecution,
  });

  assert.equal(audit.status, 'FAILED');
  assert.equal(audit.checks.receiptSuccess.passed, false);
  assert.equal(audit.checks.receiptSuccess.status, 'FAILED');
  assert.ok(audit.auditSummary.includes('TRANSACTION FAILED'));
});

test('Verification Engine: 8. PENDING TRANSACTION (unmined or blockNumber=0) triggers PENDING status', () => {
  const commitment = setupValidCommitment();
  const approvalEvidence = setupValidApprovalEvidence(commitment);
  const pendingExecution: ExecutionReceipt = {
    ...setupValidExecution(),
    status: 'PENDING',
    blockNumber: 0,
  };

  const audit = verifyTransaction({
    intent: mockIntent,
    proposalId,
    commitment,
    approvalEvidence,
    execution: pendingExecution,
  });

  assert.equal(audit.status, 'PENDING');
  assert.equal(audit.checks.receiptSuccess.status, 'PENDING');
  assert.ok(audit.auditSummary.includes('TRANSACTION PENDING'));
});

test('Verification Engine: 9. MISMATCHED COMMITMENT (Tampered Proposal Fields) triggers MISMATCH status', () => {
  const realCommitment = setupValidCommitment();
  // Tamper with the stored commitment hash so it diverges from recomputed canonical payload
  const tamperedCommitment: CryptographicCommitment = {
    ...realCommitment,
    sha256Hash: '0x9999999999999999999999999999999999999999999999999999999999999999',
  };

  const audit = verifyTransaction({
    intent: mockIntent,
    proposalId,
    commitment: tamperedCommitment,
    execution: setupValidExecution(),
  });

  assert.equal(audit.status, 'MISMATCH');
  assert.equal(audit.checks.commitmentMatch.passed, false);
  assert.equal(audit.checks.commitmentMatch.status, 'FAILED');
});

test('Verification Engine: 10. APPROVER MISMATCH triggers MISMATCH status', () => {
  const commitment = setupValidCommitment();
  const unexpectedApprover = '0x8888888888888888888888888888888888888888';
  const approvalEvidence: ApprovalEvidence = {
    ...setupValidApprovalEvidence(commitment),
    walletAddress: unexpectedApprover,
  };

  const audit = verifyTransaction({
    intent: mockIntent,
    proposalId,
    commitment,
    approvalEvidence,
    execution: setupValidExecution(),
    expectedApprover: approverWallet, // Expected approverWallet, but approved by unexpectedApprover
  });

  assert.equal(audit.status, 'MISMATCH');
  assert.equal(audit.checks.approverMatch.passed, false);
  assert.equal(audit.checks.approverMatch.status, 'FAILED');
});

test('Verification Engine: 11. UNSUPPORTED TRANSACTION TYPE triggers INCOMPLETE status', () => {
  const commitment = setupValidCommitment();
  commitment.canonicalPayload.transactionType = 'UNSUPPORTED_ARBITRARY_BYTECODE';

  const audit = verifyTransaction({
    intent: {
      ...mockIntent,
      actionType: 'UNSUPPORTED_ARBITRARY_BYTECODE' as any,
    },
    proposalId,
    commitment,
    execution: setupValidExecution(),
  });

  assert.equal(audit.status, 'INCOMPLETE');
  assert.ok(audit.auditSummary.includes('INCOMPLETE'));
});

test('Verification Engine: 12. Never gives VERIFIED status without confirmed on-chain execution', () => {
  const commitment = setupValidCommitment();

  // No execution passed
  const audit = verifyTransaction({
    intent: mockIntent,
    proposalId,
    commitment,
  });

  assert.notEqual(audit.status, 'VERIFIED');
  assert.equal(audit.status, 'PENDING');
});

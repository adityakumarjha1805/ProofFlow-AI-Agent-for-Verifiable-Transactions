import test from 'node:test';
import assert from 'node:assert/strict';
import { runDeterministicToolWorkflow } from '../agent/agentService.ts';
import {
  revalidateProposalBeforeExecution,
  verifyTransactionSubmissionState,
  retryIdempotentRpcOperation,
} from '../services/blockchainService.ts';
import { ProofFlowDatabase } from '../db/database.ts';
import type {
  TransactionProposal,
  AgentExecutionPlan,
  ExecutionTraceItem,
  DeterministicPolicyConfig,
} from '../types/index.ts';

const db = new ProofFlowDatabase();
const testWallet = '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c';

const defaultPolicies: DeterministicPolicyConfig = {
  maxSingleTxEth: 0.5,
  maxDailyTxEth: 1.0,
  currentDailySpentEth: 0.1,
  allowedChains: [11155111, 84532, 421614],
  whitelistedAddresses: [testWallet],
  blockedAddresses: ['0x0000000000000000000000000000000000000000', '0x000000000000000000000000000000000000dead'],
  requireApprovalAboveEth: 0.05,
  maxGasPriceGwei: 50,
  allowContractInteraction: true,
};

test('1. Agent Planning: Structured multi-step execution plan generated for valid transfer', async () => {
  const result = await runDeterministicToolWorkflow(
    'Transfer 0.05 ETH to vitalik.eth on Sepolia for developer grant funding',
    testWallet
  );

  assert.equal(result.status, 'proposal_ready');
  assert.ok(result.plan, 'Execution plan should be generated');
  assert.equal(result.plan.steps.length, 7, 'Plan should contain 7 structured steps');
  assert.equal(result.plan.isComplete, true);
  assert.equal(result.plan.requiresClarification, false);
  assert.ok(result.plan.goal.includes('Transfer 0.05 ETH'));
  
  // Verify execution trace has sequential phases
  assert.ok(result.executionTrace, 'Execution trace must exist');
  const phases = result.executionTrace.map((t) => t.phase);
  assert.ok(phases.includes('REQUEST'));
  assert.ok(phases.includes('PLAN'));
  assert.ok(phases.includes('TOOL_CALL'));
  assert.ok(phases.includes('POLICY_DECISION'));
});

test('2. Agent Planning: Detects missing information and halts for user clarification', async () => {
  const result = await runDeterministicToolWorkflow(
    'Please make a transfer on Sepolia',
    testWallet
  );

  assert.equal(result.status, 'needs_clarification');
  assert.ok(result.missing_information.length > 0, 'Must identify missing information');
  assert.ok(result.missing_information.some((m) => m.toLowerCase().includes('recipient')));
  assert.ok(result.missing_information.some((m) => m.toLowerCase().includes('amount')));
  assert.ok(result.clarificationQuestion, 'Must provide clarification prompt');

  assert.ok(result.plan, 'Plan must reflect paused state');
  assert.equal(result.plan.requiresClarification, true);
  assert.equal(result.plan.isComplete, false);
});

test('3. Dynamic Tool Execution: Spending limit policy violation halts subsequent steps', async () => {
  const result = await runDeterministicToolWorkflow(
    'Transfer 5.0 ETH to vitalik.eth on Sepolia',
    testWallet
  );

  assert.equal(result.status, 'policy_blocked');
  assert.ok(result.plan, 'Plan should exist');
  
  // Step 5 (policy) should fail
  const policyStep = result.plan.steps.find((s) => s.stepNumber === 5);
  assert.ok(policyStep, 'Policy evaluation step must exist');
  assert.equal(policyStep.status, 'FAILED');

  // Step 7 (draft proposal) should be skipped
  const draftStep = result.plan.steps.find((s) => s.stepNumber === 7);
  assert.ok(draftStep && (draftStep.status === 'SKIPPED' || draftStep.status === 'PENDING'));
});

test('4. Security Boundary: Pre-execution revalidation passes for un-tampered approved proposal', async () => {
  const proposalRecord = await db.createProposal({
    userWalletAddress: testWallet,
    userPrompt: 'Transfer 0.05 ETH to vitalik.eth on Sepolia',
    intent: {
      rawPrompt: 'Transfer 0.05 ETH to vitalik.eth on Sepolia',
      actionType: 'TRANSFER',
      recipient: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      amount: '0.05',
      tokenSymbol: 'ETH',
      chainId: 11155111,
      calldata: '0x',
      purposeExplanation: 'Valid transfer test',
      estimatedGasEth: '0.00042',
    },
    riskAssessment: {
      overallLevel: 'LOW',
      riskScore: 10,
      summary: 'Clean transfer',
      factors: [],
    },
    policyEvaluation: {
      passed: true,
      hasBlockingViolations: false,
      warningsCount: 0,
      evaluatedAt: new Date().toISOString(),
      results: [],
    },
  });

  // Seal commitment
  const committed = await db.recordCommitment(proposalRecord.id, testWallet);
  assert.ok(committed.commitment, 'Commitment must exist');

  // Record approval evidence
  await db.recordApprovalEvidence({
    proposalId: proposalRecord.id,
    walletAddress: testWallet,
    approvedCommitmentHash: committed.commitment.sha256Hash,
    approvalMethod: 'WALLET_EXPLICIT_CONSENT',
    userApprovalNotes: 'Approved for test',
  });

  const fullProposal = (await db.getProposalById(proposalRecord.id))!.proposal;

  const revalidation = revalidateProposalBeforeExecution({
    proposal: fullProposal,
    currentPolicies: defaultPolicies,
    currentWalletBalanceEth: '1.5',
    expectedCommitmentHash: fullProposal.commitment?.sha256Hash,
  });

  assert.equal(revalidation.canExecute, true, 'Revalidation should succeed for unaltered approved proposal');
});

test('5. Security Boundary: Pre-execution revalidation rejects parameter drift after approval', async () => {
  const proposalRecord = await db.createProposal({
    userWalletAddress: testWallet,
    userPrompt: 'Transfer 0.05 ETH to vitalik.eth on Sepolia',
    intent: {
      rawPrompt: 'Transfer 0.05 ETH to vitalik.eth on Sepolia',
      actionType: 'TRANSFER',
      recipient: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      amount: '0.05',
      tokenSymbol: 'ETH',
      chainId: 11155111,
      calldata: '0x',
      purposeExplanation: 'Valid transfer test',
      estimatedGasEth: '0.00042',
    },
    riskAssessment: {
      overallLevel: 'LOW',
      riskScore: 10,
      summary: 'Clean transfer',
      factors: [],
    },
    policyEvaluation: {
      passed: true,
      hasBlockingViolations: false,
      warningsCount: 0,
      evaluatedAt: new Date().toISOString(),
      results: [],
    },
  });

  const committed = await db.recordCommitment(proposalRecord.id, testWallet);

  await db.recordApprovalEvidence({
    proposalId: proposalRecord.id,
    walletAddress: testWallet,
    approvedCommitmentHash: committed.commitment!.sha256Hash,
    approvalMethod: 'WALLET_EXPLICIT_CONSENT',
  });

  const fullProposal = (await db.getProposalById(proposalRecord.id))!.proposal;

  // Malicious tampering: amount changed from 0.05 to 0.85 ETH
  const tamperedProposal: TransactionProposal = {
    ...fullProposal,
    intent: {
      ...fullProposal.intent,
      amount: '0.85',
    },
  };

  const revalidation = revalidateProposalBeforeExecution({
    proposal: tamperedProposal,
    currentPolicies: defaultPolicies,
    currentWalletBalanceEth: '1.5',
    expectedCommitmentHash: fullProposal.commitment?.sha256Hash,
  });

  assert.equal(revalidation.canExecute, false, 'Tampered proposal must be rejected');
  assert.equal(revalidation.requiresReapproval, true);
  assert.ok(
    revalidation.reason?.includes('exceeds') || revalidation.reason?.includes('limit') || revalidation.code === 'POLICY_VIOLATION'
  );
});

test('6. Security Boundary: Pre-execution revalidation detects insufficient balance for transfer + gas', async () => {
  const proposalRecord = await db.createProposal({
    userWalletAddress: testWallet,
    userPrompt: 'Transfer 0.05 ETH to vitalik.eth on Sepolia',
    intent: {
      rawPrompt: 'Transfer 0.05 ETH to vitalik.eth on Sepolia',
      actionType: 'TRANSFER',
      recipient: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      amount: '0.05',
      tokenSymbol: 'ETH',
      chainId: 11155111,
      calldata: '0x',
      purposeExplanation: 'Balance check',
      estimatedGasEth: '0.00042',
    },
    riskAssessment: { overallLevel: 'LOW', riskScore: 10, summary: 'Clean', factors: [] },
    policyEvaluation: { passed: true, hasBlockingViolations: false, warningsCount: 0, evaluatedAt: new Date().toISOString(), results: [] },
  });

  const committed = await db.recordCommitment(proposalRecord.id, testWallet);

  await db.recordApprovalEvidence({
    proposalId: proposalRecord.id,
    walletAddress: testWallet,
    approvedCommitmentHash: committed.commitment!.sha256Hash,
    approvalMethod: 'WALLET_EXPLICIT_CONSENT',
  });

  const fullProposal = (await db.getProposalById(proposalRecord.id))!.proposal;

  // Insufficient balance (0.01 ETH when 0.05 ETH + gas is required)
  const revalidation = revalidateProposalBeforeExecution({
    proposal: fullProposal,
    currentPolicies: defaultPolicies,
    currentWalletBalanceEth: '0.01',
    expectedCommitmentHash: fullProposal.commitment?.sha256Hash,
  });

  assert.equal(revalidation.canExecute, false);
  assert.equal(revalidation.code, 'INSUFFICIENT_FUNDS');
  assert.ok(revalidation.reason?.includes('Insufficient balance'));
});

test('7. Failure Recovery: Bounded exponential retry succeeds on transient RPC error', async () => {
  let attempts = 0;
  const simulatedRpcQuery = async () => {
    attempts++;
    if (attempts < 2) {
      throw new Error('504 Gateway Timeout: transient node congestion');
    }
    return { latestBlock: 7421882 };
  };

  const result = await retryIdempotentRpcOperation(
    'fetchLatestBlock',
    simulatedRpcQuery,
    3,
    10
  );

  assert.equal(attempts, 2, 'Should succeed on second attempt after retry');
  assert.equal(result.latestBlock, 7421882);
});

test('8. Failure Recovery: Idempotent retry strictly fails after max attempts without endless polling', async () => {
  let attempts = 0;
  const failingRpcQuery = async () => {
    attempts++;
    throw new Error('Network offline');
  };

  await assert.rejects(
    async () => {
      await retryIdempotentRpcOperation('failingCall', failingRpcQuery, 3, 5);
    },
    { message: /Network offline/ }
  );

  assert.equal(attempts, 3, 'Must stop exactly after maxRetries');
});

test('9. Execution Trace & Audit: Evidence vs Model reasoning flags correctly set', async () => {
  const result = await runDeterministicToolWorkflow(
    'Transfer 0.02 ETH to vitalik.eth on Sepolia',
    testWallet
  );

  assert.ok(result.executionTrace, 'Execution trace must exist');
  const toolCallTrace = result.executionTrace.find((t) => t.phase === 'TOOL_CALL');
  const planTrace = result.executionTrace.find((t) => t.phase === 'PLAN');

  assert.ok(toolCallTrace, 'Tool call trace item exists');
  assert.equal(toolCallTrace.isActualEvidence, true, 'Tool calls must be tagged as actual evidence');

  assert.ok(planTrace, 'Plan trace item exists');
  assert.equal(planTrace.isActualEvidence, false, 'Model planning synthesis is AI explanation');
});

test('10. Cryptographic Verification: On-chain revert status is marked as FAIL, not false success', async () => {
  const proposalRecord = await db.createProposal({
    userWalletAddress: testWallet,
    userPrompt: 'Transfer 0.05 ETH to vitalik.eth on Sepolia',
    intent: {
      rawPrompt: 'Transfer 0.05 ETH to vitalik.eth on Sepolia',
      actionType: 'TRANSFER',
      recipient: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      amount: '0.05',
      tokenSymbol: 'ETH',
      chainId: 11155111,
      calldata: '0x',
      purposeExplanation: 'Revert test',
      estimatedGasEth: '0.00042',
    },
    riskAssessment: { overallLevel: 'LOW', riskScore: 10, summary: 'Clean', factors: [] },
    policyEvaluation: { passed: true, hasBlockingViolations: false, warningsCount: 0, evaluatedAt: new Date().toISOString(), results: [] },
  });

  const committed = await db.recordCommitment(proposalRecord.id, testWallet);

  await db.recordApprovalEvidence({
    proposalId: proposalRecord.id,
    walletAddress: testWallet,
    approvedCommitmentHash: committed.commitment!.sha256Hash,
    approvalMethod: 'WALLET_EXPLICIT_CONSENT',
  });

  // Record an on-chain execution with status REVERTED
  await db.recordBlockchainExecution({
    proposalId: proposalRecord.id,
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    blockNumber: 7421990,
    from: testWallet,
    to: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    valueEth: '0.05',
    chainId: 11155111,
    calldata: '0x',
    gasUsed: 21000,
    effectiveGasPriceGwei: '2.5',
    status: 'REVERTED',
    explorerUrl: 'https://sepolia.etherscan.io/tx/0x1234',
    executedAt: new Date().toISOString(),
    mode: 'DEMO_TESTNET',
  });

  const fullProposal = (await db.getProposalById(proposalRecord.id))!.proposal;

  assert.equal(fullProposal.status, 'VERIFICATION_FAILED');
  assert.ok(fullProposal.verification);
  assert.equal(fullProposal.verification.status, 'FAILED');
  assert.equal(fullProposal.verification.checks.receiptSuccess.passed, false);
  assert.equal(fullProposal.verification.checks.receiptSuccess.status, 'FAILED');
});

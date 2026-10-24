import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { ProofFlowDatabase } from './database.ts';

describe('ProofFlow Database & Persistent Storage', () => {
  let db: ProofFlowDatabase;
  const testWallet = '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c';
  const otherWallet = '0x2b38f8cf86d2673295cbb46b5a1bb43b749d0387';

  before(async () => {
    db = new ProofFlowDatabase();
    await db.initialize();
  });

  test('1. Server-side validation: Rejects invalid Ethereum addresses', async () => {
    await assert.rejects(
      async () => {
        await db.createProposal({
          userWalletAddress: 'invalid-address',
          userPrompt: 'Send ETH',
          intent: {
            rawPrompt: 'Send ETH',
            actionType: 'TRANSFER',
            recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
            amount: '0.05',
            tokenSymbol: 'ETH',
            chainId: 11155111,
            calldata: '0x',
            purposeExplanation: 'Test',
            estimatedGasEth: '0.00042',
          },
          riskAssessment: { riskScore: 10, overallLevel: 'LOW', summary: 'OK', factors: [] },
          policyEvaluation: { passed: true, hasBlockingViolations: false, warningsCount: 0, results: [] },
        });
      },
      /VALIDATION_ERROR: Invalid Ethereum address format/
    );
  });

  test('2. Server-side validation: Rejects non-positive transaction amounts', async () => {
    await assert.rejects(
      async () => {
        await db.createProposal({
          userWalletAddress: testWallet,
          userPrompt: 'Send 0 ETH',
          intent: {
            rawPrompt: 'Send 0 ETH',
            actionType: 'TRANSFER',
            recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
            amount: '0',
            tokenSymbol: 'ETH',
            chainId: 11155111,
            calldata: '0x',
            purposeExplanation: 'Test',
            estimatedGasEth: '0.00042',
          },
          riskAssessment: { riskScore: 10, overallLevel: 'LOW', summary: 'OK', factors: [] },
          policyEvaluation: { passed: true, hasBlockingViolations: false, warningsCount: 0, results: [] },
        });
      },
      /VALIDATION_ERROR: Transaction amount must be a positive decimal number/
    );
  });

  test('3. Server-side validation: Blocks storage of private keys or seed phrases', async () => {
    await assert.rejects(
      async () => {
        await db.createProposal({
          userWalletAddress: testWallet,
          userPrompt: 'Here is my privateKey 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          intent: {
            rawPrompt: 'Send ETH',
            actionType: 'TRANSFER',
            recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
            amount: '0.1',
            tokenSymbol: 'ETH',
            chainId: 11155111,
            calldata: '0x',
            purposeExplanation: 'Test',
            estimatedGasEth: '0.00042',
          },
          riskAssessment: { riskScore: 10, overallLevel: 'LOW', summary: 'OK', factors: [] },
          policyEvaluation: { passed: true, hasBlockingViolations: false, warningsCount: 0, results: [] },
        });
      },
      /SECURITY_VIOLATION/
    );
  });

  test('4. Safe string and base units: Stores exact wei without floating point drift', async () => {
    const p = await db.createProposal({
      userWalletAddress: testWallet,
      userPrompt: 'Send 0.050000000000000001 ETH',
      intent: {
        rawPrompt: 'Send 0.050000000000000001 ETH',
        actionType: 'TRANSFER',
        recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        amount: '0.050000000000000001',
        tokenSymbol: 'ETH',
        chainId: 11155111,
        calldata: '0x',
        purposeExplanation: 'Test',
        estimatedGasEth: '0.00042',
      },
      riskAssessment: { riskScore: 10, overallLevel: 'LOW', summary: 'OK', factors: [] },
      policyEvaluation: { passed: true, hasBlockingViolations: false, warningsCount: 0, results: [] },
    });

    assert.strictEqual(p.amountInBaseUnits, '50000000000000001');
    assert.strictEqual(p.status, 'AWAITING_APPROVAL');
  });

  test('5. Prevent duplicate transaction submissions: Rejects duplicate txHash', async () => {
    // Create proposal A
    const pA = await db.createProposal({
      userWalletAddress: testWallet,
      userPrompt: 'Proposal A for duplicate test',
      intent: {
        rawPrompt: 'Send 0.01 ETH',
        actionType: 'TRANSFER',
        recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        amount: '0.01',
        tokenSymbol: 'ETH',
        chainId: 11155111,
        calldata: '0x',
        purposeExplanation: 'Test A',
        estimatedGasEth: '0.00042',
      },
      riskAssessment: { riskScore: 10, overallLevel: 'LOW', summary: 'OK', factors: [] },
      policyEvaluation: { passed: true, hasBlockingViolations: false, warningsCount: 0, results: [] },
    });

    const uniqueTxHash = `0x${crypto.randomBytes(32).toString('hex')}`;

    // Record execution on Proposal A
    await db.recordBlockchainExecution({
      proposalId: pA.id,
      txHash: uniqueTxHash,
      blockNumber: 11950001,
      from: testWallet,
      to: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
      valueEth: '0.01',
      chainId: 11155111,
      gasUsed: 21000,
      effectiveGasPriceGwei: '15',
      status: 'SUCCESS',
      explorerUrl: `https://sepolia.etherscan.io/tx/${uniqueTxHash}`,
      mode: 'DEMO_TESTNET',
    });

    // Create proposal B
    const pB = await db.createProposal({
      userWalletAddress: testWallet,
      userPrompt: 'Proposal B for duplicate test',
      intent: {
        rawPrompt: 'Send 0.01 ETH',
        actionType: 'TRANSFER',
        recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        amount: '0.01',
        tokenSymbol: 'ETH',
        chainId: 11155111,
        calldata: '0x',
        purposeExplanation: 'Test B',
        estimatedGasEth: '0.00042',
      },
      riskAssessment: { riskScore: 10, overallLevel: 'LOW', summary: 'OK', factors: [] },
      policyEvaluation: { passed: true, hasBlockingViolations: false, warningsCount: 0, results: [] },
    });

    // Attempting to record the same txHash for proposal B MUST fail
    await assert.rejects(
      async () => {
        await db.recordBlockchainExecution({
          proposalId: pB.id,
          txHash: uniqueTxHash,
          blockNumber: 11950001,
          from: testWallet,
          to: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
          valueEth: '0.01',
          chainId: 11155111,
          gasUsed: 21000,
          effectiveGasPriceGwei: '15',
          status: 'SUCCESS',
          explorerUrl: `https://sepolia.etherscan.io/tx/${uniqueTxHash}`,
          mode: 'DEMO_TESTNET',
        });
      },
      /DUPLICATE_TRANSACTION_ERROR/
    );
  });

  test('6. Authorization and Privacy: Non-owner access redacts private user prompt', async () => {
    const p = await db.createProposal({
      userWalletAddress: testWallet,
      userPrompt: 'Top secret proprietary treasury rebalance strategy',
      intent: {
        rawPrompt: 'Top secret proprietary treasury rebalance strategy',
        actionType: 'TRANSFER',
        recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        amount: '0.05',
        tokenSymbol: 'ETH',
        chainId: 11155111,
        calldata: '0x',
        purposeExplanation: 'Secret',
        estimatedGasEth: '0.00042',
      },
      riskAssessment: { riskScore: 10, overallLevel: 'LOW', summary: 'OK', factors: [] },
      policyEvaluation: { passed: true, hasBlockingViolations: false, warningsCount: 0, results: [] },
    });

    // Access by owner
    const ownerRes = await db.getProposalById(p.id, testWallet);
    assert.strictEqual(ownerRes?.isAuthorizedOwner, true);
    assert.strictEqual(ownerRes?.proposal.userPrompt, 'Top secret proprietary treasury rebalance strategy');

    // Access by another user/wallet
    const otherRes = await db.getProposalById(p.id, otherWallet);
    assert.strictEqual(otherRes?.isAuthorizedOwner, false);
    assert.ok(otherRes?.proposal.userPrompt.includes('[Redacted for privacy]'));
  });

  test('7. Server-side verification recomputation: Recomputes verification on server', async () => {
    const p = await db.createProposal({
      userWalletAddress: testWallet,
      userPrompt: 'Verification test proposal',
      intent: {
        rawPrompt: 'Send 0.03 ETH',
        actionType: 'TRANSFER',
        recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        amount: '0.03',
        tokenSymbol: 'ETH',
        chainId: 11155111,
        calldata: '0x',
        purposeExplanation: 'Test',
        estimatedGasEth: '0.00042',
      },
      riskAssessment: { riskScore: 10, overallLevel: 'LOW', summary: 'OK', factors: [] },
      policyEvaluation: { passed: true, hasBlockingViolations: false, warningsCount: 0, results: [] },
    });

    // Commit proposal
    await db.recordCommitment(p.id, testWallet);

    // Retrieve committed proposal to get commitment hash
    const pCommitted = await db.getProposalById(p.id, testWallet);
    const hash = pCommitted!.proposal.commitment!.sha256Hash;

    // Record approval
    await db.recordApprovalEvidence({
      proposalId: p.id,
      walletAddress: testWallet,
      approvedCommitmentHash: hash,
      approvalMethod: 'WALLET_PERSONAL_SIGN',
      signature: '0x1234',
    });

    const test7TxHash = `0x${crypto.randomBytes(32).toString('hex')}`;

    // Record execution with faithful parameters
    const execRes = await db.recordBlockchainExecution({
      proposalId: p.id,
      txHash: test7TxHash,
      blockNumber: 11950005,
      from: testWallet,
      to: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
      valueEth: '0.03',
      chainId: 11155111,
      gasUsed: 21000,
      effectiveGasPriceGwei: '15',
      status: 'SUCCESS',
      explorerUrl: `https://sepolia.etherscan.io/tx/${test7TxHash}`,
      mode: 'DEMO_TESTNET',
    });

    assert.strictEqual(execRes.verification.status, 'VERIFIED');
    assert.strictEqual(execRes.verification.checks.amountMatch.passed, true);
    assert.strictEqual(execRes.verification.checks.recipientMatch.passed, true);
    assert.strictEqual(execRes.verification.checks.chainMatch.passed, true);
  });

  test('8. Pagination: Properly pages, limits, and calculates totalPages', async () => {
    const res = await db.getProposalsPaginated({ page: 1, limit: 2 });
    assert.strictEqual(res.data.length, 2);
    assert.ok(res.pagination.total >= 3);
    assert.strictEqual(res.pagination.page, 1);
    assert.strictEqual(res.pagination.limit, 2);
    assert.strictEqual(res.pagination.hasNextPage, true);
    assert.strictEqual(res.pagination.hasPrevPage, false);
  });

  test('9. Audit Events: Creates audit trail for lifecycle events', async () => {
    const p = await db.createProposal({
      userWalletAddress: testWallet,
      userPrompt: 'Audit test proposal',
      intent: {
        rawPrompt: 'Send 0.02 ETH',
        actionType: 'TRANSFER',
        recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        amount: '0.02',
        tokenSymbol: 'ETH',
        chainId: 11155111,
        calldata: '0x',
        purposeExplanation: 'Audit',
        estimatedGasEth: '0.00042',
      },
      riskAssessment: { riskScore: 10, overallLevel: 'LOW', summary: 'OK', factors: [] },
      policyEvaluation: { passed: true, hasBlockingViolations: false, warningsCount: 0, results: [] },
    });

    const audits = await db.getAuditEvents(p.id, testWallet);
    assert.ok(audits.length >= 1);
    assert.strictEqual(audits[0].eventType, 'PROPOSAL_CREATED');
    assert.strictEqual(audits[0].proposalId, p.id);
  });
});

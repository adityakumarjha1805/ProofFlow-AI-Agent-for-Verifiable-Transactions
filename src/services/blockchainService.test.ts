import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_ID_HEX,
  validateTransactionParameters,
  verifyLiveExecution,
  getSepoliaPublicClient,
} from './blockchainService.ts';
import { createCryptographicCommitment } from './canonicalSerialization.ts';
import type { TransactionIntent, ExecutionReceipt } from '../types/index.ts';

test('Blockchain Service - Sepolia Constants & Client', () => {
  assert.equal(SEPOLIA_CHAIN_ID, 11155111);
  assert.equal(SEPOLIA_CHAIN_ID_HEX, '0xaa36a7');

  const client = getSepoliaPublicClient();
  assert.ok(client);
  assert.equal(client.chain?.id, 11155111);
});

test('Blockchain Service - Parameter Validation for Valid Transaction', () => {
  const result = validateTransactionParameters({
    recipient: '0x71C6bF12F455ddfe62Ec542866b595Fa6B78d91C',
    amount: '0.05',
    connectedWalletAddress: '0x1234567890123456789012345678901234567890',
    connectedChainId: 11155111,
    walletBalanceEth: '0.500',
    estimatedFeeEth: '0.0005',
  });

  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
});

test('Blockchain Service - Reject Missing & Syntactically Invalid Recipient', () => {
  const emptyRes = validateTransactionParameters({
    recipient: '',
    amount: '0.05',
    connectedChainId: 11155111,
  });
  assert.equal(emptyRes.isValid, false);
  assert.ok(emptyRes.errors.some((e) => e.includes('missing')));

  const invalidRes = validateTransactionParameters({
    recipient: '0xnot-a-valid-address',
    amount: '0.05',
    connectedChainId: 11155111,
  });
  assert.equal(invalidRes.isValid, false);
  assert.ok(invalidRes.errors.some((e) => e.includes('syntactically valid')));
});

test('Blockchain Service - Block Zero Address & Dead Burn Address', () => {
  const zeroRes = validateTransactionParameters({
    recipient: '0x0000000000000000000000000000000000000000',
    amount: '0.05',
    connectedChainId: 11155111,
  });
  assert.equal(zeroRes.isValid, false);
  assert.ok(zeroRes.errors.some((e) => e.includes('zero address')));

  const deadRes = validateTransactionParameters({
    recipient: '0x000000000000000000000000000000000000dead',
    amount: '0.05',
    connectedChainId: 11155111,
  });
  assert.equal(deadRes.isValid, false);
  assert.ok(deadRes.errors.some((e) => e.includes('0xdead burn address')));
});

test('Blockchain Service - Reject Non-Positive and Malformed Amounts', () => {
  const zeroAmount = validateTransactionParameters({
    recipient: '0x71C6bF12F455ddfe62Ec542866b595Fa6B78d91C',
    amount: '0',
    connectedChainId: 11155111,
  });
  assert.equal(zeroAmount.isValid, false);
  assert.ok(zeroAmount.errors.some((e) => e.includes('greater than 0')));

  const negativeAmount = validateTransactionParameters({
    recipient: '0x71C6bF12F455ddfe62Ec542866b595Fa6B78d91C',
    amount: '-0.5',
    connectedChainId: 11155111,
  });
  assert.equal(negativeAmount.isValid, false);

  const malformedAmount = validateTransactionParameters({
    recipient: '0x71C6bF12F455ddfe62Ec542866b595Fa6B78d91C',
    amount: 'abc',
    connectedChainId: 11155111,
  });
  assert.equal(malformedAmount.isValid, false);
  assert.ok(malformedAmount.errors.some((e) => e.includes('Invalid token amount')));
});

test('Blockchain Service - Enforce Sepolia Chain ID (Reject Wrong Network)', () => {
  const wrongChain = validateTransactionParameters({
    recipient: '0x71C6bF12F455ddfe62Ec542866b595Fa6B78d91C',
    amount: '0.05',
    connectedChainId: 1, // Mainnet instead of Sepolia
  });
  assert.equal(wrongChain.isValid, false);
  assert.ok(wrongChain.errors.some((e) => e.includes('does not match Ethereum Sepolia')));
});

test('Blockchain Service - Verify Approver Wallet Matches Connected Signer', () => {
  const mismatchApprover = validateTransactionParameters({
    recipient: '0x71C6bF12F455ddfe62Ec542866b595Fa6B78d91C',
    amount: '0.05',
    connectedWalletAddress: '0x1111111111111111111111111111111111111111',
    expectedApprover: '0x2222222222222222222222222222222222222222',
    connectedChainId: 11155111,
  });
  assert.equal(mismatchApprover.isValid, false);
  assert.ok(mismatchApprover.errors.some((e) => e.includes('designated proposal approver')));
});

test('Blockchain Service - Detect Insufficient Balance Including Estimated Gas Fee', () => {
  const insufficient = validateTransactionParameters({
    recipient: '0x71C6bF12F455ddfe62Ec542866b595Fa6B78d91C',
    amount: '0.10',
    walletBalanceEth: '0.08',
    estimatedFeeEth: '0.001',
    connectedChainId: 11155111,
  });
  assert.equal(insufficient.isValid, false);
  assert.ok(insufficient.errors.some((e) => e.includes('Insufficient funds')));
});

test('Blockchain Service - Verify Live On-Chain Parameters Against Intent Commitment', () => {
  const intent: TransactionIntent = {
    rawPrompt: 'Send 0.05 ETH to 0x71c6bf12f455ddfe62ec542866b595fa6b78d91c',
    actionType: 'TRANSFER',
    recipient: '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c',
    amount: '0.05',
    tokenSymbol: 'ETH',
    chainId: 11155111,
    calldata: '0x',
    purposeExplanation: 'Grant payment',
    estimatedGasEth: '0.0004',
  };

  const commitment = createCryptographicCommitment(intent, '0xapprover123');

  const matchingExecution: ExecutionReceipt = {
    txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    blockNumber: 11950000,
    from: '0xapprover123',
    to: '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c',
    valueEth: '0.05',
    chainId: 11155111,
    calldata: '0x',
    gasUsed: 21000,
    effectiveGasPriceGwei: '15.0',
    status: 'SUCCESS',
    explorerUrl: 'https://sepolia.etherscan.io/tx/0xaaaa',
    executedAt: new Date().toISOString(),
    mode: 'LIVE_WALLET',
  };

  const audit = verifyLiveExecution(intent, commitment, matchingExecution);
  assert.equal(audit.status, 'VERIFIED');
  assert.equal(audit.hashesMatch, true);

  // Altered recipient must fail verification with critical alert
  const tamperedExecution: ExecutionReceipt = {
    ...matchingExecution,
    to: '0x9999999999999999999999999999999999999999',
  };
  const tamperedAudit = verifyLiveExecution(intent, commitment, tamperedExecution);
  assert.equal(tamperedAudit.status, 'MISMATCH');
  assert.ok(tamperedAudit.auditSummary.includes('CRITICAL FRAUD ALERT'));
});

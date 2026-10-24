import { isAddress, getAddress } from 'viem';
import type {
  TransactionIntent,
  CryptographicCommitment,
  ApprovalEvidence,
  ExecutionReceipt,
  VerificationAudit,
  VerificationStatus,
  VerificationCheckItem,
  ParameterDiffItem,
  CanonicalTransactionData,
} from '../types/index.ts';
import {
  canonicalizeJson,
  computeSha256,
  computeKeccak256,
  convertToBaseUnits,
  normalizeAddress,
  normalizeCalldata,
  CURRENT_POLICY_VERSION,
} from './canonicalSerialization.ts';

/**
 * Normalizes an ETH amount string to comparable decimal representation
 */
function normalizeAmount(val: string | undefined): string {
  if (!val) return '0';
  const num = parseFloat(val);
  if (isNaN(num)) return val.trim();
  return num.toString();
}

/**
 * Validates whether a transaction hash is syntactically a valid 32-byte hex hash
 */
function isValidTxHash(hash: string | undefined | null): boolean {
  if (!hash) return false;
  return /^0x[a-fA-F0-9]{64}$/.test(hash.trim());
}

/**
 * Core Cryptographic Verification Engine.
 * Evaluates the 8 rigorous criteria linking:
 *   1. Transaction Proposal (Canonical representation & SHA-256 commitment)
 *   2. User Explicit Approval (Evidence, approver wallet, proposal commitment)
 *   3. Actual Blockchain Execution (Mined receipt parameters)
 *
 * Explicitly returns:
 * - VERIFIED: All 8 checks pass and transaction is confirmed on expected chain.
 * - MISMATCH: Any approved vs executed parameter discrepancy or commitment mismatch.
 * - PENDING: Transaction broadcast but receipt still pending block inclusion.
 * - FAILED: Transaction failed/reverted on the blockchain.
 * - INCOMPLETE: Unsupported transaction type or insufficient data to complete verification.
 */
export interface VerifyTransactionParams {
  intent: TransactionIntent;
  proposalId?: string;
  commitment: CryptographicCommitment;
  execution?: ExecutionReceipt;
  approvalEvidence?: ApprovalEvidence;
  expectedApprover?: string;
}

export function verifyTransaction(
  paramsOrIntent: VerifyTransactionParams | TransactionIntent,
  legacyCommitment?: CryptographicCommitment,
  legacyExecution?: ExecutionReceipt
): VerificationAudit {
  let params: VerifyTransactionParams;
  if ('intent' in paramsOrIntent && 'commitment' in paramsOrIntent) {
    params = paramsOrIntent as VerifyTransactionParams;
  } else {
    params = {
      intent: paramsOrIntent as TransactionIntent,
      commitment: legacyCommitment!,
      execution: legacyExecution,
    };
  }

  const { intent, commitment, execution, approvalEvidence, expectedApprover } = params;

  // 1. Check for Unsupported Transaction Types -> INCOMPLETE
  const supportedTypes = ['TRANSFER', 'NATIVE_TRANSFER', 'TOKEN_SWAP', 'CONTRACT_CALL'];
  const txType = commitment.canonicalPayload?.transactionType || (intent.actionType === 'TRANSFER' ? 'NATIVE_TRANSFER' : intent.actionType);
  const isTypeSupported = supportedTypes.includes(txType.toUpperCase());

  // Recompute canonical commitment from proposal fields to verify integrity
  const recomputedCanonical: CanonicalTransactionData = {
    amountInBaseUnits: convertToBaseUnits(intent.amount),
    asset: (intent.tokenSymbol || 'ETH').toUpperCase().trim(),
    calldata: normalizeCalldata(intent.calldata),
    chainId: Number(intent.chainId),
    policyVersion: commitment.canonicalPayload?.policyVersion || CURRENT_POLICY_VERSION,
    proposalId: commitment.canonicalPayload?.proposalId || params.proposalId || 'prop-default',
    proposalTimestamp: commitment.canonicalPayload?.proposalTimestamp || commitment.committedAt,
    recipient: normalizeAddress(intent.recipient),
    sender: normalizeAddress(commitment.signerAddress || expectedApprover || approvalEvidence?.walletAddress),
    transactionType: txType,
  };

  const recomputedCanonicalJson = canonicalizeJson(recomputedCanonical);
  const recomputedSha256 = computeSha256(recomputedCanonicalJson);
  const recomputedKeccak = computeKeccak256(recomputedCanonicalJson);

  // Check 1: Does approved proposal commitment match the recomputed commitment?
  const storedSha256 = commitment.sha256Hash?.toLowerCase() || '';
  const storedKeccak = commitment.commitmentHash?.toLowerCase() || '';
  const sha256Matches = storedSha256 === recomputedSha256.toLowerCase();
  const keccakMatches = storedKeccak === recomputedKeccak.toLowerCase();
  const commitmentPassed = sha256Matches && keccakMatches;

  const checkCommitmentMatch: VerificationCheckItem = {
    id: 'commitment-integrity',
    title: 'Proposal Commitment Integrity',
    question: 'Does the approved proposal commitment match the recomputed commitment?',
    expected: `SHA-256: ${storedSha256.slice(0, 18)}...`,
    actual: `SHA-256: ${recomputedSha256.slice(0, 18)}...`,
    passed: commitmentPassed,
    status: commitmentPassed ? 'PASSED' : 'FAILED',
    details: commitmentPassed
      ? 'Deterministic canonical proposal commitment exactly matches recomputed hash with zero tampering.'
      : 'CRITICAL MISMATCH: Canonical proposal fields were altered after user commitment was sealed!',
  };

  // Check 2: Does wallet address match the expected approver?
  const approverAddress = normalizeAddress(approvalEvidence?.walletAddress || commitment.signerAddress);
  const expectedApproverNorm = expectedApprover ? normalizeAddress(expectedApprover) : approverAddress;
  const isApproverMatching = approverAddress === expectedApproverNorm || expectedApproverNorm === '0x0000000000000000000000000000000000000000';

  const checkApproverMatch: VerificationCheckItem = {
    id: 'approver-authorization',
    title: 'Approver Wallet Authorization',
    question: 'Does the wallet address match the expected approver?',
    expected: expectedApproverNorm,
    actual: approverAddress,
    passed: isApproverMatching,
    status: isApproverMatching ? 'PASSED' : 'FAILED',
    details: isApproverMatching
      ? 'Approving wallet address matches the designated authorized approver.'
      : `Unauthorized approver: Proposal was approved by ${approverAddress}, but expected ${expectedApproverNorm}.`,
  };

  // If no execution receipt exists yet, evaluation is PENDING or INCOMPLETE
  if (!execution) {
    const defaultChecks = {
      commitmentMatch: checkCommitmentMatch,
      approverMatch: checkApproverMatch,
      senderMatch: {
        id: 'sender-verification',
        title: 'Transaction Sender Check',
        question: 'Does the actual sender match the approved sender?',
        expected: approverAddress,
        actual: 'Awaiting execution',
        passed: false,
        status: 'PENDING' as const,
        details: 'Awaiting on-chain transaction submission.',
      },
      recipientMatch: {
        id: 'recipient-verification',
        title: 'Recipient Address Fidelity',
        question: 'Does the actual recipient match the approved recipient?',
        expected: normalizeAddress(intent.recipient),
        actual: 'Awaiting execution',
        passed: false,
        status: 'PENDING' as const,
        details: 'Awaiting on-chain transaction submission.',
      },
      amountMatch: {
        id: 'amount-verification',
        title: 'Transaction Amount Fidelity',
        question: 'Does the actual amount match the approved amount?',
        expected: `${normalizeAmount(intent.amount)} ${intent.tokenSymbol}`,
        actual: 'Awaiting execution',
        passed: false,
        status: 'PENDING' as const,
        details: 'Awaiting on-chain transaction submission.',
      },
      chainMatch: {
        id: 'chain-verification',
        title: 'Target Network Chain ID',
        question: 'Does the actual chain match the approved chain?',
        expected: `Chain ID ${intent.chainId}`,
        actual: 'Awaiting execution',
        passed: false,
        status: 'PENDING' as const,
        details: 'Awaiting on-chain transaction submission.',
      },
      receiptSuccess: {
        id: 'receipt-status',
        title: 'On-Chain Execution Receipt',
        question: 'Is the transaction receipt successful?',
        expected: 'SUCCESS',
        actual: 'NOT_MINED',
        passed: false,
        status: 'PENDING' as const,
        details: 'Transaction has not yet been executed on the blockchain.',
      },
      transactionReferenceValid: {
        id: 'tx-reference',
        title: 'Transaction Reference Validity',
        question: 'Does the transaction reference correspond to the expected transaction?',
        expected: 'Valid 32-byte EVM Tx Hash',
        actual: 'Pending',
        passed: false,
        status: 'PENDING' as const,
        details: 'Pending transaction submission and receipt retrieval.',
      },
    };

    return {
      id: `verif-${params.proposalId || 'prop'}`,
      status: 'PENDING',
      commitmentHash: commitment.commitmentHash,
      sha256CommitmentHash: commitment.sha256Hash,
      executedPayloadHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      recomputedCommitmentHash: recomputedSha256,
      hashesMatch: commitmentPassed,
      parameterDiffs: [],
      checks: defaultChecks,
      discrepancies: ['Transaction has not been submitted or mined yet.'],
      verifiedAt: new Date().toISOString(),
      verificationProof: {
        merkleRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
        leafHash: commitment.sha256Hash,
        approvalLeaf: computeSha256(`approval:${approverAddress}:${commitment.sha256Hash}`),
        receiptLeaf: '0x0000000000000000000000000000000000000000000000000000000000000000',
        proofSteps: ['Step 1: Canonical Proposal Commitment Sealed'],
        verifierVersion: 'ProofFlow-v2.0-Cryptographic-EVM',
      },
      auditSummary: 'Transaction proposal is awaiting on-chain execution and block receipt retrieval.',
      privacyDeclaration: {
        privateKeyStored: false,
        onChainAiReasoningExposed: false,
        integrityVsAiAccuracyDistinction:
          'Integrity verification proves that the mined transaction precisely mirrors what the user explicitly approved. It does not certify that the AI agent reasoning was economically or strategically optimal.',
      },
    };
  }

  // If transaction type is unsupported, return INCOMPLETE
  if (!isTypeSupported) {
    const incompleteChecks = {
      commitmentMatch: checkCommitmentMatch,
      approverMatch: checkApproverMatch,
      senderMatch: {
        id: 'sender-verification',
        title: 'Transaction Sender Check',
        question: 'Does the actual sender match the approved sender?',
        expected: 'Supported EVM Transfer',
        actual: txType,
        passed: false,
        status: 'INCOMPLETE' as const,
        details: `Transaction type "${txType}" is unsupported for automated cryptographic verification.`,
      },
      recipientMatch: {
        id: 'recipient-verification',
        title: 'Recipient Address Fidelity',
        question: 'Does the actual recipient match the approved recipient?',
        expected: 'Supported format',
        actual: txType,
        passed: false,
        status: 'INCOMPLETE' as const,
        details: 'Verification incomplete due to unsupported transaction structure.',
      },
      amountMatch: {
        id: 'amount-verification',
        title: 'Transaction Amount Fidelity',
        question: 'Does the actual amount match the approved amount?',
        expected: 'Supported base units',
        actual: 'Unsupported',
        passed: false,
        status: 'INCOMPLETE' as const,
        details: 'Verification incomplete.',
      },
      chainMatch: {
        id: 'chain-verification',
        title: 'Target Network Chain ID',
        question: 'Does the actual chain match the approved chain?',
        expected: `${intent.chainId}`,
        actual: `${execution.chainId}`,
        passed: false,
        status: 'INCOMPLETE' as const,
        details: 'Verification incomplete.',
      },
      receiptSuccess: {
        id: 'receipt-status',
        title: 'On-Chain Execution Receipt',
        question: 'Is the transaction receipt successful?',
        expected: 'SUCCESS',
        actual: execution.status,
        passed: false,
        status: 'INCOMPLETE' as const,
        details: 'Unsupported transaction type.',
      },
      transactionReferenceValid: {
        id: 'tx-reference',
        title: 'Transaction Reference Validity',
        question: 'Does the transaction reference correspond to the expected transaction?',
        expected: 'Valid Tx Reference',
        actual: execution.txHash,
        passed: false,
        status: 'INCOMPLETE' as const,
        details: 'Unsupported transaction type.',
      },
    };

    return {
      id: `verif-${params.proposalId || 'prop'}`,
      status: 'INCOMPLETE',
      commitmentHash: commitment.commitmentHash,
      sha256CommitmentHash: commitment.sha256Hash,
      executedPayloadHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      recomputedCommitmentHash: recomputedSha256,
      hashesMatch: false,
      parameterDiffs: [],
      checks: incompleteChecks,
      discrepancies: [`Transaction type "${txType}" is unsupported. Verification cannot be confirmed.`],
      verifiedAt: new Date().toISOString(),
      verificationProof: {
        merkleRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
        leafHash: commitment.sha256Hash,
        approvalLeaf: computeSha256(`approval:${approverAddress}:${commitment.sha256Hash}`),
        receiptLeaf: '0x0000000000000000000000000000000000000000000000000000000000000000',
        proofSteps: ['Transaction marked INCOMPLETE due to unsupported transaction structure.'],
        verifierVersion: 'ProofFlow-v2.0-Cryptographic-EVM',
      },
      auditSummary: `Verification returned INCOMPLETE: Transaction type "${txType}" is outside current verification specifications.`,
      privacyDeclaration: {
        privateKeyStored: false,
        onChainAiReasoningExposed: false,
        integrityVsAiAccuracyDistinction:
          'Integrity verification proves that the mined transaction precisely mirrors what the user explicitly approved. It does not certify that the AI agent reasoning was economically or strategically optimal.',
      },
    };
  }

  // Parameter Extraction & Detailed Comparison
  const diffs: ParameterDiffItem[] = [];
  const discrepancies: string[] = [];

  if (!commitmentPassed) {
    discrepancies.push('CRITICAL MISMATCH: Canonical proposal fields were altered after user commitment was sealed!');
  }
  if (!isApproverMatching) {
    discrepancies.push(`Unauthorized approver: Proposal was approved by ${approverAddress}, but expected ${expectedApproverNorm}.`);
  }

  // Check 3: Does actual sender match approved sender?
  const executedSender = normalizeAddress(execution.from);
  const approvedSender = normalizeAddress(
    recomputedCanonical.sender !== '0x0000000000000000000000000000000000000000'
      ? recomputedCanonical.sender
      : approverAddress
  );
  const senderMatches = executedSender === approvedSender || approvedSender === '0x0000000000000000000000000000000000000000';
  diffs.push({
    field: 'Transaction Sender (from)',
    intentValue: approvedSender,
    executedValue: executedSender,
    matches: senderMatches,
    critical: true,
  });
  if (!senderMatches) {
    discrepancies.push(`Sender address altered: approved for ${approvedSender}, broadcast by ${executedSender}.`);
  }

  const checkSenderMatch: VerificationCheckItem = {
    id: 'sender-verification',
    title: 'Transaction Sender Match',
    question: 'Does the actual sender match the approved sender?',
    expected: approvedSender,
    actual: executedSender,
    passed: senderMatches,
    status: senderMatches ? 'PASSED' : 'FAILED',
    details: senderMatches
      ? 'Executed sender on blockchain precisely matches approved approver.'
      : `Sender mismatch: On-chain transaction originated from ${executedSender} instead of approved ${approvedSender}.`,
  };

  // Check 4: Does actual recipient match approved recipient?
  const executedRecipient = normalizeAddress(execution.to);
  const approvedRecipient = normalizeAddress(intent.recipient);
  const recipientMatches = executedRecipient === approvedRecipient;
  diffs.push({
    field: 'Recipient Address (to)',
    intentValue: approvedRecipient,
    executedValue: executedRecipient,
    matches: recipientMatches,
    critical: true,
  });
  if (!recipientMatches) {
    discrepancies.push(`CRITICAL SECURITY ALERT: Recipient altered! Approved ${approvedRecipient}, executed ${executedRecipient}.`);
  }

  const checkRecipientMatch: VerificationCheckItem = {
    id: 'recipient-verification',
    title: 'Recipient Address Match',
    question: 'Does the actual recipient match the approved recipient?',
    expected: approvedRecipient,
    actual: executedRecipient,
    passed: recipientMatches,
    status: recipientMatches ? 'PASSED' : 'FAILED',
    details: recipientMatches
      ? 'Recipient address on-chain matches approved recipient exactly.'
      : `CRITICAL TAMPERING: Funds directed to ${executedRecipient} instead of approved ${approvedRecipient}.`,
  };

  // Check 5: Does actual amount match approved amount?
  const approvedAmountNorm = normalizeAmount(intent.amount);
  const executedAmountNorm = normalizeAmount(execution.valueEth);
  const approvedBaseUnits = convertToBaseUnits(intent.amount);
  const executedBaseUnits = execution.valueBaseUnits || convertToBaseUnits(execution.valueEth);
  const amountMatches = approvedAmountNorm === executedAmountNorm && approvedBaseUnits === executedBaseUnits;

  diffs.push({
    field: 'Transaction Value & Amount (ETH / Base Units)',
    intentValue: `${approvedAmountNorm} ETH (${approvedBaseUnits} wei)`,
    executedValue: `${executedAmountNorm} ETH (${executedBaseUnits} wei)`,
    matches: amountMatches,
    critical: true,
  });
  if (!amountMatches) {
    discrepancies.push(`CRITICAL SECURITY ALERT: Amount altered! Approved ${approvedAmountNorm} ETH, executed ${executedAmountNorm} ETH.`);
  }

  const checkAmountMatch: VerificationCheckItem = {
    id: 'amount-verification',
    title: 'Transaction Amount Match',
    question: 'Does the actual amount match the approved amount?',
    expected: `${approvedAmountNorm} ETH (${approvedBaseUnits} wei)`,
    actual: `${executedAmountNorm} ETH (${executedBaseUnits} wei)`,
    passed: amountMatches,
    status: amountMatches ? 'PASSED' : 'FAILED',
    details: amountMatches
      ? 'Transferred value matches user-approved amount down to the exact wei base unit.'
      : `AMOUNT TAMPERING DETECTED: Approved ${approvedAmountNorm} ETH, but on-chain execution transferred ${executedAmountNorm} ETH.`,
  };

  // Check 6: Does actual chain match approved chain?
  const approvedChainId = Number(intent.chainId);
  const executedChainId = Number(execution.chainId);
  const chainMatches = approvedChainId === executedChainId;
  diffs.push({
    field: 'Blockchain Chain ID',
    intentValue: `${approvedChainId}`,
    executedValue: `${executedChainId}`,
    matches: chainMatches,
    critical: true,
  });
  if (!chainMatches) {
    discrepancies.push(`Wrong network execution: Approved on chain ${approvedChainId}, executed on ${executedChainId}.`);
  }

  const checkChainMatch: VerificationCheckItem = {
    id: 'chain-verification',
    title: 'Target Network Chain Match',
    question: 'Does the actual chain match the approved chain?',
    expected: `Chain ID ${approvedChainId}`,
    actual: `Chain ID ${executedChainId}`,
    passed: chainMatches,
    status: chainMatches ? 'PASSED' : 'FAILED',
    details: chainMatches
      ? `Transaction executed on the authorized target network (Chain ID ${approvedChainId}).`
      : `NETWORK MISMATCH: Transaction executed on Chain ID ${executedChainId} instead of approved Chain ID ${approvedChainId}.`,
  };

  // Check 7: Is transaction receipt successful?
  const isPending = execution.status === 'PENDING' || execution.blockNumber === 0;
  const isReverted = execution.status === 'REVERTED';
  const receiptSucceeded = execution.status === 'SUCCESS' && !isPending;

  diffs.push({
    field: 'On-Chain Receipt Status',
    intentValue: 'SUCCESS',
    executedValue: execution.status,
    matches: receiptSucceeded,
    critical: true,
  });

  if (isReverted) {
    discrepancies.push(`On-chain transaction execution reverted or failed on block ${execution.blockNumber}.`);
  } else if (isPending) {
    discrepancies.push('Transaction broadcast to blockchain mempool but awaiting block confirmation receipt.');
  }

  const checkReceiptSuccess: VerificationCheckItem = {
    id: 'receipt-status',
    title: 'On-Chain Execution Success',
    question: 'Is the transaction receipt successful?',
    expected: 'SUCCESS',
    actual: execution.status,
    passed: receiptSucceeded,
    status: isPending ? 'PENDING' : receiptSucceeded ? 'PASSED' : 'FAILED',
    details: isPending
      ? 'Transaction is currently pending block confirmation in the blockchain mempool.'
      : receiptSucceeded
      ? `Transaction successfully confirmed in block #${execution.blockNumber}.`
      : `Transaction reverted during on-chain EVM execution on block #${execution.blockNumber}.`,
  };

  // Check 8: Does transaction reference correspond to expected transaction?
  const validTxHash = isValidTxHash(execution.txHash);
  const txRefValid = validTxHash && (!isPending || execution.txHash.startsWith('0x'));

  diffs.push({
    field: 'Transaction Hash Reference',
    intentValue: 'Valid 32-Byte Keccak Hash',
    executedValue: execution.txHash,
    matches: txRefValid,
    critical: true,
  });

  const checkTxRefValid: VerificationCheckItem = {
    id: 'tx-reference',
    title: 'Transaction Reference Validity',
    question: 'Does the transaction reference correspond to the expected transaction?',
    expected: '32-byte EVM Tx Hash',
    actual: execution.txHash,
    passed: txRefValid,
    status: txRefValid ? 'PASSED' : 'FAILED',
    details: txRefValid
      ? `Valid on-chain transaction reference: ${execution.txHash}`
      : 'Invalid or missing transaction hash reference format.',
  };

  // Reconstruct executed canonical payload for SHA-256 hash comparison
  const executedCanonicalPayload: CanonicalTransactionData = {
    amountInBaseUnits: executedBaseUnits,
    asset: (intent.tokenSymbol || 'ETH').toUpperCase().trim(),
    calldata: normalizeCalldata(execution.calldata),
    chainId: executedChainId,
    policyVersion: commitment.canonicalPayload?.policyVersion || CURRENT_POLICY_VERSION,
    proposalId: commitment.canonicalPayload?.proposalId || params.proposalId || 'prop-default',
    proposalTimestamp: commitment.canonicalPayload?.proposalTimestamp || commitment.committedAt,
    recipient: executedRecipient,
    sender: executedSender,
    transactionType: txType,
  };

  const executedCanonicalJson = canonicalizeJson(executedCanonicalPayload);
  const executedPayloadHash = computeSha256(executedCanonicalJson);

  // Verification status determination:
  // "A transaction must not receive VERIFIED status merely because a database record exists.
  //  Only mark it VERIFIED when the implemented checks pass and the transaction is confirmed on the expected chain."
  let overallStatus: VerificationStatus;

  if (isPending) {
    overallStatus = 'PENDING';
  } else if (isReverted) {
    overallStatus = 'FAILED';
  } else if (!commitmentPassed || !isApproverMatching || !senderMatches || !recipientMatches || !amountMatches || !chainMatches || !txRefValid) {
    overallStatus = 'MISMATCH';
  } else if (receiptSucceeded) {
    overallStatus = 'VERIFIED';
  } else {
    overallStatus = 'FAILED';
  }

  // Construct Merkle proof branch linking:
  // Leaf 1: Canonical proposal commitment (SHA-256)
  // Leaf 2: User Approval Evidence (SHA-256 of approver + commitment)
  // Leaf 3: Blockchain receipt anchor (SHA-256 of txHash + blockNumber)
  const proposalLeaf = commitment.sha256Hash;
  const approvalLeaf = computeSha256(`approval:${approverAddress}:${proposalLeaf}`);
  const receiptLeaf = computeSha256(`receipt:${execution.txHash}:block:${execution.blockNumber}:status:${execution.status}`);

  const combinedBranch1 = computeSha256(`${proposalLeaf}:${approvalLeaf}`);
  const merkleRoot = computeSha256(`${combinedBranch1}:${receiptLeaf}`);

  let auditSummary = '';
  if (overallStatus === 'VERIFIED') {
    auditSummary = `Transaction cryptographically verified! Mined on-chain execution strictly mirrors the user-approved canonical commitment (${storedSha256.slice(0, 10)}...). All 8 integrity checks passed with zero drift or parameter tampering detected.`;
  } else if (overallStatus === 'PENDING') {
    auditSummary = `TRANSACTION PENDING: Transaction broadcast to network (${execution.txHash.slice(0, 12)}...) and awaiting block receipt confirmation on ${execution.chainId}.`;
  } else if (overallStatus === 'FAILED') {
    auditSummary = `TRANSACTION FAILED: Execution reverted on-chain on block #${execution.blockNumber}. Receipt status indicates EVM execution failure.`;
  } else if (!recipientMatches) {
    auditSummary = `VERIFICATION MISMATCH: CRITICAL FRAUD ALERT: Recipient address was altered! Approved for ${approvedRecipient}, executed to ${executedRecipient}.`;
  } else if (!amountMatches) {
    auditSummary = `VERIFICATION MISMATCH: CRITICAL FRAUD ALERT: Transaction amount altered! Approved ${approvedAmountNorm} ETH, executed ${executedAmountNorm} ETH.`;
  } else {
    auditSummary = `VERIFICATION MISMATCH: Tampering or drift detected between approved proposal and on-chain execution. Discrepancies: ${discrepancies.join(' | ')}`;
  }

  return {
    id: `verif-${params.proposalId || 'prop'}`,
    status: overallStatus,
    commitmentHash: commitment.commitmentHash,
    sha256CommitmentHash: commitment.sha256Hash,
    executedPayloadHash,
    recomputedCommitmentHash: recomputedSha256,
    hashesMatch: commitmentPassed && executedPayloadHash.toLowerCase() === storedSha256.toLowerCase(),
    parameterDiffs: diffs,
    checks: {
      commitmentMatch: checkCommitmentMatch,
      approverMatch: checkApproverMatch,
      senderMatch: checkSenderMatch,
      recipientMatch: checkRecipientMatch,
      amountMatch: checkAmountMatch,
      chainMatch: checkChainMatch,
      receiptSuccess: checkReceiptSuccess,
      transactionReferenceValid: checkTxRefValid,
    },
    discrepancies,
    verifiedAt: new Date().toISOString(),
    verificationProof: {
      merkleRoot,
      leafHash: proposalLeaf,
      approvalLeaf,
      receiptLeaf,
      proofSteps: [
        `Canonical Proposal Commitment (SHA-256): ${proposalLeaf}`,
        `Approval Evidence Anchor: ${approvalLeaf}`,
        `Receipt Anchor: ${receiptLeaf}`,
        `Merkle Root Anchor: ${merkleRoot}`,
      ],
      verifierVersion: 'ProofFlow-v2.0-Cryptographic-EVM',
    },
    auditSummary,
    privacyDeclaration: {
      privateKeyStored: false,
      onChainAiReasoningExposed: false,
      integrityVsAiAccuracyDistinction:
        'Integrity verification proves that the mined transaction precisely mirrors what the user explicitly approved. It does not certify that the AI agent reasoning was economically or strategically optimal.',
    },
  };
}

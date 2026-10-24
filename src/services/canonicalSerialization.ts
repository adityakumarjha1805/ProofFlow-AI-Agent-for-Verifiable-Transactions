import { keccak256, sha256, stringToBytes, parseEther, isAddress, getAddress } from 'viem';
import type {
  TransactionIntent,
  CanonicalTransactionData,
  CryptographicCommitment,
} from '../types/index.ts';

export const CURRENT_POLICY_VERSION = 'proof-flow-policy-v1.0';

/**
 * Deterministically sorts all object keys recursively conforming to
 * RFC 8785 JSON Canonicalization Scheme (JCS) principles:
 * - Deterministic lexicographical sorting of keys
 * - No extra whitespace between tokens
 * - Consistent string escaping via JSON.stringify
 * - Explicit and stable numeric representation
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalizeJson(item)).join(',') + ']';
  }

  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const pairs = sortedKeys.map((key) => {
    return JSON.stringify(key) + ':' + canonicalizeJson(record[key]);
  });

  return '{' + pairs.join(',') + '}';
}

/**
 * Converts decimal amount string to atomic base units (Wei for ETH)
 * using string parsing / BigInt to eliminate 64-bit IEEE-754 float precision loss.
 */
export function convertToBaseUnits(amountStr: string, decimals: number = 18): string {
  const clean = (amountStr || '0').trim();
  try {
    if (decimals === 18) {
      return parseEther(clean).toString();
    }
    // Custom decimals fallback
    const parts = clean.split('.');
    const integerPart = parts[0] || '0';
    let fractionPart = parts[1] || '';
    if (fractionPart.length > decimals) {
      fractionPart = fractionPart.slice(0, decimals);
    } else {
      fractionPart = fractionPart.padEnd(decimals, '0');
    }
    const combined = `${integerPart}${fractionPart}`.replace(/^0+/, '') || '0';
    return BigInt(combined).toString();
  } catch {
    return '0';
  }
}

/**
 * Normalizes an Ethereum address into lowercase canonical format
 */
export function normalizeAddress(addr: string | undefined | null): string {
  if (!addr) return '0x0000000000000000000000000000000000000000';
  const clean = addr.trim();
  if (isAddress(clean, { strict: false })) {
    return clean.toLowerCase();
  }
  return clean.toLowerCase();
}

/**
 * Normalizes EVM calldata hex string
 */
export function normalizeCalldata(cd: string | undefined | null): string {
  if (!cd || cd.trim() === '') return '0x';
  const clean = cd.trim().toLowerCase();
  return clean.startsWith('0x') ? clean : `0x${clean}`;
}

/**
 * Builds the canonical structured representation of a transaction proposal.
 * Every field required by the cryptographic verification engine is explicitly captured.
 */
export function buildCanonicalTransactionData(params: {
  proposalId: string;
  chainId: number;
  sender?: string;
  recipient: string;
  asset?: string;
  amount: string;
  transactionType?: string;
  calldata?: string;
  policyVersion?: string;
  proposalTimestamp?: string;
}): CanonicalTransactionData {
  const asset = (params.asset || 'ETH').toUpperCase().trim();
  const amountInBaseUnits = convertToBaseUnits(params.amount);
  const normalizedSender = normalizeAddress(params.sender);
  const normalizedRecipient = normalizeAddress(params.recipient);
  const normalizedCalldata = normalizeCalldata(params.calldata);
  const transactionType = params.transactionType || (normalizedCalldata === '0x' ? 'NATIVE_TRANSFER' : 'CONTRACT_CALL');

  return {
    amountInBaseUnits,
    asset,
    calldata: normalizedCalldata,
    chainId: Number(params.chainId),
    policyVersion: params.policyVersion || CURRENT_POLICY_VERSION,
    proposalId: params.proposalId,
    proposalTimestamp: params.proposalTimestamp || new Date().toISOString(),
    recipient: normalizedRecipient,
    sender: normalizedSender,
    transactionType,
  };
}

/**
 * Computes standard cryptographic SHA-256 hex string over canonical UTF-8 bytes
 */
export function computeSha256(content: string): string {
  const bytes = stringToBytes(content);
  return sha256(bytes);
}

/**
 * Computes EVM Keccak-256 hex string over canonical UTF-8 bytes
 */
export function computeKeccak256(content: string): string {
  const bytes = stringToBytes(content);
  return keccak256(bytes);
}

/**
 * Creates the Cryptographic Commitment for an approved Transaction Proposal.
 * Generates both NIST FIPS-180-4 SHA-256 and EVM Keccak-256 commitments over
 * the RFC 8785 canonical serialization of the proposal fields.
 */
export interface CreateCommitmentOptions {
  proposalId?: string;
  signerAddress?: string;
  nonce?: number;
  policyVersion?: string;
  proposalTimestamp?: string;
  signature?: string;
}

export function createCryptographicCommitment(
  intent: TransactionIntent,
  optionsOrSigner?: string | CreateCommitmentOptions,
  legacyNonce?: number
): CryptographicCommitment {
  let opts: CreateCommitmentOptions = {};
  if (typeof optionsOrSigner === 'string') {
    opts = {
      signerAddress: optionsOrSigner,
      nonce: legacyNonce,
    };
  } else if (optionsOrSigner && typeof optionsOrSigner === 'object') {
    opts = optionsOrSigner;
  }

  const proposalId = opts.proposalId || 'prop-default';
  const proposalTimestamp = opts.proposalTimestamp || new Date().toISOString();
  const policyVersion = opts.policyVersion || CURRENT_POLICY_VERSION;

  const canonicalPayload = buildCanonicalTransactionData({
    proposalId,
    chainId: intent.chainId,
    sender: opts.signerAddress,
    recipient: intent.recipient,
    asset: intent.tokenSymbol,
    amount: intent.amount,
    transactionType: intent.actionType === 'TRANSFER' ? 'NATIVE_TRANSFER' : intent.actionType,
    calldata: intent.calldata,
    policyVersion,
    proposalTimestamp,
  });

  const canonicalPayloadJson = canonicalizeJson(canonicalPayload);
  const sha256Hash = computeSha256(canonicalPayloadJson);
  const commitmentHash = computeKeccak256(canonicalPayloadJson);

  return {
    commitmentHash,
    sha256Hash,
    canonicalPayload,
    canonicalPayloadJson,
    committedAt: proposalTimestamp,
    signerAddress: opts.signerAddress ? normalizeAddress(opts.signerAddress) : undefined,
    nonce: opts.nonce,
    signature: opts.signature,
  };
}

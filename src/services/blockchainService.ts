import {
  createPublicClient,
  http,
  fallback,
  parseEther,
  formatEther,
  isAddress,
  getAddress,
  type Hash,
  type Address,
  type PublicClient,
  type TransactionReceipt,
  type Transaction,
} from 'viem';
import { sepolia } from 'viem/chains';
import type {
  ExecutionReceipt,
  SupportedChainId,
  TransactionIntent,
  CryptographicCommitment,
  VerificationAudit,
} from '../types/index.ts';
import { verifyTransaction } from './verificationEngine.ts';

// Ethereum Sepolia Constants
export const SEPOLIA_CHAIN_ID: SupportedChainId = 11155111;
export const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7';

export const SEPOLIA_RPC_ENDPOINTS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://rpc.sepolia.org',
  'https://1rpc.io/sepolia',
  'https://endpoints.omniatech.io/v1/eth/sepolia/public',
];

export const SEPOLIA_CONFIG = {
  chainId: SEPOLIA_CHAIN_ID,
  chainIdHex: SEPOLIA_CHAIN_ID_HEX,
  chainName: 'Ethereum Sepolia Testnet',
  nativeCurrency: {
    name: 'Sepolia ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: SEPOLIA_RPC_ENDPOINTS,
  blockExplorerUrls: ['https://sepolia.etherscan.io'],
};

/**
 * Creates a robust public client for Ethereum Sepolia using viem
 */
export function getSepoliaPublicClient(customRpcUrl?: string): PublicClient {
  const transports = customRpcUrl
    ? [http(customRpcUrl), ...SEPOLIA_RPC_ENDPOINTS.map((url) => http(url))]
    : SEPOLIA_RPC_ENDPOINTS.map((url) => http(url));

  return createPublicClient({
    chain: sepolia,
    transport: fallback(transports, { rank: false }),
  });
}

// Singleton public client instance
let sharedPublicClient: PublicClient | null = null;
export function getSharedSepoliaClient(): PublicClient {
  if (!sharedPublicClient) {
    sharedPublicClient = getSepoliaPublicClient();
  }
  return sharedPublicClient;
}

/**
 * Checks whether an injected EIP-1193 Ethereum provider is available in the browser window
 */
export function getInjectedProvider(): any | null {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return (window as any).ethereum;
  }
  return null;
}

export interface WalletConnectionResult {
  address: string;
  checksumAddress: string;
  chainId: number;
  isSepolia: boolean;
  balanceEth: string;
}

/**
 * Connects the user's wallet via EIP-1193 standard eth_requestAccounts
 */
export async function connectInjectedWallet(): Promise<WalletConnectionResult> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error(
      'No Web3 wallet provider detected. Please install MetaMask, Rabby, or a compatible Ethereum wallet extension.'
    );
  }

  try {
    const accounts = (await provider.request({
      method: 'eth_requestAccounts',
    })) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts selected by the user.');
    }

    const rawAddress = accounts[0];
    const checksumAddress = getAddress(rawAddress);

    const chainIdHex = (await provider.request({
      method: 'eth_chainId',
    })) as string;
    const chainId = parseInt(chainIdHex, 16);

    // Read real on-chain balance via public client
    let balanceEth = '0.000';
    try {
      const client = getSharedSepoliaClient();
      const balanceWei = await client.getBalance({
        address: checksumAddress as Address,
      });
      balanceEth = parseFloat(formatEther(balanceWei)).toFixed(4);
    } catch (balErr) {
      console.warn('Could not read initial on-chain balance:', balErr);
    }

    return {
      address: rawAddress,
      checksumAddress,
      chainId,
      isSepolia: chainId === SEPOLIA_CHAIN_ID,
      balanceEth,
    };
  } catch (err: any) {
    if (err.code === 4001) {
      throw new Error('Wallet connection request was rejected by the user.');
    }
    throw new Error(err.message || 'Failed to connect Web3 wallet.');
  }
}

/**
 * Switches the user's wallet to Ethereum Sepolia, or prompts to add it if missing
 */
export async function switchOrAddSepoliaNetwork(): Promise<boolean> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error('No Web3 wallet provider detected.');
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
    });
    return true;
  } catch (switchError: any) {
    // Error code 4902 indicates that the chain has not been added to the wallet yet
    if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: SEPOLIA_CONFIG.chainIdHex,
              chainName: SEPOLIA_CONFIG.chainName,
              nativeCurrency: SEPOLIA_CONFIG.nativeCurrency,
              rpcUrls: [SEPOLIA_CONFIG.rpcUrls[0]],
              blockExplorerUrls: SEPOLIA_CONFIG.blockExplorerUrls,
            },
          ],
        });
        return true;
      } catch (addError: any) {
        throw new Error(addError.message || 'Failed to add Sepolia testnet to wallet.');
      }
    }
    if (switchError.code === 4001) {
      throw new Error('Network switch was declined by the user in the wallet.');
    }
    throw new Error(switchError.message || 'Failed to switch network in wallet.');
  }
}

/**
 * Reads the actual native token (ETH) balance for any address on Ethereum Sepolia
 */
export async function fetchLiveSepoliaBalance(
  address: string,
  client: PublicClient = getSharedSepoliaClient()
): Promise<{
  balanceWei: bigint;
  balanceEth: string;
  rawWeiHex: string;
  blockNumber: bigint;
}> {
  if (!isAddress(address, { strict: false })) {
    throw new Error(`Invalid Ethereum address format: ${address}`);
  }

  const checksumAddr = getAddress(address.toLowerCase()) as Address;
  const [balanceWei, blockNumber] = await Promise.all([
    client.getBalance({ address: checksumAddr }),
    client.getBlockNumber(),
  ]);

  return {
    balanceWei,
    balanceEth: formatEther(balanceWei),
    rawWeiHex: `0x${balanceWei.toString(16)}`,
    blockNumber,
  };
}

export interface EstimatedFeeResult {
  gasUnits: bigint;
  baseFeeGwei: string;
  priorityFeeGwei: string;
  maxFeePerGasGwei: string;
  totalEstimatedFeeEth: string;
  totalEstimatedFeeUsd: string;
  currentBlock: bigint;
}

/**
 * Estimates transaction fees using live Sepolia RPC gas prices and block base fees
 */
export async function estimateSepoliaTransactionFee(
  toAddress: string,
  amountEth: string,
  fromAddress?: string,
  client: PublicClient = getSharedSepoliaClient()
): Promise<EstimatedFeeResult> {
  const currentBlock = await client.getBlockNumber();
  const gasPrice = await client.getGasPrice();

  let gasUnits = 21000n; // Standard native transfer gas units
  if (
    fromAddress &&
    isAddress(fromAddress, { strict: false }) &&
    isAddress(toAddress, { strict: false })
  ) {
    try {
      const estimated = await client.estimateGas({
        account: getAddress(fromAddress.toLowerCase()) as Address,
        to: getAddress(toAddress.toLowerCase()) as Address,
        value: parseEther(amountEth || '0.001'),
      });
      gasUnits = estimated;
    } catch {
      // Default to standard 21,000 for simple transfers if simulation fails
      gasUnits = 21000n;
    }
  }

  const baseFeeGwei = (Number(gasPrice) / 1e9).toFixed(2);
  const priorityFeeGwei = '1.50';
  const maxFeePerGasWei = gasPrice + BigInt(Math.round(1.5 * 1e9));
  const maxFeePerGasGwei = (Number(maxFeePerGasWei) / 1e9).toFixed(2);

  const totalFeeWei = gasUnits * maxFeePerGasWei;
  const totalEstimatedFeeEth = formatEther(totalFeeWei);
  const totalEstimatedFeeUsd = (parseFloat(totalEstimatedFeeEth) * 3100).toFixed(4);

  return {
    gasUnits,
    baseFeeGwei,
    priorityFeeGwei,
    maxFeePerGasGwei,
    totalEstimatedFeeEth,
    totalEstimatedFeeUsd,
    currentBlock,
  };
}

export interface ParameterValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates transaction parameters against safety rules, wallet state, and chain conditions
 */
export function validateTransactionParameters(params: {
  recipient: string;
  amount: string;
  connectedWalletAddress?: string | null;
  connectedChainId?: number | null;
  walletBalanceEth?: string;
  expectedApprover?: string | null;
  estimatedFeeEth?: string;
}): ParameterValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Recipient Validation
  const recipient = (params.recipient || '').trim();
  if (!recipient) {
    errors.push('Recipient address is missing.');
  } else if (!isAddress(recipient, { strict: false })) {
    errors.push(`Recipient "${recipient}" is not a syntactically valid EVM address.`);
  } else {
    const lower = recipient.toLowerCase();
    if (lower === '0x0000000000000000000000000000000000000000') {
      errors.push('Recipient is the zero address. Sending funds here results in permanent loss.');
    } else if (lower === '0x000000000000000000000000000000000000dead') {
      errors.push('Recipient is the 0xdead burn address. Funds will be permanently destroyed.');
    }
  }

  // 2. Amount Validation
  const amountStr = (params.amount || '').trim();
  let parsedWei: bigint | null = null;
  if (!amountStr) {
    errors.push('Transaction amount is missing.');
  } else {
    try {
      parsedWei = parseEther(amountStr);
      if (parsedWei <= 0n) {
        errors.push('Transaction amount must be strictly greater than 0.');
      }
    } catch {
      errors.push(`Invalid token amount format: "${amountStr}". Must be a valid decimal string.`);
    }
  }

  // 3. Chain ID Validation
  if (params.connectedChainId !== undefined && params.connectedChainId !== null) {
    if (params.connectedChainId !== SEPOLIA_CHAIN_ID) {
      errors.push(
        `Connected network (Chain ID: ${params.connectedChainId}) does not match Ethereum Sepolia (Chain ID: ${SEPOLIA_CHAIN_ID}). Please switch networks.`
      );
    }
  }

  // 4. Expected Approver Match
  if (params.expectedApprover && params.connectedWalletAddress) {
    if (
      params.expectedApprover.toLowerCase() !==
      params.connectedWalletAddress.toLowerCase()
    ) {
      errors.push(
        `Connected wallet (${params.connectedWalletAddress}) does not match the designated proposal approver (${params.expectedApprover}).`
      );
    }
  }

  // 5. Balance & Total Cost Checks
  if (parsedWei !== null && params.walletBalanceEth) {
    try {
      const balanceWei = parseEther(params.walletBalanceEth);
      const feeWei = params.estimatedFeeEth ? parseEther(params.estimatedFeeEth) : 21000n * 20n * 1000000000n;
      const totalCostWei = parsedWei + feeWei;

      if (balanceWei < totalCostWei) {
        errors.push(
          `Insufficient funds: Wallet balance (${params.walletBalanceEth} ETH) is lower than total cost (${formatEther(totalCostWei)} ETH including estimated gas).`
        );
      }
    } catch {
      // ignore parsing failure in optional balance check
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Prepares and sends a native transfer transaction through the connected wallet provider.
 * CRITICAL: Rechecks the proposal commitment before opening the wallet confirmation prompt.
 */
export async function sendNativeTokenTransaction(params: {
  to: string;
  amountEth: string;
  from: string;
  currentCommitmentHash: string;
  expectedCommitmentHash: string;
}): Promise<Hash> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error('No Web3 wallet provider detected. Connect a wallet to execute.');
  }

  // Security Gate: Ensure commitment hashes match exactly
  if (
    params.currentCommitmentHash.toLowerCase() !==
    params.expectedCommitmentHash.toLowerCase()
  ) {
    throw new Error(
      'Security Tampering Detected: The proposal commitment hash does not match the approved intent. Transaction aborted.'
    );
  }

  // Validate parameters
  if (!isAddress(params.to, { strict: false })) {
    throw new Error(`Invalid destination address: ${params.to}`);
  }
  if (!isAddress(params.from, { strict: false })) {
    throw new Error(`Invalid sender address: ${params.from}`);
  }

  const checksumTo = getAddress(params.to.toLowerCase());
  const checksumFrom = getAddress(params.from.toLowerCase());
  const weiValueHex = '0x' + parseEther(params.amountEth).toString(16);

  try {
    const txHash = (await provider.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: checksumFrom,
          to: checksumTo,
          value: weiValueHex,
          data: '0x',
        },
      ],
    })) as Hash;

    return txHash;
  } catch (err: any) {
    if (err.code === 4001 || err.message?.includes('User rejected')) {
      throw new Error('Transaction was rejected by the user in the wallet.');
    }
    if (err.message?.includes('insufficient funds')) {
      throw new Error('Wallet has insufficient funds to cover the amount plus gas fee.');
    }
    throw new Error(err.message || 'RPC error occurred while broadcasting the transaction.');
  }
}

/**
 * Polls for the on-chain transaction receipt from Sepolia RPC and retrieves verified parameters.
 */
export async function waitForSepoliaReceipt(
  txHash: Hash,
  client: PublicClient = getSharedSepoliaClient(),
  onProgress?: (message: string) => void
): Promise<{
  receipt: TransactionReceipt;
  transaction: Transaction;
  execution: ExecutionReceipt;
}> {
  onProgress?.('Awaiting block confirmation on Ethereum Sepolia...');

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
    timeout: 120_000,
  });

  onProgress?.('Block confirmed! Fetching full transaction parameters...');

  const transaction = await client.getTransaction({ hash: txHash });

  const effectiveGasPriceGwei = receipt.effectiveGasPrice
    ? (Number(receipt.effectiveGasPrice) / 1e9).toFixed(2)
    : '0';

  const execution: ExecutionReceipt = {
    txHash: receipt.transactionHash,
    blockNumber: Number(receipt.blockNumber),
    from: transaction.from,
    to: transaction.to || '',
    valueEth: formatEther(transaction.value),
    chainId: SEPOLIA_CHAIN_ID,
    calldata: transaction.input || '0x',
    gasUsed: Number(receipt.gasUsed),
    effectiveGasPriceGwei,
    status: receipt.status === 'success' ? 'SUCCESS' : 'REVERTED',
    explorerUrl: `https://sepolia.etherscan.io/tx/${receipt.transactionHash}`,
    executedAt: new Date().toISOString(),
    mode: 'LIVE_WALLET',
  };

  return { receipt, transaction, execution };
}

/**
 * Validates the live on-chain execution against the initial user-approved cryptographic commitment
 */
export function verifyLiveExecution(
  intent: TransactionIntent,
  commitment: CryptographicCommitment,
  execution: ExecutionReceipt
): VerificationAudit {
  return verifyTransaction(intent, commitment, execution);
}

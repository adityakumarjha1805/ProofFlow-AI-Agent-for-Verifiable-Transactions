import React, { useState } from 'react';
import {
  Wallet,
  X,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  ArrowRight,
  Globe,
} from 'lucide-react';
import type { WalletState, SupportedChainId } from '../types/index.ts';
import { SUPPORTED_CHAINS } from '../types/index.ts';
import { SEPOLIA_CHAIN_ID } from '../services/blockchainService.ts';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: WalletState;
  onConnectInjected: () => Promise<void>;
  onConnectSandbox: () => void;
  onDisconnect: () => void;
  onSwitchToSepolia?: () => Promise<void>;
  onRefreshBalance?: () => Promise<void>;
  activeChainId: SupportedChainId;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  wallet,
  onConnectInjected,
  onConnectSandbox,
  onDisconnect,
  onSwitchToSepolia,
  onRefreshBalance,
  activeChainId,
}) => {
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasInjected = typeof window !== 'undefined' && Boolean((window as any).ethereum);
  const activeChain = SUPPORTED_CHAINS[activeChainId] || SUPPORTED_CHAINS[SEPOLIA_CHAIN_ID];
  const isCorrectChain = wallet.chainId === SEPOLIA_CHAIN_ID;

  const handleCopy = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRefresh = async () => {
    if (!onRefreshBalance) return;
    setIsRefreshing(true);
    try {
      await onRefreshBalance();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSwitchNetwork = async () => {
    if (!onSwitchToSepolia) return;
    setIsSwitching(true);
    setErrorMsg(null);
    try {
      await onSwitchToSepolia();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to switch network');
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-3.5 top-3.5 sm:right-4 sm:top-4 text-slate-400 hover:text-white p-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-900 to-violet-800 text-indigo-300 ring-1 ring-indigo-500/30">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Web3 Blockchain Integration</h3>
            <p className="text-xs text-slate-400">
              Target Testnet: <span className="font-semibold text-indigo-300">Ethereum Sepolia (Chain ID 11155111)</span>
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {wallet.connected ? (
          <div className="mt-6 space-y-4">
            {/* Connected Info Card */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center space-x-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Wallet Connected</span>
                </span>
                <span
                  className={`rounded px-2.5 py-0.5 text-[11px] font-mono font-medium ${
                    isCorrectChain
                      ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500/40'
                      : 'bg-amber-900/60 text-amber-200 border border-amber-500/40'
                  }`}
                >
                  {isCorrectChain ? 'Sepolia Testnet (11155111)' : `Chain ID: ${wallet.chainId}`}
                </span>
              </div>

              {/* Public Address Display */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Connected Public Address
                </div>
                <div className="mt-1 flex items-center justify-between rounded-lg bg-slate-950/90 p-2.5 border border-slate-800">
                  <span className="font-mono text-xs text-indigo-200 truncate pr-2 select-all">
                    {wallet.address}
                  </span>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      onClick={handleCopy}
                      title="Copy full address"
                      className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    {wallet.address && (
                      <a
                        href={`https://sepolia.etherscan.io/address/${wallet.address}`}
                        target="_blank"
                        rel="noreferrer"
                        title="View on Sepolia Etherscan"
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-indigo-300 transition"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Native Balance Display */}
              <div className="flex items-center justify-between rounded-lg bg-slate-950/60 p-2.5 border border-slate-800/80">
                <div>
                  <div className="text-[10px] uppercase font-semibold text-slate-400">
                    Sepolia Native Token Balance
                  </div>
                  <div className="text-sm font-bold text-cyan-300 font-mono">
                    {wallet.balanceEth} ETH
                  </div>
                </div>
                {onRefreshBalance && (
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center space-x-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
                    <span>{isRefreshing ? 'Reading RPC...' : 'Refresh'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Network switch prompt if connected to wrong chain */}
            {!isCorrectChain && onSwitchToSepolia && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-3.5 space-y-2">
                <div className="flex items-center space-x-2 text-xs font-semibold text-amber-300">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span>Wallet is not on Ethereum Sepolia</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  ProofFlow requires Ethereum Sepolia testnet to submit verifiable transactions.
                </p>
                <button
                  onClick={handleSwitchNetwork}
                  disabled={isSwitching}
                  className="w-full flex items-center justify-center space-x-2 rounded-lg bg-amber-500 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>{isSwitching ? 'Prompting Wallet...' : 'Switch Wallet to Sepolia (0xaa36a7)'}</span>
                </button>
              </div>
            )}

            {/* Testnet Faucet Helper */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400 space-y-1.5">
              <div className="font-semibold text-slate-300 flex items-center justify-between">
                <span>Need Sepolia Testnet ETH?</span>
                <span className="text-[10px] text-cyan-400">Free Testnet Funds</span>
              </div>
              <p className="text-[11px]">
                You can obtain free Sepolia ETH for testing transactions without real money:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 rounded bg-slate-800 px-2 py-1 text-[11px] text-cyan-300 hover:bg-slate-700"
                >
                  <span>Google Cloud Web3 Faucet</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href="https://sepoliafaucet.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 rounded bg-slate-800 px-2 py-1 text-[11px] text-cyan-300 hover:bg-slate-700"
                >
                  <span>SepoliaFaucet.com</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <button
              onClick={() => {
                onDisconnect();
                onClose();
              }}
              className="w-full rounded-xl border border-rose-500/30 bg-rose-950/20 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-950/40 transition"
            >
              Disconnect Wallet
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {/* Injected Wallet Option */}
            <button
              onClick={async () => {
                setErrorMsg(null);
                try {
                  await onConnectInjected();
                  onClose();
                } catch (err: any) {
                  setErrorMsg(err.message || 'Failed to connect');
                }
              }}
              className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 text-left transition hover:border-indigo-500/50 hover:bg-indigo-950/20"
            >
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-950/60 text-cyan-400 ring-1 ring-cyan-500/30 font-semibold text-base">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Browser Injected (MetaMask / Rabby)</div>
                  <div className="text-[11px] text-slate-400">
                    {hasInjected
                      ? 'EIP-1193 Web3 provider ready in browser'
                      : 'Install MetaMask, Rabby, or Coinbase Wallet'}
                  </div>
                </div>
              </div>
              <span className="rounded-md bg-indigo-600/30 border border-indigo-500/40 px-2.5 py-1 text-xs text-indigo-300 font-semibold">
                Connect
              </span>
            </button>

            {/* Sandbox Wallet Option */}
            <button
              onClick={() => {
                onConnectSandbox();
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-3.5 text-left transition hover:bg-indigo-950/50 ring-1 ring-indigo-500/20"
            >
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-900/60 text-indigo-300 ring-1 ring-indigo-500/30 font-semibold text-base">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">ProofFlow Sandbox Testnet Wallet</div>
                  <div className="text-[11px] text-indigo-300">
                    Zero-extension testing environment preloaded with 1.45 Sepolia ETH
                  </div>
                </div>
              </div>
              <span className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                Dev Mode
              </span>
            </button>

            {/* Non-custodial security banner */}
            <div className="mt-4 rounded-lg bg-slate-950/60 p-3 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300 flex items-center space-x-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Zero-Custody Architecture</span>
              </div>
              <p>
                ProofFlow never requests or stores private keys or seed phrases. All transaction signatures are prompted directly in your Web3 wallet.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Navbar, PageView } from './components/Navbar.tsx';
import { WalletModal } from './components/WalletModal.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { AgentWorkspacePage } from './pages/AgentWorkspacePage.tsx';
import { ProposalApprovalPage } from './pages/ProposalApprovalPage.tsx';
import { TransactionHistoryPage } from './pages/TransactionHistoryPage.tsx';
import { VerificationPage } from './pages/VerificationPage.tsx';
import { PoliciesSettingsPage } from './pages/PoliciesSettingsPage.tsx';
import type {
  TransactionProposal,
  DeterministicPolicyConfig,
  WalletState,
  SupportedChainId,
} from './types/index.ts';
import { SUPPORTED_CHAINS } from './types/index.ts';
import { DEFAULT_POLICY_CONFIG } from './services/policyEngine.ts';
import {
  connectInjectedWallet,
  switchOrAddSepoliaNetwork,
  fetchLiveSepoliaBalance,
  SEPOLIA_CHAIN_ID,
} from './services/blockchainService.ts';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageView>('landing');
  const [proposals, setProposals] = useState<TransactionProposal[]>([]);
  const [activeProposal, setActiveProposal] = useState<TransactionProposal | null>(null);
  const [policies, setPolicies] = useState<DeterministicPolicyConfig>(DEFAULT_POLICY_CONFIG);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [activeChainId, setActiveChainId] = useState<SupportedChainId>(11155111);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [workspaceInitialPrompt, setWorkspaceInitialPrompt] = useState<string>('');

  const [wallet, setWallet] = useState<WalletState>({
    connected: true, // Connect sandbox wallet by default for smooth demo experience
    address: '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c',
    chainId: 11155111,
    balanceEth: '1.450',
    networkName: 'Sepolia Testnet',
    providerAvailable: typeof window !== 'undefined' && Boolean((window as any).ethereum),
  });

  // Fetch proposals and policies on mount
  useEffect(() => {
    fetchProposals();
    fetchPolicies();
  }, []);

  const fetchProposals = async () => {
    try {
      const res = await fetch('/api/proposals');
      if (res.ok) {
        const data = await res.json();
        const propList: TransactionProposal[] = data.proposals || [];
        setProposals(propList);

        // Check URL search parameters
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const requestedView = urlParams.get('view') as PageView;
          const requestedId = urlParams.get('proposalId') || urlParams.get('id');

          if (requestedView) {
            setCurrentPage(requestedView);
          }

          if (requestedId && propList.length > 0) {
            const match = propList.find((p) => p.id === requestedId);
            if (match) {
              setActiveProposal(match);
              return;
            }
          }
        } catch {
          // ignore
        }

        if (!activeProposal && propList.length > 0) {
          setActiveProposal(propList[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch proposals from server, using local state', err);
    }
  };

  const fetchPolicies = async () => {
    try {
      const res = await fetch('/api/policies');
      if (res.ok) {
        const data = await res.json();
        if (data.policies) {
          setPolicies(data.policies);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch policies from server', err);
    }
  };

  // Connect Injected (MetaMask / Rabby / Web3)
  const handleConnectInjected = async () => {
    try {
      const res = await connectInjectedWallet();
      const networkName =
        SUPPORTED_CHAINS[res.chainId as SupportedChainId]?.name || `Chain ID ${res.chainId}`;

      setWallet({
        connected: true,
        address: res.checksumAddress,
        chainId: res.chainId as SupportedChainId,
        balanceEth: res.balanceEth,
        networkName,
        providerAvailable: true,
      });

      if (res.isSepolia) {
        setActiveChainId(SEPOLIA_CHAIN_ID);
      }
      setIsDemoMode(false);

      // Setup event listeners for network and account changes
      const ethereum = (window as any).ethereum;
      if (ethereum?.on) {
        ethereum.on('accountsChanged', async (accounts: string[]) => {
          if (!accounts || accounts.length === 0) {
            handleDisconnectWallet();
          } else {
            const checksum = accounts[0];
            try {
              const bal = await fetchLiveSepoliaBalance(checksum);
              setWallet((prev) => ({
                ...prev,
                address: checksum,
                balanceEth: parseFloat(bal.balanceEth).toFixed(4),
              }));
            } catch {
              setWallet((prev) => ({ ...prev, address: checksum }));
            }
          }
        });

        ethereum.on('chainChanged', (chainIdHex: string) => {
          const newChainId = parseInt(chainIdHex, 16) as SupportedChainId;
          const chainName = SUPPORTED_CHAINS[newChainId]?.name || `Chain ID ${newChainId}`;
          setWallet((prev) => ({
            ...prev,
            chainId: newChainId,
            networkName: chainName,
          }));
          if (newChainId === SEPOLIA_CHAIN_ID) {
            setActiveChainId(SEPOLIA_CHAIN_ID);
          }
        });
      }
    } catch (err: any) {
      console.warn('Injected wallet connection error:', err.message);
      throw err;
    }
  };

  // Switch wallet to Sepolia testnet
  const handleSwitchToSepolia = async () => {
    try {
      await switchOrAddSepoliaNetwork();
      setActiveChainId(SEPOLIA_CHAIN_ID);
      setWallet((prev) => ({
        ...prev,
        chainId: SEPOLIA_CHAIN_ID,
        networkName: SUPPORTED_CHAINS[SEPOLIA_CHAIN_ID].name,
      }));
      if (wallet.address) {
        handleRefreshBalance();
      }
    } catch (err: any) {
      console.error('Failed to switch network:', err.message);
      throw err;
    }
  };

  // Refresh live on-chain balance
  const handleRefreshBalance = async () => {
    if (!wallet.address) return;
    try {
      const liveBal = await fetchLiveSepoliaBalance(wallet.address);
      setWallet((prev) => ({
        ...prev,
        balanceEth: parseFloat(liveBal.balanceEth).toFixed(4),
      }));
    } catch (err) {
      console.warn('Could not refresh live on-chain balance:', err);
    }
  };

  // Connect Sandbox
  const handleConnectSandbox = () => {
    setWallet({
      connected: true,
      address: '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c',
      chainId: activeChainId,
      balanceEth: '1.450',
      networkName: SUPPORTED_CHAINS[activeChainId]?.name || 'Sepolia Testnet',
      providerAvailable: false,
    });
    setIsDemoMode(true);
  };

  const handleDisconnectWallet = () => {
    setWallet({
      connected: false,
      address: null,
      chainId: null,
      balanceEth: '0.000',
      networkName: 'Disconnected',
      providerAvailable: typeof window !== 'undefined' && Boolean((window as any).ethereum),
    });
  };

  const handleToggleDemoMode = () => {
    setIsDemoMode((prev) => !prev);
  };

  const handleSelectChain = (newChainId: SupportedChainId) => {
    setActiveChainId(newChainId);
    if (wallet.connected) {
      setWallet((prev) => ({
        ...prev,
        chainId: newChainId,
        networkName: SUPPORTED_CHAINS[newChainId]?.name || 'Unknown Testnet',
      }));
    }
  };

  // Navigations with context
  const handleStartWorkspaceWithPrompt = (initialPrompt?: string) => {
    if (initialPrompt) setWorkspaceInitialPrompt(initialPrompt);
    setCurrentPage('workspace');
  };

  const handleProposalCreated = (newProposal: TransactionProposal) => {
    setProposals((prev) => [newProposal, ...prev.filter((p) => p.id !== newProposal.id)]);
    setActiveProposal(newProposal);
  };

  const handleProceedToApproval = (proposal: TransactionProposal) => {
    setActiveProposal(proposal);
    setCurrentPage('proposals');
  };

  const handleCommitApproved = (updatedProposal: TransactionProposal) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === updatedProposal.id ? updatedProposal : p))
    );
    setActiveProposal(updatedProposal);
  };

  const handleExecuteSuccess = (executedProposal: TransactionProposal) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === executedProposal.id ? executedProposal : p))
    );
    setActiveProposal(executedProposal);
    fetchPolicies(); // update daily spent
  };

  const handleNavigateToVerification = (proposalToVerify?: TransactionProposal) => {
    if (proposalToVerify) {
      setActiveProposal(proposalToVerify);
    }
    setCurrentPage('verification');
  };

  const handleRejectProposal = (proposalId: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, status: 'REJECTED' } : p))
    );
    if (activeProposal?.id === proposalId) {
      setActiveProposal((prev) => (prev ? { ...prev, status: 'REJECTED' } : null));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        currentPage={currentPage}
        onNavigate={(page) => setCurrentPage(page)}
        wallet={wallet}
        onConnectWallet={() => setIsWalletModalOpen(true)}
        onDisconnectWallet={handleDisconnectWallet}
        activeChainId={activeChainId}
        onSelectChain={handleSelectChain}
        isDemoMode={isDemoMode}
        onToggleDemoMode={handleToggleDemoMode}
        onSwitchToSepolia={handleSwitchToSepolia}
        onRefreshBalance={handleRefreshBalance}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-full overflow-x-hidden">
        {currentPage === 'landing' ? (
          <LandingPage
            onStartWorkspace={handleStartWorkspaceWithPrompt}
            onExploreVerification={() => {
              const verified = proposals.find((p) => p.status === 'VERIFIED') || proposals[0];
              if (verified) setActiveProposal(verified);
              setCurrentPage('verification');
            }}
            onOpenDashboard={() => setCurrentPage('dashboard')}
          />
        ) : (
          <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-8 w-full min-w-0 max-w-full">
            {currentPage === 'dashboard' && (
              <DashboardPage
                proposals={proposals}
                policies={policies}
                wallet={wallet}
                onSelectProposal={(p) => {
                  setActiveProposal(p);
                  if (p.status === 'VERIFIED') {
                    setCurrentPage('verification');
                  } else {
                    setCurrentPage('proposals');
                  }
                }}
                onNavigateToWorkspace={(prompt) => handleStartWorkspaceWithPrompt(prompt)}
                onNavigateToVerification={(p) => handleNavigateToVerification(p)}
                onNavigateToPolicies={() => setCurrentPage('settings')}
                onConnectWallet={() => setIsWalletModalOpen(true)}
                onSwitchToSepolia={handleSwitchToSepolia}
                onRefreshBalance={handleRefreshBalance}
              />
            )}

            {currentPage === 'workspace' && (
              <AgentWorkspacePage
                initialPrompt={workspaceInitialPrompt}
                wallet={wallet}
                activeChainId={activeChainId}
                onProposalGenerated={handleProposalCreated}
                onProceedToApproval={handleProceedToApproval}
                onRejectProposal={handleRejectProposal}
              />
            )}

            {currentPage === 'proposals' && (
              <ProposalApprovalPage
                proposal={activeProposal}
                wallet={wallet}
                isDemoMode={isDemoMode}
                onCommitApproved={handleCommitApproved}
                onExecuteSuccess={handleExecuteSuccess}
                onNavigateToVerification={handleNavigateToVerification}
                onRejectProposal={handleRejectProposal}
                onConnectWallet={() => setIsWalletModalOpen(true)}
                onSwitchToSepolia={handleSwitchToSepolia}
                onRefreshBalance={handleRefreshBalance}
              />
            )}

            {currentPage === 'history' && (
              <TransactionHistoryPage
                proposals={proposals}
                userWalletAddress={wallet.address}
                onSelectProposal={(p) => {
                  setActiveProposal(p);
                  if (p.status === 'VERIFIED') {
                    setCurrentPage('verification');
                  } else {
                    setCurrentPage('proposals');
                  }
                }}
                onNavigateToVerification={handleNavigateToVerification}
              />
            )}

            {currentPage === 'verification' && (
              <VerificationPage
                proposal={activeProposal}
                allProposals={proposals}
                onSelectProposal={(p) => setActiveProposal(p)}
              />
            )}

            {currentPage === 'settings' && (
              <PoliciesSettingsPage
                policies={policies}
                onUpdatePolicies={(newPolicies) => setPolicies(newPolicies)}
                isDemoMode={isDemoMode}
                onToggleDemoMode={handleToggleDemoMode}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-300">ProofFlow</span>
            <span>&bull;</span>
            <span>AI Agent for Verifiable Transactions</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px] text-slate-400">
            <span>Deterministic Policy Engine</span>
            <span>&bull;</span>
            <span>Canonical Keccak-256 Commitments</span>
            <span>&bull;</span>
            <span>Dual-Layer Verification</span>
          </div>
        </div>
      </footer>

      {/* Wallet Modal */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        wallet={wallet}
        onConnectInjected={handleConnectInjected}
        onConnectSandbox={handleConnectSandbox}
        onDisconnect={handleDisconnectWallet}
        onSwitchToSepolia={handleSwitchToSepolia}
        onRefreshBalance={handleRefreshBalance}
        activeChainId={activeChainId}
      />
    </div>
  );
}

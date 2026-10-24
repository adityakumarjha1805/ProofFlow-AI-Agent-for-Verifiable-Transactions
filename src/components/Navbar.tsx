import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Cpu,
  Layers,
  History,
  CheckCircle2,
  Sliders,
  Wallet,
  Sparkles,
  LogOut,
  Menu,
  X,
  Copy,
  Check,
  ChevronRight,
} from 'lucide-react';
import { SUPPORTED_CHAINS, SupportedChainId, WalletState } from '../types/index.ts';

export type PageView =
  | 'landing'
  | 'dashboard'
  | 'workspace'
  | 'proposals'
  | 'history'
  | 'verification'
  | 'settings';

interface NavbarProps {
  currentPage: PageView;
  onNavigate: (page: PageView) => void;
  wallet: WalletState;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  activeChainId: SupportedChainId;
  onSelectChain: (chainId: SupportedChainId) => void;
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
  onSwitchToSepolia?: () => Promise<void>;
  onRefreshBalance?: () => Promise<void>;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  wallet,
  onConnectWallet,
  onDisconnectWallet,
  activeChainId,
  onSelectChain,
  isDemoMode,
  onToggleDemoMode,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const navItems = [
    { id: 'landing' as PageView, label: 'Overview', icon: Sparkles },
    { id: 'dashboard' as PageView, label: 'Dashboard', icon: Layers },
    { id: 'workspace' as PageView, label: 'Workspace', icon: Cpu },
    { id: 'proposals' as PageView, label: 'Approvals', icon: CheckCircle2 },
    { id: 'history' as PageView, label: 'History', icon: History },
    { id: 'verification' as PageView, label: 'Verification', icon: ShieldCheck },
    { id: 'settings' as PageView, label: 'Policies', icon: Sliders },
  ];

  // Close menu when pressing Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  // Lock background scrolling when mobile menu drawer is open
  useEffect(() => {
    if (isMenuOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMenuOpen]);

  // Auto-close mobile menu if viewport resized to tablet/desktop (>= 768px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMenuOpen]);

  const handleNavClick = (page: PageView) => {
    onNavigate(page);
    setIsMenuOpen(false);
  };

  const handleCopyWalletAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  // Mobile Drawer Portal
  const mobileDrawer =
    isMenuOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            id="proof-flow-mobile-menu"
            className="fixed inset-0 z-50 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Menu"
          >
            {/* Backdrop Overlay */}
            <div
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-200"
              aria-hidden="true"
            />

            {/* Slide-in Drawer Panel */}
            <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[320px] sm:max-w-sm flex-col bg-slate-950 border-l border-slate-800 shadow-2xl animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-800/90 px-4 py-3.5 bg-slate-950">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-950 border border-indigo-500/30 text-indigo-400 shrink-0">
                    <ShieldCheck className="h-4 w-4 text-indigo-300" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold tracking-tight text-white leading-tight">
                      ProofFlow
                    </span>
                    <span className="text-[10px] text-slate-400">Verifiable Web3 Engine</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="Close navigation drawer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 active:scale-95"
                >
                  <X className="h-4.5 w-4.5" aria-hidden="true" />
                </button>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 text-xs font-sans overscroll-contain">
                {/* Section 1: Navigation Links */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2 px-1">
                    Navigation
                  </span>
                  <nav className="space-y-1" aria-label="Mobile Drawer Navigation">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentPage === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavClick(item.id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 min-h-[44px] text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                            isActive
                              ? 'bg-slate-800 text-white font-semibold border border-slate-700/80 shadow-xs'
                              : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              className={`h-4 w-4 shrink-0 ${
                                isActive ? 'text-indigo-400' : 'text-slate-400'
                              }`}
                              aria-hidden="true"
                            />
                            <span>{item.label}</span>
                          </div>
                          <ChevronRight
                            className={`h-3.5 w-3.5 shrink-0 ${
                              isActive ? 'text-indigo-400' : 'text-slate-600'
                            }`}
                            aria-hidden="true"
                          />
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Section 2: Environment & Network Controls */}
                <div className="border-t border-slate-800/80 pt-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2 px-1">
                    Network & Environment
                  </span>
                  <div className="space-y-2.5">
                    {/* Network Selector */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
                      <label
                        htmlFor="mobile-network-select"
                        className="text-[11px] font-medium text-slate-400 block mb-1"
                      >
                        Active EVM Network:
                      </label>
                      <div className="relative">
                        <select
                          id="mobile-network-select"
                          value={activeChainId}
                          onChange={(e) =>
                            onSelectChain(Number(e.target.value) as SupportedChainId)
                          }
                          className="w-full appearance-none rounded-lg border border-slate-800 bg-slate-950 py-2 pl-3 pr-8 text-xs font-medium text-slate-200 outline-none transition focus:border-indigo-500 cursor-pointer"
                        >
                          <option value={11155111}>Ethereum Sepolia (11155111)</option>
                          <option value={84532}>Base Sepolia (84532)</option>
                          <option value={421614}>Arbitrum Sepolia (421614)</option>
                          <option value={1}>Ethereum Mainnet (1)</option>
                        </select>
                        <span
                          className="pointer-events-none absolute right-2.5 top-2.5 text-[9px] text-slate-400"
                          aria-hidden="true"
                        >
                          ▼
                        </span>
                      </div>
                    </div>

                    {/* Mode Toggle Button */}
                    <button
                      type="button"
                      onClick={onToggleDemoMode}
                      className={`w-full flex items-center justify-between rounded-xl border p-2.5 min-h-[44px] transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                        isDemoMode
                          ? 'border-cyan-500/30 bg-cyan-950/30 text-cyan-200 hover:bg-cyan-900/30'
                          : 'border-amber-500/30 bg-amber-950/30 text-amber-200 hover:bg-amber-900/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            isDemoMode ? 'bg-cyan-400' : 'bg-amber-400'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="text-xs font-semibold">
                          {isDemoMode ? 'Sandbox Simulation Active' : 'Live Web3 Wallet Active'}
                        </span>
                      </div>
                      <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-800">
                        Toggle
                      </span>
                    </button>
                  </div>
                </div>

                {/* Section 3: Connected Wallet & Actions */}
                <div className="border-t border-slate-800/80 pt-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2 px-1">
                    Wallet Account
                  </span>

                  {wallet.connected && wallet.address ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                          <span
                            className="h-2 w-2 rounded-full bg-emerald-400"
                            aria-hidden="true"
                          />
                          <span>Connected</span>
                        </span>
                        <span className="font-mono text-xs text-cyan-300 font-semibold tabular-nums">
                          {wallet.balanceEth} ETH
                        </span>
                      </div>

                      {/* Address with copy */}
                      <div className="flex items-center justify-between rounded-lg bg-slate-950 p-2 border border-slate-800">
                        <span className="font-mono text-xs text-indigo-300 truncate select-all min-w-0 flex-1 pr-1 tabular-nums">
                          {wallet.address}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyWalletAddress}
                          aria-label="Copy wallet address"
                          className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-850 transition shrink-0"
                        >
                          {copiedAddress ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            onConnectWallet();
                            setIsMenuOpen(false);
                          }}
                          className="flex items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-800 py-2 px-2 text-xs font-medium text-slate-200 hover:bg-slate-750 transition min-h-[38px]"
                        >
                          <Wallet className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                          <span>Details</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onDisconnectWallet();
                            setIsMenuOpen(false);
                          }}
                          className="flex items-center justify-center gap-1 rounded-lg border border-rose-500/40 bg-rose-950/30 py-2 px-2 text-xs font-medium text-rose-300 hover:bg-rose-900/40 transition min-h-[38px]"
                        >
                          <LogOut className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                          <span>Disconnect</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          onConnectWallet();
                          setIsMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/40 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95 min-h-[44px]"
                      >
                        <Wallet className="h-4 w-4" aria-hidden="true" />
                        <span>Connect Web3 Wallet</span>
                      </button>
                      <p className="text-[10px] text-slate-500 px-1 leading-relaxed">
                        Non-custodial connection. Connect MetaMask, Rabby, or launch instant Sandbox
                        simulation.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="border-t border-slate-800/80 px-4 py-3 bg-slate-950 text-[10px] text-slate-500 flex items-center justify-between">
                <span>ProofFlow Engine</span>
                <span className="font-mono text-slate-400">Sepolia (11155111)</span>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <header className="sticky top-0 z-40 w-full max-w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-3 sm:px-5 md:px-6 py-2.5 sm:py-3 gap-3 min-w-0">
          {/* Brand / Logo */}
          <button
            type="button"
            onClick={() => handleNavClick('landing')}
            className="flex cursor-pointer items-center gap-2.5 transition hover:opacity-90 shrink-0 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg py-1 px-1 -ml-1"
            aria-label="ProofFlow Home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950 border border-indigo-500/30 text-indigo-400 shrink-0">
              <ShieldCheck className="h-4.5 w-4.5 text-indigo-300" aria-hidden="true" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base font-bold tracking-tight text-white shrink-0">
                ProofFlow
              </span>
              <span className="hidden 2xl:inline-block rounded border border-indigo-500/30 bg-indigo-950/60 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-indigo-300 uppercase">
                Verifiable Transactions
              </span>
            </div>
          </button>

          {/* Desktop Navigation Tabs (Visible on XL screens >= 1280px) */}
          <nav
            aria-label="Main Desktop Navigation"
            className="hidden xl:flex items-center gap-0.5 rounded-xl bg-slate-900/90 p-0.5 border border-slate-800 shrink-0"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] 2xl:text-xs font-medium transition shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                    isActive
                      ? 'bg-slate-800 text-slate-100 font-semibold border border-slate-700/80 shadow-xs'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Icon
                    className={`h-3 w-3 2xl:h-3.5 2xl:w-3.5 ${
                      isActive ? 'text-indigo-400' : 'text-slate-500'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Tablet & Desktop Controls (Visible >= 768px / md:) */}
          <div className="hidden md:flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Mode switch */}
            <button
              type="button"
              onClick={onToggleDemoMode}
              title="Toggle between Sandbox Simulation and Live Web3 Wallet"
              aria-label={`Current mode: ${isDemoMode ? 'Sandbox' : 'Live'}. Click to toggle.`}
              className={`hidden 2xl:flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                isDemoMode
                  ? 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/40'
                  : 'border-amber-500/30 bg-amber-950/40 text-amber-300 hover:bg-amber-900/40'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  isDemoMode ? 'bg-cyan-400' : 'bg-amber-400'
                }`}
                aria-hidden="true"
              />
              <span className="whitespace-nowrap">{isDemoMode ? 'Sandbox' : 'Live'}</span>
            </button>

            {/* Network Selector */}
            <div className="relative shrink-0">
              <select
                value={activeChainId}
                onChange={(e) => onSelectChain(Number(e.target.value) as SupportedChainId)}
                aria-label="Select Target Blockchain Network"
                className="appearance-none rounded-lg border border-slate-800 bg-slate-900/90 py-1 pl-2 pr-4 text-[11px] font-medium text-slate-200 outline-none transition focus:border-indigo-500 cursor-pointer"
              >
                <option value={11155111}>Sepolia</option>
                <option value={84532}>Base Sep</option>
                <option value={421614}>Arb Sep</option>
                <option value={1}>Mainnet</option>
              </select>
              <span
                className="pointer-events-none absolute right-1 top-1.5 text-[8px] text-slate-400"
                aria-hidden="true"
              >
                ▼
              </span>
            </div>

            {/* Wallet Connection & Disconnect */}
            {wallet.connected && wallet.address ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={onConnectWallet}
                  title="Wallet details & account settings"
                  aria-label={`Connected wallet ${wallet.address}. Click to view details.`}
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/40 hover:bg-indigo-900/40 hover:border-indigo-400/60 px-2 py-1 text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 shrink-0"
                >
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      wallet.chainId === 11155111 ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-indigo-200 text-xs font-medium tabular-nums">
                    <span className="sm:hidden">
                      {wallet.address.slice(0, 4)}...{wallet.address.slice(-2)}
                    </span>
                    <span className="hidden sm:inline">
                      {wallet.address.slice(0, 5)}...{wallet.address.slice(-3)}
                    </span>
                  </span>
                  <span className="hidden md:inline-block border-l border-indigo-800/80 pl-1.5 text-indigo-300 font-medium font-mono text-[11px] tabular-nums">
                    {wallet.balanceEth}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onDisconnectWallet}
                  className="group flex items-center justify-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/90 hover:border-rose-500/50 hover:bg-rose-950/30 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-rose-200 transition shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 active:scale-95"
                  title="Disconnect Wallet"
                  aria-label="Disconnect Wallet"
                >
                  <LogOut
                    className="h-3.5 w-3.5 text-slate-400 group-hover:text-rose-300 transition-colors"
                    aria-hidden="true"
                  />
                  <span className="hidden lg:inline">Disconnect</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onConnectWallet}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/40 px-3 py-1 text-xs font-semibold text-white shadow-sm transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Connect</span>
              </button>
            )}
          </div>

          {/* Mobile Hamburger Button (< 768px / md:hidden) */}
          <div className="flex md:hidden items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-expanded={isMenuOpen}
              aria-controls="proof-flow-mobile-menu"
              aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/90 text-slate-200 hover:bg-slate-850 hover:text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 active:scale-95"
            >
              {isMenuOpen ? (
                <X className="h-5 w-5 text-indigo-400" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5 text-slate-300" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Tablet Navigation Bar (Visible only on md: to xl: 768px to 1279px) */}
        <nav
          aria-label="Tablet Horizontal Navigation"
          className="hidden md:flex xl:hidden w-full max-w-full overflow-hidden border-t border-slate-800/80 bg-slate-950/95"
        >
          <div className="flex w-full overflow-x-auto px-4 py-1.5 gap-1.5 scrollbar-none overscroll-x-contain">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                    isActive
                      ? 'bg-slate-800 text-white font-semibold border border-slate-700/80'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${
                      isActive ? 'text-indigo-400' : 'text-slate-500'
                    }`}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </header>
      {mobileDrawer}
    </>
  );
};

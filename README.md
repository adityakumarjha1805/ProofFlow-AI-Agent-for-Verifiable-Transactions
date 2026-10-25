# 🛡️ ProofFlow — Verifiable AI Agent for Blockchain Transactions

**Don't Just Trust AI. Cryptographically Verify Its Actions.**

ProofFlow is an enterprise-grade Web3 security agent that bridges natural-language AI transaction reasoning with **deterministic security policies**, **explicit wallet authorization**, and **RFC 8785 canonical cryptographic verification**.

---

## 🌟 Hackathon Highlights & Core Value Proposition

When autonomous AI agents interact with financial ledgers, traditional guardrails (system prompts and safety filters) fail to prevent financial loss from prompt injections, hallucinations, address substitutions, or unauthorized parameter drift.

**ProofFlow enforces absolute separation of concerns:**
1. **AI Reasoning Layer (Gemini 2.5):** Interprets user intent, queries context, and generates structured transaction proposals. AI output is treated as **untrusted data**.
2. **Deterministic Policy Engine (TypeScript):** Evaluates hard mathematical spending limits, single-tx caps, recipient allowlists/blocklists, and chain restrictions in pure application code—immune to prompt injection.
3. **Canonical Cryptographic Commitment (RFC 8785 + Keccak-256):** Serializes the approved transaction parameters into a canonical JSON representation and generates an immutable hash commitment that the user cryptographically signs.
4. **Independent Post-Execution Verifier:** Pulls the mined block receipt directly from an EVM node and mathematically compares the receipt parameters against the approved commitment, producing an audit record with `PASS`, `FAIL`, or `NOT VERIFIED` criteria.

---

## 🏗️ System Architecture

```
[User Request: Plain English]
              │
              ▼
    ┌─────────────────────────┐
    │  ProofFlow Agent Engine │  ◄── Gemini 2.5 Flash (Structured Schema)
    │   (Modular Tool Calls)  │  ◄── Balance & Gas Estimation Tools
    └──────────┬──────────────┘
               │  Structured Proposal (Untrusted)
               ▼
    ┌─────────────────────────┐
    │ Deterministic Policy    │  ◄── Spending Limits, Caps, Address Whitelists/Blacklists
    │ Enforcement Engine      │      (Enforced in Pure TS Code, NOT in Prompts)
    └──────────┬──────────────┘
               │  Draft Proposal Validated
               ▼
    ┌─────────────────────────┐
    │ Canonical Commitment    │  ◄── RFC 8785 Canonical JSON Serialization
    │ Generation (Keccak-256) │      Immutable Hash Binding
    └──────────┬──────────────┘
               │
               ▼
    ┌─────────────────────────┐
    │ Explicit Human Approval │  ◄── MetaMask / EVM Wallet EIP-191 Personal Sign
    └──────────┬──────────────┘
               │  Authorized Proposal
               ▼
    ┌─────────────────────────┐
    │ Blockchain Execution    │  ◄── Live Ethereum Sepolia Testnet (or Sandbox)
    │ (Viem / Web3 Provider)  │
    └──────────┬──────────────┘
               │  Mined Transaction Receipt
               ▼
    ┌─────────────────────────┐
    │ Cryptographic Verifier  │  ◄── Side-by-Side Parameter Matching & 8 Checks
    │ (Independent Receipt)   │      (PASS / FAIL / NOT VERIFIED Status)
    └─────────────────────────┘
```

---

## 🔐 Security Boundaries & Threat Model

| Threat Vector | ProofFlow Defense | Limitation / Boundary |
|---|---|---|
| **Prompt Injection** | Deterministic TS policy engine blocks unauthorized transactions regardless of model reasoning or user prompt instructions. | Model may still format text incorrectly; mitigated by Zod/schema validation. |
| **Address Substitution (MITM)** | Approved recipient is cryptographically bound to the RFC 8785 Keccak-256 commitment signed by wallet. | User must visually verify recipient in wallet before signing. |
| **Value / Amount Drift** | Post-execution verifier compares mined receipt `value` against approved proposal. Mismatch triggers instant `FAIL`. | Reverted txs consume network gas; ProofFlow marks reverted txs as `FAILED`. |
| **Wrong Chain Broadcast** | Chain ID (11155111) is strictly enforced in policy and commitment; cross-chain replays are mathematically invalid. | Private chains without public RPC cannot be verified via public explorer. |
| **Secret Exfiltration** | Zero private keys or mnemonic secrets are ever handled, requested, or logged. Client uses browser wallet injection (MetaMask). | Relies on user maintaining secure local wallet software. |

*Disclaimer on Prompt Injection: ProofFlow does NOT claim prompt-injection immunity for the language model itself. Instead, ProofFlow renders prompt injection toothless by enforcing authorization, spending caps, and cryptographic verification strictly outside the model in deterministic code.*

---

## 🌐 Supported Networks & Real Integrations

### Real On-Chain Integrations
- **Ethereum Sepolia (Chain ID: 11155111):**
  - Live balance checking via Viem Sepolia public RPCs (`https://rpc.sepolia.org`, Cloudflare, Infura).
  - Dynamic gas fee estimation (Base Fee + Priority Tip).
  - Live Etherscan link generation (`https://sepolia.etherscan.io/tx/...`).
  - Mined receipt extraction and event log verification.
- **Base Sepolia (Chain ID: 84532) & Arbitrum Sepolia (Chain ID: 421614):**
  - Supported for multi-network routing and block explorer linking (BaseScan, Arbiscan).
- **Google Gemini 2.5 Flash:**
  - Real structured schema generation with system prompts and tool calling via `@google/genai`.
  - Fallback to deterministic regex-based semantic extraction if API key is unconfigured.

### Clearly Labeled Simulations
- **Tamper Simulation Engine:** Interactive security demonstration feature that intentionally mutates the recipient or amount on an executed transaction to demonstrate the verifier immediately flagging `MISMATCH / FAIL`.
- **Local Sandbox Execution:** When no Web3 wallet is connected, the app simulates block mining deterministically with realistic gas and block numbers.

---

## 📊 Verification Experience (Priority 2)

The upgraded **Verification Page** provides an audit trail:
- **Side-by-Side Comparison:** Direct table comparing user-approved proposal specifications vs mined execution receipts.
- **Core Parameters:**
  - Recipient Address (PASS / FAIL / NOT VERIFIED)
  - Transfer Amount (PASS / FAIL / NOT VERIFIED)
  - Chain ID (PASS / FAIL / NOT VERIFIED)
  - Transaction Hash (with 1-click external link to Sepolia Etherscan)
  - Receipt Status (`SUCCESS`, `REVERTED`, `PENDING`)
  - Block Number (Confirmed inclusion)
  - Cryptographic Commitment (RFC 8785 Keccak-256 matching)
- **Clear Mismatch Explanations:** Explains the exact vulnerability vector (e.g. address substitution or value drift).
- **8 Criteria Verification Matrix:** Detailed breakdown with `PASS`, `FAIL`, or `NOT VERIFIED` badges.

---

## 📱 Mobile Responsiveness (Priority 3)

- **Accessible Hamburger Navigation:** Below 768px, navigation collapses into a slide-over drawer accessible via keyboard with full `aria-expanded` and focus trap.
- **Zero Horizontal Overflow:** Tested and verified across viewports: `320px`, `360px`, `375px`, `390px`, `414px`, `768px`, `1024px`, and `1440px`.
- **Monospace Address Truncation:** Long EVM hashes and addresses are formatted safely with one-click copy buttons.
- **Accessible Action Controls:** Large touch targets and high-contrast labels.

---

## 🧪 Comprehensive Unit & Security Testing (Priority 5)

ProofFlow includes **86 comprehensive unit tests** in `src/tests/completeLifecycleAndSecurity.test.ts` covering:
1. Valid transaction proposals and extraction.
2. Spending limit violations (per-tx and daily caps).
3. Blocked / prohibited recipient rejection.
4. Wrong-chain transactions and unsupported networks.
5. Wallet user rejection handling.
6. Failed and pending block receipts.
7. Post-approval parameter tampering (address and amount drift).
8. Malicious prompt injection neutralization.
9. Duplicate tx replay prevention via uniqueness index.
10. Database rejection of sensitive keys or mnemonics.

### Running the Test Suite:
```bash
npx --yes tsx --test src/tests/completeLifecycleAndSecurity.test.ts
```
**Result: 86 passed, 0 failed.**

---

## 🚀 Getting Started & Demo Walkthrough

### 1. Installation
```bash
npm install
```

### 2. Configure Environment (Optional)
```bash
cp .env.example .env
# Add GEMINI_API_KEY for live AI reasoning (fallback deterministic parser works out-of-the-box)
```

### 3. Start Development Server
```bash
npm run dev
# Server listens on http://0.0.0.0:3000
```

### 4. Build for Production & Deployment
```bash
npm run build
npm start
```

### 5. 5-Minute Demo Walkthrough:
1. **Workspace:** Enter `"Send 0.05 ETH to vitalik.eth for developer grant"`.
2. **Review Proposal:** Notice how the AI extracted `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` and the policy engine verified it satisfies the 0.5 ETH spending limit.
3. **Approval:** Click **Approve Proposal** to trigger canonical RFC 8785 hash generation and wallet signing.
4. **Execution:** Broadcast the transaction to Sepolia (or sandbox).
5. **Verification Page:** Inspect the side-by-side comparison. All 8 checks display `PASS`. Click the **Explorer** link to view the receipt.
6. **Simulate Tampering:** Click the **Simulate Recipient Tamper** button in the header. Notice how the status immediately flips to `MISMATCH / FAIL` with clear diagnostic explanations. Click **Restore Original Receipt** to see it return to `PASS`.

---

## 📄 License
MIT License. Built for the Genie X Hub Project Eclipse Hackathon.

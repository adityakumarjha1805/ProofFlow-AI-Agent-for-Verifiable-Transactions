 # 🛡️ ProofFlow — Verifiable AI Transactions

**Don't Just Trust AI. Verify Its Actions.**

ProofFlow is an AI-powered Web3 transaction security agent designed to make autonomous blockchain transactions safer, transparent, and verifiable. It connects AI-driven transaction interpretation with deterministic security policies, explicit user approval, and cryptographic verification to create a trustworthy audit trail for blockchain actions.

## 🚀 Overview

As AI agents become more capable of interacting with blockchain networks, allowing them to execute transactions introduces risks such as prompt injection, incorrect transaction parameters, unauthorized transfers, and insufficient accountability.

ProofFlow addresses these challenges by separating AI reasoning from transaction authorization and execution. Every transaction request passes through security checks and requires user approval before execution.

## 🎯 Problem Statement

AI agents can interpret user instructions and initiate financial actions, but their decisions cannot automatically be trusted. Incorrect recipient addresses, manipulated prompts, excessive spending, and mismatches between intended and executed transactions can lead to financial losses.

Existing approaches often lack a unified workflow connecting AI intent, deterministic policy enforcement, human authorization, and independently verifiable execution evidence.

## 💡 Proposed Solution

ProofFlow introduces a verifiable transaction workflow that allows an AI agent to prepare blockchain transactions while keeping security enforcement and final authorization under controlled rules.

### ✨ Key Features

- **AI-Powered Intent Interpretation:** Converts natural-language transaction requests into structured transaction proposals.
- **Deterministic Security Policies:** Enforces per-transaction limits, daily spending caps, trusted-address allowlists, and prohibited-address blocklists.
- **Human-in-the-Loop Approval:** Requires explicit user authorization before a proposed transaction can execute.
- **Cryptographic Commitments:** Uses canonical transaction data and hashing to bind the approved transaction parameters to a verifiable commitment.
- **On-Chain Execution:** Supports testnet transaction workflows through a connected Web3 wallet.
- **Post-Execution Verification:** Compares approved transaction parameters with blockchain execution receipts.
- **Audit History:** Maintains a record of transaction proposals, approvals, execution statuses, and verification results.
- **Security Dashboard:** Displays transaction activity, policy violations, spending information, and verification status.
- **Prompt-Injection Protection:** Keeps security enforcement independent of AI-generated reasoning so that natural-language instructions cannot override deterministic policy rules.

## 🔄 How It Works

1. **Intent:** The user describes a desired blockchain transaction in plain English.
2. **Interpretation:** The AI agent extracts the transaction type, recipient, amount, and relevant parameters.
3. **Policy Evaluation:** The policy engine validates the transaction against configured limits, address restrictions, and network rules.
4. **Proposal:** ProofFlow presents the normalized transaction details, estimated fees, risk information, and policy results.
5. **Approval:** The user reviews and explicitly authorizes the proposed transaction.
6. **Execution:** The approved transaction is submitted through the connected wallet to the selected supported network.
7. **Verification:** ProofFlow checks the resulting transaction receipt against the approved parameters and cryptographic commitment.
8. **Audit:** The system records the outcome so users can inspect the transaction history and verification evidence.

**Core principle:** No transaction should execute without the required approval and successful policy checks.

## 🏗️ System Architecture

ProofFlow separates the major responsibilities of an AI-driven transaction system.

- **Frontend:** Provides the dashboard, AI agent workspace, approval interface, transaction history, verification view, and policy configuration.
- **AI Reasoning Layer:** Interprets natural-language requests and generates structured transaction proposals.
- **Policy Engine:** Applies deterministic security rules independently of the AI model.
- **Wallet Integration:** Handles user authorization and transaction signing through a compatible Web3 wallet.
- **Blockchain Layer:** Submits and retrieves transaction data from supported testnets.
- **Verification Engine:** Recomputes cryptographic commitments and compares approved parameters against execution evidence.
- **Audit Layer:** Organizes proposal, approval, transaction, and verification records.

### Workflow

`User Intent → AI Interpretation → Policy Checks → Transaction Proposal → User Approval → Blockchain Execution → Cryptographic Verification → Audit Trail`

## 🧰 Technology Stack

The project is designed around the following technologies; the exact implementation depends on the libraries and services configured in the source code.

- **AI:** Google Gemini API
- **Frontend:** React and modern CSS / Tailwind CSS
- **Blockchain:** Ethereum-compatible networks and testnets
- **Wallet Integration:** MetaMask or another compatible EVM wallet
- **Smart Contract / Web3 Interaction:** Ethers.js or a compatible Web3 library
- **Cryptography:** Keccak-256 hashing and canonical transaction serialization
- **Development Tools:** Google AI Studio, Git, and GitHub

## 🖥️ Main Modules

| Module | Purpose |
|---|---|
| Overview | Introduces ProofFlow and its security workflow |
| Dashboard | Displays transaction statistics and recent activity |
| AI Agent Workspace | Accepts natural-language requests and generates transaction proposals |
| Approvals | Allows users to inspect and approve pending proposals |
| History | Lists previous proposals and transaction records |
| Verification | Displays cryptographic commitments and execution evidence |
| Policies | Configures transaction limits, allowlists, and blocklists |

## 🔐 Security Principles

ProofFlow is built around several important security principles:

- AI-generated instructions are treated as proposals, not authorization.
- Deterministic policy checks are enforced independently of the AI model.
- Users must review and approve transaction parameters before execution.
- Approved parameters must remain consistent with the transaction that is executed.
- Verification must distinguish pending, failed, and successfully verified transactions.
- Blockchain transactions and verification evidence should be traceable through transaction hashes and receipts.

**Important:** Cryptographic hashes alone do not prove that a transaction is safe. Security depends on correct parameter normalization, secure signing, enforcement of approval rules, and accurate verification against blockchain data.

## 🧪 Demo and Testing

For demonstration purposes, use a supported blockchain testnet, such as Ethereum Sepolia, with a compatible wallet and testnet funds.

Suggested scenarios:

1. **Valid Transaction:** Submit a small transfer to a valid recipient and complete the approval and verification workflow.
2. **Spending Limit Violation:** Request an amount exceeding the configured transaction limit and verify that the policy engine blocks it.
3. **Blocked Recipient:** Attempt a transfer to a prohibited address and confirm that it cannot proceed.
4. **Missing Information:** Submit an incomplete request and check whether the agent asks for clarification.
5. **Prompt-Injection Attempt:** Include instructions attempting to bypass security rules and verify that deterministic policies remain enforced.
6. **Verification Failure:** Simulate or inspect a mismatch between approved parameters and execution evidence and confirm that the transaction is not marked as verified.

Use testnet funds only. Never share private keys or seed phrases.

## 🌍 Potential Impact

ProofFlow aims to improve trust in AI-driven financial automation by making transaction decisions easier to inspect and verify.

Potential applications include:

- AI-powered crypto wallets
- Autonomous treasury management
- Blockchain-based payment agents
- Smart contract operations
- Multi-agent financial workflows
- Enterprise Web3 automation

By separating AI reasoning from security enforcement and transaction authorization, ProofFlow aims to make autonomous blockchain interactions more accountable.

## 🚧 Current Status

ProofFlow is a hackathon prototype under development. Its supported networks, AI integrations, transaction execution capabilities, and verification guarantees depend on the current implementation.

Features should be considered production-ready only after appropriate security testing, independent review, and validation against real blockchain execution receipts.

## 🔮 Future Improvements

- Multi-signature approvals for high-value transactions
- Advanced anomaly detection and risk scoring
- More EVM-compatible networks
- Policy templates for individuals and organizations
- Independent verification services
- Persistent, tamper-evident audit storage
- Automated security and integration testing

## ⚙️ Getting Started

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/proofflow.git
cd proofflow
```

Install dependencies using the package manager supported by the project. For an npm-based project:

```bash
npm install
```

Create a `.env` file using the environment variables required by your implementation. For example:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key
```

Use the exact variable names expected by your source code. Never commit API keys, wallet secrets, or private credentials to GitHub.

Start the development server:

```bash
npm run dev
```

Open the local URL printed by the development server.

**Note:** These commands assume a Vite-based frontend. Check your project's `package.json` and environment configuration before running them. Additional backend, blockchain RPC, or smart-contract setup may be required.

## 👥 Team

**Team Name:** One Four Team

**Project:** ProofFlow — Verifiable AI Transactions

**Hackathon:** Genie X Hub Presents Project: Eclipse Hackathon

## 📄 License

Choose an appropriate open-source license before distributing this project. No license is implied unless one is included in the repository.

---

**ProofFlow — Don't Just Trust AI. Verify Its Actions.**

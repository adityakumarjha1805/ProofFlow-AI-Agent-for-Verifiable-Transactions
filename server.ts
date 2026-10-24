import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluatePolicy, DEFAULT_POLICY_CONFIG, isValidAddress } from './src/services/policyEngine.ts';
import { evaluateTransactionPolicy, DEFAULT_DETERMINISTIC_POLICY } from './src/policy/policyEngine.ts';
import {
  createCryptographicCommitment,
  CURRENT_POLICY_VERSION,
  convertToBaseUnits,
} from './src/services/canonicalSerialization.ts';
import { verifyTransaction } from './src/services/verificationEngine.ts';
import { ProofFlowAgentService } from './src/agent/agentService.ts';
import {
  getSharedSepoliaClient,
  fetchLiveSepoliaBalance,
  estimateSepoliaTransactionFee,
  SEPOLIA_CHAIN_ID,
} from './src/services/blockchainService.ts';
import { db, ProofFlowDatabase } from './src/db/database.ts';
import type {
  TransactionProposal,
  TransactionIntent,
  DeterministicPolicyConfig,
  ExecutionReceipt,
  ApprovalEvidence,
} from './src/types/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize dedicated agent service
const agentService = new ProofFlowAgentService();

// Current active policy config
let currentPolicies: DeterministicPolicyConfig = { ...DEFAULT_POLICY_CONFIG };

// Helper to extract requesting wallet for authorization
function getRequestingWallet(req: Request): string | undefined {
  const headerWallet = req.headers['x-wallet-address'];
  if (typeof headerWallet === 'string' && headerWallet.trim().length > 0) {
    return headerWallet.trim();
  }
  const queryWallet = req.query.walletAddress;
  if (typeof queryWallet === 'string' && queryWallet.trim().length > 0) {
    return queryWallet.trim();
  }
  return undefined;
}

// System Health & Diagnostics
app.get('/api/health', (_req: Request, res: Response) => {
  const dbStatus = db.getStatus();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    network: 'Ethereum Sepolia (Chain ID: 11155111)',
    service: 'ProofFlow Authoritative Verification Engine',
    version: CURRENT_POLICY_VERSION,
    database: dbStatus,
  });
});

// 1. API: Agent Interpretation & Proposal Creation
app.post('/api/agent/analyze', async (req: Request, res: Response) => {
  const { prompt, userWalletAddress } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const agentResult = await agentService.processRequest({
      prompt,
      userWalletAddress,
      policies: currentPolicies,
    });

    let proposal: TransactionProposal | null = null;

    if (agentResult.status === 'proposal_ready' || agentResult.status === 'policy_blocked') {
      const intent: TransactionIntent = {
        rawPrompt: prompt,
        actionType: (agentResult.intent.action.toUpperCase() as any) || 'TRANSFER',
        recipient: agentResult.intent.recipient,
        recipientLabel: agentResult.intent.recipientLabel,
        amount: agentResult.intent.amount,
        tokenSymbol: agentResult.intent.asset,
        chainId: agentResult.intent.chainId,
        calldata: '0x',
        purposeExplanation: agentResult.explanation,
        estimatedGasEth: '0.00042',
      };

      const policyEvaluation = evaluatePolicy(intent, currentPolicies);

      // Create persistent proposal in database
      const fallbackWallet = userWalletAddress || '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c';
      const createdRecord = await db.createProposal({
        userWalletAddress: fallbackWallet,
        userPrompt: prompt,
        intent,
        riskAssessment: {
          overallLevel: (agentResult.risk_level as any) || 'LOW',
          riskScore: agentResult.risk_level === 'CRITICAL' ? 95 : agentResult.risk_level === 'HIGH' ? 65 : 15,
          summary: agentResult.explanation,
          factors: agentResult.checks.map((c) => ({
            factor: c.name,
            level: (c.status === 'FAILED' ? 'HIGH' : 'LOW') as any,
            description: c.details,
            passed: c.passed,
          })),
        },
        policyEvaluation,
      });

      const fullProposalRes = await db.getProposalById(createdRecord.id, fallbackWallet);
      proposal = fullProposalRes?.proposal || null;
    }

    res.json({
      success: true,
      agentResult,
      proposal,
      poweredBy: process.env.GEMINI_API_KEY ? 'Gemini 3.8 Flash' : 'Deterministic AI Agent Engine',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error during analysis';
    res.status(500).json({ error: message });
  }
});

// Full conversation endpoint
app.post('/api/agent/chat', async (req: Request, res: Response) => {
  const { prompt, conversationHistory, userWalletAddress } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const agentResult = await agentService.processRequest({
      prompt,
      conversationHistory,
      userWalletAddress,
      policies: currentPolicies,
    });

    let proposal: TransactionProposal | null = null;
    if (agentResult.status === 'proposal_ready' || agentResult.status === 'policy_blocked') {
      const intent: TransactionIntent = {
        rawPrompt: prompt,
        actionType: (agentResult.intent.action.toUpperCase() as any) || 'TRANSFER',
        recipient: agentResult.intent.recipient,
        recipientLabel: agentResult.intent.recipientLabel,
        amount: agentResult.intent.amount,
        tokenSymbol: agentResult.intent.asset,
        chainId: agentResult.intent.chainId,
        calldata: '0x',
        purposeExplanation: agentResult.explanation,
        estimatedGasEth: '0.00042',
      };

      const policyEvaluation = evaluatePolicy(intent, currentPolicies);

      const fallbackWallet = userWalletAddress || '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c';
      const createdRecord = await db.createProposal({
        userWalletAddress: fallbackWallet,
        userPrompt: prompt,
        intent,
        riskAssessment: {
          overallLevel: (agentResult.risk_level as any) || 'LOW',
          riskScore: agentResult.risk_level === 'CRITICAL' ? 95 : agentResult.risk_level === 'HIGH' ? 65 : 15,
          summary: agentResult.explanation,
          factors: agentResult.checks.map((c) => ({
            factor: c.name,
            level: (c.status === 'FAILED' ? 'HIGH' : 'LOW') as any,
            description: c.details,
            passed: c.passed,
          })),
        },
        policyEvaluation,
      });

      const fullProposalRes = await db.getProposalById(createdRecord.id, fallbackWallet);
      proposal = fullProposalRes?.proposal || null;
    }

    res.json({
      success: true,
      agentResult,
      proposal,
      poweredBy: process.env.GEMINI_API_KEY ? 'Gemini 3.8 Flash' : 'Deterministic AI Agent Engine',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error during analysis';
    res.status(500).json({ error: message });
  }
});

// 2. API: Get & Update Policies
app.get('/api/policies', (_req: Request, res: Response) => {
  res.json({ policies: currentPolicies });
});

app.post('/api/policies', (req: Request, res: Response) => {
  const updated = req.body;
  currentPolicies = { ...currentPolicies, ...updated };
  res.json({ success: true, policies: currentPolicies });
});

// 3. API: Paginated Proposals List & Detail with Authorization
app.get('/api/proposals', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const status = req.query.status as string;
    const network = req.query.network as string;
    const search = req.query.search as string;
    const requestingWallet = getRequestingWallet(req);

    const result = await db.getProposalsPaginated(
      {
        page,
        limit,
        status,
        network,
        search,
        walletAddress: req.query.onlyMyWallet === 'true' ? requestingWallet : undefined,
      },
      requestingWallet
    );

    res.json({
      success: true,
      proposals: result.data, // backwards compatibility
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve proposals' });
  }
});

app.get('/api/proposals/:id', async (req: Request, res: Response) => {
  try {
    const requestingWallet = getRequestingWallet(req);
    const result = await db.getProposalById(req.params.id, requestingWallet);
    if (!result) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    res.json({
      success: true,
      proposal: result.proposal,
      isAuthorizedOwner: result.isAuthorizedOwner,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve proposal' });
  }
});

// 4. API: User Explicit Approval & Cryptographic Commitment Creation
app.post('/api/proposals/:id/commit', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    signerAddress = '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c',
    approvalMethod = 'WALLET_PERSONAL_SIGN',
    signature,
    userApprovalNotes,
  } = req.body;

  try {
    const pRecord = await db.recordCommitment(id, signerAddress);

    // Record approval evidence if signature or confirmation provided
    const approvalEvidence = await db.recordApprovalEvidence({
      proposalId: id,
      walletAddress: signerAddress,
      approvedCommitmentHash: pRecord.commitment!.sha256Hash,
      approvalMethod: approvalMethod as any,
      signature,
      userApprovalNotes,
    });

    const fullProposalRes = await db.getProposalById(id, signerAddress);

    res.json({
      success: true,
      proposal: fullProposalRes?.proposal,
      commitment: pRecord.commitment,
      approvalEvidence,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to commit proposal' });
  }
});

// 5. API: Submit & Execute on Blockchain (With Duplicate Prevention & Authoritative Server Verification)
app.post('/api/proposals/:id/execute', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { mode = 'DEMO_TESTNET', clientTxHash, clientSigner } = req.body;

  try {
    const proposalRes = await db.getProposalById(id);
    if (!proposalRes) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    const { proposal } = proposalRes;

    // SECURITY: Enforce transaction approval before execution
    if (proposal.status !== 'APPROVED' && !proposal.commitment) {
      return res.status(400).json({
        error: 'PRECONDITION_FAILED: Proposal must be explicitly approved and cryptographically committed before blockchain execution',
      });
    }

    if (proposal.policyEvaluation && proposal.policyEvaluation.hasBlockingViolations) {
      return res.status(400).json({
        error: 'POLICY_VIOLATION: Cannot execute proposal with blocking policy violations',
      });
    }

    let txHash: string;
    let blockNumber: number;
    let fromAddress: string;
    let toAddress: string;
    let valueEth: string;
    let valueBaseUnits: string;
    let chainId: number;
    let gasUsed: number;
    let effectiveGasPriceGwei: string;
    let status: 'SUCCESS' | 'REVERTED' | 'PENDING';
    let explorerUrl: string;

    if (clientTxHash) {
      try {
        const client = getSharedSepoliaClient();
        const [receipt, tx] = await Promise.all([
          client.waitForTransactionReceipt({ hash: clientTxHash as `0x${string}`, confirmations: 1, timeout: 60_000 }),
          client.getTransaction({ hash: clientTxHash as `0x${string}` }),
        ]);

        txHash = receipt.transactionHash;
        blockNumber = Number(receipt.blockNumber);
        fromAddress = tx.from;
        toAddress = tx.to || proposal.intent.recipient;
        valueEth = (Number(tx.value) / 1e18).toString();
        valueBaseUnits = tx.value ? tx.value.toString() : convertToBaseUnits(valueEth);
        chainId = proposal.intent.chainId;
        gasUsed = Number(receipt.gasUsed);
        effectiveGasPriceGwei = receipt.effectiveGasPrice
          ? (Number(receipt.effectiveGasPrice) / 1e9).toFixed(2)
          : '15.0';
        status = receipt.status === 'success' ? 'SUCCESS' : 'REVERTED';
        explorerUrl = `https://sepolia.etherscan.io/tx/${txHash}`;
      } catch (rpcErr: any) {
        txHash = clientTxHash;
        blockNumber = 0;
        fromAddress = clientSigner || proposal.commitment?.signerAddress || '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c';
        toAddress = proposal.intent.recipient;
        valueEth = proposal.intent.amount;
        valueBaseUnits = convertToBaseUnits(proposal.intent.amount);
        chainId = proposal.intent.chainId;
        gasUsed = 21000;
        effectiveGasPriceGwei = '15.0';
        status = 'PENDING';
        explorerUrl = `https://sepolia.etherscan.io/tx/${clientTxHash}`;
      }
    } else {
      // Demo Sandbox Mode
      txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
      blockNumber = 11950390 + Math.floor(Math.random() * 50);
      explorerUrl = `https://sepolia.etherscan.io/tx/${txHash}`;
      fromAddress = clientSigner || proposal.approvalEvidence?.walletAddress || proposal.commitment?.signerAddress || '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c';
      toAddress = proposal.intent.recipient;
      valueEth = proposal.intent.amount;
      valueBaseUnits = convertToBaseUnits(proposal.intent.amount);
      chainId = proposal.intent.chainId;
      gasUsed = 21000;
      effectiveGasPriceGwei = '15.8';
      status = 'SUCCESS';
    }

    // Record immutable blockchain execution in persistent database
    // Automatically enforces duplicate prevention & server-authoritative verification recomputation!
    const execResult = await db.recordBlockchainExecution({
      proposalId: id,
      txHash,
      blockNumber,
      from: fromAddress,
      to: toAddress,
      valueEth,
      valueBaseUnits,
      chainId,
      gasUsed,
      effectiveGasPriceGwei,
      status,
      explorerUrl,
      mode: clientTxHash ? 'LIVE_WALLET' : 'DEMO_TESTNET',
    });

    const updatedProposalRes = await db.getProposalById(id);

    res.json({
      success: true,
      proposal: updatedProposalRes?.proposal,
      execution: execResult.transaction,
      verification: execResult.verification,
    });
  } catch (err: any) {
    if (err.message && err.message.startsWith('DUPLICATE_TRANSACTION_ERROR')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(400).json({ error: err.message || 'Failed to execute transaction' });
  }
});

// 6. API: Standalone Verification Endpoint
// Requirement: "Provide a verification endpoint that retrieves a record and validates it using the verification engine."
app.get('/api/verify/:proposalId', async (req: Request, res: Response) => {
  const { proposalId } = req.params;
  try {
    const requestingWallet = getRequestingWallet(req);
    const proposalRes = await db.getProposalById(proposalId, requestingWallet);
    if (!proposalRes) {
      return res.status(404).json({ error: 'Proposal record not found for verification' });
    }

    // Recompute verification authoritatively on server
    const verification = await db.reverifyProposal(proposalId);
    const updatedProposalRes = await db.getProposalById(proposalId, requestingWallet);
    const auditEvents = await db.getAuditEvents(proposalId, requestingWallet);

    res.json({
      success: true,
      proposalId,
      status: verification.status,
      verification,
      proposal: updatedProposalRes?.proposal,
      auditEvents,
      verifiedAt: new Date().toISOString(),
      engine: 'ProofFlow Authoritative Cryptographic Verification Engine',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Verification execution failed' });
  }
});

app.post('/api/verify/:proposalId', async (req: Request, res: Response) => {
  const { proposalId } = req.params;
  try {
    const requestingWallet = getRequestingWallet(req);
    const verification = await db.reverifyProposal(proposalId);
    const proposalRes = await db.getProposalById(proposalId, requestingWallet);
    const auditEvents = await db.getAuditEvents(proposalId, requestingWallet);

    res.json({
      success: true,
      proposalId,
      status: verification.status,
      verification,
      proposal: proposalRes?.proposal,
      auditEvents,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Re-verification failed' });
  }
});

app.post('/api/proposals/:proposalId/verify', async (req: Request, res: Response) => {
  const { proposalId } = req.params;
  try {
    const requestingWallet = getRequestingWallet(req);
    const verification = await db.reverifyProposal(proposalId);
    const proposalRes = await db.getProposalById(proposalId, requestingWallet);
    const auditEvents = await db.getAuditEvents(proposalId, requestingWallet);

    res.json({
      success: true,
      proposalId,
      status: verification.status,
      verification,
      proposal: proposalRes?.proposal,
      auditEvents,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Re-verification failed' });
  }
});

// Interactive Tampering Simulation Endpoints
app.post('/api/proposals/:proposalId/simulate-tamper', async (req: Request, res: Response) => {
  const { proposalId } = req.params;
  const { tamperType } = req.body;
  try {
    const requestingWallet = getRequestingWallet(req);
    const verification = await db.simulateTamper(proposalId, tamperType || 'AMOUNT');
    const proposalRes = await db.getProposalById(proposalId, requestingWallet);

    res.json({
      success: true,
      proposalId,
      status: verification.status,
      verification,
      proposal: proposalRes?.proposal,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Tampering simulation failed' });
  }
});

app.post('/api/proposals/:proposalId/restore-faithful', async (req: Request, res: Response) => {
  const { proposalId } = req.params;
  try {
    const requestingWallet = getRequestingWallet(req);
    const verification = await db.restoreFaithful(proposalId);
    const proposalRes = await db.getProposalById(proposalId, requestingWallet);

    res.json({
      success: true,
      proposalId,
      status: verification.status,
      verification,
      proposal: proposalRes?.proposal,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Restoration failed' });
  }
});

// 7. API: Audit Events for a Proposal
app.get('/api/proposals/:id/audits', async (req: Request, res: Response) => {
  try {
    const requestingWallet = getRequestingWallet(req);
    const events = await db.getAuditEvents(req.params.id, requestingWallet);
    res.json({ success: true, events });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve audit trail' });
  }
});

// 8. API: Database Health & Security Guide
app.get('/api/db/status', (_req: Request, res: Response) => {
  const status = db.getStatus();
  res.json({ success: true, database: status });
});

app.get('/api/db/security-guide', (_req: Request, res: Response) => {
  const guide = ProofFlowDatabase.getSecureCredentialsGuide();
  res.json({ success: true, guide });
});

// 9. Real Blockchain Status Endpoints
app.get('/api/blockchain/status', async (_req: Request, res: Response) => {
  try {
    const client = getSharedSepoliaClient();
    const [blockNumber, gasPrice] = await Promise.all([
      client.getBlockNumber(),
      client.getGasPrice(),
    ]);

    res.json({
      success: true,
      chainId: SEPOLIA_CHAIN_ID,
      chainName: 'Ethereum Sepolia Testnet',
      blockNumber: Number(blockNumber),
      gasPriceGwei: (Number(gasPrice) / 1e9).toFixed(2),
      status: 'ONLINE',
      explorerUrl: 'https://sepolia.etherscan.io',
      rpcEndpoint: 'https://ethereum-sepolia-rpc.publicnode.com',
    });
  } catch (err: any) {
    res.status(503).json({
      success: false,
      error: 'Unable to connect to Sepolia RPC endpoint.',
      details: err.message,
    });
  }
});

app.get('/api/blockchain/balance/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const balanceInfo = await fetchLiveSepoliaBalance(address);
    res.json({
      success: true,
      address,
      balanceEth: balanceInfo.balanceEth,
      balanceWeiHex: balanceInfo.rawWeiHex,
      blockNumber: Number(balanceInfo.blockNumber),
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/blockchain/estimate-fee', async (req: Request, res: Response) => {
  try {
    const { to, amount, from } = req.query;
    if (!to || typeof to !== 'string') {
      return res.status(400).json({ error: 'Missing "to" query parameter.' });
    }
    const fee = await estimateSepoliaTransactionFee(
      to,
      typeof amount === 'string' ? amount : '0.001',
      typeof from === 'string' ? from : undefined
    );
    res.json({
      success: true,
      ...fee,
      currentBlock: Number(fee.currentBlock),
      gasUnits: Number(fee.gasUnits),
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 10. Express & Vite integration
async function startServer() {
  // Initialize persistent database
  try {
    await db.initialize();
  } catch (err) {
    console.error('[Server] Database initialization error:', err);
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`ProofFlow Server running on http://localhost:${PORT}`);
  });
}

startServer();

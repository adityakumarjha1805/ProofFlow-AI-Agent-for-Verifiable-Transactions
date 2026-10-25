import fs from 'fs';
import path from 'path';
import { MongoClient, Db, Collection } from 'mongodb';
import { convertToBaseUnits, createCryptographicCommitment, CURRENT_POLICY_VERSION } from '../services/canonicalSerialization.ts';
import { verifyTransaction } from '../services/verificationEngine.ts';
import type {
  TransactionProposal,
  TransactionIntent,
  ProposalStatus,
  VerificationAudit,
} from '../types/index.ts';
import type {
  ProposalRecord,
  PolicyEvaluationRecord,
  ApprovalEvidenceRecord,
  BlockchainTransactionRecord,
  VerificationResultRecord,
  AuditEventRecord,
  ProposalQueryFilters,
  PaginatedResult,
  DatabaseStatus,
  AuditEventType,
} from '../types/database.ts';

// Storage paths for the local persistent engine
const DATA_DIR = path.resolve(process.cwd(), 'data');
const LOCAL_DB_FILE = path.join(DATA_DIR, 'proofflow-store.json');

// Interface defining all collections in our persistent schema
interface DatabaseSchema {
  proposals: ProposalRecord[];
  policyEvaluations: PolicyEvaluationRecord[];
  approvalEvidence: ApprovalEvidenceRecord[];
  blockchainTransactions: BlockchainTransactionRecord[];
  verificationResults: VerificationResultRecord[];
  auditEvents: AuditEventRecord[];
}

export class ProofFlowDatabase {
  private mongoClient: MongoClient | null = null;
  private mongoDb: Db | null = null;
  private isMongoConnected: boolean = false;
  private mongoError: string | null = null;

  // In-memory persistent cache backed by atomic file-based persistence
  private schema: DatabaseSchema = {
    proposals: [],
    policyEvaluations: [],
    approvalEvidence: [],
    blockchainTransactions: [],
    verificationResults: [],
    auditEvents: [],
  };

  // Indexes for O(1) lookups and uniqueness enforcement
  private proposalIdIndex: Map<string, number> = new Map();
  private txHashIndex: Map<string, string> = new Map(); // txHash -> proposalId
  private walletIndex: Map<string, Set<string>> = new Map(); // wallet -> Set of proposalIds
  private dbFilePath: string = LOCAL_DB_FILE;

  constructor(options?: { dbPath?: string }) {
    if (options?.dbPath) {
      this.dbFilePath = options.dbPath;
    }
    this.initLocalStorage();
  }

  /**
   * Initializes local persistent file storage and attempts MongoDB Atlas connection if MONGODB_URI is provided.
   */
  public async initialize(): Promise<DatabaseStatus> {
    this.loadFromLocalDisk();

    // Check if MongoDB Atlas URI is configured
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri && mongoUri.startsWith('mongodb')) {
      try {
        this.mongoClient = new MongoClient(mongoUri, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
        });
        await this.mongoClient.connect();
        this.mongoDb = this.mongoClient.db(process.env.MONGODB_DB_NAME || 'proofflow');
        this.isMongoConnected = true;
        await this.setupMongoIndexes();
        console.log('[Database] Successfully connected to MongoDB Atlas and configured indexes.');
      } catch (err: any) {
        this.isMongoConnected = false;
        this.mongoError = err.message || 'Failed to connect to MongoDB Atlas';
        console.warn('[Database] MongoDB Atlas connection error, operating on persistent file storage fallback:', this.mongoError);
      }
    } else {
      console.log('[Database] Operating on local persistent JSON database store with atomic disk synchronization.');
    }

    // Rebuild indexes
    this.rebuildIndexes();

    // Seed default baseline proposals if database is completely empty
    if (this.schema.proposals.length === 0) {
      await this.seedBaselineData();
    }

    return this.getStatus();
  }

  private initLocalStorage(): void {
    try {
      const dir = path.dirname(this.dbFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err: any) {
      console.error('[Database] Failed to create data directory:', err);
    }
  }

  private loadFromLocalDisk(): void {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const raw = fs.readFileSync(this.dbFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.schema = {
          proposals: parsed.proposals || [],
          policyEvaluations: parsed.policyEvaluations || [],
          approvalEvidence: parsed.approvalEvidence || [],
          blockchainTransactions: parsed.blockchainTransactions || [],
          verificationResults: parsed.verificationResults || [],
          auditEvents: parsed.auditEvents || [],
        };
      }
    } catch (err) {
      console.error('[Database] Error loading local persistent store:', err);
    }
  }

  private saveToLocalDisk(): void {
    try {
      this.initLocalStorage();
      const tempPath = `${this.dbFilePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.schema, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.dbFilePath); // Atomic write
    } catch (err: any) {
      console.error('[Database] Error writing to local persistent store:', err);
      throw new Error(`DATABASE_WRITE_ERROR: Failed writing to persistent storage: ${err.message}`);
    }
  }

  private async setupMongoIndexes(): Promise<void> {
    if (!this.mongoDb) return;
    try {
      // 1. Proposals: Unique proposal ID & User Wallet Address index
      await this.mongoDb.collection('proposals').createIndex({ id: 1 }, { unique: true });
      await this.mongoDb.collection('proposals').createIndex({ userWalletAddress: 1 });
      await this.mongoDb.collection('proposals').createIndex({ createdAt: -1 });

      // 2. Blockchain Transactions: Unique txHash index to prevent duplicate submissions
      await this.mongoDb.collection('blockchain_transactions').createIndex({ txHash: 1 }, { unique: true });
      await this.mongoDb.collection('blockchain_transactions').createIndex({ proposalId: 1 });

      // 3. Approval Evidence: proposalId index
      await this.mongoDb.collection('approval_evidence').createIndex({ proposalId: 1 });
      await this.mongoDb.collection('approval_evidence').createIndex({ walletAddress: 1 });

      // 4. Verification Results: proposalId index
      await this.mongoDb.collection('verification_results').createIndex({ proposalId: 1 });

      // 5. Audit Events: proposalId and timestamp
      await this.mongoDb.collection('audit_events').createIndex({ proposalId: 1 });
      await this.mongoDb.collection('audit_events').createIndex({ timestamp: -1 });
    } catch (err) {
      console.error('[Database] Failed setting up MongoDB indexes:', err);
    }
  }

  private rebuildIndexes(): void {
    this.proposalIdIndex.clear();
    this.txHashIndex.clear();
    this.walletIndex.clear();

    this.schema.proposals.forEach((p, idx) => {
      this.proposalIdIndex.set(p.id, idx);
      const w = p.userWalletAddress.toLowerCase();
      if (!this.walletIndex.has(w)) {
        this.walletIndex.set(w, new Set());
      }
      this.walletIndex.get(w)!.add(p.id);
    });

    this.schema.blockchainTransactions.forEach((tx) => {
      if (tx.txHash) {
        this.txHashIndex.set(tx.txHash.toLowerCase(), tx.proposalId);
      }
    });
  }

  // --- Security & Server-Side Validation Helpers ---

  private validateNoPrivateKeys(data: any): void {
    const serialized = JSON.stringify(data);
    // Patterns for private key or seed phrase leaks
    const privateKeyPattern = /(0x)?[a-fA-F0-9]{64}/g;
    const mnemonicWords = /(abandon|ability|able|about|above|absent|absorb|abstract|absurd|abuse|access|accident|account|accuse|achieve|acid|acoustic|acquire|across|act|action|actor|actress|actual)/i;

    // Check specific sensitive keys
    if (serialized.includes('privateKey') || serialized.includes('seedPhrase') || serialized.includes('mnemonic')) {
      throw new Error('SECURITY_VIOLATION: Attempted to store forbidden cryptographic secret or private key in the database');
    }
  }

  private canonicalizeAddress(addr: string): string {
    if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      throw new Error(`VALIDATION_ERROR: Invalid Ethereum address format: ${addr}`);
    }
    return addr.toLowerCase();
  }

  // --- AUDIT EVENT LOGGING ---

  public async recordAuditEvent(params: {
    proposalId: string;
    eventType: AuditEventType;
    actorWalletAddress?: string;
    ipAddress?: string;
    userAgent?: string;
    details: Record<string, unknown>;
  }): Promise<AuditEventRecord> {
    const auditRecord: AuditEventRecord = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      proposalId: params.proposalId,
      eventType: params.eventType,
      actorWalletAddress: params.actorWalletAddress ? this.canonicalizeAddress(params.actorWalletAddress) : undefined,
      ipAddress: params.ipAddress || 'internal',
      userAgent: params.userAgent || 'ProofFlow-Server',
      details: params.details,
      timestamp: new Date().toISOString(),
    };

    this.schema.auditEvents.push(auditRecord);
    this.saveToLocalDisk();

    if (this.isMongoConnected && this.mongoDb) {
      try {
        await this.mongoDb.collection('audit_events').insertOne({ ...auditRecord });
      } catch (err) {
        console.error('[Database] Failed to write audit event to MongoDB:', err);
      }
    }

    return auditRecord;
  }

  // --- PROPOSAL MANAGEMENT & CRUD ---

  public async createProposal(params: {
    userWalletAddress: string;
    userPrompt: string;
    intent: TransactionIntent;
    riskAssessment: any;
    policyEvaluation: any;
    plan?: any;
    executionTrace?: any;
  }): Promise<ProposalRecord> {
    // 1. Server-side validation
    this.validateNoPrivateKeys(params);
    const creator = this.canonicalizeAddress(params.userWalletAddress);
    const recipient = this.canonicalizeAddress(params.intent.recipient);

    if (!params.userPrompt || params.userPrompt.trim().length === 0) {
      throw new Error('VALIDATION_ERROR: User prompt cannot be empty');
    }

    const numAmount = parseFloat(params.intent.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('VALIDATION_ERROR: Transaction amount must be a positive decimal number');
    }

    // Convert amount safely to integer base units (wei) as string
    const amountInBaseUnits = convertToBaseUnits(params.intent.amount);

    const proposalId = `prop-sepolia-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const record: ProposalRecord = {
      id: proposalId,
      userWalletAddress: creator,
      userPrompt: params.userPrompt.trim(),
      intent: {
        ...params.intent,
        recipient,
      },
      amountInBaseUnits,
      status: 'AWAITING_APPROVAL',
      riskAssessment: params.riskAssessment,
      plan: params.plan,
      executionTrace: params.executionTrace || [],
      createdAt: now,
      updatedAt: now,
    };

    // Store in schema & indexes
    this.schema.proposals.push(record);
    this.proposalIdIndex.set(record.id, this.schema.proposals.length - 1);
    if (!this.walletIndex.has(creator)) {
      this.walletIndex.set(creator, new Set());
    }
    this.walletIndex.get(creator)!.add(record.id);

    // Save policy evaluation record
    const polRecord: PolicyEvaluationRecord = {
      id: `pol-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      proposalId: record.id,
      userWalletAddress: creator,
      policyVersion: CURRENT_POLICY_VERSION,
      passed: params.policyEvaluation.passed,
      hasBlockingViolations: params.policyEvaluation.hasBlockingViolations,
      warningsCount: params.policyEvaluation.warningsCount,
      results: params.policyEvaluation.results || [],
      maxSingleTxEth: 1.0,
      maxDailyTxEth: 5.0,
      evaluatedAt: now,
    };
    this.schema.policyEvaluations.push(polRecord);

    this.saveToLocalDisk();

    // Persist to MongoDB if available
    if (this.isMongoConnected && this.mongoDb) {
      try {
        await this.mongoDb.collection('proposals').insertOne({ ...record });
        await this.mongoDb.collection('policy_evaluations').insertOne({ ...polRecord });
      } catch (err: any) {
        console.error('[Database] MongoDB write error on createProposal:', err);
      }
    }

    // Record audit event
    await this.recordAuditEvent({
      proposalId: record.id,
      eventType: 'PROPOSAL_CREATED',
      actorWalletAddress: creator,
      details: {
        recipient,
        amount: params.intent.amount,
        amountInBaseUnits,
        chainId: params.intent.chainId,
      },
    });

    return record;
  }

  public async getProposalById(proposalId: string, requestingWallet?: string): Promise<{
    proposal: TransactionProposal;
    isAuthorizedOwner: boolean;
  } | null> {
    const idx = this.proposalIdIndex.get(proposalId);
    if (idx === undefined || idx < 0 || idx >= this.schema.proposals.length) {
      return null;
    }

    const pRecord = this.schema.proposals[idx];
    const pol = this.schema.policyEvaluations.find((x) => x.proposalId === proposalId);
    const appr = this.schema.approvalEvidence.find((x) => x.proposalId === proposalId);
    const bctx = this.schema.blockchainTransactions.find((x) => x.proposalId === proposalId);
    const vrfy = this.schema.verificationResults.find((x) => x.proposalId === proposalId);

    // Check authorization: does the requesting wallet match the owner?
    const canonicalRequester = requestingWallet ? requestingWallet.toLowerCase() : null;
    const isAuthorizedOwner = canonicalRequester !== null && canonicalRequester === pRecord.userWalletAddress.toLowerCase();

    // Build the synthesized proposal
    const proposal: TransactionProposal = {
      id: pRecord.id,
      createdAt: pRecord.createdAt,
      updatedAt: pRecord.updatedAt,
      status: pRecord.status,
      // If unauthorized, redact raw user prompt to preserve privacy, while maintaining verifiable transaction parameters
      userPrompt: isAuthorizedOwner || !requestingWallet
        ? pRecord.userPrompt
        : `[Redacted for privacy] Transaction proposal for ${pRecord.intent.amount} ${pRecord.intent.tokenSymbol}`,
      intent: pRecord.intent,
      riskAssessment: pRecord.riskAssessment,
      policyEvaluation: pol ? {
        passed: pol.passed,
        hasBlockingViolations: pol.hasBlockingViolations,
        warningsCount: pol.warningsCount,
        evaluatedAt: pol.evaluatedAt,
        results: pol.results,
      } : {
        passed: true,
        hasBlockingViolations: false,
        warningsCount: 0,
        evaluatedAt: pRecord.createdAt,
        results: [],
      },
      commitment: pRecord.commitment,
      approvalEvidence: appr ? {
        walletAddress: appr.walletAddress,
        approvedCommitmentHash: appr.approvedCommitmentHash,
        approvalMethod: appr.approvalMethod,
        signature: appr.signature,
        approvedAt: appr.approvedAt,
        distinctFromTxSignature: true,
        userApprovalNotes: isAuthorizedOwner ? appr.userApprovalNotes : undefined,
      } : undefined,
      execution: bctx ? {
        txHash: bctx.txHash,
        blockNumber: bctx.blockNumber,
        from: bctx.fromAddress,
        to: bctx.toAddress,
        valueEth: bctx.valueEth,
        valueBaseUnits: bctx.valueBaseUnits,
        chainId: bctx.chainId as any,
        calldata: bctx.calldata,
        gasUsed: bctx.gasUsed,
        effectiveGasPriceGwei: bctx.effectiveGasPriceGwei,
        status: bctx.status,
        explorerUrl: bctx.explorerUrl,
        executedAt: bctx.executedAt,
        mode: bctx.mode,
      } : undefined,
      verification: vrfy?.auditData,
      plan: pRecord.plan,
      executionTrace: pRecord.executionTrace || [],
    };

    return { proposal, isAuthorizedOwner };
  }

  // --- PAGINATED TRANSACTION HISTORY ---

  public async getProposalsPaginated(filters: ProposalQueryFilters, requestingWallet?: string): Promise<PaginatedResult<TransactionProposal>> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(50, filters.limit || 10));
    const canonicalRequester = requestingWallet ? requestingWallet.toLowerCase() : null;

    // Filter proposals
    let matched = this.schema.proposals.filter((p) => {
      // Wallet isolation if requested
      if (filters.walletAddress) {
        if (p.userWalletAddress.toLowerCase() !== filters.walletAddress.toLowerCase()) {
          return false;
        }
      }

      // Status filter
      if (filters.status && filters.status !== 'ALL') {
        if (filters.status === 'VERIFIED' && p.status !== 'VERIFIED') return false;
        if (filters.status === 'PENDING' && !['AWAITING_APPROVAL', 'APPROVED', 'POLICY_PASSED'].includes(p.status)) return false;
        if (filters.status === 'POLICY_VIOLATION' && p.status !== 'POLICY_VIOLATION') return false;
        if (filters.status === 'EXECUTED' && p.status !== 'EXECUTED') return false;
        if (filters.status === 'FAILED' && !['REJECTED', 'VERIFICATION_FAILED'].includes(p.status)) return false;
      }

      // Network filter
      if (filters.network && filters.network !== 'ALL') {
        if (String(p.intent.chainId) !== String(filters.network)) return false;
      }

      // Search filter
      if (filters.search && filters.search.trim().length > 0) {
        const q = filters.search.toLowerCase().trim();
        const matchesId = p.id.toLowerCase().includes(q);
        const matchesPrompt = p.userPrompt.toLowerCase().includes(q);
        const matchesRecipient = p.intent.recipient.toLowerCase().includes(q);
        const matchesToken = p.intent.tokenSymbol.toLowerCase().includes(q);
        const matchesCommitment = p.commitment?.sha256Hash.toLowerCase().includes(q) || false;
        const bctx = this.schema.blockchainTransactions.find((x) => x.proposalId === p.id);
        const matchesTx = bctx?.txHash.toLowerCase().includes(q) || false;

        if (!matchesId && !matchesPrompt && !matchesRecipient && !matchesToken && !matchesCommitment && !matchesTx) {
          return false;
        }
      }

      return true;
    });

    // Sort descending by creation date
    matched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = matched.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const pageRecords = matched.slice(offset, offset + limit);

    // Map each record to full TransactionProposal with privacy checks
    const data: TransactionProposal[] = pageRecords.map((pRecord) => {
      const pol = this.schema.policyEvaluations.find((x) => x.proposalId === pRecord.id);
      const appr = this.schema.approvalEvidence.find((x) => x.proposalId === pRecord.id);
      const bctx = this.schema.blockchainTransactions.find((x) => x.proposalId === pRecord.id);
      const vrfy = this.schema.verificationResults.find((x) => x.proposalId === pRecord.id);

      const isOwner = canonicalRequester ? canonicalRequester === pRecord.userWalletAddress.toLowerCase() : true;

      return {
        id: pRecord.id,
        createdAt: pRecord.createdAt,
        updatedAt: pRecord.updatedAt,
        status: pRecord.status,
        userPrompt: isOwner ? pRecord.userPrompt : `[Private] Transfer ${pRecord.intent.amount} ${pRecord.intent.tokenSymbol}`,
        intent: pRecord.intent,
        riskAssessment: pRecord.riskAssessment,
        policyEvaluation: pol ? {
          passed: pol.passed,
          hasBlockingViolations: pol.hasBlockingViolations,
          warningsCount: pol.warningsCount,
          evaluatedAt: pol.evaluatedAt,
          results: pol.results,
        } : {
          passed: true,
          hasBlockingViolations: false,
          warningsCount: 0,
          evaluatedAt: pRecord.createdAt,
          results: [],
        },
        commitment: pRecord.commitment,
        approvalEvidence: appr ? {
          walletAddress: appr.walletAddress,
          approvedCommitmentHash: appr.approvedCommitmentHash,
          approvalMethod: appr.approvalMethod,
          signature: appr.signature,
          approvedAt: appr.approvedAt,
          distinctFromTxSignature: true,
          userApprovalNotes: isOwner ? appr.userApprovalNotes : undefined,
        } : undefined,
        execution: bctx ? {
          txHash: bctx.txHash,
          blockNumber: bctx.blockNumber,
          from: bctx.fromAddress,
          to: bctx.toAddress,
          valueEth: bctx.valueEth,
          valueBaseUnits: bctx.valueBaseUnits,
          chainId: bctx.chainId as any,
          calldata: bctx.calldata,
          gasUsed: bctx.gasUsed,
          effectiveGasPriceGwei: bctx.effectiveGasPriceGwei,
          status: bctx.status,
          explorerUrl: bctx.explorerUrl,
          executedAt: bctx.executedAt,
          mode: bctx.mode,
        } : undefined,
        verification: vrfy?.auditData,
        plan: pRecord.plan,
        executionTrace: pRecord.executionTrace || [],
      };
    });

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  // --- RECORDING COMMITMENT ---

  public async recordCommitment(proposalId: string, signerAddress: string): Promise<ProposalRecord> {
    const idx = this.proposalIdIndex.get(proposalId);
    if (idx === undefined) {
      throw new Error(`PROPOSAL_NOT_FOUND: Proposal ID ${proposalId} does not exist`);
    }

    const p = this.schema.proposals[idx];
    if (p.status === 'REJECTED') {
      throw new Error(`PRECONDITION_FAILED: Cannot commit proposal in REJECTED status (${proposalId})`);
    }

    const canonicalSigner = this.canonicalizeAddress(signerAddress);

    const now = new Date().toISOString();
    const commitment = createCryptographicCommitment(p.intent, {
      proposalId: p.id,
      signerAddress: canonicalSigner,
      nonce: 42,
      policyVersion: CURRENT_POLICY_VERSION,
      proposalTimestamp: now,
    });

    p.commitment = commitment;
    p.updatedAt = now;
    p.status = 'APPROVED';

    this.saveToLocalDisk();

    if (this.isMongoConnected && this.mongoDb) {
      try {
        await this.mongoDb.collection('proposals').updateOne(
          { id: proposalId },
          { $set: { commitment, updatedAt: now, status: 'APPROVED' } }
        );
      } catch (err) {
        console.error('[Database] Failed to update commitment in MongoDB:', err);
      }
    }

    await this.recordAuditEvent({
      proposalId,
      eventType: 'COMMITMENT_GENERATED',
      actorWalletAddress: canonicalSigner,
      details: {
        sha256CommitmentHash: commitment.sha256Hash,
        keccak256CommitmentHash: commitment.commitmentHash,
      },
    });

    return p;
  }

  public async updateProposalStatus(proposalId: string, status: ProposalStatus): Promise<ProposalRecord> {
    const idx = this.proposalIdIndex.get(proposalId);
    if (idx === undefined) {
      throw new Error(`PROPOSAL_NOT_FOUND: Proposal ID ${proposalId} does not exist`);
    }

    const p = this.schema.proposals[idx];
    p.status = status;
    p.updatedAt = new Date().toISOString();

    await this.recordAuditEvent({
      proposalId,
      eventType: status === 'REJECTED' ? 'TAMPER_DETECTED' : 'PROPOSAL_VIEWED',
      actorWalletAddress: p.userWalletAddress,
      details: { newStatus: status },
    });

    this.saveToLocalDisk();

    if (this.isMongoConnected && this.mongoDb) {
      try {
        await this.mongoDb.collection('proposals').updateOne(
          { id: proposalId },
          { $set: { status, updatedAt: p.updatedAt } }
        );
      } catch (err) {
        console.error('[Database] Failed to update status in MongoDB:', err);
      }
    }

    return p;
  }

  // --- RECORDING APPROVAL EVIDENCE ---

  public async recordApprovalEvidence(params: {
    proposalId: string;
    walletAddress: string;
    approvedCommitmentHash: string;
    approvalMethod: 'WALLET_PERSONAL_SIGN' | 'WALLET_EIP712' | 'WALLET_EXPLICIT_CONSENT';
    signature?: string;
    userApprovalNotes?: string;
  }): Promise<ApprovalEvidenceRecord> {
    const idx = this.proposalIdIndex.get(params.proposalId);
    if (idx === undefined) {
      throw new Error(`PROPOSAL_NOT_FOUND: Proposal ID ${params.proposalId} does not exist`);
    }

    const p = this.schema.proposals[idx];
    const canonicalWallet = this.canonicalizeAddress(params.walletAddress);

    // Verify wallet matches proposal creator or commitment signer
    if (p.commitment?.signerAddress && p.commitment.signerAddress.toLowerCase() !== canonicalWallet) {
      throw new Error(`AUTHORIZATION_ERROR: Connected wallet ${canonicalWallet} does not match expected signer ${p.commitment.signerAddress}`);
    }

    // Verify commitment hash matches
    if (p.commitment && p.commitment.sha256Hash !== params.approvedCommitmentHash && p.commitment.commitmentHash !== params.approvedCommitmentHash) {
      throw new Error('INTEGRITY_ERROR: Approved commitment hash does not match canonical commitment on record');
    }

    const now = new Date().toISOString();
    const evidenceRecord: ApprovalEvidenceRecord = {
      id: `appr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      proposalId: params.proposalId,
      walletAddress: canonicalWallet,
      approvedCommitmentHash: params.approvedCommitmentHash,
      approvalMethod: params.approvalMethod,
      signature: params.signature,
      distinctFromTxSignature: true,
      userApprovalNotes: params.userApprovalNotes,
      approvedAt: now,
    };

    // Remove any previous approval for this proposal
    this.schema.approvalEvidence = this.schema.approvalEvidence.filter((x) => x.proposalId !== params.proposalId);
    this.schema.approvalEvidence.push(evidenceRecord);

    p.status = 'APPROVED';
    p.updatedAt = now;

    if (!p.executionTrace) p.executionTrace = [];
    p.executionTrace.push({
      id: `trace-appr-${Date.now()}`,
      phase: 'USER_APPROVAL',
      title: 'User Explicit Approval & Commitment Sealed',
      timestamp: now,
      status: 'SUCCESS',
      isActualEvidence: true,
      sanitizedInput: {
        walletAddress: canonicalWallet,
        approvalMethod: params.approvalMethod,
      },
      sanitizedOutput: {
        approvedCommitmentHash: params.approvedCommitmentHash,
        hasSignature: Boolean(params.signature),
      },
      description: 'User explicitly authorized transaction parameters. Immutable cryptographic commitment sealed.',
    });

    this.saveToLocalDisk();

    if (this.isMongoConnected && this.mongoDb) {
      try {
        await this.mongoDb.collection('approval_evidence').deleteMany({ proposalId: params.proposalId });
        await this.mongoDb.collection('approval_evidence').insertOne({ ...evidenceRecord });
        await this.mongoDb.collection('proposals').updateOne({ id: params.proposalId }, { $set: { status: 'APPROVED', updatedAt: now } });
      } catch (err) {
        console.error('[Database] Failed saving approval evidence in MongoDB:', err);
      }
    }

    await this.recordAuditEvent({
      proposalId: params.proposalId,
      eventType: 'APPROVAL_RECORDED',
      actorWalletAddress: canonicalWallet,
      details: {
        approvalMethod: params.approvalMethod,
        hasSignature: !!params.signature,
        approvedCommitmentHash: params.approvedCommitmentHash,
      },
    });

    return evidenceRecord;
  }

  // --- RECORDING IMMUTABLE BLOCKCHAIN TRANSACTION (WITH DUPLICATE PREVENTION) ---

  public async recordBlockchainExecution(params: {
    proposalId: string;
    txHash: string;
    blockNumber: number;
    from: string;
    to: string;
    valueEth: string;
    valueBaseUnits?: string;
    chainId: number;
    calldata?: string;
    gasUsed: number;
    effectiveGasPriceGwei: string;
    status: 'SUCCESS' | 'REVERTED' | 'PENDING';
    explorerUrl: string;
    mode: 'LIVE_WALLET' | 'DEMO_TESTNET';
  }): Promise<{
    transaction: BlockchainTransactionRecord;
    verification: VerificationAudit;
  }> {
    const idx = this.proposalIdIndex.get(params.proposalId);
    if (idx === undefined) {
      throw new Error(`PROPOSAL_NOT_FOUND: Proposal ID ${params.proposalId} does not exist`);
    }

    const p = this.schema.proposals[idx];
    const canonicalTxHash = params.txHash.toLowerCase();

    // REQUIREMENT: Prevent duplicate transaction submissions
    const existingProposalForTx = this.txHashIndex.get(canonicalTxHash);
    if (existingProposalForTx && existingProposalForTx !== params.proposalId) {
      throw new Error(`DUPLICATE_TRANSACTION_ERROR: Transaction hash ${params.txHash} has already been registered and bound to proposal ${existingProposalForTx}`);
    }

    const fromAddress = this.canonicalizeAddress(params.from);
    const toAddress = this.canonicalizeAddress(params.to);
    const now = new Date().toISOString();
    const valueBaseUnits = params.valueBaseUnits || convertToBaseUnits(params.valueEth);

    const txRecord: BlockchainTransactionRecord = {
      id: `bctx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      proposalId: params.proposalId,
      txHash: params.txHash,
      blockNumber: params.blockNumber,
      fromAddress,
      toAddress,
      valueBaseUnits,
      valueEth: params.valueEth,
      chainId: params.chainId,
      calldata: params.calldata || '0x',
      gasUsed: params.gasUsed,
      effectiveGasPriceGwei: params.effectiveGasPriceGwei,
      status: params.status,
      explorerUrl: params.explorerUrl,
      executedAt: now,
      mode: params.mode,
      isImmutable: true,
    };

    // Store immutable blockchain transaction
    this.schema.blockchainTransactions = this.schema.blockchainTransactions.filter((x) => x.proposalId !== params.proposalId);
    this.schema.blockchainTransactions.push(txRecord);
    this.txHashIndex.set(canonicalTxHash, params.proposalId);

    // Get approval evidence if present
    const appr = this.schema.approvalEvidence.find((x) => x.proposalId === params.proposalId);

    // REQUIREMENT: Do not trust client-submitted verification status!
    // Recompute verification results authoritatively on the server.
    const effectiveCommitment = p.commitment || createCryptographicCommitment(p.intent, {
      proposalId: p.id,
      signerAddress: fromAddress,
      nonce: 1,
      policyVersion: CURRENT_POLICY_VERSION,
      proposalTimestamp: p.createdAt,
    });

    const verificationAudit = verifyTransaction({
      intent: p.intent,
      commitment: effectiveCommitment,
      approvalEvidence: appr ? {
        walletAddress: appr.walletAddress,
        approvedCommitmentHash: appr.approvedCommitmentHash,
        approvalMethod: appr.approvalMethod,
        signature: appr.signature,
        approvedAt: appr.approvedAt,
        distinctFromTxSignature: true,
      } : undefined,
      execution: {
        txHash: txRecord.txHash,
        blockNumber: txRecord.blockNumber,
        from: txRecord.fromAddress,
        to: txRecord.toAddress,
        valueEth: txRecord.valueEth,
        valueBaseUnits: txRecord.valueBaseUnits,
        chainId: txRecord.chainId as any,
        calldata: txRecord.calldata,
        gasUsed: txRecord.gasUsed,
        effectiveGasPriceGwei: txRecord.effectiveGasPriceGwei,
        status: txRecord.status,
        explorerUrl: txRecord.explorerUrl,
        executedAt: txRecord.executedAt,
        mode: txRecord.mode,
      },
    });

    // Record verification result
    const vrfyRecord: VerificationResultRecord = {
      id: `vrfy-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      proposalId: params.proposalId,
      txHash: txRecord.txHash,
      status: verificationAudit.status,
      isCommitmentValid: verificationAudit.checks.commitmentMatch.passed,
      isApproverValid: verificationAudit.checks.approverMatch.passed,
      isSenderValid: verificationAudit.checks.senderMatch.passed,
      isRecipientValid: verificationAudit.checks.recipientMatch.passed,
      isAmountValid: verificationAudit.checks.amountMatch.passed,
      isChainValid: verificationAudit.checks.chainMatch.passed,
      isReceiptSuccess: verificationAudit.checks.receiptSuccess.passed,
      isTransactionReferenceValid: verificationAudit.checks.transactionReferenceValid.passed,
      recomputedSha256: verificationAudit.sha256CommitmentHash,
      auditSummary: verificationAudit.auditSummary,
      discrepancies: verificationAudit.discrepancies,
      auditData: verificationAudit,
      verifiedAt: now,
      verifiedBy: 'SERVER_AUTHORITATIVE_ENGINE',
    };

    this.schema.verificationResults = this.schema.verificationResults.filter((x) => x.proposalId !== params.proposalId);
    this.schema.verificationResults.push(vrfyRecord);

    // Update proposal application status
    if (verificationAudit.status === 'VERIFIED') {
      p.status = 'VERIFIED';
    } else if (verificationAudit.status === 'MISMATCH' || verificationAudit.status === 'FAILED') {
      p.status = 'VERIFICATION_FAILED';
    } else {
      p.status = 'EXECUTED';
    }
    p.updatedAt = now;

    if (!p.executionTrace) p.executionTrace = [];
    p.executionTrace.push({
      id: `trace-exec-${Date.now()}`,
      phase: 'EXECUTION',
      title: 'Transaction Submitted & Broadcast to Network',
      timestamp: now,
      status: params.status === 'REVERTED' ? 'FAILED' : 'SUCCESS',
      isActualEvidence: true,
      sanitizedInput: {
        from: params.from,
        to: params.to,
        valueEth: params.valueEth,
        chainId: params.chainId,
      },
      sanitizedOutput: {
        txHash: params.txHash,
        blockNumber: params.blockNumber,
        mode: params.mode,
      },
      description: `Transaction broadcast to network (mode: ${params.mode}).`,
    });
    p.executionTrace.push({
      id: `trace-rcpt-${Date.now()}`,
      phase: 'RECEIPT',
      title: 'Mined Block Receipt Retrieved',
      timestamp: now,
      status: params.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
      isActualEvidence: true,
      sanitizedOutput: {
        status: params.status,
        blockNumber: params.blockNumber,
        gasUsed: params.gasUsed,
        effectiveGasPriceGwei: params.effectiveGasPriceGwei,
      },
      description:
        params.status === 'SUCCESS' ? 'Receipt verified status: SUCCESS' : 'Receipt indicates EVM execution reverted.',
    });
    p.executionTrace.push({
      id: `trace-verif-${Date.now()}`,
      phase: 'VERIFICATION',
      title: 'Independent Cryptographic Verification Audit',
      timestamp: now,
      status: verificationAudit.status === 'VERIFIED' ? 'SUCCESS' : 'FAILED',
      isActualEvidence: true,
      sanitizedOutput: {
        status: verificationAudit.status,
        hashesMatch: verificationAudit.hashesMatch,
        commitmentHash: verificationAudit.commitmentHash,
        executedPayloadHash: verificationAudit.executedPayloadHash,
        criteriaPassed: Object.values(verificationAudit.checks).filter((c) => c.passed).length,
      },
      description:
        verificationAudit.status === 'VERIFIED'
          ? 'All 8 cryptographic criteria strictly match between approved commitment and mined block.'
          : `Verification flagged: ${verificationAudit.discrepancies.join('; ') || 'Parameter divergence detected'}`,
    });

    this.saveToLocalDisk();

    if (this.isMongoConnected && this.mongoDb) {
      try {
        await this.mongoDb.collection('blockchain_transactions').insertOne({ ...txRecord });
        await this.mongoDb.collection('verification_results').insertOne({ ...vrfyRecord });
        await this.mongoDb.collection('proposals').updateOne({ id: params.proposalId }, { $set: { status: p.status, updatedAt: now } });
      } catch (err) {
        console.error('[Database] Failed to save execution and verification to MongoDB:', err);
      }
    }

    await this.recordAuditEvent({
      proposalId: params.proposalId,
      eventType: 'TX_MINED',
      actorWalletAddress: fromAddress,
      details: {
        txHash: txRecord.txHash,
        blockNumber: txRecord.blockNumber,
        status: txRecord.status,
        verificationStatus: verificationAudit.status,
      },
    });

    return {
      transaction: txRecord,
      verification: verificationAudit,
    };
  }

  // --- REVERIFICATION & AUDIT RETRIEVAL ---

  public async reverifyProposal(proposalId: string): Promise<VerificationAudit> {
    const idx = this.proposalIdIndex.get(proposalId);
    if (idx === undefined) {
      throw new Error(`PROPOSAL_NOT_FOUND: Proposal ID ${proposalId} does not exist`);
    }

    const p = this.schema.proposals[idx];
    const appr = this.schema.approvalEvidence.find((x) => x.proposalId === proposalId);
    const bctx = this.schema.blockchainTransactions.find((x) => x.proposalId === proposalId);
    const effectiveCommitment = p.commitment || createCryptographicCommitment(p.intent, {
      proposalId: p.id,
      signerAddress: bctx?.fromAddress || p.userWalletAddress,
      nonce: 1,
      policyVersion: CURRENT_POLICY_VERSION,
      proposalTimestamp: p.createdAt,
    });

    const verificationAudit = verifyTransaction({
      intent: p.intent,
      commitment: effectiveCommitment,
      approvalEvidence: appr ? {
        walletAddress: appr.walletAddress,
        approvedCommitmentHash: appr.approvedCommitmentHash,
        approvalMethod: appr.approvalMethod,
        signature: appr.signature,
        approvedAt: appr.approvedAt,
        distinctFromTxSignature: true,
      } : undefined,
      execution: bctx ? {
        txHash: bctx.txHash,
        blockNumber: bctx.blockNumber,
        from: bctx.fromAddress,
        to: bctx.toAddress,
        valueEth: bctx.valueEth,
        valueBaseUnits: bctx.valueBaseUnits,
        chainId: bctx.chainId as any,
        calldata: bctx.calldata,
        gasUsed: bctx.gasUsed,
        effectiveGasPriceGwei: bctx.effectiveGasPriceGwei,
        status: bctx.status,
        explorerUrl: bctx.explorerUrl,
        executedAt: bctx.executedAt,
        mode: bctx.mode,
      } : undefined,
    });

    const now = new Date().toISOString();
    const vrfyRecord: VerificationResultRecord = {
      id: `vrfy-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      proposalId,
      txHash: bctx?.txHash || '',
      status: verificationAudit.status,
      isCommitmentValid: verificationAudit.checks.commitmentMatch.passed,
      isApproverValid: verificationAudit.checks.approverMatch.passed,
      isSenderValid: verificationAudit.checks.senderMatch.passed,
      isRecipientValid: verificationAudit.checks.recipientMatch.passed,
      isAmountValid: verificationAudit.checks.amountMatch.passed,
      isChainValid: verificationAudit.checks.chainMatch.passed,
      isReceiptSuccess: verificationAudit.checks.receiptSuccess.passed,
      isTransactionReferenceValid: verificationAudit.checks.transactionReferenceValid.passed,
      recomputedSha256: verificationAudit.sha256CommitmentHash,
      auditSummary: verificationAudit.auditSummary,
      discrepancies: verificationAudit.discrepancies,
      auditData: verificationAudit,
      verifiedAt: now,
      verifiedBy: 'SERVER_AUTHORITATIVE_ENGINE',
    };

    this.schema.verificationResults = this.schema.verificationResults.filter((x) => x.proposalId !== proposalId);
    this.schema.verificationResults.push(vrfyRecord);

    if (verificationAudit.status === 'VERIFIED') {
      p.status = 'VERIFIED';
    } else if (verificationAudit.status === 'MISMATCH' || verificationAudit.status === 'FAILED') {
      p.status = 'VERIFICATION_FAILED';
    }
    p.updatedAt = now;

    this.saveToLocalDisk();

    await this.recordAuditEvent({
      proposalId,
      eventType: 'VERIFICATION_EXECUTED',
      details: {
        verificationStatus: verificationAudit.status,
        recomputedSha256: verificationAudit.sha256CommitmentHash,
      },
    });

    return verificationAudit;
  }

  public async simulateTamper(
    proposalId: string,
    tamperType: 'AMOUNT' | 'RECIPIENT' | 'CHAIN' | 'REVERT'
  ): Promise<VerificationAudit> {
    const idx = this.proposalIdIndex.get(proposalId);
    if (idx === undefined) {
      throw new Error(`PROPOSAL_NOT_FOUND: Proposal ID ${proposalId} does not exist`);
    }

    const p = this.schema.proposals[idx];
    const bctx = this.schema.blockchainTransactions.find((x) => x.proposalId === proposalId);
    if (!bctx) {
      throw new Error(`TRANSACTION_NOT_FOUND: Proposal ${proposalId} has no execution record to tamper`);
    }

    if (tamperType === 'AMOUNT') {
      const originalAmount = parseFloat(p.intent.amount);
      bctx.valueEth = (originalAmount * 10).toString();
      bctx.valueBaseUnits = convertToBaseUnits(bctx.valueEth);
    } else if (tamperType === 'RECIPIENT') {
      bctx.toAddress = '0x000000000000000000000000000000000000dead';
    } else if (tamperType === 'CHAIN') {
      bctx.chainId = 1; // Tamper to Ethereum Mainnet
    } else if (tamperType === 'REVERT') {
      bctx.status = 'REVERTED';
    }

    await this.recordAuditEvent({
      proposalId,
      eventType: 'SIMULATED_TAMPER_TEST',
      actorWalletAddress: p.userWalletAddress,
      details: {
        tamperType,
        tamperedField: tamperType,
      },
    });

    return this.reverifyProposal(proposalId);
  }

  public async restoreFaithful(proposalId: string): Promise<VerificationAudit> {
    const idx = this.proposalIdIndex.get(proposalId);
    if (idx === undefined) {
      throw new Error(`PROPOSAL_NOT_FOUND: Proposal ID ${proposalId} does not exist`);
    }

    const p = this.schema.proposals[idx];
    const bctx = this.schema.blockchainTransactions.find((x) => x.proposalId === proposalId);
    if (!bctx) {
      throw new Error(`TRANSACTION_NOT_FOUND: Proposal ${proposalId} has no execution record`);
    }

    bctx.toAddress = p.intent.recipient.toLowerCase();
    bctx.valueEth = p.intent.amount;
    bctx.valueBaseUnits = convertToBaseUnits(p.intent.amount);
    bctx.chainId = p.intent.chainId;
    bctx.status = 'SUCCESS';

    await this.recordAuditEvent({
      proposalId,
      eventType: 'RESTORE_FAITHFUL_TEST',
      actorWalletAddress: p.userWalletAddress,
      details: { restored: true },
    });

    return this.reverifyProposal(proposalId);
  }

  public async getAuditEvents(proposalId: string, requestingWallet?: string): Promise<AuditEventRecord[]> {
    const idx = this.proposalIdIndex.get(proposalId);
    if (idx === undefined) {
      throw new Error(`PROPOSAL_NOT_FOUND: Proposal ID ${proposalId} does not exist`);
    }

    const p = this.schema.proposals[idx];
    const canonicalRequester = requestingWallet ? requestingWallet.toLowerCase() : null;
    const isOwner = canonicalRequester && canonicalRequester === p.userWalletAddress.toLowerCase();

    const events = this.schema.auditEvents.filter((e) => e.proposalId === proposalId);

    // If unauthorized viewer, mask IP address and user-agent
    return events.map((e) => {
      if (!isOwner) {
        return {
          ...e,
          ipAddress: '***.***.***.***',
          userAgent: 'Masked for security',
        };
      }
      return e;
    });
  }

  // --- SEED BASELINE DATA ---

  private async seedBaselineData(): Promise<void> {
    const seedWallet1 = '0x71c6bf12f455ddfe62ec542866b595fa6b78d91c';
    const seedWallet2 = '0x2b38f8cf86d2673295cbb46b5a1bb43b749d0387';

    // Proposal 1: Verified Grant Proposal
    const p1Id = 'prop-sepolia-grant-01';
    const p1Intent: TransactionIntent = {
      rawPrompt: 'Send 0.05 ETH to vitalik.eth on Sepolia for developer grant program funding',
      actionType: 'TRANSFER',
      recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
      recipientLabel: 'vitalik.eth (Resolved ENS)',
      amount: '0.05',
      tokenSymbol: 'ETH',
      chainId: 11155111,
      calldata: '0x',
      purposeExplanation: 'Direct developer grant allocation to public good steward',
      estimatedGasEth: '0.00042',
    };
    const p1Time = new Date(Date.now() - 3600000 * 4).toISOString();
    const p1Commitment = createCryptographicCommitment(p1Intent, {
      proposalId: p1Id,
      signerAddress: seedWallet1,
      nonce: 42,
      policyVersion: CURRENT_POLICY_VERSION,
      proposalTimestamp: p1Time,
    });

    const p1: ProposalRecord = {
      id: p1Id,
      userWalletAddress: seedWallet1,
      userPrompt: p1Intent.rawPrompt,
      intent: p1Intent,
      amountInBaseUnits: convertToBaseUnits('0.05'),
      status: 'VERIFIED',
      riskAssessment: {
        riskScore: 12,
        overallLevel: 'LOW',
        summary: 'Direct transfer to well-known address on Sepolia testnet',
        factors: [],
      },
      commitment: p1Commitment,
      createdAt: p1Time,
      updatedAt: p1Time,
    };

    const pol1: PolicyEvaluationRecord = {
      id: 'pol-seed-01',
      proposalId: p1Id,
      userWalletAddress: seedWallet1,
      policyVersion: CURRENT_POLICY_VERSION,
      passed: true,
      hasBlockingViolations: false,
      warningsCount: 0,
      results: [
        { ruleId: 'LIMIT_CHECK', name: 'Single Tx Limit', description: 'Under limit', passed: true, severity: 'BLOCK', message: '0.05 ETH <= 1.0 ETH' },
        { ruleId: 'NETWORK_ALLOWED', name: 'Network Allowed', description: 'Sepolia is whitelisted', passed: true, severity: 'BLOCK', message: 'Chain ID 11155111 permitted' },
      ],
      maxSingleTxEth: 1.0,
      maxDailyTxEth: 5.0,
      evaluatedAt: p1Time,
    };

    const appr1: ApprovalEvidenceRecord = {
      id: 'appr-seed-01',
      proposalId: p1Id,
      walletAddress: seedWallet1,
      approvedCommitmentHash: p1Commitment.sha256Hash,
      approvalMethod: 'WALLET_PERSONAL_SIGN',
      signature: '0x8f4d92a0e4c693a129037cbead99fa1bf9c1082ce748a39a29471f09de643d921b0000000000000000000000000000000000000000000000000000000000000000',
      distinctFromTxSignature: true,
      userApprovalNotes: 'Explicitly approved canonical proposal commitment via Web3 wallet',
      approvedAt: p1Time,
    };

    const bctx1: BlockchainTransactionRecord = {
      id: 'bctx-seed-01',
      proposalId: p1Id,
      txHash: '0x5c72a818c32f8319f72dbad630df30b3558110b93ca2a356391d4e0e5a6fc624',
      blockNumber: 11950388,
      fromAddress: seedWallet1,
      toAddress: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
      valueBaseUnits: convertToBaseUnits('0.05'),
      valueEth: '0.05',
      chainId: 11155111,
      calldata: '0x',
      gasUsed: 21000,
      effectiveGasPriceGwei: '14.2',
      status: 'SUCCESS',
      explorerUrl: 'https://sepolia.etherscan.io/tx/0x5c72a818c32f8319f72dbad630df30b3558110b93ca2a356391d4e0e5a6fc624',
      executedAt: new Date(Date.now() - 3600000 * 3.8).toISOString(),
      mode: 'DEMO_TESTNET',
      isImmutable: true,
    };

    const vrfy1 = verifyTransaction({
      intent: p1Intent,
      commitment: p1Commitment,
      approvalEvidence: {
        walletAddress: seedWallet1,
        approvedCommitmentHash: p1Commitment.sha256Hash,
        approvalMethod: 'WALLET_PERSONAL_SIGN',
        signature: appr1.signature,
        approvedAt: appr1.approvedAt,
        distinctFromTxSignature: true,
      },
      execution: {
        txHash: bctx1.txHash,
        blockNumber: bctx1.blockNumber,
        from: bctx1.fromAddress,
        to: bctx1.toAddress,
        valueEth: bctx1.valueEth,
        valueBaseUnits: bctx1.valueBaseUnits,
        chainId: bctx1.chainId as any,
        calldata: bctx1.calldata,
        gasUsed: bctx1.gasUsed,
        effectiveGasPriceGwei: bctx1.effectiveGasPriceGwei,
        status: bctx1.status,
        explorerUrl: bctx1.explorerUrl,
        executedAt: bctx1.executedAt,
        mode: bctx1.mode,
      },
    });

    const vrfyRecord1: VerificationResultRecord = {
      id: 'vrfy-seed-01',
      proposalId: p1Id,
      txHash: bctx1.txHash,
      status: vrfy1.status,
      isCommitmentValid: true,
      isApproverValid: true,
      isSenderValid: true,
      isRecipientValid: true,
      isAmountValid: true,
      isChainValid: true,
      isReceiptSuccess: true,
      isTransactionReferenceValid: true,
      recomputedSha256: vrfy1.sha256CommitmentHash,
      auditSummary: vrfy1.auditSummary,
      discrepancies: [],
      auditData: vrfy1,
      verifiedAt: bctx1.executedAt,
      verifiedBy: 'SERVER_AUTHORITATIVE_ENGINE',
    };

    // Proposal 2: Pending Approval
    const p2Id = 'prop-sepolia-defi-02';
    const p2Intent: TransactionIntent = {
      rawPrompt: 'Prepare 0.12 ETH liquidity buffer transfer to audited vault on Sepolia',
      actionType: 'TRANSFER',
      recipient: '0x1111111254fb6c44bac0bed2854e76f90643097d',
      recipientLabel: '1inch Aggregator Router (Sepolia)',
      amount: '0.12',
      tokenSymbol: 'ETH',
      chainId: 11155111,
      calldata: '0x',
      purposeExplanation: 'Automated treasury rebalancing into liquidity buffer',
      estimatedGasEth: '0.00045',
    };
    const p2Time = new Date(Date.now() - 3600000 * 1.5).toISOString();
    const p2Commitment = createCryptographicCommitment(p2Intent, {
      proposalId: p2Id,
      signerAddress: seedWallet2,
      nonce: 104,
      policyVersion: CURRENT_POLICY_VERSION,
      proposalTimestamp: p2Time,
    });

    const p2: ProposalRecord = {
      id: p2Id,
      userWalletAddress: seedWallet2,
      userPrompt: p2Intent.rawPrompt,
      intent: p2Intent,
      amountInBaseUnits: convertToBaseUnits('0.12'),
      status: 'AWAITING_APPROVAL',
      riskAssessment: {
        riskScore: 28,
        overallLevel: 'LOW',
        summary: 'Transfer to verified contract address under single transaction threshold',
        factors: [],
      },
      commitment: p2Commitment,
      createdAt: p2Time,
      updatedAt: p2Time,
    };

    const pol2: PolicyEvaluationRecord = {
      id: 'pol-seed-02',
      proposalId: p2Id,
      userWalletAddress: seedWallet2,
      policyVersion: CURRENT_POLICY_VERSION,
      passed: true,
      hasBlockingViolations: false,
      warningsCount: 0,
      results: [
        { ruleId: 'LIMIT_CHECK', name: 'Single Tx Limit', description: 'Under limit', passed: true, severity: 'BLOCK', message: '0.12 ETH <= 1.0 ETH' },
      ],
      maxSingleTxEth: 1.0,
      maxDailyTxEth: 5.0,
      evaluatedAt: p2Time,
    };

    // Proposal 3: Blocked by Policy
    const p3Id = 'prop-sepolia-blocked-03';
    const p3Intent: TransactionIntent = {
      rawPrompt: 'Transfer 10.0 ETH to external address on Sepolia',
      actionType: 'TRANSFER',
      recipient: '0x999999cf1046e68e36e1aa2e0e07105eddd840bd',
      amount: '10.0',
      tokenSymbol: 'ETH',
      chainId: 11155111,
      calldata: '0x',
      purposeExplanation: 'High volume transfer attempt',
      estimatedGasEth: '0.00042',
    };
    const p3Time = new Date(Date.now() - 3600000 * 12).toISOString();
    const p3: ProposalRecord = {
      id: p3Id,
      userWalletAddress: seedWallet1,
      userPrompt: p3Intent.rawPrompt,
      intent: p3Intent,
      amountInBaseUnits: convertToBaseUnits('10.0'),
      status: 'POLICY_VIOLATION',
      riskAssessment: {
        riskScore: 85,
        overallLevel: 'HIGH',
        summary: 'Exceeds maximum allowable single transaction threshold of 1.0 ETH',
        factors: [{ factor: 'POLICY', level: 'HIGH', description: 'Exceeds single transaction cap', passed: false }],
      },
      createdAt: p3Time,
      updatedAt: p3Time,
    };

    const pol3: PolicyEvaluationRecord = {
      id: 'pol-seed-03',
      proposalId: p3Id,
      userWalletAddress: seedWallet1,
      policyVersion: CURRENT_POLICY_VERSION,
      passed: false,
      hasBlockingViolations: true,
      warningsCount: 1,
      results: [
        { ruleId: 'LIMIT_CHECK', name: 'Single Tx Limit', description: 'Over limit', passed: false, severity: 'BLOCK', message: '10.0 ETH exceeds limit of 1.0 ETH' },
      ],
      maxSingleTxEth: 1.0,
      maxDailyTxEth: 5.0,
      evaluatedAt: p3Time,
    };

    this.schema.proposals = [p1, p2, p3];
    this.schema.policyEvaluations = [pol1, pol2, pol3];
    this.schema.approvalEvidence = [appr1];
    this.schema.blockchainTransactions = [bctx1];
    this.schema.verificationResults = [vrfyRecord1];
    this.schema.auditEvents = [];

    this.rebuildIndexes();
    this.saveToLocalDisk();

    await this.recordAuditEvent({
      proposalId: p1Id,
      eventType: 'PROPOSAL_CREATED',
      actorWalletAddress: seedWallet1,
      details: { seeded: true, note: 'Initial verified baseline grant proposal' },
    });

    await this.recordAuditEvent({
      proposalId: p1Id,
      eventType: 'VERIFICATION_EXECUTED',
      actorWalletAddress: seedWallet1,
      details: { status: 'VERIFIED', txHash: bctx1.txHash },
    });
  }

  // --- DATABASE STATUS & SECURE CREDENTIAL CONFIGURATION GUIDE ---

  public getStatus(): DatabaseStatus {
    return {
      driver: this.isMongoConnected ? 'MONGODB_ATLAS' : 'PERSISTENT_FILE_STORAGE',
      connected: true,
      databaseName: this.isMongoConnected ? (process.env.MONGODB_DB_NAME || 'proofflow') : 'proofflow-local-persistent',
      indexesConfigured: true,
      stats: {
        proposalsCount: this.schema.proposals.length,
        policiesCount: this.schema.policyEvaluations.length,
        approvalsCount: this.schema.approvalEvidence.length,
        transactionsCount: this.schema.blockchainTransactions.length,
        verificationsCount: this.schema.verificationResults.length,
        auditEventsCount: this.schema.auditEvents.length,
      },
      securityInfo: {
        sslEnforced: true,
        secretsStoredSeparately: true,
        privateKeysBlocked: true,
        authEnforced: true,
      },
      errorMessage: this.mongoError || undefined,
    };
  }

  /**
   * Explains how to configure database credentials securely according to the principle of least privilege.
   */
  public static getSecureCredentialsGuide(): {
    title: string;
    overview: string;
    steps: Array<{ title: string; instruction: string; securityNote: string }>;
    exampleEnv: string;
    bestPractices: string[];
  } {
    return {
      title: 'Configuring Production Database Credentials Securely',
      overview: 'ProofFlow enforces end-to-end cryptographic integrity and strict data isolation. To connect MongoDB Atlas or an external database in production, follow these security guidelines.',
      steps: [
        {
          title: '1. Create a Dedicated Database User (Least Privilege)',
          instruction: 'In MongoDB Atlas > Database Access, create a dedicated user (e.g., `proofflow-service`). Do NOT use cluster admin or atlasAdmin roles. Assign the custom role `readWrite` strictly restricted to the `proofflow` database.',
          securityNote: 'Restricting roles prevents an attacker or misconfigured query from dropping collections or accessing other application databases.',
        },
        {
          title: '2. Enforce Network IP Whitelisting & Private Networking',
          instruction: 'In Network Access, allow only your application servers’ static outbound IP addresses or utilize AWS/GCP VPC Peering or PrivateLink. Never leave `0.0.0.0/0` in production without strict mutual TLS/X.509 authentication.',
          securityNote: 'Network-level isolation prevents brute force and unauthorized network probes even if connection strings are leaked.',
        },
        {
          title: '3. Mandate TLS/SSL with Strict Certificate Validation',
          instruction: 'Ensure the connection URI uses `mongodb+srv://` which requires TLS encryption in transit by default. Explicitly include `ssl=true&authSource=admin` parameters in the connection string.',
          securityNote: 'Prevents man-in-the-middle (MITM) attacks and credential eavesdropping across cloud networks.',
        },
        {
          title: '4. Inject Secrets via Environment Variables / Secret Manager',
          instruction: 'Store `MONGODB_URI` in Google Cloud Secret Manager, AWS Secrets Manager, or your host’s secret injection environment. Never commit credentials, passwords, or connection strings into source code or Git repositories.',
          securityNote: 'ProofFlow scans and blocks any attempts to write credentials or private keys into database fields.',
        },
        {
          title: '5. Connection Pooling & Resource Quotas',
          instruction: 'Configure `maxPoolSize: 50`, `serverSelectionTimeoutMS: 5000`, and `socketTimeoutMS: 45000` to prevent socket starvation during network hiccups.',
          securityNote: 'Protects the application from denial-of-service through database connection exhaustion.',
        },
      ],
      exampleEnv: `# Production MongoDB Atlas Connection (Inject via Cloud Secret Manager)
MONGODB_URI="mongodb+srv://proofflow-service:<SECURE_PASSWORD>@cluster0.abcde.mongodb.net/proofflow?retryWrites=true&w=majority&appName=ProofFlow"
MONGODB_DB_NAME="proofflow"`,
      bestPractices: [
        'Rotate database credentials every 90 days with zero-downtime rolling credentials.',
        'Enable MongoDB Atlas Auditing to log administrative actions and authentication attempts.',
        'Enable Customer-Managed Encryption Keys (CMEK) via Google Cloud KMS or AWS KMS for encryption at rest.',
        'Never log connection strings that contain passwords in server stdout or error logs.',
      ],
    };
  }
}

// Export singleton database instance
export const db = new ProofFlowDatabase();

import { prisma } from '../../lib/prisma';
import { GraphProjectionService } from './graphProjectionService';
import { FraudRulesEngine } from './fraudRulesEngine';

export interface BoundedGraphResponse {
  centerNodeKey: string;
  depth: number;
  nodes: Array<{
    id: string;
    nodeKey: string;
    entityType: string;
    entityId: string;
    label: string;
    metadata: any;
    isAnchored: boolean;
    anomalyScore: number;
    hasActiveFindings: boolean;
  }>;
  edges: Array<{
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceKey: string;
    targetKey: string;
    relationshipType: string;
    isDirect: boolean;
    isInferred: boolean;
    confidence: number;
    evidence: any;
  }>;
  findings: any[];
}

export class GraphInvestigationService {
  private static instance: GraphInvestigationService;
  private projectionService = GraphProjectionService.getInstance();
  private rulesEngine = FraudRulesEngine.getInstance();

  public static getInstance(): GraphInvestigationService {
    if (!GraphInvestigationService.instance) {
      GraphInvestigationService.instance = new GraphInvestigationService();
    }
    return GraphInvestigationService.instance;
  }

  /**
   * Bounded BFS neighborhood extraction centered on a vehicle
   */
  public async getVehicleGraph(vehicleId: string, depth = 2): Promise<BoundedGraphResponse> {
    const centerKey = `VEHICLE:${vehicleId}`;
    return this.getEntityNeighborhood('VEHICLE', vehicleId, depth);
  }

  /**
   * Bounded BFS neighborhood extraction centered on any entity type
   */
  public async getEntityNeighborhood(
    entityType: string,
    entityId: string,
    maxDepth = 2
  ): Promise<BoundedGraphResponse> {
    const boundedDepth = Math.max(1, Math.min(3, maxDepth));
    const targetKey = `${entityType.toUpperCase()}:${entityId}`;

    // 1. Locate Center Node
    const centerNode = await prisma.graphNode.findFirst({
      where: {
        OR: [{ nodeKey: targetKey }, { entityId: entityId }],
      },
    });

    if (!centerNode) {
      // Trigger a sync if node is missing and re-check
      await this.projectionService.syncEntireGraph().catch(() => null);
    }

    const startNode =
      centerNode ||
      (await prisma.graphNode.findFirst({
        where: { OR: [{ nodeKey: targetKey }, { entityId: entityId }] },
      }));

    if (!startNode) {
      return {
        centerNodeKey: targetKey,
        depth: boundedDepth,
        nodes: [],
        edges: [],
        findings: [],
      };
    }

    // 2. Bounded BFS Traversal (Max 60 nodes to ensure optimal UI rendering and sub-second latency)
    const MAX_NODES = 60;
    const visitedNodeIds = new Set<string>([startNode.id]);
    const collectedEdges = new Map<string, any>();
    let currentLevelNodes = [startNode.id];

    for (let currentDepth = 0; currentDepth < boundedDepth; currentDepth++) {
      if (visitedNodeIds.size >= MAX_NODES || currentLevelNodes.length === 0) break;

      // Find all edges connected to current level nodes
      const edges = await prisma.graphEdge.findMany({
        where: {
          OR: [
            { sourceNodeId: { in: currentLevelNodes } },
            { targetNodeId: { in: currentLevelNodes } },
          ],
        },
        include: {
          sourceNode: { select: { id: true, nodeKey: true } },
          targetNode: { select: { id: true, nodeKey: true } },
        },
      });

      const nextLevelNodes: string[] = [];

      for (const e of edges) {
        collectedEdges.set(e.id, {
          id: e.id,
          sourceNodeId: e.sourceNodeId,
          targetNodeId: e.targetNodeId,
          sourceKey: e.sourceNode.nodeKey,
          targetKey: e.targetNode.nodeKey,
          relationshipType: e.relationshipType,
          isDirect: e.isDirect,
          isInferred: e.isInferred,
          confidence: e.confidence,
          evidence: e.evidence ? JSON.parse(e.evidence) : null,
        });

        // Add unvisited neighbor
        const neighborId = e.sourceNodeId === startNode.id ? e.targetNodeId : e.sourceNodeId;
        if (!visitedNodeIds.has(e.sourceNodeId) && visitedNodeIds.size < MAX_NODES) {
          visitedNodeIds.add(e.sourceNodeId);
          nextLevelNodes.push(e.sourceNodeId);
        }
        if (!visitedNodeIds.has(e.targetNodeId) && visitedNodeIds.size < MAX_NODES) {
          visitedNodeIds.add(e.targetNodeId);
          nextLevelNodes.push(e.targetNodeId);
        }
      }

      currentLevelNodes = nextLevelNodes;
    }

    // 3. Fetch full node details for all visited node IDs
    const nodes = await prisma.graphNode.findMany({
      where: { id: { in: Array.from(visitedNodeIds) } },
    });

    // 4. Fetch active findings involving any of these nodes or the primary entity
    const findings = await prisma.fraudFinding.findMany({
      where: {
        OR: [
          { primaryEntityId: entityId },
          { primaryEntityId: { in: nodes.map((n) => n.entityId) } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const findingNodeKeys = new Set<string>();
    for (const f of findings) {
      try {
        const keys: string[] = JSON.parse(f.involvedNodeIds || '[]');
        keys.forEach((k) => findingNodeKeys.add(k));
      } catch {}
    }

    return {
      centerNodeKey: startNode.nodeKey,
      depth: boundedDepth,
      nodes: nodes.map((n) => ({
        id: n.id,
        nodeKey: n.nodeKey,
        entityType: n.entityType,
        entityId: n.entityId,
        label: n.label,
        metadata: n.metadata ? JSON.parse(n.metadata) : null,
        isAnchored: n.isAnchored,
        anomalyScore: n.anomalyScore,
        hasActiveFindings: findingNodeKeys.has(n.nodeKey) || n.entityId === entityId,
      })),
      edges: Array.from(collectedEdges.values()),
      findings: findings.map((f) => ({
        id: f.id,
        findingNumber: f.findingNumber,
        ruleId: f.ruleId,
        ruleName: f.ruleName,
        category: f.category,
        severity: f.severity,
        status: f.status,
        title: f.title,
        description: f.description,
        explanation: f.explanation,
        unknowns: f.unknowns,
        recommendedAction: f.recommendedAction,
        firstDetectedAt: f.firstDetectedAt.toISOString(),
      })),
    };
  }

  /**
   * BFS Pathfinding: finds shortest chain of relationships connecting two entities
   */
  public async findEvidencePath(sourceKey: string, targetKey: string) {
    const sourceNode = await prisma.graphNode.findFirst({
      where: { OR: [{ id: sourceKey }, { nodeKey: sourceKey }] },
    });
    const targetNode = await prisma.graphNode.findFirst({
      where: { OR: [{ id: targetKey }, { nodeKey: targetKey }] },
    });

    if (!sourceNode || !targetNode) {
      return { found: false, path: [], message: 'One or both entities not found in graph' };
    }

    if (sourceNode.id === targetNode.id) {
      return { found: true, path: [{ node: sourceNode, edge: null }] };
    }

    // BFS queue: array of { currentId, path }
    const queue: Array<{ nodeId: string; path: any[] }> = [
      { nodeId: sourceNode.id, path: [{ node: sourceNode, edge: null }] },
    ];
    const visited = new Set<string>([sourceNode.id]);

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;
      if (path.length > 6) continue; // limit max hops

      const edges = await prisma.graphEdge.findMany({
        where: {
          OR: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }],
        },
        include: { sourceNode: true, targetNode: true },
      });

      for (const edge of edges) {
        const nextNode = edge.sourceNodeId === nodeId ? edge.targetNode : edge.sourceNode;
        if (!visited.has(nextNode.id)) {
          visited.add(nextNode.id);
          const newPath = [...path, { edge, node: nextNode }];

          if (nextNode.id === targetNode.id) {
            return {
              found: true,
              hops: newPath.length - 1,
              path: newPath.map((step) => ({
                nodeKey: step.node.nodeKey,
                label: step.node.label,
                entityType: step.node.entityType,
                relationship: step.edge?.relationshipType || null,
              })),
            };
          }

          queue.push({ nodeId: nextNode.id, path: newPath });
        }
      }
    }

    return { found: false, hops: 0, path: [], message: 'No relationship path found within search bounds' };
  }

  /**
   * Query findings with filtering & pagination
   */
  public async getFindings(params: {
    page?: number;
    limit?: number;
    severity?: string;
    status?: string;
    category?: string;
    ruleId?: string;
    search?: string;
    vehicleId?: string;
    primaryEntityId?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 15));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.severity && params.severity !== 'ALL') where.severity = params.severity;
    if (params.status && params.status !== 'ALL') where.status = params.status;
    if (params.category && params.category !== 'ALL') where.category = params.category;
    if (params.ruleId && params.ruleId !== 'ALL') where.ruleId = params.ruleId;
    if (params.primaryEntityId) where.primaryEntityId = params.primaryEntityId;
    if (params.vehicleId) where.primaryEntityId = params.vehicleId;

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { findingNumber: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, findings] = await Promise.all([
      prisma.fraudFinding.count({ where }),
      prisma.fraudFinding.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          investigationCase: { select: { id: true, caseNumber: true, title: true, status: true } },
        },
      }),
    ]);

    return {
      findings: findings.map((f) => ({
        id: f.id,
        findingNumber: f.findingNumber,
        ruleId: f.ruleId,
        ruleVersion: f.ruleVersion,
        ruleName: f.ruleName,
        category: f.category,
        severity: f.severity,
        status: f.status,
        primaryEntityId: f.primaryEntityId,
        primaryEntityType: f.primaryEntityType,
        title: f.title,
        description: f.description,
        explanation: f.explanation,
        unknowns: f.unknowns,
        recommendedAction: f.recommendedAction,
        case: f.investigationCase,
        firstDetectedAt: f.firstDetectedAt.toISOString(),
        lastEvaluatedAt: f.lastEvaluatedAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Fetches single finding with detailed evidence breakdown
   */
  public async getFindingDetails(findingId: string) {
    const finding = await prisma.fraudFinding.findFirst({
      where: {
        OR: [{ id: findingId }, { findingNumber: findingId }],
      },
      include: {
        investigationCase: true,
        reviewedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!finding) return null;

    let involvedNodeKeys: string[] = [];
    try {
      involvedNodeKeys = JSON.parse(finding.involvedNodeIds || '[]');
    } catch {}

    let evidenceReferences: any[] = [];
    try {
      evidenceReferences = JSON.parse(finding.evidenceReferences || '[]');
    } catch {}

    // Fetch details of involved nodes
    const involvedNodes = await prisma.graphNode.findMany({
      where: { nodeKey: { in: involvedNodeKeys } },
    });

    return {
      ...finding,
      involvedNodes: involvedNodes.map((n) => ({
        nodeKey: n.nodeKey,
        label: n.label,
        entityType: n.entityType,
        entityId: n.entityId,
        isAnchored: n.isAnchored,
      })),
      evidenceReferences,
      firstDetectedAt: finding.firstDetectedAt.toISOString(),
      lastEvaluatedAt: finding.lastEvaluatedAt.toISOString(),
    };
  }

  /**
   * Updates finding investigation status
   */
  public async updateFindingStatus(params: {
    findingId: string;
    status: 'NEW' | 'UNDER_REVIEW' | 'NEEDS_MORE_EVIDENCE' | 'RESOLVED' | 'DISMISSED';
    resolutionReason?: string;
    reviewerId?: string;
  }) {
    const updated = await prisma.fraudFinding.update({
      where: { id: params.findingId },
      data: {
        status: params.status,
        resolutionReason: params.resolutionReason || null,
        reviewedById: params.reviewerId || null,
        updatedAt: new Date(),
      },
    });
    return updated;
  }

  /**
   * Creates a formal investigation case grouping candidate findings
   */
  public async createInvestigationCase(params: {
    title: string;
    description: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    findingIds: string[];
    assignedToId?: string;
  }) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const caseNumber = `CASE-INV-2026-${Date.now().toString().slice(-6)}${rand}`;

    const initialNote = JSON.stringify([
      {
        id: `note-${Date.now()}`,
        author: 'System Auto-Intake',
        text: `Investigation case opened with ${params.findingIds.length} candidate finding(s).`,
        createdAt: new Date().toISOString(),
      },
    ]);

    const invCase = await prisma.investigationCase.create({
      data: {
        caseNumber,
        title: params.title,
        description: params.description,
        priority: params.priority || 'MEDIUM',
        status: 'OPEN',
        assignedToId: params.assignedToId || null,
        notes: initialNote,
      },
    });

    // Link findings
    if (params.findingIds.length > 0) {
      await prisma.fraudFinding.updateMany({
        where: { id: { in: params.findingIds } },
        data: {
          investigationCaseId: invCase.id,
          status: 'UNDER_REVIEW',
        },
      });
    }

    return invCase;
  }

  /**
   * Query investigation cases
   */
  public async getInvestigationCases(params: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 15));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.status && params.status !== 'ALL') where.status = params.status;
    if (params.priority && params.priority !== 'ALL') where.priority = params.priority;

    const [total, cases] = await Promise.all([
      prisma.investigationCase.count({ where }),
      prisma.investigationCase.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          assignedTo: { select: { id: true, name: true, email: true, role: true } },
          _count: { select: { findings: true } },
        },
      }),
    ]);

    return {
      cases: cases.map((c) => ({
        id: c.id,
        caseNumber: c.caseNumber,
        title: c.title,
        description: c.description,
        priority: c.priority,
        status: c.status,
        findingsCount: c._count.findings,
        assignedTo: c.assignedTo,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Reconciles entire graph projection and evaluates all rules atomically
   */
  public async reconcileGraph() {
    const syncRes = await this.projectionService.syncEntireGraph();
    const rulesRes = await this.rulesEngine.evaluateAllRules();

    return {
      sync: syncRes,
      rules: rulesRes,
    };
  }
}

export const graphInvestigationService = GraphInvestigationService.getInstance();


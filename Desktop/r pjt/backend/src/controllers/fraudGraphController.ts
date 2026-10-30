import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';
import { GraphInvestigationService } from '../services/graph/graphInvestigationService';
import { GraphProjectionService } from '../services/graph/graphProjectionService';
import { prisma } from '../lib/prisma';

const service = GraphInvestigationService.getInstance();
const projectionService = GraphProjectionService.getInstance();

export async function getGraphOverviewHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const stats = await projectionService.getGraphStats();
    const [totalFindings, highSeverity, openFindings, totalCases] = await Promise.all([
      prisma.fraudFinding.count(),
      prisma.fraudFinding.count({ where: { severity: 'HIGH' } }),
      prisma.fraudFinding.count({ where: { status: { in: ['NEW', 'UNDER_REVIEW'] } } }),
      prisma.investigationCase.count(),
    ]);

    const findingsByCategory = await prisma.fraudFinding.groupBy({
      by: ['category'],
      _count: true,
    });

    const findingsBySeverity = await prisma.fraudFinding.groupBy({
      by: ['severity'],
      _count: true,
    });

    return res.status(200).json({
      success: true,
      data: {
        totalNodes: stats.totalNodes,
        totalEdges: stats.totalEdges,
        lastSyncedAt: stats.lastSyncedAt,
        status: stats.status,
        syncDurationMs: stats.syncDurationMs,
        nodeTypeDistribution: stats.nodeTypeDistribution,
        edgeTypeDistribution: stats.edgeTypeDistribution,
        graph: stats,
        findingsSummary: {
          totalFindings,
          highSeverity,
          openFindings,
          totalCases,
          byCategory: findingsByCategory.map((c) => ({ category: c.category, count: c._count })),
          bySeverity: findingsBySeverity.map((s) => ({ severity: s.severity, count: s._count })),
        },
      },
    });
  } catch (err: any) {
    console.error('getGraphOverviewHandler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to get graph overview' });
  }
}

export async function getVehicleGraphHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const vehicleId = req.params.vehicleId as string;
    const depth = req.query.depth ? parseInt(req.query.depth as string, 10) : 2;

    const graph = await service.getVehicleGraph(vehicleId, depth);
    return res.status(200).json({
      success: true,
      data: graph,
    });
  } catch (err: any) {
    console.error('getVehicleGraphHandler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to retrieve vehicle graph' });
  }
}

export async function getEntityNeighborhoodHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const entityType = req.params.entityType as string;
    const entityId = req.params.entityId as string;
    const depth = req.query.depth ? parseInt(req.query.depth as string, 10) : 2;

    const graph = await service.getEntityNeighborhood(entityType, entityId, depth);
    return res.status(200).json({
      success: true,
      data: graph,
    });
  } catch (err: any) {
    console.error('getEntityNeighborhoodHandler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to retrieve entity neighborhood' });
  }
}

export async function getFindingsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;
    const severity = req.query.severity as string | undefined;
    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;
    const ruleId = req.query.ruleId as string | undefined;
    const search = req.query.search as string | undefined;

    const data = await service.getFindings({
      page,
      limit,
      severity,
      status,
      category,
      ruleId,
      search,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err: any) {
    console.error('getFindingsHandler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to retrieve findings' });
  }
}

export async function getFindingDetailsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const findingId = req.params.findingId as string;
    const finding = await service.getFindingDetails(findingId);

    if (!finding) {
      return res.status(404).json({ success: false, error: `Finding '${findingId}' not found` });
    }

    return res.status(200).json({
      success: true,
      data: finding,
    });
  } catch (err: any) {
    console.error('getFindingDetailsHandler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to retrieve finding details' });
  }
}

const updateFindingSchema = z.object({
  status: z.enum(['NEW', 'UNDER_REVIEW', 'NEEDS_MORE_EVIDENCE', 'RESOLVED', 'DISMISSED']),
  resolutionReason: z.string().optional(),
});

export async function updateFindingHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const findingId = req.params.findingId as string;
    const parsed = updateFindingSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: parsed.error.issues });
    }

    const updated = await service.updateFindingStatus({
      findingId,
      status: parsed.data.status,
      resolutionReason: parsed.data.resolutionReason,
      reviewerId: req.user?.id,
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    console.error('updateFindingHandler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to update finding' });
  }
}

const createCaseSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(5),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  findingIds: z.array(z.string()).default([]),
  assignedToId: z.string().optional(),
});

export async function createInvestigationCaseHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = createCaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: parsed.error.issues });
    }

    const newCase = await service.createInvestigationCase({
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      findingIds: parsed.data.findingIds,
      assignedToId: parsed.data.assignedToId || req.user?.id,
    });

    return res.status(201).json({
      success: true,
      data: newCase,
    });
  } catch (err: any) {
    console.error('createInvestigationCaseHandler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to create investigation case' });
  }
}

export async function getInvestigationCasesHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;

    const data = await service.getInvestigationCases({
      page,
      limit,
      status,
      priority,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err: any) {
    console.error('getInvestigationCasesHandler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to retrieve investigation cases' });
  }
}

export async function reconcileGraphHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const result = await service.reconcileGraph();
    return res.status(200).json({
      success: true,
      data: result,
      message: 'Graph projection synchronized and fraud rules re-evaluated successfully',
    });
  } catch (err: any) {
    console.error('reconcileGraphHandler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to reconcile graph' });
  }
}

export async function findEvidencePathHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const source = req.query.source as string;
    const target = req.query.target as string;

    if (!source || !target) {
      return res.status(400).json({ success: false, error: 'Both source and target parameters are required' });
    }

    const path = await service.findEvidencePath(source, target);
    return res.status(200).json({
      success: true,
      data: path,
    });
  } catch (err: any) {
    console.error('findEvidencePathHandler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to find evidence path' });
  }
}

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { investigationOrchestrator } from '../services/agent/investigationOrchestrator';
import { toolRegistry } from '../services/agent/toolRegistry';
import { z } from 'zod';

const createInvestigationSchema = z.object({
  targetType: z.enum(['VEHICLE', 'FINDING', 'DOCUMENT', 'ENTITY']),
  targetId: z.string().min(1, 'targetId is required'),
  vehicleId: z.string().optional(),
  investigationType: z
    .enum(['ODOMETER_ROLLBACK', 'OWNERSHIP_IDENTITY', 'DOCUMENT_INTEGRITY', 'FRAUD_GRAPH', 'MULTI_SIGNAL', 'GENERAL'])
    .optional(),
  maxSteps: z.number().int().min(1).max(20).optional(),
  executionBudgetMs: z.number().int().min(1000).max(120000).optional(),
  caseId: z.string().optional(),
  waitForCompletion: z.boolean().optional(),
});

export async function createInvestigationHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const parseResult = createInvestigationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const run = await investigationOrchestrator.startInvestigation(
      parseResult.data,
      req.user.id,
      req.user.role
    );

    return res.status(201).json({
      success: true,
      data: run,
    });
  } catch (err: any) {
    console.error('createInvestigationHandler error:', err);
    if (err.message?.includes('Forbidden')) {
      return res.status(403).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err.message || 'Failed to start investigation' });
  }
}

export async function listInvestigationsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { vehicleId, status, limit, offset } = req.query;

    const result = await investigationOrchestrator.listInvestigations(req.user.id, req.user.role, {
      vehicleId: typeof vehicleId === 'string' ? vehicleId : undefined,
      status: typeof status === 'string' ? status : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('listInvestigationsHandler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to list investigations' });
  }
}

export async function getInvestigationHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const id = req.params.id as string;
    const run = await investigationOrchestrator.getInvestigation(id, req.user.id, req.user.role);

    return res.json({
      success: true,
      data: run,
    });
  } catch (err: any) {
    console.error('getInvestigationHandler error:', err);
    if (err.message?.includes('not found')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    if (err.message?.includes('Forbidden')) {
      return res.status(403).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err.message || 'Failed to retrieve investigation' });
  }
}

export async function cancelInvestigationHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const id = req.params.id as string;
    const cancelled = await investigationOrchestrator.cancelInvestigation(id, req.user.id, req.user.role);

    return res.json({
      success: true,
      data: cancelled,
    });
  } catch (err: any) {
    console.error('cancelInvestigationHandler error:', err);
    if (err.message?.includes('Forbidden')) {
      return res.status(403).json({ success: false, error: err.message });
    }
    if (err.message?.includes('not found')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err.message || 'Failed to cancel investigation' });
  }
}

export async function getInvestigationReportHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const id = req.params.id as string;
    const report = await investigationOrchestrator.getInvestigationReport(id, req.user.id, req.user.role);

    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not yet generated or available.' });
    }

    return res.json({
      success: true,
      data: report,
    });
  } catch (err: any) {
    console.error('getInvestigationReportHandler error:', err);
    if (err.message?.includes('Forbidden')) {
      return res.status(403).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err.message || 'Failed to retrieve report' });
  }
}

export async function getInvestigationEvidenceHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const id = req.params.id as string;
    const evidence = await investigationOrchestrator.getInvestigationEvidence(id, req.user.id, req.user.role);

    return res.json({
      success: true,
      data: evidence,
    });
  } catch (err: any) {
    console.error('getInvestigationEvidenceHandler error:', err);
    if (err.message?.includes('Forbidden')) {
      return res.status(403).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err.message || 'Failed to retrieve evidence' });
  }
}

export async function getInvestigationTimelineHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const id = req.params.id as string;
    const steps = await investigationOrchestrator.getInvestigationTimeline(id, req.user.id, req.user.role);

    return res.json({
      success: true,
      data: steps,
    });
  } catch (err: any) {
    console.error('getInvestigationTimelineHandler error:', err);
    if (err.message?.includes('Forbidden')) {
      return res.status(403).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err.message || 'Failed to retrieve timeline' });
  }
}

export async function getInvestigationOverviewHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const overview = await investigationOrchestrator.getOverview(req.user.id, req.user.role);

    return res.json({
      success: true,
      data: overview,
    });
  } catch (err: any) {
    console.error('getInvestigationOverviewHandler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to retrieve overview' });
  }
}

export async function listAvailableToolsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tools = toolRegistry.getAllTools().map((t) => ({
      name: t.name,
      version: t.version,
      description: t.description,
      category: t.category,
      isReadOnly: t.isReadOnly,
      requiredRole: t.requiredRole || [],
    }));

    return res.json({
      success: true,
      data: tools,
    });
  } catch (err: any) {
    console.error('listAvailableToolsHandler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to list tools' });
  }
}

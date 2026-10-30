import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AdminIntelligenceService } from '../services/admin/AdminIntelligenceService';

const adminService = new AdminIntelligenceService();

/**
 * GET /api/admin/intelligence/overview
 */
export async function getSystemOverview(req: Request, res: Response) {
  try {
    const overview = await adminService.getSystemOverview();
    return res.status(200).json({
      success: true,
      data: overview,
    });
  } catch (error: any) {
    console.error('getSystemOverview error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'ADMIN_ERROR', message: 'Failed to retrieve administrative overview.' },
    });
  }
}

/**
 * GET /api/admin/intelligence/blockchain
 */
export async function getBlockchainAnalytics(req: Request, res: Response) {
  try {
    const analytics = await adminService.getBlockchainAnalytics();
    return res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    console.error('getBlockchainAnalytics error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'ADMIN_ERROR', message: 'Failed to retrieve blockchain telemetry.' },
    });
  }
}

/**
 * GET /api/admin/intelligence/explorer
 */
export async function getBlockchainRecords(req: Request, res: Response) {
  try {
    const { search, recordType, status, page, limit } = req.query;
    const result = await adminService.getBlockchainRecords({
      search: search as string,
      recordType: recordType as string,
      status: status as string,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('getBlockchainRecords error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'ADMIN_ERROR', message: 'Failed to retrieve blockchain records.' },
    });
  }
}

/**
 * GET /api/admin/intelligence/tamper-monitoring
 */
export async function getTamperAndAnomalyIncidents(req: Request, res: Response) {
  try {
    const result = await adminService.getTamperAndAnomalyIncidents();
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('getTamperAndAnomalyIncidents error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'ADMIN_ERROR', message: 'Failed to retrieve tamper and anomaly incidents.' },
    });
  }
}

/**
 * POST /api/admin/intelligence/cases
 */
export async function createAdminCase(req: AuthenticatedRequest, res: Response) {
  try {
    const adminUserId = req.user!.id;
    const { vehicleId, category, title, description, severity, evidence } = req.body;

    if (!category || !title || !description) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Category, title, and description are required.' },
      });
    }

    const created = await adminService.createCase(adminUserId, {
      vehicleId,
      category,
      title,
      description,
      severity,
      evidence,
    });

    return res.status(201).json({
      success: true,
      message: 'Administrative case logged successfully.',
      data: created,
    });
  } catch (error: any) {
    console.error('createAdminCase error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'ADMIN_ERROR', message: 'Failed to create administrative case.' },
    });
  }
}

/**
 * PATCH /api/admin/intelligence/cases/:caseId
 */
export async function updateAdminCase(req: AuthenticatedRequest, res: Response) {
  try {
    const adminUserId = req.user!.id;
    const caseId = req.params.caseId as string;
    const { status, resolutionNotes, assignedToId } = req.body;

    const updated = await adminService.updateCase(adminUserId, caseId, {
      status,
      resolutionNotes,
      assignedToId,
    });

    return res.status(200).json({
      success: true,
      message: 'Case status updated.',
      data: updated,
    });
  } catch (error: any) {
    console.error('updateAdminCase error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'ADMIN_ERROR', message: 'Failed to update administrative case.' },
    });
  }
}

/**
 * GET /api/admin/intelligence/data-quality
 */
export async function getDataQualityAudits(req: Request, res: Response) {
  try {
    const audits = await adminService.getDataQualityAudits();
    return res.status(200).json({
      success: true,
      data: audits,
    });
  } catch (error: any) {
    console.error('getDataQualityAudits error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'ADMIN_ERROR', message: 'Failed to perform vehicle data quality audit.' },
    });
  }
}

/**
 * GET /api/admin/intelligence/audit-logs
 */
export async function getAuditLogs(req: Request, res: Response) {
  try {
    const { action, status, vehicleId, userId, search, page, limit } = req.query;
    const result = await adminService.getAuditLogs({
      action: action as string,
      status: status as string,
      vehicleId: vehicleId as string,
      userId: userId as string,
      search: search as string,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('getAuditLogs error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'ADMIN_ERROR', message: 'Failed to retrieve audit trail.' },
    });
  }
}

/**
 * GET /api/admin/intelligence/search
 */
export async function globalAdminSearch(req: Request, res: Response) {
  try {
    const query = (req.query.q as string) || '';
    const results = await adminService.globalSearch(query);
    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    console.error('globalAdminSearch error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'ADMIN_ERROR', message: 'Global search failed.' },
    });
  }
}

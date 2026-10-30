import { prisma } from '../../lib/prisma';
import { toolRegistry } from './toolRegistry';
import { investigationPlanner } from './investigationPlanner';
import { evidenceEngine } from './evidenceEngine';
import { reportGenerator } from './reportGenerator';
import {
  CreateInvestigationRequestDTO,
  InvestigationRunDTO,
  InvestigationStepDTO,
  InvestigationEvidenceDTO,
  InvestigationReport,
  InvestigationOverviewDTO,
  ToolExecutionContext,
} from './types';
import { InvestigationStatus, InvestigationType, StepStatus } from '@prisma/client';

export class InvestigationOrchestrator {
  private static instance: InvestigationOrchestrator;
  private activeControllers: Map<string, AbortController> = new Map();

  public static getInstance(): InvestigationOrchestrator {
    if (!InvestigationOrchestrator.instance) {
      InvestigationOrchestrator.instance = new InvestigationOrchestrator();
    }
    return InvestigationOrchestrator.instance;
  }

  /**
   * Recovers runs left in RUNNING or QUEUED states after an unexpected server restart
   */
  public async recoverStaleRuns(): Promise<number> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const staleRuns = await prisma.investigationRun.updateMany({
      where: {
        status: { in: ['RUNNING', 'QUEUED'] },
        OR: [
          { updatedAt: { lt: fiveMinutesAgo } },
          { startedAt: { lt: fiveMinutesAgo } },
          { createdAt: { lt: fiveMinutesAgo } },
        ],
      },
      data: {
        status: 'TIMED_OUT',
        errorMessage: 'Investigation execution was interrupted or timed out across server restart.',
        errorCategory: 'TIMEOUT',
        completedAt: new Date(),
      },
    });

    if (staleRuns.count > 0) {
      console.log(`[InvestigationOrchestrator] Recovered ${staleRuns.count} stale investigation run(s).`);
    }
    return staleRuns.count;
  }

  /**
   * Starts a new authorized investigation run
   */
  public async startInvestigation(
    request: CreateInvestigationRequestDTO,
    userId: string,
    userRole: string
  ): Promise<InvestigationRunDTO> {
    // 1. Resolve vehicleId
    let resolvedVehicleId: string | null = request.vehicleId || null;
    if (!resolvedVehicleId && request.targetType === 'VEHICLE') {
      resolvedVehicleId = request.targetId;
    }

    // 2. Authorization check on target vehicle if applicable
    if (resolvedVehicleId) {
      const hasAccess = await toolRegistry.checkVehicleAccess(resolvedVehicleId, {
        runId: '',
        userId,
        userRole,
        vehicleId: resolvedVehicleId,
      });

      if (!hasAccess) {
        throw new Error('Forbidden: caller does not have authorization to investigate this vehicle.');
      }
    }

    // 3. Generate unique sequence run number
    const count = await prisma.investigationRun.count();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const runNumber = `INV-2026-${(count + 1).toString().padStart(4, '0')}-${rand}`;

    const maxSteps = Math.min(request.maxSteps || 20, 20);
    const budgetMs = Math.min(request.executionBudgetMs || 60000, 120000); // Max 2 min
    const deadline = new Date(Date.now() + budgetMs);

    // 4. Create Run record in QUEUED state
    const runRecord = await prisma.investigationRun.create({
      data: {
        runNumber,
        initiatingUserId: userId,
        targetType: request.targetType,
        targetId: request.targetId,
        vehicleId: resolvedVehicleId,
        investigationType: (request.investigationType as InvestigationType) || 'GENERAL',
        status: 'QUEUED',
        maxSteps,
        executionBudgetMs: budgetMs,
        deadline,
        investigationCaseId: request.caseId || null,
      },
    });

    // 5. Execute synchronously or start background execution
    const abortController = new AbortController();
    this.activeControllers.set(runRecord.id, abortController);

    const shouldWait = request.waitForCompletion !== false;
    if (shouldWait) {
      await this.executeRunPipeline(runRecord.id, userId, userRole, resolvedVehicleId || undefined, abortController.signal);
      return this.getInvestigation(runRecord.id, userId, userRole);
    } else {
      // Run execution pipeline in background
      this.executeRunPipeline(runRecord.id, userId, userRole, resolvedVehicleId || undefined, abortController.signal).catch(
        (err) => {
          console.error(`[InvestigationOrchestrator] Error executing run ${runRecord.id}:`, err);
        }
      );
      return this.mapRunRecordToDTO(runRecord);
    }
  }

  /**
   * Internal execution pipeline for an investigation run
   */
  public async executeRunPipeline(
    runId: string,
    userId: string,
    userRole: string,
    vehicleId?: string,
    signal?: AbortSignal
  ): Promise<InvestigationRunDTO> {
    const startTime = Date.now();

    // Mark as RUNNING
    const run = await prisma.investigationRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    const context: ToolExecutionContext = {
      runId,
      userId,
      userRole,
      vehicleId: vehicleId || run.vehicleId || undefined,
      signal,
    };

    // 1. Generate plan
    const plannedSteps = investigationPlanner.generatePlan({
      targetType: run.targetType as any,
      targetId: run.targetId,
      vehicleId: context.vehicleId,
      investigationType: run.investigationType as any,
      maxSteps: run.maxSteps,
    });

    let stepIndex = 0;
    const allEvidenceDrafts: any[] = [];

    for (const plan of plannedSteps) {
      // Check cancellation
      if (signal?.aborted) {
        await prisma.investigationRun.update({
          where: { id: runId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            completedAt: new Date(),
            errorMessage: 'Investigation was cancelled by user request.',
          },
        });
        this.activeControllers.delete(runId);
        return this.getInvestigation(runId, userId, userRole);
      }

      // Check timeout
      if (Date.now() > (run.deadline?.getTime() || startTime + run.executionBudgetMs)) {
        await prisma.investigationRun.update({
          where: { id: runId },
          data: {
            status: 'TIMED_OUT',
            completedAt: new Date(),
            errorCategory: 'EXECUTION_TIMEOUT',
            errorMessage: 'Investigation exceeded configured execution budget.',
          },
        });
        this.activeControllers.delete(runId);
        return this.getInvestigation(runId, userId, userRole);
      }

      const tool = toolRegistry.getTool(plan.toolName);
      if (!tool) {
        console.warn(`Tool not found: ${plan.toolName}`);
        continue;
      }

      // Create step in PENDING/RUNNING state
      const stepRecord = await prisma.investigationStep.create({
        data: {
          runId,
          stepIndex: stepIndex + 1,
          toolName: tool.name,
          toolVersion: tool.version,
          status: 'RUNNING',
          inputMetadata: JSON.stringify(plan.input),
        },
      });

      // Execute tool
      let execResult;
      try {
        execResult = await tool.execute(plan.input, context);
      } catch (err: any) {
        execResult = {
          success: false,
          toolName: tool.name,
          toolVersion: tool.version,
          durationMs: 0,
          error: { category: 'INTERNAL_ERROR', message: err.message, isRetryable: false },
        };
      }

      // Update step status
      await prisma.investigationStep.update({
        where: { id: stepRecord.id },
        data: {
          status: execResult.success ? 'COMPLETED' : 'FAILED',
          durationMs: execResult.durationMs,
          resultSummary: execResult.success ? JSON.stringify(execResult.data || {}).slice(0, 500) : null,
          errorMessage: execResult.error?.message,
          errorCategory: execResult.error?.category,
        },
      });

      // Collect evidence
      if (execResult.evidenceItems && execResult.evidenceItems.length > 0) {
        const persisted = await evidenceEngine.persistEvidence(runId, execResult.evidenceItems);
        allEvidenceDrafts.push(...persisted);
      }

      stepIndex++;
      await prisma.investigationRun.update({
        where: { id: runId },
        data: { stepCount: stepIndex, evidenceCount: allEvidenceDrafts.length },
      });
    }

    // 2. Generate final report from all collected evidence
    const finalRunDTO = await this.getInvestigation(runId, userId, userRole);
    const persistedEvidence = await this.getInvestigationEvidence(runId, userId, userRole);

    const report = await reportGenerator.generateReport({
      run: finalRunDTO,
      evidenceList: persistedEvidence,
    });

    const executionDurationMs = Date.now() - startTime;

    // 3. Complete run
    const updatedRun = await prisma.investigationRun.update({
      where: { id: runId },
      data: {
        status: report.status as InvestigationStatus,
        summary: report.executiveSummary,
        reportJson: JSON.stringify(report),
        completedAt: new Date(),
        executionDurationMs,
      },
    });

    this.activeControllers.delete(runId);
    return this.mapRunRecordToDTO(updatedRun, report);
  }

  /**
   * Cancels a running investigation
   */
  public async cancelInvestigation(runId: string, userId: string, userRole: string): Promise<InvestigationRunDTO> {
    const run = await prisma.investigationRun.findUnique({ where: { id: runId } });
    if (!run) {
      throw new Error('Investigation run not found.');
    }

    if (userRole !== 'ADMIN' && run.initiatingUserId !== userId) {
      throw new Error('Forbidden: cannot cancel another user\'s investigation.');
    }

    const controller = this.activeControllers.get(runId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(runId);
    }

    const updated = await prisma.investigationRun.update({
      where: { id: runId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        completedAt: new Date(),
        errorMessage: 'Investigation cancelled by user.',
      },
    });

    return this.mapRunRecordToDTO(updated);
  }

  /**
   * Retrieves an authorized investigation run with full details
   */
  public async getInvestigation(runId: string, userId: string, userRole: string): Promise<InvestigationRunDTO> {
    const run = await prisma.investigationRun.findUnique({
      where: { id: runId },
    });

    if (!run) {
      throw new Error('Investigation run not found.');
    }

    // Check authorization: Owner of target vehicle, initiator, or ADMIN/Reviewer role
    if (userRole !== 'ADMIN' && userRole !== 'GARAGE' && userRole !== 'INSURANCE_PROVIDER' && userRole !== 'MANUFACTURER') {
      if (run.initiatingUserId !== userId) {
        if (run.vehicleId) {
          const hasVehicleAccess = await toolRegistry.checkVehicleAccess(run.vehicleId, {
            runId,
            userId,
            userRole,
            vehicleId: run.vehicleId,
          });
          if (!hasVehicleAccess) {
            throw new Error('Forbidden: you do not have permission to access this investigation.');
          }
        } else {
          throw new Error('Forbidden: you do not have permission to access this investigation.');
        }
      }
    }

    let report: InvestigationReport | null = null;
    if (run.reportJson) {
      try {
        report = JSON.parse(run.reportJson);
      } catch {
        report = null;
      }
    }

    return this.mapRunRecordToDTO(run, report);
  }

  /**
   * Lists investigations visible to the caller
   */
  public async listInvestigations(
    userId: string,
    userRole: string,
    filters?: { vehicleId?: string; status?: string; limit?: number; offset?: number }
  ): Promise<{ total: number; runs: InvestigationRunDTO[] }> {
    const where: any = {};

    if (filters?.vehicleId) {
      where.vehicleId = filters.vehicleId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    // Restrict regular owners to their vehicles or runs they initiated
    if (userRole === 'VEHICLE_OWNER') {
      where.OR = [
        { initiatingUserId: userId },
        { vehicle: { currentOwnerId: userId } },
      ];
    }

    const [total, records] = await Promise.all([
      prisma.investigationRun.count({ where }),
      prisma.investigationRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 20,
        skip: filters?.offset || 0,
      }),
    ]);

    return {
      total,
      runs: records.map((r) => this.mapRunRecordToDTO(r)),
    };
  }

  /**
   * Retrieves validated investigation report
   */
  public async getInvestigationReport(runId: string, userId: string, userRole: string): Promise<InvestigationReport | null> {
    const run = await this.getInvestigation(runId, userId, userRole);
    return run.report || null;
  }

  /**
   * Retrieves collected evidence list for a run
   */
  public async getInvestigationEvidence(
    runId: string,
    userId: string,
    userRole: string
  ): Promise<InvestigationEvidenceDTO[]> {
    // Check permission via getInvestigation
    await this.getInvestigation(runId, userId, userRole);

    const evidenceRecords = await prisma.investigationEvidence.findMany({
      where: { runId },
      orderBy: { createdAt: 'asc' },
    });

    return evidenceRecords.map((e) => {
      let prov = null;
      if (e.provenanceJson) {
        try {
          prov = JSON.parse(e.provenanceJson);
        } catch {
          prov = null;
        }
      }
      return {
        id: e.id,
        evidenceNumber: e.evidenceNumber,
        evidenceType: e.evidenceType,
        sourceRecordId: e.sourceRecordId,
        contentHash: e.contentHash,
        verificationStatus: e.verificationStatus as any,
        description: e.description,
        limitations: e.limitations,
        relationship: e.relationship as any,
        provenance: prov,
        createdAt: e.createdAt.toISOString(),
      };
    });
  }

  /**
   * Retrieves execution steps and timeline for a run
   */
  public async getInvestigationTimeline(
    runId: string,
    userId: string,
    userRole: string
  ): Promise<InvestigationStepDTO[]> {
    await this.getInvestigation(runId, userId, userRole);

    const steps = await prisma.investigationStep.findMany({
      where: { runId },
      orderBy: { stepIndex: 'asc' },
    });

    return steps.map((s) => {
      let meta = null;
      if (s.inputMetadata) {
        try {
          meta = JSON.parse(s.inputMetadata);
        } catch {
          meta = null;
        }
      }
      return {
        id: s.id,
        stepIndex: s.stepIndex,
        toolName: s.toolName,
        toolVersion: s.toolVersion,
        status: s.status as any,
        inputMetadata: meta,
        resultSummary: s.resultSummary,
        errorCategory: s.errorCategory,
        errorMessage: s.errorMessage,
        durationMs: s.durationMs,
        retryCount: s.retryCount,
        createdAt: s.createdAt.toISOString(),
      };
    });
  }

  /**
   * Overview dashboard metrics
   */
  public async getOverview(userId: string, userRole: string): Promise<InvestigationOverviewDTO> {
    const where: any = {};
    if (userRole === 'VEHICLE_OWNER') {
      where.OR = [
        { initiatingUserId: userId },
        { vehicle: { currentOwnerId: userId } },
      ];
    }

    const [totalRuns, runningRuns, completedRuns, reviewRequiredRuns, failedRuns, recentRecords] = await Promise.all([
      prisma.investigationRun.count({ where }),
      prisma.investigationRun.count({ where: { ...where, status: 'RUNNING' } }),
      prisma.investigationRun.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.investigationRun.count({ where: { ...where, status: 'REVIEW_REQUIRED' } }),
      prisma.investigationRun.count({ where: { ...where, status: { in: ['FAILED', 'TIMED_OUT'] } } }),
      prisma.investigationRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      totalRuns,
      runningRuns,
      completedRuns,
      reviewRequiredRuns,
      failedRuns,
      recentRuns: recentRecords.map((r) => this.mapRunRecordToDTO(r)),
    };
  }

  private mapRunRecordToDTO(record: any, report?: InvestigationReport | null): InvestigationRunDTO {
    return {
      id: record.id,
      runNumber: record.runNumber,
      initiatingUserId: record.initiatingUserId,
      targetType: record.targetType,
      targetId: record.targetId,
      vehicleId: record.vehicleId,
      investigationType: record.investigationType,
      status: record.status,
      summary: record.summary,
      errorCategory: record.errorCategory,
      errorMessage: record.errorMessage,
      stepCount: record.stepCount,
      maxSteps: record.maxSteps,
      evidenceCount: record.evidenceCount,
      executionBudgetMs: record.executionBudgetMs,
      executionDurationMs: record.executionDurationMs,
      startedAt: record.startedAt ? record.startedAt.toISOString() : null,
      completedAt: record.completedAt ? record.completedAt.toISOString() : null,
      cancelledAt: record.cancelledAt ? record.cancelledAt.toISOString() : null,
      deadline: record.deadline ? record.deadline.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      investigationCaseId: record.investigationCaseId,
      report: report || null,
    };
  }
}

export const investigationOrchestrator = InvestigationOrchestrator.getInstance();

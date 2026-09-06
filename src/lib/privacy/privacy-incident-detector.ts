/**
 * SecureChain Pay — Privacy Incident Detector (Task 10)
 *
 * Detects: unauthorized data access, repeated auth failures, excessive exports,
 * cross-user access attempts, AI secret leakage attempts, abnormal admin access.
 * Writes incidents to the PrivacyIncident table.
 */

import { db } from '@/lib/db';

export type PrivacyIncidentType =
  | 'UNAUTHORIZED_ACCESS'
  | 'SECRET_LEAK_ATTEMPT'
  | 'CROSS_USER_ACCESS'
  | 'EXCESSIVE_EXPORT'
  | 'PROMPT_INJECTION'
  | 'ABNORMAL_DATA_ACCESS'
  | 'REPEATED_AUTH_FAILURE';

export interface IncidentReport {
  incidentType: PrivacyIncidentType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actorId?: string;
  description: string;
  evidence: Record<string, unknown>;
}

// Sliding window trackers (in-memory for performance)
const accessCounters = new Map<string, { count: number; windowStart: number }>();
const authFailureCounters = new Map<string, { count: number; windowStart: number }>();

const WINDOW_MS = 10 * 60 * 1000;           // 10-minute windows
const EXCESSIVE_ACCESS_THRESHOLD = 100;       // >100 accesses in 10 min
const AUTH_FAILURE_THRESHOLD = 10;            // >10 failures in 10 min
const EXCESSIVE_EXPORT_THRESHOLD = 5;         // >5 exports in 10 min

export class PrivacyIncidentDetector {

  /**
   * Record and evaluate a data access event for anomalies.
   */
  static async evaluateAccess(actorId: string, resourceType: string, action: string, authorized: boolean): Promise<IncidentReport | null> {
    const now = Date.now();

    // ── Unauthorized access ──
    if (!authorized) {
      const failKey = `auth_fail:${actorId}`;
      const counter = authFailureCounters.get(failKey) || { count: 0, windowStart: now };
      if (now - counter.windowStart > WINDOW_MS) {
        counter.count = 0;
        counter.windowStart = now;
      }
      counter.count++;
      authFailureCounters.set(failKey, counter);

      if (counter.count >= AUTH_FAILURE_THRESHOLD) {
        const incident: IncidentReport = {
          incidentType: 'REPEATED_AUTH_FAILURE',
          severity: 'HIGH',
          actorId,
          description: `Repeated authorization failures detected for actor. ${counter.count} failures in ${Math.round(WINDOW_MS / 60000)} minutes.`,
          evidence: { failureCount: counter.count, windowMinutes: WINDOW_MS / 60000, resourceType, action },
        };
        await this.persist(incident);
        return incident;
      }

      return null;
    }

    // ── Excessive access volume ──
    const accessKey = `access:${actorId}`;
    const accessCounter = accessCounters.get(accessKey) || { count: 0, windowStart: now };
    if (now - accessCounter.windowStart > WINDOW_MS) {
      accessCounter.count = 0;
      accessCounter.windowStart = now;
    }
    accessCounter.count++;
    accessCounters.set(accessKey, accessCounter);

    if (accessCounter.count === EXCESSIVE_ACCESS_THRESHOLD) {
      const incident: IncidentReport = {
        incidentType: 'ABNORMAL_DATA_ACCESS',
        severity: 'MEDIUM',
        actorId,
        description: `Unusually high data access volume detected. ${accessCounter.count} accesses in ${Math.round(WINDOW_MS / 60000)} minutes.`,
        evidence: { accessCount: accessCounter.count, windowMinutes: WINDOW_MS / 60000, resourceType },
      };
      await this.persist(incident);
      return incident;
    }

    // ── Excessive exports ──
    if (action === 'EXPORT') {
      const exportKey = `export:${actorId}`;
      const exportCounter = accessCounters.get(exportKey) || { count: 0, windowStart: now };
      if (now - exportCounter.windowStart > WINDOW_MS) {
        exportCounter.count = 0;
        exportCounter.windowStart = now;
      }
      exportCounter.count++;
      accessCounters.set(exportKey, exportCounter);

      if (exportCounter.count >= EXCESSIVE_EXPORT_THRESHOLD) {
        const incident: IncidentReport = {
          incidentType: 'EXCESSIVE_EXPORT',
          severity: 'HIGH',
          actorId,
          description: `Excessive data export detected. ${exportCounter.count} exports in ${Math.round(WINDOW_MS / 60000)} minutes.`,
          evidence: { exportCount: exportCounter.count, windowMinutes: WINDOW_MS / 60000, resourceType },
        };
        await this.persist(incident);
        return incident;
      }
    }

    return null;
  }

  /**
   * Report a cross-user access attempt.
   */
  static async reportCrossUserAccess(requestingUserId: string, targetUserId: string, resource: string): Promise<IncidentReport> {
    const incident: IncidentReport = {
      incidentType: 'CROSS_USER_ACCESS',
      severity: 'HIGH',
      actorId: requestingUserId,
      description: `Cross-user data access attempted. Actor tried to access another user's ${resource}.`,
      evidence: { requestingUser: requestingUserId, targetResource: resource, timestamp: new Date().toISOString() },
    };
    await this.persist(incident);
    return incident;
  }

  /**
   * Report a secret leak attempt via AI.
   */
  static async reportSecretLeakAttempt(actorId: string | undefined, secretTypes: string[]): Promise<IncidentReport> {
    const incident: IncidentReport = {
      incidentType: 'SECRET_LEAK_ATTEMPT',
      severity: 'CRITICAL',
      actorId,
      description: `Secret material detected in AI prompt. Types: ${secretTypes.join(', ')}. Request was BLOCKED. Secret content was NOT logged.`,
      evidence: { secretTypes, blocked: true, timestamp: new Date().toISOString() },
    };
    await this.persist(incident);
    return incident;
  }

  /**
   * Report a prompt injection attempt.
   */
  static async reportPromptInjection(actorId: string | undefined, patterns: string[]): Promise<IncidentReport> {
    const incident: IncidentReport = {
      incidentType: 'PROMPT_INJECTION',
      severity: 'MEDIUM',
      actorId,
      description: `Prompt injection attempt detected and neutralized. ${patterns.length} injection pattern(s) removed.`,
      evidence: { patternCount: patterns.length, neutralized: true, timestamp: new Date().toISOString() },
    };
    await this.persist(incident);
    return incident;
  }

  /**
   * Persist an incident to the database.
   */
  private static async persist(incident: IncidentReport): Promise<void> {
    try {
      await db.privacyIncident.create({
        data: {
          incidentType: incident.incidentType,
          severity: incident.severity,
          actorId: incident.actorId || null,
          description: incident.description,
          evidence: incident.evidence as any,
          status: 'DETECTED',
        },
      });
    } catch (err) {
      // Privacy incident logging must not crash the payment flow
      console.error('[PrivacyIncidentDetector] Failed to persist incident:', err);
    }
  }

  /**
   * Get recent incidents for the admin dashboard.
   */
  static async getRecentIncidents(limit = 50) {
    try {
      return await db.privacyIncident.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch {
      return [];
    }
  }

  /**
   * Get incident stats for the privacy posture score.
   */
  static async getIncidentStats() {
    try {
      const [total, critical, resolved] = await Promise.all([
        db.privacyIncident.count(),
        db.privacyIncident.count({ where: { severity: 'CRITICAL', status: 'DETECTED' } }),
        db.privacyIncident.count({ where: { status: 'RESOLVED' } }),
      ]);
      return { total, critical, resolved, openRate: total > 0 ? ((total - resolved) / total * 100).toFixed(1) : '0' };
    } catch {
      return { total: 0, critical: 0, resolved: 0, openRate: '0' };
    }
  }
}

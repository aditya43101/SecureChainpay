import { NextResponse } from 'next/server';
import {
  getNodeStatuses,
  getIntegrityIncidents,
  getRecoveryEvents,
  getPaymentAuditRecords,
  getIntegritySnapshot,
  refreshNodeStatus,
} from '@/lib/blockchain/integrity-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await refreshNodeStatus();

    const nodes = getNodeStatuses();
    const incidents = await getIntegrityIncidents();
    const recoveryEvents = await getRecoveryEvents();
    const auditRecords = await getPaymentAuditRecords();
    const snapshot = await getIntegritySnapshot();

    const healthyNodesCount = nodes.filter((n) => n.status === 'HEALTHY').length;
    const quarantinedNodesCount = nodes.filter((n) => n.status === 'QUARANTINED').length;
    const activeIncidentsCount = incidents.filter((i) => i.status !== 'RESOLVED').length;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalNodes: nodes.length,
        healthyNodesCount,
        quarantinedNodesCount,
        activeIncidentsCount,
        totalAuditRecords: auditRecords.length,
        snapshotStatus: snapshot ? snapshot.status : 'NO_SNAPSHOT',
      },
      nodes,
      incidents,
      recoveryEvents,
      auditRecords,
      snapshot,
    });
  } catch (error: any) {
    console.error('[API /api/integrity/status] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch integrity status' },
      { status: 500 }
    );
  }
}

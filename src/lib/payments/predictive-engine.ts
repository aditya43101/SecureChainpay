import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class PredictiveEngine {
  private static getModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  static async recordTelemetry(provider: string, nodeId: string, latencyMs: number, errorRate: number, blockTimeMs?: number) {
    return await prisma.nodeTelemetry.create({
      data: { provider, nodeId, rpcLatencyMs: latencyMs, errorRate, blockTimeMs }
    });
  }

  static async getReliabilityForecast(provider: string) {
    const recentTelemetry = await prisma.nodeTelemetry.findMany({
      where: { provider, timestamp: { gte: new Date(Date.now() - 15 * 60 * 1000) } }, // last 15 mins
      orderBy: { timestamp: 'desc' },
      take: 20
    });

    if (recentTelemetry.length === 0) {
      return { reliabilityScore: 95, riskLevel: 'LOW', confidence: 0.5 };
    }

    const avgLatency = recentTelemetry.reduce((acc, t) => acc + t.rpcLatencyMs, 0) / recentTelemetry.length;
    const avgError = recentTelemetry.reduce((acc, t) => acc + t.errorRate, 0) / recentTelemetry.length;

    let score = 100;
    if (avgLatency > 1000) score -= 15;
    if (avgLatency > 3000) score -= 30;
    
    score -= (avgError * 100); 

    score = Math.max(0, Math.min(100, score));

    let riskLevel = 'LOW';
    if (score < 60) riskLevel = 'HIGH';
    else if (score < 85) riskLevel = 'MEDIUM';

    if (riskLevel === 'HIGH') {
       await this.triggerEarlyWarning(provider, score, avgLatency, avgError);
    }

    return { reliabilityScore: score, riskLevel, confidence: 0.85 + (recentTelemetry.length / 200) };
  }

  private static async triggerEarlyWarning(provider: string, score: number, latency: number, errorRate: number) {
     const recentIncident = await prisma.predictiveIncident.findFirst({
        where: { provider, isActive: true, createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } }
     });

     if (!recentIncident) {
        await prisma.predictiveIncident.create({
           data: {
             incidentType: 'EARLY_WARNING',
             severity: score < 40 ? 'CRITICAL' : 'HIGH',
             description: `Predicted degradation for ${provider}. Reliability dropped to ${score.toFixed(0)}.`,
             provider,
             confidence: 0.9,
             evidence: { avgLatency: latency, avgErrorRate: errorRate },
             recommendedAction: 'Reduce routing preference immediately.',
             policyDecision: 'APPROVED'
           }
        });
     }
  }

  static async explainIncident(incidentId: string) {
     const incident = await prisma.predictiveIncident.findUnique({ where: { id: incidentId } });
     if (!incident) return 'Incident not found.';

     const prompt = `
     You are the Operational Root Cause Analyzer for SecureChain Pay.
     Explain this infrastructure early warning in 2 short sentences. State the evidence clearly.
     Type: ${incident.incidentType}
     Severity: ${incident.severity}
     Provider: ${incident.provider}
     Description: ${incident.description}
     Evidence: ${JSON.stringify(incident.evidence)}
     `;

     try {
        const model = this.getModel();
        const res = await model.generateContent(prompt);
        return (await res.response).text();
     } catch (e) {
        return 'Provider is experiencing elevated latency and error rates causing predictive warnings.';
     }
  }
}

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';

export class PaymentAIClassifier {
  private static getModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * Translates technical execution errors into human-readable explanations.
   */
  static async explainIncident(intentId: string): Promise<string> {
    const intent = await prisma.paymentIntent.findUnique({
      where: { id: intentId },
      include: { executions: true, events: true }
    });

    if (!intent) return "Payment not found.";

    const failures = await prisma.paymentFailure.findMany({
      where: { paymentIntentId: intentId }
    });

    const prompt = `
You are the AI Payment Operations Assistant for SecureChain Pay.
Analyze the following payment failure and provide a clear, user-friendly explanation of what went wrong and what the system is doing. Do not make up facts. Keep it under 3 sentences.

Payment Intent: ${intent.id}
Status: ${intent.status}
Latest Execution Error: ${intent.executions[intent.executions.length - 1]?.error || 'None'}
Failures: ${JSON.stringify(failures)}
    `;

    try {
      const model = this.getModel();
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (e) {
      console.error("Payment AI Classifier Error:", e);
      return "The payment encountered a technical issue and is being verified by our system.";
    }
  }

  /**
   * Provide a routing and recovery recommendation based on failure context.
   */
  static async recommendRecoveryAction(failureType: string, provider: string, latencyMs: number) {
    if (failureType === 'RPC_TIMEOUT' && latencyMs > 5000) {
      return { action: 'ROUTE_TO_BACKUP_NODE', confidence: 0.92, reason: `Provider ${provider} is experiencing high latency.` };
    }
    return { action: 'STANDARD_RETRY', confidence: 0.75, reason: 'Temporary infrastructure issue suspected.' };
  }
}

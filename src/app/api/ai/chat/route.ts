import { NextResponse } from 'next/server';
import { requireFirebaseUser } from '@/lib/auth/require-firebase-user';
import { generateAIResponse } from '@/lib/ai/server-ai-service';

// Basic rate limiting map (In production, use Redis)
const rateLimitMap = new Map<string, { count: number, resetTime: number }>();

export async function POST(request: Request) {
  try {
    // 1. Authenticate User
    let decodedToken;
    try {
      decodedToken = await requireFirebaseUser(request);
    } catch (authError: any) {
      return NextResponse.json({ error: authError.message || 'Unauthorized' }, { status: 401 });
    }

    const userId = decodedToken.uid;

    // 2. Simple Rate Limiting (10 requests per minute per user)
    const now = Date.now();
    const rateLimit = rateLimitMap.get(userId);
    if (rateLimit && now < rateLimit.resetTime) {
      if (rateLimit.count >= 10) {
        return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
      }
      rateLimit.count++;
    } else {
      rateLimitMap.set(userId, { count: 1, resetTime: now + 60000 });
    }

    // 3. Parse and Validate Request
    const body = await request.json();
    const { message, conversationId, asset, mode, context } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: 'Message is too long' }, { status: 400 });
    }

    const validModes = ['learning', 'market-analysis', 'trade-setup', 'risk-analysis'];
    if (!mode || !validModes.includes(mode)) {
      return NextResponse.json({ error: 'Invalid AI mode' }, { status: 400 });
    }

    // 4. Generate AI Response
    try {
      const response = await generateAIResponse({
        userId,
        message,
        conversationId,
        asset,
        mode,
        context
      });

      return NextResponse.json({
        success: true,
        message: response.content,
        conversationId: response.conversationId,
        metadata: {
          asset,
          mode
        }
      });
    } catch (aiError: any) {
      console.error('AI Generation Error:', aiError);
      return NextResponse.json({ error: 'Failed to process AI request. The service might be temporarily unavailable.' }, { status: 503 });
    }
  } catch (error: any) {
    console.error('API /api/ai/chat unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { requireFirebaseUser } from '@/lib/auth/require-firebase-user';
import { generateAIResponse, generateIntelligentResponse } from '@/lib/ai/server-ai-service';

// Basic rate limiting map (In production, use Redis)
const rateLimitMap = new Map<string, { count: number, resetTime: number }>();

export async function POST(request: Request) {
  let parsedMessage = '';
  let parsedConversationId: string | undefined;
  let parsedMode = 'learning';
  let parsedAsset: any;

  try {
    const body = await request.json();
    const { message, conversationId, asset, mode, context, userId: bodyUserId } = body;
    parsedMessage = message || '';
    parsedConversationId = conversationId;
    parsedMode = mode || 'learning';
    parsedAsset = asset;

    // 1. Authenticate User (or fallback to body/guest)
    let userId = 'guest_user';
    try {
      const decodedToken = await requireFirebaseUser(request);
      if (decodedToken?.uid) {
        userId = decodedToken.uid;
      }
    } catch {
      if (bodyUserId && typeof bodyUserId === 'string' && bodyUserId.trim().length > 0) {
        userId = bodyUserId.trim();
      }
    }

    // 2. Simple Rate Limiting (20 requests per minute per user)
    const now = Date.now();
    const rateLimit = rateLimitMap.get(userId);
    if (rateLimit && now < rateLimit.resetTime) {
      if (rateLimit.count >= 20) {
        return NextResponse.json({ error: 'Rate limit exceeded. Please try again in a minute.' }, { status: 429 });
      }
      rateLimit.count++;
    } else {
      rateLimitMap.set(userId, { count: 1, resetTime: now + 60000 });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 4000) {
      return NextResponse.json({ error: 'Message is too long' }, { status: 400 });
    }

    const validModes = ['learning', 'market-analysis', 'trade-setup', 'risk-analysis'];
    const safeMode = (validModes.includes(mode) ? mode : 'learning') as any;

    // 3. Generate AI Response
    try {
      const response = await generateAIResponse({
        userId,
        message,
        conversationId,
        asset,
        mode: safeMode,
        context
      });

      return NextResponse.json({
        success: true,
        message: response.content,
        conversationId: response.conversationId,
        metadata: {
          asset,
          mode: safeMode
        }
      });
    } catch (aiError: any) {
      console.error('AI Generation Error:', aiError);
      const fallbackContent = generateIntelligentResponse(message, safeMode, asset);
      return NextResponse.json({
        success: true,
        message: fallbackContent,
        conversationId: conversationId || `conv_${Date.now()}`,
      });
    }
  } catch (error: any) {
    console.error('API /api/ai/chat unexpected error:', error);
    const fallbackContent = parsedMessage ? generateIntelligentResponse(parsedMessage, parsedMode as any, parsedAsset) : 'Please provide a valid question or trading topic to analyze.';
    return NextResponse.json({
      success: true,
      message: fallbackContent,
      conversationId: parsedConversationId || `conv_${Date.now()}`,
    });
  }
}

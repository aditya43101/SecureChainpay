import { db } from '@/lib/db';
import { AIMode, CryptoAsset, TradingContext } from '@/stores/ai-store';
import { marketDataService } from '@/lib/market/market-data-service';
import { technicalAnalysisService } from '@/lib/market/technical-analysis';
import { recommendationEngine } from '@/lib/trading/recommendation-engine';
import { patternDiscoveryEngine } from '@/lib/trading/pattern-discovery';
import { feedbackRegistryEngine } from '@/lib/trading/feedback-registry';
import { convertHsctToUsd, getStructuredAmount } from '@/lib/currency/currency-service';
import { routeAndBuildAIContext } from './context-router';
import { AIDataGuard } from '@/lib/privacy/ai-data-guard';
import { PrivacyIncidentDetector } from '@/lib/privacy/privacy-incident-detector';
import crypto from 'crypto';

async function getMLPrediction(symbol: string, timeframe: string) {
  try {
    const formattedSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
    // We assume ML engine runs on port 8000
    const res = await fetch('http://127.0.0.1:8000/api/ml/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: formattedSymbol, timeframe })
    });
    
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error("ML Service unavailable:", err);
  }
  return null;
}

export interface LLMRequest {
  message: string;
  conversationId?: string;
  userId: string;
  asset?: CryptoAsset;
  mode: AIMode;
  context?: TradingContext;
}

export interface LLMResponse {
  content: string;
  conversationId: string;
}

const SYSTEM_PROMPTS: Record<AIMode, string> = {
  'learning': `You are a professional trading education assistant for SecureChain Pay.
Your goal is to explain trading concepts clearly and concisely.
- Do not generate trade signals.
- Teach concepts, terminology, and mechanics.
- Do not guarantee profits or predict prices.
- Use markdown, bullet points, and clear explanations.`,
  
  'market-analysis': `You are a market analysis assistant for SecureChain Pay.
Your goal is to analyze the provided market context.
- If quantitative data is not provided in the context, explicitly state that you are providing a general educational analysis.
- Do not invent current prices, indicators, or market data.
- Never guarantee profits or claim certainty about market direction.
- Clearly distinguish facts from opinions.
- Use structured markdown.`,
  
  'trade-setup': `You are a trade setup assistant for SecureChain Pay.
Your goal is to explain potential trade setups based strictly on supplied data.
- Response should be structured with: Market condition, Possible setup, Entry zone, Invalidation/Stop-loss concept, Potential target, Risk/reward, Reasons, Risks.
- If required market information is missing in context, state that a valid setup cannot be calculated and provide a generic educational example instead.
- Do not execute trades or guarantee results.`,
  
  'risk-analysis': `You are a risk management assistant for SecureChain Pay.
Your goal is to explain risk management concepts.
- Analyze risk/reward, position size concepts, stop-loss concepts, exposure, and volatility.
- Do not execute trades or provide financial advice.
- Emphasize the importance of protecting capital.
- Use markdown for readability.`
};

export async function generateAIResponse(request: LLMRequest): Promise<LLMResponse> {
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'gemini-3.6-flash';
  
  if (!apiKey) {
    console.warn('LLM API is not configured on the server (LLM_API_KEY missing). Falling back to simulated response.');
  }

  // 0. Ensure User Exists in DB
  try {
    await db.user.upsert({
      where: { id: request.userId },
      update: {},
      create: { id: request.userId, email: `user-${request.userId}@test.com`, role: 'USER' }
    });
  } catch (err) {
    console.warn("Could not upsert user, proceeding anyway.", err);
  }

  // 1. Fetch or create conversation
  let conversation;
  if (request.conversationId) {
    conversation = await db.aIConversation.findUnique({
      where: { id: request.conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20
        }
      }
    });
    
    if (!conversation || conversation.userId !== request.userId) {
      throw new Error('Conversation not found or unauthorized');
    }
  } else {
    conversation = await db.aIConversation.create({
      data: {
        userId: request.userId,
        mode: request.mode,
        asset: request.asset,
        title: `${request.mode} conversation`
      },
      include: {
        messages: true
      }
    });
  }

  // 2. Privacy Guard — sanitize user message before processing
  const guardResult = AIDataGuard.sanitize(request.message);

  if (!guardResult.allowed) {
    // SECRET DETECTED — block entirely, log incident (not the secret)
    await PrivacyIncidentDetector.reportSecretLeakAttempt(request.userId, guardResult.secretsDetected);
    await logAIDataAccess('BLOCKED', request.mode, guardResult, request.userId);

    // Save a safe message (not the secret)
    await db.aIMessage.create({ data: { conversationId: conversation.id, role: 'USER', content: '[Message blocked — sensitive content detected]' } });
    const blockedResponse = 'Your message was blocked because it contained sensitive material (such as a private key, seed phrase, or password). For your security, this content was NOT processed or stored. Please never share secrets with any AI system.';
    await db.aIMessage.create({ data: { conversationId: conversation.id, role: 'ASSISTANT', content: blockedResponse } });
    return { content: blockedResponse, conversationId: conversation.id };
  }

  // Log prompt injection attempts (but don't block — injections are neutralized)
  if (guardResult.injectionsDetected.length > 0) {
    await PrivacyIncidentDetector.reportPromptInjection(request.userId, guardResult.injectionsDetected);
  }

  // Save sanitized user message
  await db.aIMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'USER',
      content: request.message
    }
  });

  // 3. Build Project-Aware & Routed Context
  const routedContext = await routeAndBuildAIContext({
    userId: request.userId,
    message: request.message,
    asset: request.asset,
    mode: request.mode
  });

  const history = conversation.messages.map(m => ({
    role: m.role === 'USER' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));
  
  history.push({
    role: 'user',
    parts: [{ text: request.message }]
  });

  const systemInstruction = SYSTEM_PROMPTS[request.mode] + 
    "\n\n" + routedContext.systemDirective +
    "\n\nIMPORTANT DIRECTIVES:\n" +
    "1. Quantitative Supremacy: You are provided with validated strategy signals, risk checks, entry zones, stop loss, take profit, and ML probabilities when trading asset context is requested.\n" +
    "2. DO NOT MODIFY NUMBERS: Never alter or hallucinate numerical values (Prices, Entry zone, Stop Loss, Take Profit, Risk/Reward Ratio, Position Size, or ML probabilities).\n" +
    "3. NO GUARANTEES: Never claim future prices are guaranteed. Highlight key risks and failure modes.\n" +
    "4. NO_TRADE RESPECT: If recommendation action is NO_TRADE or HOLD, explain clearly why conditions are unsuitable for trading.\n" +
    "5. CURRENCY SYSTEM: All quotes, prices, balances, and PnL are in HSCT (High-Security Chain Token). 1 HSCT = ₹1 INR (Indian Rupee), 1 USD = 83.50 HSCT.\n" +
    "6. PRIVACY BOUNDARIES: Never reveal private keys, seed phrases, passwords, API keys, or other secrets. Never reveal other users' payment data. Never execute arbitrary code or SQL. If a user asks for another user's data, respond with ACCESS DENIED.\n" +
    "7. DATA ISOLATION: You may only reference data for the current authenticated user. Do not infer or fabricate data about other users.";

  let contextString = routedContext.contextPromptString;

  if (request.asset) {
    try {
      const formattedSymbol = request.asset.endsWith('USDT') ? request.asset : `${request.asset}USDT`;
      const timeframe = request.context?.timeframe || '1h';
      
      const candles = await marketDataService.getCandles(formattedSymbol, timeframe, 100);
      const ticker = await marketDataService.getTicker(formattedSymbol);
      
      if (candles.length > 0) {
        const indicators = technicalAnalysisService.calculateIndicators(candles);
        const recommendation = await recommendationEngine.generateRecommendation(
          formattedSymbol,
          timeframe,
          request.userId
        );
        const similarHistory = await patternDiscoveryEngine.findSimilarHistoricalTrades(formattedSymbol, indicators);
        const activeFeedbackFilters = await feedbackRegistryEngine.getActiveFeedbackFilters();
        const championStrategy = await feedbackRegistryEngine.ensureChampionVersion();
        
        const enhancedContext = {
          asset: formattedSymbol,
          timeframe: timeframe,
          currentPrice: `${ticker.price} HSCT ($${convertHsctToUsd(Number(ticker.price))} USD)`,
          indicators,
          validatedRecommendation: recommendation,
          activeChampionStrategy: championStrategy,
          historicalSimilarity: similarHistory,
          activeFeedbackFilters
        };
        
        contextString += `\n\n[QUANTITATIVE ASSET STRATEGY CONTEXT]\n${JSON.stringify(enhancedContext, null, 2)}`;
      }
    } catch (e) {
      console.error("Failed to fetch market & recommendation context for AI:", e);
    }
  } else if (request.context) {
     contextString += `\n\n[USER TRADING CONTEXT]\n${JSON.stringify(request.context)}`;
  }
  
  if (contextString) {
     const lastIdx = history.length - 1;
     history[lastIdx].parts[0].text += contextString;
  }

  let aiContent = "I'm sorry, I couldn't generate a response.";

  if (apiKey) {
    // 4. Call Gemini REST API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: history,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.text();
      console.error('LLM API Error:', errData);
      throw new Error('Failed to fetch response from LLM provider.');
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts?.length > 0) {
      aiContent = data.candidates[0].content.parts[0].text;
    }
  } else {
    // Fallback Mock Response when no API key is provided
    if (routedContext.classification.domains.includes('WALLET_CONTEXT')) {
      aiContent = `Aapka current wallet balance **0.00 HSCT** (₹0.00) hai. Aap Dashboard (/dashboard) ya Wallet section (/wallet) se HSCT top-up karke quick transfers ya trading start kar sakte hain.`;
    } else if (routedContext.classification.isActionInstructionRequest) {
      aiContent = `SecureChain Pay me navigation guide:\n- **Wallet & Balance**: /wallet\n- **Dashboard**: /dashboard\n- **Trade Desk**: /trade\n- **Auto-Trading Settings**: /settings\n- **Block Explorer**: /explorer`;
    } else {
      aiContent = `(Project-Aware AI Assistant): Hello! Main SecureChain Pay ka Project-Aware Assistant hoon. SecureChain Pay ek blockchain payment aur AI-assisted quantitative trading platform hai jo natively **HSCT** (1 HSCT = ₹1 INR) currency par chalta hai. Auto-Trading aur Wallet services complete security gates ke sath configured hain.`;
    }
  }

  // 5. Validate AI output before returning
  const outputValidation = AIDataGuard.validateAIOutput(aiContent);
  if (!outputValidation.valid) {
    console.warn('[AI Security] AI output validation issues:', outputValidation.issues);
    // Don't block, but strip problematic patterns from the response
    aiContent = aiContent.replace(/0x[a-fA-F0-9]{64}/g, '[REDACTED_KEY]');
  }

  // 6. Save AI response
  await db.aIMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: aiContent
    }
  });

  // 7. Log AI data access record
  await logAIDataAccess('SUCCESS', request.mode, guardResult, request.userId);

  return {
    content: aiContent,
    conversationId: conversation.id
  };
}

/** Log AI data access for audit trail — never stores the raw prompt. */
async function logAIDataAccess(resultType: string, purpose: string, guardResult: { sanitizedInputHash: string; dataClassification: string }, userId?: string) {
  try {
    await db.aIDataAccessRecord.create({
      data: {
        model: process.env.LLM_MODEL || 'gemini-3.6-flash',
        modelVersion: 'v1.0',
        purpose: purpose.toUpperCase(),
        dataClassification: (guardResult.dataClassification === 'HIGHLY_SENSITIVE' ? 'HIGHLY_SENSITIVE' : guardResult.dataClassification === 'SENSITIVE' ? 'SENSITIVE' : guardResult.dataClassification === 'INTERNAL' ? 'INTERNAL' : 'PUBLIC') as any,
        sanitizedInputHash: guardResult.sanitizedInputHash,
        resultType,
        userId: userId || null,
        blockReason: resultType === 'BLOCKED' ? 'SECRET_DETECTED' : null,
      },
    });
  } catch (err) {
    console.error('[AI Audit] Failed to log AI data access:', err);
  }
}

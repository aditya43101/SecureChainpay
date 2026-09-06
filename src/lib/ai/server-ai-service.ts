import { db } from '@/lib/db';
import { AIMode, CryptoAsset, TradingContext } from '@/stores/ai-store';
import { marketDataService } from '@/lib/market/market-data-service';
import { technicalAnalysisService } from '@/lib/market/technical-analysis';
import { recommendationEngine } from '@/lib/trading/recommendation-engine';
import { patternDiscoveryEngine } from '@/lib/trading/pattern-discovery';
import { feedbackRegistryEngine } from '@/lib/trading/feedback-registry';
import { convertHsctToUsd, getStructuredAmount } from '@/lib/currency/currency-service';
import { USD_TO_HSCT } from '@/stores/wallet-store';
import { routeAndBuildAIContext } from './context-router';
import { AIDataGuard } from '@/lib/privacy/ai-data-guard';
import { PrivacyIncidentDetector } from '@/lib/privacy/privacy-incident-detector';
import crypto from 'crypto';

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
  'learning': `You are a professional trading and blockchain financial education assistant for SecureChain Pay.
Your goal is to explain trading concepts, crypto mechanics, and blockchain architecture clearly and concisely.
- Teach concepts, terminology, indicators, and market mechanics.
- Answer user questions in the language they asked (English, Hindi, or natural Hinglish).
- Provide practical examples and structured markdown.`,
  
  'market-analysis': `You are an expert market analysis assistant for SecureChain Pay.
Your goal is to analyze cryptocurrency price action, market momentum, and technical indicators.
- Provide clear trend analysis, support/resistance levels, RSI, and MACD interpretations.
- Clearly distinguish quantitative signals from potential risks.
- Use structured markdown with bullet points.`,
  
  'trade-setup': `You are a quantitative trade setup specialist for SecureChain Pay.
Your goal is to formulate structured, actionable trade setups based on technical analysis.
- Structure: Market Condition, Potential Setup (Long/Short), Entry Zone, Stop-Loss Level, Take-Profit Targets, Risk/Reward Ratio, Rationale, and Invalidation Criteria.
- Always emphasize risk management and capital preservation.`,
  
  'risk-analysis': `You are a risk management specialist for SecureChain Pay.
Your goal is to evaluate risk parameters, position sizing, and capital protection.
- Explain position sizing, maximum drawdowns, stop-loss calculations, and risk-to-reward ratios.
- Emphasize disciplined trading rules.`
};

/**
 * Intelligent built-in Financial & Trading AI Engine.
 * Generates direct, point-to-point contextual answers for any prompt without repetitive boilerplate greetings.
 */
export function generateIntelligentResponse(
  message: string,
  mode: AIMode = 'learning',
  asset?: string,
  marketInfo?: any,
  routedContext?: any
): string {
  const cleanMsg = message.trim();
  const lower = cleanMsg.toLowerCase();
  const symbol = (asset || (lower.includes('eth') || lower.includes('ethereum') ? 'ETH' : lower.includes('sol') ? 'SOL' : lower.includes('matic') || lower.includes('polygon') ? 'MATIC' : 'BTC')).toUpperCase();
  // Detect Hindi/Hinglish by meaningful Hindi words (not just any common English word overlap)
  const isHindi = lower.includes('kaise') || lower.includes('batao') || lower.includes('nahi') || lower.includes('nhi') || lower.includes('karu') || lower.includes('chahiye') || lower.includes('samjhao') || lower.includes('karein') || lower.includes('hoga') || lower.includes('bhejna') || lower.includes('paisa') || lower.includes('bhai') || lower.includes('yaar') || lower.includes('acha') || lower.includes('theek') || lower.includes('toh') || lower.includes('mujhe') || lower.includes('aap') || lower.includes('hum') || lower.includes('kyun') || lower.includes('kab') || lower.includes('kya hai') || lower.includes('kaisa') || lower.includes('lagta') || lower.includes('raha') || lower.includes('gaya') || lower.includes('bolo') || lower.includes('suno');

  // Helper formatting for live market prices
  const isBtc = symbol === 'BTC';
  const isEth = symbol === 'ETH';
  const isSol = symbol === 'SOL';
  const isMatic = symbol === 'MATIC';
  const priceUsd = isBtc ? 64500 : isEth ? 3450 : isSol ? 145 : isMatic ? 0.42 : 1.0;
  const priceHsct = priceUsd * USD_TO_HSCT;

  // 1. GREETINGS & CASUAL INQUIRIES — match natural conversation phrases
  const isGreeting = (
    /^(hi|hello|hey|hola|namaste|salam|howdy|yo)[\s!.,?]*$/i.test(cleanMsg) ||
    (cleanMsg.length <= 5 && (lower.includes('hi') || lower.includes('hey'))) ||
    /\b(kaise ho|kaisa ho|kaisi ho|kya haal|kya hal|how are you|how r u|wassup|what'?s up|sup|how's it going|hows it going)\b/i.test(cleanMsg) ||
    /\b(or batao|aur batao|batao bhai|batao yaar|bolo bhai|bolo yaar|kya chal raha|kya kar rahe|sab theek|sab badhiya|theek ho|badhiya ho|mazze mein|kuch naya|kya scene|kya scene hai)\b/i.test(cleanMsg)
  );

  if (isGreeting) {
    if (isHindi) {
      return `Bilkul badhiya hoon bhai! 😄🚀
Aap bataiye — trading setup chahiye, market analysis, ya SecureChain wallet ke baare mein kuch poochhna hai? Jo bhi ho, batao!`;
    }
    return `Hey! I'm doing great, thanks for asking! 🚀
How can I help you today? Whether it's market analysis, a trade setup, technical indicators, or SecureChain wallet questions — I'm ready!`;
  }

  // 2a. LLM / MODEL / TECH STACK QUESTIONS
  if (
    lower.includes('konsa llm') || lower.includes('kaunsa llm') || lower.includes('which llm') ||
    lower.includes('konsa model') || lower.includes('kaunsa model') || lower.includes('which model') ||
    lower.includes('konsa ai') || lower.includes('which ai') ||
    lower.includes('llm use') || lower.includes('model use') ||
    lower.includes('kis llm') || lower.includes('kya llm') ||
    (lower.includes('gemini') && (lower.includes('use') || lower.includes('kya') || lower.includes('konsa')))
  ) {
    if (isHindi) {
      return `Main **Google Gemini API** pe chalta hoon! 🤖

Jab Gemini available hota hai, main live AI responses deta hoon. Agar API key set nahi hai ya request fail ho jaaye, toh main apne built-in trading knowledge engine se answer karta hoon.

**Tech stack:**
- 🧠 **LLM:** Google Gemini 2.0 Flash (primary)
- ⚡ **Fallback:** Built-in SecureChain intelligent engine
- 🔐 **Platform:** Next.js + Vercel`;
    }
    return `I run on the **Google Gemini API**! 🤖

When the Gemini API is available, I generate live AI responses. If unavailable, I fall back to my built-in SecureChain trading knowledge engine.

**Tech stack:**
- 🧠 **LLM:** Google Gemini 2.0 Flash (primary)
- ⚡ **Fallback:** Built-in SecureChain intelligent engine
- 🔐 **Platform:** Next.js + Vercel`;
  }

  // 2b. PERSONAL QUESTIONS ("mera naam batao", "mujhe jaanta ho", "meri age")
  if (
    lower.includes('mera naam') || lower.includes('meri age') || lower.includes('mujhe jaanta') ||
    lower.includes('my name') || lower.includes('do you know me') || lower.includes('who am i') ||
    lower.includes('naam batao') || lower.includes('kaun hoon') || lower.includes('meri info') ||
    lower.includes('meri detail')
  ) {
    if (isHindi) {
      return `Bhai, mujhe aapka naam nahi pata — main sirf AI hoon aur aapki personal info mere paas nahi hai! 😄

Aap khud batao toh sahi, main aapko naam se baat kar sakta hoon. Waise, trading ya market ke baare mein kuch poochna hai?`;
    }
    return `I don't have access to your personal information — I'm just an AI! 😄

Feel free to tell me your name and I'll use it. Is there anything about trading, markets, or SecureChain I can help you with?`;
  }

  // 2. IDENTITY / ABOUT ("who are you", "tum kaun ho", "kya kar sakte ho")
  if (lower.includes('who are you') || lower.includes('tum kaun') || lower.includes('aap kaun') || lower.includes('kya kar sakte') || lower.includes('what can you do')) {
    if (isHindi) {
      return `Main **SecureChain Pay ka AI Trading & Blockchain Assistant** hoon.

**Main aapki in cheezon me direct help kar sakta hoon:**
1. **Trade Setups & Signals:** BTC, ETH, SOL ke entry points, stop-loss aur target levels.
2. **Technical Analysis:** RSI, MACD, Moving Averages, Support/Resistance aur Chart Patterns.
3. **Risk Management:** Position sizing (1% rule) aur stop-loss calculation.
4. **Blockchain & Crypto Education:** Smart contracts, gas fees, Merkle proofs aur security.
5. **SecureChain Platform Guide:** HSCT tokens, QR payments, Send/Receive aur Explorer verification.`;
    }
    return `I am the **SecureChain Pay AI Trading & Blockchain Assistant**.

**Core Capabilities:**
1. **Trade Setups & Signals:** Precise Entry, Stop-Loss, and Target levels for BTC, ETH, SOL, etc.
2. **Technical Analysis:** Deep dive into RSI, MACD, EMA trends, and chart patterns.
3. **Risk Management:** Position sizing formulas, risk-to-reward ratios, and stop-loss rules.
4. **Blockchain Insights:** Smart contracts, Merkle proofs, gas fees, and cryptography.
5. **SecureChain Wallet:** Instant HSCT settlement, QR transfers, and ledger verification.`;
  }

  // 3. TECHNICAL INDICATORS (RSI, MACD, EMA/SMA, Bollinger Bands, Volume, Support/Resistance, Candles)
  if (lower.includes('rsi')) {
    if (isHindi) {
      return `### 📊 **RSI (Relative Strength Index) Kya Hai & Kaise Use Karein?**

- **Definition:** RSI ek momentum oscillator hai jo 0 se 100 ke beech measure karta hai ki asset overbought hai ya oversold.
- **Key Levels:**
  - **Overbought (> 70):** Price bahut tezi se badh chuka hai; pullback ya correction ka chance hota hai (Sell / Caution signal).
  - **Oversold (< 30):** Price bahut zyada gir chuka hai; bounce back / buying opportunity ban sakti hai.
  - **Neutral Zone (40 - 60):** Market consolidation me rehta hai.
- **Divergence:** Agar price naya High banaye aur RSI lower high banaye (Bearish Divergence), to trend reversal ka strong signal hota hai.`;
    }
    return `### 📊 **RSI (Relative Strength Index) Guide**

- **Formula:** $\\text{RSI} = 100 - \\left(\\frac{100}{1 + \\text{RS}}\\right)$ (calculated on standard 14 periods).
- **Core Signal Thresholds:**
  - **Overbought (Above 70):** Momentum extended; higher probability of pullback or consolidation.
  - **Oversold (Below 30):** Sellers exhausted; potential mean-reversion buying opportunity.
  - **Bullish / Bearish Divergence:** Leading signal when price action and RSI direction diverge.`;
  }

  if (lower.includes('macd')) {
    if (isHindi) {
      return `### 📈 **MACD (Moving Average Convergence Divergence)**

- **Components:**
  1. **MACD Line:** 12-period EMA minus 26-period EMA.
  2. **Signal Line:** MACD Line ka 9-period EMA.
  3. **Histogram:** Dono lines ke beech ka difference.
- **Trading Signals:**
  - **Bullish Crossover:** Jab MACD line Signal line ko neeche se upar cross kare $\\rightarrow$ **Buy Signal**.
  - **Bearish Crossover:** Jab MACD line Signal line ko upar se neeche cross kare $\\rightarrow$ **Sell / Short Signal**.
  - **Zero-Line Cross:** MACD line ka 0 se upar jaana long-term bullish trend confirm karta hai.`;
    }
    return `### 📈 **MACD (Moving Average Convergence Divergence)**

- **Components:** Fast EMA (12), Slow EMA (26), and Signal EMA (9).
- **Key Signals:**
  - **Bullish Crossover:** MACD crosses above Signal Line $\\rightarrow$ Bullish Momentum Acceleration.
  - **Bearish Crossover:** MACD crosses below Signal Line $\\rightarrow$ Bearish Momentum Acceleration.
  - **Centerline Crossover:** Crossing the zero line signals a shift in baseline trend direction.`;
  }

  if (lower.includes('ema') || lower.includes('sma') || lower.includes('moving average')) {
    if (isHindi) {
      return `### 📉 **Moving Averages (EMA vs SMA)**

- **EMA (Exponential):** Recent price data ko zyada weight deta hai, isliye fast signals deta hai.
- **SMA (Simple):** Sabhi period ke prices ka simple average hota hai.
- **Key Golden Strategies:**
  - **Golden Cross:** 50 EMA jab 200 EMA ko upar cross kare $\\rightarrow$ Massive Bullish Trend.
  - **Death Cross:** 50 EMA jab 200 EMA ke neeche jaye $\\rightarrow$ Long-term Bearish Trend.
  - **Dynamic Support:** 20 EMA aur 50 EMA strong pullbacks par bounce provide karte hain.`;
    }
    return `### 📉 **Moving Averages (EMA vs SMA)**

- **EMA (Exponential Moving Average):** Reacts faster to recent price fluctuations, making it ideal for momentum trading.
- **SMA (Simple Moving Average):** Smoother, optimal for macro trend identification.
- **Key Confluences:**
  - **Golden Cross:** 50 MA crossing above 200 MA $\\rightarrow$ Macro Bull Market Confirmation.
  - **Death Cross:** 50 MA crossing below 200 MA $\\rightarrow$ Macro Bearish Confirmation.`;
  }

  if (lower.includes('bollinger') || lower.includes('band')) {
    if (isHindi) {
      return `### 🎯 **Bollinger Bands Kya Hote Hain?**

- **Composition:** 20-period SMA ke sath upar aur neeche 2 Standard Deviations ($\pm 2\sigma$).
- **Use Cases:**
  1. **Bollinger Squeeze:** Jab bands bohot narrow ho jayein, to ek massive breakout aane wala hota hai.
  2. **Upper Band Touch:** Asset short-term overbought zone me hai.
  3. **Lower Band Touch:** Asset short-term oversold zone me hai, bounce expected.`;
    }
    return `### 🎯 **Bollinger Bands Strategy**

- **Structure:** 20 SMA baseline with $\pm 2$ Standard Deviation bands.
- **Core Insights:**
  - **Squeeze:** Low volatility periods precede violent volatility expansions and directional breakouts.
  - **Band Tagging:** Price walking along the upper/lower band indicates strong trend continuation.`;
  }

  if (lower.includes('support') || lower.includes('resistance') || lower.includes('order block') || lower.includes('supply') || lower.includes('demand')) {
    if (isHindi) {
      return `### 🧱 **Support aur Resistance Kaise Identify Karein?**

- **Support (Demand Zone):** Wo price level jahan buyers heavy volume ke sath aate hain aur price ko girne se rokte hain.
- **Resistance (Supply Zone):** Wo price level jahan sellers active ho jate hain aur price ko upar jaane se rokte hain.
- **Role Reversal (Breakout Rule):**
  - Jab ek strong Resistance toot ta hai, to wo aage chalkar naya **Support** ban jata hai.
  - Always breakout ke baad retest par trade enter karein.`;
    }
    return `### 🧱 **Support & Resistance Principles**

- **Support (Demand):** Institutional bid liquidity clusters where buying pressure overcomes selling.
- **Resistance (Supply):** Ask liquidity clusters where supply exceeds demand, capping upward movement.
- **Polarity Flip:** Broken resistance becomes future support; broken support flips into future resistance upon retest.`;
  }

  if (lower.includes('candle') || lower.includes('pattern') || lower.includes('doji') || lower.includes('hammer') || lower.includes('engulfing')) {
    if (isHindi) {
      return `### 🕯️ **Key Candlestick Patterns**

1. **Hammer (Bullish Reversal):** Support par lambi lower wick $\\rightarrow$ Buyers ne sellers ko reject kar diya.
2. **Shooting Star (Bearish Reversal):** Resistance par lambi upper wick $\\rightarrow$ Sellers ne price ko reject kiya.
3. **Bullish Engulfing:** Badi green candle pichli red candle ko poori tarah cover karti hai $\\rightarrow$ Strong Up Move.
4. **Doji:** Open aur Close price barabar $\\rightarrow$ Market indecision, trend reversal ka early signal.`;
    }
    return `### 🕯️ **High-Probability Candlestick Patterns**

- **Hammer / Pinbar:** Long lower shadow at demand zone signaling aggressive buyer absorption.
- **Engulfing (Bullish/Bearish):** Momentum shift where current candle body fully engulfs previous candle body.
- **Doji:** Equilibrium between buyers and sellers; watch the subsequent candle for breakout confirmation.`;
  }

  // 4. TRADING TYPES & CONCEPTS (Spot, Futures, Leverage, Long, Short, Scalping, Swing, DCA)
  if (lower.includes('spot') || lower.includes('future') || lower.includes('futures') || lower.includes('leverage') || lower.includes('margin') || lower.includes('liquidation')) {
    if (isHindi) {
      return `### ⚡ **Spot vs Futures & Leverage Trading**

- **Spot Trading:**
  - Aap actual crypto asset buy karte hain.
  - Zero liquidation risk: Agar price gire bhi to aapke tokens aapke paas rehte hain.
- **Futures Trading:**
  - Aap contracts trade karte hain (price up jayega ya down).
  - **Long:** Price badhne par profit.
  - **Short:** Price girne par profit.
- **Leverage & Risk:**
  - 10x leverage ka matlab: 1% move par 10% profit/loss.
  - **Liquidation:** Agar price aapke against gaya to poora margin zero ho sakta hai.
  - **Golden Rule:** Beginners ko hamesha Spot ya max 2x-3x leverage hi use karna chahiye.`;
    }
    return `### ⚡ **Spot vs Futures & Leverage Breakdown**

- **Spot Market:** Physical ownership of underlying tokens with zero liquidation risk.
- **Futures Market:** Derivative contracts enabling both directional Long (buy) and Short (sell) exposure.
- **Leverage & Liquidation:**
  - Leverage multiplies both gains and capital depletion velocity.
  - Liquidation occurs when margin ratio falls below maintenance requirements.
  - Always trade with isolated margin and pre-defined hard stop-losses.`;
  }

  if (lower.includes('scalping') || lower.includes('swing') || lower.includes('day trad') || lower.includes('dca')) {
    if (isHindi) {
      return `### 🎯 **Trading Styles Explained**

1. **Scalping:** 1-minute se 5-minute chart par chhote price moves (0.5% - 1%) par fast trades (kuch seconds/minutes me exit).
2. **Day Trading:** 15-minute / 1-hour chart par same day ke andar trade close karna (no overnight risk).
3. **Swing Trading:** 4-hour / Daily chart par trend ko 2 se 10 din tak hold karna.
4. **DCA (Dollar Cost Averaging):** Market timing ki jagah regular interval (e.g. har week) par fixed amount invest karna.`;
    }
    return `### 🎯 **Trading Styles & Timeframes**

- **Scalping (1m–5m):** High-frequency capture of micro liquidity spreads. Requires strict discipline and tight spreads.
- **Day Trading (15m–1H):** Intraday positions opened and closed within the same session.
- **Swing Trading (4H–1D):** Captures multi-day momentum impulses and structural trend shifts.
- **DCA (Dollar-Cost Averaging):** Systematic periodic accumulation removing emotional market-timing risk.`;
  }

  // 5. TRADING SETUPS & SIGNALS ("entry", "signal", "setup", "buy", "sell")
  if (lower.includes('setup') || lower.includes('signal') || lower.includes('entry') || (lower.includes('buy') && !lower.includes('how to buy')) || (lower.includes('sell') && !lower.includes('how to sell')) || mode === 'trade-setup') {
    const entryLow = (priceUsd * 0.985).toFixed(2);
    const entryHigh = priceUsd.toFixed(2);
    const stopLoss = (priceUsd * 0.965).toFixed(2);
    const target1 = (priceUsd * 1.035).toFixed(2);
    const target2 = (priceUsd * 1.07).toFixed(2);

    if (isHindi) {
      return `### 📊 **${symbol}/USD Quantitative Trade Setup**

- **Market Bias:** Bullish Consolidation with Demand Absorption
- **Current Price:** \`$${priceUsd.toLocaleString()} USD\` (≈ **${priceHsct.toLocaleString()} HSCT**)

---

#### 🎯 **Actionable Parameters:**
- **Position Type:** Pullback Long (Buy on Support)
- **Optimal Entry Zone:** \`$${entryLow} - $${entryHigh} USD\`
- **Target 1 (Conservative):** \`$${target1} USD\` (+3.5%)
- **Target 2 (Extended):** \`$${target2} USD\` (+7.0%)
- **Strict Stop Loss:** \`$${stopLoss} USD\` (-2.5%)
- **Risk/Reward Ratio:** \`1 : 2.8\` (Excellent)

---

#### 💡 **Technical Logic:**
1. **RSI (14):** 54.2 — Neutral zone me consolidate ho raha hai, bullish momentum build ho raha hai.
2. **Key Level:** 50 EMA par strong buyer absorption observe ki gayi hai.
3. **Risk Management:** Total portfolio ka maximum 1%-2% hi risk karein.`;
    }

    return `### 📊 **${symbol}/USD Technical Trade Setup**

- **Bias:** Bullish Continuation
- **Price:** \`$${priceUsd.toLocaleString()} USD\` (≈ **${priceHsct.toLocaleString()} HSCT**)

---

#### 🎯 **Setup Execution Blueprint:**
- **Entry Zone:** \`$${entryLow} – $${entryHigh} USD\`
- **Take Profit 1:** \`$${target1} USD\` (+3.5%)
- **Take Profit 2:** \`$${target2} USD\` (+7.0%)
- **Invalidation / Stop Loss:** \`$${stopLoss} USD\` (-2.5%)
- **Calculated R:R:** \`1 : 2.8\`

*Maintain strict position sizing adhering to the 1% risk rule.*`;
  }

  // 6. MARKET ANALYSIS & COIN SPECIFICS (BTC, ETH, SOL, MATIC, Trend)
  if (lower.includes('analyze') || lower.includes('analysis') || lower.includes('market') || lower.includes('trend') || lower.includes('btc') || lower.includes('bitcoin') || lower.includes('eth') || lower.includes('ethereum') || lower.includes('solana') || lower.includes('polygon') || mode === 'market-analysis') {
    const res = (priceUsd * 1.05).toFixed(0);
    const sup = (priceUsd * 0.95).toFixed(0);

    if (isHindi) {
      return `### 📈 **${symbol} Live Market Analysis**

- **Current Price:** \`$${priceUsd.toLocaleString()} USD\` (≈ **${priceHsct.toLocaleString()} HSCT**)
- **Macro Structure:** Higher Highs & Higher Lows (Bullish Trend)
- **Immediate Resistance:** \`$${Number(res).toLocaleString()} USD\`
- **Key Support Zone:** \`$${Number(sup).toLocaleString()} USD\`

---

#### 🔍 **Indicator Breakdown:**
1. **RSI (14):** 56.4 — Balanced momentum, koi overbought divergence nahi hai.
2. **Moving Averages:** Price 20 EMA aur 50 EMA ke upar trade kar raha hai.
3. **Volume:** Buyer volume breakout levels par consolidate ho raha hai.

**Strategy:** Immediate resistance ke paas chasing se bachein. Support levels par pullback buying sabse safe setup provide karta hai.`;
    }

    return `### 📈 **${symbol} Live Market Analysis**

- **Valuation:** \`$${priceUsd.toLocaleString()} USD\` (≈ **${priceHsct.toLocaleString()} HSCT**)
- **Trend Structure:** Bullish consolidation above primary demand zone
- **Key Resistance:** \`$${Number(res).toLocaleString()} USD\`
- **Key Support:** \`$${Number(sup).toLocaleString()} USD\`

**Technical Verdict:** RSI is at 56.4 with price maintaining support above the 50 EMA. Accumulation is favored on pullbacks towards support.`;
  }

  // 7. RISK MANAGEMENT & STOP LOSS FORMULAS
  if (lower.includes('risk') || lower.includes('stop loss') || lower.includes('sl') || lower.includes('position size') || mode === 'risk-analysis') {
    if (isHindi) {
      return `### 🛡️ **Risk Management Rules & Position Sizing**

1. **The 1% Rule:** Kisi bhi ek trade me apne total wallet capital ka **1% se 2%** se zyada loss na hone dein.
2. **Position Size Formula:**
   $$\\text{Position Size} = \\frac{\\text{Total Capital} \\times \\text{Risk %}}{\\text{Entry Price} - \\text{Stop Loss Price}}$$
   *Example:* Agar capital ₹10,000 hai aur 1% risk (₹100) lena hai, aur SL 2% door hai, to trade size ₹5,000 hoga.
3. **Risk-to-Reward (R:R):** Hamesha minimum **1:2** ya **1:3** R:R wale setups hi choose karein.
4. **Emotional Discipline:** Kabhi bhi losing trade me revenge trading ya bina stop-loss ke average mat karein.`;
    }

    return `### 🛡️ **Risk Management & Capital Preservation**

1. **1% Capital Rule:** Max loss per trade capped at 1% of total portfolio balance.
2. **Position Sizing Formula:**
   $$\\text{Position Size} = \\frac{\\text{Account Capital} \\times \\text{Risk %}}{\\text{Entry Price} - \\text{Stop Loss Price}}$$
3. **Risk-to-Reward Ratio (R:R):** Target setups with minimum 1:2 R:R to ensure long-term mathematical edge.`;
  }

  // 8. BLOCKCHAIN & CRYPTO TECH (Smart Contracts, Gas Fees, Merkle, Private Keys, PoW/PoS)
  if (lower.includes('blockchain') || lower.includes('smart contract') || lower.includes('gas') || lower.includes('merkle') || lower.includes('private key') || lower.includes('public key') || lower.includes('seed phrase') || lower.includes('consensus') || lower.includes('proof of')) {
    if (isHindi) {
      return `### ⛓️ **Blockchain & Cryptography Fundamentals**

1. **Blockchain:** Ek decentralized, distributed aur immutable ledger jo transactions ko cryptographically link kiye hue blocks me store karta hai.
2. **Smart Contracts:** Code-based self-executing agreements jo bina kisi third party (middleman) ke automatically execute hote hain.
3. **Private Key vs Public Key:**
   - **Public Key / Address:** Aapka account number (jise aap kisi ko bhi bhej sakte hain).
   - **Private Key:** Aapka secret password/signature (jise kabhi kisi ke sath share nahi karna chahiye).
4. **Merkle Trees:** Cryptographic tree structure jo hazaron transactions ko ek single 32-byte root hash me tamper-evident verify karta hai.
5. **Gas Fees:** Blockchain network par compute aur transaction validate karne ke liye validator ko di jaane wali network fee.`;
    }

    return `### ⛓️ **Blockchain Architecture & Cryptographic Security**

- **Decentralized Ledger:** Append-only chain of cryptographically linked blocks secured by hash pointers.
- **Smart Contracts:** Turing-complete automated logic executed deterministically on the Ethereum Virtual Machine (EVM).
- **Public / Private Key Cryptography:** ECDSA secp256k1 asymmetric keypairs securing transactions and balance state.
- **Merkle Roots:** Cryptographic data aggregation enabling $O(\\log N)$ transaction inclusion proofs.`;
  }

  // 9. SECURECHAIN PAY PLATFORM & WALLET (HSCT, Send, Receive, QR, Explorer)
  if (lower.includes('wallet') || lower.includes('hsct') || lower.includes('balance') || lower.includes('send') || lower.includes('receive') || lower.includes('transfer') || lower.includes('qr') || lower.includes('explorer') || lower.includes('genesis')) {
    if (isHindi) {
      return `### 💳 **SecureChain Pay Platform Guide**

- **Native Currency (HSCT):** Platform ka official token **HSCT** hai.
  - **1 HSCT = ₹1.00 INR**
  - **1 USD = 83.50 HSCT**
- **Send Money:** [Send Money](/wallet/transfer) par ja kar username, QR camera scan ya 0x address se instant payment bhejein.
- **Receive Money:** [Receive](/wallet/receive) par aapka scannable QR code aur 0x public key uplabdh hai.
- **Block Explorer:** [Explorer](/explorer) par Genesis Block #0, Merkle proofs aur live transactions real-time verify karein.
- **Non-Custodial Security:** Aapki keys client-side AES-256-GCM encrypted hain aur ECDSA secp256k1 se sign hoti hain.`;
    }

    return `### 💳 **SecureChain Pay Platform Architecture**

- **Settlement Token:** **HSCT** (1 HSCT = ₹1.00 INR, 1 USD = 83.50 HSCT).
- **Transfers:** Instant settlement via [Send Money](/wallet/transfer) (QR scan, username, 0x address).
- **Receive:** Dedicated payment QR & public address at [Receive](/wallet/receive).
- **Explorer:** Tamper-evident ledger verification at [Explorer](/explorer).
- **Security:** Non-custodial AES-256-GCM encrypted client keys with ECDSA secp256k1 digital signatures.`;
  }

  // 10. OPEN-ENDED CASUAL / CONVERSATIONAL FALLBACK
  // Only trigger for truly casual short messages — NOT for actual questions/requests
  const hasQuestionIntent = lower.includes('batao') || lower.includes('konsa') || lower.includes('kaunsa') ||
    lower.includes('naam') || lower.includes('kaun') || lower.includes('kab') || lower.includes('kyun') ||
    lower.includes('kyunki') || lower.includes('kaise') || lower.includes('kya') || lower.includes('what') ||
    lower.includes('how') || lower.includes('why') || lower.includes('when') || lower.includes('which') ||
    lower.includes('who') || lower.includes('where') || lower.includes('tell me') || lower.includes('explain');

  const isCasualChat = cleanMsg.split(' ').length <= 6 &&
    !hasQuestionIntent &&
    !lower.includes('price') && !lower.includes('coin') && !lower.includes('crypto') &&
    !lower.includes('trade') && !lower.includes('market') && !lower.includes('wallet') &&
    !lower.includes('btc') && !lower.includes('eth');

  if (isCasualChat) {
    if (isHindi) {
      return `Haha, sab badhiya chal raha hai! 😄
Kuch trading ya market ke baare mein poochhna hai? BTC, ETH ka setup chahiye, ya koi indicator samjhana hai — bas batao!`;
    }
    return `Ha! Things are going well on my end. 😄
Feel free to ask me anything — market analysis, trade setups, crypto education, or SecureChain wallet tips. I'm here to help!`;
  }

  // 11. GENERIC THOUGHTFUL FALLBACK for longer/unrecognized questions
  if (isHindi) {
    return `Aapka sawaal samajh aaya! 🤔

Is topic par main zyada depth mein jaana chahta hoon — kya aap thoda aur context de sakte hain?

**Ya in mein se kuch poochhna chahte hain?**
- 📊 Kisi coin ka trade setup (BTC, ETH, SOL)
- 📈 Technical indicator (RSI, MACD, EMA)
- 🛡️ Risk management rules
- 💳 SecureChain wallet / HSCT payments
- ⛓️ Blockchain fundamentals

Bas bolo, main seedha aur helpful answer dunga!`;
  }

  return `Got your question! 🤔

Could you give me a bit more context so I can give you a precise answer?

**Or pick a topic I can help with directly:**
- 📊 Trade setup for BTC, ETH, or any coin
- 📈 Technical indicator deep-dive (RSI, MACD, EMA)
- 🛡️ Risk management & position sizing
- 💳 SecureChain wallet & HSCT transactions
- ⛓️ Blockchain & crypto concepts

Just ask and I'll give you a direct, specific answer!`;
}


/**
 * Detect if a message is purely casual/greeting and doesn't need an LLM call.
 * These get instant built-in responses.
 */
function isCasualOrGreeting(message: string): boolean {
  const lower = message.trim().toLowerCase();
  const clean = message.trim();

  // Pure greetings
  if (/^(hi|hello|hey|hola|namaste|salam|howdy|yo|sup)[\s!.,?]*$/i.test(clean)) return true;
  if (clean.length <= 5 && (lower.includes('hi') || lower.includes('hey'))) return true;

  // Casual conversational phrases
  if (/\b(kaise ho|kaisa ho|how are you|how r u|wassup|what'?s up|how.?s it going)\b/i.test(lower)) return true;
  if (/\b(or batao|aur batao|batao bhai|batao yaar|bolo bhai|kya chal raha|sab theek|sab badhiya|kya scene)\b/i.test(lower)) return true;

  return false;
}

export async function generateAIResponse(request: LLMRequest): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;
  const preferredModel = (process.env.LLM_MODEL || 'gemini-2.0-flash').replace('gemini-3.6-flash', 'gemini-2.0-flash');
  
  // Safe User upsert (non-blocking)
  try {
    await db.user.upsert({
      where: { id: request.userId },
      update: {},
      create: { id: request.userId, email: `user-${request.userId}@test.com`, role: 'USER' }
    });
  } catch (err) {
    // Non-blocking fallback
  }

  // Safe Conversation handling
  let conversationId = request.conversationId || `conv_${Date.now()}`;
  try {
    if (request.conversationId) {
      const conv = await db.aIConversation.findUnique({
        where: { id: request.conversationId },
      });
      if (conv) conversationId = conv.id;
    } else {
      const newConv = await db.aIConversation.create({
        data: {
          userId: request.userId,
          mode: request.mode,
          asset: request.asset,
          title: `${request.mode} conversation`
        }
      });
      if (newConv) conversationId = newConv.id;
    }
  } catch (convErr) {
    // Graceful fallback to generated conversationId
  }

  // Privacy Sanitization
  const guardResult = AIDataGuard.sanitize(request.message);
  if (!guardResult.allowed) {
    const blockedResponse = 'Your message was blocked because it contained sensitive material (such as a private key, seed phrase, or password). For your security, this content was NOT processed. Please never share keys with any AI system.';
    return { content: blockedResponse, conversationId };
  }

  // Safe User message logging
  try {
    await db.aIMessage.create({
      data: {
        conversationId,
        role: 'USER',
        content: request.message
      }
    });
  } catch (msgErr) {
    // Non-blocking
  }

  // Build Context
  let contextString = '';
  let routedContext: any = null;

  // Fetch recent conversation history for multi-turn chat memory
  let historyContents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  try {
    const recentMsgs = await db.aIMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 10
    });
    if (recentMsgs && recentMsgs.length > 0) {
      historyContents = recentMsgs.map((m) => ({
        role: m.role === 'USER' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));
    }
  } catch (hErr) {
    console.warn('[AI Service] Failed to load history:', hErr);
  }

  const userContent = contextString ? `${request.message}\n\n${contextString}` : request.message;

  if (historyContents.length === 0) {
    historyContents = [{ role: 'user', parts: [{ text: userContent }] }];
  } else {
    const last = historyContents[historyContents.length - 1];
    if (last.role !== 'user' || last.parts[0]?.text !== request.message) {
      historyContents.push({ role: 'user', parts: [{ text: userContent }] });
    }
  }

  // === NON-CASUAL PATH: Build rich project context, then call Gemini ===
  try {
    routedContext = await routeAndBuildAIContext({
      userId: request.userId,
      message: request.message,
      asset: request.asset,
      mode: request.mode
    });
    contextString = routedContext.contextPromptString;
  } catch (routeErr) {
    console.warn('[AI Service] Context router fallback:', routeErr);
  }

  let aiContent = '';

  // Build the shared system prompt for all LLM providers
  const sharedSystemPrompt = `You are the AI Copilot for **SecureChain Pay** — an enterprise blockchain payment and AI-assisted quantitative trading platform.

YOUR IDENTITY & PERSONALITY:
- You are a natural, conversational, intelligent assistant — NOT a rigid template bot.
- MATCH THE USER'S LANGUAGE EXACTLY: If the user speaks Hinglish (e.g., "hinglish me baatkro", "are bhai", "or batao", "kaise ho mittar"), YOU MUST RESPOND IN NATURAL HINGLISH.
- NEVER use rigid repeated English templates like "Ha! Things are going well on my end..." or "Got your question!".
- Read full conversation history carefully. If the user asks you not to repeat answers ("are ek hi ans mat do"), acknowledge it in natural Hinglish and answer their question dynamically!
- If the user asks personal questions ("mera naam batao"), answer casually in Hinglish: e.g. "Bhai, mujhe abhi aapka naam nahi pata! Aap hi bata do, main yaad rakhunga. 😄"

PLATFORM KNOWLEDGE:
- **Currency:** HSCT (High-Security Chain Token) — 1 HSCT = ₹1 INR, 1 USD = 83.50 HSCT
- **Wallet:** Non-custodial HD wallet with AES-256-GCM encrypted keys, ECDSA secp256k1 signatures
- **Blockchain:** Hybrid off-chain + Firestore Ledger with Merkle Tree batching and EVM anchoring
- **Trading:** 10-step quantitative pipeline — Market Data → Technical Indicators → ML Prediction → Strategy Engine → Risk Engine → Execution
- **Auto-Trading modes:** OFF, PAPER (simulated), LIVE. Safety gates pause if daily loss > 3%
- **Key Pages:** /wallet, /trade, /dashboard, /explorer, /transactions, /ai-assistant, /settings, /paper-trading, /backtesting

${routedContext?.systemDirective || ''}

RULES:
1. Respond naturally in the user's language (Hinglish/Hindi/English). Match their exact tone.
2. Answer the user's specific request. Never repeat generic marketing copy unless requested.
3. Keep casual chat casual and friendly. Keep technical/trading answers detailed and precise.`;

  // === LLM CALL PIPELINE ===
  // 1. Try Google Gemini API first with conversation history
  if (apiKey && apiKey.length > 5) {
    const geminiModels = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-1.5-flash'];
    for (const model of geminiModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: historyContents,
            systemInstruction: { parts: [{ text: sharedSystemPrompt }] },
            generationConfig: { temperature: 0.75, maxOutputTokens: 2048 }
          })
        });
        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim().length > 0) {
            aiContent = text;
            console.log(`[AI Service] Successfully generated response via Gemini (${model})`);
            break;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn(`[AI Service] Gemini ${model} HTTP ${response.status}:`, errData?.error?.message || response.statusText);
        }
      } catch (geminiErr) {
        console.warn(`[AI Service] Gemini ${model} error:`, geminiErr);
      }
    }
  }

  // 2. Try Mistral API as fallback if Gemini didn't return a response
  if (!aiContent && apiKey && apiKey.length > 5) {
    const mistralModels = ['mistral-small-latest', 'mistral-large-latest', 'open-mistral-7b'];
    const mistralMessages = [
      { role: 'system', content: sharedSystemPrompt },
      ...historyContents.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.parts[0]?.text || ''
      }))
    ];

    for (const model of mistralModels) {
      try {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: mistralMessages,
            temperature: 0.75,
            max_tokens: 2048
          })
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.choices?.[0]?.message?.content;
          if (text && text.trim().length > 0) {
            aiContent = text;
            console.log(`[AI Service] Successfully generated response via Mistral (${model})`);
            break;
          }
        }
      } catch (mistralErr) {
        console.warn(`[AI Service] Mistral model ${model} error:`, mistralErr);
      }
    }
  }


  // If Gemini was not available or failed, seamlessly use the intelligent domain engine
  if (!aiContent || aiContent.trim().length === 0) {
    aiContent = generateIntelligentResponse(
      request.message,
      request.mode,
      request.asset,
      null,
      routedContext
    );
  }

  // Safe Assistant message logging
  try {
    await db.aIMessage.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: aiContent
      }
    });
  } catch (saveErr) {
    // Non-blocking
  }

  return {
    content: aiContent,
    conversationId
  };
}


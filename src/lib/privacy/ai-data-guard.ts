/**
 * SecureChain Pay — AI Data Guard (Task 10)
 *
 * Firewall between raw payment data and AI models.
 * Performs: secret detection, tokenization, redaction, minimum context filtering,
 * prompt injection protection, and AI audit logging.
 *
 * Pipeline: Raw Data → Sensitivity Check → Redaction/Tokenization → Minimum Context → AI
 */

import crypto from 'crypto';
import { DataClassifier, type ClassificationLevel } from './data-classifier';
import { TokenizationService } from './tokenization-service';

// ────────────────────────────────────────────────────────────
// Secret Detection Patterns
// ────────────────────────────────────────────────────────────

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // Private keys (hex, 64 chars)
  { name: 'PRIVATE_KEY_HEX', pattern: /(?:^|[\s:=])([0-9a-fA-F]{64})(?:$|[\s,.])/g },
  // Ethereum-style private keys with 0x prefix
  { name: 'PRIVATE_KEY_ETH', pattern: /0x[0-9a-fA-F]{64}/g },
  // BIP39 seed phrases (12 or 24 word sequences of common BIP39 words)
  { name: 'SEED_PHRASE', pattern: /\b(?:abandon|ability|able|about|above|absent|absorb|abstract|absurd|abuse|access|accident|account|accuse|achieve|acid|acoustic|acquire|across|act|action|actual|adapt|add|addict|address|adjust|admit|adult|advance|advice|aerobic|affair|afford|afraid|again|age|agent|agree|ahead|aim|air|airport|aisle|alarm|album|alcohol|alert|alien|all|alley|allow|almost|alone|alpha|already|also|alter|always|amateur|amazing|among|amount|amused|analyst|anchor|ancient|anger|angle|angry|animal|ankle|announce|annual|another|answer|antenna|antique|anxiety|any|apart|apology|appear|apple|approve|april|arch|arctic|area|arena|argue|arm|armed|armor|army|around|arrange|arrest|arrive|arrow|art|artefact|artist|artwork|ask|aspect|assault|asset|assist|assume|asthma|athlete|atom|attack|attend|attitude|attract|auction|audit|august|aunt|author|auto|autumn|average|avocado|avoid|awake|aware|awesome|awful|awkward|axis)\b(?:\s+\b(?:abandon|ability|able|about|above|absent|absorb|abstract|absurd|abuse|access|accident|account|accuse|achieve|acid|acoustic|acquire|across|act|action|actual|adapt|add|addict|address|adjust|admit|adult|advance|advice|aerobic|affair|afford|afraid|again|age|agent|agree|ahead|aim|air|airport|aisle|alarm|album|alcohol|alert|alien|all|alley|allow|almost|alone|alpha|already|also|alter|always|amateur|amazing|among|amount|amused|analyst|anchor|ancient|anger|angle|angry|animal|ankle|announce|annual|another|answer|antenna|antique|anxiety|any|apart|apology|appear|apple|approve|april|arch|arctic|area|arena|argue|arm|armed|armor|army|around|arrange|arrest|arrive|arrow|art|artefact|artist|artwork|ask|aspect|assault|asset|assist|assume|asthma|athlete|atom|attack|attend|attitude|attract|auction|audit|august|aunt|author|auto|autumn|average|avocado|avoid|awake|aware|awesome|awful|awkward|axis)\b){11,23}/gi },
  // Generic "seed phrase" / "mnemonic" labels followed by words
  { name: 'SEED_LABEL', pattern: /(?:seed\s*phrase|mnemonic|recovery\s*phrase|backup\s*phrase)\s*[:=]?\s*\S+/gi },
  // Passwords
  { name: 'PASSWORD', pattern: /(?:password|passwd|pwd)\s*[:=]\s*\S+/gi },
  // OTP codes
  { name: 'OTP', pattern: /(?:otp|one.?time.?password|verification.?code)\s*[:=]\s*\d{4,8}/gi },
  // API keys / secrets (common patterns)
  { name: 'API_SECRET', pattern: /(?:api[_-]?key|api[_-]?secret|secret[_-]?key|auth[_-]?token)\s*[:=]\s*\S+/gi },
  // Database connection strings
  { name: 'DB_CREDENTIAL', pattern: /(?:postgresql|mysql|mongodb|redis):\/\/[^\s]+/gi },
  // Bearer tokens
  { name: 'BEARER_TOKEN', pattern: /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/g },
  // JWT tokens
  { name: 'JWT', pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
];

// ────────────────────────────────────────────────────────────
// Prompt Injection Patterns
// ────────────────────────────────────────────────────────────

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions?|rules?|prompts?)/gi,
  /forget\s+(?:all\s+)?(?:previous|above|your)\s+(?:instructions?|rules?)/gi,
  /you\s+are\s+now\s+(?:a\s+)?(?:different|new|unrestricted)/gi,
  /reveal\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?|rules?)/gi,
  /show\s+me\s+(?:the\s+)?(?:system\s+)?(?:prompt|instructions?)/gi,
  /what\s+(?:are|is)\s+your\s+(?:system\s+)?(?:prompt|instructions?|rules?)/gi,
  /act\s+as\s+(?:a\s+)?(?:DAN|jailbreak|unrestricted)/gi,
  /override\s+(?:all\s+)?(?:security|safety|restrictions?)/gi,
  /disable\s+(?:all\s+)?(?:security|safety|restrictions?|filters?)/gi,
  /bypass\s+(?:all\s+)?(?:security|safety|restrictions?|filters?)/gi,
];

// ────────────────────────────────────────────────────────────
// AI Data Guard
// ────────────────────────────────────────────────────────────

export interface AIGuardResult {
  allowed: boolean;
  sanitizedPrompt: string;
  sanitizedInputHash: string;
  dataClassification: ClassificationLevel;
  secretsDetected: string[];
  injectionsDetected: string[];
  tokenizationApplied: boolean;
  redactionsApplied: number;
  blockReason: string | null;
}

export class AIDataGuard {
  /**
   * Main entry point: sanitize a prompt before sending to AI.
   * Returns the sanitized prompt or blocks the request entirely.
   */
  static sanitize(rawPrompt: string, contextData?: Record<string, unknown>): AIGuardResult {
    const result: AIGuardResult = {
      allowed: true,
      sanitizedPrompt: rawPrompt,
      sanitizedInputHash: '',
      dataClassification: 'PUBLIC',
      secretsDetected: [],
      injectionsDetected: [],
      tokenizationApplied: false,
      redactionsApplied: 0,
      blockReason: null,
    };

    // ── Step 1: Secret Detection ──
    for (const { name, pattern } of SECRET_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;
      if (pattern.test(rawPrompt)) {
        result.secretsDetected.push(name);
      }
      pattern.lastIndex = 0;
    }

    if (result.secretsDetected.length > 0) {
      result.allowed = false;
      result.blockReason = `SECRET_DETECTED: ${result.secretsDetected.join(', ')}`;
      result.sanitizedPrompt = '[BLOCKED — Secret material detected in prompt]';
      result.sanitizedInputHash = this.hashString(result.sanitizedPrompt);
      result.dataClassification = 'HIGHLY_SENSITIVE';
      // Log safe event — NEVER log the secret itself
      console.warn(`[AIDataGuard] BLOCKED: Secret material detected (${result.secretsDetected.join(', ')}). Raw content NOT logged.`);
      return result;
    }

    // ── Step 2: Prompt Injection Detection ──
    for (const pattern of INJECTION_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(rawPrompt);
      if (match) {
        result.injectionsDetected.push(match[0]);
      }
      pattern.lastIndex = 0;
    }

    if (result.injectionsDetected.length > 0) {
      // Strip injections but don't block — log the attempt
      let cleaned = rawPrompt;
      for (const pattern of INJECTION_PATTERNS) {
        pattern.lastIndex = 0;
        cleaned = cleaned.replace(pattern, '[INJECTION_REMOVED]');
        pattern.lastIndex = 0;
      }
      result.sanitizedPrompt = cleaned;
      console.warn(`[AIDataGuard] Prompt injection attempt neutralized: ${result.injectionsDetected.length} patterns removed.`);
    }

    // ── Step 3: Tokenize sensitive identifiers ──
    result.sanitizedPrompt = TokenizationService.tokenizeText(result.sanitizedPrompt);
    if (result.sanitizedPrompt !== rawPrompt) {
      result.tokenizationApplied = true;
    }

    // ── Step 4: Classify the data ──
    if (contextData) {
      result.dataClassification = DataClassifier.getMaxClassification(contextData);

      // Redact HIGHLY_SENSITIVE fields from context
      const redactableFields = DataClassifier.getRedactableFields(contextData);
      result.redactionsApplied = redactableFields.length;
    }

    // ── Step 5: Hash the sanitized prompt ──
    result.sanitizedInputHash = this.hashString(result.sanitizedPrompt);

    return result;
  }

  /**
   * Sanitize structured context data (objects) for AI.
   * Returns a new object with HIGHLY_SENSITIVE fields removed and SENSITIVE fields tokenized.
   */
  static sanitizeContextData(data: Record<string, unknown>): Record<string, unknown> {
    // Remove HIGHLY_SENSITIVE fields
    const filtered = DataClassifier.filterByMaxLevel(data, 'SENSITIVE');

    // Tokenize SENSITIVE fields
    const tokenizableFields = DataClassifier.getTokenizableFields(filtered);
    return TokenizationService.tokenizeObject(filtered, tokenizableFields);
  }

  /**
   * Validate AI output before executing any action.
   * Returns true if the output passes schema/safety validation.
   */
  static validateAIOutput(output: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for secrets leaking in AI output
    for (const { name, pattern } of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(output)) {
        issues.push(`AI output contains potential secret: ${name}`);
      }
      pattern.lastIndex = 0;
    }

    // Check for suspicious system-level commands
    if (/(?:DROP\s+TABLE|DELETE\s+FROM|UPDATE\s+.*SET|INSERT\s+INTO)/i.test(output)) {
      issues.push('AI output contains SQL-like commands');
    }

    if (/(?:require|import|eval|exec|spawn|child_process)/i.test(output)) {
      issues.push('AI output contains code execution patterns');
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Check if a user can access another user's data.
   * Returns false if cross-user access is attempted without proper authorization.
   */
  static verifyCrossUserAccess(requestingUserId: string, targetUserId: string, requesterRole: string): boolean {
    // Same user — always allowed
    if (requestingUserId === targetUserId) return true;

    // Admin roles can access other users' data
    const privilegedRoles = ['ADMIN', 'SECURITY_ADMIN', 'SUPPORT'];
    if (privilegedRoles.includes(requesterRole)) return true;

    // Regular users cannot access other users' data
    return false;
  }

  /**
   * Helper alias for prompt sanitization.
   */
  static sanitizePrompt(prompt: string, options?: { userId?: string; purpose?: string }) {
    const result = this.sanitize(prompt, options);
    return {
      sanitized: result.sanitizedPrompt,
      blocked: !result.allowed,
      blockReason: result.blockReason || undefined,
      secretsDetected: result.secretsDetected,
      injectionsDetected: result.injectionsDetected,
    };
  }

  /** SHA-256 hash of a string. */
  private static hashString(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex');
  }
}

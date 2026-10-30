import { secp256k1 } from '@noble/curves/secp256k1.js';
import crypto from 'crypto';

// Elliptic curve and generators
const Point = secp256k1.Point;
const CURVE_ORDER: bigint = Point.Fn.ORDER;
const G = Point.BASE;

// Deterministic Nothing-Up-My-Sleeve Generator H derived from SHA-256("ZKP_PEDERSEN_H_GENERATOR_V1")
export const H_GENERATOR_HEX = '0256675bbe9233fd767a83001ea28bffe3e802c7641042e4734417e8ed11d11cc5';
const H = Point.fromHex(H_GENERATOR_HEX);

// Bit-decomposition bit width (covers integers up to 2^20 - 1 = 1,048,575)
export const ZKP_BIT_WIDTH = 20;

/**
 * Standard scalar field modulo helper
 */
export function modN(a: bigint): bigint {
  const res = a % CURVE_ORDER;
  return res >= 0n ? res : res + CURVE_ORDER;
}

/**
 * Safe point multiplication supporting 0 (returns Point.ZERO)
 */
export function safeMul(point: typeof Point.BASE, scalar: bigint): typeof Point.BASE {
  const s = modN(scalar);
  if (s === 0n) return Point.ZERO;
  return point.multiply(s);
}

/**
 * Derives a cryptographically secure random scalar in [1, CURVE_ORDER - 1]
 */
export function generateRandomScalar(): bigint {
  let s = 0n;
  while (s === 0n) {
    s = modN(BigInt('0x' + crypto.randomBytes(32).toString('hex')));
  }
  return s;
}

/**
 * Hashes inputs to a scalar challenge in [0, CURVE_ORDER - 1] using SHA-256
 */
export function hashToScalar(...items: (string | bigint | Buffer)[]): bigint {
  const hash = crypto.createHash('sha256');
  for (const item of items) {
    if (typeof item === 'string') {
      hash.update(item);
    } else if (typeof item === 'bigint') {
      hash.update(item.toString(16).padStart(64, '0'));
    } else if (Buffer.isBuffer(item)) {
      hash.update(item);
    }
  }
  return modN(BigInt('0x' + hash.digest('hex')));
}

/**
 * Computes a Pedersen commitment: C = v*G + r*H
 */
export function createPedersenCommitment(value: bigint, blinding: bigint): string {
  const pt = safeMul(G, value).add(safeMul(H, blinding));
  return pt.toHex(true);
}

/**
 * Computes deterministic vehicle commitment: SHA256("VEH_ID_V1" || vehicleId || vin)
 */
export function computeVehicleCommitment(vehicleId: string, vin: string): string {
  return '0x' + crypto.createHash('sha256')
    .update(`VEH_ID_V1:${vehicleId.trim()}:${vin.trim()}`)
    .digest('hex');
}

export interface BitProof {
  e0: string; // hex scalar
  e1: string; // hex scalar
  s0: string; // hex scalar
  s1: string; // hex scalar
}

export interface ZkpRangeProofPayload {
  proofSystem: 'PEDERSEN_NIZK_RANGE_V1';
  bitWidth: number;
  commitment: string; // C in compressed hex
  threshold: number; // T
  deltaCommitment: string; // C_delta in compressed hex
  bitCommitments: string[]; // C_j compressed hex
  linearAnnouncement: string; // A_lin compressed hex
  linearResponse: string; // s_lin in hex scalar
  bitProofs: BitProof[];
  vehicleCommitment: string;
  claimType: string;
  nonce: string;
}

export interface VerificationResult {
  valid: boolean;
  error?: string;
  statement: string;
  publicInputs: {
    vehicleCommitment: string;
    claimType: string;
    threshold: number;
    commitment: string;
    nonce: string;
  };
  verificationDurationMs: number;
  timestamp: string;
}

/**
 * Generates a genuine Non-Interactive Zero-Knowledge Range Proof that committed value v <= threshold.
 */
export function generateRangeProof(params: {
  value: number;
  blinding: string | bigint;
  threshold: number;
  vehicleCommitment: string;
  claimType: string;
  nonce: string;
}): ZkpRangeProofPayload {
  const v = BigInt(params.value);
  const T = BigInt(params.threshold);
  const r = typeof params.blinding === 'string' ? BigInt(params.blinding) : params.blinding;

  if (v < 0n) {
    throw new Error('Value must be non-negative');
  }
  if (v > T) {
    throw new Error(`Value ${v} exceeds threshold ${T}; cannot prove false claim`);
  }

  const delta = T - v;
  const maxRepresentable = (1n << BigInt(ZKP_BIT_WIDTH)) - 1n;
  if (delta > maxRepresentable) {
    throw new Error(`Delta ${delta} exceeds maximum bit width representation (${maxRepresentable})`);
  }

  // 1. Pedersen commitment to value: C = v*G + r*H
  const C = safeMul(G, v).add(safeMul(H, r));

  // 2. Commitment to delta: C_delta = T*G - C = delta*G + (-r)*H
  const C_delta = safeMul(G, T).subtract(C);

  // 3. Bit decomposition of delta
  const bits: bigint[] = [];
  for (let j = 0; j < ZKP_BIT_WIDTH; j++) {
    bits.push((delta >> BigInt(j)) & 1n);
  }

  const bitBlindings: bigint[] = [];
  const bitCommitmentPoints: (typeof Point.BASE)[] = [];
  for (let j = 0; j < ZKP_BIT_WIDTH; j++) {
    const rj = generateRandomScalar();
    bitBlindings.push(rj);
    const Cj = safeMul(G, bits[j]).add(safeMul(H, rj));
    bitCommitmentPoints.push(Cj);
  }

  // 4. Linear combination sum of bits
  let sumBits = Point.ZERO;
  let sumBitBlindings = 0n;
  for (let j = 0; j < ZKP_BIT_WIDTH; j++) {
    const weight = 1n << BigInt(j);
    sumBits = sumBits.add(safeMul(bitCommitmentPoints[j], weight));
    sumBitBlindings = modN(sumBitBlindings + weight * bitBlindings[j]);
  }
  const r_diff = modN(sumBitBlindings + r); // because -(-r) = +r

  // Linear Schnorr announcement: A_lin = w_lin * H
  const w_lin = generateRandomScalar();
  const A_lin = safeMul(H, w_lin);

  // 5. Fiat-Shamir global challenge bound to domain, vehicle, claim, threshold, and nonce
  const bitCommitmentHexes = bitCommitmentPoints.map(pt => pt.toHex(true)).join('');
  const e_global = hashToScalar(
    'ZKP_RANGE_V1',
    params.vehicleCommitment,
    params.claimType,
    T,
    params.nonce,
    C.toHex(true),
    C_delta.toHex(true),
    bitCommitmentHexes,
    A_lin.toHex(true)
  );

  const s_lin = modN(w_lin + e_global * r_diff);

  // 6. CDS94 1-out-of-2 OR-proofs for each bit
  const bitProofs: BitProof[] = [];
  for (let j = 0; j < ZKP_BIT_WIDTH; j++) {
    const b = bits[j];
    const rj = bitBlindings[j];
    const Cj = bitCommitmentPoints[j];

    if (b === 0n) {
      // Real branch 0, Simulated branch 1
      const e1 = generateRandomScalar();
      const s1 = generateRandomScalar();
      const A1 = safeMul(H, s1).subtract(safeMul(Cj.subtract(G), e1));

      const w0 = generateRandomScalar();
      const A0 = safeMul(H, w0);

      const ej = hashToScalar(e_global, BigInt(j), Cj.toHex(true), A0.toHex(true), A1.toHex(true));
      const e0 = modN(ej - e1);
      const s0 = modN(w0 + e0 * rj);

      bitProofs.push({
        e0: '0x' + e0.toString(16).padStart(64, '0'),
        e1: '0x' + e1.toString(16).padStart(64, '0'),
        s0: '0x' + s0.toString(16).padStart(64, '0'),
        s1: '0x' + s1.toString(16).padStart(64, '0'),
      });
    } else {
      // Real branch 1, Simulated branch 0
      const e0 = generateRandomScalar();
      const s0 = generateRandomScalar();
      const A0 = safeMul(H, s0).subtract(safeMul(Cj, e0));

      const w1 = generateRandomScalar();
      const A1 = safeMul(H, w1);

      const ej = hashToScalar(e_global, BigInt(j), Cj.toHex(true), A0.toHex(true), A1.toHex(true));
      const e1 = modN(ej - e0);
      const s1 = modN(w1 + e1 * rj);

      bitProofs.push({
        e0: '0x' + e0.toString(16).padStart(64, '0'),
        e1: '0x' + e1.toString(16).padStart(64, '0'),
        s0: '0x' + s0.toString(16).padStart(64, '0'),
        s1: '0x' + s1.toString(16).padStart(64, '0'),
      });
    }
  }

  return {
    proofSystem: 'PEDERSEN_NIZK_RANGE_V1',
    bitWidth: ZKP_BIT_WIDTH,
    commitment: C.toHex(true),
    threshold: params.threshold,
    deltaCommitment: C_delta.toHex(true),
    bitCommitments: bitCommitmentPoints.map(pt => pt.toHex(true)),
    linearAnnouncement: A_lin.toHex(true),
    linearResponse: '0x' + s_lin.toString(16).padStart(64, '0'),
    bitProofs,
    vehicleCommitment: params.vehicleCommitment,
    claimType: params.claimType,
    nonce: params.nonce,
  };
}

/**
 * Independently verifies a Non-Interactive Zero-Knowledge Range Proof.
 */
export function verifyRangeProof(
  proof: ZkpRangeProofPayload,
  expectedInputs: {
    vehicleCommitment: string;
    claimType: string;
    threshold: number;
    nonce: string;
    expectedCommitment?: string;
  }
): VerificationResult {
  const startTime = Date.now();
  const publicInputs = {
    vehicleCommitment: expectedInputs.vehicleCommitment,
    claimType: expectedInputs.claimType,
    threshold: expectedInputs.threshold,
    commitment: proof.commitment,
    nonce: expectedInputs.nonce,
  };

  try {
    // 1. Validate structure and system version
    if (proof.proofSystem !== 'PEDERSEN_NIZK_RANGE_V1') {
      return {
        valid: false,
        error: `Unsupported proof system: ${proof.proofSystem}`,
        statement: 'Range proof system verification',
        publicInputs,
        verificationDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    if (proof.bitWidth !== ZKP_BIT_WIDTH || !proof.bitCommitments || proof.bitCommitments.length !== ZKP_BIT_WIDTH) {
      return {
        valid: false,
        error: `Invalid bit width or bit commitments length; expected ${ZKP_BIT_WIDTH}`,
        statement: 'Range proof bit decomposition verification',
        publicInputs,
        verificationDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Strict public inputs binding check
    if (proof.vehicleCommitment.toLowerCase() !== expectedInputs.vehicleCommitment.toLowerCase()) {
      return {
        valid: false,
        error: 'Vehicle commitment mismatch: proof was generated for a different vehicle',
        statement: 'Vehicle commitment binding check',
        publicInputs,
        verificationDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    if (proof.claimType !== expectedInputs.claimType) {
      return {
        valid: false,
        error: `Claim type mismatch: expected ${expectedInputs.claimType}, got ${proof.claimType}`,
        statement: 'Claim type binding check',
        publicInputs,
        verificationDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    if (proof.threshold !== expectedInputs.threshold) {
      return {
        valid: false,
        error: `Threshold mismatch: expected ${expectedInputs.threshold}, got ${proof.threshold}`,
        statement: 'Threshold parameter binding check',
        publicInputs,
        verificationDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    if (proof.nonce.toLowerCase() !== expectedInputs.nonce.toLowerCase()) {
      return {
        valid: false,
        error: 'Nonce mismatch or stale challenge: replay protection triggered',
        statement: 'Session challenge nonce verification',
        publicInputs,
        verificationDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    if (expectedInputs.expectedCommitment && proof.commitment.toLowerCase() !== expectedInputs.expectedCommitment.toLowerCase()) {
      return {
        valid: false,
        error: 'Pedersen commitment mismatch against registered credential commitment',
        statement: 'Pedersen commitment binding check',
        publicInputs,
        verificationDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    // 3. Deserialize elliptic curve points
    const C = Point.fromHex(proof.commitment);
    const A_lin = Point.fromHex(proof.linearAnnouncement);
    const s_lin = BigInt(proof.linearResponse);
    const T = BigInt(proof.threshold);

    const bitCommitmentPoints = proof.bitCommitments.map(hex => Point.fromHex(hex));

    // 4. Reconstruct C_delta = T*G - C
    const C_delta = safeMul(G, T).subtract(C);

    // 5. Recompute sum of weighted bits
    let sumBits = Point.ZERO;
    for (let j = 0; j < ZKP_BIT_WIDTH; j++) {
      const weight = 1n << BigInt(j);
      sumBits = sumBits.add(safeMul(bitCommitmentPoints[j], weight));
    }
    const C_diff = sumBits.subtract(C_delta);

    // 6. Reconstruct Fiat-Shamir global challenge
    const bitCommitmentHexes = bitCommitmentPoints.map(pt => pt.toHex(true)).join('');
    const e_global = hashToScalar(
      'ZKP_RANGE_V1',
      proof.vehicleCommitment,
      proof.claimType,
      T,
      proof.nonce,
      C.toHex(true),
      C_delta.toHex(true),
      bitCommitmentHexes,
      A_lin.toHex(true)
    );

    // 7. Verify Linear Schnorr relation: s_lin * H == A_lin + e_global * C_diff
    const lhs = safeMul(H, s_lin);
    const rhs = A_lin.add(safeMul(C_diff, e_global));
    if (!lhs.equals(rhs)) {
      return {
        valid: false,
        error: 'Linear combination Schnorr proof failed; committed bits do not sum to threshold delta',
        statement: `Proof that value <= ${expectedInputs.threshold}`,
        publicInputs,
        verificationDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    // 8. Verify all bit OR-proofs
    for (let j = 0; j < ZKP_BIT_WIDTH; j++) {
      const p = proof.bitProofs[j];
      const e0 = BigInt(p.e0);
      const e1 = BigInt(p.e1);
      const s0 = BigInt(p.s0);
      const s1 = BigInt(p.s1);
      const Cj = bitCommitmentPoints[j];

      // Recompute announcements
      const A0 = safeMul(H, s0).subtract(safeMul(Cj, e0));
      const A1 = safeMul(H, s1).subtract(safeMul(Cj.subtract(G), e1));

      const expected_ej = hashToScalar(
        e_global,
        BigInt(j),
        Cj.toHex(true),
        A0.toHex(true),
        A1.toHex(true)
      );

      if (modN(e0 + e1) !== expected_ej) {
        return {
          valid: false,
          error: `Bit ${j} 1-out-of-2 OR-proof failed; bit commitment is neither 0 nor 1`,
          statement: `Bit decomposition validity for bit ${j}`,
          publicInputs,
          verificationDurationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return {
      valid: true,
      statement: `Cryptographically verified that value is in range [0, ${expectedInputs.threshold}] without revealing private value or blinding factor`,
      publicInputs,
      verificationDurationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Verification error: ${err.message}`,
      statement: 'Cryptographic range proof verification',
      publicInputs,
      verificationDurationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

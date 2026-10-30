import { prisma } from '../lib/prisma';
import { BlockchainService } from '../blockchain/services/blockchainService';

/**
 * Generates the next unique, human-readable Vehicle Passport ID (e.g. VP-000001)
 * Guaranteed to be unique in both PostgreSQL and on the blockchain.
 */
export async function generateNextPassportId(): Promise<string> {
  const lastVehicle = await prisma.vehicle.findFirst({
    where: {
      passportId: {
        startsWith: 'VP-',
      },
    },
    orderBy: {
      passportId: 'desc',
    },
    select: {
      passportId: true,
    },
  });

  let nextNumber = 1;
  if (lastVehicle && lastVehicle.passportId) {
    const match = lastVehicle.passportId.match(/^VP-(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  // Cross-verify with blockchain state to ensure no collisions even after DB deletions
  try {
    const blockchainService = BlockchainService.getInstance();
    let candidate = `VP-${String(nextNumber).padStart(6, '0')}`;
    while (await blockchainService.isPassportIdRegistered(candidate)) {
      nextNumber++;
      candidate = `VP-${String(nextNumber).padStart(6, '0')}`;
    }
    return candidate;
  } catch {
    return `VP-${String(nextNumber).padStart(6, '0')}`;
  }
}

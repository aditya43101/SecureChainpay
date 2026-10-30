import { ethers } from 'ethers';
import { prisma } from '../../lib/prisma';
import { getBlockchainConfig } from '../config';
import {
  generateVehicleRecordHash,
  generateUserReferenceHash,
  generateOwnershipRecordHash,
  generateServiceRecordHash,
  generateOdometerRecordHash,
  generateAccidentRecordHash,
  generateInsuranceRecordHash,
  generateDocumentRecordHash,
  CanonicalOwnershipInput,
  CanonicalServiceInput,
  CanonicalOdometerInput,
  CanonicalAccidentInput,
  CanonicalInsuranceInput,
  CanonicalDocumentInput,
} from '../utils/canonicalHash';
import {
  BlockchainUserResult,
  BlockchainVehicleResult,
  VehicleVerificationResult,
  CategoryVerificationItem,
  FullVehicleVerificationReport,
} from '../types';
import {
  BlockchainStatus,
  OwnershipTransferType,
  OdometerSourceType,
  VerificationStatus,
  AccidentSeverity,
  RepairStatus,
  InsurancePolicyStatus,
  DocumentType,
} from '@prisma/client';

export class BlockchainService {
  private static instance: BlockchainService;
  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;

  private constructor() {
    this.initContract();
  }

  public static getInstance(): BlockchainService {
    if (!BlockchainService.instance) {
      BlockchainService.instance = new BlockchainService();
    }
    return BlockchainService.instance;
  }

  public initContract() {
    try {
      const config = getBlockchainConfig();
      if (config.rpcUrl && config.contractAddress && config.abi.length > 0) {
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.signer = new ethers.Wallet(config.privateKey, this.provider);
        this.contract = new ethers.Contract(config.contractAddress, config.abi, this.signer);
        console.log(`⛓️ BlockchainService connected to contract: ${config.contractAddress}`);
      } else {
        console.log('ℹ️ BlockchainService waiting for contract deployment.');
      }
    } catch (error) {
      console.warn('⚠️ BlockchainService init warning:', error);
    }
  }

  public isConnected(): boolean {
    return this.contract !== null;
  }

  /**
   * Initializes a user identity on the blockchain
   */
  public async initializeUser(params: {
    userId: string;
    firebaseUid: string;
    role: string;
    address?: string | null;
  }): Promise<BlockchainUserResult> {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
    });

    if (!user) {
      throw new Error(`User ${params.userId} not found in database`);
    }

    // Idempotency: If already initialized on-chain, verify on connected contract
    if (user.blockchainUserId && user.blockchainTxHash) {
      this.initContract();
      if (this.contract) {
        try {
          const onChainUser = await this.contract.getUserById(user.blockchainUserId);
          if (onChainUser.active) {
            return {
              blockchainUserId: user.blockchainUserId,
              userReferenceHash: generateUserReferenceHash(user.firebaseUid),
              walletAddress: user.blockchainAddress || ethers.ZeroAddress,
              role: user.role,
              txHash: user.blockchainTxHash,
              blockNumber: 0,
            };
          }
        } catch {
          // Fall through to re-register on fresh contract
        }
      }
    }

    this.initContract();
    if (!this.contract || !this.signer) {
      throw new Error('Blockchain contract is not connected. Ensure Hardhat node and deploy script have run.');
    }

    const userReferenceHash = generateUserReferenceHash(params.firebaseUid);

    // Check if this user reference hash is already registered on-chain
    try {
      const existingUserId = await this.contract.userIdByReferenceHash(userReferenceHash);
      if (existingUserId && existingUserId.length > 0) {
        const onChainUser = await this.contract.getUserById(existingUserId);
        if (onChainUser.active) {
          await prisma.user.update({
            where: { id: params.userId },
            data: {
              blockchainUserId: existingUserId,
              blockchainAddress: onChainUser.walletAddress,
              isInitialized: true,
            },
          });
          return {
            blockchainUserId: existingUserId,
            userReferenceHash,
            walletAddress: onChainUser.walletAddress,
            role: onChainUser.role,
            txHash: user.blockchainTxHash || '0x_existing',
            blockNumber: 0,
          };
        }
      }
    } catch {
      // Reference hash not yet on-chain, proceed
    }

    const userCount = await this.contract.getUserCount();
    const dbUserCount = await prisma.user.count({
      where: { blockchainUserId: { not: null } },
    });
    let nextUserNum = Math.max(Number(userCount), dbUserCount) + 1;
    let blockchainUserId = `USR-${String(nextUserNum).padStart(6, '0')}`;

    while (true) {
      const dbExists = await prisma.user.findUnique({ where: { blockchainUserId } });
      if (dbExists) {
        nextUserNum++;
        blockchainUserId = `USR-${String(nextUserNum).padStart(6, '0')}`;
        continue;
      }
      try {
        const onChainUser = await this.contract.getUserById(blockchainUserId);
        if (onChainUser.active) {
          nextUserNum++;
          blockchainUserId = `USR-${String(nextUserNum).padStart(6, '0')}`;
          continue;
        }
      } catch {
        // Not active on-chain, safe to use
      }
      break;
    }

    // Generate or use assigned wallet address
    let walletAddress = params.address;
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      walletAddress = ethers.Wallet.createRandom().address;
    }

    console.log(`[BLOCKCHAIN] Initializing user: ${blockchainUserId} (${params.role})`);

    // Submit transaction
    const tx = await this.contract.initializeUser(
      blockchainUserId,
      userReferenceHash,
      walletAddress,
      params.role
    );

    const receipt = await tx.wait();

    // Update PostgreSQL user record
    await prisma.user.update({
      where: { id: params.userId },
      data: {
        blockchainUserId,
        blockchainAddress: walletAddress,
        blockchainTxHash: tx.hash,
        role: params.role as any,
        isInitialized: true,
      },
    });

    // Record in generic BlockchainRecord table
    await prisma.blockchainRecord.create({
      data: {
        userId: params.userId,
        recordType: 'USER_INITIALIZED',
        recordHash: userReferenceHash,
        blockchainTxHash: tx.hash,
        blockNumber: receipt.blockNumber,
        blockchainNetwork: 'hardhat-local',
        status: BlockchainStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });

    return {
      blockchainUserId,
      userReferenceHash,
      walletAddress,
      role: params.role,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  /**
   * Generates next passport ID
   */
  public async generateNextPassportId(): Promise<string> {
    let nextNum = (await prisma.vehicle.count()) + 1;
    let passportId = `VP-${String(nextNum).padStart(6, '0')}`;

    while (await this.isPassportIdRegistered(passportId)) {
      nextNum++;
      passportId = `VP-${String(nextNum).padStart(6, '0')}`;
    }

    return passportId;
  }

  /**
   * Registers a vehicle on the blockchain
   */
  public async registerVehicle(vehicleId: string): Promise<BlockchainVehicleResult> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { currentOwner: true },
    });

    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }

    if (vehicle.blockchainVehicleId && vehicle.blockchainTxHash) {
      this.initContract();
      if (this.contract) {
        try {
          const isReg = await this.contract.isVehicleRegistered(vehicle.blockchainVehicleId);
          if (isReg) {
            return {
              blockchainVehicleId: vehicle.blockchainVehicleId,
              passportId: vehicle.passportId,
              vehicleRecordHash: vehicle.recordHash || '',
              ownerAddress: vehicle.currentOwner.blockchainAddress || ethers.ZeroAddress,
              txHash: vehicle.blockchainTxHash,
              blockNumber: vehicle.blockNumber || 0,
            };
          }
        } catch {
          // Fall through to re-register on fresh contract
        }
      }
    }

    this.initContract();
    if (!this.contract || !this.signer) {
      throw new Error('Blockchain contract is not connected');
    }

    // Check if vehicle is already registered on-chain by passportId
    try {
      const onChainByPassport = await this.contract.getVehicleByPassportId(vehicle.passportId);
      if (onChainByPassport.active) {
        if (vehicle.blockchainVehicleId !== onChainByPassport.blockchainVehicleId) {
          const conflicting = await prisma.vehicle.findUnique({
            where: { blockchainVehicleId: onChainByPassport.blockchainVehicleId },
          });
          if (conflicting && conflicting.id !== vehicle.id) {
            await prisma.vehicle.update({
              where: { id: conflicting.id },
              data: { blockchainVehicleId: null },
            });
          }
          await prisma.vehicle.update({
            where: { id: vehicleId },
            data: {
              blockchainVehicleId: onChainByPassport.blockchainVehicleId,
              recordHash: onChainByPassport.vehicleRecordHash,
              blockchainStatus: BlockchainStatus.CONFIRMED,
              blockchainRegisteredAt: new Date(),
            },
          });
        }
        return {
          blockchainVehicleId: onChainByPassport.blockchainVehicleId,
          passportId: vehicle.passportId,
          vehicleRecordHash: onChainByPassport.vehicleRecordHash,
          ownerAddress: onChainByPassport.ownerAddress,
          txHash: vehicle.blockchainTxHash || '0x_existing',
          blockNumber: vehicle.blockNumber || 0,
        };
      }
    } catch {
      // Passport ID not yet registered on-chain, proceed to register
    }

    // Ensure owner has blockchain identity
    let ownerAddress = vehicle.currentOwner.blockchainAddress;
    if (!vehicle.currentOwner.blockchainUserId || !ownerAddress) {
      const userRes = await this.initializeUser({
        userId: vehicle.currentOwner.id,
        firebaseUid: vehicle.currentOwner.firebaseUid,
        role: vehicle.currentOwner.role,
        address: vehicle.currentOwner.blockchainAddress,
      });
      ownerAddress = userRes.walletAddress;
    }

    const vehicleRecordHash = generateVehicleRecordHash({
      passportId: vehicle.passportId,
      vin: vehicle.vin,
      registrationNumber: vehicle.registrationNumber,
      manufacturer: vehicle.manufacturer,
      model: vehicle.model,
      manufacturingYear: vehicle.manufacturingYear,
      fuelType: vehicle.fuelType,
    });

    const vehicleCount = await this.contract.getVehicleCount();
    const dbVehicleCount = await prisma.vehicle.count({
      where: { blockchainVehicleId: { not: null } },
    });
    let nextVehNum = Math.max(Number(vehicleCount), dbVehicleCount) + 1;
    let blockchainVehicleId = `VEH-${String(nextVehNum).padStart(6, '0')}`;

    while (true) {
      const dbExists = await prisma.vehicle.findUnique({ where: { blockchainVehicleId } });
      if (dbExists) {
        nextVehNum++;
        blockchainVehicleId = `VEH-${String(nextVehNum).padStart(6, '0')}`;
        continue;
      }
      try {
        const onChain = await this.contract.isVehicleRegistered(blockchainVehicleId);
        if (onChain) {
          nextVehNum++;
          blockchainVehicleId = `VEH-${String(nextVehNum).padStart(6, '0')}`;
          continue;
        }
      } catch {
        // Not registered on-chain, safe to use
      }
      break;
    }

    console.log(`[BLOCKCHAIN] Registering vehicle: ${blockchainVehicleId} (${vehicle.passportId})`);

    const tx = await this.contract.registerVehicle(
      blockchainVehicleId,
      vehicleRecordHash,
      vehicle.passportId,
      ownerAddress
    );

    const receipt = await tx.wait();

    // Update vehicle record
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        blockchainVehicleId,
        blockchainTxHash: tx.hash,
        blockNumber: receipt.blockNumber,
        recordHash: vehicleRecordHash,
        blockchainStatus: BlockchainStatus.CONFIRMED,
        blockchainRegisteredAt: new Date(),
      },
    });

    // Record in generic BlockchainRecord table
    await prisma.blockchainRecord.create({
      data: {
        vehicleId: vehicle.id,
        userId: vehicle.currentOwnerId,
        recordType: 'VEHICLE_CREATED',
        recordHash: vehicleRecordHash,
        blockchainTxHash: tx.hash,
        blockNumber: receipt.blockNumber,
        blockchainNetwork: 'hardhat-local',
        status: BlockchainStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });

    // Create Initial Ownership History Record
    await prisma.ownershipHistory.create({
      data: {
        vehicleId: vehicle.id,
        previousOwnerId: null,
        newOwnerId: vehicle.currentOwnerId,
        transferType: OwnershipTransferType.INITIAL_REGISTRATION,
        transferDate: new Date(),
        notes: 'Initial vehicle registration and passport creation',
        recordHash: vehicleRecordHash,
        blockchainRecordId: blockchainVehicleId,
        blockchainTxHash: tx.hash,
        blockNumber: receipt.blockNumber,
        status: BlockchainStatus.CONFIRMED,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'VEHICLE_CREATED',
        vehicleId: vehicle.id,
        userId: vehicle.currentOwnerId,
        details: JSON.stringify({
          passportId: vehicle.passportId,
          blockchainVehicleId,
          txHash: tx.hash,
        }),
      },
    });

    return {
      blockchainVehicleId,
      passportId: vehicle.passportId,
      vehicleRecordHash,
      ownerAddress,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  public async verifyVehicle(vehicleId: string): Promise<VehicleVerificationResult> {
    return this.verifyVehiclePassport(vehicleId);
  }

  /**
   * Verifies vehicle passport identity against on-chain data
   */
  public async verifyVehiclePassport(vehicleId: string): Promise<VehicleVerificationResult> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { currentOwner: true },
    });

    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }

    const calculatedHash = generateVehicleRecordHash({
      passportId: vehicle.passportId,
      vin: vehicle.vin,
      registrationNumber: vehicle.registrationNumber,
      manufacturer: vehicle.manufacturer,
      model: vehicle.model,
      manufacturingYear: vehicle.manufacturingYear,
      fuelType: vehicle.fuelType,
    });

    if (!vehicle.blockchainVehicleId) {
      return {
        vehicleId: vehicle.id,
        passportId: vehicle.passportId,
        vin: vehicle.vin,
        isRegisteredOnBlockchain: false,
        isVerified: false,
        tamperDetected: false,
        calculatedHash,
        onChainHash: null,
        blockchainVehicleId: null,
        blockchainTxHash: null,
        blockNumber: null,
        network: 'hardhat-local',
        verifiedAt: new Date().toISOString(),
        details: {
          manufacturer: vehicle.manufacturer,
          model: vehicle.model,
          registrationNumber: vehicle.registrationNumber,
          ownerName: vehicle.currentOwner.name,
        },
      };
    }

    this.initContract();
    if (!this.contract) {
      throw new Error('Blockchain verification currently unavailable.');
    }

    const onChainRecord = await this.contract.getVehicleById(vehicle.blockchainVehicleId);
    const onChainHash: string = onChainRecord.vehicleRecordHash;

    const isVerified = calculatedHash.toLowerCase() === onChainHash.toLowerCase();
    const tamperDetected = !isVerified;

    return {
      vehicleId: vehicle.id,
      passportId: vehicle.passportId,
      vin: vehicle.vin,
      isRegisteredOnBlockchain: true,
      isVerified,
      tamperDetected,
      calculatedHash,
      onChainHash,
      blockchainVehicleId: vehicle.blockchainVehicleId,
      blockchainTxHash: vehicle.blockchainTxHash,
      blockNumber: vehicle.blockNumber,
      network: 'hardhat-local',
      verifiedAt: new Date().toISOString(),
      details: {
        manufacturer: vehicle.manufacturer,
        model: vehicle.model,
        registrationNumber: vehicle.registrationNumber,
        ownerName: vehicle.currentOwner.name,
      },
    };
  }

  private async getNextRecordId(): Promise<string> {
    const count = await prisma.blockchainRecord.count();
    let nextNum = count + 1;
    let recordId = `REC-${String(nextNum).padStart(6, '0')}`;

    this.initContract();
    if (this.contract) {
      while (true) {
        try {
          const onChainRec = await this.contract.getRecord(recordId);
          if (onChainRec && onChainRec.timestamp > 0n) {
            nextNum++;
            recordId = `REC-${String(nextNum).padStart(6, '0')}`;
            continue;
          }
        } catch {
          // "Record not found" -> safely unused on-chain
          break;
        }
        break;
      }
    }
    return recordId;
  }

  /**
   * Generic record anchoring for lifecycle events
   */
  public async anchorRecord(params: {
    vehicleId: string;
    recordType: string;
    recordHash: string;
  }): Promise<{ recordId: string; txHash: string; blockNumber: number }> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: params.vehicleId },
    });

    if (!vehicle || !vehicle.blockchainVehicleId) {
      throw new Error('Vehicle is not registered on blockchain');
    }

    this.initContract();
    if (!this.contract) {
      throw new Error('Blockchain contract is not connected');
    }

    const recordId = await this.getNextRecordId();

    const tx = await this.contract.anchorRecord(
      recordId,
      vehicle.blockchainVehicleId,
      params.recordType,
      params.recordHash
    );

    const receipt = await tx.wait();

    await prisma.blockchainRecord.create({
      data: {
        vehicleId: vehicle.id,
        userId: vehicle.currentOwnerId,
        recordType: params.recordType,
        recordHash: params.recordHash,
        blockchainTxHash: tx.hash,
        blockNumber: receipt.blockNumber,
        blockchainNetwork: 'hardhat-local',
        status: BlockchainStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });

    return {
      recordId,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  // ==========================================================================
  // PHASE 4: OWNERSHIP TRANSFER
  // ==========================================================================

  /**
   * Secure atomic ownership transfer with blockchain anchoring
   */
  public async transferOwnership(params: {
    vehicleId: string;
    previousOwnerId: string;
    newOwnerId: string;
    transferType: OwnershipTransferType;
    notes?: string | null;
  }): Promise<{
    ownershipHistoryId: string;
    blockchainRecordId: string;
    txHash: string;
    blockNumber: number;
    recordHash: string;
  }> {
    // 1. Fetch vehicle & validate
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: params.vehicleId },
      include: { currentOwner: true },
    });

    if (!vehicle) throw new Error('Vehicle not found');
    if (vehicle.status !== 'ACTIVE') throw new Error('Cannot transfer an inactive vehicle');
    if (vehicle.currentOwnerId !== params.previousOwnerId) {
      throw new Error('Only the current verified vehicle owner can transfer ownership');
    }
    if (params.previousOwnerId === params.newOwnerId) {
      throw new Error('Cannot transfer vehicle to yourself');
    }

    // 2. Fetch new owner & validate
    const newOwner = await prisma.user.findUnique({
      where: { id: params.newOwnerId },
    });

    if (!newOwner) {
      throw new Error('Target new owner does not exist');
    }
    if (!newOwner.isInitialized) {
      throw new Error('Target owner has not initialized their Vehicle Passport identity');
    }

    // 3. Ensure both users have blockchain identities
    let previousOwnerBlockchainId = vehicle.currentOwner.blockchainUserId;
    if (!previousOwnerBlockchainId) {
      const prevInit = await this.initializeUser({
        userId: vehicle.currentOwner.id,
        firebaseUid: vehicle.currentOwner.firebaseUid,
        role: vehicle.currentOwner.role,
        address: vehicle.currentOwner.blockchainAddress,
      });
      previousOwnerBlockchainId = prevInit.blockchainUserId;
    }

    let newOwnerBlockchainId = newOwner.blockchainUserId;
    let newOwnerAddress = newOwner.blockchainAddress;
    if (!newOwnerBlockchainId || !newOwnerAddress) {
      const newInit = await this.initializeUser({
        userId: newOwner.id,
        firebaseUid: newOwner.firebaseUid,
        role: newOwner.role,
        address: newOwner.blockchainAddress,
      });
      newOwnerBlockchainId = newInit.blockchainUserId;
      newOwnerAddress = newInit.walletAddress;
    }

    // 4. Ensure vehicle is registered on blockchain
    let blockchainVehicleId = vehicle.blockchainVehicleId;
    if (!blockchainVehicleId) {
      const reg = await this.registerVehicle(vehicle.id);
      blockchainVehicleId = reg.blockchainVehicleId;
    }

    // 5. Generate canonical transfer record hash
    const transferDate = new Date();
    const recordHash = generateOwnershipRecordHash({
      blockchainVehicleId,
      previousOwnerBlockchainId,
      newOwnerBlockchainId,
      transferType: params.transferType,
      transferDate,
    });

    this.initContract();
    if (!this.contract) {
      throw new Error('Blockchain verification currently unavailable.');
    }

    const recordId = await this.getNextRecordId();

    console.log(`[BLOCKCHAIN] Transferring vehicle ${blockchainVehicleId} to ${newOwnerAddress}...`);

    // 6. Execute blockchain transaction BEFORE updating database
    const tx = await this.contract.transferVehicleOwnership(
      blockchainVehicleId,
      newOwnerAddress,
      recordHash,
      recordId
    );
    const receipt = await tx.wait();

    // 7. Atomic PostgreSQL database update
    const result = await prisma.$transaction(async (txPrisma) => {
      // Create OwnershipHistory record (never deleted!)
      const history = await txPrisma.ownershipHistory.create({
        data: {
          vehicleId: vehicle.id,
          previousOwnerId: params.previousOwnerId,
          newOwnerId: params.newOwnerId,
          transferType: params.transferType,
          transferDate,
          notes: params.notes || null,
          recordHash,
          blockchainRecordId: recordId,
          blockchainTxHash: tx.hash,
          blockNumber: receipt.blockNumber,
          status: BlockchainStatus.CONFIRMED,
        },
      });

      // Update vehicle currentOwnerId
      await txPrisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          currentOwnerId: params.newOwnerId,
        },
      });

      // Record blockchain log
      await txPrisma.blockchainRecord.create({
        data: {
          vehicleId: vehicle.id,
          userId: params.newOwnerId,
          recordType: 'OWNERSHIP_TRANSFERRED',
          recordHash,
          blockchainTxHash: tx.hash,
          blockNumber: receipt.blockNumber,
          blockchainNetwork: 'hardhat-local',
          status: BlockchainStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      // Audit log
      await txPrisma.auditLog.create({
        data: {
          action: 'OWNERSHIP_TRANSFER_CONFIRMED',
          vehicleId: vehicle.id,
          userId: params.previousOwnerId,
          details: JSON.stringify({
            previousOwnerId: params.previousOwnerId,
            newOwnerId: params.newOwnerId,
            transferType: params.transferType,
            recordId,
            txHash: tx.hash,
          }),
        },
      });

      return history;
    });

    return {
      ownershipHistoryId: result.id,
      blockchainRecordId: recordId,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      recordHash,
    };
  }

  // ==========================================================================
  // PHASE 4: SERVICE RECORDS
  // ==========================================================================

  public async anchorServiceRecord(params: {
    vehicleId: string;
    garageId: string;
    serviceDate: Date | string;
    mileage: number;
    serviceType: string;
    description: string;
    partsReplaced?: string | null;
    laborDescription?: string | null;
    cost?: number | null;
    technician?: string | null;
    notes?: string | null;
  }) {
    // 1. Validate garage user
    const garage = await prisma.user.findUnique({
      where: { id: params.garageId },
    });
    if (!garage || (garage.role !== 'GARAGE' && garage.role !== 'ADMIN')) {
      throw new Error('Unauthorized: Only an authorized Garage or Admin can create service records');
    }

    // 2. Validate vehicle
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: params.vehicleId },
    });
    if (!vehicle) throw new Error('Vehicle not found');

    let blockchainVehicleId = vehicle.blockchainVehicleId;
    if (!blockchainVehicleId) {
      const reg = await this.registerVehicle(vehicle.id);
      blockchainVehicleId = reg.blockchainVehicleId;
    }

    // 3. Generate canonical hash
    const serviceDate = typeof params.serviceDate === 'string' ? new Date(params.serviceDate) : params.serviceDate;
    const recordHash = generateServiceRecordHash({
      blockchainVehicleId,
      garageBlockchainId: garage.blockchainUserId || garage.id,
      serviceDate,
      mileage: params.mileage,
      serviceType: params.serviceType,
      description: params.description,
      partsReplaced: params.partsReplaced,
      cost: params.cost,
    });

    // 4. Anchor on blockchain
    this.initContract();
    if (!this.contract) throw new Error('Blockchain contract is not connected');

    const recordId = await this.getNextRecordId();

    const tx = await this.contract.anchorRecord(
      recordId,
      blockchainVehicleId,
      'SERVICE',
      recordHash
    );
    const receipt = await tx.wait();

    // 5. Database transaction
    const serviceRecord = await prisma.$transaction(async (txPrisma) => {
      const rec = await txPrisma.serviceRecord.create({
        data: {
          vehicleId: vehicle.id,
          garageId: garage.id,
          serviceDate,
          mileage: params.mileage,
          serviceType: params.serviceType,
          description: params.description,
          partsReplaced: params.partsReplaced || null,
          laborDescription: params.laborDescription || null,
          cost: params.cost || null,
          technician: params.technician || null,
          notes: params.notes || null,
          recordHash,
          blockchainRecordId: recordId,
          blockchainTxHash: tx.hash,
          blockNumber: receipt.blockNumber,
          status: BlockchainStatus.CONFIRMED,
        },
      });

      await txPrisma.blockchainRecord.create({
        data: {
          vehicleId: vehicle.id,
          userId: garage.id,
          recordType: 'SERVICE',
          recordHash,
          blockchainTxHash: tx.hash,
          blockNumber: receipt.blockNumber,
          status: BlockchainStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      await txPrisma.auditLog.create({
        data: {
          action: 'SERVICE_ADDED',
          vehicleId: vehicle.id,
          userId: garage.id,
          details: JSON.stringify({
            serviceId: rec.id,
            mileage: params.mileage,
            serviceType: params.serviceType,
            txHash: tx.hash,
          }),
        },
      });

      return rec;
    });

    return serviceRecord;
  }

  // ==========================================================================
  // PHASE 4: ODOMETER RECORDS & ROLLBACK VALIDATION
  // ==========================================================================

  public async anchorOdometerRecord(params: {
    vehicleId: string;
    sourceUserId: string;
    mileage: number;
    recordedAt?: Date | string;
    sourceType?: OdometerSourceType;
    notes?: string | null;
  }) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: params.vehicleId },
    });
    if (!vehicle) throw new Error('Vehicle not found');

    let blockchainVehicleId = vehicle.blockchainVehicleId;
    if (!blockchainVehicleId) {
      const reg = await this.registerVehicle(vehicle.id);
      blockchainVehicleId = reg.blockchainVehicleId;
    }

    const recordedAt = params.recordedAt
      ? (typeof params.recordedAt === 'string' ? new Date(params.recordedAt) : params.recordedAt)
      : new Date();

    const sourceType = params.sourceType || OdometerSourceType.OWNER;

    // Check previous odometer readings for rollback detection
    const latestOdometer = await prisma.odometerRecord.findFirst({
      where: { vehicleId: vehicle.id },
      orderBy: { mileage: 'desc' },
    });

    let rollbackDetected = false;
    let verificationStatus: VerificationStatus = VerificationStatus.VERIFIED;

    if (latestOdometer && params.mileage < latestOdometer.mileage) {
      rollbackDetected = true;
      verificationStatus = VerificationStatus.SUSPICIOUS;
      console.warn(`⚠️ Possible Odometer Rollback detected for vehicle ${vehicle.id}! Previous max: ${latestOdometer.mileage} km, New: ${params.mileage} km`);
    }

    // Compute canonical hash
    const recordHash = generateOdometerRecordHash({
      blockchainVehicleId,
      mileage: params.mileage,
      recordedAt,
      sourceType,
    });

    this.initContract();
    if (!this.contract) throw new Error('Blockchain contract is not connected');

    const recordId = await this.getNextRecordId();

    const tx = await this.contract.anchorRecord(
      recordId,
      blockchainVehicleId,
      'ODOMETER',
      recordHash
    );
    const receipt = await tx.wait();

    const odometer = await prisma.$transaction(async (txPrisma) => {
      const rec = await txPrisma.odometerRecord.create({
        data: {
          vehicleId: vehicle.id,
          sourceUserId: params.sourceUserId,
          mileage: params.mileage,
          recordedAt,
          sourceType,
          notes: params.notes || null,
          rollbackDetected,
          verificationStatus,
          recordHash,
          blockchainRecordId: recordId,
          blockchainTxHash: tx.hash,
          blockNumber: receipt.blockNumber,
          status: BlockchainStatus.CONFIRMED,
        },
      });

      await txPrisma.blockchainRecord.create({
        data: {
          vehicleId: vehicle.id,
          userId: params.sourceUserId,
          recordType: 'ODOMETER',
          recordHash,
          blockchainTxHash: tx.hash,
          blockNumber: receipt.blockNumber,
          status: BlockchainStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      await txPrisma.auditLog.create({
        data: {
          action: rollbackDetected ? 'ODOMETER_ROLLBACK_FLAGGED' : 'ODOMETER_ADDED',
          vehicleId: vehicle.id,
          userId: params.sourceUserId,
          details: JSON.stringify({
            odometerId: rec.id,
            mileage: params.mileage,
            rollbackDetected,
            verificationStatus,
            txHash: tx.hash,
          }),
        },
      });

      return rec;
    });

    return odometer;
  }

  // ==========================================================================
  // PHASE 4: ACCIDENT & REPAIR RECORDS
  // ==========================================================================

  public async anchorAccidentRecord(params: {
    vehicleId: string;
    reportedById: string;
    accidentDate: Date | string;
    severity?: AccidentSeverity;
    description: string;
    damagedParts?: string | null;
    locationDescription?: string | null;
    insuranceClaimId?: string | null;
    repairStatus?: RepairStatus;
    repairDescription?: string | null;
  }) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: params.vehicleId },
    });
    if (!vehicle) throw new Error('Vehicle not found');

    let blockchainVehicleId = vehicle.blockchainVehicleId;
    if (!blockchainVehicleId) {
      const reg = await this.registerVehicle(vehicle.id);
      blockchainVehicleId = reg.blockchainVehicleId;
    }

    const accidentDate = typeof params.accidentDate === 'string' ? new Date(params.accidentDate) : params.accidentDate;
    const severity = params.severity || AccidentSeverity.MINOR;
    const repairStatus = params.repairStatus || RepairStatus.PENDING;

    const recordHash = generateAccidentRecordHash({
      blockchainVehicleId,
      accidentDate,
      severity,
      description: params.description,
      damagedParts: params.damagedParts,
      repairStatus,
    });

    this.initContract();
    if (!this.contract) throw new Error('Blockchain contract is not connected');

    const recordId = await this.getNextRecordId();

    const tx = await this.contract.anchorRecord(
      recordId,
      blockchainVehicleId,
      'ACCIDENT',
      recordHash
    );
    const receipt = await tx.wait();

    const accident = await prisma.$transaction(async (txPrisma) => {
      const rec = await txPrisma.accidentRecord.create({
        data: {
          vehicleId: vehicle.id,
          reportedById: params.reportedById,
          accidentDate,
          severity,
          description: params.description,
          damagedParts: params.damagedParts || null,
          locationDescription: params.locationDescription || null,
          insuranceClaimId: params.insuranceClaimId || null,
          repairStatus,
          repairDescription: params.repairDescription || null,
          repairedAt: repairStatus === RepairStatus.COMPLETED ? new Date() : null,
          recordHash,
          blockchainRecordId: recordId,
          blockchainTxHash: tx.hash,
          blockNumber: receipt.blockNumber,
          status: BlockchainStatus.CONFIRMED,
        },
      });

      await txPrisma.blockchainRecord.create({
        data: {
          vehicleId: vehicle.id,
          userId: params.reportedById,
          recordType: 'ACCIDENT',
          recordHash,
          blockchainTxHash: tx.hash,
          blockNumber: receipt.blockNumber,
          status: BlockchainStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      await txPrisma.auditLog.create({
        data: {
          action: 'ACCIDENT_ADDED',
          vehicleId: vehicle.id,
          userId: params.reportedById,
          details: JSON.stringify({
            accidentId: rec.id,
            severity,
            txHash: tx.hash,
          }),
        },
      });

      return rec;
    });

    return accident;
  }

  // ==========================================================================
  // PHASE 4: INSURANCE RECORDS
  // ==========================================================================

  public async anchorInsuranceRecord(params: {
    vehicleId: string;
    providerId: string;
    policyReference: string;
    startDate: Date | string;
    endDate: Date | string;
    status?: InsurancePolicyStatus;
    claimReference?: string | null;
    coverageType?: string;
    notes?: string | null;
  }) {
    const provider = await prisma.user.findUnique({
      where: { id: params.providerId },
    });
    if (!provider || (provider.role !== 'INSURANCE_PROVIDER' && provider.role !== 'ADMIN')) {
      throw new Error('Unauthorized: Only an authorized Insurance Provider or Admin can create insurance records');
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: params.vehicleId },
    });
    if (!vehicle) throw new Error('Vehicle not found');

    let blockchainVehicleId = vehicle.blockchainVehicleId;
    if (!blockchainVehicleId) {
      const reg = await this.registerVehicle(vehicle.id);
      blockchainVehicleId = reg.blockchainVehicleId;
    }

    const startDate = typeof params.startDate === 'string' ? new Date(params.startDate) : params.startDate;
    const endDate = typeof params.endDate === 'string' ? new Date(params.endDate) : params.endDate;
    const coverageType = params.coverageType || 'Comprehensive';
    const status = params.status || InsurancePolicyStatus.ACTIVE;

    const recordHash = generateInsuranceRecordHash({
      blockchainVehicleId,
      providerBlockchainId: provider.blockchainUserId || provider.id,
      policyReference: params.policyReference,
      startDate,
      endDate,
      coverageType,
    });

    this.initContract();
    if (!this.contract) throw new Error('Blockchain contract is not connected');

    const recordId = await this.getNextRecordId();

    const tx = await this.contract.anchorRecord(
      recordId,
      blockchainVehicleId,
      'INSURANCE',
      recordHash
    );
    const receipt = await tx.wait();

    const insurance = await prisma.$transaction(async (txPrisma) => {
      const rec = await txPrisma.insuranceRecord.create({
        data: {
          vehicleId: vehicle.id,
          providerId: provider.id,
          policyReference: params.policyReference,
          startDate,
          endDate,
          status,
          claimReference: params.claimReference || null,
          coverageType,
          notes: params.notes || null,
          recordHash,
          blockchainRecordId: recordId,
          blockchainTxHash: tx.hash,
          blockNumber: receipt.blockNumber,
          blockchainStatus: BlockchainStatus.CONFIRMED,
        },
      });

      await txPrisma.blockchainRecord.create({
        data: {
          vehicleId: vehicle.id,
          userId: provider.id,
          recordType: 'INSURANCE',
          recordHash,
          blockchainTxHash: tx.hash,
          blockNumber: receipt.blockNumber,
          status: BlockchainStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      await txPrisma.auditLog.create({
        data: {
          action: 'INSURANCE_ADDED',
          vehicleId: vehicle.id,
          userId: provider.id,
          details: JSON.stringify({
            insuranceId: rec.id,
            policyReference: params.policyReference,
            txHash: tx.hash,
          }),
        },
      });

      return rec;
    });

    return insurance;
  }

  // ==========================================================================
  // PHASE 4: DOCUMENT OFF-CHAIN METADATA + ON-CHAIN INTEGRITY PROOF
  // ==========================================================================

  public async anchorDocumentRecord(params: {
    vehicleId: string;
    uploadedById: string;
    documentType: DocumentType;
    title: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileHash: string; // SHA-256 of file buffer
    ipfsCid?: string | null;
    storageProvider?: string;
    ocrStatus?: string;
    extractedData?: string | null;
    consistencyStatus?: string;
    consistencyDetails?: string | null;
  }) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: params.vehicleId },
    });
    if (!vehicle) throw new Error('Vehicle not found');

    let blockchainVehicleId = vehicle.blockchainVehicleId;
    if (!blockchainVehicleId) {
      const reg = await this.registerVehicle(vehicle.id);
      blockchainVehicleId = reg.blockchainVehicleId;
    }

    const recordHash = generateDocumentRecordHash({
      blockchainVehicleId,
      documentType: params.documentType,
      fileHash: params.fileHash,
      title: params.title,
    });

    this.initContract();
    if (!this.contract) throw new Error('Blockchain contract is not connected');

    const recordId = await this.getNextRecordId();

    const tx = await this.contract.anchorRecord(
      recordId,
      blockchainVehicleId,
      'DOCUMENT',
      recordHash
    );
    const receipt = await tx.wait();

    const document = await prisma.$transaction(async (txPrisma) => {
      const doc = await txPrisma.vehicleDocument.create({
        data: {
          vehicleId: vehicle.id,
          uploadedById: params.uploadedById,
          documentType: params.documentType,
          title: params.title,
          fileUrl: params.fileUrl,
          fileName: params.fileName,
          fileSize: params.fileSize,
          mimeType: params.mimeType,
          fileHash: params.fileHash,
          recordHash,
          ipfsCid: params.ipfsCid || null,
          storageProvider: params.storageProvider || 'local',
          ocrStatus: params.ocrStatus || 'UNPROCESSED',
          extractedData: params.extractedData || null,
          consistencyStatus: params.consistencyStatus || 'UNVERIFIED',
          consistencyDetails: params.consistencyDetails || null,
          blockchainRecordId: recordId,
          blockchainTxHash: tx.hash,
          blockNumber: receipt.blockNumber,
          status: BlockchainStatus.CONFIRMED,
        },
      });

      await txPrisma.blockchainRecord.create({
        data: {
          vehicleId: vehicle.id,
          userId: params.uploadedById,
          recordType: 'DOCUMENT',
          recordHash,
          blockchainTxHash: tx.hash,
          blockNumber: receipt.blockNumber,
          status: BlockchainStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      await txPrisma.auditLog.create({
        data: {
          action: 'DOCUMENT_ADDED',
          vehicleId: vehicle.id,
          userId: params.uploadedById,
          details: JSON.stringify({
            documentId: doc.id,
            documentType: params.documentType,
            txHash: tx.hash,
          }),
        },
      });

      return doc;
    });

    return document;
  }

  // ==========================================================================
  // PHASE 4: FULL VEHICLE VERIFICATION ENGINE
  // ==========================================================================

  public async verifyVehiclePassportFull(vehicleId: string): Promise<FullVehicleVerificationReport> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        currentOwner: true,
        ownershipHistory: {
          include: { previousOwner: true, newOwner: true },
          orderBy: { transferDate: 'asc' },
        },
        serviceRecords: {
          include: { garage: true },
          orderBy: { serviceDate: 'asc' },
        },
        odometerRecords: {
          include: { sourceUser: true },
          orderBy: { recordedAt: 'asc' },
        },
        accidentRecords: {
          include: { reportedBy: true },
          orderBy: { accidentDate: 'asc' },
        },
        insuranceRecords: {
          include: { provider: true },
          orderBy: { startDate: 'asc' },
        },
        documents: {
          include: { uploadedBy: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }

    // 1. Verify Vehicle Identity
    const vehicleIdentity = await this.verifyVehiclePassport(vehicleId);

    this.initContract();
    const contract = this.contract;

    let hasTamper = vehicleIdentity.tamperDetected;
    let hasSuspicious = false;

    // 2. Ownership History Verification
    const ownershipItems: CategoryVerificationItem[] = [];
    for (const item of vehicle.ownershipHistory) {
      let isVerified = false;
      let tamperDetected = false;
      let onChainHash: string | null = null;

      const prevOwnerBlockchainId = item.previousOwner?.blockchainUserId || 'GENESIS';
      const newOwnerBlockchainId = item.newOwner.blockchainUserId || 'UNKNOWN';

      let calculatedHash = item.recordHash;
      if (vehicle.blockchainVehicleId && item.transferType !== OwnershipTransferType.INITIAL_REGISTRATION) {
        calculatedHash = generateOwnershipRecordHash({
          blockchainVehicleId: vehicle.blockchainVehicleId,
          previousOwnerBlockchainId: prevOwnerBlockchainId,
          newOwnerBlockchainId: newOwnerBlockchainId,
          transferType: item.transferType,
          transferDate: item.transferDate,
        });
      }

      if (contract && item.blockchainRecordId) {
        try {
          if (item.transferType === OwnershipTransferType.INITIAL_REGISTRATION) {
            const onChainVeh = await contract.getVehicleById(vehicle.blockchainVehicleId!);
            onChainHash = onChainVeh.vehicleRecordHash;
          } else {
            const onChainRec = await contract.getRecord(item.blockchainRecordId);
            onChainHash = onChainRec.recordHash;
          }
          isVerified = calculatedHash.toLowerCase() === onChainHash!.toLowerCase();
          tamperDetected = !isVerified;
        } catch (e) {
          tamperDetected = true;
        }
      } else if (!contract) {
        isVerified = false;
      }

      if (tamperDetected) hasTamper = true;

      ownershipItems.push({
        id: item.id,
        category: 'OWNERSHIP',
        label: `${item.transferType}: ${item.previousOwner?.name || 'Initial'} → ${item.newOwner.name}`,
        isVerified,
        tamperDetected,
        calculatedHash,
        onChainHash,
        timestamp: item.transferDate.toISOString(),
        blockchainTxHash: item.blockchainTxHash,
        blockNumber: item.blockNumber,
        details: {
          transferType: item.transferType,
          previousOwner: item.previousOwner?.name || null,
          newOwner: item.newOwner.name,
          notes: item.notes,
        },
      });
    }

    // 3. Service Records Verification
    const serviceItems: CategoryVerificationItem[] = [];
    for (const item of vehicle.serviceRecords) {
      let isVerified = false;
      let tamperDetected = false;
      let onChainHash: string | null = null;

      const calculatedHash = generateServiceRecordHash({
        blockchainVehicleId: vehicle.blockchainVehicleId || '',
        garageBlockchainId: item.garage.blockchainUserId || item.garageId,
        serviceDate: item.serviceDate,
        mileage: item.mileage,
        serviceType: item.serviceType,
        description: item.description,
        partsReplaced: item.partsReplaced,
        cost: item.cost,
      });

      if (contract && item.blockchainRecordId) {
        try {
          const onChainRec = await contract.getRecord(item.blockchainRecordId);
          onChainHash = onChainRec.recordHash;
          isVerified = Boolean(onChainHash && calculatedHash.toLowerCase() === onChainHash.toLowerCase());
          tamperDetected = !isVerified;
        } catch (e) {
          tamperDetected = true;
        }
      }

      if (tamperDetected) hasTamper = true;

      serviceItems.push({
        id: item.id,
        category: 'SERVICE',
        label: `${item.serviceType} (${item.mileage.toLocaleString()} km)`,
        isVerified,
        tamperDetected,
        calculatedHash,
        onChainHash,
        timestamp: item.serviceDate.toISOString(),
        blockchainTxHash: item.blockchainTxHash,
        blockNumber: item.blockNumber,
        details: {
          garage: item.garage.name,
          mileage: item.mileage,
          serviceType: item.serviceType,
          description: item.description,
          partsReplaced: item.partsReplaced,
          cost: item.cost,
          technician: item.technician,
        },
      });
    }

    // 4. Odometer Records Verification
    const odometerItems: CategoryVerificationItem[] = [];
    let previousMileage = 0;
    let odometerRollbackFound = false;

    for (const item of vehicle.odometerRecords) {
      let isVerified = false;
      let tamperDetected = false;
      let onChainHash: string | null = null;

      const calculatedHash = generateOdometerRecordHash({
        blockchainVehicleId: vehicle.blockchainVehicleId || '',
        mileage: item.mileage,
        recordedAt: item.recordedAt,
        sourceType: item.sourceType,
      });

      if (contract && item.blockchainRecordId) {
        try {
          const onChainRec = await contract.getRecord(item.blockchainRecordId);
          onChainHash = onChainRec.recordHash;
          isVerified = Boolean(onChainHash && calculatedHash.toLowerCase() === onChainHash.toLowerCase());
          tamperDetected = !isVerified;
        } catch (e) {
          tamperDetected = true;
        }
      }

      const isSuspicious = item.rollbackDetected || item.verificationStatus === VerificationStatus.SUSPICIOUS || (previousMileage > 0 && item.mileage < previousMileage);
      if (isSuspicious) {
        odometerRollbackFound = true;
        hasSuspicious = true;
      }
      if (tamperDetected) hasTamper = true;
      if (item.mileage > previousMileage) {
        previousMileage = item.mileage;
      }

      odometerItems.push({
        id: item.id,
        category: 'ODOMETER',
        label: `${item.mileage.toLocaleString()} km (${item.sourceType})`,
        isVerified,
        tamperDetected,
        isSuspicious,
        calculatedHash,
        onChainHash,
        timestamp: item.recordedAt.toISOString(),
        blockchainTxHash: item.blockchainTxHash,
        blockNumber: item.blockNumber,
        details: {
          mileage: item.mileage,
          sourceType: item.sourceType,
          recordedBy: item.sourceUser.name,
          rollbackDetected: item.rollbackDetected,
          notes: item.notes,
        },
      });
    }

    // 5. Accident Records Verification
    const accidentItems: CategoryVerificationItem[] = [];
    for (const item of vehicle.accidentRecords) {
      let isVerified = false;
      let tamperDetected = false;
      let onChainHash: string | null = null;

      const calculatedHash = generateAccidentRecordHash({
        blockchainVehicleId: vehicle.blockchainVehicleId || '',
        accidentDate: item.accidentDate,
        severity: item.severity,
        description: item.description,
        damagedParts: item.damagedParts,
        repairStatus: item.repairStatus,
      });

      if (contract && item.blockchainRecordId) {
        try {
          const onChainRec = await contract.getRecord(item.blockchainRecordId);
          onChainHash = onChainRec.recordHash;
          isVerified = Boolean(onChainHash && calculatedHash.toLowerCase() === onChainHash.toLowerCase());
          tamperDetected = !isVerified;
        } catch (e) {
          tamperDetected = true;
        }
      }

      if (tamperDetected) hasTamper = true;

      accidentItems.push({
        id: item.id,
        category: 'ACCIDENT',
        label: `${item.severity} Accident — ${item.repairStatus}`,
        isVerified,
        tamperDetected,
        calculatedHash,
        onChainHash,
        timestamp: item.accidentDate.toISOString(),
        blockchainTxHash: item.blockchainTxHash,
        blockNumber: item.blockNumber,
        details: {
          severity: item.severity,
          description: item.description,
          damagedParts: item.damagedParts,
          repairStatus: item.repairStatus,
          repairDescription: item.repairDescription,
          reportedBy: item.reportedBy.name,
        },
      });
    }

    // 6. Insurance Records Verification
    const insuranceItems: CategoryVerificationItem[] = [];
    for (const item of vehicle.insuranceRecords) {
      let isVerified = false;
      let tamperDetected = false;
      let onChainHash: string | null = null;

      const calculatedHash = generateInsuranceRecordHash({
        blockchainVehicleId: vehicle.blockchainVehicleId || '',
        providerBlockchainId: item.provider.blockchainUserId || item.providerId,
        policyReference: item.policyReference,
        startDate: item.startDate,
        endDate: item.endDate,
        coverageType: item.coverageType,
      });

      if (contract && item.blockchainRecordId) {
        try {
          const onChainRec = await contract.getRecord(item.blockchainRecordId);
          onChainHash = onChainRec.recordHash;
          isVerified = Boolean(onChainHash && calculatedHash.toLowerCase() === onChainHash.toLowerCase());
          tamperDetected = !isVerified;
        } catch (e) {
          tamperDetected = true;
        }
      }

      if (tamperDetected) hasTamper = true;

      insuranceItems.push({
        id: item.id,
        category: 'INSURANCE',
        label: `${item.coverageType} Policy (${item.policyReference})`,
        isVerified,
        tamperDetected,
        calculatedHash,
        onChainHash,
        timestamp: item.startDate.toISOString(),
        blockchainTxHash: item.blockchainTxHash,
        blockNumber: item.blockNumber,
        details: {
          policyReference: item.policyReference,
          provider: item.provider.name,
          coverageType: item.coverageType,
          status: item.status,
          claimReference: item.claimReference,
        },
      });
    }

    // 7. Documents Verification
    const documentItems: CategoryVerificationItem[] = [];
    for (const item of vehicle.documents) {
      let isVerified = false;
      let tamperDetected = false;
      let onChainHash: string | null = null;

      const calculatedHash = generateDocumentRecordHash({
        blockchainVehicleId: vehicle.blockchainVehicleId || '',
        documentType: item.documentType,
        fileHash: item.fileHash,
        title: item.title,
      });

      if (contract && item.blockchainRecordId) {
        try {
          const onChainRec = await contract.getRecord(item.blockchainRecordId);
          onChainHash = onChainRec.recordHash;
          isVerified = Boolean(onChainHash && calculatedHash.toLowerCase() === onChainHash.toLowerCase());
          tamperDetected = !isVerified;
        } catch (e) {
          tamperDetected = true;
        }
      }

      if (tamperDetected) hasTamper = true;

      documentItems.push({
        id: item.id,
        category: 'DOCUMENT',
        label: `${item.title} (${item.documentType})`,
        isVerified,
        tamperDetected,
        calculatedHash,
        onChainHash,
        timestamp: item.createdAt.toISOString(),
        blockchainTxHash: item.blockchainTxHash,
        blockNumber: item.blockNumber,
        details: {
          documentType: item.documentType,
          fileName: item.fileName,
          fileSize: item.fileSize,
          mimeType: item.mimeType,
          fileHash: item.fileHash,
        },
      });
    }

    const overallVerified = vehicleIdentity.isVerified && !hasTamper && !hasSuspicious;

    return {
      vehicleId: vehicle.id,
      passportId: vehicle.passportId,
      vin: vehicle.vin,
      overallVerified,
      hasTamper,
      hasSuspicious,
      network: 'hardhat-local',
      verifiedAt: new Date().toISOString(),
      vehicleIdentity,
      categories: {
        ownership: {
          status: ownershipItems.length === 0 ? 'EMPTY' : (ownershipItems.some(i => i.tamperDetected) ? 'TAMPER_DETECTED' : 'VERIFIED'),
          count: ownershipItems.length,
          records: ownershipItems,
        },
        service: {
          status: serviceItems.length === 0 ? 'EMPTY' : (serviceItems.some(i => i.tamperDetected) ? 'TAMPER_DETECTED' : 'VERIFIED'),
          count: serviceItems.length,
          records: serviceItems,
        },
        odometer: {
          status: odometerItems.length === 0 ? 'EMPTY' : (odometerItems.some(i => i.tamperDetected) ? 'TAMPER_DETECTED' : (odometerRollbackFound ? 'SUSPICIOUS' : 'VERIFIED')),
          count: odometerItems.length,
          rollbackDetected: odometerRollbackFound,
          records: odometerItems,
        },
        accident: {
          status: accidentItems.length === 0 ? 'EMPTY' : (accidentItems.some(i => i.tamperDetected) ? 'TAMPER_DETECTED' : 'VERIFIED'),
          count: accidentItems.length,
          records: accidentItems,
        },
        insurance: {
          status: insuranceItems.length === 0 ? 'EMPTY' : (insuranceItems.some(i => i.tamperDetected) ? 'TAMPER_DETECTED' : 'VERIFIED'),
          count: insuranceItems.length,
          records: insuranceItems,
        },
        documents: {
          status: documentItems.length === 0 ? 'EMPTY' : (documentItems.some(i => i.tamperDetected) ? 'TAMPER_DETECTED' : 'VERIFIED'),
          count: documentItems.length,
          records: documentItems,
        },
      },
    };
  }

  public getContractAddress(): string {
    const config = getBlockchainConfig();
    return config.contractAddress;
  }

  public async getUser(blockchainUserId: string) {
    this.initContract();
    if (!this.contract) throw new Error('Contract not connected');
    return await this.contract.getUserById(blockchainUserId);
  }

  public async getVehicle(blockchainVehicleId: string) {
    this.initContract();
    if (!this.contract) throw new Error('Contract not connected');
    return await this.contract.getVehicleById(blockchainVehicleId);
  }

  public async getRecord(recordId: string) {
    this.initContract();
    if (!this.contract) throw new Error('Contract not connected');
    return await this.contract.getRecord(recordId);
  }

  public async verifyRecord(recordId: string, expectedHash: string): Promise<boolean> {
    const record = await this.getRecord(recordId);
    return record.recordHash.toLowerCase() === expectedHash.toLowerCase();
  }

  public async isPassportIdRegistered(passportId: string): Promise<boolean> {
    this.initContract();
    if (!this.contract) return false;
    try {
      await this.contract.getVehicleByPassportId(passportId);
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // PHASE 6: MERKLE BATCH ANCHORING & ON-CHAIN VERIFICATION
  // ==========================================================================

  /**
   * Anchors a Merkle root batch on-chain
   */
  public async anchorMerkleBatch(params: {
    batchIdHex: string;
    merkleRoot: string;
    leafCount: number;
    metadataHash: string;
  }): Promise<{
    txHash: string;
    blockNumber: number;
    blockHash: string;
    gasUsed: bigint;
  }> {
    this.initContract();
    if (!this.contract) {
      throw new Error('Blockchain contract is not connected');
    }

    const tx = await this.contract.anchorBatch(
      params.batchIdHex,
      params.merkleRoot,
      params.leafCount,
      params.metadataHash
    );

    const receipt = await tx.wait();

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      gasUsed: receipt.gasUsed,
    };
  }

  /**
   * Fetches an on-chain anchored batch by its 32-byte hex ID
   */
  public async getOnChainBatch(batchIdHex: string): Promise<{
    batchId: string;
    merkleRoot: string;
    leafCount: bigint;
    metadataHash: string;
    actorAddress: string;
    timestamp: bigint;
    blockNumber: bigint;
    active: boolean;
  }> {
    this.initContract();
    if (!this.contract) {
      throw new Error('Blockchain contract is not connected');
    }

    const batch = await this.contract.getBatch(batchIdHex);
    return {
      batchId: batch.batchId,
      merkleRoot: batch.merkleRoot,
      leafCount: batch.leafCount,
      metadataHash: batch.metadataHash,
      actorAddress: batch.actorAddress,
      timestamp: batch.timestamp,
      blockNumber: batch.blockNumber,
      active: batch.active,
    };
  }

  /**
   * Checks whether a batch is anchored on-chain
   */
  public async isBatchAnchoredOnChain(batchIdHex: string): Promise<boolean> {
    this.initContract();
    if (!this.contract) return false;
    try {
      return await this.contract.isBatchAnchored(batchIdHex);
    } catch {
      return false;
    }
  }

  /**
   * Verifies inclusion proof on-chain against committed batch root
   */
  public async verifyBatchInclusionOnChain(
    batchIdHex: string,
    leaf: string,
    proof: string[]
  ): Promise<boolean> {
    this.initContract();
    if (!this.contract) {
      throw new Error('Blockchain contract is not connected');
    }
    return await this.contract.verifyBatchInclusion(batchIdHex, leaf, proof);
  }

  /**
   * Pure on-chain verification of inclusion proof without stored batch lookup
   */
  public async verifyInclusionProofOnChain(
    leaf: string,
    proof: string[],
    root: string
  ): Promise<boolean> {
    this.initContract();
    if (!this.contract) {
      throw new Error('Blockchain contract is not connected');
    }
    return await this.contract.verifyInclusionProof(leaf, proof, root);
  }

  /**
   * Reconciles transaction status with provider and on-chain contract
   */
  public async reconcileBatchOnChain(batchIdHex: string, txHash?: string | null): Promise<{
    isAnchored: boolean;
    onChainRoot?: string;
    receipt?: ethers.TransactionReceipt | null;
    error?: string;
  }> {
    this.initContract();
    if (!this.contract || !this.provider) {
      return { isAnchored: false, error: 'Blockchain provider or contract not available' };
    }

    try {
      const isAnchored = await this.contract.isBatchAnchored(batchIdHex);
      if (isAnchored) {
        const batch = await this.contract.getBatch(batchIdHex);
        let receipt: ethers.TransactionReceipt | null = null;
        if (txHash) {
          receipt = await this.provider.getTransactionReceipt(txHash).catch(() => null);
        }
        return {
          isAnchored: true,
          onChainRoot: batch.merkleRoot,
          receipt,
        };
      }

      // If not yet anchored but txHash provided, check receipt
      if (txHash) {
        const receipt = await this.provider.getTransactionReceipt(txHash).catch(() => null);
        if (receipt) {
          if (receipt.status === 0) {
            return { isAnchored: false, receipt, error: 'Transaction reverted on-chain' };
          }
          const activeNow = await this.contract.isBatchAnchored(batchIdHex).catch(() => false);
          if (activeNow) {
            const batch = await this.contract.getBatch(batchIdHex);
            return { isAnchored: true, onChainRoot: batch.merkleRoot, receipt };
          }
        }
      }

      return { isAnchored: false };
    } catch (err: any) {
      return { isAnchored: false, error: err.message };
    }
  }
}

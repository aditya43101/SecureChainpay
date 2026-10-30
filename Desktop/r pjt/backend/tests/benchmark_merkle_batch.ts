import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildMerkleTree,
  verifyInclusionProof,
  MerkleRecordInput,
} from '../src/blockchain/services/merkleService';
import VehiclePassportArtifact from '../src/blockchain/contracts/VehiclePassport.json';

interface BenchmarkBatchResult {
  batchSize: number;
  treeConstructionTimeMs: number;
  proofGenerationTotalTimeMs: number;
  proofVerificationTotalTimeMs: number;
  avgProofGenerationTimeMs: number;
  avgProofVerificationTimeMs: number;
  transactionHash: string;
  blockNumber: number;
  gasUsedTotal: number;
  gasPerRecord: number;
  onChainVerificationGas: number;
  txLatencyMs: number;
  gasSavingsPercent: number;
}

interface BenchmarkSuiteReport {
  environment: {
    nodeEnv: string;
    network: string;
    chainId: number;
    rpcUrl: string;
    contractAddress: string;
    contractVersion: string;
    timestamp: string;
  };
  individualAnchoring: {
    recordCount: number;
    totalGasUsed: number;
    avgGasPerRecord: number;
    avgTxLatencyMs: number;
    totalLatencyMs: number;
  };
  batchAnchoring: BenchmarkBatchResult[];
  summary: {
    maxBatchTested: number;
    peakGasSavingsPercent: number;
    peakThroughputMultiplier: number;
  };
}

async function runBenchmark() {
  console.log('================================================================');
  console.log('⚡ MERKLE BATCH ANCHORING & CRYPTOGRAPHIC VERIFICATION BENCHMARK');
  console.log('================================================================\n');

  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
  const privateKey =
    process.env.BLOCKCHAIN_PRIVATE_KEY ||
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Hardhat account #0
  const contractAddress =
    process.env.BLOCKCHAIN_CONTRACT_ADDRESS ||
    '0x5FbDB2315678afecb367f032d93F642f64180aa3';

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, VehiclePassportArtifact.abi, signer);

  const network = await provider.getNetwork();
  console.log(`📡 Connected to Network: Chain ID ${network.chainId.toString()}`);
  console.log(`📝 Contract Address: ${contractAddress}`);
  console.log(`👤 Signer Address: ${await signer.getAddress()}\n`);

  // --- Step 1: Benchmark Individual Anchoring (Baseline) ---
  console.log('--- 1. Benchmarking Baseline: Individual On-Chain Anchoring ---');
  const INDIVIDUAL_SAMPLE_SIZE = 10;
  const individualReceipts: { gasUsed: bigint; latencyMs: number }[] = [];

  // Register a benchmark vehicle on-chain
  const dummyVehicleId = `BV-${Date.now()}`;
  const dummyPassportId = `VP-B${Date.now()}`.slice(0, 15);
  const dummyVinHash = ethers.keccak256(ethers.toUtf8Bytes(`VIN-BENCH-${Date.now()}`));

  let currentNonce = await provider.getTransactionCount(await signer.getAddress(), 'pending');

  try {
    const regTx = await contract.registerVehicle(
      dummyVehicleId,
      dummyVinHash,
      dummyPassportId,
      await signer.getAddress(),
      { nonce: currentNonce++ }
    );
    await regTx.wait();
    console.log(`🚗 Registered benchmark vehicle on-chain: ${dummyPassportId} (ID: ${dummyVehicleId})`);
  } catch (err: any) {
    console.log(`ℹ️ Vehicle setup notice: ${err.message?.slice(0, 80)}`);
    currentNonce = await provider.getTransactionCount(await signer.getAddress(), 'pending');
  }

  for (let i = 0; i < INDIVIDUAL_SAMPLE_SIZE; i++) {
    const recordId = `BR-${Date.now()}-${i}`;
    const recordHash = ethers.keccak256(ethers.toUtf8Bytes(`INDIVIDUAL-RECORD-${Date.now()}-${i}`));
    const startTx = Date.now();
    const tx = await contract.anchorRecord(
      recordId,
      dummyVehicleId,
      'SERVICE',
      recordHash,
      { nonce: currentNonce++ }
    );
    const receipt = await tx.wait();
    const latency = Date.now() - startTx;
    individualReceipts.push({
      gasUsed: receipt.gasUsed,
      latencyMs: latency,
    });
    process.stdout.write(`  [Record ${i + 1}/${INDIVIDUAL_SAMPLE_SIZE}] Gas: ${receipt.gasUsed.toString()} | Latency: ${latency}ms\r`);
  }

  const individualTotalGas = individualReceipts.reduce((acc, r) => acc + Number(r.gasUsed), 0);
  const individualAvgGas = Math.round(individualTotalGas / INDIVIDUAL_SAMPLE_SIZE);
  const individualTotalLatency = individualReceipts.reduce((acc, r) => acc + r.latencyMs, 0);
  const individualAvgLatency = Math.round(individualTotalLatency / INDIVIDUAL_SAMPLE_SIZE);

  console.log(`\n✅ Individual Anchoring Baseline:`);
  console.log(`   Sample Size: ${INDIVIDUAL_SAMPLE_SIZE} records`);
  console.log(`   Avg Gas Per Record: ${individualAvgGas.toLocaleString()} gas`);
  console.log(`   Avg Transaction Latency: ${individualAvgLatency}ms`);
  console.log(`   Total Gas for ${INDIVIDUAL_SAMPLE_SIZE} records: ${individualTotalGas.toLocaleString()} gas\n`);

  // --- Step 2: Benchmark Merkle Batch Anchoring across multiple sizes ---
  console.log('--- 2. Benchmarking Merkle Batch Anchoring (N = 1, 10, 50, 100) ---');
  const batchSizes = [1, 10, 50, 100];
  const batchResults: BenchmarkBatchResult[] = [];

  for (const size of batchSizes) {
    console.log(`\n⏳ Running Benchmark for Batch Size N = ${size}...`);

    // 1. Generate N synthetic records
    const records: MerkleRecordInput[] = [];
    for (let i = 0; i < size; i++) {
      const recId = `REC-BENCH-${size}-${i}`;
      const recHash = ethers.keccak256(ethers.toUtf8Bytes(`RECORD_PAYLOAD_${size}_${i}`));
      records.push({
        recordId: recId,
        recordType: 'SERVICE',
        recordHash: recHash,
        vehicleId: dummyVehicleId,
      });
    }

    // 2. Measure Tree Construction & Proof Generation Time
    const startTree = performance.now();
    const tree = buildMerkleTree(records);
    const treeConstructionTimeMs = Math.round((performance.now() - startTree) * 100) / 100;

    // 3. Extract Proofs for all records
    const proofs: Array<{ leaf: string; proof: string[] }> = tree.leaves.map((l) => ({
      leaf: l.leafHash,
      proof: tree.proofs[l.recordId] || [],
    }));
    const proofGenerationTotalTimeMs = treeConstructionTimeMs;
    const avgProofGenerationTimeMs = Math.round((proofGenerationTotalTimeMs / size) * 1000) / 1000;

    // 4. Measure Off-chain Proof Verification for all records
    const startProofVer = performance.now();
    for (let i = 0; i < size; i++) {
      const v = verifyInclusionProof(proofs[i].leaf, proofs[i].proof, tree.root);
      if (!v.valid) {
        throw new Error(`Off-chain proof failed for record ${i} in batch size ${size}`);
      }
    }
    const proofVerificationTotalTimeMs = Math.round((performance.now() - startProofVer) * 100) / 100;
    const avgProofVerificationTimeMs = Math.round((proofVerificationTotalTimeMs / size) * 1000) / 1000;

    // 5. Measure On-Chain Batch Anchoring Transaction
    const batchId = ethers.keccak256(ethers.toUtf8Bytes(`BATCH-BENCH-${size}-${Date.now()}`));
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(`METADATA-${size}-${Date.now()}`));

    const startTx = performance.now();
    const tx = await contract.anchorBatch(batchId, tree.root, size, metadataHash, {
      nonce: currentNonce++,
    });
    const receipt = await tx.wait();
    const txLatencyMs = Math.round(performance.now() - startTx);

    const gasUsedTotal = Number(receipt.gasUsed);
    const gasPerRecord = Math.round(gasUsedTotal / size);

    // 6. Measure On-Chain Pure Proof Verification Gas
    let onChainVerificationGas = 0;
    if (proofs.length > 0) {
      const sampleProof = proofs[0];
      const estGas = await contract.verifyInclusionProof.estimateGas(
        sampleProof.leaf,
        sampleProof.proof,
        tree.root
      );
      onChainVerificationGas = Number(estGas);
    }

    const gasSavingsPercent =
      Math.round(((individualAvgGas - gasPerRecord) / individualAvgGas) * 10000) / 100;

    console.log(`  ✓ Tree Construction: ${treeConstructionTimeMs}ms`);
    console.log(`  ✓ Proof Generation (All ${size}): ${proofGenerationTotalTimeMs}ms (Avg ${avgProofGenerationTimeMs}ms)`);
    console.log(`  ✓ Proof Verification (All ${size}): ${proofVerificationTotalTimeMs}ms (Avg ${avgProofVerificationTimeMs}ms)`);
    console.log(`  ✓ On-Chain Batch Tx Hash: ${receipt.hash.slice(0, 18)}...`);
    console.log(`  ✓ Batch Total Gas: ${gasUsedTotal.toLocaleString()} gas`);
    console.log(`  ✓ Gas Per Record: ${gasPerRecord.toLocaleString()} gas`);
    console.log(`  ✓ Gas Savings vs Individual: ${gasSavingsPercent}%`);
    console.log(`  ✓ On-Chain Proof Verification Gas: ${onChainVerificationGas.toLocaleString()} gas`);

    batchResults.push({
      batchSize: size,
      treeConstructionTimeMs,
      proofGenerationTotalTimeMs,
      proofVerificationTotalTimeMs,
      avgProofGenerationTimeMs,
      avgProofVerificationTimeMs,
      transactionHash: receipt.hash,
      blockNumber: Number(receipt.blockNumber),
      gasUsedTotal,
      gasPerRecord,
      onChainVerificationGas,
      txLatencyMs,
      gasSavingsPercent,
    });
  }

  // --- Step 3: Comparison & Efficiency Analysis ---
  console.log('\n================================================================');
  console.log('📊 PERFORMANCE BENCHMARK COMPARATIVE MATRIX');
  console.log('================================================================');
  console.log('| Metric                    | Individual | Batch N=1  | Batch N=10 | Batch N=50 | Batch N=100 |');
  console.log('|---------------------------|------------|------------|------------|------------|-------------|');

  const b1 = batchResults.find((b) => b.batchSize === 1)!;
  const b10 = batchResults.find((b) => b.batchSize === 10)!;
  const b50 = batchResults.find((b) => b.batchSize === 50)!;
  const b100 = batchResults.find((b) => b.batchSize === 100)!;

  console.log(
    `| Total On-Chain Txs        | 1 per rec  | 1 tx total | 1 tx total | 1 tx total | 1 tx total  |`
  );
  console.log(
    `| Gas Per Record (gas)      | ${individualAvgGas.toLocaleString().padEnd(10)} | ${b1.gasPerRecord.toLocaleString().padEnd(10)} | ${b10.gasPerRecord.toLocaleString().padEnd(10)} | ${b50.gasPerRecord.toLocaleString().padEnd(10)} | ${b100.gasPerRecord.toLocaleString().padEnd(11)} |`
  );
  console.log(
    `| Gas Reduction (%)         | Baseline   | ${b1.gasSavingsPercent.toFixed(1)}%     | ${b10.gasSavingsPercent.toFixed(1)}%     | ${b50.gasSavingsPercent.toFixed(1)}%     | ${b100.gasSavingsPercent.toFixed(1)}%      |`
  );
  console.log(
    `| Tree Build Time (ms)      | N/A        | ${b1.treeConstructionTimeMs.toFixed(2).padEnd(10)} | ${b10.treeConstructionTimeMs.toFixed(2).padEnd(10)} | ${b50.treeConstructionTimeMs.toFixed(2).padEnd(10)} | ${b100.treeConstructionTimeMs.toFixed(2).padEnd(11)} |`
  );
  console.log(
    `| Proof Gen Time / Rec (ms) | N/A        | ${b1.avgProofGenerationTimeMs.toFixed(3).padEnd(10)} | ${b10.avgProofGenerationTimeMs.toFixed(3).padEnd(10)} | ${b50.avgProofGenerationTimeMs.toFixed(3).padEnd(10)} | ${b100.avgProofGenerationTimeMs.toFixed(3).padEnd(11)} |`
  );
  console.log(
    `| Proof Ver Time / Rec (ms) | N/A        | ${b1.avgProofVerificationTimeMs.toFixed(3).padEnd(10)} | ${b10.avgProofVerificationTimeMs.toFixed(3).padEnd(10)} | ${b50.avgProofVerificationTimeMs.toFixed(3).padEnd(10)} | ${b100.avgProofVerificationTimeMs.toFixed(3).padEnd(11)} |`
  );
  console.log('================================================================\n');

  // Build JSON Report
  const report: BenchmarkSuiteReport = {
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      network: 'Local Hardhat Development Network',
      chainId: Number(network.chainId),
      rpcUrl,
      contractAddress,
      contractVersion: 'VehiclePassport.sol (v6 - Merkle Batched)',
      timestamp: new Date().toISOString(),
    },
    individualAnchoring: {
      recordCount: INDIVIDUAL_SAMPLE_SIZE,
      totalGasUsed: individualTotalGas,
      avgGasPerRecord: individualAvgGas,
      avgTxLatencyMs: individualAvgLatency,
      totalLatencyMs: individualTotalLatency,
    },
    batchAnchoring: batchResults,
    summary: {
      maxBatchTested: 100,
      peakGasSavingsPercent: b100.gasSavingsPercent,
      peakThroughputMultiplier: 100,
    },
  };

  const outputPath = path.join(__dirname, 'benchmark_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`💾 Machine-readable benchmark report saved to: ${outputPath}`);
}

runBenchmark().catch((err) => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});

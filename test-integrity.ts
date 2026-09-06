import { 
  simulatePaymentErasureAttack, 
  getIntegrityIncidents, 
  recordPaymentAudit
} from './src/lib/blockchain/integrity-service';
import { db as prisma } from './src/lib/db';

async function main() {
  console.log('--- RUNNING INTEGRITY TEST ---');

  // Seed DB with mock payment intents
  for (let i = 1; i <= 3; i++) {
    const intent = await prisma.paymentIntent.create({
      data: {
        sender: '0x123',
        recipient: '0x456',
        amount: 100 * i,
        currency: 'USD',
        status: 'CONFIRMED',
        idempotencyKey: `test_idemp_${Date.now()}_${i}`
      }
    });
    await recordPaymentAudit(intent.id);
  }

  console.log('1. Fetching initial incidents...');
  const init = await getIntegrityIncidents();
  console.log('Initial incidents:', init.length);
  
  console.log('2. Running simulated erasure attack (deleting last payment audit log)...');
  try {
    await simulatePaymentErasureAttack();
  } catch (err: any) {
    console.error('Error during simulation:', err.message);
  }
  
  console.log('3. Fetching updated incidents...');
  const updated = await getIntegrityIncidents();
  console.log('Updated incidents:', updated.length);
  console.log('Latest incident:', updated[0]?.type, updated[0]?.evidence);
  
  process.exit(0);
}

main().catch(console.error);

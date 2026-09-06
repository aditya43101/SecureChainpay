const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

async function main() {
  const dbDefault = getFirestore(app);
  const dbCustom = getFirestore(app, 'securechainpay');

  try {
    console.log('Testing (default) database...');
    const snap = await dbDefault.collection('users').limit(1).get();
    console.log('(default) users count:', snap.size);
  } catch (err) {
    console.error('(default) error:', err.message);
  }

  try {
    console.log('Testing "securechainpay" database...');
    const snap = await dbCustom.collection('users').limit(1).get();
    console.log('"securechainpay" users count:', snap.size);
  } catch (err) {
    console.error('"securechainpay" error:', err.message);
  }
}

main().catch(console.error);

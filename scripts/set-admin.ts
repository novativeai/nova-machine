/**
 * Script to set admin status for a user
 *
 * Usage:
 *   ts-node scripts/set-admin.ts novativeai@gmail.com
 *
 * Or using the API:
 *   curl -X POST http://localhost:3000/api/admin/setup \
 *     -H "Content-Type: application/json" \
 *     -d '{"email": "novativeai@gmail.com", "secret": "your-secret-here"}'
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setAdmin(email: string) {
  try {
    console.log(`Setting admin status for: ${email}`);

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.error('❌ User not found with email:', email);
      console.error('Make sure the user has signed up first!');
      process.exit(1);
    }

    const userDoc = querySnapshot.docs[0];
    await updateDoc(userDoc.ref, {
      isAdmin: true,
      updatedAt: serverTimestamp(),
    });

    console.log(`✅ Admin status granted to: ${email}`);
    console.log('User is now an admin.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting admin status:', error);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Usage: ts-node scripts/set-admin.ts <email>');
  console.error('Example: ts-node scripts/set-admin.ts novativeai@gmail.com');
  process.exit(1);
}

setAdmin(email);

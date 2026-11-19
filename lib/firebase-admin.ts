import { initializeApp, getApps, cert, type ServiceAccount, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Firebase Admin SDK Configuration
 * Used for server-side operations like authentication verification,
 * direct database access, and privileged operations.
 *
 * Initialization is lazy to prevent build-time errors when
 * environment variables are not available.
 */

let _adminApp: App | null = null;
let _adminDb: Firestore | null = null;
let _adminAuth: Auth | null = null;

/**
 * Get or initialize the Firebase Admin app
 * Throws error at runtime if credentials are missing
 */
function getAdminApp(): App {
  if (_adminApp) return _adminApp;

  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Missing Firebase Admin credentials. Please check your environment variables:\n' +
        '- FIREBASE_PROJECT_ID\n' +
        '- FIREBASE_CLIENT_EMAIL\n' +
        '- FIREBASE_PRIVATE_KEY'
      );
    }

    const serviceAccount: ServiceAccount = {
      projectId,
      clientEmail,
      // Handle newline characters in private key
      privateKey: privateKey.replace(/\\n/g, '\n'),
    };

    _adminApp = initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    _adminApp = getApps()[0];
  }

  return _adminApp;
}

/**
 * Firebase Admin Firestore Database
 * Use for server-side database operations
 */
export function getAdminDb(): Firestore {
  if (!_adminDb) {
    getAdminApp();
    _adminDb = getFirestore();
  }
  return _adminDb;
}

/**
 * Firebase Admin Authentication
 * Use for server-side auth operations like token verification
 */
export function getAdminAuth(): Auth {
  if (!_adminAuth) {
    getAdminApp();
    _adminAuth = getAuth();
  }
  return _adminAuth;
}

// Legacy exports for backward compatibility (lazy getters)
export const adminDb = {
  get instance() {
    return getAdminDb();
  },
};

export const adminAuth = {
  get instance() {
    return getAdminAuth();
  },
};

/**
 * Helper function to verify Firebase ID token
 * @param idToken - Firebase ID token from client
 * @returns Decoded token with user information
 */
export async function verifyIdToken(idToken: string) {
  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying ID token:', error);
    throw new Error('Invalid or expired token');
  }
}

/**
 * Helper function to get user by UID
 * @param uid - Firebase user UID
 * @returns User record
 */
export async function getUserByUid(uid: string) {
  try {
    const auth = getAdminAuth();
    const userRecord = await auth.getUser(uid);
    return userRecord;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw new Error('User not found');
  }
}

/**
 * Helper function to set admin status for a user by email
 * @param email - User email address
 * @param isAdmin - Admin status to set
 * @returns Success boolean
 */
export async function setAdminStatusByEmail(email: string, isAdmin: boolean): Promise<boolean> {
  try {
    const db = getAdminDb();
    const auth = getAdminAuth();

    // Try to find existing user by email in Firestore
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();

    if (!snapshot.empty) {
      // User exists in Firestore - update it
      const userDoc = snapshot.docs[0];
      await userDoc.ref.update({
        isAdmin,
        updatedAt: new Date(),
      });
      console.log(`✅ Admin status set for existing user:`, email);
      return true;
    }

    // User doesn't exist in Firestore yet
    // Check if they exist in Firebase Auth
    let authUser;
    try {
      authUser = await auth.getUserByEmail(email);
      console.log(`Found user in Auth, creating Firestore document...`);
    } catch (authError: unknown) {
      if ((authError as { code?: string })?.code === 'auth/user-not-found') {
        // User doesn't exist anywhere - create placeholder
        console.log(`⚠️  User not found. Creating admin-enabled document for when they sign up...`);
        const placeholderId = `admin_${email.replace(/[@.]/g, '_')}`;
        await usersRef.doc(placeholderId).set({
          email,
          isAdmin: true,
          isPendingSignup: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`✅ Created pre-configured admin document. User will be admin when they sign up.`);
        return true;
      }
      throw authError;
    }

    // User exists in Auth but not Firestore - create document
    await usersRef.doc(authUser.uid).set({
      uid: authUser.uid,
      email: authUser.email || email,
      name: authUser.displayName || null,
      imageUrl: authUser.photoURL || null,
      isAdmin: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✅ Created Firestore document with admin status for:`, email);
    return true;
  } catch (error) {
    console.error('❌ Error setting admin status:', error);
    return false;
  }
}

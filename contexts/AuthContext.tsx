'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createUser, getUser } from '@/lib/firestore';
import type { User as FirestoreUser } from '@/lib/firestore';

interface AuthContextType {
  user: User | null;
  firestoreUser: FirestoreUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firestoreUser, setFirestoreUser] = useState<FirestoreUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setUser(firebaseUser);

        if (firebaseUser) {
          // Fetch Firestore user data with retry logic
          // onAuthStateChanged fires before createUser completes, so we retry
          let userData = null;
          let retries = 0;
          const maxRetries = 3;
          
          while (!userData && retries < maxRetries) {
            userData = await getUser(firebaseUser.uid);
            if (!userData && retries < maxRetries - 1) {
              // Wait and retry (race condition: auth fires before Firestore doc exists)
              await new Promise(resolve => setTimeout(resolve, 200 * (retries + 1)));
              retries++;
            }
          }
          
          setFirestoreUser(userData);
        } else {
          setFirestoreUser(null);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);

    // Create Firestore user document
    await createUser(newUser.uid, {
      uid: newUser.uid,
      email: newUser.email!,
      name: name || newUser.displayName || undefined,
      imageUrl: newUser.photoURL || undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createdAt: new Date() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedAt: new Date() as any,
    });
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const { user: newUser } = await signInWithPopup(auth, provider);

    // Check if user already exists
    const existingUser = await getUser(newUser.uid);

    if (!existingUser) {
      // Create Firestore user document for new Google users
      await createUser(newUser.uid, {
        uid: newUser.uid,
        email: newUser.email!,
        name: newUser.displayName || undefined,
        imageUrl: newUser.photoURL || undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createdAt: new Date() as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedAt: new Date() as any,
      });
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const value = {
    user,
    firestoreUser,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

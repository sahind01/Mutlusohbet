// src/lib/context/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { User as AppUser, Gender, UserStatus } from '@/types';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUserStatus: (status: string) => Promise<void>;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  gender: Gender;
  profilePhoto?: string;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({ 
              id: firebaseUser.uid, 
              ...userData,
              createdAt: userData.createdAt?.toDate() || new Date(),
              lastActive: userData.lastActive?.toDate() || new Date(),
              premiumSince: userData.premiumSince?.toDate(),
              premiumExpiry: userData.premiumExpiry?.toDate(),
              bannedUntil: userData.bannedUntil?.toDate(),
            } as AppUser);
          }
        } catch (error) {
          console.error('Kullanıcı verisi alınamadı:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const register = async (data: RegisterData) => {
    const { user: firebaseUser } = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );

    const userData = {
      username: data.username,
      email: data.email,
      gender: data.gender,
      profilePhoto: data.profilePhoto || '/default-avatar.png',
      role: 'free' as const,
      status: 'online' as const,
      dailyMatches: 0,
      totalMatches: 0,
      reports: [],
      matchHistory: [],
      createdAt: new Date(),
      lastActive: new Date()
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), userData);
    setUser({ id: firebaseUser.uid, ...userData } as AppUser);
  };

  const login = async (email: string, password: string) => {
    const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const user = { 
        id: firebaseUser.uid, 
        ...userData,
        createdAt: userData.createdAt?.toDate() || new Date(),
        lastActive: userData.lastActive?.toDate() || new Date(),
        premiumSince: userData.premiumSince?.toDate(),
        premiumExpiry: userData.premiumExpiry?.toDate(),
        bannedUntil: userData.bannedUntil?.toDate(),
      } as AppUser;
      
      if (user.status === 'banned') {
        throw new Error('Hesabınız yasaklanmıştır.');
      }
      
      setUser(user);
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        status: 'online',
        lastActive: new Date()
      });
    }
  };

  const logout = async () => {
    if (user) {
      await updateDoc(doc(db, 'users', user.id), {
        status: 'offline',
        lastActive: new Date()
      });
    }
    await signOut(auth);
    setUser(null);
  };

  const updateUserStatus = async (status: string) => {
    if (user) {
      await updateDoc(doc(db, 'users', user.id), { status });
      setUser({ ...user, status: status as UserStatus });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUserStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

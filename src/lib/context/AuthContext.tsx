// src/lib/context/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { User as AppUser } from '@/types';

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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser({ id: firebaseUser.uid, ...userDoc.data() } as AppUser);
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

    const userData: Partial<AppUser> = {
      username: data.username,
      email: data.email,
      gender: data.gender,
      profilePhoto: data.profilePhoto || '/default-avatar.png',
      role: 'free',
      status: 'online',
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
      const userData = { id: firebaseUser.uid, ...userDoc.data() } as AppUser;
      
      if (userData.status === 'banned') {
        throw new Error('Hesabınız yasaklanmıştır.');
      }
      
      setUser(userData);
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

export const useAuth = () => useContext(AuthContext);

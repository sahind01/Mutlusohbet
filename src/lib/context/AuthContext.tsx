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
import { auth, db, ref, set, get, update } from '@/lib/firebase';
import type { Gender, UserStatus } from '@/types';

interface AppUser {
  id: string;
  username: string;
  email: string;
  gender: string;
  profilePhoto: string;
  role: string;
  status: string;
  dailyMatches: number;
  totalMatches: number;
  reports: any[];
  matchHistory: any[];
  createdAt: any;
  lastActive: any;
  premiumSince?: any;
  premiumExpiry?: any;
  bannedUntil?: any;
  banReason?: string;
}

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
          const userRef = ref(db, `users/${firebaseUser.uid}`);
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            setUser({ id: firebaseUser.uid, ...snapshot.val() } as AppUser);
          } else {
            setUser(null);
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
      role: 'free',
      status: 'online',
      dailyMatches: 0,
      totalMatches: 0,
      reports: [],
      matchHistory: [],
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };

    await set(ref(db, `users/${firebaseUser.uid}`), userData);
    setUser({ id: firebaseUser.uid, ...userData } as AppUser);
  };

  const login = async (email: string, password: string) => {
    const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password);
    const userRef = ref(db, `users/${firebaseUser.uid}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      const userData = snapshot.val();
      const appUser = { id: firebaseUser.uid, ...userData } as AppUser;
      
      if (appUser.status === 'banned') {
        throw new Error('Hesabınız yasaklanmıştır.');
      }
      
      setUser(appUser);
      await update(ref(db, `users/${firebaseUser.uid}`), {
        status: 'online',
        lastActive: new Date().toISOString()
      });
    } else {
      // Kullanıcı auth'da var ama DB'de yoksa oluştur
      const newUser = {
        username: firebaseUser.email?.split('@')[0] || 'Kullanıcı',
        email: email,
        gender: 'other',
        profilePhoto: '/default-avatar.png',
        role: 'free',
        status: 'online',
        dailyMatches: 0,
        totalMatches: 0,
        reports: [],
        matchHistory: [],
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };
      await set(ref(db, `users/${firebaseUser.uid}`), newUser);
      setUser({ id: firebaseUser.uid, ...newUser } as AppUser);
    }
  };

  const logout = async () => {
    if (user) {
      await update(ref(db, `users/${user.id}`), {
        status: 'offline',
        lastActive: new Date().toISOString()
      });
    }
    await signOut(auth);
    setUser(null);
  };

  const updateUserStatus = async (status: string) => {
    if (user) {
      await update(ref(db, `users/${user.id}`), { status });
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

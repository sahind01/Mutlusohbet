// src/types/index.ts
export type UserRole = 'free' | 'premium' | 'admin';
export type Gender = 'male' | 'female' | 'other';
export type UserStatus = 'online' | 'offline' | 'banned' | 'in-call';

export interface User {
  id: string;
  username: string;
  email: string;
  password?: string;
  gender: Gender;
  profilePhoto: string;
  role: UserRole;
  status: UserStatus;
  dailyMatches: number;
  totalMatches: number;
  premiumSince?: Date;
  premiumExpiry?: Date;
  bannedUntil?: Date;
  banReason?: string;
  reports: Report[];
  createdAt: Date;
  lastActive: Date;
  matchHistory: MatchHistory[];
}

export interface MatchHistory {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerPhoto: string;
  duration: number;
  timestamp: Date;
  rating?: number;
}

export interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  description: string;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: Date;
}

export interface Advertisement {
  id: string;
  name: string;
  type: 'banner' | 'popup' | 'script';
  position?: 'top' | 'bottom' | 'fixed';
  imageUrl?: string;
  gifUrl?: string;
  targetUrl?: string;
  scriptCode?: string;
  isActive: boolean;
  impressions: number;
  clicks: number;
  startDate: Date;
  endDate: Date;
  createdBy: string;
  customStyles?: Record<string, string>;
}

export interface PremiumPackage {
  id: string;
  name: string;
  duration: number; // gün
  price: number;
  features: string[];
  isActive: boolean;
}

export interface Statistics {
  dailyUsers: number;
  dailyMatches: number;
  premiumSales: number;
  adImpressions: number;
  adClicks: number;
  activeUsers: number;
  date: Date;
}

export interface ChatRoom {
  id: string;
  participant1: string;
  participant2: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'ended';
}

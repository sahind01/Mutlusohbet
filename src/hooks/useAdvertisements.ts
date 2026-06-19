// src/hooks/useAdvertisements.ts
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, increment } from 'firebase/firestore';
import type { Advertisement } from '@/types';

export function useAdvertisements(position?: 'top' | 'bottom' | 'fixed' | 'popup') {
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [currentAd, setCurrentAd] = useState<Advertisement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdvertisements();
  }, [position]);

  const loadAdvertisements = async () => {
    try {
      const now = new Date();
      const adsRef = collection(db, 'advertisements');
      let q = query(
        adsRef,
        where('isActive', '==', true),
        where('startDate', '<=', now),
        where('endDate', '>=', now)
      );

      if (position) {
        q = query(q, where('position', '==', position));
      }

      const snapshot = await getDocs(q);
      const ads = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Advertisement[];

      setAdvertisements(ads);
      
      // Rastgele bir reklam seç
      if (ads.length > 0) {
        const randomAd = ads[Math.floor(Math.random() * ads.length)];
        setCurrentAd(randomAd);
      }
    } catch (error) {
      console.error('Reklam yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const recordImpression = async (adId: string) => {
    try {
      await updateDoc(doc(db, 'advertisements', adId), {
        impressions: increment(1)
      });
    } catch (error) {
      console.error('Gösterim kaydı hatası:', error);
    }
  };

  const recordClick = async (adId: string) => {
    try {
      await updateDoc(doc(db, 'advertisements', adId), {
        clicks: increment(1)
      });
      
      // İstatistikleri güncelle
      const today = new Date().toISOString().split('T')[0];
      const statsRef = doc(db, 'statistics', today);
      await updateDoc(statsRef, {
        adClicks: increment(1),
        adImpressions: increment(1)
      });
    } catch (error) {
      console.error('Tıklama kaydı hatası:', error);
    }
  };

  return {
    advertisements,
    currentAd,
    loading,
    recordImpression,
    recordClick,
    refreshAds: loadAdvertisements
  };
}

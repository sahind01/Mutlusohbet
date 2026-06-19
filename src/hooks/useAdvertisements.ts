// src/hooks/useAdvertisements.ts
import { useState, useEffect } from 'react';
import { db, ref, get, update } from '@/lib/firebase';

interface AdData {
  id: string;
  name: string;
  type: string;
  position: string;
  imageUrl: string;
  targetUrl: string;
  isActive: boolean;
  impressions: number;
  clicks: number;
  startDate: string;
  endDate: string;
}

export function useAdvertisements(position?: string) {
  const [advertisements, setAdvertisements] = useState<AdData[]>([]);
  const [currentAd, setCurrentAd] = useState<AdData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdvertisements();
  }, [position]);

  const loadAdvertisements = async () => {
    try {
      const now = new Date();
      const adsSnap = await get(ref(db, 'advertisements'));
      
      if (adsSnap.exists()) {
        const data = adsSnap.val();
        let adsList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));

        // Aktif ve tarih aralığında olanları filtrele
        adsList = adsList.filter(ad => {
          const isActive = ad.isActive === true;
          const startOk = new Date(ad.startDate) <= now;
          const endOk = new Date(ad.endDate) >= now;
          return isActive && startOk && endOk;
        });

        // Pozisyona göre filtrele
        if (position) {
          adsList = adsList.filter(ad => ad.position === position);
        }

        setAdvertisements(adsList);
        
        // Rastgele bir reklam seç
        if (adsList.length > 0) {
          const randomAd = adsList[Math.floor(Math.random() * adsList.length)];
          setCurrentAd(randomAd);
        } else {
          setCurrentAd(null);
        }
      } else {
        setAdvertisements([]);
        setCurrentAd(null);
      }
    } catch (error) {
      console.error('Reklam yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const recordImpression = async (adId: string) => {
    try {
      const adRef = ref(db, `advertisements/${adId}/impressions`);
      const snap = await get(adRef);
      const current = snap.exists() ? snap.val() : 0;
      await update(ref(db, `advertisements/${adId}`), {
        impressions: (current || 0) + 1
      });
    } catch (error) {
      console.error('Gösterim kaydı hatası:', error);
    }
  };

  const recordClick = async (adId: string) => {
    try {
      const adRef = ref(db, `advertisements/${adId}/clicks`);
      const snap = await get(adRef);
      const current = snap.exists() ? snap.val() : 0;
      await update(ref(db, `advertisements/${adId}`), {
        clicks: (current || 0) + 1
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

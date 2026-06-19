// src/app/chat/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useAdvertisements } from '@/hooks/useAdvertisements';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';

export default function ChatPage() {
  const { user, updateUserStatus } = useAuth();
  const router = useRouter();
  const [showPreAd, setShowPreAd] = useState(false);
  const [adWatched, setAdWatched] = useState(false);
  
  const {
    localStream,
    remoteStream,
    isConnected,
    isSearching,
    localVideoRef,
    remoteVideoRef,
    startSearch,
    endCall,
    nextUser
  } = useWebRTC(user?.id || '');

  const { currentAd: fixedBannerAd, recordImpression } = useAdvertisements('fixed');
  const { currentAd: popupAd, recordImpression: recordPopupImpression } = useAdvertisements('popup');

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
  }, [user]);

  const handleStartChat = async () => {
    if (!user) return;

    // Ücretsiz kullanıcılar için günlük limit kontrolü
    if (user.role === 'free') {
      if (user.dailyMatches >= 3) {
        setShowPreAd(true);
        return;
      }
    }

    await startSearch();
    await updateUserStatus('in-call');
    
    // Eşleşme sayısını güncelle
    if (user) {
      await updateDoc(doc(db, 'users', user.id), {
        dailyMatches: increment(1),
        totalMatches: increment(1)
      });
    }
  };

  const handleWatchAd = async () => {
    // Reklam izleme simülasyonu
    setShowPreAd(false);
    setAdWatched(true);
    
    // Reklam izlendikten sonra eşleşme hakkı ver
    setTimeout(async () => {
      await startSearch();
      if (user) {
        await updateDoc(doc(db, 'users', user.id), {
          dailyMatches: increment(1),
          totalMatches: increment(1)
        });
      }
      setAdWatched(false);
    }, 2000);
  };

  const handleEndCall = async () => {
    endCall();
    await updateUserStatus('online');
  };

  const handleNextUser = async () => {
    await nextUser();
    
    // Ücretsiz kullanıcılar için reklam göster
    if (user?.role === 'free' && popupAd) {
      recordPopupImpression(popupAd.id);
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 saniye reklam
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-black relative">
      {/* Video Alanları */}
      <div className="relative h-screen">
        {/* Karşı Taraf Videosu */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Kendi Videomuz */}
        <div className="absolute bottom-4 right-4 w-48 h-64 md:w-64 md:h-80 rounded-lg overflow-hidden border-2 border-gray-700">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>

        {/* Kontrol Butonları */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-4">
          {!isConnected ? (
            <button
              onClick={handleStartChat}
              disabled={isSearching}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50"
            >
              {isSearching ? 'Eşleşme Aranıyor...' : 'Sohbete Başla'}
            </button>
          ) : (
            <>
              <button
                onClick={handleEndCall}
                className="bg-red-600 text-white p-4 rounded-full hover:bg-red-700 transition-colors"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <button
                onClick={handleNextUser}
                className="bg-blue-600 text-white p-4 rounded-full hover:bg-blue-700 transition-colors"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Kullanıcı Bilgisi */}
        <div className="absolute top-4 left-4 bg-gray-900 bg-opacity-75 rounded-lg px-4 py-2">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
              <span className="text-white font-bold">{user.username[0].toUpperCase()}</span>
            </div>
            <div>
              <p className="text-white font-semibold">{user.username}</p>
              <p className="text-sm text-gray-300">
                {user.role === 'premium' ? '🌟 Premium' : `⚡ ${3 - user.dailyMatches} hak kaldı`}
              </p>
            </div>
          </div>
        </div>

        {/* Alt Banner Reklam */}
        {user.role === 'free' && fixedBannerAd && (
          <div className="absolute bottom-24 left-0 right-0 px-4">
            <div className="bg-gray-800 rounded-lg p-2">
              {fixedBannerAd.imageUrl && (
                <img
                  src={fixedBannerAd.imageUrl}
                  alt={fixedBannerAd.name}
                  className="w-full h-16 object-cover rounded"
                  onClick={() => recordImpression(fixedBannerAd.id)}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reklam İzleme Modalı */}
      {showPreAd && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Günlük Limitiniz Doldu</h2>
            <p className="text-gray-300 mb-8">
              Reklam izleyerek ek eşleşme hakkı kazanın!
            </p>
            <button
              onClick={handleWatchAd}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all"
            >
              Reklam İzle (15 saniye)
            </button>
            <button
              onClick={() => setShowPreAd(false)}
              className="block mt-4 text-gray-400 hover:text-white mx-auto"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {/* Popup Reklam */}
      {adWatched && popupAd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-4 max-w-md">
            {popupAd.imageUrl && (
              <img
                src={popupAd.imageUrl}
                alt={popupAd.name}
                className="w-full rounded"
              />
            )}
            <p className="text-center mt-2 text-gray-600">Reklam 5 saniye sonra kapanacak...</p>
          </div>
        </div>
      )}
    </div>
  );
}

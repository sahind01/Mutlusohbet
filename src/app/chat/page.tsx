// src/app/chat/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  getDoc,
  addDoc,
  limit
} from 'firebase/firestore';
import UserMenu from '@/components/UserMenu';

// STUN sunucuları - ücretsiz
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
};

export default function ChatPage() {
  const { user, updateUserStatus } = useAuth();
  const router = useRouter();
  
  const [appState, setAppState] = useState<'idle' | 'searching' | 'connecting' | 'connected'>('idle');
  const [partner, setPartner] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callTime, setCallTime] = useState(0);
  const [error, setError] = useState('');
  const [poolSize, setPoolSize] = useState(0);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const partnerIdRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribersRef = useRef<(() => void)[]>([]);

  // Temizlik fonksiyonu
  const cleanup = useCallback(async () => {
    // Timer'ı durdur
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Peer connection'ı kapat
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    // Medya akışını durdur
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    }
    
    // Remote video'yu temizle
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    // Tüm dinleyicileri kaldır
    unsubscribersRef.current.forEach(unsub => unsub());
    unsubscribersRef.current = [];
    
    // Havuzdan çık
    if (user) {
      try {
        await deleteDoc(doc(db, 'matchPool', user.id));
      } catch (e) {}
    }
    
    // Odayı kapat
    if (roomIdRef.current) {
      try {
        await updateDoc(doc(db, 'rooms', roomIdRef.current), {
          status: 'ended',
          endedAt: serverTimestamp()
        });
      } catch (e) {}
      roomIdRef.current = null;
    }
    
    partnerIdRef.current = null;
    
    if (user) {
      await updateUserStatus('online');
    }
  }, [user, updateUserStatus]);

  // Kamera ve mikrofonu başlat
  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 480 },
          height: { ideal: 640 },
          facingMode: 'user'
        },
        audio: true
      });
      
      streamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error('Kamera hatası:', err);
      setError('Kamera ve mikrofona erişilemedi!');
      throw err;
    }
  };

  // Eşleşme havuzuna katıl
  const startSearching = async () => {
    if (!user) return;
    
    setAppState('searching');
    setError('');
    setPoolSize(0);
    
    try {
      // Önce kamerayı başlat
      await initCamera();
      
      // Havuza ekle
      await setDoc(doc(db, 'matchPool', user.id), {
        userId: user.id,
        username: user.username,
        photo: user.profilePhoto,
        gender: user.gender,
        joinedAt: serverTimestamp(),
        status: 'waiting'
      });
      
      // Havuz değişikliklerini dinle
      const unsub1 = onSnapshot(
        collection(db, 'matchPool'),
        (snapshot) => {
          const waiting = snapshot.docs.filter(d => 
            d.data().status === 'waiting' && d.id !== user.id
          );
          setPoolSize(waiting.length);
          
          // Bekleyen biri varsa eşleştir
          if (waiting.length > 0 && appState === 'searching') {
            const match = waiting[0];
            createMatch(match.id, match.data());
          }
        }
      );
      unsubscribersRef.current.push(unsub1);
      
      // Kendi durumumuzu dinle (başkası bizi bulursa)
      const unsub2 = onSnapshot(
        doc(db, 'matchPool', user.id),
        (doc) => {
          if (doc.exists() && doc.data().status === 'matched') {
            const data = doc.data();
            if (data.partnerId && data.roomId && !roomIdRef.current) {
              roomIdRef.current = data.roomId;
              partnerIdRef.current = data.partnerId;
              startWebRTC(data.roomId, data.partnerId, true);
            }
          }
        }
      );
      unsubscribersRef.current.push(unsub2);
      
    } catch (err) {
      console.error('Arama başlatma hatası:', err);
      setAppState('idle');
      setError('Eşleşme başlatılamadı');
    }
  };

  // Eşleşme oluştur
  const createMatch = async (partnerId: string, partnerData: any) => {
    if (!user || roomIdRef.current) return;
    
    setAppState('connecting');
    
    try {
      // Oda oluştur
      const roomRef = await addDoc(collection(db, 'rooms'), {
        user1: user.id,
        user2: partnerId,
        createdAt: serverTimestamp(),
        status: 'active'
      });
      
      roomIdRef.current = roomRef.id;
      partnerIdRef.current = partnerId;
      
      // İki tarafı da eşleştir
      await updateDoc(doc(db, 'matchPool', user.id), {
        status: 'matched',
        partnerId: partnerId,
        roomId: roomRef.id
      });
      
      await updateDoc(doc(db, 'matchPool', partnerId), {
        status: 'matched',
        partnerId: user.id,
        roomId: roomRef.id
      });
      
      setPartner({
        username: partnerData.username,
        photo: partnerData.photo
      });
      
      // WebRTC bağlantısını başlat
      await startWebRTC(roomRef.id, partnerId, false);
      
    } catch (err) {
      console.error('Eşleşme oluşturma hatası:', err);
      cleanup();
      setAppState('idle');
    }
  };

  // WebRTC bağlantısı
  const startWebRTC = async (roomId: string, partnerId: string, isReceiver: boolean) => {
    try {
      const pc = new RTCPeerConnection(iceServers);
      pcRef.current = pc;
      
      // Lokal stream'i ekle
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, streamRef.current!);
        });
      }
      
      // ICE adaylarını gönder
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidateRef = doc(collection(db, 'rooms', roomId, 'signals'));
          setDoc(candidateRef, {
            type: 'candidate',
            candidate: event.candidate.toJSON(),
            from: user!.id,
            timestamp: serverTimestamp()
          });
        }
      };
      
      // Uzak stream geldi
      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setAppState('connected');
          startTimer();
        }
      };
      
      // Bağlantı koptu
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || 
            pc.iceConnectionState === 'failed') {
          handleEndCall();
        }
      };
      
      // Sinyalleşme dinleyicisi
      const unsub = onSnapshot(
        collection(db, 'rooms', roomId, 'signals'),
        async (snapshot) => {
          for (const change of snapshot.docChanges()) {
            if (change.type !== 'added') continue;
            const signal = change.doc.data();
            
            if (signal.from === partnerId) {
              try {
                if (signal.type === 'offer') {
                  await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                  const answer = await pc.createAnswer();
                  await pc.setLocalDescription(answer);
                  await setDoc(doc(collection(db, 'rooms', roomId, 'signals')), {
                    type: 'answer',
                    sdp: answer.toJSON(),
                    from: user!.id,
                    timestamp: serverTimestamp()
                  });
                } else if (signal.type === 'answer') {
                  await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                } else if (signal.type === 'candidate') {
                  await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                }
              } catch (err) {
                console.error('Sinyal işleme hatası:', err);
              }
            }
          }
        }
      );
      unsubscribersRef.current.push(unsub);
      
      // Offer gönder (eğer başlatan bizsek)
      if (!isReceiver) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await setDoc(doc(collection(db, 'rooms', roomId, 'signals')), {
          type: 'offer',
          sdp: offer.toJSON(),
          from: user!.id,
          timestamp: serverTimestamp()
        });
      }
      
    } catch (err) {
      console.error('WebRTC hatası:', err);
      handleEndCall();
    }
  };

  // Süre sayacı
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCallTime(prev => prev + 1);
    }, 1000);
  };

  // Görüşmeyi sonlandır
  const handleEndCall = async () => {
    await cleanup();
    setAppState('idle');
    setPartner(null);
    setCallTime(0);
  };

  // Sonraki kullanıcı
  const handleNext = async () => {
    await handleEndCall();
    setTimeout(() => startSearching(), 500);
  };

  // Aramayı iptal et
  const handleCancel = async () => {
    await cleanup();
    setAppState('idle');
  };

  // Mikrofon toggle
  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      setIsMuted(!isMuted);
    }
  };

  // Kamera toggle
  const toggleVideo = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

  // Sayfadan çıkınca temizlik
  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    return () => { cleanup(); };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  if (!user) return null;

  return (
    <div className="h-screen bg-black overflow-hidden">
      
      {/* === ÜST BAR === */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/90 to-transparent px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Partner bilgisi */}
          {appState === 'connected' && partner ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                {partner.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{partner.username}</p>
                <p className="text-green-400 text-xs flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  {formatTime(callTime)}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-white font-semibold">
              {appState === 'searching' ? '🔍 Eşleşme aranıyor...' : 
               appState === 'connecting' ? '🔗 Bağlanıyor...' : 
               'Mutlu Sohbet'}
            </div>
          )}
          
          <UserMenu />
        </div>
      </div>

      {/* === ANA EKRAN === */}
      <div className="relative w-full h-full">
        
        {/* Uzak video (tam ekran arka plan) */}
        {appState === 'connected' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          /* Boş durum - gradient arka plan */
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
            
            {/* Bekleme ekranı */}
            {appState === 'idle' && (
              <div className="text-center px-6">
                <div className="text-7xl mb-6">🎥</div>
                <h2 className="text-2xl font-bold text-white mb-3">Görüntülü Sohbete Hazır mısın?</h2>
                <p className="text-gray-400 mb-8 max-w-sm mx-auto">
                  Dünyanın her yerinden insanlarla anında bağlantı kur
                </p>
              </div>
            )}

            {/* Arama ekranı */}
            {appState === 'searching' && (
              <div className="text-center px-6">
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full border-4 border-purple-500/30 animate-ping"></div>
                  <div className="absolute inset-2 rounded-full border-4 border-purple-500 animate-spin border-t-transparent"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-4xl">🔍</div>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Eşleşme Aranıyor</h2>
                <p className="text-gray-400">
                  {poolSize > 0 
                    ? `🟢 ${poolSize} kişi havuzda bekliyor` 
                    : 'Havuzda bekleyen yok, biraz bekleyin...'}
                </p>
              </div>
            )}

            {/* Bağlanma ekranı */}
            {appState === 'connecting' && (
              <div className="text-center px-6">
                <div className="text-6xl mb-6 animate-bounce">🔗</div>
                <h2 className="text-xl font-bold text-white mb-2">Bağlantı Kuruluyor</h2>
                <p className="text-gray-400">Eşleşme bulundu, bağlanıyor...</p>
              </div>
            )}
          </div>
        )}

        {/* Kendi videomuz - PIP */}
        {(appState === 'searching' || appState === 'connecting' || appState === 'connected') && (
          <div className={`
            absolute z-20 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl
            transition-all duration-300
            ${appState === 'connected' 
              ? 'bottom-28 right-4 w-32 h-44 md:w-40 md:h-56' 
              : 'bottom-28 right-4 w-40 h-56 md:w-52 md:h-72'}
          `}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            {/* Kamera kapalı overlay */}
            {isVideoOff && (
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                <span className="text-4xl">📷❌</span>
              </div>
            )}
          </div>
        )}

        {/* Hata mesajı */}
        {error && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
            <span>⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-2 font-bold">✕</button>
          </div>
        )}

        {/* === ALT KONTROL BUTONLARI === */}
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/90 to-transparent pb-8 pt-16 px-4">
          <div className="flex items-center justify-center gap-4 md:gap-6">
            
            {/* IDLE - Başlat butonu */}
            {appState === 'idle' && (
              <button
                onClick={startSearching}
                className="group relative bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-10 py-4 rounded-full text-lg font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-purple-500/30"
              >
                <span className="flex items-center gap-2">
                  <span className="text-2xl">🎥</span>
                  Sohbete Başla
                </span>
              </button>
            )}

            {/* SEARCHING - İptal butonu */}
            {appState === 'searching' && (
              <button
                onClick={handleCancel}
                className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full text-base font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-500/30 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
                İptal Et
              </button>
            )}

            {/* CONNECTED - Görüşme kontrolleri */}
            {appState === 'connected' && (
              <>
                {/* Ses */}
                <button
                  onClick={toggleMute}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
                    isMuted ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {isMuted ? (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <line x1="1" y1="1" x2="23" y2="23" strokeWidth={2.5} />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>

                {/* Kapat */}
                <button
                  onClick={handleEndCall}
                  className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg shadow-red-500/30"
                >
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                </button>

                {/* Sonraki */}
                <button
                  onClick={handleNext}
                  className="w-14 h-14 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>

                {/* Kamera */}
                <button
                  onClick={toggleVideo}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
                    isVideoOff ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {isVideoOff ? (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      <line x1="1" y1="1" x2="23" y2="23" strokeWidth={2.5} />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </>
            )}

            {/* CONNECTING - Bağlanıyor (sadece iptal) */}
            {appState === 'connecting' && (
              <button
                onClick={handleCancel}
                className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full text-base font-bold transition-all hover:scale-105 active:scale-95"
              >
                İptal Et
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

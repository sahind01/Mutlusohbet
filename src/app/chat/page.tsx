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
  query,
  where,
  getDocs,
  increment,
  addDoc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import UserMenu from '@/components/UserMenu';

// WebRTC yapılandırması
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export default function ChatPage() {
  const { user, updateUserStatus } = useAuth();
  const router = useRouter();
  
  // State'ler
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const [error, setError] = useState('');
  const [showPreAd, setShowPreAd] = useState(false);
  const [adWatched, setAdWatched] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [matchPoolCount, setMatchPoolCount] = useState(0);
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const matchDocRef = useRef<string | null>(null);
  const roomDocRef = useRef<string | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Medya akışını başlat
  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: true
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error('Kamera/Mikrofon erişimi hatası:', err);
      setError('Kamera ve mikrofona erişilemedi. Lütfen izinleri kontrol edin.');
      throw err;
    }
  }, []);

  // Medya akışını durdur
  const stopLocalStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  };

  // WebRTC bağlantısını oluştur
  const createPeerConnection = useCallback((roomId: string) => {
    const pc = new RTCPeerConnection(rtcConfig);
    
    // ICE adayları
    pc.onicecandidate = async (event) => {
      if (event.candidate && roomDocRef.current) {
        const roomRef = doc(db, 'rooms', roomDocRef.current);
        await updateDoc(roomRef, {
          [`candidates.${user?.id}`]: event.candidate.toJSON()
        });
      }
    };

    // Uzak akış geldiğinde
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setIsConnected(true);
        startCallTimer();
      }
    };

    // Bağlantı durumu
    pc.onconnectionstatechange = () => {
      console.log('Bağlantı durumu:', pc.connectionState);
      if (pc.connectionState === 'disconnected' || 
          pc.connectionState === 'failed' || 
          pc.connectionState === 'closed') {
        handleEndCall();
      }
    };

    // ICE bağlantı durumu
    pc.oniceconnectionstatechange = () => {
      console.log('ICE durumu:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || 
          pc.iceConnectionState === 'failed') {
        handleEndCall();
      }
    };

    // Lokal akışı ekle
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        if (localStreamRef.current) {
          pc.addTrack(track, localStreamRef.current);
        }
      });
    }

    peerConnectionRef.current = pc;
    return pc;
  }, [user?.id]);

  // Eşleşme havuzuna katıl
  const joinMatchPool = async () => {
    if (!user) return;
    
    setIsSearching(true);
    setError('');
    
    try {
      await startLocalStream();
      
      // Eşleşme havuzuna ekle
      const matchRef = doc(db, 'matchPool', user.id);
      await setDoc(matchRef, {
        userId: user.id,
        username: user.username,
        profilePhoto: user.profilePhoto,
        gender: user.gender,
        role: user.role,
        timestamp: serverTimestamp(),
        status: 'waiting',
        isActive: true
      });
      
      matchDocRef.current = user.id;
      
      // Eşleşme havuzunu dinle
      const unsubscribe = onSnapshot(doc(db, 'matchPool', user.id), async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          
          if (data.status === 'matched' && data.partnerId) {
            // Eşleşme bulundu!
            setIsSearching(false);
            await startCall(data.partnerId, data.roomId);
          }
        }
      });
      
      unsubscribeRef.current = unsubscribe;
      
      // Diğer bekleyenleri kontrol et
      checkForPartners();
      
    } catch (err) {
      console.error('Eşleşme havuzuna katılma hatası:', err);
      setIsSearching(false);
      setError('Eşleşme başlatılamadı. Lütfen tekrar deneyin.');
    }
  };

  // Diğer bekleyen kullanıcıları kontrol et
  const checkForPartners = async () => {
    if (!user) return;
    
    try {
      const poolRef = collection(db, 'matchPool');
      const q = query(
        poolRef, 
        where('status', '==', 'waiting'),
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(q);
      const waitingUsers = snapshot.docs.filter(d => d.id !== user.id);
      
      setMatchPoolCount(waitingUsers.length);
      
      // Bekleyen kullanıcı varsa eşleştir
      if (waitingUsers.length > 0) {
        const partner = waitingUsers[0];
        const partnerData = partner.data();
        
        // Oda oluştur
        const roomRef = await addDoc(collection(db, 'rooms'), {
          participant1: user.id,
          participant2: partnerData.userId,
          startTime: serverTimestamp(),
          status: 'active',
          candidates: {}
        });
        
        roomDocRef.current = roomRef.id;
        
        // İki kullanıcıyı da eşleştir
        await updateDoc(doc(db, 'matchPool', user.id), {
          status: 'matched',
          partnerId: partnerData.userId,
          roomId: roomRef.id
        });
        
        await updateDoc(doc(db, 'matchPool', partnerData.userId), {
          status: 'matched',
          partnerId: user.id,
          roomId: roomRef.id
        });
        
        setPartnerInfo({
          username: partnerData.username,
          photo: partnerData.profilePhoto,
          gender: partnerData.gender
        });
      }
    } catch (err) {
      console.error('Eşleşme kontrolü hatası:', err);
    }
  };

  // Görüşmeyi başlat
  const startCall = async (partnerId: string, roomId: string) => {
    roomDocRef.current = roomId;
    
    try {
      // Partner bilgilerini al
      const partnerDoc = await getDoc(doc(db, 'users', partnerId));
      if (partnerDoc.exists()) {
        setPartnerInfo({
          username: partnerDoc.data().username,
          photo: partnerDoc.data().profilePhoto,
          gender: partnerDoc.data().gender
        });
      }
      
      const pc = createPeerConnection(roomId);
      
      // Offer oluştur
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Offer'ı kaydet
      await updateDoc(doc(db, 'rooms', roomId), {
        [`offers.${user?.id}`]: {
          type: offer.type,
          sdp: offer.sdp
        }
      });
      
      // Partner'ın offer/answer'ını dinle
      const unsubscribe = onSnapshot(doc(db, 'rooms', roomId), async (snapshot) => {
        const roomData = snapshot.data();
        if (!roomData || !peerConnectionRef.current) return;
        
        const pc = peerConnectionRef.current;
        
        try {
          // Eğer biz offer gönderdiysek, partner'ın answer'ını bekle
          if (roomData.answers && roomData.answers[partnerId] && !pc.currentRemoteDescription) {
            const answer = new RTCSessionDescription(roomData.answers[partnerId]);
            await pc.setRemoteDescription(answer);
          }
          
          // Eğer partner offer gönderdiyse, answer oluştur
          if (roomData.offers && roomData.offers[partnerId] && !pc.currentRemoteDescription) {
            const offer = new RTCSessionDescription(roomData.offers[partnerId]);
            await pc.setRemoteDescription(offer);
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            await updateDoc(doc(db, 'rooms', roomId), {
              [`answers.${user?.id}`]: {
                type: answer.type,
                sdp: answer.sdp
              }
            });
          }
          
          // ICE adaylarını ekle
          if (roomData.candidates && roomData.candidates[partnerId]) {
            const candidate = new RTCIceCandidate(roomData.candidates[partnerId]);
            await pc.addIceCandidate(candidate);
          }
        } catch (err) {
          console.error('Sinyalleşme hatası:', err);
        }
      });
      
    } catch (err) {
      console.error('Görüşme başlatma hatası:', err);
      handleEndCall();
    }
  };

  // Görüşme süresini başlat
  const startCallTimer = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // Görüşmeyi sonlandır
  const handleEndCall = async () => {
    // Zamanlayıcıyı durdur
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    
    // WebRTC bağlantısını kapat
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Medya akışını durdur
    stopLocalStream();
    
    // Eşleşme havuzundan çıkar
    if (matchDocRef.current) {
      try {
        await deleteDoc(doc(db, 'matchPool', matchDocRef.current));
      } catch (err) {
        console.error('Eşleşme havuzundan çıkma hatası:', err);
      }
      matchDocRef.current = null;
    }
    
    // Odayı güncelle
    if (roomDocRef.current) {
      try {
        await updateDoc(doc(db, 'rooms', roomDocRef.current), {
          status: 'ended',
          endTime: serverTimestamp()
        });
      } catch (err) {
        console.error('Oda güncelleme hatası:', err);
      }
      roomDocRef.current = null;
    }
    
    // Dinleyicileri kaldır
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    // State'leri sıfırla
    setIsConnected(false);
    setIsSearching(false);
    setPartnerInfo(null);
    setCallDuration(0);
    setError('');
    
    // Remote video'yu temizle
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    // Kullanıcı durumunu güncelle
    if (user) {
      await updateUserStatus('online');
    }
  };

  // Sonraki kullanıcı
  const handleNextUser = async () => {
    await handleEndCall();
    // Kısa bir bekleme sonrası yeni eşleşme
    setTimeout(() => {
      joinMatchPool();
    }, 1000);
  };

  // Eşleşmeyi iptal et
  const handleCancelSearch = async () => {
    setIsSearching(false);
    stopLocalStream();
    
    if (matchDocRef.current) {
      try {
        await deleteDoc(doc(db, 'matchPool', matchDocRef.current));
      } catch (err) {
        console.error('Eşleşme iptal hatası:', err);
      }
      matchDocRef.current = null;
    }
    
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  };

  // Mikrofon aç/kapat
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Kamera aç/kapat
  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  // Süreyi formatla
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    
    return () => {
      handleEndCall();
    };
  }, [user]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-black relative">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isConnected && partnerInfo && (
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold">
                    {partnerInfo.username?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-semibold">{partnerInfo.username}</p>
                  <p className="text-green-400 text-sm">● Bağlı - {formatDuration(callDuration)}</p>
                </div>
              </div>
            )}
          </div>
          
          <UserMenu />
        </div>
      </header>

      {/* Ana Video Alanı */}
      <div className="relative w-full h-screen">
        {/* Karşı Taraf Videosu */}
        {isConnected ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
            {isSearching ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-white text-xl mb-2">Eşleşme Aranıyor...</p>
                <p className="text-gray-400">Havuzda {matchPoolCount} kişi bekliyor</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-400 text-xl mb-4">Görüşme başlatılmadı</p>
              </div>
            )}
          </div>
        )}

        {/* Kendi Videomuz (PIP) */}
        {(isSearching || isConnected) && (
          <div className={`absolute ${isConnected ? 'bottom-24 right-4 w-36 h-48 md:w-48 md:h-64' : 'bottom-24 right-4 w-48 h-64 md:w-64 md:h-80'} rounded-xl overflow-hidden border-2 border-gray-600 shadow-2xl`}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
            />
          </div>
        )}

        {/* Alt Kontrol Butonları */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
          {!isSearching && !isConnected ? (
            // Başlangıç Butonu
            <button
              onClick={joinMatchPool}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-10 py-5 rounded-full text-lg font-bold hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 shadow-2xl animate-pulse"
            >
              🎥 Sohbete Başla
            </button>
          ) : isSearching ? (
            // Arama İptal Butonu
            <button
              onClick={handleCancelSearch}
              className="bg-red-600 text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-red-700 transition-all flex items-center space-x-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Eşleşmeyi İptal Et</span>
            </button>
          ) : (
            // Görüşme Kontrolleri
            <div className="flex items-center space-x-4">
              {/* Mikrofon */}
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition-all ${
                  isMuted ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {isMuted ? (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    <line x1="3" y1="3" x2="21" y2="21" strokeWidth={2} />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>

              {/* Görüşmeyi Sonlandır */}
              <button
                onClick={handleEndCall}
                className="bg-red-600 p-5 rounded-full hover:bg-red-700 transition-all transform hover:scale-110 shadow-lg"
              >
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
              </button>

              {/* Sonraki Kullanıcı */}
              <button
                onClick={handleNextUser}
                className="bg-blue-600 p-4 rounded-full hover:bg-blue-700 transition-all"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>

              {/* Kamera */}
              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full transition-all ${
                  isVideoOff ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {isVideoOff ? (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    <line x1="3" y1="3" x2="21" y2="21" strokeWidth={2} />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Hata Mesajı */}
        {error && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg z-40">
            <p>{error}</p>
            <button onClick={() => setError('')} className="ml-2 underline">Kapat</button>
          </div>
        )}
      </div>

      <style jsx>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}

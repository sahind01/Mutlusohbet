// src/app/chat/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { 
  doc, setDoc, deleteDoc, onSnapshot, 
  collection, addDoc, updateDoc, serverTimestamp, 
  getDoc, getDocs, query, where, limit 
} from 'firebase/firestore';
import UserMenu from '@/components/UserMenu';

const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export default function ChatPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [status, setStatus] = useState<'idle'|'searching'|'matched'|'connected'>('idle');
  const [partnerName, setPartnerName] = useState('');
  const [callTime, setCallTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);
  
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const roomRef = useRef<string>('');
  const partnerRef = useRef<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // TEMİZLİK
  const cleanup = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (streamRef.current) { 
      streamRef.current.getTracks().forEach(t => t.stop()); 
      streamRef.current = null; 
    }
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    
    if (user && roomRef.current) {
      try { 
        await deleteDoc(doc(db, 'waiting', user.id));
        await updateDoc(doc(db, 'rooms', roomRef.current), { status: 'ended' });
      } catch(e) {}
    }
    roomRef.current = '';
    partnerRef.current = '';
  };

  // KAMERA BAŞLAT
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: 'user' }, 
        audio: true 
      });
      streamRef.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      return stream;
    } catch(e) {
      alert('Kamera ve mikrofona izin verin!');
      throw e;
    }
  };

  // EŞLEŞME BAŞLAT
  const startMatch = async () => {
    if (!user) return;
    await cleanup();
    setStatus('searching');
    
    try {
      await startCamera();
      
      // Bekleme havuzuna ekle
      await setDoc(doc(db, 'waiting', user.id), {
        userId: user.id,
        name: user.username,
        photo: user.profilePhoto,
        gender: user.gender,
        time: Date.now()
      });

      // Bekleyenleri kontrol et
      checkWaiting();
      
    } catch(e) {
      setStatus('idle');
    }
  };

  // BEKLEYENLERİ KONTROL ET
  const checkWaiting = async () => {
    if (!user) return;
    
    try {
      const snap = await getDocs(collection(db, 'waiting'));
      const waiting = snap.docs.filter(d => d.id !== user.id);
      setWaitingCount(waiting.length);
      
      if (waiting.length > 0) {
        // Eşleşme bulundu!
        const partner = waiting[0];
        const partnerData = partner.data();
        
        setStatus('matched');
        setPartnerName(partnerData.name);
        partnerRef.current = partnerData.userId;
        
        // Oda oluştur
        const room = await addDoc(collection(db, 'rooms'), {
          users: [user.id, partnerData.userId],
          created: serverTimestamp(),
          status: 'active'
        });
        roomRef.current = room.id;
        
        // İki tarafı da beklemeden çıkar
        await deleteDoc(doc(db, 'waiting', user.id));
        await deleteDoc(doc(db, 'waiting', partner.id));
        
        // WebRTC başlat
        startCall(room.id, partnerData.userId);
      }
    } catch(e) {
      console.error(e);
    }
  };

  // WEBRTC GÖRÜŞME
  const startCall = async (roomId: string, partnerId: string) => {
    const pc = new RTCPeerConnection(servers);
    pcRef.current = pc;
    
    // Lokal stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => pc.addTrack(t, streamRef.current!));
    }
    
    // Uzak stream
    pc.ontrack = (e) => {
      if (remoteVideo.current && e.streams[0]) {
        remoteVideo.current.srcObject = e.streams[0];
        setStatus('connected');
        // Süre başlat
        let sec = 0;
        timerRef.current = setInterval(() => {
          sec++;
          setCallTime(sec);
        }, 1000);
      }
    };
    
    // ICE adayları
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        addDoc(collection(db, 'rooms', roomId, 'signals'), {
          type: 'ice',
          data: e.candidate.toJSON(),
          from: user!.id
        });
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        endCall();
      }
    };
    
    // Sinyalleri dinle
    onSnapshot(collection(db, 'rooms', roomId, 'signals'), async (snap) => {
      for (const change of snap.docChanges()) {
        if (change.type !== 'added') continue;
        const signal = change.doc.data();
        if (signal.from === partnerId) {
          try {
            if (signal.type === 'offer') {
              await pc.setRemoteDescription(signal.data);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await addDoc(collection(db, 'rooms', roomId, 'signals'), {
                type: 'answer',
                data: answer.toJSON(),
                from: user!.id
              });
            } else if (signal.type === 'answer') {
              await pc.setRemoteDescription(signal.data);
            } else if (signal.type === 'ice') {
              await pc.addIceCandidate(new RTCIceCandidate(signal.data));
            }
          } catch(e) { console.error(e); }
        }
      }
    });
    
    // Offer gönder
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await addDoc(collection(db, 'rooms', roomId, 'signals'), {
      type: 'offer',
      data: offer.toJSON(),
      from: user!.id
    });
  };

  // GÖRÜŞMEYİ BİTİR
  const endCall = async () => {
    await cleanup();
    setStatus('idle');
    setPartnerName('');
    setCallTime(0);
  };

  // SONRAKİ
  const nextCall = async () => {
    await endCall();
    setTimeout(() => startMatch(), 300);
  };

  // İPTAL
  const cancelSearch = async () => {
    if (user) await deleteDoc(doc(db, 'waiting', user.id));
    await cleanup();
    setStatus('idle');
  };

  // MİKROFON
  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      setIsMuted(!isMuted);
    }
  };

  // KAMERA
  const toggleVideo = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return; }
    return () => { cleanup(); };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s/60), sec = s%60;
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  if (!user) return null;

  return (
    <div className="h-[100dvh] bg-black overflow-hidden font-sans">
      
      {/* === HEADER === */}
      <header className="absolute top-0 left-0 right-0 z-30 px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/80">
        <div className="flex items-center gap-3">
          {status === 'connected' && (
            <>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                {partnerName?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-white text-sm font-semibold">{partnerName}</p>
                <p className="text-green-400 text-xs">● {formatTime(callTime)}</p>
              </div>
            </>
          )}
          {status === 'searching' && (
            <p className="text-white text-sm font-semibold">Eşleşme aranıyor...</p>
          )}
          {status === 'matched' && (
            <p className="text-yellow-400 text-sm font-semibold">Eşleşme bulundu! Bağlanıyor...</p>
          )}
        </div>
        <UserMenu />
      </header>

      {/* === ANA EKRAN === */}
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
        
        {/* UZAK VİDEO */}
        {status === 'connected' ? (
          <video ref={remoteVideo} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="text-center px-8">
            {status === 'idle' && (
              <>
                <div className="text-8xl mb-6">🎥</div>
                <h2 className="text-white text-2xl font-bold mb-2">Mutlu Sohbet</h2>
                <p className="text-gray-400">Yeni insanlarla tanışmaya hazır mısın?</p>
              </>
            )}
            {status === 'searching' && (
              <>
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 animate-ping"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                  <div className="absolute inset-4 rounded-full bg-purple-500/20 flex items-center justify-center text-3xl">
                    🔍
                  </div>
                </div>
                <p className="text-white text-lg font-semibold">Eşleşme Aranıyor</p>
                <p className="text-gray-400 text-sm mt-1">
                  {waitingCount > 0 ? `${waitingCount} kişi bekliyor` : 'İlk eşleşen sen ol'}
                </p>
              </>
            )}
            {status === 'matched' && (
              <>
                <div className="text-6xl mb-4 animate-bounce">🔗</div>
                <p className="text-white text-lg font-semibold">{partnerName} ile eşleştin!</p>
                <p className="text-gray-400 text-sm">Bağlantı kuruluyor...</p>
              </>
            )}
          </div>
        )}

        {/* KENDİ VİDEON */}
        {(status === 'searching' || status === 'matched' || status === 'connected') && (
          <div className={`absolute z-20 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl transition-all
            ${status === 'connected' ? 'bottom-24 right-3 w-28 h-40' : 'bottom-24 right-3 w-36 h-52'}`}>
            <video ref={localVideo} autoPlay playsInline muted 
              className="w-full h-full object-cover" style={{transform: 'scaleX(-1)'}} />
            {isVideoOff && <div className="absolute inset-0 bg-gray-800 flex items-center justify-center text-2xl">📷❌</div>}
          </div>
        )}
      </div>

      {/* === ALT BUTONLAR === */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black via-black/80 to-transparent pb-8 pt-20">
        <div className="flex items-center justify-center gap-3 md:gap-4 px-4">
          
          {/* BAŞLAT */}
          {status === 'idle' && (
            <button onClick={startMatch}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-full text-lg font-bold 
                hover:scale-105 active:scale-95 transition-all shadow-lg shadow-purple-500/30">
              🎥 Sohbete Başla
            </button>
          )}

          {/* ARAMA İPTAL */}
          {status === 'searching' && (
            <button onClick={cancelSearch}
              className="bg-red-500 text-white px-8 py-4 rounded-full text-base font-bold 
                hover:scale-105 active:scale-95 transition-all shadow-lg shadow-red-500/30">
              ✕ İptal
            </button>
          )}

          {/* BAĞLANIRKEN İPTAL */}
          {status === 'matched' && (
            <button onClick={cancelSearch}
              className="bg-red-500 text-white px-8 py-4 rounded-full text-base font-bold 
                hover:scale-105 active:scale-95 transition-all">
              İptal
            </button>
          )}

          {/* GÖRÜŞME KONTROLLERİ */}
          {status === 'connected' && (
            <div className="flex items-center gap-4">
              {/* Mikrofon */}
              <button onClick={toggleMute}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all
                  ${isMuted ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
                {isMuted ? '🔇' : '🎤'}
              </button>

              {/* Kapat */}
              <button onClick={endCall}
                className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center
                  transition-all hover:scale-110 active:scale-95 shadow-lg shadow-red-500/30">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
              </button>

              {/* Sonraki */}
              <button onClick={nextCall}
                className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all">
                ⏭️
              </button>

              {/* Kamera */}
              <button onClick={toggleVideo}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all
                  ${isVideoOff ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
                {isVideoOff ? '📷❌' : '📷'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

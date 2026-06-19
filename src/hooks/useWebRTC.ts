// src/hooks/useWebRTC.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';

const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:turn.mutlusohbet.com:3478',
      username: 'mutlusohbet',
      credential: 'turnpassword'
    }
  ]
};

export function useWebRTC(userId: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (error) {
      console.error('Medya erişimi hatası:', error);
      throw error;
    }
  };

  const createPeerConnection = useCallback((roomId: string) => {
    const pc = new RTCPeerConnection(servers);
    
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await updateDoc(doc(db, 'rooms', roomId, 'candidates', userId), {
          candidate: event.candidate.toJSON(),
          timestamp: new Date()
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setIsConnected(true);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setIsConnected(false);
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [userId]);

  const startSearch = async () => {
    setIsSearching(true);
    await initializeMedia();
    
    // Eşleşme havuzuna katıl
    await setDoc(doc(db, 'matchPool', userId), {
      userId,
      timestamp: new Date(),
      status: 'waiting',
      premium: false // Premium kontrolü yapılacak
    });

    // Eşleşme dinleyicisi
    const unsubscribe = onSnapshot(doc(db, 'matchPool', userId), async (snapshot) => {
      if (snapshot.exists() && snapshot.data().status === 'matched') {
        const { roomId, partnerId } = snapshot.data();
        await startCall(roomId, partnerId);
        setIsSearching(false);
        unsubscribe();
      }
    });
  };

  const startCall = async (roomId: string, partnerId: string) => {
    const pc = createPeerConnection(roomId);
    
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    await setDoc(doc(db, 'rooms', roomId, 'offers', userId), {
      offer: { type: offer.type, sdp: offer.sdp },
      timestamp: new Date()
    });

    // Partner'dan gelen cevabı dinle
    onSnapshot(doc(db, 'rooms', roomId, 'answers', userId), async (snapshot) => {
      if (snapshot.exists()) {
        const answer = new RTCSessionDescription(snapshot.data().answer);
        await pc.setRemoteDescription(answer);
      }
    });
  };

  const endCall = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    setRemoteStream(null);
    setIsConnected(false);
  };

  const nextUser = async () => {
    endCall();
    await startSearch();
  };

  return {
    localStream,
    remoteStream,
    isConnected,
    isSearching,
    localVideoRef,
    remoteVideoRef,
    startSearch,
    endCall,
    nextUser,
    initializeMedia
  };
}

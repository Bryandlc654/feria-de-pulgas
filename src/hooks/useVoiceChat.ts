import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents, RoomState } from '../types/game';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function useVoiceChat(
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null,
  room: RoomState | null,
  selfPlayerId: string | null
) {
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map()); // targetPlayerId -> RTCPeerConnection
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Monitor speaking levels from microphone
  const monitorSpeakingVolume = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let lastSpokeTime = 0;

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;

        // Threshold for speaking detection
        const speakingNow = avg > 18;
        if (speakingNow) {
          lastSpokeTime = Date.now();
        }

        const currentlySpeaking = Date.now() - lastSpokeTime < 400;
        setIsSpeaking(currentlySpeaking);

        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn('AudioContext volume analysis not supported', e);
    }
  }, []);

  // Broadcast speaking / muted status to other peers
  useEffect(() => {
    if (!socket || !isMicEnabled) return;
    socket.emit('voice:status', {
      isMuted,
      isSpeaking,
    });
  }, [socket, isMicEnabled, isMuted, isSpeaking]);

  // Create Peer Connection to a target player
  const createPeerConnection = useCallback(
    (targetPlayerId: string, initiator: boolean) => {
      if (peerConnectionsRef.current.has(targetPlayerId)) {
        return peerConnectionsRef.current.get(targetPlayerId)!;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionsRef.current.set(targetPlayerId, pc);

      // Add local audio tracks if we have mic enabled
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('voice:signal', {
            toPlayerId: targetPlayerId,
            signal: { candidate: event.candidate },
          });
        }
      };

      // Play remote audio track
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        let audio = audioElementsRef.current.get(targetPlayerId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audioElementsRef.current.set(targetPlayerId, audio);
        }
        audio.srcObject = remoteStream;
        audio.play().catch((e) => console.log('Audio autoplay prevented:', e));
      };

      // If initiator, create and send Offer
      if (initiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (socket) {
              socket.emit('voice:signal', {
                toPlayerId: targetPlayerId,
                signal: { sdp: pc.localDescription },
              });
            }
          })
          .catch((err) => console.error('Error creating voice offer:', err));
      }

      return pc;
    },
    [socket]
  );

  // Turn Mic On
  const enableMicrophone = async () => {
    try {
      setMicError(null);

      // Check if getUserMedia is supported in current context
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
          setMicError('iOS Safari requiere conexión HTTPS segura para habilitar el micrófono.');
        } else {
          setMicError('Tu navegador no soporta captura de audio (getUserMedia).');
        }
        return;
      }

      // Try with optimal constraints first, then fallback to basic { audio: true }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch (advancedErr) {
        // Fallback for Safari/WebKit with simplified constraints
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      }

      localStreamRef.current = stream;
      setIsMicEnabled(true);
      setIsMuted(false);
      monitorSpeakingVolume(stream);

      // Add track to all existing peer connections
      peerConnectionsRef.current.forEach((pc) => {
        stream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      });

      // Initiate WebRTC mesh connections with all players in room
      if (room && selfPlayerId) {
        Object.keys(room.players).forEach((pId) => {
          if (pId !== selfPlayerId) {
            createPeerConnection(pId, true);
          }
        });
      }
    } catch (err: any) {
      console.error('Microphone access denied:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicError('Permiso denegado. Ve a Ajustes de iPhone > Safari > Micrófono y selecciona "Permitir".');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMicError('No se encontró ningún micrófono disponible en el dispositivo.');
      } else if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setMicError('iOS Safari bloquea el micrófono en conexiones HTTP no seguras. Usa el enlace con HTTPS.');
      } else {
        setMicError(err.message || 'Error al acceder al micrófono. Verifica los permisos de Safari.');
      }
    }
  };

  // Turn Mic Off / Mute
  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  // Leave Voice / Disconnect completely
  const disableMicrophone = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    // Stop all audio players
    audioElementsRef.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
    });
    audioElementsRef.current.clear();

    setIsMicEnabled(false);
    setIsMuted(false);
    setIsSpeaking(false);

    if (socket) {
      socket.emit('voice:status', { isMuted: true, isSpeaking: false });
    }
  };

  // Handle incoming signaling messages from Socket.io
  useEffect(() => {
    if (!socket) return;

    const handleSignal = async (data: { fromPlayerId: string; signal: any }) => {
      const { fromPlayerId, signal } = data;
      let pc = peerConnectionsRef.current.get(fromPlayerId);

      if (!pc) {
        pc = createPeerConnection(fromPlayerId, false);
      }

      try {
        if (signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('voice:signal', {
              toPlayerId: fromPlayerId,
              signal: { sdp: pc.localDescription },
            });
          }
        } else if (signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.error('Error handling voice signal:', err);
      }
    };

    socket.on('voice:signal', handleSignal);

    return () => {
      socket.off('voice:signal', handleSignal);
    };
  }, [socket, createPeerConnection]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disableMicrophone();
    };
  }, []);

  return {
    isMicEnabled,
    isMuted,
    isSpeaking,
    micError,
    enableMicrophone,
    toggleMute,
    disableMicrophone,
  };
}

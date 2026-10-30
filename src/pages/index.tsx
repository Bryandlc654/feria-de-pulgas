import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomState,
  PlayerPrivate,
  ClientHandState,
} from '../types/game';
import { WelcomeView } from '../components/WelcomeView';
import { LobbyView } from '../components/LobbyView';
import { TradingView } from '../components/TradingView';
import { VictoryModal } from '../components/VictoryModal';
import { soundFx } from '../utils/sound';
import { useVoiceChat } from '../hooks/useVoiceChat';

export default function GamePage() {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [player, setPlayer] = useState<PlayerPrivate | null>(null);
  const [handState, setHandState] = useState<ClientHandState>({
    hand: [],
    counts: {},
    canClaimWin: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bannerAlert, setBannerAlert] = useState<string | null>(null);

  // WebRTC Mesh Voice Chat Hook
  const {
    isMicEnabled,
    isMuted,
    isSpeaking,
    micError,
    enableMicrophone,
    toggleMute,
    disableMicrophone,
  } = useVoiceChat(socket, room, player?.id || null);

  // Keep references for automatic reconnection
  const roomRef = useRef<RoomState | null>(null);
  const playerRef = useRef<PlayerPrivate | null>(null);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  // Connect to Socket.io on mount
  useEffect(() => {
    const s: Socket<ServerToClientEvents, ClientToServerEvents> = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    s.on('connect', () => {
      console.log('Connected to server with socket id:', s.id);
      // Auto-reconnect player if session was present
      const stored = localStorage.getItem('pulgas_session');
      if (stored) {
        try {
          const session = JSON.parse(stored);
          if (session.roomCode && session.playerId && session.token) {
            s.emit('room:reconnect', session, (res) => {
              if (res.success && res.room && res.handState) {
                setRoom(res.room);
                setHandState(res.handState);
                setPlayer({
                  id: session.playerId,
                  token: session.token,
                  nickname: session.nickname || 'Comerciante',
                  avatar: session.avatar || '🎩',
                  score: res.room.players[session.playerId]?.score || 0,
                  isHost: res.room.hostId === session.playerId,
                  isConnected: true,
                  cardCount: res.handState.hand.length,
                  activeOfferCount: res.room.players[session.playerId]?.activeOfferCount || null,
                  hand: res.handState.hand,
                });
              } else {
                localStorage.removeItem('pulgas_session');
              }
            });
          }
        } catch (e) {
          localStorage.removeItem('pulgas_session');
        }
      }
    });

    s.on('room:updated', (updatedRoom: RoomState) => {
      setRoom(updatedRoom);
      // Update local player state
      setPlayer((prev) => {
        if (!prev) return null;
        const pub = updatedRoom.players[prev.id];
        if (!pub) return prev;
        return {
          ...prev,
          score: pub.score,
          isHost: updatedRoom.hostId === prev.id,
          isConnected: pub.isConnected,
          activeOfferCount: pub.activeOfferCount,
        };
      });
    });

    s.on('hand:updated', (updatedHand: ClientHandState) => {
      setHandState(updatedHand);
      setPlayer((prev) => (prev ? { ...prev, hand: updatedHand.hand, cardCount: updatedHand.hand.length } : null));
    });

    s.on('trade:executed', (trade) => {
      soundFx.playTradeSuccess();
      setBannerAlert(`🤝 ¡Intercambio realizado entre ${trade.player1Name} y ${trade.player2Name} (${trade.count} cartas)!`);
      setTimeout(() => setBannerAlert(null), 3000);
    });

    s.on('shout:sound', (data) => {
      soundFx.playShoutOffer(data.count);
    });

    s.on('player:disconnected', (data) => {
      setBannerAlert(`⚠️ ${data.nickname} perdió la conexión.`);
      setTimeout(() => setBannerAlert(null), 3500);
    });

    s.on('player:reconnected', (data) => {
      setBannerAlert(`⚡ ${data.nickname} se ha reconectado.`);
      setTimeout(() => setBannerAlert(null), 3500);
    });

    s.on('round:start', () => {
      soundFx.playBellRing();
      setBannerAlert('🔔 ¡La Feria de Pulgas ha comenzado! ¡A negociar!');
      setTimeout(() => setBannerAlert(null), 2500);
    });

    s.on('round:ended', (winner) => {
      soundFx.playRoundWin();
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  // Save session for reloads / reconnections
  const persistSession = (roomCode: string, p: PlayerPrivate) => {
    localStorage.setItem(
      'pulgas_session',
      JSON.stringify({
        roomCode,
        playerId: p.id,
        token: p.token,
        nickname: p.nickname,
        avatar: p.avatar,
      })
    );
  };

  const handleCreateRoom = (
    nickname: string,
    avatar: string,
    roomName?: string,
    targetScore?: number
  ) => {
    if (!socket) return;
    setIsLoading(true);
    setErrorMessage(null);

    socket.emit(
      'room:create',
      { nickname, avatar, roomName, targetScore },
      (res) => {
        setIsLoading(false);
        if (res.success && res.roomCode && res.player) {
          setPlayer(res.player);
          persistSession(res.roomCode, res.player);
        } else {
          setErrorMessage(res.error || 'No se pudo crear la sala.');
        }
      }
    );
  };

  const handleJoinRoom = (roomCode: string, nickname: string, avatar: string) => {
    if (!socket) return;
    setIsLoading(true);
    setErrorMessage(null);

    socket.emit('room:join', { roomCode, nickname, avatar }, (res) => {
      setIsLoading(false);
      if (res.success && res.room && res.player) {
        setRoom(res.room);
        setPlayer(res.player);
        persistSession(res.room.code, res.player);
      } else {
        setErrorMessage(res.error || 'No se pudo unir a la sala.');
      }
    });
  };

  const handleStartGame = () => {
    if (!socket) return;
    socket.emit('game:start', (res) => {
      if (!res.success) {
        setErrorMessage(res.error || 'No se pudo iniciar la partida.');
      }
    });
  };

  const handleMakeOffer = (cardIds: string[]) => {
    if (!socket) return;
    socket.emit('trade:offer', { cardIds }, (res) => {
      if (!res.success) {
        setErrorMessage(res.error || 'Error al emitir oferta.');
      }
    });
  };

  const handleCancelOffer = () => {
    if (!socket) return;
    socket.emit('trade:cancel', (res) => {
      if (!res.success) {
        setErrorMessage(res.error || 'Error al cancelar oferta.');
      }
    });
  };

  const handleAcceptTrade = (targetPlayerId: string) => {
    if (!socket) return;
    socket.emit('trade:accept', { targetPlayerId }, (res) => {
      if (!res.success) {
        setErrorMessage(res.error || 'No se pudo completar el intercambio.');
      }
    });
  };

  const handleClaimWin = () => {
    if (!socket) return;
    socket.emit('game:claim_win', (res) => {
      if (!res.success) {
        setErrorMessage(res.error || 'No fue posible reclamar victoria.');
      }
    });
  };

  const handleNextRound = () => {
    if (!socket) return;
    socket.emit('game:next_round', (res) => {
      if (!res.success) {
        setErrorMessage(res.error || 'No se pudo iniciar siguiente ronda.');
      }
    });
  };

  const handleResetToLobby = () => {
    if (!socket) return;
    socket.emit('game:reset_to_lobby', (res) => {
      if (!res.success) {
        setErrorMessage(res.error || 'No se pudo reiniciar la sala.');
      }
    });
  };

  const handleLeaveRoom = () => {
    localStorage.removeItem('pulgas_session');
    setRoom(null);
    setPlayer(null);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-flea-dark text-white flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Top Navbar */}
      <header className="border-b border-white/[0.06] bg-black/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => !room && window.location.reload()}>
            <span className="text-xl">🏺</span>
            <span className="font-bold text-sm sm:text-base tracking-tight text-zinc-100">
              Feria de Pulgas
            </span>
          </div>

          {player && room && (
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              {/* Voice Chat Controls */}
              <div className="flex items-center gap-1">
                {!isMicEnabled ? (
                  <button
                    onClick={enableMicrophone}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 text-[11px] font-medium transition-all active:scale-95"
                    title="Activar chat de voz"
                  >
                    <span>🎙️</span>
                    <span className="hidden sm:inline">Voz</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-0.5">
                    <button
                      onClick={toggleMute}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-transform active:scale-95 flex items-center gap-1 ${
                        isMuted
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : isSpeaking
                          ? 'bg-emerald-400 text-black font-semibold'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                      title={isMuted ? 'Desmutear' : 'Mutear'}
                    >
                      <span>{isMuted ? '🔇' : '🎙️'}</span>
                      <span className="text-[9px] uppercase hidden xs:inline font-mono">
                        {isMuted ? 'Mute' : isSpeaking ? 'Habla' : 'En vivo'}
                      </span>
                    </button>
                    <button
                      onClick={disableMicrophone}
                      className="text-zinc-500 hover:text-zinc-300 text-xs px-1"
                      title="Desconectar"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Player Profile Badge */}
              <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 px-2.5 py-1 rounded-lg">
                <span className="text-base">{player.avatar}</span>
                <div className="text-[10px] sm:text-xs">
                  <span className="font-medium text-zinc-300 block truncate max-w-[65px] sm:max-w-[90px]">
                    {player.nickname}
                  </span>
                  <span className="text-amber-400 font-mono font-medium">{player.score} pts</span>
                </div>
              </div>

              <button
                onClick={handleLeaveRoom}
                className="text-[10px] sm:text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded transition-colors"
                title="Salir"
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Floating Global Banner Notification */}
      {micError && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-rose-950/90 border border-rose-500/40 text-rose-200 px-4 py-2 rounded-xl text-xs font-medium shadow-xl backdrop-blur-md max-w-[90vw] text-center">
          ⚠️ {micError}
        </div>
      )}
      {bannerAlert && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/90 border border-amber-400/40 text-amber-200 px-4 py-2 rounded-xl text-xs font-medium shadow-xl backdrop-blur-md max-w-[90vw] text-center">
          {bannerAlert}
        </div>
      )}

      {/* Main Game Surface */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-2.5 sm:p-4 flex flex-col justify-center">
        {!room || !player ? (
          <WelcomeView
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            isLoading={isLoading}
            error={errorMessage}
          />
        ) : room.status === 'LOBBY' ? (
          <LobbyView
            room={room}
            isHost={player.id === room.hostId}
            onStartGame={handleStartGame}
          />
        ) : (
          <TradingView
            room={room}
            player={player}
            handState={handState}
            onMakeOffer={handleMakeOffer}
            onCancelOffer={handleCancelOffer}
            onAcceptTrade={handleAcceptTrade}
            onClaimWin={handleClaimWin}
          />
        )}
      </main>

      {/* Victory / Round Over Modal */}
      {room && (room.status === 'ROUND_OVER' || room.status === 'GAME_OVER') && (
        <VictoryModal
          room={room}
          isHost={player?.id === room.hostId}
          onNextRound={handleNextRound}
          onResetToLobby={handleResetToLobby}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-gray-400 bg-slate-950/60">
        <p>
          Feria de Pulgas © 2026 — Basado en el clásico juego de trueque y mercado libre simultáneo.
        </p>
      </footer>
    </div>
  );
}

import React, { useState } from 'react';

const AVATARS = ['🎩', '🏺', '👑', '🕰️', '💎', '🧭', '🗝️', '📜', '🎭', '🔮', '🎻', '🎨'];

interface WelcomeViewProps {
  onCreateRoom: (nickname: string, avatar: string, roomName?: string, targetScore?: number) => void;
  onJoinRoom: (roomCode: string, nickname: string, avatar: string) => void;
  isLoading: boolean;
  error?: string | null;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  onCreateRoom,
  onJoinRoom,
  isLoading,
  error,
}) => {
  const [tab, setTab] = useState<'join' | 'create'>('join');
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🎩');
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [targetScore, setTargetScore] = useState(300);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    if (tab === 'join') {
      if (!roomCode.trim()) return;
      onJoinRoom(roomCode.trim().toUpperCase(), nickname.trim(), selectedAvatar);
    } else {
      onCreateRoom(
        nickname.trim(),
        selectedAvatar,
        roomName.trim() || undefined,
        targetScore
      );
    }
  };

  return (
    <div className="max-w-md mx-auto px-2">
      {/* Hero Header */}
      <div className="text-center mb-6 sm:mb-8">
        <div className="inline-block p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 mb-3 shadow-sm">
          <span className="text-5xl inline-block">🏺</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
          Feria de Pulgas
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 max-w-xs mx-auto">
          Trueque en tiempo real. Intercambia cartas a ciegas y reúne las 9 piezas.
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-zinc-900/60 border border-white/[0.08] rounded-2xl p-5 sm:p-7 shadow-xl backdrop-blur-md">
        {/* Tab switch */}
        <div className="flex bg-black/40 p-1 rounded-xl mb-5 border border-white/5">
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === 'join'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Unirse a Sala
          </button>
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === 'create'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Crear Sala
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs py-2 px-3 rounded-lg text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nickname */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Tu Nombre / Apodo
            </label>
            <input
              type="text"
              required
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Ej: Bryan, Don Baratija..."
              className="w-full bg-black/50 border border-white/10 focus:border-amber-400/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Avatar Selector */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Icono de Comerciante
            </label>
            <div className="grid grid-cols-6 gap-1.5 bg-black/50 p-1.5 rounded-xl border border-white/5">
              {AVATARS.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setSelectedAvatar(av)}
                  className={`text-xl p-1.5 rounded-lg transition-all ${
                    selectedAvatar === av
                      ? 'bg-amber-400/20 border border-amber-400/50 scale-105'
                      : 'hover:bg-white/5 opacity-70 hover:opacity-100'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Join Mode: Room Code */}
          {tab === 'join' ? (
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Código de la Sala
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="CÓDIGO (5 LETRAS)"
                className="w-full bg-black/50 border border-white/10 focus:border-amber-400/80 rounded-xl px-3.5 py-2.5 text-center font-mono font-bold text-base sm:text-lg tracking-widest text-amber-300 placeholder-zinc-600 focus:outline-none uppercase transition-colors"
              />
            </div>
          ) : (
            <>
              {/* Create Mode: Room Name & Target Score */}
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Nombre de la Sala
                </label>
                <input
                  type="text"
                  maxLength={30}
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Mercado Central"
                  className="w-full bg-black/50 border border-white/10 focus:border-amber-400/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 mb-1">
                  <span>Puntos para Ganar</span>
                  <span className="font-mono text-amber-400 font-semibold">{targetScore} pts</span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={600}
                  step={50}
                  value={targetScore}
                  onChange={(e) => setTargetScore(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                />
                <div className="flex justify-between text-[9px] text-zinc-500 font-mono mt-1">
                  <span>Rápida (100)</span>
                  <span>Estándar (300)</span>
                  <span>Larga (600)</span>
                </div>
              </div>
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !nickname.trim()}
            className={`
              w-full mt-3 py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm tracking-wide transition-all shadow-sm
              ${
                isLoading || !nickname.trim()
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-amber-400 hover:bg-amber-300 text-black font-semibold active:scale-95'
              }
            `}
          >
            {isLoading
              ? 'Conectando...'
              : tab === 'join'
              ? 'Entrar a la Sala'
              : 'Crear Sala'}
          </button>
        </form>
      </div>
    </div>
  );
};

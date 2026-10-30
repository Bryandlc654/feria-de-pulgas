import React, { useState } from 'react';
import { RoomState, COMMODITIES } from '../types/game';
import { soundFx } from '../utils/sound';

interface LobbyViewProps {
  room: RoomState;
  isHost: boolean;
  onStartGame: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  room,
  isHost,
  onStartGame,
}) => {
  const [copied, setCopied] = useState(false);
  const playerList = Object.values(room.players);
  const canStart = playerList.length >= 2;

  const handleCopyCode = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 select-none">
      {/* Top Banner: Room Code & Quick Invite */}
      <div className="bg-zinc-900/40 border border-white/[0.08] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400">
            Sala de Trueque
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-100">{room.name}</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Meta: <span className="text-zinc-200 font-medium">{room.targetScore} puntos</span>
          </p>
        </div>

        {/* Room Code Badge */}
        <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-bold tracking-widest bg-black/60 px-4 py-1.5 rounded-lg border border-white/10 text-amber-300">
              {room.code}
            </span>
            <button
              onClick={handleCopyCode}
              className="bg-white/10 hover:bg-white/20 text-zinc-200 font-medium px-3 py-2 rounded-lg text-xs transition-colors active:scale-95 flex items-center gap-1"
              title="Copiar código"
            >
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Players List (2 columns wide) */}
        <div className="md:col-span-2 bg-zinc-900/30 border border-white/[0.06] rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm text-zinc-300 flex items-center gap-2">
              <span>Comerciantes</span>
              <span className="text-xs text-zinc-500 font-mono">
                ({playerList.length}/{room.maxPlayers})
              </span>
            </h3>
            {playerList.length < 2 && (
              <span className="text-[11px] text-zinc-500 font-normal">
                Esperando al menos 2 jugadores...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {playerList.map((player) => (
              <div
                key={player.id}
                className="bg-black/30 border border-white/5 rounded-lg p-2.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{player.avatar}</span>
                  <div>
                    <h4 className="font-medium text-zinc-200 text-xs truncate max-w-[120px]">
                      {player.nickname}
                    </h4>
                    <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          player.isConnected ? 'bg-emerald-400' : 'bg-zinc-600'
                        }`}
                      />
                      {player.isConnected ? 'Conectado' : 'Reconectando...'}
                    </span>
                  </div>
                </div>

                {player.isHost && (
                  <span className="text-[9px] font-mono text-amber-400/90 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                    Host
                  </span>
                )}
              </div>
            ))}

            {Array.from({ length: Math.max(0, 2 - playerList.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="border border-dashed border-white/5 rounded-lg p-2.5 flex items-center justify-center text-zinc-600 text-xs"
              >
                Esperando comerciante...
              </div>
            ))}
          </div>

          {/* Host Start Action */}
          <div className="pt-3 border-t border-white/5">
            {isHost ? (
              <button
                disabled={!canStart}
                onClick={() => {
                  soundFx.playBellRing();
                  onStartGame();
                }}
                className={`
                  w-full py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm tracking-wide transition-all
                  ${
                    canStart
                      ? 'bg-amber-400 hover:bg-amber-300 text-black font-semibold active:scale-95 shadow-sm'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }
                `}
              >
                {canStart
                  ? 'Comenzar Partida'
                  : 'Se necesitan al menos 2 jugadores'}
              </button>
            ) : (
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
                <p className="text-zinc-300 text-xs">
                  Esperando a que el anfitrión inicie la partida...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* How to Play Card */}
        <div className="bg-zinc-900/30 border border-white/[0.06] rounded-xl p-4 sm:p-5 space-y-3">
          <h3 className="font-medium text-xs uppercase tracking-wider text-zinc-400">
            Reglas Básicas
          </h3>

          <ul className="text-xs text-zinc-400 space-y-2 leading-relaxed">
            <li className="flex items-start gap-1.5">
              <span className="text-zinc-600 font-mono">1.</span>
              <span>Todos reciben <strong className="text-zinc-200">9 cartas</strong> al azar.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-zinc-600 font-mono">2.</span>
              <span>Ofrece 1 a 4 cartas <strong className="text-zinc-200">del mismo tipo</strong>.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-zinc-600 font-mono">3.</span>
              <span>Cuando coincidas en cantidad con otro jugador, pulsa <strong className="text-zinc-200">Cambiar</strong>.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-zinc-600 font-mono">4.</span>
              <span>El primero en juntar las 9 idénticas toca la campana y gana la ronda.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RoomState, COMMODITIES, Card } from '../types/game';
import { soundFx } from '../utils/sound';

interface VictoryModalProps {
  room: RoomState;
  isHost: boolean;
  onNextRound: () => void;
  onResetToLobby: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  room,
  isHost,
  onNextRound,
  onResetToLobby,
}) => {
  const isGameOver = room.status === 'GAME_OVER';
  const winnerData = room.roundWinner;
  const overallWinner = room.overallWinner;

  useEffect(() => {
    soundFx.playRoundWin();
    // Confetti cannon
    const end = Date.now() + 2.5 * 1000;
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#eab308'];

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  if (!winnerData && !overallWinner) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-pop">
      <div className="relative w-full max-w-xl bg-zinc-900 border border-white/10 rounded-2xl p-5 sm:p-7 shadow-2xl text-center text-white overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header Title */}
        <div className="flex flex-col items-center">
          <span className="text-4xl sm:text-5xl mb-1.5">
            {isGameOver ? '🏆' : '🔔'}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
            {isGameOver ? 'Fin de la Partida' : '¡Feria de Pulgas!'}
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm mt-0.5">
            {isGameOver
              ? `Meta de ${room.targetScore} puntos alcanzada`
              : `Ronda #${room.roundNumber} finalizada`}
          </p>
        </div>

        {/* Winner Spotlight */}
        <div className="my-4 bg-white/[0.03] border border-white/5 p-3.5 rounded-xl">
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl">
              {room.players[winnerData?.playerId || '']?.avatar || '🎩'}
            </span>
            <div className="text-left">
              <span className="text-[10px] uppercase font-mono text-amber-400">
                Ganador de la ronda
              </span>
              <h3 className="text-base sm:text-lg font-bold text-zinc-100">
                {winnerData?.nickname}
              </h3>
              <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                <span>Completó</span>
                <span className="font-semibold text-zinc-200">
                  {winnerData?.commodity.icon} {winnerData?.commodity.name}
                </span>
                <span className="font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded text-[10px] font-bold">
                  +{winnerData?.points} pts
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Scoreboard & Hands Transparency (Scrollable) */}
        <div className="flex-1 overflow-y-auto pr-1 my-2 text-left space-y-3.5 scrollbar-thin">
          {/* Scoreboard */}
          <div>
            <h4 className="text-[10px] uppercase font-mono text-zinc-500 mb-1.5 tracking-wider">
              Posiciones
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {Object.values(room.players)
                .sort((a, b) => b.score - a.score)
                .map((p, idx) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                      idx === 0
                        ? 'bg-amber-400/5 border-amber-400/30 font-medium'
                        : 'bg-black/20 border-white/5 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-zinc-500 text-[10px]">#{idx + 1}</span>
                      <span>{p.avatar}</span>
                      <span className="truncate max-w-[110px] text-zinc-200">{p.nickname}</span>
                    </div>
                    <span className="font-mono text-amber-400">{p.score} pts</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Transparency: Cards held by each player */}
          {winnerData?.handsSummary && (
            <div>
              <h4 className="text-[10px] uppercase font-mono text-zinc-500 mb-1.5 tracking-wider">
                Verificación de Manos
              </h4>
              <div className="space-y-1.5">
                {Object.entries(winnerData.handsSummary).map(([pId, info]) => {
                  return (
                    <div
                      key={pId}
                      className="bg-black/20 p-2 rounded-lg border border-white/5 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1 text-zinc-300 font-medium text-[11px]">
                        <span>{info.nickname}</span>
                        <span className="text-zinc-500 text-[10px] font-mono">9 cartas</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {info.hand.map((c, i) => {
                          const com = COMMODITIES.find((item) => item.id === c.suit);
                          return (
                            <span
                              key={i}
                              title={com?.name}
                              className="px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-300 flex items-center gap-1 border border-white/5 text-[10px]"
                            >
                              <span>{com?.icon}</span>
                              <span className="font-mono">{com?.name.split(' ')[0]}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Host Actions */}
        <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-end gap-2">
          {isHost ? (
            <>
              {isGameOver ? (
                <button
                  onClick={onResetToLobby}
                  className="w-full sm:w-auto px-5 py-2 bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs rounded-lg transition-transform active:scale-95"
                >
                  Nueva Partida (Lobby)
                </button>
              ) : (
                <>
                  <button
                    onClick={onResetToLobby}
                    className="w-full sm:w-auto px-3 py-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 text-xs rounded-lg transition-colors"
                  >
                    Volver al Lobby
                  </button>
                  <button
                    onClick={onNextRound}
                    className="w-full sm:w-auto px-5 py-2 bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs rounded-lg shadow-sm transition-transform active:scale-95"
                  >
                    Siguiente Ronda (#{room.roundNumber + 1})
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="text-xs text-zinc-400 italic py-1 text-center w-full font-mono">
              Esperando al anfitrión...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

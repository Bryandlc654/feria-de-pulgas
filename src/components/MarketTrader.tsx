import React from 'react';
import { PlayerPublic } from '../types/game';
import { soundFx } from '../utils/sound';

interface MarketTraderProps {
  player: PlayerPublic;
  isSelf: boolean;
  myOfferCount: number | null;
  onTradeWith: (targetPlayerId: string) => void;
}

export const MarketTrader: React.FC<MarketTraderProps> = ({
  player,
  isSelf,
  myOfferCount,
  onTradeWith,
}) => {
  const hasOffer = player.activeOfferCount !== null && player.activeOfferCount > 0;
  // Match condition: opponent is offering cards AND we are offering the EXACT same number of cards!
  const isMatch = !isSelf && hasOffer && myOfferCount !== null && player.activeOfferCount === myOfferCount;

  return (
    <div
      className={`
        relative rounded-xl p-2.5 sm:p-3 transition-all duration-200 border
        flex flex-col items-center justify-between
        ${
          isSelf
            ? 'bg-zinc-900/60 border-zinc-800'
            : isMatch
            ? 'bg-amber-500/10 border-amber-400/80 shadow-md shadow-amber-500/10'
            : 'bg-zinc-900/40 border-white/[0.06] hover:border-white/10'
        }
        ${!player.isConnected ? 'opacity-30' : ''}
      `}
    >
      {/* Top Status: Online badge & Host tag */}
      <div className="w-full flex items-center justify-between text-[10px] text-zinc-400 mb-1">
        <span className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              player.isConnected ? 'bg-emerald-400' : 'bg-zinc-600'
            }`}
          />
          <span className="truncate max-w-[55px] sm:max-w-none text-[9px] sm:text-[10px] text-zinc-400 font-medium">
            {player.isConnected ? 'Listo' : 'Offline'}
          </span>
        </span>
        {player.isHost && (
          <span className="text-[8px] font-medium tracking-wider uppercase text-amber-400/90 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20">
            Host
          </span>
        )}
      </div>

      {/* Avatar & Player Info */}
      <div className="flex flex-col items-center my-1">
        <div className="relative">
          <span className={`text-2xl sm:text-3xl transition-transform duration-200 ${player.isSpeaking ? 'scale-110' : ''}`}>
            {player.avatar || '🏺'}
          </span>
          {isSelf && (
            <span className="absolute -bottom-1 -right-2 bg-zinc-700 text-zinc-200 font-semibold text-[8px] px-1 py-0.2 rounded uppercase">
              Tú
            </span>
          )}
          {player.isSpeaking && (
            <span className="absolute -inset-1 rounded-full border border-emerald-400/80 animate-ping pointer-events-none" />
          )}
        </div>
        <div className="flex items-center gap-1 mt-1">
          <h4 className="font-medium text-zinc-200 text-xs truncate max-w-[80px] sm:max-w-[110px] text-center">
            {player.nickname}
          </h4>
          {player.isSpeaking ? (
            <span className="text-emerald-400 text-[10px]" title="Hablando">
              🎙️
            </span>
          ) : player.isMuted ? (
            <span className="text-zinc-500 text-[8px]" title="Silenciado">
              🔇
            </span>
          ) : null}
        </div>
        <span className="text-[10px] text-zinc-400 font-mono mt-0.5">{player.score} pts</span>
      </div>

      {/* Trading Shout & Offer Status */}
      <div className="w-full mt-1.5 flex flex-col items-center">
        {hasOffer ? (
          <div className="w-full flex flex-col items-center gap-1">
            <div
              className={`
                w-full py-1 px-1.5 rounded-lg text-center font-semibold text-[10px] sm:text-[11px]
                flex items-center justify-center gap-1
                ${
                  isMatch
                    ? 'bg-amber-400 text-black font-bold shadow-sm'
                    : 'bg-zinc-800 text-zinc-200 border border-white/10'
                }
              `}
            >
              <span>Ofrece</span>
              <span className="font-bold underline decoration-1 text-xs">
                {player.activeOfferCount}
              </span>
              <span>{player.activeOfferCount === 1 ? 'carta' : 'cartas'}</span>
            </div>
            {/* 5s Expiration minimal line */}
            <div className="w-full bg-zinc-800 rounded-full h-0.5 overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full transition-all ease-linear"
                style={{
                  width: '100%',
                  animation: 'shrinkWidth 5s linear forwards',
                }}
              />
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-zinc-400 italic py-0.5">En espera</div>
        )}

        {/* Action Button: MATCH & TRADE! */}
        {isMatch && (
          <button
            onClick={() => {
              soundFx.playTradeSuccess();
              onTradeWith(player.id);
            }}
            className="w-full mt-1.5 py-1.5 px-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[10px] sm:text-xs uppercase tracking-wide rounded-lg transition-transform active:scale-95 flex items-center justify-center gap-1 shadow-md shadow-emerald-500/20"
          >
            <span>Cambiar ({player.activeOfferCount})</span>
          </button>
        )}
      </div>
    </div>
  );
};

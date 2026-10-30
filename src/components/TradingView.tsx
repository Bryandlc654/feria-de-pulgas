import React, { useState, useEffect } from 'react';
import {
  RoomState,
  ClientHandState,
  PlayerPrivate,
  COMMODITIES,
} from '../types/game';
import { PlayingCard } from './PlayingCard';
import { MarketTrader } from './MarketTrader';
import { soundFx } from '../utils/sound';

interface TradingViewProps {
  room: RoomState;
  player: PlayerPrivate;
  handState: ClientHandState;
  onMakeOffer: (cardIds: string[]) => void;
  onCancelOffer: () => void;
  onAcceptTrade: (targetPlayerId: string) => void;
  onClaimWin: () => void;
}

export const TradingView: React.FC<TradingViewProps> = ({
  room,
  player,
  handState,
  onMakeOffer,
  onCancelOffer,
  onAcceptTrade,
  onClaimWin,
}) => {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const myOfferCount = player.activeOfferCount;
  const isOffering = myOfferCount !== null && myOfferCount > 0;

  // When offer finishes (trade completed or cancelled), clear any selected cards
  useEffect(() => {
    if (!isOffering) {
      setSelectedCardIds([]);
    }
  }, [isOffering]);

  // If hand updates (e.g. after a trade), remove any card IDs that are no longer in hand
  useEffect(() => {
    const validHandIds = new Set(handState.hand.map((c) => c.id));
    setSelectedCardIds((prev) => prev.filter((id) => validHandIds.has(id)));
  }, [handState.hand]);

  // Toggle card selection in hand
  const handleToggleCard = (cardId: string) => {
    soundFx.playCardSelect();
    setErrorMessage(null);

    setSelectedCardIds((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }

      if (prev.length >= 4) {
        setErrorMessage('Solo puedes ofrecer un máximo de 4 cartas a la vez.');
        return prev;
      }

      // Check if newly selected card matches the suit of already selected cards
      const targetCard = handState.hand.find((c) => c.id === cardId);
      if (!targetCard) return prev;

      if (prev.length > 0) {
        const firstCard = handState.hand.find((c) => c.id === prev[0]);
        if (firstCard && firstCard.suit !== targetCard.suit) {
          // If player clicks another suit, switch selection to this new suit immediately for fast play!
          return [cardId];
        }
      }

      return [...prev, cardId];
    });
  };

  // Submit Offer
  const handleSendOffer = () => {
    if (selectedCardIds.length === 0) {
      setErrorMessage('Selecciona al menos 1 carta para ofrecer.');
      return;
    }

    // Verify all selected cards belong to same suit
    const selectedCards = handState.hand.filter((c) => selectedCardIds.includes(c.id));
    const suit = selectedCards[0]?.suit;
    const allSame = selectedCards.every((c) => c.suit === suit);

    if (!allSame) {
      setErrorMessage('¡Todas las cartas ofrecidas deben ser del mismo objeto!');
      return;
    }

    soundFx.playShoutOffer(selectedCardIds.length);
    onMakeOffer(selectedCardIds);
  };

  // Cancel current offer
  const handleCancelOffer = () => {
    onCancelOffer();
    setSelectedCardIds([]);
  };

  // Quick Select by Suit group helper
  const handleQuickSelectSuit = (suitId: string, count: number) => {
    const cardsOfSuit = handState.hand.filter((c) => c.suit === suitId);
    const take = Math.min(count, cardsOfSuit.length, 4);
    const idsToSelect = cardsOfSuit.slice(0, take).map((c) => c.id);
    setSelectedCardIds(idsToSelect);
    soundFx.playCardSelect();
  };

  // Group cards by suit for clean display
  const sortedHand = [...handState.hand].sort((a, b) => {
    if (a.suit === b.suit) return 0;
    return a.suit.localeCompare(b.suit);
  });

  return (
    <div className="w-full max-w-5xl mx-auto space-y-3 sm:space-y-4 select-none pb-4">
      {/* Top Bar: Room + Round info + Minimal Win Bell */}
      <div className="bg-zinc-900/40 border border-white/[0.07] rounded-xl p-2.5 sm:p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="bg-white/5 text-zinc-300 font-mono text-[11px] sm:text-xs px-2 py-0.5 rounded border border-white/10 shrink-0">
            Ronda {room.roundNumber}
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-zinc-200 text-xs sm:text-sm truncate">
              {room.name}
            </h3>
            <span className="text-[10px] sm:text-[11px] text-zinc-400 block truncate font-mono">
              Meta: {room.targetScore} pts
            </span>
          </div>
        </div>

        {/* Live Notification Bar / Recent Trade Ticker */}
        {room.recentTrade && (
          <div className="hidden lg:flex items-center gap-1.5 text-zinc-300 text-xs bg-white/5 border border-white/10 px-3 py-1 rounded-full">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>
              <strong>{room.recentTrade.player1Name}</strong> y{' '}
              <strong>{room.recentTrade.player2Name}</strong> cambiaron{' '}
              <span className="text-amber-400 font-bold">{room.recentTrade.cardCount}</span> cartas
            </span>
          </div>
        )}

        {/* CLAIM WIN BELL BUTTON */}
        <div className="shrink-0">
          {handState.canClaimWin ? (
            <button
              onClick={() => {
                soundFx.playBellRing();
                onClaimWin();
              }}
              className="py-1.5 px-3.5 bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs uppercase tracking-wide rounded-lg shadow-md transition-transform active:scale-95 flex items-center gap-1.5"
            >
              <span>🔔</span>
              <span>¡Cantar Victoria!</span>
            </button>
          ) : (
            <div className="text-[11px] text-zinc-400 bg-white/[0.02] border border-white/5 px-2.5 py-1 rounded-lg flex items-center gap-1 font-mono">
              <span>🔔</span>
              <span className="hidden sm:inline">9 iguales</span>
            </div>
          )}
        </div>
      </div>

      {/* ERROR NOTICE IF ANY */}
      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs py-1.5 px-3 rounded-lg text-center font-medium">
          {errorMessage}
        </div>
      )}

      {/* OTHER MERCHANTS FLOOR (Trading Marketplace) */}
      <div className="bg-zinc-900/30 border border-white/[0.06] rounded-xl p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="font-medium text-zinc-400 text-xs uppercase tracking-wider">
            Mercado Activo
          </h3>
          <span className="text-[10px] text-zinc-400 font-mono">
            {Object.keys(room.offers).length} ofertas
          </span>
        </div>

        {/* Responsive Grid: strictly 2 columns on mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-2.5">
          {Object.values(room.players).map((p) => (
            <MarketTrader
              key={p.id}
              player={p}
              isSelf={p.id === player.id}
              myOfferCount={myOfferCount}
              onTradeWith={onAcceptTrade}
            />
          ))}
        </div>
      </div>

      {/* MY HAND & OFFERING STATION */}
      <div className="bg-zinc-900/40 border border-white/[0.08] rounded-xl p-3 sm:p-4 relative">
        {/* Active shout banner if currently offering */}
        {isOffering && (
          <div className="mb-2.5 bg-amber-400 text-black py-1 px-3 rounded-lg font-semibold text-xs flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-1.5 truncate">
              <span>📢</span>
              <span className="truncate">
                Ofreciendo {myOfferCount} {myOfferCount === 1 ? 'carta' : 'cartas'} al mercado
              </span>
            </div>
            <button
              onClick={handleCancelOffer}
              className="bg-black/80 hover:bg-black text-white text-[10px] px-2 py-0.5 rounded font-medium shrink-0"
            >
              Cancelar
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-medium text-zinc-200">
              Tus cartas
            </h3>
            <span className="text-[10px] text-zinc-400 font-mono bg-white/5 px-1.5 py-0.2 rounded">
              {handState.hand.length}/9
            </span>
          </div>

          {/* Offer Controls Action Buttons */}
          <div className="shrink-0">
            {!isOffering ? (
              <button
                disabled={selectedCardIds.length === 0}
                onClick={handleSendOffer}
                className={`
                  py-1.5 px-3.5 rounded-lg font-medium text-xs tracking-wide transition-all
                  ${
                    selectedCardIds.length > 0
                      ? 'bg-amber-400 hover:bg-amber-300 text-black font-semibold active:scale-95 shadow-sm'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }
                `}
              >
                Ofrecer {selectedCardIds.length > 0 ? `(${selectedCardIds.length})` : 'cartas'}
              </button>
            ) : (
              <button
                onClick={handleCancelOffer}
                className="py-1.5 px-3.5 rounded-lg font-medium text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-transform active:scale-95"
              >
                Retirar oferta
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Pill Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 mb-2 scrollbar-none">
          <span className="text-[10px] text-zinc-400 font-mono shrink-0">
            Filtro:
          </span>
          {Object.entries(handState.counts).map(([suitId, count]) => {
            const com = COMMODITIES.find((c) => c.id === suitId);
            if (!com || count === 0) return null;
            return (
              <button
                key={suitId}
                disabled={isOffering}
                onClick={() => handleQuickSelectSuit(suitId, count)}
                className={`
                  shrink-0 px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium border transition-colors flex items-center gap-1
                  ${
                    count >= 6
                      ? 'bg-amber-400/10 border-amber-400/30 text-amber-300'
                      : 'bg-white/[0.03] border-white/5 text-zinc-400 hover:text-zinc-200'
                  }
                  ${isOffering ? 'opacity-30 cursor-not-allowed' : ''}
                `}
              >
                <span>{com.icon}</span>
                <span className="font-mono text-zinc-300">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Cards Row: clean, minimal gap, horizontal scroll */}
        <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto pb-2 pt-2 scrollbar-thin">
          {sortedHand.map((card) => {
            const isSelected = selectedCardIds.includes(card.id);
            return (
              <PlayingCard
                key={card.id}
                card={card}
                selected={isSelected}
                disabled={isOffering}
                onToggleSelect={handleToggleCard}
                size="md"
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

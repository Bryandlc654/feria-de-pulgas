import React from 'react';
import { Card, Commodity, COMMODITIES } from '../types/game';

interface PlayingCardProps {
  card: Card;
  selected?: boolean;
  onToggleSelect?: (cardId: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  selected = false,
  onToggleSelect,
  disabled = false,
  size = 'md',
}) => {
  const commodity: Commodity = COMMODITIES.find((c) => c.id === card.suit) || {
    id: card.suit,
    name: 'Antigüedad',
    points: 50,
    icon: '🏺',
    bgGradient: 'from-amber-500/10 to-amber-500/5',
    borderColor: 'border-amber-500/40',
    accentColor: '#f59e0b',
    description: '',
  };

  const sizeClasses = {
    sm: 'w-16 h-24 sm:w-20 sm:h-28 p-2 text-xs',
    md: 'w-20 h-30 sm:w-24 sm:h-34 md:w-26 md:h-38 p-2 sm:p-2.5 text-xs',
    lg: 'w-26 h-38 sm:w-30 sm:h-44 md:w-34 md:h-48 p-2.5 sm:p-3 text-sm',
  }[size];

  return (
    <div
      onClick={() => {
        if (!disabled && onToggleSelect) {
          onToggleSelect(card.id);
        }
      }}
      className={`
        relative rounded-xl border flex flex-col justify-between select-none cursor-pointer flex-shrink-0
        transition-all duration-150 transform
        ${commodity.bgGradient}
        ${
          selected
            ? '-translate-y-3 border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/10 z-10'
            : 'border-white/10 hover:border-white/20 hover:-translate-y-0.5 active:scale-95 bg-white/[0.03]'
        }
        ${sizeClasses}
        ${disabled ? 'opacity-40 cursor-not-allowed hover:translate-y-0' : ''}
      `}
    >
      {/* Top Header: Points & Mini Indicator */}
      <div className="flex items-center justify-between">
        <span className={`font-semibold tracking-tight text-[11px] sm:text-xs ${selected ? 'text-amber-300' : 'text-zinc-300'}`}>
          {commodity.points}
          <span className="text-[9px] font-normal text-zinc-500 ml-0.5">pts</span>
        </span>
        <span className="text-xs sm:text-sm opacity-90">{commodity.icon}</span>
      </div>

      {/* Center Hero Icon */}
      <div className="flex flex-col items-center justify-center my-auto">
        <span
          className={`
            transition-transform duration-200
            ${size === 'sm' ? 'text-2xl' : size === 'md' ? 'text-3xl sm:text-3.5xl' : 'text-4xl'}
            ${selected ? 'scale-110' : ''}
          `}
        >
          {commodity.icon}
        </span>
        <span className="font-medium text-center text-zinc-300 mt-1 line-clamp-1 text-[10px] sm:text-[11px]">
          {commodity.name}
        </span>
      </div>

      {/* Selected Indicator Pill */}
      {selected && (
        <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-black rounded-full w-4 h-4 flex items-center justify-center font-bold text-[9px] shadow">
          ✓
        </div>
      )}

      {/* Bottom Footer: Minimalist subtle badge */}
      <div className="flex items-center justify-between text-[8px] sm:text-[9px] text-zinc-400 border-t border-white/5 pt-1">
        <span className="uppercase tracking-wider font-mono opacity-80">Feria</span>
        <span className="font-mono text-zinc-300">{commodity.points}</span>
      </div>
    </div>
  );
};

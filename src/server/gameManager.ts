import { v4 as uuidv4 } from 'uuid';
import {
  Card,
  Commodity,
  COMMODITIES,
  PlayerPrivate,
  PlayerPublic,
  RoomState,
  RoomStatus,
  ClientHandState,
} from '../types/game';
import {
  dbSaveRoom,
  dbSavePlayer,
  dbUpdatePlayerScore,
  dbRecordRoundWin,
  dbRecordTrade,
} from './db';

export class GameManager {
  private rooms: Map<string, RoomState> = new Map();
  private privatePlayers: Map<string, Map<string, PlayerPrivate>> = new Map(); // roomCode -> (playerId -> PlayerPrivate)
  private tradeLocks: Set<string> = new Set(); // to prevent race conditions during trades
  private offerTimers: Map<string, NodeJS.Timeout> = new Map(); // key: roomCode:playerId -> Timeout

  // Generate 6-char room code (e.g., PULGAS, VINTAG)
  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public createRoom(params: {
    nickname: string;
    avatar: string;
    roomName?: string;
    targetScore?: number;
    socketId: string;
  }): { roomCode: string; player: PlayerPrivate } {
    let roomCode = this.generateRoomCode();
    while (this.rooms.has(roomCode)) {
      roomCode = this.generateRoomCode();
    }

    const playerId = uuidv4();
    const token = uuidv4();
    const name = params.roomName?.trim() || `Mercado #${roomCode}`;
    const targetScore = params.targetScore || 300;

    const privatePlayer: PlayerPrivate = {
      id: playerId,
      token,
      nickname: params.nickname.trim() || 'Comerciante',
      avatar: params.avatar || '🎩',
      score: 0,
      isHost: true,
      isConnected: true,
      cardCount: 0,
      activeOfferCount: null,
      hand: [],
      socketId: params.socketId,
    };

    const publicPlayer: PlayerPublic = this.toPublicPlayer(privatePlayer);

    const room: RoomState = {
      code: roomCode,
      name,
      hostId: playerId,
      status: 'LOBBY',
      maxPlayers: 8,
      targetScore,
      roundNumber: 1,
      players: { [playerId]: publicPlayer },
      offers: {},
      activeCommodities: [],
      recentTrade: null,
      roundWinner: null,
      overallWinner: null,
    };

    this.rooms.set(roomCode, room);
    const roomPlayersMap = new Map<string, PlayerPrivate>();
    roomPlayersMap.set(playerId, privatePlayer);
    this.privatePlayers.set(roomCode, roomPlayersMap);

    // Save to DB asynchronously
    dbSaveRoom(roomCode, name, playerId, targetScore);
    dbSavePlayer(playerId, roomCode, privatePlayer.nickname, privatePlayer.avatar, token, true);

    return { roomCode, player: privatePlayer };
  }

  public joinRoom(params: {
    roomCode: string;
    nickname: string;
    avatar: string;
    socketId: string;
  }): { success: boolean; room?: RoomState; player?: PlayerPrivate; error?: string } {
    const code = params.roomCode.toUpperCase().trim();
    const room = this.rooms.get(code);

    if (!room) {
      return { success: false, error: 'La sala especificada no existe.' };
    }

    if (room.status !== 'LOBBY') {
      return { success: false, error: 'La partida ya ha comenzado en esta sala.' };
    }

    const playerList = Object.values(room.players);
    if (playerList.length >= room.maxPlayers) {
      return { success: false, error: 'La sala está llena (máximo 8 jugadores).' };
    }

    const playerId = uuidv4();
    const token = uuidv4();

    const privatePlayer: PlayerPrivate = {
      id: playerId,
      token,
      nickname: params.nickname.trim() || `Comerciante ${playerList.length + 1}`,
      avatar: params.avatar || '🏺',
      score: 0,
      isHost: false,
      isConnected: true,
      cardCount: 0,
      activeOfferCount: null,
      hand: [],
      socketId: params.socketId,
    };

    const roomPlayersMap = this.privatePlayers.get(code)!;
    roomPlayersMap.set(playerId, privatePlayer);

    room.players[playerId] = this.toPublicPlayer(privatePlayer);

    dbSavePlayer(playerId, code, privatePlayer.nickname, privatePlayer.avatar, token, false);

    return { success: true, room, player: privatePlayer };
  }

  public reconnectPlayer(params: {
    roomCode: string;
    playerId: string;
    token: string;
    socketId: string;
  }): { success: boolean; room?: RoomState; handState?: ClientHandState; error?: string } {
    const code = params.roomCode.toUpperCase().trim();
    const room = this.rooms.get(code);
    if (!room) return { success: false, error: 'Sala no encontrada.' };

    const roomPlayersMap = this.privatePlayers.get(code);
    if (!roomPlayersMap) return { success: false, error: 'Jugadores no encontrados.' };

    const player = roomPlayersMap.get(params.playerId);
    if (!player || player.token !== params.token) {
      return { success: false, error: 'Token de autenticación de jugador inválido.' };
    }

    player.socketId = params.socketId;
    player.isConnected = true;

    if (room.players[params.playerId]) {
      room.players[params.playerId].isConnected = true;
    }

    return {
      success: true,
      room,
      handState: this.getClientHandState(player),
    };
  }

  public handleDisconnect(socketId: string): { roomCode?: string; player?: PlayerPrivate } | null {
    for (const [roomCode, playerMap] of this.privatePlayers.entries()) {
      for (const [playerId, player] of playerMap.entries()) {
        if (player.socketId === socketId) {
          player.isConnected = false;
          const room = this.rooms.get(roomCode);
          if (room) {
            if (room.players[playerId]) {
              room.players[playerId].isConnected = false;
              room.players[playerId].activeOfferCount = null;
            }
            delete room.offers[playerId];
            player.activeOfferCount = null;
            player.currentOfferCardIds = undefined;

            return { roomCode, player };
          }
        }
      }
    }
    return null;
  }

  public startGame(roomCode: string, requesterId: string): { success: boolean; error?: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: 'Sala no encontrada.' };
    if (room.hostId !== requesterId) return { success: false, error: 'Solo el anfitrión puede iniciar la partida.' };

    const playerList = Object.values(room.players);
    if (playerList.length < 2) {
      return { success: false, error: 'Se necesitan al menos 2 jugadores para jugar.' };
    }

    this.startRound(roomCode);
    return { success: true };
  }

  public startRound(roomCode: string) {
    const room = this.rooms.get(roomCode);
    const playerMap = this.privatePlayers.get(roomCode);
    if (!room || !playerMap) return;

    const players = Array.from(playerMap.values());
    const numPlayers = players.length;

    // Pick numPlayers distinct commodities
    const shuffledCommodities = [...COMMODITIES].sort(() => Math.random() - 0.5);
    const activeSuits = shuffledCommodities.slice(0, numPlayers);
    room.activeCommodities = activeSuits;

    // Generate deck: 9 cards per suit
    const deck: Card[] = [];
    for (const suit of activeSuits) {
      for (let i = 0; i < 9; i++) {
        deck.push({
          id: uuidv4(),
          suit: suit.id,
        });
      }
    }

    // Cryptographic-grade Fisher-Yates multi-pass shuffle
    const crypto = require('crypto');
    for (let pass = 0; pass < 5; pass++) {
      for (let i = deck.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }

    // Deal 9 cards to each player
    players.forEach((player, index) => {
      player.hand = deck.slice(index * 9, (index + 1) * 9);
      player.cardCount = player.hand.length;
      player.activeOfferCount = null;
      player.currentOfferCardIds = undefined;

      if (room.players[player.id]) {
        room.players[player.id].cardCount = player.cardCount;
        room.players[player.id].activeOfferCount = null;
      }
    });

    room.status = 'TRADING';
    room.offers = {};
    room.recentTrade = null;
    room.roundWinner = null;
  }

  public makeOffer(
    roomCode: string,
    playerId: string,
    cardIds: string[],
    onExpire?: () => void
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(roomCode);
    const playerMap = this.privatePlayers.get(roomCode);
    if (!room || !playerMap) return { success: false, error: 'Sala no encontrada.' };

    if (room.status !== 'TRADING') {
      return { success: false, error: 'El mercado no está abierto para intercambios.' };
    }

    const player = playerMap.get(playerId);
    if (!player) return { success: false, error: 'Jugador no encontrado.' };

    if (!Array.isArray(cardIds) || cardIds.length < 1 || cardIds.length > 4) {
      return { success: false, error: 'Debes ofrecer entre 1 y 4 cartas.' };
    }

    // Verify player actually holds these cards
    const offeredCards: Card[] = [];
    for (const id of cardIds) {
      const found = player.hand.find((c) => c.id === id);
      if (!found) {
        return { success: false, error: 'Una o más cartas no están en tu mano.' };
      }
      offeredCards.push(found);
    }

    // ANTI-CHEAT RULE: All offered cards MUST be of the same commodity!
    const firstSuit = offeredCards[0].suit;
    const allSameSuit = offeredCards.every((c) => c.suit === firstSuit);
    if (!allSameSuit) {
      return {
        success: false,
        error: '¡Regla de Feria de Pulgas! Todas las cartas en una oferta deben ser del mismo objeto.',
      };
    }

    // Clear previous timer if player already had one
    const timerKey = `${roomCode}:${playerId}`;
    if (this.offerTimers.has(timerKey)) {
      clearTimeout(this.offerTimers.get(timerKey)!);
      this.offerTimers.delete(timerKey);
    }

    // Set offer
    player.currentOfferCardIds = cardIds;
    player.activeOfferCount = cardIds.length;

    room.offers[playerId] = {
      playerId,
      quantity: cardIds.length,
      timestamp: Date.now(),
    };

    if (room.players[playerId]) {
      room.players[playerId].activeOfferCount = cardIds.length;
    }

    // Schedule 5-second automatic expiration
    const timeout = setTimeout(() => {
      this.cancelOffer(roomCode, playerId);
      this.offerTimers.delete(timerKey);
      if (onExpire) {
        onExpire();
      }
    }, 5000);

    this.offerTimers.set(timerKey, timeout);

    return { success: true };
  }

  public cancelOffer(roomCode: string, playerId: string): { success: boolean; error?: string } {
    const timerKey = `${roomCode}:${playerId}`;
    if (this.offerTimers.has(timerKey)) {
      clearTimeout(this.offerTimers.get(timerKey)!);
      this.offerTimers.delete(timerKey);
    }

    const room = this.rooms.get(roomCode);
    const playerMap = this.privatePlayers.get(roomCode);
    if (!room || !playerMap) return { success: false, error: 'Sala no encontrada.' };

    const player = playerMap.get(playerId);
    if (player) {
      player.currentOfferCardIds = undefined;
      player.activeOfferCount = null;
    }

    delete room.offers[playerId];
    if (room.players[playerId]) {
      room.players[playerId].activeOfferCount = null;
    }

    return { success: true };
  }

  public acceptTrade(
    roomCode: string,
    initiatorId: string,
    targetPlayerId: string
  ): {
    success: boolean;
    error?: string;
    trade?: {
      player1Id: string;
      player1Name: string;
      player2Id: string;
      player2Name: string;
      count: number;
    };
  } {
    const room = this.rooms.get(roomCode);
    const playerMap = this.privatePlayers.get(roomCode);
    if (!room || !playerMap) return { success: false, error: 'Sala no encontrada.' };

    if (room.status !== 'TRADING') {
      return { success: false, error: 'El mercado no está abierto.' };
    }

    if (initiatorId === targetPlayerId) {
      return { success: false, error: 'No puedes comerciar contigo mismo.' };
    }

    const lockKey = `${roomCode}:${[initiatorId, targetPlayerId].sort().join('-')}`;
    if (this.tradeLocks.has(lockKey)) {
      return { success: false, error: 'Intercambio en curso, intenta de nuevo.' };
    }
    this.tradeLocks.add(lockKey);

    try {
      const p1 = playerMap.get(initiatorId);
      const p2 = playerMap.get(targetPlayerId);

      if (!p1 || !p2) {
        return { success: false, error: 'Uno de los comerciantes no fue encontrado.' };
      }

      if (!p1.currentOfferCardIds || !p2.currentOfferCardIds) {
        return { success: false, error: 'Ambos jugadores deben tener una oferta activa.' };
      }

      if (p1.currentOfferCardIds.length !== p2.currentOfferCardIds.length) {
        return {
          success: false,
          error: `Las cantidades no coinciden (${p1.currentOfferCardIds.length} vs ${p2.currentOfferCardIds.length}).`,
        };
      }

      const cardCount = p1.currentOfferCardIds.length;

      // Extract cards
      const p1CardsToGive = p1.hand.filter((c) => p1.currentOfferCardIds!.includes(c.id));
      const p2CardsToGive = p2.hand.filter((c) => p2.currentOfferCardIds!.includes(c.id));

      if (p1CardsToGive.length !== cardCount || p2CardsToGive.length !== cardCount) {
        return { success: false, error: 'Error en la disponibilidad de cartas para el intercambio.' };
      }

      // Execute atomic swap
      p1.hand = p1.hand.filter((c) => !p1.currentOfferCardIds!.includes(c.id)).concat(p2CardsToGive);
      p2.hand = p2.hand.filter((c) => !p2.currentOfferCardIds!.includes(c.id)).concat(p1CardsToGive);

      // Clear active offers & active timers
      const timerKey1 = `${roomCode}:${p1.id}`;
      const timerKey2 = `${roomCode}:${p2.id}`;
      if (this.offerTimers.has(timerKey1)) {
        clearTimeout(this.offerTimers.get(timerKey1)!);
        this.offerTimers.delete(timerKey1);
      }
      if (this.offerTimers.has(timerKey2)) {
        clearTimeout(this.offerTimers.get(timerKey2)!);
        this.offerTimers.delete(timerKey2);
      }

      p1.currentOfferCardIds = undefined;
      p1.activeOfferCount = null;
      p2.currentOfferCardIds = undefined;
      p2.activeOfferCount = null;

      delete room.offers[p1.id];
      delete room.offers[p2.id];

      if (room.players[p1.id]) room.players[p1.id].activeOfferCount = null;
      if (room.players[p2.id]) room.players[p2.id].activeOfferCount = null;

      const tradeData = {
        player1Id: p1.id,
        player1Name: p1.nickname,
        player2Id: p2.id,
        player2Name: p2.nickname,
        count: cardCount,
      };

      room.recentTrade = {
        id: uuidv4(),
        player1Name: p1.nickname,
        player2Name: p2.nickname,
        cardCount,
      };

      // Async DB record
      dbRecordTrade(uuidv4(), roomCode, p1.id, p2.id, cardCount);

      return { success: true, trade: tradeData };
    } finally {
      this.tradeLocks.delete(lockKey);
    }
  }

  public claimWin(
    roomCode: string,
    playerId: string
  ): {
    success: boolean;
    error?: string;
    roundWinner?: RoomState['roundWinner'];
    overallWinner?: RoomState['overallWinner'];
  } {
    const room = this.rooms.get(roomCode);
    const playerMap = this.privatePlayers.get(roomCode);
    if (!room || !playerMap) return { success: false, error: 'Sala no encontrada.' };

    if (room.status !== 'TRADING') {
      return { success: false, error: 'No se puede reclamar victoria fuera de la fase de mercado.' };
    }

    const player = playerMap.get(playerId);
    if (!player) return { success: false, error: 'Jugador no encontrado.' };

    if (player.hand.length !== 9) {
      return { success: false, error: `Tu mano tiene ${player.hand.length} cartas, se requieren 9.` };
    }

    // Check if all 9 cards are the same suit
    const winningSuitId = player.hand[0].suit;
    const isWinner = player.hand.every((c) => c.suit === winningSuitId);

    if (!isWinner) {
      return {
        success: false,
        error: '¡Aún no tienes 9 cartas del mismo objeto! Sigue intercambiando en el mercado.',
      };
    }

    const winningCommodity = COMMODITIES.find((c) => c.id === winningSuitId) || {
      id: winningSuitId,
      name: 'Objeto Antiguo',
      points: 50,
      icon: '🏺',
      bgGradient: 'from-amber-600/30 to-amber-900/40',
      borderColor: 'border-amber-500',
      accentColor: '#f59e0b',
      description: 'Objeto completado',
    };

    // Calculate score
    const pointsAwarded = winningCommodity.points;
    player.score += pointsAwarded;
    if (room.players[player.id]) {
      room.players[player.id].score = player.score;
    }
    dbUpdatePlayerScore(player.id, player.score);

    // Build transparency hand summary
    const handsSummary: Record<string, { nickname: string; hand: Card[] }> = {};
    for (const [pId, p] of playerMap.entries()) {
      handsSummary[pId] = {
        nickname: p.nickname,
        hand: [...p.hand],
      };
    }

    const roundWinnerData = {
      playerId: player.id,
      nickname: player.nickname,
      commodity: winningCommodity,
      points: pointsAwarded,
      handsSummary,
    };

    room.roundWinner = roundWinnerData;

    // Record in DB
    const roundId = uuidv4();
    dbRecordRoundWin(
      roundId,
      roomCode,
      room.roundNumber,
      player.id,
      player.nickname,
      winningCommodity.name,
      pointsAwarded
    );

    // Check target score for overall winner
    if (player.score >= room.targetScore) {
      room.status = 'GAME_OVER';
      room.overallWinner = {
        playerId: player.id,
        nickname: player.nickname,
        score: player.score,
      };
    } else {
      room.status = 'ROUND_OVER';
    }

    // Cancel all open offers
    room.offers = {};
    for (const p of playerMap.values()) {
      p.activeOfferCount = null;
      p.currentOfferCardIds = undefined;
      if (room.players[p.id]) {
        room.players[p.id].activeOfferCount = null;
      }
    }

    return {
      success: true,
      roundWinner: roundWinnerData,
      overallWinner: room.overallWinner,
    };
  }

  public nextRound(roomCode: string, requesterId: string): { success: boolean; error?: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: 'Sala no encontrada.' };
    if (room.hostId !== requesterId) return { success: false, error: 'Solo el anfitrión puede iniciar la siguiente ronda.' };

    room.roundNumber += 1;
    this.startRound(roomCode);
    return { success: true };
  }

  public resetToLobby(roomCode: string, requesterId: string): { success: boolean; error?: string } {
    const room = this.rooms.get(roomCode);
    const playerMap = this.privatePlayers.get(roomCode);
    if (!room || !playerMap) return { success: false, error: 'Sala no encontrada.' };
    if (room.hostId !== requesterId) return { success: false, error: 'Solo el anfitrión puede reiniciar al lobby.' };

    room.status = 'LOBBY';
    room.roundNumber = 1;
    room.roundWinner = null;
    room.overallWinner = null;
    room.recentTrade = null;
    room.offers = {};

    for (const p of playerMap.values()) {
      p.score = 0;
      p.hand = [];
      p.cardCount = 0;
      p.activeOfferCount = null;
      p.currentOfferCardIds = undefined;
      dbUpdatePlayerScore(p.id, 0);

      if (room.players[p.id]) {
        room.players[p.id].score = 0;
        room.players[p.id].cardCount = 0;
        room.players[p.id].activeOfferCount = null;
      }
    }

    return { success: true };
  }

  public getRoom(roomCode: string): RoomState | undefined {
    return this.rooms.get(roomCode);
  }

  public getPlayer(roomCode: string, playerId: string): PlayerPrivate | undefined {
    return this.privatePlayers.get(roomCode)?.get(playerId);
  }

  public getClientHandState(player: PlayerPrivate): ClientHandState {
    const counts: Record<string, number> = {};
    for (const card of player.hand) {
      counts[card.suit] = (counts[card.suit] || 0) + 1;
    }

    let canClaimWin = false;
    let winningSuit: string | undefined = undefined;

    for (const [suit, count] of Object.entries(counts)) {
      if (count === 9) {
        canClaimWin = true;
        winningSuit = suit;
        break;
      }
    }

    return {
      hand: player.hand,
      counts,
      canClaimWin,
      winningSuit,
    };
  }

  private toPublicPlayer(privatePlayer: PlayerPrivate): PlayerPublic {
    return {
      id: privatePlayer.id,
      nickname: privatePlayer.nickname,
      avatar: privatePlayer.avatar,
      score: privatePlayer.score,
      isHost: privatePlayer.isHost,
      isConnected: privatePlayer.isConnected,
      cardCount: privatePlayer.cardCount,
      activeOfferCount: privatePlayer.activeOfferCount,
    };
  }
}

export const gameManager = new GameManager();

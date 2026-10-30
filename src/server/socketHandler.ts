import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types/game';
import { gameManager } from './gameManager';

export function setupSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>
) {
  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    // Current bound player & room
    let currentRoomCode: string | null = null;
    let currentPlayerId: string | null = null;

    // CREATE ROOM
    socket.on('room:create', (data, callback) => {
      try {
        const { roomCode, player } = gameManager.createRoom({
          nickname: data.nickname,
          avatar: data.avatar,
          roomName: data.roomName,
          targetScore: data.targetScore,
          socketId: socket.id,
        });

        currentRoomCode = roomCode;
        currentPlayerId = player.id;
        socket.join(roomCode);

        const room = gameManager.getRoom(roomCode);
        if (room) {
          io.to(roomCode).emit('room:updated', room);
        }

        callback({ success: true, roomCode, player });
      } catch (err: any) {
        callback({ success: false, error: err.message || 'Error al crear la sala' });
      }
    });

    // JOIN ROOM
    socket.on('room:join', (data, callback) => {
      try {
        const result = gameManager.joinRoom({
          roomCode: data.roomCode,
          nickname: data.nickname,
          avatar: data.avatar,
          socketId: socket.id,
        });

        if (!result.success || !result.player || !result.room) {
          return callback({ success: false, error: result.error || 'Error al unirse a la sala' });
        }

        currentRoomCode = result.room.code;
        currentPlayerId = result.player.id;
        socket.join(result.room.code);

        // Notify room members
        io.to(result.room.code).emit('room:updated', result.room);

        callback({
          success: true,
          room: result.room,
          player: result.player,
        });
      } catch (err: any) {
        callback({ success: false, error: err.message || 'Error inesperado al unirse' });
      }
    });

    // RECONNECT
    socket.on('room:reconnect', (data, callback) => {
      try {
        const result = gameManager.reconnectPlayer({
          roomCode: data.roomCode,
          playerId: data.playerId,
          token: data.token,
          socketId: socket.id,
        });

        if (!result.success || !result.room || !result.handState) {
          return callback({ success: false, error: result.error || 'Error en la reconexión' });
        }

        currentRoomCode = result.room.code;
        currentPlayerId = data.playerId;
        socket.join(result.room.code);

        io.to(result.room.code).emit('room:updated', result.room);
        const player = gameManager.getPlayer(result.room.code, data.playerId);
        if (player) {
          io.to(result.room.code).emit('player:reconnected', {
            playerId: player.id,
            nickname: player.nickname,
          });
        }

        callback({
          success: true,
          room: result.room,
          handState: result.handState,
        });
      } catch (err: any) {
        callback({ success: false, error: err.message || 'Error al reconectar' });
      }
    });

    // START GAME
    socket.on('game:start', (callback) => {
      if (!currentRoomCode || !currentPlayerId) {
        return callback({ success: false, error: 'No estás en una sala activa.' });
      }

      const res = gameManager.startGame(currentRoomCode, currentPlayerId);
      if (!res.success) {
        return callback({ success: false, error: res.error });
      }

      const room = gameManager.getRoom(currentRoomCode);
      if (!room) return callback({ success: false, error: 'Sala no encontrada.' });

      io.to(currentRoomCode).emit('round:start', { roundNumber: room.roundNumber });
      io.to(currentRoomCode).emit('room:updated', room);

      // Send private hands to each connected player
      Object.keys(room.players).forEach((pId) => {
        const privateP = gameManager.getPlayer(currentRoomCode!, pId);
        if (privateP && privateP.socketId) {
          const handState = gameManager.getClientHandState(privateP);
          io.to(privateP.socketId).emit('hand:updated', handState);
        }
      });

      callback({ success: true });
    });

    // MAKE OFFER
    socket.on('trade:offer', (data, callback) => {
      if (!currentRoomCode || !currentPlayerId) {
        return callback({ success: false, error: 'No estás en una sala activa.' });
      }

      const rCode = currentRoomCode;
      const res = gameManager.makeOffer(rCode, currentPlayerId, data.cardIds, () => {
        // Callback fired after 5 seconds of expiration
        const roomAfterExpiry = gameManager.getRoom(rCode);
        if (roomAfterExpiry) {
          io.to(rCode).emit('room:updated', roomAfterExpiry);
        }
      });
      if (!res.success) {
        return callback({ success: false, error: res.error });
      }

      const room = gameManager.getRoom(currentRoomCode);
      if (room) {
        io.to(currentRoomCode).emit('room:updated', room);
        io.to(currentRoomCode).emit('shout:sound', {
          playerId: currentPlayerId,
          count: data.cardIds.length,
        });
      }

      callback({ success: true });
    });

    // CANCEL OFFER
    socket.on('trade:cancel', (callback) => {
      if (!currentRoomCode || !currentPlayerId) {
        return callback({ success: false, error: 'No estás en una sala activa.' });
      }

      const res = gameManager.cancelOffer(currentRoomCode, currentPlayerId);
      if (!res.success) {
        return callback({ success: false, error: res.error });
      }

      const room = gameManager.getRoom(currentRoomCode);
      if (room) {
        io.to(currentRoomCode).emit('room:updated', room);
      }

      callback({ success: true });
    });

    // ACCEPT TRADE
    socket.on('trade:accept', (data, callback) => {
      if (!currentRoomCode || !currentPlayerId) {
        return callback({ success: false, error: 'No estás en una sala activa.' });
      }

      const res = gameManager.acceptTrade(currentRoomCode, currentPlayerId, data.targetPlayerId);
      if (!res.success || !res.trade) {
        return callback({ success: false, error: res.error || 'No se pudo realizar el intercambio.' });
      }

      const room = gameManager.getRoom(currentRoomCode);
      if (room) {
        // Broadcast trade execution announcement
        io.to(currentRoomCode).emit('trade:executed', res.trade);
        io.to(currentRoomCode).emit('room:updated', room);

        // Update hands for both participants privately
        const p1 = gameManager.getPlayer(currentRoomCode, res.trade.player1Id);
        const p2 = gameManager.getPlayer(currentRoomCode, res.trade.player2Id);

        if (p1 && p1.socketId) {
          io.to(p1.socketId).emit('hand:updated', gameManager.getClientHandState(p1));
        }
        if (p2 && p2.socketId) {
          io.to(p2.socketId).emit('hand:updated', gameManager.getClientHandState(p2));
        }
      }

      callback({ success: true });
    });

    // CLAIM WIN
    socket.on('game:claim_win', (callback) => {
      if (!currentRoomCode || !currentPlayerId) {
        return callback({ success: false, error: 'No estás en una sala activa.' });
      }

      const res = gameManager.claimWin(currentRoomCode, currentPlayerId);
      if (!res.success) {
        return callback({ success: false, error: res.error });
      }

      const room = gameManager.getRoom(currentRoomCode);
      if (room) {
        io.to(currentRoomCode).emit('round:ended', res.roundWinner);
        if (res.overallWinner) {
          io.to(currentRoomCode).emit('game:ended', res.overallWinner);
        }
        io.to(currentRoomCode).emit('room:updated', room);
      }

      callback({ success: true });
    });

    // NEXT ROUND
    socket.on('game:next_round', (callback) => {
      if (!currentRoomCode || !currentPlayerId) {
        return callback({ success: false, error: 'No estás en una sala activa.' });
      }

      const res = gameManager.nextRound(currentRoomCode, currentPlayerId);
      if (!res.success) {
        return callback({ success: false, error: res.error });
      }

      const room = gameManager.getRoom(currentRoomCode);
      if (room) {
        io.to(currentRoomCode).emit('round:start', { roundNumber: room.roundNumber });
        io.to(currentRoomCode).emit('room:updated', room);

        Object.keys(room.players).forEach((pId) => {
          const p = gameManager.getPlayer(currentRoomCode!, pId);
          if (p && p.socketId) {
            io.to(p.socketId).emit('hand:updated', gameManager.getClientHandState(p));
          }
        });
      }

      callback({ success: true });
    });

    // RESET TO LOBBY
    socket.on('game:reset_to_lobby', (callback) => {
      if (!currentRoomCode || !currentPlayerId) {
        return callback({ success: false, error: 'No estás en una sala activa.' });
      }

      const res = gameManager.resetToLobby(currentRoomCode, currentPlayerId);
      if (!res.success) {
        return callback({ success: false, error: res.error });
      }

      const room = gameManager.getRoom(currentRoomCode);
      if (room) {
        io.to(currentRoomCode).emit('room:updated', room);
      }

      callback({ success: true });
    });

    // WEBRTC VOICE SIGNALING (Peer-to-Peer Relay)
    socket.on('voice:signal', (data) => {
      if (!currentRoomCode || !currentPlayerId) return;

      const targetPlayer = gameManager.getPlayer(currentRoomCode, data.toPlayerId);
      if (targetPlayer && targetPlayer.socketId) {
        io.to(targetPlayer.socketId).emit('voice:signal', {
          fromPlayerId: currentPlayerId,
          signal: data.signal,
        });
      }
    });

    // WEBRTC VOICE STATUS (Mute / Speaking indicator)
    socket.on('voice:status', (data) => {
      if (!currentRoomCode || !currentPlayerId) return;

      const room = gameManager.getRoom(currentRoomCode);
      if (room && room.players[currentPlayerId]) {
        room.players[currentPlayerId].isMuted = data.isMuted;
        room.players[currentPlayerId].isSpeaking = data.isSpeaking;
        io.to(currentRoomCode).emit('room:updated', room);
      }
    });

    // DISCONNECT
    socket.on('disconnect', () => {
      const result = gameManager.handleDisconnect(socket.id);
      if (result && result.roomCode) {
        const room = gameManager.getRoom(result.roomCode);
        if (room) {
          io.to(result.roomCode).emit('room:updated', room);
          if (result.player) {
            io.to(result.roomCode).emit('player:disconnected', {
              playerId: result.player.id,
              nickname: result.player.nickname,
            });
          }
        }
      }
    });
  });
}

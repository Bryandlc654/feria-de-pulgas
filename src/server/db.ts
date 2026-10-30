import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'feria_de_pulgas',
};

let pool: mysql.Pool | null = null;
let isDbReady = false;

export async function initDatabase(): Promise<boolean> {
  try {
    // 1. First connect without specifying database to ensure it exists
    const rootConn = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
    });

    await rootConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await rootConn.end();

    // 2. Connect with pool to the target database
    pool = mysql.createPool({
      ...DB_CONFIG,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // 3. Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(10) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        host_id VARCHAR(64) NOT NULL,
        max_players INT DEFAULT 8,
        target_score INT DEFAULT 500,
        status VARCHAR(20) DEFAULT 'WAITING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS players (
        id VARCHAR(64) PRIMARY KEY,
        room_code VARCHAR(10) NOT NULL,
        nickname VARCHAR(50) NOT NULL,
        avatar VARCHAR(50) DEFAULT '🎩',
        token VARCHAR(64) NOT NULL,
        score INT DEFAULT 0,
        is_host BOOLEAN DEFAULT FALSE,
        is_connected BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_room (room_code)
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_rounds (
        id VARCHAR(64) PRIMARY KEY,
        room_code VARCHAR(10) NOT NULL,
        round_number INT DEFAULT 1,
        winner_id VARCHAR(64) NULL,
        winner_nickname VARCHAR(50) NULL,
        winning_commodity VARCHAR(50) NULL,
        points_awarded INT DEFAULT 0,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        finished_at TIMESTAMP NULL,
        INDEX idx_round_room (room_code)
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id VARCHAR(64) PRIMARY KEY,
        room_code VARCHAR(10) NOT NULL,
        player1_id VARCHAR(64) NOT NULL,
        player2_id VARCHAR(64) NOT NULL,
        card_count INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_trade_room (room_code)
      ) ENGINE=InnoDB;
    `);

    isDbReady = true;
    console.log('✅ MySQL Database initialized successfully and tables ready.');
    return true;
  } catch (error) {
    console.warn('⚠️ Warning: MySQL connection failed. Running in in-memory mode for gameplay.', error);
    isDbReady = false;
    return false;
  }
}

export async function dbSaveRoom(code: string, name: string, hostId: string, targetScore: number) {
  if (!pool || !isDbReady) return;
  try {
    await pool.query(
      `INSERT INTO rooms (id, code, name, host_id, target_score, status)
       VALUES (?, ?, ?, ?, ?, 'WAITING')
       ON DUPLICATE KEY UPDATE name = VALUES(name), host_id = VALUES(host_id), target_score = VALUES(target_score)`,
      [code, code, name, hostId, targetScore]
    );
  } catch (e) {
    console.error('Error in dbSaveRoom:', e);
  }
}

export async function dbSavePlayer(id: string, roomCode: string, nickname: string, avatar: string, token: string, isHost: boolean) {
  if (!pool || !isDbReady) return;
  try {
    await pool.query(
      `INSERT INTO players (id, room_code, nickname, avatar, token, score, is_host, is_connected)
       VALUES (?, ?, ?, ?, ?, 0, ?, 1)
       ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), avatar = VALUES(avatar), is_connected = 1`,
      [id, roomCode, nickname, avatar, token, isHost ? 1 : 0]
    );
  } catch (e) {
    console.error('Error in dbSavePlayer:', e);
  }
}

export async function dbUpdatePlayerScore(id: string, newScore: number) {
  if (!pool || !isDbReady) return;
  try {
    await pool.query(`UPDATE players SET score = ? WHERE id = ?`, [newScore, id]);
  } catch (e) {
    console.error('Error in dbUpdatePlayerScore:', e);
  }
}

export async function dbRecordRoundWin(
  roundId: string,
  roomCode: string,
  roundNumber: number,
  winnerId: string,
  winnerNickname: string,
  winningCommodity: string,
  pointsAwarded: number
) {
  if (!pool || !isDbReady) return;
  try {
    await pool.query(
      `INSERT INTO game_rounds (id, room_code, round_number, winner_id, winner_nickname, winning_commodity, points_awarded, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [roundId, roomCode, roundNumber, winnerId, winnerNickname, winningCommodity, pointsAwarded]
    );
  } catch (e) {
    console.error('Error in dbRecordRoundWin:', e);
  }
}

export async function dbRecordTrade(
  tradeId: string,
  roomCode: string,
  player1Id: string,
  player2Id: string,
  cardCount: number
) {
  if (!pool || !isDbReady) return;
  try {
    await pool.query(
      `INSERT INTO trades (id, room_code, player1_id, player2_id, card_count)
       VALUES (?, ?, ?, ?, ?)`,
      [tradeId, roomCode, player1Id, player2Id, cardCount]
    );
  } catch (e) {
    console.error('Error in dbRecordTrade:', e);
  }
}

export { pool, isDbReady };

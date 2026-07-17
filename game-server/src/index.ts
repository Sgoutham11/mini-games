/**
 * Game Server Entry Point
 * Express + Socket.IO + Redis
 */

import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import { RedisService } from './redis/RedisService';
import { SocketManager } from './socket/SocketManager';
import { BingoSocketManager } from './bingo/BingoSocketManager';
import { createAuthMiddleware } from './middleware/AuthMiddleware';
import { LoggerService } from './logger/LoggerService';

// Configuration from environment
const PORT = parseInt(process.env.PORT || '3001', 10);
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const DEV_MODE = process.env.NODE_ENV !== 'production';
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(',');
const SPRING_BOOT_URL = process.env.SPRING_BOOT_URL || 'http://localhost:7071';


async function main() {
  console.log('='.repeat(50));
  console.log('  SOS Game Server');
  console.log(`  Mode: ${DEV_MODE ? 'DEVELOPMENT' : 'PRODUCTION'}`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Redis: ${REDIS_URL}`);
  console.log(`  Spring Boot: ${SPRING_BOOT_URL}`);
  console.log('='.repeat(50));
  LoggerService.debugLog('SPRING boot url', SPRING_BOOT_URL);
  LoggerService.debugLog('REDIS  url', REDIS_URL);


  // ─── Express Setup ─────────────────────────────
  const app = express();
  app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'OK',
      service: 'SOS Game Server',
      timestamp: Date.now(),
      uptime: process.uptime(),
    });
  });

  // ─── HTTP Server ───────────────────────────────
  const server = http.createServer(app);

  // ─── Socket.IO Setup ──────────────────────────
  const io = new SocketServer(server, {
    cors: {
      origin: CORS_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Auth middleware
  io.use(createAuthMiddleware(TELEGRAM_BOT_TOKEN, DEV_MODE));

  // ─── Redis Setup ──────────────────────────────
  const redis = new RedisService(REDIS_URL);

  try {
    await redis.connect();
    console.log('[Redis] Connected successfully');
  } catch (error) {
    console.error('[Redis] Connection failed:', error);
    if (!DEV_MODE) process.exit(1);
    console.warn('[Redis] Running without Redis in dev mode — state will not persist');
  }

  // ─── Socket Manager ───────────────────────────
  const socketManager = new SocketManager(io, redis);
  socketManager.initialize();
  const bingoSocketManager = new BingoSocketManager(io, redis);
  bingoSocketManager.initialize();
  console.log('[Socket] Managers initialized');

  // ─── Start Server ─────────────────────────────
  server.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
  });

  // ─── Graceful Shutdown ────────────────────────
  const shutdown = async () => {
    console.log('\n[Server] Shutting down...');
    io.close();
    await redis.disconnect();
    server.close(() => {
      console.log('[Server] Closed');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[Server] Fatal error:', error);
  process.exit(1);
});

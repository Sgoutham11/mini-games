# SOS Multiplayer — Telegram Mini App

Real-time multiplayer SOS game built with **Phaser 3**, **Socket.IO**, **Redis**, and **Spring Boot**.

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│  Phaser Frontend │ ◄──────────────► │  Node Game Server │
│  (Telegram Mini) │                   │  Socket.IO + Redis│
└────────┬────────┘                   └────────┬─────────┘
         │ REST (initData auth)                │
         ▼                                     ▼
┌─────────────────────────────────────────────────────────┐
│              Spring Boot Backend (Oracle DB)            │
│  Users · Matches · History · Leaderboards · Profiles    │
└─────────────────────────────────────────────────────────┘
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Separate Node game server** | Real-time turn sync, timers, and reconnection need low-latency WebSockets — not ideal for Spring Boot |
| **Redis for ephemeral state** | Rooms, game boards, timers, and presence are short-lived; 30-min TTL auto-cleans inactive rooms |
| **Server-authoritative moves** | Online moves validated server-side (turn, cell, room state) — never trust the client |
| **Client-side local/AI modes** | Single player and local multiplayer need no network; shared SOS engine runs in both client and server |
| **Shared TypeScript contracts** | `shared/events.ts` and `shared/enums.ts` keep socket payloads type-safe across frontend and game-server |

## Game Modes

1. **Single Player** — vs AI (Easy/Medium/Hard with minimax)
2. **Local Multiplayer** — 2–4 players, same device
3. **Online Battle** — create/join room with 6-char code, 2–4 players

## Project Structure

```
sos-game/
├── frontend/          # Phaser 3 + Vite + Telegram SDK
│   ├── src/scenes/    # Boot, Menu, Lobby, Game, Result
│   ├── src/game/      # SOS engine + AI (client-side)
│   ├── src/sockets/   # Socket.IO client
│   └── src/telegram/  # Telegram Mini App integration
├── game-server/       # Express + Socket.IO + Redis
│   ├── src/game-engine/
│   ├── src/ai/
│   ├── src/rooms/
│   ├── src/timer/
│   └── src/redis/
├── shared/            # Shared types & enums
└── docker/            # Docker Compose + Dockerfiles

telegram-bot/          # Spring Boot backend (Oracle)
```

## Quick Start

### Prerequisites

- Node.js v20.20.2
- Redis 7+
- Java 17+ (Spring Boot)
- Oracle Database (for persistence)

### 1. Redis

```bash
docker run -d -p 6379:6379 redis:7-alpine
```

### 2. Game Server

```bash
cd sos-game/game-server
npm install
npm run dev
# Listens on http://localhost:3001
```

### 3. Frontend

```bash
cd sos-game/frontend
npm install
npm run dev 
# Opens http://localhost:5173
```

### 4. Spring Boot

```bash
cd telegram-bot
mvn spring-boot:run
# API on http://localhost:7071
```

### Docker (all services)

```bash
cd sos-game/docker
TELEGRAM_BOT_TOKEN=your_token docker compose up --build
```

## Environment Variables

| Variable | Service | Default |
|----------|---------|---------|
| `VITE_API_URL` | Frontend | `http://localhost:7071` |
| `VITE_SOCKET_URL` | Frontend | `http://localhost:3001` |
| `REDIS_URL` | Game Server | `redis://localhost:6379` |
| `TELEGRAM_BOT_TOKEN` | Game Server / Spring | — |
| `PORT` | Game Server | `3001` |

## Redis Schema

| Key | TTL | Content |
|-----|-----|---------|
| `room:{roomCode}` | 30 min | Room state (players, status, grid size) |
| `game:{roomCode}` | 30 min | Full game state (board, scores, turns) |
| `presence:{playerId}` | 2 min | Reconnection data |
| `timer:{roomCode}` | 65 sec | Active turn timer |
| `socket:{playerId}` | 30 min | Socket ID mapping |

## Socket Events

See `shared/events.ts` for full typed contracts.

**Client → Server:** `create_room`, `join_room`, `make_move`, `player_ready`, `leave_room`, `reconnect_game`

**Server → Client:** `room_created`, `player_joined`, `game_started`, `board_updated`, `turn_changed`, `score_updated`, `game_ended`, `timer_updated`, `error_event`

## Spring Boot APIs (different repo : telegram-bot)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/game/player` | Register/update player |
| POST | `/api/game/match/start` | Start match record |
| POST | `/api/game/match/end` | End match + save scores |
| POST | `/api/game/match/move` | Record a move |
| GET | `/api/game/history` | Match history |
| GET | `/api/game/leaderboard` | Top players |
| POST | `/api/game/score` | Save game score (legacy) |

All endpoints require `Authorization: Bearer {telegram_initData}`.

## SOS Rules

- Grid sizes: 5×5, 6×6 (default), 7×7, 10×10
- Letters S and O on empty cells
- SOS detected horizontally, vertically, and diagonally
- Overlapping patterns allowed (e.g. `S O S O S` scores multiple)
- Score = +1 per SOS; scorer gets bonus turn
- Game ends when board is full; highest score wins
- 60-second turn timer (server-managed for online)

## Tests

```bash
# Game server unit tests
cd sos-game/game-server && npm test

# Frontend unit tests
cd sos-game/frontend && npm test
```

## Telegram Mini App Setup

1. Create bot via [@BotFather](https://t.me/BotFather)
2. Set Mini App URL to your frontend deployment
3. Configure `TELEGRAM_BOT_TOKEN` in both game-server and Spring Boot
4. Frontend reads `initData` via `@twa-dev/sdk` for authentication

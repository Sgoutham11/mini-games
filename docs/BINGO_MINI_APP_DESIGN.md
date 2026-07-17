# Bingo Mini App Design Document

## Purpose

Add Bingo as the second game in the Mini Games Telegram Mini App. The existing Bingo implementation lives in the Telegram bot and uses commands, text input, and `CallbackQuery` buttons. The new implementation should keep the same game logic, but move the interaction into Phaser UI using the same design language and workflow patterns already used by SOS.

This document is for approval before implementation. No Phaser game code is changed by this design pass.

## Current Source Logic Reviewed

Old bot implementation:

- `telegram-bot/src/main/java/com/telegram/bot/config/TelegramGameBot.java`
- `telegram-bot/src/main/java/com/telegram/bot/service/BingoCommandHandler.java`
- `telegram-bot/src/main/java/com/telegram/bot/service/BingoGameService.java`
- `telegram-bot/src/main/java/com/telegram/bot/service/BingoBoardService.java`
- `telegram-bot/src/main/java/com/telegram/bot/service/BingoTurnService.java`
- `telegram-bot/src/main/java/com/telegram/bot/entity/GameSession.java`
- `telegram-bot/src/main/java/com/telegram/bot/entity/Player.java`
- `telegram-bot/src/main/java/com/telegram/bot/entity/PlayerBoard.java`
- `telegram-bot/src/main/java/com/telegram/bot/entity/GameMove.java`
- `telegram-bot/src/main/java/com/telegram/bot/utils/BingoEnums.java`

Existing Mini App patterns:

- `mini-games/frontend/src/scenes/GameSelectionScene.ts`
- `mini-games/frontend/src/scenes/MenuScene.ts`
- `mini-games/frontend/src/scenes/OnlineLobbyScene.ts`
- `mini-games/frontend/src/scenes/WaitingRoomScene.ts`
- `mini-games/frontend/src/scenes/GameScene.ts`
- `mini-games/frontend/src/scenes/ResultScene.ts`
- `mini-games/frontend/src/components/NeonUI.ts`
- `mini-games/game-server/src/socket/SocketManager.ts`
- `mini-games/game-server/src/rooms/RoomManager.ts`
- `mini-games/shared/events.ts`

## Existing Bot Bingo Rules

The active bot Bingo is a multiplayer number-selection game, not the separate simple 1-75 caller demo in `BingoGame.java`.

Core rules:

- A room is created with a unique host code.
- Players join before the game starts.
- Maximum players in bot logic: 6.
- Minimum players to start: 2.
- Host can add bot players.
- Host selects board size:
  - 5 x 5: header `BINGO`, points to win `5`
  - 6 x 6: header `BINGOS`, points to win `6`
  - 7 x 7: header `BINGOES`, points to win `7`
  - 8 x 8: header `BINGOESS`, points to win `8`
- Each player receives a shuffled board containing numbers `1` through `size * size`.
- Players take turns selecting one available number.
- A selected number is global:
  - It is stored once in move history.
  - It is marked on every player's board if that number exists there.
  - Since every board uses the same number pool, every selected number exists on every board, but at different positions.
- A player earns 1 point for every new completed pattern:
  - Any full row.
  - Any full column.
  - Main diagonal.
  - Opposite diagonal.
- Completed patterns are tracked per player so the same row/column/diagonal is not counted twice.
- A player wins when their score reaches `boardSize`.
- If multiple boards complete patterns on the same move, the bot processes the current player first to avoid race-condition ambiguity.
- When a player reaches winning score:
  - Status becomes `WON`.
  - `finishRank` is assigned.
  - The player is removed from future active turns.
- The game ends when only one `PLAYING` player remains.
  - The remaining active player becomes `LOST`.
  - All previous `WON` players appear in ranking order.
- Timer behavior in bot:
  - 15 seconds per turn.
  - On timeout, a random available number is auto-selected for the current player.
  - Bot players also use auto-move logic.

## Bot Workflow To Mini App Workflow Mapping

| Telegram Bot Flow | Mini App Phaser Flow |
| --- | --- |
| `/bingo` welcome menu | `GameSelectionScene` card: `Bingo` |
| `bingo_play` | New `BingoModeScene` or `BingoMenuScene` |
| `Create Game` | New Bingo online lobby create tab |
| `Join Party` | New Bingo online lobby join tab |
| Text input player name | Reuse `NeonUI.createInput` name input |
| Text input host id | Reuse room code input |
| Lobby message with players | New Bingo waiting room scene |
| Add Bot callback | Add Bot button in Bingo waiting room |
| Start Game callback | Host start button |
| Board size callback | Bingo board size selector |
| Inline keyboard board | Phaser Bingo board grid |
| Callback number selection | Tap/click number cell |
| Edit message updates | Socket-driven Phaser state updates |
| Game over message | Bingo result scene |

## Game Selection Screen Change

Update `GameSelectionScene` local `games` array:

- Existing `SOS` card remains unchanged.
- Add `Bingo` card:
  - Title: `Bingo`
  - Description: `Turn-based number strategy`
  - Footer: `New game`
  - Scene: `BingoMenuScene`

The card should use the same neon card layout as SOS. No Bingo behavior should be implemented inside `GameSelectionScene`; it should only route.

## Proposed New Frontend Scenes

### 1. `BingoMenuScene`

Purpose: Bingo-specific mode selection screen.

Recommended title:

- Heading: `Choose Bingo Mode`
- Subtitle: `Create a party, join friends, or play locally`

Initial mode cards:

- `Online Party`
  - Create/join room with friends.
  - Route: `BingoOnlineLobbyScene`
- `Local Multiplayer`
  - Optional phase if we want same-device Bingo.
  - Route: `BingoLocalSetupScene`
- `Single Player`
  - Optional later phase if we want bot-only/AI.
  - Route: `BingoSingleSetupScene`

For first Bingo release, I recommend implementing `Online Party` first because the bot Bingo is already room-based and multiplayer. Local/single can be documented as future unless you confirm they are required now.

Back button:

- Goes to `GameSelectionScene`.

### 2. `BingoOnlineLobbyScene`

Purpose: Create or join a Bingo room.

Layout should match SOS `OnlineLobbyScene`:

- Dark panel.
- Create / Join segmented buttons.
- Player name input with max length validation, same as SOS.
- Create mode:
  - Player count selector: `2`, `3`, `4`, `5`, `6`.
  - Board size selector: `5`, `6`, `7`, `8`.
  - Helper label showing winning word:
    - `5 = BINGO`
    - `6 = BINGOS`
    - `7 = BINGOES`
    - `8 = BINGOESS`
- Join mode:
  - Room code input.
  - Theme-matched validation for invalid code, full room, already started.

Buttons:

- `Back` -> `BingoMenuScene`
- `Create Room` or `Join Room`

### 3. `BingoWaitingRoomScene`

Purpose: Show room code, joined players, host actions.

Use SOS `WaitingRoomScene` as the visual base, but add Bingo-specific controls:

- Room code large cyan text.
- Player count: `n / maxPlayers`.
- Board size badge.
- Header word badge, for example `BINGO`, `BINGOS`.
- Player list with host indicator and bot indicator.
- Host-only actions:
  - `Add Bot`
  - `Start Game`
- Non-host:
  - Waiting text.
- All users:
  - `Leave Room`

Start validation:

- Need at least 2 active players.
- Start disabled or validation shown until minimum players exist.

### 4. `BingoGameScene`

Purpose: Main Bingo board interaction.

Do not reuse SOS `GameScene` directly. SOS board state stores S/O cells and SOS scored lines. Bingo needs:

- Per-player numbered boards.
- Global selected number list.
- Marked cells per player.
- Completed patterns per player.
- Ranking/status changes as players win.

Main layout:

- Top controls:
  - Home icon.
  - Optional refresh/reconnect icon only if useful.
- Score/progress section:
  - Player cards with:
    - Name, truncated safely.
    - Status: `TURN`, `WAITING`, `WON`, `LOST`, `BOT`, `QUIT`.
    - Progress word:
      - Example: `B I N G O`
      - Earned letters highlighted in player color.
      - Remaining letters muted.
    - Numeric score: `3 / 5`.
- Timer:
  - Use SOS timer style.
  - Proposed Mini App default: keep SOS online timer at 60s unless you want exact bot behavior.
  - If matching bot exactly, use 15s for Bingo.
- Last move strip:
  - `Last: 14 selected by Goutham`
  - If timeout: `Auto-selected 14 for Goutham`
- Board:
  - Square numbered grid, size 5 to 8.
  - Each cell displays number.
  - Unselected: dark cell with subtle border.
  - Selected/marked: glow fill, check indicator, or struck style.
  - New pattern cells animate briefly when a row/column/diagonal completes.
- Turn restrictions:
  - Only current active player can select.
  - Non-turn players can view but cannot select.
  - Already selected cells are disabled.

Tap/click behavior:

- Player taps an unmarked number on their own visible board.
- Client sends selected number, not row/col.
- Server validates:
  - Room exists.
  - Game is playing.
  - Player is active.
  - It is their turn.
  - Number is in range.
  - Number was not already selected.

### 5. `BingoResultScene`

Purpose: Final Bingo ranking and board summary.

This should not reuse SOS `ResultScene` unless it is generalized, because Bingo result needs finish rank and statuses.

Display:

- Heading: `Bingo Results`
- Winner/ranking list:
  - Rank 1, Rank 2, etc.
  - Player name.
  - Score.
  - Status: `WON`, `LOST`, `QUIT`.
- Optional board preview for the current player:
  - Final marked numbers.
- Buttons:
  - `Play Again` -> `BingoMenuScene`
  - `Home` -> `GameSelectionScene`

## Proposed Shared Types

Add Bingo-specific types instead of forcing them into SOS `GameState`.

Recommended in `shared/events.ts` or a new `shared/bingo-events.ts`:

```ts
export type GameKind = 'sos' | 'bingo';

export type BingoPlayerStatus = 'WAITING' | 'PLAYING' | 'WON' | 'LOST' | 'QUIT';

export interface BingoPlayerInfo {
  id: string;
  name: string;
  telegramId?: number;
  color: string;
  status: BingoPlayerStatus;
  isBot: boolean;
  isReady: boolean;
  isConnected: boolean;
  isHost: boolean;
  score: number;
  finishRank?: number;
}

export interface BingoPlayerBoard {
  playerId: string;
  board: number[][];
  marked: boolean[][];
  completedPatterns: string[];
}

export interface BingoMoveInfo {
  selectedNumber: number;
  playerId: string;
  moveOrder: number;
  autoSelected: boolean;
  timestamp: number;
}

export interface BingoRoomState {
  roomCode: string;
  gameKind: 'bingo';
  status: 'waiting' | 'playing' | 'finished';
  boardSize: 5 | 6 | 7 | 8;
  maxPlayers: number;
  players: BingoPlayerInfo[];
  hostId: string;
  createdAt: number;
}

export interface BingoGameState {
  roomCode: string;
  boardSize: 5 | 6 | 7 | 8;
  header: 'BINGO' | 'BINGOS' | 'BINGOES' | 'BINGOESS';
  pointsToWin: number;
  players: BingoPlayerInfo[];
  boards: Record<string, BingoPlayerBoard>;
  selectedNumbers: number[];
  moves: BingoMoveInfo[];
  currentPlayerId: string;
  turnNumber: number;
  startedAt: number;
}
```

## Proposed Socket Events

Option A: Extend existing generic events with `gameKind`.

Pros:

- Less socket wiring.
- Reuses `create_room`, `join_room`, `player_ready`, `leave_room`.

Cons:

- SOS and Bingo payloads are different.
- Type unions become more complex.

Option B: Add Bingo-specific events.

Pros:

- Clear separation.
- Safer implementation.
- Easier to test without breaking SOS.

Cons:

- More event names.

Recommended: Option B for first implementation.

Client to server:

- `bingo_create_room`
- `bingo_join_room`
- `bingo_add_bot`
- `bingo_start_game`
- `bingo_select_number`
- `bingo_leave_room`
- `bingo_reconnect_game`

Server to client:

- `bingo_room_created`
- `bingo_player_joined`
- `bingo_room_update`
- `bingo_game_started`
- `bingo_board_updated`
- `bingo_turn_changed`
- `bingo_score_updated`
- `bingo_player_status_updated`
- `bingo_game_ended`
- `bingo_timer_updated`
- `bingo_error`

## Backend/Game Server Design

Add a Bingo engine parallel to `SOSEngine`.

Recommended files:

- `game-server/src/bingo/BingoEngine.ts`
- `game-server/src/bingo/BingoRoomManager.ts` or extend existing `RoomManager` with `gameKind`
- `game-server/src/bingo/BingoSocketManager.ts` or route from existing `SocketManager`
- `frontend/src/game/BingoEngine.ts` for local/single future support if required
- `frontend/src/components/BingoBoard.ts`

### Bingo Engine Responsibilities

Functions:

- `getBingoHeader(size)`
- `getPointsToWin(size)`
- `generateBingoBoard(size)`
- `createEmptyMarked(size)`
- `markNumberOnBoard(boardState, selectedNumber)`
- `checkNewPatterns(boardState)`
- `selectNumber(gameState, playerId, selectedNumber, autoSelected = false)`
- `getNextPlayingPlayerId(gameState, currentPlayerId)`
- `getAvailableNumbers(gameState)`
- `isGameOver(gameState)`
- `buildRankings(gameState)`

Important: preserve current bot race-condition behavior by processing the current player's board first when a move is made, then processing other players.

### Redis State

Use Redis for short-lived room/game state like SOS.

Suggested keys:

- `bingo:room:{roomCode}`
- `bingo:game:{roomCode}`
- `bingo:timer:{roomCode}`
- Existing socket/player mapping keys can be reused if they are not SOS-specific.

Keep room and game state in sync:

- When player joins/leaves, update room.
- When game starts, snapshot players from room into game.
- When player quits/disconnects, update both room and game.
- When game ends, delete game state and mark room finished.

## Quit/Disconnect Handling

Use the same behavior already implemented recently for SOS multiplayer, adapted to Bingo statuses.

Rules:

- If active player leaves during Bingo:
  - Mark status `QUIT`.
  - Remove from future turns.
  - Keep visible in result list.
- If only one active `PLAYING` player remains:
  - End the game.
  - Remaining active player should be final remaining player.
  - Depending on existing Bingo ranking rule, mark them `LOST` if winners already exist, or winner by quit if everyone else quit.
- If host leaves:
  - Assign host to another active player if room is still active.
  - Continue if at least 2 active players remain.

Open design question:

- The old bot marks the last remaining playing user as `LOST` after other players reach Bingo. For quit-only endings, we should decide whether the remaining player is `WON` or `LOST`. I recommend:
  - Normal Bingo completion: last remaining player is `LOST`.
  - Quit/disconnect ending with no completed winners: remaining active player is `WON`.

## UI Design Pattern

Follow SOS:

- `Theme.bg` dark background.
- `NeonUI.createTitle`.
- `NeonUI.createSubtitle`.
- `NeonUI.drawPanel`.
- Same rounded dark cards.
- Same haptic calls:
  - Light haptic for navigation/buttons.
  - Medium haptic for successful number selection.
  - Error haptic for invalid move, if Telegram service supports it.

Bingo accent:

- Keep cyan/green/orange/purple player colors from SOS.
- Board cells should glow in current player color on hover.
- Completed pattern animation should use the owning player's color.

## First Release Scope Recommendation

Recommended first release:

- Add Bingo card to `Choose Your Game`.
- Implement Bingo online party mode:
  - Create room.
  - Join room.
  - Waiting room.
  - Add bot.
  - Board size 5 to 8.
  - Server-authoritative selection.
  - Timer auto-select.
  - Rankings/result screen.
- Keep local/single Bingo as future unless explicitly required now.

Reason:

- The old bot Bingo is multiplayer room-first.
- Online flow already has room/socket/timer architecture from SOS.
- This keeps the first Bingo implementation focused and easier to verify.

## Implementation Phases

### Phase 1: Shared Types and Engine

- Add Bingo enums/types.
- Add Bingo engine tests:
  - Board generation.
  - Mark selected number.
  - Row/column/diagonal pattern scoring.
  - No duplicate pattern points.
  - Current player processed first.
  - Winner/rank assignment.
  - Next turn skips `WON`, `LOST`, `QUIT`, disconnected.

### Phase 2: Backend Socket/Redis

- Add Bingo room create/join/start/select events.
- Store Bingo room/game state in Redis.
- Implement timer auto-select.
- Implement add bot.
- Implement quit/disconnect.
- Broadcast room/game updates.

### Phase 3: Frontend Scenes

- Add `BingoMenuScene`.
- Add `BingoOnlineLobbyScene`.
- Add `BingoWaitingRoomScene`.
- Add `BingoGameScene`.
- Add `BingoResultScene`.
- Add `BingoBoard` component.
- Register scenes in `main.ts`.
- Add Bingo card in `GameSelectionScene`.

### Phase 4: Polish and Validation

- Mobile layout pass for 5x5 through 8x8.
- Name length validation.
- Room code validation.
- Disabled states for non-turn player.
- Timer warning color.
- Pattern completion animations.
- Result ranking polish.

## Test Plan

### Engine Tests

- Generate board size 5, 6, 7, 8.
- Board contains exactly `1..size*size`.
- Selecting a number marks it on all boards.
- A completed row adds 1 point once.
- A completed column adds 1 point once.
- Diagonal patterns add points.
- A move that completes multiple patterns adds multiple points.
- Same completed pattern is not counted twice.
- Player reaches `pointsToWin` and becomes `WON`.
- Last active player becomes `LOST` in normal game completion.
- Turn order skips `WON`, `LOST`, `QUIT`, and disconnected players.
- Auto-select picks only available numbers.

### Backend Tests

- Create Bingo room.
- Join Bingo room.
- Reject invalid room code.
- Reject full room.
- Reject join after game start.
- Add bot until max player count.
- Start requires at least 2 players.
- Select number only on current player's turn.
- Reject already selected number.
- Timeout auto-selects and advances turn.
- Quit/disconnect updates room and game state.
- Game-ended payload includes players, scores, status, and ranks.

### Frontend Manual Tests

- `Choose Your Game` shows `SOS` and `Bingo`.
- Clicking `Bingo` opens Bingo mode screen.
- Back returns to `Choose Your Game`.
- Create Bingo room with player count and board size.
- Join Bingo room from another client.
- Add bot from waiting room.
- Start game.
- Current player can select a number.
- Other players cannot select out of turn.
- Selected numbers mark on every player board.
- Completed pattern increments progress word.
- Timer updates.
- Result screen shows rankings and statuses.
- SOS flow still works unchanged.

## Open Questions For Confirmation

1. Should Bingo first release include only online party mode, or also local/single modes now?
2. Should Bingo timer match old bot exactly at 15 seconds, or match SOS online timer at 60 seconds?
3. Should max Bingo players remain 6 from the bot, or match SOS max 4?
4. Should bot players be included in the first Mini App Bingo release?
5. For quit-only endings, should the last remaining active player be shown as `WON` even if they did not complete the Bingo word?


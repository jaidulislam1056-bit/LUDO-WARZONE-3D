import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type TeamColor = 'red' | 'blue' | 'green' | 'yellow';

interface RoomPlayer {
  id: string;
  name: string;
  team: TeamColor;
  ready: boolean;
  connected: boolean;
  ws?: WebSocket;
}

interface GameRoom {
  code: string;
  hostId: string;
  isPublic: boolean;
  mode: string;
  status: 'lobby' | 'playing' | 'finished';
  players: RoomPlayer[];
  currentTurnTeam: TeamColor;
  turnPhase: 'DICE_PHASE' | 'MOVE_PHASE' | 'ACTION_PHASE';
  lastDiceValue: number | null;
  stateSnapshot: Record<string, unknown> | null;
  createdAt: number;
}

const rooms = new Map<string, GameRoom>();
const TEAM_ORDER: TeamColor[] = ['red', 'blue', 'green', 'yellow'];

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'WZ-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function sanitizeRoom(room: GameRoom) {
  return {
    code: room.code,
    hostId: room.hostId,
    isPublic: room.isPublic,
    mode: room.mode,
    status: room.status,
    currentTurnTeam: room.currentTurnTeam,
    turnPhase: room.turnPhase,
    lastDiceValue: room.lastDiceValue,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      ready: p.ready,
      connected: p.connected,
    })),
  };
}

function broadcastToRoom(room: GameRoom, message: Record<string, unknown>, excludeId?: string) {
  const payload = JSON.stringify(message);
  for (const player of room.players) {
    if (player.id !== excludeId && player.ws && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(payload);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  // REST API for active rooms inspection
  app.get('/api/rooms', (_req, res) => {
    const publicRooms = Array.from(rooms.values())
      .filter((r) => r.isPublic && r.status === 'lobby' && r.players.length < 4)
      .map(sanitizeRoom);
    res.json({
      online: true,
      activeRoomsCount: rooms.size,
      publicRooms,
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    let boundRoomCode: string | null = null;
    let boundPlayerId: string | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        const { type } = msg;

        if (type === 'room:create') {
          const playerId = String(msg.playerId || `p_${Date.now()}`);
          const playerName = String(msg.playerName || 'Commander').slice(0, 32);
          const isPublic = Boolean(msg.isPublic);
          const mode = String(msg.mode || 'classic');
          const preferredTeam: TeamColor = TEAM_ORDER.includes(msg.team) ? msg.team : 'red';

          const code = generateRoomCode();
          const newRoom: GameRoom = {
            code,
            hostId: playerId,
            isPublic,
            mode,
            status: 'lobby',
            players: [
              {
                id: playerId,
                name: playerName,
                team: preferredTeam,
                ready: true,
                connected: true,
                ws,
              },
            ],
            currentTurnTeam: 'red',
            turnPhase: 'DICE_PHASE',
            lastDiceValue: null,
            stateSnapshot: null,
            createdAt: Date.now(),
          };

          rooms.set(code, newRoom);
          boundRoomCode = code;
          boundPlayerId = playerId;

          ws.send(
            JSON.stringify({
              type: 'room:joined',
              room: sanitizeRoom(newRoom),
              playerId,
            }),
          );
          return;
        }

        if (type === 'room:join' || type === 'room:matchmake') {
          const playerId = String(msg.playerId || `p_${Date.now()}`);
          const playerName = String(msg.playerName || 'Commander').slice(0, 32);
          let targetRoom: GameRoom | undefined;

          if (type === 'room:join') {
            const code = String(msg.code || '').toUpperCase().trim();
            targetRoom = rooms.get(code);
            if (!targetRoom) {
              ws.send(JSON.stringify({ type: 'room:error', message: `Room ${code} not found.` }));
              return;
            }
          } else {
            // Public matchmaking: find open public room or create one
            targetRoom = Array.from(rooms.values()).find(
              (r) => r.isPublic && r.status === 'lobby' && r.players.length < 4,
            );
            if (!targetRoom) {
              const code = generateRoomCode();
              targetRoom = {
                code,
                hostId: playerId,
                isPublic: true,
                mode: String(msg.mode || 'classic'),
                status: 'lobby',
                players: [],
                currentTurnTeam: 'red',
                turnPhase: 'DICE_PHASE',
                lastDiceValue: null,
                stateSnapshot: null,
                createdAt: Date.now(),
              };
              rooms.set(code, targetRoom);
            }
          }

          // Check reconnection first
          const existingPlayer = targetRoom.players.find((p) => p.id === playerId);
          if (existingPlayer) {
            existingPlayer.connected = true;
            existingPlayer.ws = ws;
            boundRoomCode = targetRoom.code;
            boundPlayerId = playerId;
            ws.send(
              JSON.stringify({
                type: 'room:joined',
                room: sanitizeRoom(targetRoom),
                playerId,
                stateSnapshot: targetRoom.stateSnapshot,
              }),
            );
            broadcastToRoom(targetRoom, {
              type: 'room:updated',
              room: sanitizeRoom(targetRoom),
            });
            return;
          }

          if (targetRoom.players.length >= 4) {
            ws.send(JSON.stringify({ type: 'room:error', message: 'Room is already full (4/4).' }));
            return;
          }

          const takenTeams = new Set(targetRoom.players.map((p) => p.team));
          const availableTeam = TEAM_ORDER.find((t) => !takenTeams.has(t)) || 'blue';

          targetRoom.players.push({
            id: playerId,
            name: playerName,
            team: availableTeam,
            ready: targetRoom.players.length === 0,
            connected: true,
            ws,
          });

          boundRoomCode = targetRoom.code;
          boundPlayerId = playerId;

          ws.send(
            JSON.stringify({
              type: 'room:joined',
              room: sanitizeRoom(targetRoom),
              playerId,
            }),
          );
          broadcastToRoom(
            targetRoom,
            {
              type: 'room:updated',
              room: sanitizeRoom(targetRoom),
            },
            playerId,
          );
          return;
        }

        if (!boundRoomCode || !boundPlayerId) return;
        const room = rooms.get(boundRoomCode);
        if (!room) return;
        const player = room.players.find((p) => p.id === boundPlayerId);
        if (!player) return;

        if (type === 'room:ready') {
          player.ready = Boolean(msg.ready);
          broadcastToRoom(room, { type: 'room:updated', room: sanitizeRoom(room) });
          return;
        }

        if (type === 'room:team') {
          const desiredTeam: TeamColor = msg.team;
          if (
            TEAM_ORDER.includes(desiredTeam) &&
            !room.players.some((p) => p.id !== player.id && p.team === desiredTeam)
          ) {
            player.team = desiredTeam;
            broadcastToRoom(room, { type: 'room:updated', room: sanitizeRoom(room) });
          }
          return;
        }

        if (type === 'room:start') {
          if (room.hostId !== player.id) return;
          room.status = 'playing';
          room.currentTurnTeam = room.players[0]?.team || 'red';
          room.turnPhase = 'DICE_PHASE';
          broadcastToRoom(room, {
            type: 'match:started',
            room: sanitizeRoom(room),
          });
          return;
        }

        // Authoritative Dice Roll on the Server
        if (type === 'game:roll_dice') {
          const diceValue = Math.floor(Math.random() * 6) + 1;
          room.lastDiceValue = diceValue;
          room.turnPhase = 'MOVE_PHASE';
          broadcastToRoom(room, {
            type: 'game:dice_rolled',
            playerId: player.id,
            team: player.team,
            diceValue,
          });
          return;
        }

        // Synchronize Move, Combat & State Snapshot across connected clients
        if (
          type === 'game:move_soldier' ||
          type === 'game:combat_action' ||
          type === 'game:end_turn' ||
          type === 'game:state_sync'
        ) {
          if (msg.stateSnapshot) {
            room.stateSnapshot = msg.stateSnapshot;
          }
          if (type === 'game:end_turn' && msg.nextTeam) {
            room.currentTurnTeam = msg.nextTeam;
            room.turnPhase = 'DICE_PHASE';
          }
          broadcastToRoom(
            room,
            {
              ...msg,
              senderId: player.id,
            },
            player.id,
          );
          return;
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      if (!boundRoomCode || !boundPlayerId) return;
      const room = rooms.get(boundRoomCode);
      if (!room) return;
      const player = room.players.find((p) => p.id === boundPlayerId);
      if (player) {
        player.connected = false;
        player.ws = undefined;
      }
      const anyConnected = room.players.some((p) => p.connected);
      if (!anyConnected) {
        // Keep room alive for 60s to allow reconnection
        setTimeout(() => {
          const r = rooms.get(boundRoomCode!);
          if (r && !r.players.some((p) => p.connected)) {
            rooms.delete(boundRoomCode!);
          }
        }, 60000);
      } else {
        broadcastToRoom(room, { type: 'room:updated', room: sanitizeRoom(room) });
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LUDO WARZONE 3D Server & WebSocket Arena listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

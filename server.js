const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

const connectedClients = new Map();

wss.on('connection', (ws) => {
  console.log('Client connected');
  // Assign a unique ID to each client (for simplicity, using a random number)
  const clientId = Math.random().toString(36).substring(2, 15);
  connectedClients.set(ws, { id: clientId, x: 0, y: 0, health: 100 }); // Initial player data

  // Send the client its assigned ID
  ws.send(JSON.stringify({ type: 'init', id: clientId }));

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    if (data.type === 'playerUpdate') {
      const playerState = connectedClients.get(ws);
      if (playerState) {
        playerState.x = data.player.x;
        playerState.y = data.player.y;
        playerState.health = data.player.health;
        connectedClients.set(ws, playerState);
      }
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    connectedClients.delete(ws);
  });
});

// Game state broadcast loop
setInterval(() => {
  const allPlayers = [];
  connectedClients.forEach((playerState) => {
    allPlayers.push(playerState);
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'gameState', players: allPlayers }));
    }
  });
}, 1000 / 30); // Broadcast at 30 FPS

server.listen(3000, () => {
  console.log('Server is listening on port 3000');
});

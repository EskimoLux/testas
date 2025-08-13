const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

const ws = new WebSocket(`ws://${window.location.hostname}:3000`);

let myPlayerId = null; // To store the ID assigned by the server
const otherPlayers = [];

ws.onopen = () => {
  console.log('Connected to WebSocket server');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'init') {
    myPlayerId = data.id;
    player.id = data.id;
    console.log('My player ID is:', myPlayerId);
  } else if (data.type === 'gameState') {
    // Update other players, excluding myself
    otherPlayers.length = 0; // Clear array
    data.players.forEach(p => {
      if (p.id !== myPlayerId) {
        otherPlayers.push(p);
      }
    });
  }
};

ws.onclose = () => {
  console.log('Disconnected from WebSocket server');
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  width: 50,
  height: 50,
  color: 'blue',
  speed: 5,
  health: 100,
  id: null, // Will be assigned by the server
};

const mouse = {
  x: 0,
  y: 0,
};

const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
};

const projectiles = [];
const enemies = [];

let wave = 1;
let enemiesToKill = 10;
let enemiesKilledThisWave = 0;
let waveTimer = 30; // seconds
let gameInterval;
let spawnInterval;

function spawnEnemy() {
  const size = 30;
  let x, y;

  // Randomly spawn enemy off-screen
  if (Math.random() < 0.5) {
    x = Math.random() < 0.5 ? -size : canvas.width + size;
    y = Math.random() * canvas.height;
  } else {
    x = Math.random() * canvas.width;
    y = Math.random() < 0.5 ? -size : canvas.height + size;
  }

  enemies.push({
    x,
    y,
    width: size,
    height: size,
    color: 'green',
    speed: 2,
  });
}

function startWave() {
  enemiesToKill = wave * 10;
  enemiesKilledThisWave = 0;
  waveTimer = 30 + (wave * 5); // Increase time for later waves
  enemies.length = 0; // Clear existing enemies

  clearInterval(spawnInterval);
  spawnInterval = setInterval(spawnEnemy, 1000 - (wave * 50)); // Spawn enemies faster in later waves

  clearInterval(gameInterval);
  gameInterval = setInterval(() => {
    waveTimer--;
    if (waveTimer <= 0) {
      if (enemiesKilledThisWave < enemiesToKill) {
        console.log('Game Over! You failed to kill enough enemies.');
        clearInterval(gameInterval);
        clearInterval(spawnInterval);
        // TODO: Implement game over screen
      } else {
        wave++;
        startWave();
      }
    }
  }, 1000);
}

window.addEventListener('keydown', (e) => {
  if (e.key in keys) {
    keys[e.key] = true;
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key in keys) {
    keys[e.key] = false;
  }
});

window.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

window.addEventListener('click', (e) => {
  const angle = Math.atan2(mouse.y - (player.y + player.height / 2), mouse.x - (player.x + player.width / 2));
  const velocity = {
    x: Math.cos(angle) * 10,
    y: Math.sin(angle) * 10,
  };
  projectiles.push({
    x: player.x + player.width / 2,
    y: player.y + player.height / 2,
    radius: 5,
    color: 'red',
    velocity,
  });
});

function checkCollision(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

function update() {
  if (keys.w) {
    player.y -= player.speed;
  }
  if (keys.a) {
    player.x -= player.speed;
  }
  if (keys.s) {
    player.y += player.speed;
  }
  if (keys.d) {
    player.x += player.speed;
  }

  // Send player data to server only if WebSocket is open
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'playerUpdate',
      player: {
        id: myPlayerId, // Send my ID
        x: player.x,
        y: player.y,
        health: player.health,
      },
    }));
  }

  projectiles.forEach((projectile, pIndex) => {
    projectile.x += projectile.velocity.x;
    projectile.y += projectile.velocity.y;

    // Remove projectiles off-screen
    if (
      projectile.x - projectile.radius < 0 ||
      projectile.x + projectile.radius > canvas.width ||
      projectile.y - projectile.radius < 0 ||
      projectile.y + projectile.radius > canvas.height
    ) {
      projectiles.splice(pIndex, 1);
      return;
    }

    // Projectile-enemy collision
    enemies.forEach((enemy, eIndex) => {
      if (
        checkCollision(
          {
            x: projectile.x - projectile.radius,
            y: projectile.y - projectile.radius,
            width: projectile.radius * 2,
            height: projectile.radius * 2,
          },
          enemy
        )
      ) {
        projectiles.splice(pIndex, 1);
        enemies.splice(eIndex, 1);
        enemiesKilledThisWave++;
      }
    });
  });

  enemies.forEach((enemy, eIndex) => {
    const angle = Math.atan2(
      player.y + player.height / 2 - (enemy.y + enemy.height / 2),
      player.x + player.width / 2 - (enemy.x + enemy.width / 2)
    );
    enemy.x += Math.cos(angle) * enemy.speed;
    enemy.y += Math.sin(angle) * enemy.speed;

    // Player-enemy collision
    if (checkCollision(player, enemy)) {
      player.health -= 10; // Reduce player health
      enemies.splice(eIndex, 1); // Remove enemy on collision
      if (player.health <= 0) {
        console.log('Game Over!');
        clearInterval(gameInterval);
        clearInterval(spawnInterval);
        // TODO: Implement game over screen or restart
      }
    }
  });
}

function draw() {
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw player
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // Draw other players
  otherPlayers.forEach(otherPlayer => {
    ctx.fillStyle = 'purple'; // Different color for other players
    ctx.fillRect(otherPlayer.x, otherPlayer.y, player.width, player.height);
    ctx.fillStyle = 'white';
    ctx.fillText(`Health: ${otherPlayer.health}`, otherPlayer.x, otherPlayer.y - 10);
  });

  // Draw aiming line
  ctx.beginPath();
  ctx.moveTo(player.x + player.width / 2, player.y + player.height / 2);
  ctx.lineTo(mouse.x, mouse.y);
  ctx.strokeStyle = 'white';
  ctx.stroke();

  projectiles.forEach((projectile) => {
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fillStyle = projectile.color;
    ctx.fill();
  });

  enemies.forEach((enemy) => {
    ctx.fillStyle = enemy.color;
    ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
  });

  // Draw UI
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.fillText(`Health: ${player.health}`, 10, 25);
  ctx.fillText(`Wave: ${wave}`, 10, 50);
  ctx.fillText(`Enemies to Kill: ${enemiesToKill - enemiesKilledThisWave}`, 10, 75);
  ctx.fillText(`Time Left: ${waveTimer}`, 10, 100);
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

startWave();
gameLoop();
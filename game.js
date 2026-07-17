import * as THREE from "three";

const ARENA_SIZE = 40;
const PLAYER_SPEED = 0.18;
const TURN_SPEED = 0.045;
const BULLET_SPEED = 0.65;
const FIRE_COOLDOWN = 280;
const ENEMY_SPEED = 0.09;
const ENEMY_FIRE_COOLDOWN = 900;
const DETECTION_RANGE = 22;
const SHOOT_RANGE = 18;

const keys = {};
let gameRunning = false;
let lastShot = 0;
let enemyLastShot = 0;

const bullets = [];
const player = { hp: 100, yaw: 0 };
const enemy = { hp: 100, mesh: null, yaw: 0, patrolTarget: new THREE.Vector3() };

const playerHpEl = document.getElementById("player-hp");
const enemyHpEl = document.getElementById("enemy-hp");
const messageEl = document.getElementById("message");
const overlayEl = document.getElementById("overlay");
const startBtn = document.getElementById("start-btn");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 20, 55);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x6070a0, 0.55));

const sun = new THREE.DirectionalLight(0xfff0dd, 1.1);
sun.position.set(12, 24, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 60;
sun.shadow.camera.left = -25;
sun.shadow.camera.right = 25;
sun.shadow.camera.top = 25;
sun.shadow.camera.bottom = -25;
scene.add(sun);

function createArena() {
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a3044, roughness: 0.85 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3d4560, roughness: 0.7 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x4a5575, roughness: 0.75 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(ARENA_SIZE, 20, 0x556080, 0x3a4058);
  grid.position.y = 0.01;
  scene.add(grid);

  const half = ARENA_SIZE / 2;
  const wallHeight = 4;
  const wallGeo = new THREE.BoxGeometry(ARENA_SIZE, wallHeight, 1);

  const walls = [
    [0, wallHeight / 2, -half],
    [0, wallHeight / 2, half],
    [-half, wallHeight / 2, 0],
    [half, wallHeight / 2, 0],
  ];
  const rotations = [0, 0, Math.PI / 2, Math.PI / 2];

  walls.forEach(([x, y, z], i) => {
    const wall = new THREE.Mesh(wallGeo, i < 2 ? wallMat : wallMat);
    wall.position.set(x, y, z);
    wall.rotation.y = rotations[i];
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
  });

  for (let i = -16; i <= 16; i += 8) {
    for (let j = -16; j <= 16; j += 8) {
      if (Math.abs(i) < 3 && Math.abs(j) < 3) continue;
      const cover = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 2.2), stripeMat);
      cover.position.set(i, 0.8, j);
      cover.castShadow = true;
      cover.receiveShadow = true;
      scene.add(cover);
    }
  }
}

function createEnemy() {
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 1.2, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0xe74c3c, emissive: 0x4a0a0a, roughness: 0.45 })
  );
  body.position.set(0, 1.35, -14);
  body.castShadow = true;
  scene.add(body);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.25, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff3333, emissiveIntensity: 0.6 })
  );
  visor.position.set(0, 1.65, 0.45);
  body.add(visor);

  enemy.mesh = body;
  pickPatrolTarget();
}

function pickPatrolTarget() {
  const margin = 6;
  const range = ARENA_SIZE / 2 - margin;
  enemy.patrolTarget.set(
    THREE.MathUtils.randFloat(-range, range),
    0,
    THREE.MathUtils.randFloat(-range, range)
  );
}

function resetGame() {
  player.hp = 100;
  player.yaw = 0;
  enemy.hp = 100;
  enemyLastShot = 0;
  lastShot = 0;

  camera.position.set(0, 1.6, 8);
  camera.rotation.set(0, 0, 0);

  enemy.mesh.position.set(0, 1.35, -14);
  enemy.mesh.rotation.y = 0;
  enemy.yaw = 0;
  pickPatrolTarget();

  bullets.forEach((b) => scene.remove(b.mesh));
  bullets.length = 0;

  updateHud();
  messageEl.textContent = "";
}

function updateHud() {
  playerHpEl.textContent = Math.max(0, player.hp);
  enemyHpEl.textContent = Math.max(0, enemy.hp);
}

function showMessage(text) {
  messageEl.textContent = text;
}

function endGame(won) {
  gameRunning = false;
  showMessage(won ? "Victory! Press Start to play again." : "Defeated! Press Start to retry.");
  overlayEl.classList.remove("hidden");
}

function shoot(fromPlayer) {
  const now = performance.now();
  if (fromPlayer) {
    if (now - lastShot < FIRE_COOLDOWN) return;
    lastShot = now;
  } else {
    if (now - enemyLastShot < ENEMY_FIRE_COOLDOWN) return;
    enemyLastShot = now;
  }

  const origin = fromPlayer
    ? camera.position.clone()
    : enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0));

  const direction = fromPlayer
    ? new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, player.yaw, 0))
    : new THREE.Vector3(
        camera.position.x - enemy.mesh.position.x,
        0,
        camera.position.z - enemy.mesh.position.z
      ).normalize();

  if (!fromPlayer) {
    direction.y = (camera.position.y - origin.y) * 0.08;
    direction.normalize();
  }

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshStandardMaterial({
      color: fromPlayer ? 0x66ccff : 0xff6644,
      emissive: fromPlayer ? 0x114466 : 0x661100,
      emissiveIntensity: 0.8,
    })
  );
  mesh.position.copy(origin).add(direction.clone().multiplyScalar(0.6));
  mesh.castShadow = true;
  scene.add(mesh);

  bullets.push({
    mesh,
    velocity: direction.multiplyScalar(BULLET_SPEED),
    owner: fromPlayer ? "player" : "enemy",
    life: 120,
  });
}

function clampToArena(pos, radius = 0.5) {
  const limit = ARENA_SIZE / 2 - radius - 0.5;
  pos.x = THREE.MathUtils.clamp(pos.x, -limit, limit);
  pos.z = THREE.MathUtils.clamp(pos.z, -limit, limit);
}

function hitsTarget(bulletPos, targetPos, radius) {
  return bulletPos.distanceTo(targetPos) < radius;
}

function updatePlayer() {
  if (keys.ArrowLeft) player.yaw += TURN_SPEED;
  if (keys.ArrowRight) player.yaw -= TURN_SPEED;

  const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, player.yaw, 0));
  if (keys.ArrowUp) camera.position.add(forward.clone().multiplyScalar(PLAYER_SPEED));
  if (keys.ArrowDown) camera.position.add(forward.clone().multiplyScalar(-PLAYER_SPEED));

  clampToArena(camera.position, 0.5);
  camera.position.y = 1.6;
  camera.rotation.set(0, player.yaw, 0);
}

function updateEnemy() {
  const enemyPos = enemy.mesh.position;
  const playerPos = camera.position;
  const dist = enemyPos.distanceTo(playerPos);

  let targetDir;
  if (dist < DETECTION_RANGE) {
    targetDir = new THREE.Vector3(
      playerPos.x - enemyPos.x,
      0,
      playerPos.z - enemyPos.z
    ).normalize();
    enemyPos.add(targetDir.clone().multiplyScalar(ENEMY_SPEED));

    enemy.yaw = Math.atan2(targetDir.x, targetDir.z);
    enemy.mesh.rotation.y = enemy.yaw + Math.PI;

    if (dist < SHOOT_RANGE) shoot(false);
  } else {
    targetDir = enemy.patrolTarget.clone().sub(enemyPos);
    targetDir.y = 0;
    if (targetDir.length() < 1.2) {
      pickPatrolTarget();
    } else {
      targetDir.normalize();
      enemyPos.add(targetDir.multiplyScalar(ENEMY_SPEED * 0.75));
      enemy.yaw = Math.atan2(targetDir.x, targetDir.z);
      enemy.mesh.rotation.y = enemy.yaw + Math.PI;
    }
  }

  clampToArena(enemyPos, 0.6);
  enemyPos.y = 1.35;
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.mesh.position.add(bullet.velocity);
    bullet.life -= 1;

    const pos = bullet.mesh.position;
    let remove = bullet.life <= 0;

    if (Math.abs(pos.x) > ARENA_SIZE / 2 || Math.abs(pos.z) > ARENA_SIZE / 2) {
      remove = true;
    }

    if (!remove && bullet.owner === "player" && hitsTarget(pos, enemy.mesh.position, 1.0)) {
      enemy.hp -= 20;
      remove = true;
      updateHud();
      if (enemy.hp <= 0) endGame(true);
    }

    if (!remove && bullet.owner === "enemy" && hitsTarget(pos, camera.position, 0.9)) {
      player.hp -= 12;
      remove = true;
      updateHud();
      if (player.hp <= 0) endGame(false);
    }

    if (remove) {
      scene.remove(bullet.mesh);
      bullets.splice(i, 1);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);

  if (gameRunning) {
    updatePlayer();
    updateEnemy();
    updateBullets();
  }

  renderer.render(scene, camera);
}

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;

  if (e.code === "Space") {
    e.preventDefault();
    if (gameRunning) shoot(true);
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

startBtn.addEventListener("click", () => {
  overlayEl.classList.add("hidden");
  resetGame();
  gameRunning = true;
});

createArena();
createEnemy();
updateHud();
animate();

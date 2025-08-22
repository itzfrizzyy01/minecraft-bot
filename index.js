// index.js
const { execSync } = require("child_process");

// Auto-install required packages if missing
try {
  require.resolve("mineflayer");
  require.resolve("mineflayer-pathfinder");
  require.resolve("minecraft-data");
} catch (e) {
  execSync("npm install mineflayer mineflayer-pathfinder minecraft-data", { stdio: "inherit" });
}

const mineflayer = require("mineflayer");
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const mcDataLoader = require("minecraft-data");

let firstJoin = true;
const PASSWORD = "2211133445"; // your AuthMe password

// ---- Tunables ----
const EXPLORE_RADIUS = 32;
const EXPLORE_PAUSE_MS = 1500;
const HOSTILE_DETECT_RADIUS = 12;
const FLEE_DISTANCE = 14;
const ITEM_SCAN_RADIUS = 8;
// ------------------

function createBot() {
  const bot = mineflayer.createBot({
    host: "1deadsteal.aternos.me",
    port: 44112,
    username: "lully",          // <-- Bot name set here
    version: "1.20.4"
  });

  bot.loadPlugin(pathfinder);

  let mcData;
  let movements;
  let exploring = false;
  let fleeing = false;

  bot.on("spawn", () => {
    mcData = mcDataLoader(bot.version);
    movements = new Movements(bot, mcData);

    movements.canDig = true;
    movements.allow1by1towers = true;
    movements.allowParkour = true;
    movements.allowSprinting = true;
    movements.scaffoldingBlocks = new Set([
      mcData.itemsByName?.dirt?.id,
      mcData.itemsByName?.cobblestone?.id,
      mcData.itemsByName?.netherrack?.id,
      mcData.itemsByName?.sand?.id,
      mcData.itemsByName?.gravel?.id
    ].filter(Boolean));

    bot.pathfinder.setMovements(movements);

    if (firstJoin) {
      setTimeout(() => bot.chat(`/register ${PASSWORD} ${PASSWORD}`), 2000);
      firstJoin = false;
    } else {
      setTimeout(() => bot.chat(`/login ${PASSWORD}`), 2000);
    }

    setTimeout(() => {
      startHostileWatcher();
      startItemCollector();
      startExploreLoop();
    }, 4000);
  });

  // --- Exploring ---
  function startExploreLoop() {
    if (exploring) return;
    exploring = true;

    const baseY = Math.floor(bot.entity.position.y);

    const step = async () => {
      if (!bot.entity || fleeing) return setTimeout(step, 1000);

      const dx = (Math.random() * 2 - 1) * EXPLORE_RADIUS;
      const dz = (Math.random() * 2 - 1) * EXPLORE_RADIUS;
      const target = bot.entity.position.offset(dx, 0, dz);

      const goal = new goals.GoalNear(
        Math.floor(target.x),
        baseY,
        Math.floor(target.z),
        1
      );

      try { await bot.pathfinder.goto(goal); } catch {}
      finally { setTimeout(step, EXPLORE_PAUSE_MS); }
    };

    step();
  }

  // --- Hostile avoidance ---
  function startHostileWatcher() {
    const HOSTILES = new Set([
      "Zombie","Husk","Drowned","Skeleton","Stray","Creeper","Spider","Cave Spider",
      "Enderman","Witch","Vindicator","Evoker","Pillager","Ravager","Guardian",
      "Elder Guardian","Slime","Magma Cube","Phantom","Hoglin","Zoglin","Piglin Brute",
      "Wither Skeleton","Blaze","Ghast","Silverfish"
    ]);

    setInterval(async () => {
      if (!bot.entity) return;

      let nearest = null;
      let bestDist = Infinity;
      for (const e of Object.values(bot.entities)) {
        if (!e || e.type !== "mob" || !e.mobType) continue;
        if (!HOSTILES.has(e.mobType)) continue;
        const dist = bot.entity.position.distanceTo(e.position);
        if (dist < bestDist && dist <= HOSTILE_DETECT_RADIUS) {
          bestDist = dist;
          nearest = e;
        }
      }

      if (nearest) {
        fleeing = true;
        try {
          const away = bot.entity.position.minus(nearest.position).scaled(1);
          if (away.distanceTo({ x: 0, y: 0, z: 0 }) < 0.001) {
            away.x = (Math.random() - 0.5);
            away.z = (Math.random() - 0.5);
          }
          const norm = Math.sqrt(away.x * away.x + away.z * away.z) || 1;
          away.x /= norm; away.z /= norm;

          const fleeTarget = bot.entity.position.offset(
            away.x * FLEE_DISTANCE,
            0,
            away.z * FLEE_DISTANCE
          );

          const g = new goals.GoalNear(
            Math.floor(fleeTarget.x),
            Math.floor(bot.entity.position.y),
            Math.floor(fleeTarget.z),
            2
          );
          await bot.pathfinder.goto(g);
        } catch {} finally { fleeing = false; }
      }
    }, 800);
  }

  // --- Item collection ---
  function startItemCollector() {
    setInterval(async () => {
      if (!bot.entity || fleeing) return;

      const items = Object.values(bot.entities).filter(e => {
        if (!e) return false;
        if (e.type !== "object") return false;
        const dist = bot.entity.position.distanceTo(e.position);
        return dist <= ITEM_SCAN_RADIUS;
      });

      if (items.length === 0) return;

      items.sort((a, b) =>
        bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position)
      );
      const target = items[0];

      try {
        const g = new goals.GoalBlock(
          Math.floor(target.position.x),
          Math.floor(target.position.y),
          Math.floor(target.position.z)
        );
        await bot.pathfinder.goto(g);
      } catch {}
    }, 1500);
  }

  bot.on("end", () => setTimeout(createBot, 5000));
  bot.on("kicked", () => {});
  bot.on("error", () => {});

  setInterval(() => {
    if (bot.player) bot.chat("/me exploring...");
  }, 60_000);
}

createBot();

// --- Tiny web server for Render/keepalive ---
const http = require("http");
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running\n");
}).listen(process.env.PORT || 3000);

// index.js
const { execSync } = require("child_process");

// Auto-install required packages if missing
const ensure = (name) => { try { require.resolve(name); } catch { execSync(`npm install ${name}`, { stdio: "inherit" }); } };
["mineflayer","mineflayer-pathfinder","minecraft-data","mineflayer-collectblock","mineflayer-tool","mineflayer-pvp"].forEach(ensure);

// Imports
const mineflayer = require("mineflayer");
const mcDataLoader = require("minecraft-data");
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const { GoalNear, GoalBlock } = goals;
const collectBlock = require("mineflayer-collectblock").plugin;
const toolPlugin = require("mineflayer-tool").plugin;
const pvp = require("mineflayer-pvp").plugin;

// --- Tunables ---
const HOST = "1deadsteal.aternos.me";
const PORT = 44112;
const USERNAME = "lullu";
const VERSION = "1.21";

const PASSWORD = "12335554";           // AuthMe password
const REGISTER_AFTER_MS = 2000;        // first join only
const LOGIN_AFTER_MS = 2000;           // every join

const EXPLORE_RADIUS = 32;
const EXPLORE_PAUSE_MS = 1500;
const ITEM_SCAN_RADIUS = 8;

const HOSTILE_DETECT_RADIUS = 12;
const LOW_HEALTH = 8;                  // 4 hearts
const FLEE_DISTANCE = 16;

const REJOIN_DELAY_MS = 5000;
const RESPAWN_DELAY_MS = 2000;
// ---------------

let didRegisterOnce = false;           // stays true during this process lifetime

function createBot() {
  const bot = mineflayer.createBot({
    host: HOST, port: PORT, username: USERNAME, version: VERSION
  });

  // Plugins
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(collectBlock);
  bot.loadPlugin(toolPlugin);
  bot.loadPlugin(pvp);

  // State
  let mcData, movements;
  let exploring = false;
  let fleeing = false;
  let lastChatReply = 0;

  // ---- Helpers ----
  const log = (...a) => console.log(`[BOT]`, ...a);

  function setUpMovements() {
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
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function sayRandom(to, base) {
    const now = Date.now();
    if (now - lastChatReply < 2000) return; // throttle
    lastChatReply = now;
    const replies = [
      "hello bro", "hey!", "what's up?", "yo!", "hey there", "sup", "hello!"
    ];
    const pick = replies[Math.floor(Math.random() * replies.length)];
    bot.chat(to ? `${to} ${pick}` : (base || pick));
  }

  function nearestHostile() {
    const HOSTILES = new Set([
      "Zombie","Husk","Drowned","Skeleton","Stray","Creeper","Spider","Cave Spider",
      "Enderman","Witch","Vindicator","Evoker","Pillager","Ravager","Guardian",
      "Elder Guardian","Slime","Magma Cube","Phantom","Hoglin","Zoglin","Piglin Brute",
      "Wither Skeleton","Blaze","Ghast","Silverfish"
    ]);
    let nearest = null, best = Infinity;
    for (const e of Object.values(bot.entities)) {
      if (!e || e.type !== "mob" || !e.mobType) continue;
      if (!HOSTILES.has(e.mobType)) continue;
      const d = bot.entity.position.distanceTo(e.position);
      if (d < best) { best = d; nearest = e; }
    }
    return { entity: nearest, dist: best };
  }

  async function fleeFrom(entity) {
    try {
      fleeing = true;
      const pos = bot.entity.position;
      const away = pos.minus(entity.position);
      const norm = Math.hypot(away.x, away.z) || 1;
      const dx = (away.x / norm) * FLEE_DISTANCE;
      const dz = (away.z / norm) * FLEE_DISTANCE;
      const tgt = pos.offset(dx, 0, dz);
      const g = new GoalNear(Math.floor(tgt.x), Math.floor(pos.y), Math.floor(tgt.z), 2);
      await bot.pathfinder.goto(g);
    } catch { /* ignore */ }
    finally { fleeing = false; }
  }

  async function collectNearbyDrops() {
    const items = Object.values(bot.entities).filter(e =>
      e && e.type === "object" && bot.entity.position.distanceTo(e.position) <= ITEM_SCAN_RADIUS
    );
    if (!items.length) return;
    items.sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position));
    const t = items[0];
    try {
      await bot.pathfinder.goto(new GoalBlock(
        Math.floor(t.position.x), Math.floor(t.position.y), Math.floor(t.position.z)
      ));
    } catch {}
  }

  // --- Basic progression: wood -> wooden pick -> stone -> stone tools
  async function ensureBasicTools() {
    const invHas = (name) => bot.inventory.items().some(i => i.name === name);
    const count = (name) => bot.inventory.items().filter(i => i.name === name).reduce((a,b)=>a+b.count,0);

    const craft = async (name, amount) => {
      const item = mcData.itemsByName[name];
      if (!item) return false;
      const recipe = bot.recipesFor(item.id, null, 1, null)[0];
      if (!recipe) return false;
      await bot.craft(recipe, amount, null);
      return true;
    };

    // Get logs
    const needLogs = () => count("oak_log") + count("spruce_log") + count("birch_log") + count("jungle_log") + count("acacia_log") + count("dark_oak_log") + count("mangrove_log") + count("cherry_log") + count("bamboo_block") < 4;
    if (needLogs()) {
      const woodBlocks = bot.findBlocks({
        matching: Object.values(mcData.blocksByName)
          .filter(b => /_log$/.test(b.name) || b.name === "bamboo_block").map(b => b.id),
        maxDistance: 64,
        count: 4
      });
      if (woodBlocks.length) {
        const targets = woodBlocks.slice(0, 4).map(pos => bot.blockAt(pos));
        try { await bot.collectBlock.collect(targets); } catch {}
      }
    }

    // Craft planks & sticks
    const anyLog = bot.inventory.items().find(i => /_log$/.test(i.name) || i.name === "bamboo_block");
    if (anyLog) {
      // Craft some planks
      while (anyLog.count > 0) {
        const planksName = (anyLog.name === "bamboo_block") ? "bamboo_planks" : anyLog.name.replace(/_log$/, "_planks");
        if (!(await craft(planksName, 1))) break;
      }
    }
    // Sticks
    if (count("stick") < 8) { await craft("stick", 4).catch(()=>{}); }

    // Craft crafting table if missing
    if (!invHas("crafting_table")) { await craft("crafting_table", 1).catch(()=>{}); }

    // Place crafting table if needed for tools
    let table = bot.findBlock({ matching: mcData.blocksByName.crafting_table.id, maxDistance: 6 });
    if (!table && invHas("crafting_table")) {
      const ref = bot.inventory.items().find(i => i.name === "crafting_table");
      try {
        await bot.equip(ref, "hand");
        const below = bot.blockAt(bot.entity.position.offset(0, -1, 0));
        const placeAgainst = below && below.boundingBox === "block" ? below : bot.blockAt(bot.entity.position.offset(0, -2, 0));
        if (placeAgainst) await bot.placeBlock(placeAgainst, new mineflayer.vec3(0, 1, 0));
        table = bot.findBlock({ matching: mcData.blocksByName.crafting_table.id, maxDistance: 6 });
      } catch {}
    }

    // Wooden pickaxe
    if (!invHas("wooden_pickaxe")) {
      await bot.pathfinder.goto(new GoalNear(Math.floor(bot.entity.position.x), Math.floor(bot.entity.position.y), Math.floor(bot.entity.position.z), 1)).catch(()=>{});
      await craft("wooden_pickaxe", 1).catch(()=>{});
    }

    // Mine stone to craft stone tools
    const needCobble = () => count("cobblestone") < 6;
    if (needCobble() && invHas("wooden_pickaxe")) {
      const stoneIds = new Set([mcData.blocksByName.stone.id, mcData.blocksByName.deepslate?.id].filter(Boolean));
      const targetStones = bot.findBlocks({ matching: Array.from(stoneIds), maxDistance: 32, count: 6 })
        .map(pos => bot.blockAt(pos));
      if (targetStones.length) {
        await bot.tool.equipForBlock(targetStones[0]); // pickaxe
        try { await bot.collectBlock.collect(targetStones.slice(0, 6)); } catch {}
      }
    }

    // Craft stone pickaxe & stone axe
    if (!invHas("stone_pickaxe")) { await craft("stone_pickaxe", 1).catch(()=>{}); }
    if (!invHas("stone_axe")) { await craft("stone_axe", 1).catch(()=>{}); }
  }

  // --- Explore loop ---
  function startExploreLoop() {
    if (exploring) return;
    exploring = true;
    const baseY = Math.floor(bot.entity.position.y);

    const step = async () => {
      if (!bot.entity) return setTimeout(step, 1000);

      // Fight or flee logic
      const { entity: hostile, dist } = nearestHostile();
      if (hostile && dist <= HOSTILE_DETECT_RADIUS) {
        if (bot.health <= LOW_HEALTH) {
          bot.pvp.stop();
          await fleeFrom(hostile);
        } else {
          // engage
          try { bot.pvp.attack(hostile); } catch {}
        }
      } else {
        bot.pvp.stop();
      }

      // Collect drops nearby
      await collectNearbyDrops();

      // Random roam
      const dx = (Math.random() * 2 - 1) * EXPLORE_RADIUS;
      const dz = (Math.random() * 2 - 1) * EXPLORE_RADIUS;
      const target = bot.entity.position.offset(dx, 0, dz);
      const g = new GoalNear(Math.floor(target.x), baseY, Math.floor(target.z), 1);
      try { await bot.pathfinder.goto(g); } catch {}

      // Occasionally break/place something simple
      try {
        // Break: prefer leaves/logs nearby for wood, else a single stone
        const wantWood = Math.random() < 0.5;
        if (wantWood) {
          const wood = bot.findBlock({
            matching: Object.values(mcData.blocksByName).filter(b => /_log$|_leaves$/.test(b.name)).map(b => b.id),
            maxDistance: 5
          });
          if (wood) {
            await bot.tool.equipForBlock(wood);
            await bot.dig(wood).catch(()=>{});
          }
        } else {
          const stone = bot.findBlock({ matching: [mcData.blocksByName.stone.id], maxDistance: 5 });
          if (stone) {
            await bot.tool.equipForBlock(stone);
            await bot.dig(stone).catch(()=>{});
          }
        }

        // Place scaffold sometimes
        if (Math.random() < 0.2) {
          const dirt = bot.inventory.items().find(i => ["dirt","cobblestone","netherrack","sand","gravel"].includes(i.name));
          if (dirt) {
            await bot.equip(dirt, "hand");
            const below = bot.blockAt(bot.entity.position.offset(0, -1, 0));
            if (below) await bot.placeBlock(below, new mineflayer.vec3(0, 1, 0)).catch(()=>{});
          }
        }
      } catch {}

      setTimeout(step, EXPLORE_PAUSE_MS);
    };

    step();
  }

  // --- Auth flow & lifecycle ---
  bot.on("spawn", async () => {
    setUpMovements();

    // AuthMe: register once (2s after first ever spawn), then always login 2s after spawn
    if (!didRegisterOnce) {
      setTimeout(() => bot.chat(`/register ${PASSWORD}`), REGISTER_AFTER_MS);
      didRegisterOnce = true;
    }
    setTimeout(() => bot.chat(`/login ${PASSWORD}`), LOGIN_AFTER_MS);

    // After a short grace, start behavior
    setTimeout(async () => {
      try { await ensureBasicTools(); } catch {}
      startExploreLoop();
    }, 4000);
  });

  // Auto-respawn
  bot.on("death", async () => {
    log("Died, respawning soon...");
    setTimeout(() => { try { bot.respawn(); } catch {} }, RESPAWN_DELAY_MS);
  });

  // Rejoin on end/kick
  bot.on("end", () => {
    log("Disconnected. Rejoining...");
    setTimeout(createBot, REJOIN_DELAY_MS);
  });
  bot.on("kicked", (reason) => {
    log("Kicked:", reason?.toString?.() || reason);
  });
  bot.on("error", (err) => {
    log("Error:", err?.message || err);
  });

  // Chat logging + friendly replies
  bot.on("message", (msg) => {
    const text = msg.toString();
    console.log("[CHAT]", text);
    // simple friendly echo if someone says our name or greets
    const lower = text.toLowerCase();
    if (lower.includes("lully")) {
      if (/(hi|hello|hey|yo|sup)/.test(lower)) sayRandom(null, "hello bro");
    }
  });

  // Reply when a player chats directly (game event)
  bot.on("chat", (username, message) => {
    if (username === bot.username) return;
    const lower = message.toLowerCase();
    if (/(hi|hello|hey|yo|sup)/.test(lower) && (lower.includes("lully") || Math.random() < 0.2)) {
      sayRandom(`@${username},`, null);
    }
    if (/where are you|what u doing|what are you doing/.test(lower)) {
      bot.chat(`@${username} exploring and grinding :)`);
    }
  });

  // Keepalive: status line each minute
  setInterval(() => {
    if (bot.player) bot.chat("/me exploring...");
  }, 60_000);
}

// Start
createBot();

// Tiny web server for Render/keepalive (optional)
const http = require("http");
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running\n");
}).listen(process.env.PORT || 3000);

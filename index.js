// index.js
const mineflayer = require("mineflayer");
const pathfinder = require("mineflayer-pathfinder").pathfinder;
const { Movements, goals } = require("mineflayer-pathfinder");
const pvp = require("mineflayer-pvp").plugin;
const autoeat = require("mineflayer-auto-eat").plugin;
const collectBlock = require("mineflayer-collectblock").plugin;
const toolPlugin = require("mineflayer-tool").plugin;
const mcDataLoader = require("minecraft-data");

let firstJoin = true; // track only once
const PASSWORD = "2211133445"; // your AuthMe password

function createBot() {
  const bot = mineflayer.createBot({
    host: "1deadsteal.aternos.me", // change if needed
    port: 44112, // change if needed
    username: "mr_troller",
    version: "1.20.4"
  });

  // Load plugins
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);
  bot.loadPlugin(autoeat);
  bot.loadPlugin(collectBlock);
  bot.loadPlugin(toolPlugin);

  // Handle spawn and login/register
  bot.on("spawn", () => {
    if (firstJoin) {
      setTimeout(() => bot.chat(`/register ${PASSWORD} ${PASSWORD}`), 2000);
      firstJoin = false;
    } else {
      setTimeout(() => bot.chat(`/login ${PASSWORD}`), 2000);
    }

    // Start moving after login
    setTimeout(() => startWalkingLoop(bot), 4000);
  });

  // Auto eat food when hungry
  bot.on("health", () => {
    if (bot.food < 14) {
      bot.autoEat.enable();
    } else {
      bot.autoEat.disable();
    }
  });

  // Respawn if killed
  bot.on("death", () => {
    setTimeout(() => bot.chat("/respawn"), 1000);
  });

  // Reconnect if disconnected
  bot.on("end", () => setTimeout(createBot, 5000));
  bot.on("kicked", () => {});
  bot.on("error", () => {});
}

// Movement loop (anti-idle)
function startWalkingLoop(bot) {
  const mcData = mcDataLoader(bot.version);
  const movements = new Movements(bot, mcData);
  bot.pathfinder.setMovements(movements);

  const pos = bot.entity.position.clone();

  async function loop() {
    try {
      let forward = pos.offset(2, 0, 0);
      await bot.pathfinder.goto(new goals.GoalBlock(forward.x, forward.y, forward.z));
      await bot.pathfinder.goto(new goals.GoalBlock(pos.x, pos.y, pos.z));
      setTimeout(loop, 1000);
    } catch {
      setTimeout(loop, 2000);
    }
  }

  loop();
}

createBot();

// --- Tiny web server for Render ---
const http = require("http");
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot is running\n");
  })
  .listen(process.env.PORT || 3000);

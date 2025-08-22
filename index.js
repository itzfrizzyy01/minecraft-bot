const mineflayer = require("mineflayer");
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const { GoalNear, GoalBlock } = goals;
const fs = require("fs");

const botOptions = {
  host: "1deadsteal.aternos.me", // put your server hostname
  port: 44112,                   // your server port, remove line if 25565
  username: "lullu"
};
const PASSWORD = "12335554";
let bot;

// --- Logger ---
const logStream = fs.createWriteStream("bot.log", { flags: "a" });
function log(msg) {
  logStream.write(`[${new Date().toISOString()}] ${msg}\n`);
}
process.on("uncaughtException", err => log(err.stack || err));
process.on("unhandledRejection", err => log(err.stack || err));

function createBot() {
  bot = mineflayer.createBot(botOptions);
  bot.loadPlugin(pathfinder);

  bot.once("spawn", () => {
    const mcData = require("minecraft-data")(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));
  });

  bot.on("message", msg => {
    const text = msg.toString().toLowerCase();
    if (text.includes("isn't registered")) {
      setTimeout(() => bot.chat(`/register ${PASSWORD} ${PASSWORD}`), 2000);
    } else if (text.includes("login")) {
      setTimeout(() => bot.chat(`/login ${PASSWORD}`), 2000);
    } else if (text.includes("logged in")) {
      startWorker();
    }
  });

  bot.on("death", () => {
    bot.once("spawn", () => startWorker());
  });

  bot.on("end", () => {
    setTimeout(createBot, 5000); // auto-rejoin
  });

  bot.on("chat", (username, message) => {
    if (username === bot.username) return;
    const replies = ["hello bro", "yo!", "sup?", "hey friend"];
    if (message.toLowerCase().includes("hello")) {
      bot.chat(replies[Math.floor(Math.random() * replies.length)]);
    }
  });

  bot.on("error", err => log(err.message));
}

function startWorker() {
  setInterval(async () => {
    if (!bot.entity) return;

    const hostile = bot.nearestEntity(e =>
      e.type === "mob" && ["Zombie", "Skeleton", "Creeper", "Spider"].includes(e.name)
    );

    if (hostile && bot.health > 8) {
      try { await bot.pvp.attack(hostile); } catch (err) { log(err); }
      return;
    }

    if (bot.health <= 6 && hostile) {
      const dx = Math.random() * 10 - 5;
      const dz = Math.random() * 10 - 5;
      bot.pathfinder.setGoal(new GoalNear(
        bot.entity.position.x + dx,
        bot.entity.position.y,
        bot.entity.position.z + dz,
        1
      ), true);
      return;
    }

    const logBlock = bot.findBlock({ matching: b => b && b.name.includes("log"), maxDistance: 10 });
    if (logBlock) {
      try {
        await bot.pathfinder.goto(new GoalBlock(logBlock.position.x, logBlock.position.y, logBlock.position.z));
        await bot.dig(logBlock);
      } catch (err) { log(err); }
      return;
    }

    const stone = bot.findBlock({ matching: b => b && b.name.includes("stone"), maxDistance: 10 });
    if (stone) {
      try {
        await bot.pathfinder.goto(new GoalBlock(stone.position.x, stone.position.y, stone.position.z));
        await bot.dig(stone);
      } catch (err) { log(err); }
      return;
    }

    const dx = Math.random() * 20 - 10;
    const dz = Math.random() * 20 - 10;
    try {
      await bot.pathfinder.goto(new GoalNear(
        Math.floor(bot.entity.position.x + dx),
        Math.floor(bot.entity.position.y),
        Math.floor(bot.entity.position.z + dz),
        1
      ));
    } catch (err) { log(err); }
  }, 8000);
}

createBot();

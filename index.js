const mineflayer = require("mineflayer");
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const { GoalNear } = goals;

const botOptions = {
  host: "server_ip",  // put your server IP
  port: 25565,        // your server port
  username: "lullu"
};
const PASSWORD = "12335554";

let bot;

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

  bot.on("kicked", () => {
    setTimeout(createBot, 5000);
  });

  bot.on("chat", (username, message) => {
    if (username === bot.username) return;
    const replies = ["hello bro", "yo!", "sup?", "hey friend"];
    if (message.toLowerCase().includes("hello")) {
      bot.chat(replies[Math.floor(Math.random() * replies.length)]);
    }
  });
}

function startWorker() {
  setInterval(async () => {
    if (!bot.entity) return;

    const hostile = bot.nearestEntity(e =>
      e.type === "mob" && ["Zombie", "Skeleton", "Creeper", "Spider"].includes(e.name)
    );

    if (hostile && bot.health > 8) {
      try { await bot.pvp.attack(hostile); } catch {}
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

    const log = bot.findBlock({ matching: b => b && b.name.includes("log"), maxDistance: 10 });
    if (log) {
      try {
        await bot.pathfinder.goto(new goals.GoalBlock(log.position.x, log.position.y, log.position.z));
        await bot.dig(log);
      } catch {}
      return;
    }

    const stone = bot.findBlock({ matching: b => b && b.name.includes("stone"), maxDistance: 10 });
    if (stone) {
      try {
        await bot.pathfinder.goto(new goals.GoalBlock(stone.position.x, stone.position.y, stone.position.z));
        await bot.dig(stone);
      } catch {}
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
    } catch {}
  }, 8000);
}

createBot();

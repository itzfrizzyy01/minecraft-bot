// index.js
const { execSync } = require("child_process");

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

let didRegister = false; // track if /register has been done
const PASSWORD = "123456789"; // your password

function createBot() {
  const bot = mineflayer.createBot({
    host: "1deadsteal.aternos.me",
    port: 44112,
    username: "lully",
    version: "1.20.4"
  });

  bot.loadPlugin(pathfinder);

  bot.on("spawn", () => {
    // handle registration and login only once
    if (!didRegister) {
      setTimeout(() => bot.chat(`/register ${PASSWORD}`), 2000); // once only
      setTimeout(() => bot.chat(`/login ${PASSWORD}`), 4000);    // once only
      didRegister = true;
    }
  });

  bot.on("end", () => setTimeout(createBot, 5000));
  bot.on("kicked", () => {});
  bot.on("error", () => {});
}

createBot();

const http = require("http");
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running\n");
}).listen(process.env.PORT || 3000);


const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const express = require('express');

// ==================== SERVER CONFIG ====================
const server = {
  host: '1deadsteal.aternos.me', // Change to your server IP
  port: 44112, // Change to your server port
  username: 'mr_trolling'    // Change bot username
};

let bot;

// ==================== CREATE BOT ====================
function createBot() {
  bot = mineflayer.createBot(server);

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.pathfinder.setMovements(defaultMove);
    console.log(`[BOT] Spawned and connected as ${bot.username}`);
  });

  bot.on('end', () => {
    console.log("[BOT] Disconnected. Reconnecting in 5s...");
    setTimeout(createBot, 5000); // rejoin in 5s
  });

  bot.on('error', err => {
    console.log(`[BOT ERROR] ${err.message}`);
  });
}

createBot();

// ==================== KEEP-ALIVE WEB SERVER ====================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>AFK Bot 24x7</title></head>
      <body style="font-family: Arial; text-align:center; margin-top:50px;">
        <h1>✅ AFK Bot is running!</h1>
        <p>Bot Username: <b>${bot?.username || "Not started"}</b></p>
        <p>Server: <b>${server.host}:${server.port}</b></p>
        <p>Status: <b style="color:${bot?.player ? "green" : "red"}">
          ${bot?.player ? "Online" : "Offline"}
        </b></p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`[WEB] Keep-alive server running at http://localhost:${PORT}`);
});

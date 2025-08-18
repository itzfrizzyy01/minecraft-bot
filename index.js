// index.js
const mineflayer = require('mineflayer')
const http = require('http')

function createBot() {
  const bot = mineflayer.createBot({
    host: "1deadsteal.aternos.me", // server IP
    port: 45632,                   // server port
    username: "mr_trolling"        // bot name
  })

  // move forward and back on spawn
  bot.on('spawn', async () => {
    setInterval(async () => {
      try {
        bot.setControlState('forward', true)
        await bot.waitForTicks(20) // ~1 sec
        bot.setControlState('forward', false)

        bot.setControlState('back', true)
        await bot.waitForTicks(20)
        bot.setControlState('back', false)
      } catch (err) {
        // don’t spam logs
      }
    }, 5000)
  })

  // auto rejoin
  bot.on('end', () => {
    setTimeout(createBot, 5000)
  })

  // auto respawn
  bot.on('death', () => {
    bot.respawn()
  })

  // disable chat logging
  bot.on('messagestr', () => {})
  bot.on('message', () => {})
}

// === keep-alive server (Render needs this) ===
const PORT = process.env.PORT || 3000
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Bot is alive\n')
}).listen(PORT)

// self-ping every 5 minutes
setInterval(() => {
  http.get(`http://localhost:${PORT}`)
}, 5 * 60 * 1000)

createBot()


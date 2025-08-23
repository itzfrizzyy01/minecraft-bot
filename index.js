// index.js
const mineflayer = require("mineflayer")
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder")
const { plugin: pvp } = require("mineflayer-pvp")
const autoeat = require("mineflayer-auto-eat").plugin
const collectBlock = require("mineflayer-collectblock").plugin
const toolPlugin = require("mineflayer-tool").plugin
const mcDataLoader = require("minecraft-data")

const PASSWORD = "2211133445"
let firstJoin = true

function createBot() {
  const bot = mineflayer.createBot({
    host: "1deadsteal.aternos.me",
    port: 44112,
    username: "mr_troller",
    version: "1.20.4"
  })

  bot.loadPlugin(pathfinder)
  bot.loadPlugin(pvp)
  bot.loadPlugin(autoeat)
  bot.loadPlugin(collectBlock)
  bot.loadPlugin(toolPlugin)

  bot.once("spawn", () => {
    if (firstJoin) {
      setTimeout(() => bot.chat(`/register ${PASSWORD} ${PASSWORD}`), 2000)
      firstJoin = false
    } else {
      setTimeout(() => bot.chat(`/login ${PASSWORD}`), 2000)
    }

    bot.autoeat.options = {
      priority: "foodPoints",
      startAt: 14,
      bannedFood: []
    }

    setTimeout(() => exploreLoop(bot), 5000)
  })

  bot.on("death", () => {
    setTimeout(() => bot.chat("/respawn"), 5000)
  })

  bot.on("kicked", () => {
    setTimeout(createBot, 5000)
  })

  bot.on("end", () => {
    setTimeout(createBot, 5000)
  })

  bot.on("error", () => {})

  bot.on("physicTick", () => {
    const hostile = bot.nearestEntity(e =>
      e.type === "mob" &&
      ["Zombie", "Skeleton", "Spider", "Creeper"].includes(e.name)
    )
    if (hostile) {
      if (bot.health <= 6) {
        runAway(bot, hostile)
      } else {
        bot.pvp.attack(hostile)
      }
    }
  })
}

function exploreLoop(bot) {
  const mcData = mcDataLoader(bot.version)
  const movements = new Movements(bot, mcData)
  bot.pathfinder.setMovements(movements)

  async function loop() {
    try {
      const x = bot.entity.position.x + Math.floor(Math.random() * 20 - 10)
      const z = bot.entity.position.z + Math.floor(Math.random() * 20 - 10)
      const y = bot.entity.position.y

      await bot.pathfinder.goto(new goals.GoalBlock(x, y, z))
      setTimeout(loop, 3000)
    } catch {
      setTimeout(loop, 5000)
    }
  }

  loop()
}

function runAway(bot, enemy) {
  const pos = bot.entity.position
  const awayX = pos.x + (pos.x - enemy.position.x) * 5
  const awayZ = pos.z + (pos.z - enemy.position.z) * 5
  const y = pos.y
  bot.pathfinder.goto(new goals.GoalBlock(awayX, y, awayZ))
}

createBot()

// --- Tiny web server for Render ---
const http = require("http")
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" })
  res.end("Survival Bot is running\n")
}).listen(process.env.PORT || 3000)

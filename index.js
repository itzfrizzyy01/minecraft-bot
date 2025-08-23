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
    console.log("[BOT] Spawned")

    // Register/login
    if (firstJoin) {
      setTimeout(() => bot.chat(`/register ${PASSWORD} ${PASSWORD}`), 2000)
      firstJoin = false
    } else {
      setTimeout(() => bot.chat(`/login ${PASSWORD}`), 2000)
    }

    // Setup auto-eat (to stay alive)
    bot.autoeat.options = {
      priority: "foodPoints",
      startAt: 14,
      bannedFood: []
    }

    // Start exploring after login
    setTimeout(() => exploreLoop(bot), 5000)
  })

  // Respawn if dead
  bot.on("death", () => {
    console.log("[BOT] Died, respawning in 5s")
    setTimeout(() => bot.chat("/respawn"), 5000)
  })

  // Reconnect if kicked
  bot.on("kicked", (reason) => {
    console.log("[BOT] Kicked:", reason)
    setTimeout(createBot, 5000)
  })

  bot.on("end", () => {
    console.log("[BOT] Disconnected, retrying...")
    setTimeout(createBot, 5000)
  })

  bot.on("error", (err) => {
    console.log("[BOT] Error:", err.message)
  })

  // Fight hostile mobs automatically
  bot.on("physicTick", () => {
    const hostile = bot.nearestEntity(e =>
      e.type === "mob" &&
      ["Zombie", "Skeleton", "Spider", "Creeper"].includes(e.name)
    )
    if (hostile) {
      // If low HP, run instead of fight
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
      // Pick random position nearby to walk to
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

// Tiny web server for Render
const http = require("http")
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" })
  res.end("Survival Bot is running\n")
}).listen(process.env.PORT || 3000)


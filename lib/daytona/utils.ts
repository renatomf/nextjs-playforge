import "server-only"

import { DaytonaNotFoundError, type Sandbox } from "@daytona/sdk"
import { eq } from "drizzle-orm"

import { daytona } from "@/lib/daytona/client"
import { db } from "@/lib/db"
import { games } from "@/lib/db/schema"
import { seedGameDir } from "@/lib/games/seed"

export const GAME_DIR = "/home/daytona/game"
export const GAME_PORT = 8080

// Creates the game's sandbox, seeds its files from lib/games/runtime, and
// saves the sandbox id on the game row.
export async function createGameSandbox(gameId: string) {
  const sandbox = await daytona.create({ labels: { gameId } })

  await seedGameDir(sandbox, GAME_DIR)

  await db
    .update(games)
    .set({ sandboxId: sandbox.id })
    .where(eq(games.id, gameId))

  return { sandbox }
}

// Idle sandboxes auto-stop, so wake the game's sandbox before using it.
async function getStartedSandbox(sandboxId: string) {
  const sandbox = await daytona.get(sandboxId)

  if (sandbox.state === "starting") {
    await sandbox.waitUntilStarted()
  } else if (sandbox.state !== "started") {
    await sandbox.start()
  }

  return { sandbox }
}

// For the chat agent's tools: returns the game's sandbox, started and ready to
// use. Creates one if the game has none yet, or if its sandbox was deleted
// (that one's files are gone, so the game starts over from a fresh page).
// Runs outside any request, so the game isn't scoped to a Clerk org here.
export async function getGameSandbox(gameId: string) {
  const [game] = await db
    .select({ sandboxId: games.sandboxId })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1)

  if (!game) {
    throw new Error("Game not found")
  }

  if (game.sandboxId) {
    try {
      return await getStartedSandbox(game.sandboxId)
    } catch (error) {
      if (!(error instanceof DaytonaNotFoundError)) throw error
    }
  }

  return createGameSandbox(gameId)
}

async function isGameServerUp(sandbox: Sandbox) {
  const { exitCode } = await sandbox.process.executeCommand(
    `curl -sf -o /dev/null http://localhost:${GAME_PORT}/`
  )

  return exitCode === 0
}

// Wakes the sandbox and serves the game's index.html on GAME_PORT. Reuses a
// server that is already up; a restarted sandbox has lost its server, so that
// starts a new one.
export async function startGameServer(sandboxId: string) {
  const { sandbox } = await getStartedSandbox(sandboxId)

  if (await isGameServerUp(sandbox)) return { sandbox }

  // Backgrounded so the command returns right away. If two requests race to
  // get here, the second server can't bind the port and exits.
  await sandbox.process.executeCommand(
    `nohup python3 -m http.server ${GAME_PORT} --directory ${GAME_DIR} > /tmp/game-server.log 2>&1 &`
  )

  for (let attempt = 0; attempt < 20; attempt++) {
    if (await isGameServerUp(sandbox)) return { sandbox }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error("Game server did not start")
}

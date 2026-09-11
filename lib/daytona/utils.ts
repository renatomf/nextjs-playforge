import "server-only"

import { eq } from "drizzle-orm"

import { daytona } from "@/lib/daytona/client"
import { db } from "@/lib/db"
import { games } from "@/lib/db/schema"

const GAME_DIR = "/home/daytona/game"

// Creates the game's sandbox, seeds its page, and saves the sandbox id on the
// game row.
export async function createGameSandbox(gameId: string) {
  const sandbox = await daytona.create({ labels: { gameId } })

  await sandbox.fs.createFolder(GAME_DIR, "755")
  await sandbox.fs.uploadFile(Buffer.from("New game"), `${GAME_DIR}/index.html`)

  await db
    .update(games)
    .set({ sandboxId: sandbox.id })
    .where(eq(games.id, gameId))

  return sandbox
}

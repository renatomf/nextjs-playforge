import "server-only"

import type { Dirent } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import type { Sandbox } from "@daytona/sdk"

// Files every new game starts with. Nothing imports them, so trigger.config.ts
// copies the folder into the Trigger.dev build, next to process.cwd().
const RUNTIME_DIR = path.join(process.cwd(), "lib/games/runtime")

// The entry's path under gameDir. Sandbox paths are POSIX, so the local path
// is rebuilt from its segments (it uses backslashes on Windows).
function toSandboxPath(entry: Dirent, gameDir: string) {
  const localPath = path.join(entry.parentPath, entry.name)
  const segments = path.relative(RUNTIME_DIR, localPath).split(path.sep)

  return path.posix.join(gameDir, ...segments)
}

// Copies every folder and file in RUNTIME_DIR into the sandbox's gameDir,
// keeping their layout.
export async function seedGameDir(sandbox: Sandbox, gameDir: string) {
  const entries = await readdir(RUNTIME_DIR, {
    recursive: true,
    withFileTypes: true,
  })

  // Sorted so each folder is created before its subfolders.
  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => toSandboxPath(entry, gameDir))
    .sort()

  await sandbox.fs.createFolder(gameDir, "755")
  for (const folder of folders) {
    await sandbox.fs.createFolder(folder, "755")
  }

  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => ({
        source: await readFile(path.join(entry.parentPath, entry.name)),
        destination: toSandboxPath(entry, gameDir),
      }))
  )

  await sandbox.fs.uploadFiles(files)
}

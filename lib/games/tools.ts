import "server-only"

import path from "node:path"

import type { Sandbox } from "@daytona/sdk"
import { tool } from "ai"
import { z } from "zod"

import { GAME_DIR, getGameSandbox } from "@/lib/daytona/utils"
import { askPlayer } from "@/lib/games/ask-player"

// How deep list_files walks. Games are small, so this covers every file.
const LIST_DEPTH = 10

const pathSchema = z
  .string()
  .describe(
    "Path relative to the game directory, e.g. `index.html` or `js/player.js`."
  )

// Resolves a path from the model against the game directory and rejects
// anything that lands outside it (e.g. `../.bashrc` or `/etc/passwd`).
function resolveGamePath(filePath: string) {
  const resolved = path.posix.resolve(GAME_DIR, filePath)

  if (resolved !== GAME_DIR && !resolved.startsWith(`${GAME_DIR}/`)) {
    throw new Error(`"${filePath}" is outside the game directory`)
  }

  return resolved
}

// Like resolveGamePath, but for tools that act on a single file, where the
// game directory itself is never a valid target.
function resolveGameFile(filePath: string) {
  const resolved = resolveGamePath(filePath)

  if (resolved === GAME_DIR) {
    throw new Error(`"${filePath}" is the game directory, not a file`)
  }

  return resolved
}

// The path as the model should see it: relative to the game directory.
function toGamePath(absolutePath: string) {
  return path.posix.relative(GAME_DIR, absolutePath) || "."
}

function countOccurrences(text: string, search: string) {
  return text.split(search).length - 1
}

// The chat agent's tools: the file tools, bound to one game, plus ask_player.
// Every path is confined to the game directory in that game's sandbox.
export function createGameTools(gameId: string) {
  // All tool calls in a turn share one lookup of the sandbox. A failed lookup
  // isn't cached, so the next call tries again.
  let sandboxPromise: Promise<Sandbox> | undefined

  async function getSandbox() {
    sandboxPromise ??= getGameSandbox(gameId).then(({ sandbox }) => sandbox)

    try {
      return await sandboxPromise
    } catch (error) {
      sandboxPromise = undefined
      throw error
    }
  }

  return {
    write_file: tool({
      description:
        "Create a file in the game directory, or overwrite it with new content. Parent folders are created as needed. Always pass the complete file content; to change part of an existing file, prefer replace_text.",
      inputSchema: z.object({
        path: pathSchema,
        content: z.string().describe("The complete new content of the file."),
      }),
      execute: async ({ path: filePath, content }) => {
        const resolved = resolveGameFile(filePath)
        const sandbox = await getSandbox()

        await sandbox.fs.uploadFile(Buffer.from(content), resolved)

        return { path: toGamePath(resolved), written: true }
      },
    }),

    replace_text: tool({
      description:
        "Replace an exact snippet of text in a file in the game directory. `oldText` must match the file exactly, including whitespace and indentation, and must appear exactly once unless `replaceAll` is true. Read the file first so the snippet is accurate.",
      inputSchema: z.object({
        path: pathSchema,
        oldText: z
          .string()
          .min(1)
          .describe(
            "The exact text to replace. Include enough surrounding lines to make it unique in the file."
          ),
        newText: z.string().describe("The text to put in its place."),
        replaceAll: z
          .boolean()
          .optional()
          .describe(
            "Replace every occurrence instead of requiring exactly one. Defaults to false."
          ),
      }),
      execute: async ({ path: filePath, oldText, newText, replaceAll }) => {
        const resolved = resolveGameFile(filePath)
        const sandbox = await getSandbox()

        const text = (await sandbox.fs.downloadFile(resolved)).toString("utf8")
        const occurrences = countOccurrences(text, oldText)

        if (occurrences === 0) {
          throw new Error(
            `oldText was not found in "${filePath}". Read the file and copy the snippet exactly.`
          )
        }

        if (occurrences > 1 && !replaceAll) {
          throw new Error(
            `oldText appears ${occurrences} times in "${filePath}". Include more surrounding text to make it unique, or set replaceAll to true.`
          )
        }

        // Split and join rather than String.replace, which would treat `$` in
        // newText as a replacement pattern.
        const updated = text.split(oldText).join(newText)

        await sandbox.fs.uploadFile(Buffer.from(updated), resolved)

        return { path: toGamePath(resolved), replacements: occurrences }
      },
    }),

    read_file: tool({
      description:
        "Read the full content of a file in the game directory. Use it before editing a file.",
      inputSchema: z.object({ path: pathSchema }),
      execute: async ({ path: filePath }) => {
        const resolved = resolveGameFile(filePath)
        const sandbox = await getSandbox()

        const content = (await sandbox.fs.downloadFile(resolved)).toString(
          "utf8"
        )

        return { path: toGamePath(resolved), content }
      },
    }),

    list_files: tool({
      description:
        "List every file and folder in the game directory, or in one of its folders, recursively.",
      inputSchema: z.object({
        path: pathSchema
          .optional()
          .describe(
            "Folder to list, relative to the game directory. Defaults to the whole game directory."
          ),
      }),
      execute: async ({ path: dirPath = "." }) => {
        const resolved = resolveGamePath(dirPath)
        const sandbox = await getSandbox()

        const entries = await sandbox.fs.listFiles(resolved, {
          depth: LIST_DEPTH,
        })

        return {
          path: toGamePath(resolved),
          entries: entries
            .map((entry) => ({
              path: toGamePath(
                entry.path ?? path.posix.join(resolved, entry.name)
              ),
              type: entry.isDir ? "directory" : "file",
              size: entry.size,
            }))
            .sort((a, b) => a.path.localeCompare(b.path)),
        }
      },
    }),

    delete_file: tool({
      description:
        "Delete a file, or a folder and everything in it, from the game directory.",
      inputSchema: z.object({ path: pathSchema }),
      execute: async ({ path: filePath }) => {
        const resolved = resolveGameFile(filePath)
        const sandbox = await getSandbox()

        await sandbox.fs.deleteFile(resolved, true)

        return { path: toGamePath(resolved), deleted: true }
      },
    }),

    ask_player: askPlayer,
  }
}

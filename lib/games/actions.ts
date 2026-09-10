"use server"

import { auth } from "@clerk/nextjs/server"
import { refresh } from "next/cache"

import { db } from "@/lib/db"
import { games } from "@/lib/db/schema"

export async function createGame(title: string) {
  const { orgId } = await auth()
  
  if (!orgId) {
    throw new Error("Unauthorized: no active organization")
  }

  // Server Actions are reachable via direct POST, so re-validate the input.
  const trimmed = typeof title === "string" ? title.trim() : ""
  if (!trimmed) {
    throw new Error("Title is required")
  }

  await db.insert(games).values({ orgId, title: trimmed })

  // Re-render the (app) layout so the sidebar picks up the new game.
  refresh()
}

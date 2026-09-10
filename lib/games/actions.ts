"use server"

import { auth } from "@clerk/nextjs/server"
import { refresh } from "next/cache"

import { db } from "@/lib/db"
import { games } from "@/lib/db/schema"

export async function createGame(prompt: string) {
  const { orgId } = await auth()

  if (!orgId) {
    throw new Error("Unauthorized: no active organization")
  }

  const title = typeof prompt === "string" ? prompt.trim() : ""
  
  if (!title) {
    return
  }

  await db.insert(games).values({ orgId, title })

  // Re-render the (app) layout so the sidebar picks up the new game.
  refresh()
}

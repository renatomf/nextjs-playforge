import { GAME_PORT, startGameServer } from "@/lib/daytona/utils"
import { getGame } from "@/lib/games/queries"

// How long a preview url stays valid; a page load asks for a fresh one.
const PREVIEW_URL_TTL_SECONDS = 60 * 60

// Returns the game's preview url. The Daytona SDK is server-only, and getGame
// scopes the lookup to the caller's org.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/games/[id]/preview">
) {
  const { id } = await ctx.params
  const game = await getGame(id)

  if (!game?.sandboxId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const { sandbox } = await startGameServer(game.sandboxId)

  // Signed, so the token is in the url and an iframe can load it.
  const { url } = await sandbox.getSignedPreviewUrl(
    GAME_PORT,
    PREVIEW_URL_TTL_SECONDS
  )

  return Response.json({ url })
}

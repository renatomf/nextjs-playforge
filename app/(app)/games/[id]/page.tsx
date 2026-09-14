import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { GameChat } from "@/components/game-chat"
import { GameHeader } from "@/components/game-header"
import { isGameModelId } from "@/lib/ai/model-catalog"
import { mintChatAccessToken } from "@/lib/games/actions"
import { getGame } from "@/lib/games/queries"

export default async function Page(props: PageProps<"/games/[id]">) {
  await auth.protect({ unauthenticatedUrl: "/sign-in" })

  const { id } = await props.params
  const { model } = await props.searchParams
  const game = await getGame(id)

  if (!game) notFound()

  // A game has a chat session once a turn has completed; give the transport
  // its stream cursor so a reload resumes instead of starting a new session.
  const initialSession = game.lastEventId
    ? {
        publicAccessToken: await mintChatAccessToken(game.id),
        lastEventId: game.lastEventId,
      }
    : undefined

  // The model picked on the home page, which createGame puts in the URL.
  // Anything else leaves the chat on the default model.
  const initialModelId = isGameModelId(model) ? model : undefined

  return (
    <div className="flex h-svh flex-col">
      <GameHeader gameId={game.id} title={game.title} />
      <GameChat
        id={game.id}
        initialMessages={game.messages}
        initialSession={initialSession}
        initialModelId={initialModelId}
        hasSandbox={game.sandboxId !== null}
      />
    </div>
  )
}

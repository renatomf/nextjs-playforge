import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { GameChat } from "@/components/game-chat"
import { mintChatAccessToken } from "@/lib/games/actions"
import { getGame } from "@/lib/games/queries"

export default async function Page(props: PageProps<"/games/[id]">) {
  await auth.protect({ unauthenticatedUrl: "/sign-in" })

  const { id } = await props.params
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

  return (
    <GameChat
      id={game.id}
      initialMessages={game.messages}
      initialSession={initialSession}
      hasSandbox={game.sandboxId !== null}
    />
  )
}

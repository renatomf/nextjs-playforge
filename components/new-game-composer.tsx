"use client"

import { useState, useTransition } from "react"

import { ChatComposer } from "@/components/chat-composer"
import { Button } from "@/components/ui/button"
import { createGame } from "@/lib/games/actions"
import { suggestions } from "@/lib/games/suggestions"

// Client boundary for the home page composer: a Server Component can't pass
// ChatComposer its onValueChange/onSubmit callbacks, so the prompt state and
// the createGame call live here.
export function NewGameComposer() {
  const [prompt, setPrompt] = useState("")
  const [isPending, startTransition] = useTransition()

  // createGame redirects to the new game, so the composer stays pending
  // until the game page takes over.
  function handleSubmit(value: string) {
    startTransition(async () => {
      await createGame(value)
    })
  }

  return (
    <>
      <ChatComposer
        value={prompt}
        onValueChange={setPrompt}
        onSubmit={handleSubmit}
        isPending={isPending}
      />
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map(({ icon: Icon, label }) => (
          <Button
            key={label}
            type="button"
            variant="outline"
            className="rounded-full font-normal text-muted-foreground"
            onClick={() => setPrompt(label)}
          >
            <Icon data-icon="inline-start" />
            {label}
          </Button>
        ))}
      </div>
    </>
  )
}

"use client"

import { useState, useTransition } from "react"

import { ChatComposer } from "@/components/chat-composer"
import { Button } from "@/components/ui/button"
import { DEFAULT_GAME_MODEL_ID, type GameModelId } from "@/lib/ai/model-catalog"
import { createGame } from "@/lib/games/actions"
import { suggestions } from "@/lib/games/suggestions"

// Client boundary for the home page composer: a Server Component can't pass
// ChatComposer its callbacks, so the prompt, the picked model, and the
// createGame call live here.
export function NewGameComposer() {
  const [prompt, setPrompt] = useState("")
  const [modelId, setModelId] = useState<GameModelId>(DEFAULT_GAME_MODEL_ID)
  const [isPending, startTransition] = useTransition()

  // createGame redirects to the new game, taking the picked model along, so
  // the composer stays pending until the game page takes over.
  function handleSubmit(value: string) {
    startTransition(async () => {
      await createGame(value, modelId)
    })
  }

  return (
    <>
      <ChatComposer
        value={prompt}
        onValueChange={setPrompt}
        onSubmit={handleSubmit}
        isPending={isPending}
        modelId={modelId}
        onModelChange={setModelId}
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

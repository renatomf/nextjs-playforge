"use client"

import { createContext, use, useState, useTransition } from "react"
import { ArrowUpIcon, ChevronDownIcon, GripHorizontalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { createGame } from "@/lib/games/actions"

const models = ["Kimi K3", "Claude Opus 5", "GPT-5", "Gemini 3 Pro"]

type ChatComposerContextValue = {
  title: string
  setTitle: (title: string) => void
}

const ChatComposerContext = createContext<ChatComposerContextValue | null>(
  null
)

function useChatComposer() {
  const context = use(ChatComposerContext)
  if (!context) {
    throw new Error("useChatComposer must be used within a ChatComposerProvider.")
  }

  return context
}

export function ChatComposerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [title, setTitle] = useState("")

  return (
    <ChatComposerContext value={{ title, setTitle }}>
      {children}
    </ChatComposerContext>
  )
}

export function ChatComposer() {
  const { title, setTitle } = useChatComposer()
  const [isPending, startTransition] = useTransition()

  const canSubmit = title.trim().length > 0 && !isPending

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return

    startTransition(async () => {
      await createGame(title)
      setTitle("")
    })
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <InputGroup className="bg-popover">
        <InputGroupTextarea
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            // Enter submits, Shift+Enter inserts a newline.
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder="Describe the game you want to build..."
          rows={1}
          className="field-sizing-content max-h-48 min-h-10"
        />
        <InputGroupAddon align="block-end">
          <DropdownMenu>
            <DropdownMenuTrigger render={<InputGroupButton />}>
              <GripHorizontalIcon />
              Kimi K3
              <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-auto">
              {models.map((model) => (
                <DropdownMenuItem key={model}>{model}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <InputGroupButton
            type="submit"
            variant="default"
            size="icon-sm"
            className="ml-auto rounded-full"
            disabled={!canSubmit}
          >
            <ArrowUpIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}

export function ChatSuggestion({
  label,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick"> & { label: string }) {
  const { setTitle } = useChatComposer()

  return <Button type="button" onClick={() => setTitle(label)} {...props} />
}

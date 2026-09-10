"use client"

import { ArrowUpIcon, ChevronDownIcon, GripHorizontalIcon } from "lucide-react"

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

const models = ["Kimi K3", "Claude Opus 5", "GPT-5", "Gemini 3 Pro"]

type ChatComposerProps = {
  value: string
  onValueChange: (value: string) => void
  onSubmit: (value: string) => void
  isPending?: boolean
  placeholder?: string
}

export function ChatComposer({
  value,
  onValueChange,
  onSubmit,
  isPending = false,
  placeholder = "Describe the game you want to build...",
}: ChatComposerProps) {
  const canSubmit = value.trim().length > 0 && !isPending

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return

    onSubmit(value)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <InputGroup className="bg-popover">
        <InputGroupTextarea
          name="message"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
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
          placeholder={placeholder}
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

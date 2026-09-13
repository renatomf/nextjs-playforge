"use client"

import { ArrowUpIcon, SquareIcon } from "lucide-react"

import { ModelPicker } from "@/components/model-picker"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import type { GameModelId } from "@/lib/ai/model-catalog"

type ChatComposerProps = {
  value: string
  onValueChange: (value: string) => void
  onSubmit: (value: string) => void
  // While pending, the submit button becomes a stop button that calls this.
  onStop?: () => void
  isPending?: boolean
  // Blocks typing and sending, e.g. while the chat waits on another answer.
  disabled?: boolean
  placeholder?: string
  // The model picker shows only when both are given; the caller owns the choice.
  modelId?: GameModelId
  onModelChange?: (modelId: GameModelId) => void
}

export function ChatComposer({
  value,
  onValueChange,
  onSubmit,
  onStop,
  isPending = false,
  disabled = false,
  placeholder = "Describe the game you want to build...",
  modelId,
  onModelChange,
}: ChatComposerProps) {
  const canSubmit = value.trim().length > 0 && !isPending && !disabled

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
          disabled={disabled}
          rows={1}
          className="field-sizing-content max-h-48 min-h-10"
        />
        <InputGroupAddon align="block-end">
          {modelId && onModelChange && (
            <ModelPicker modelId={modelId} onModelChange={onModelChange} />
          )}
          {/* Distinct keys so React swaps the element instead of flipping its
              type mid-click, which could submit the form right after a stop. */}
          {isPending && onStop ? (
            <InputGroupButton
              key="stop"
              type="button"
              variant="default"
              size="icon-sm"
              className="ml-auto rounded-full"
              onClick={onStop}
              aria-label="Stop generating"
            >
              <SquareIcon className="fill-current" />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              key="submit"
              type="submit"
              variant="default"
              size="icon-sm"
              className="ml-auto rounded-full"
              disabled={!canSubmit}
              aria-label="Send message"
            >
              <ArrowUpIcon />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}

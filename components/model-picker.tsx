"use client"

import { ChevronDownIcon, GripHorizontalIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroupButton } from "@/components/ui/input-group"
import { GAME_MODELS, type GameModelId } from "@/lib/ai/model-catalog"

type ModelPickerProps = {
  modelId: GameModelId
  onModelChange: (modelId: GameModelId) => void
}

// Picks the model the chat replies with. It doesn't own the choice: the chat
// holds it and sends it with each message.
export function ModelPicker({ modelId, onModelChange }: ModelPickerProps) {
  const selected = GAME_MODELS.find((model) => model.id === modelId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<InputGroupButton />}>
        <GripHorizontalIcon />
        {selected?.name}
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72">
        <DropdownMenuRadioGroup
          value={modelId}
          // Base UI types the value as any: map it back to a catalog id.
          onValueChange={(value) => {
            const model = GAME_MODELS.find((model) => model.id === value)

            if (model) onModelChange(model.id)
          }}
        >
          {GAME_MODELS.map((model) => (
            <DropdownMenuRadioItem key={model.id} value={model.id} closeOnClick>
              <div className="flex flex-col">
                <span>{model.name}</span>
                <span className="text-xs text-muted-foreground">
                  {model.tagline}
                </span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

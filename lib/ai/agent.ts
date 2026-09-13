import { isStepCount } from "ai"

import { DEFAULT_GAME_MODEL_ID, type GameModelId } from "@/lib/ai/model-catalog"
import { chatModels } from "@/lib/ai/models"
import { gameInstructions } from "@/lib/games/instructions"

// Most model steps one turn may take. Each step can call several tools, so
// this leaves room to read, write, and fix a whole game in one reply.
const MAX_STEPS = 30

// The streamText settings for a game's chat, replying with the given model.
export function gameAgentSettings(
  modelId: GameModelId = DEFAULT_GAME_MODEL_ID
) {
  return {
    model: chatModels[modelId],
    instructions: gameInstructions,
    stopWhen: isStepCount(MAX_STEPS),
  }
}

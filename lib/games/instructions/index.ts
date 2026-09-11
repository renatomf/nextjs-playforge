import type { SystemModelMessage } from "ai"

import { designInstructions } from "@/lib/games/instructions/design"
import { engineInstructions } from "@/lib/games/instructions/engine"
import { runtimeInstructions } from "@/lib/games/instructions/runtime"
import { workflowInstructions } from "@/lib/games/instructions/workflow"

// The game chat's system prompt: one system message per topic, in order.
export const gameInstructions: SystemModelMessage[] = [
  workflowInstructions,
  runtimeInstructions,
  engineInstructions,
  designInstructions,
]

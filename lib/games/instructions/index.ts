import type { SystemModelMessage } from "ai"

import { runtimeInstructions } from "@/lib/games/instructions/runtime"
import { workflowInstructions } from "@/lib/games/instructions/workflow"

// The game chat's system prompt: one system message per topic, in order.
export const gameInstructions: SystemModelMessage[] = [
  workflowInstructions,
  runtimeInstructions,
]

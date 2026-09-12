import { tool } from "ai"
import { z } from "zod"

// A multiple-choice question for the player. It has no execute: calling it
// ends the turn with the call pending, the player picks an option in the chat,
// and the next turn continues from their answer. Kept apart from the
// server-only file tools so the chat UI can share its types.
export const askPlayer = tool({
  description:
    "Ask the player a multiple-choice question about one dimension of their game, then wait for their answer. Before building a new game, use it to settle every dimension the player's description leaves open, one question per dimension, in the order the dimensions are listed. For a change to an existing game, ask only about a dimension the request leaves open. Pick the dimension first, then write one question about it with 2-4 distinct options that build on the earlier answers. Ask one question at a time. The answer comes back as the chosen option's id and label.",
  inputSchema: z.object({
    dimension: z
      .enum([
        "loop",
        "goal",
        "controls",
        "world",
        "look",
        "feel",
        "sound",
        "challenge",
      ])
      .describe(
        "The part of the game the question is about: loop (what the player does moment to moment), goal (what they are trying to achieve, and how they win or lose), controls (keys, mouse, or touch), world (setting, theme, characters, story), look (art style, colors, effects), feel (pacing, responsiveness, feedback like screen shake and particles), sound (music and sound effects), or challenge (difficulty, how it ramps up, replayability)."
      ),
    question: z
      .string()
      .describe("The question for the player, in one short sentence."),
    options: z
      .array(
        z.object({
          id: z
            .string()
            .describe("A short kebab-case id, unique among the options."),
          label: z
            .string()
            .describe("The option in a few words, as the player sees it."),
          description: z
            .string()
            .describe(
              "One sentence on what picking this option means for the game."
            ),
        })
      )
      .min(2)
      .max(4)
      .describe("2-4 distinct answers for the player to choose from."),
  }),
  outputSchema: z.object({
    id: z.string().describe("The id of the option the player chose."),
    label: z.string().describe("The label of the option the player chose."),
  }),
})

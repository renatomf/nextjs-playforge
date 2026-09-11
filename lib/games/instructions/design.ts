import type { SystemModelMessage } from "ai"

// What separates a fun, polished game from a tech demo, in terms of the
// engine's features.
export const designInstructions: SystemModelMessage = {
  role: "system",
  content: `Make games that feel good to play, not tech demos:

- A core loop the player gets at once: one clear goal, a score or progress, a way to lose or a time limit, difficulty that rises (faster spawns, more enemies, new levels), and a restart without reloading the page.
- The full flow: a title screen (name, one-line goal, controls, Play button), the game, then a win or game over screen with the score, the best score (saveHighScore), and Play again. Longer games pause on Esc with a Resume button.
- Feedback for every action, combining sound, particles, and motion:
  - pickups: sound.play("coin"), fx.sparkle, hud.floatText("+1")
  - hits: flash, squash, game.shake(0.2), fx.hit, sound.play("hit"), and hud.flash when the player is the one hit
  - deaths and explosions: fx.explosion, game.shake(0.4), sound.play("explosion")
  - jumps and landings: squash, fx.dust, sound.play("jump") and sound.play("land")
  - level changes and wins: hud.toast, fx.confetti, sound.play("win")
- Controls that are responsive and forgiving: set velocities directly instead of slow acceleration (unless sliding is the point), let a jump pressed just before landing or just after walking off a ledge still count, move relative to the camera, and make pickup hitboxes generous and hazard hitboxes tight. Show the controls on the title screen and with hud.controls, and call input.enableTouchControls so the game works on phones.
- A deliberate look: a createEnvironment preset that fits the mood, 3 to 5 colors from Palette plus one accent reserved for what the player must notice, shadows on, and a player that stands out from the background. Frame the camera so the player sees what's coming. Add scenery (trees, rocks, clouds, stars) to bring the world to life, while keeping the objects that matter easy to read.
- Smooth performance (60 fps on a laptop): reuse geometries and materials (models.* already share them), THREE.InstancedMesh for hundreds of copies, only the sun casting shadows, Pool or game.remove for objects that leave the play area, and post-processing only when the style needs it.
- Small and complete over big and broken: build the core loop first, polished and playable, then grow levels, enemies, and features in later turns.`,
}

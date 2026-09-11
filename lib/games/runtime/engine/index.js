// The game engine: import everything from here.
//
//   import { THREE, Game, Hud, Physics, models, sound } from "./engine/index.js"
//
// Needs the "three" import map in index.html (see the welcome page's <head>).
export * as THREE from "three"

export { Game, reportError } from "./core.js"
export { Input, DEFAULT_BINDINGS, PAD_BUTTONS } from "./input.js"
export { Hud } from "./hud.js"
export { sound, noteToFreq } from "./audio.js"
export {
  Ease, TweenManager, Animator,
  spin, bob, pulse, combine,
  popIn, squash, flash, fadeTo,
} from "./animation.js"
export * as models from "./models.js"
export { loadModel, MODELS, Palette, material } from "./models.js"
export { Physics } from "./physics.js"
export { Particles } from "./particles.js"
export { createEnvironment, gradientTexture } from "./world.js"
export { createPostFX } from "./effects.js"
export {
  FollowCamera, ThirdPersonCamera, FirstPersonCamera, OrbitCamera,
  moveRelativeToCamera,
} from "./camera.js"
export * from "./utils.js"

import type { SystemModelMessage } from "ai"

// The API of lib/games/runtime/engine, which every game directory starts
// with. Keep it in sync with the engine: the model writes code from this
// summary without reading the engine's files.
export const engineInstructions: SystemModelMessage = {
  role: "system",
  content: `Every game directory includes engine/, a game engine built on Three.js r186. Build games with it, 2D-looking ones included (use an orthographic camera), unless the user asks for something else. Import everything from one file:

\`\`\`js
import { THREE, Game, Hud, Physics, Particles, FollowCamera, createEnvironment, models, sound } from "./engine/index.js"
\`\`\`

THREE is the whole Three.js namespace. Only import names listed below. Each engine file documents its API in comments; read one (e.g. engine/physics.js) only when you need a detail this summary leaves out.

# Conventions
- 1 unit = 1 meter, +Y is up. A new Game's camera looks from +Z toward -Z, so "up" on the keyboard means -Z.
- Models face +Z. Turn one toward a direction with object.rotation.y = headingFrom(dx, dz), or smoothly with dampAngle(object.rotation.y, headingFrom(dx, dz), 12, dt).
- Standing models have their origin at their feet; coin, gem, heart, star, cloud, spaceship, and primitives at their center; platform() at its top surface.
- dt is in seconds: multiply speeds by dt. Colors are numbers (0xea580c), CSS strings ("#ea580c", "red"), or Palette names.

# Game (the loop)
const game = new Game({ camera: "perspective" | "orthographic", fov: 60, viewHeight: 20 (orthographic: world units visible vertically), background: 0x111116 (or null), shadows: true })
- game.scene, game.camera, game.renderer, game.canvas, game.input, game.width, game.height, game.time: { elapsed, delta, frame, scale } (scale 0.3 = slow motion).
- game.add(...objects): adds to the scene (unless already parented) and calls object.update(dt, game) every frame when it has one, also for non-3D objects (an Animator, a spawner). Assign object.update before add. Returns the first object.
- game.remove(...objects): removes them from the scene, stops their update, and drops their physics bodies and HUD labels. Use it instead of scene.remove.
- game.onUpdate(fn(dt, game)) and game.onLateUpdate(fn) (after physics: cameras, followers) return a function that stops them. game.onRender(fn) runs every frame, even when paused.
- Frame order: timers, onUpdate, object update(), tweens, physics, onLateUpdate, render.
- game.pause(), game.resume(), game.togglePause(), game.paused: freezes updates, timers, tweens, and physics; rendering continues.
- game.after(seconds, fn) and game.every(seconds, fn) return cancel functions; await game.wait(seconds); game.clearTimers(). They run on game time and pause with the game.
- game.on(name, fn), game.once, game.emit(name, ...args): events. Built in: "resize" (width, height), "remove" (object), "pause", "resume".
- game.shake(strength = 0.3, duration = 0.3): camera shake.
- game.pick(objects, recursive = true): closest hit under the pointer ({ object, point, ... }) or null. game.pointerOnPlane(y = 0): Vector3 where the pointer ray meets the ground, for aiming and click-to-move, or null. game.worldToScreen(vector3): { x, y, visible } in CSS pixels. game.setViewHeight(h): orthographic zoom.
- An error thrown inside any callback is shown on the page and the loop keeps running.

# Input (game.input, read inside onUpdate)
- input.down(name) while held, input.pressed(name) on the frame it went down, input.released(name). name is an action or a raw code: KeyboardEvent.code ("KeyQ", "Digit1", "ShiftLeft", "Space"), "Mouse0" (left), "Mouse2" (right), or a gamepad button: PadA, PadB, PadX, PadY, PadLB, PadRB, PadLT, PadRT, PadSelect, PadStart, PadUp, PadDown, PadLeft, PadRight.
- Actions: left (A, Left), right (D, Right), up (W, Up), down (S, Down), jump (Space, PadA), fire (F, J, left click, PadRT, PadX), action (E, Enter, PadY), sprint (Shift, PadB, PadLB), pause (Esc, P, PadStart). Rebind: input.bind("fire", ["Space", "Mouse0"]).
- input.move(): Vector2 from WASD/arrows, the gamepad stick, and the touch joystick; x is right, y is up/forward; length <= 1. It is shared: .clone() it to keep it.
- input.axis("left", "right"): -1, 0, or 1. input.anyPressed(). input.reset() forgets held keys.
- input.pointer: { x, y (CSS pixels), ndc (Vector2, -1..1), dx, dy (movement this frame, also while locked), wheel, isDown }. input.look(): right stick. input.lockPointer() (inside a click), input.unlockPointer(), input.pointerLocked.
- input.enableTouchControls({ joystick: true, buttons: ["jump", { action: "fire", label: "🔥" }] }): an on-screen joystick and buttons on touch devices only. Call it in every game played with keys.

# Cameras
Create one rig after its target exists; it updates itself. One at a time: rig.dispose() before replacing it.
- new FollowCamera(game, target, { offset: [0, 6, 10], lookOffset: [0, 1, 0], smoothing: 6, rotateWithTarget: false }). Offsets: [0, 18, 0.01] top-down, [10, 12, 10] isometric, [0, 2, 14] side view; rotateWithTarget: true for chase cameras behind vehicles. rig.snap() after teleporting the target.
- new ThirdPersonCamera(game, target, { distance: 6, height: 1.6, pointerLock: false }): dragging and the right stick orbit, the wheel zooms. rig.moveDirection(input.move()) gives a world direction relative to the camera.
- new FirstPersonCamera(game, { target, height: 1.6 }): clicking locks the pointer for mouse look. rig.moveDirection(move), rig.lookDirection(), rig.yaw, rig.pitch.
- new OrbitCamera(game, { target: [0, 0, 0], minDistance, maxDistance, autoRotate }): drag to orbit, for puzzles, board games, and builders.
- moveRelativeToCamera(game.camera, input.move()): Vector3 on the ground where "up" walks away from the camera. Use it with FollowCamera.
- Fixed views: set game.camera.position and call game.camera.lookAt(x, y, z) yourself.

# World
- createEnvironment(game, preset, { ground: false, shadows: true, shadowArea: 50, fog: true }) returns { sun, hemi, ground, follow(object) }: sky gradient, fog, a sun with shadows, sky light, and reflections, in one call. Presets: "day", "sunset", "night" (stars), "space" (stars), "studio" (neutral backdrop), "dark" (add your own THREE.PointLight torches). ground: true or { size, color, checker } adds a visual ground plane at y = 0 (it has no physics body). env.follow(player) keeps shadows sharp around the player in levels larger than shadowArea. Call it once.
- gradientTexture(top, bottom): a texture for scene.background.

# Models (models.*)
Low-poly and flat-shaded, casting and receiving shadows. Every function takes one options object.
- Primitives (Mesh, centered): models.box({ size: 1 or [w, h, d], radius (rounded edges) }), models.sphere({ radius, detail: 0 chunky to 3 smooth }), models.cylinder({ radius, radiusTop, radiusBottom, height, segments }), models.cone({ radius, height, segments }), models.capsule({ radius, length }), models.torus({ radius, tube }) (a standing hoop), models.mesh(geometry, colorOrMaterial). All take color, material, flat, position: [x, y, z], rotation: [x, y, z], scale, castShadow.
- models.character({ color, skin, pants, hair, height: 1.8 }): a blocky humanoid that animates itself once added with game.add. Set character.speed (horizontal units per second) and character.grounded every frame. character.parts: head, torso, leftArm, rightArm, leftLeg, rightLeg, hand (attach held items to hand).
- models.slime({ color, size }): a bouncing blob enemy; set slime.speed to bounce faster.
- Nature: models.tree({ kind: "round" | "pine" | "palm", height: 3 }), models.rock({ size }), models.bush({ size }), models.cloud({ size }).
- Props: models.crate({ size }), models.barrel(), models.coin(), models.gem({ color }), models.heart(), models.star(), models.flag({ color, height }) (a goal), models.platform({ size: [w, h, d], color, top }) (a floor block with a grass top; top: null for none), models.ground({ size, color, checker }).
- Vehicles and buildings: models.car({ color }) (userData.wheels to spin), models.spaceship({ color, accent }) (userData.engine is the glowing exhaust), models.house({ color, roof, size }).
- Text: models.textSprite(text, { size: 0.5, color, background }) is a camera-facing label in the world (sprite.setText(text) to change it). await models.text3d(text, { size, depth, color, font: "helvetiker_bold" | "helvetiker_regular" | "optimer_bold" | "optimer_regular" }) is centered 3D text.
- Palette: orange, red, yellow, gold, green, grass, leaf, pine, blue, sky, water, purple, pink, white, black, gray, stone, dark, wood, bark, dirt, sand, snow, skin. material(color, { flat, roughness, metalness, emissive, emissiveIntensity, opacity }) returns a shared MeshStandardMaterial.
- Build anything missing from the list by grouping primitives in a THREE.Group, with the origin at the feet and the front facing +Z.
- Geometries and materials are shared, so spawning many copies is cheap. Before changing one object's material, give it its own: mesh.material = mesh.material.clone(). For hundreds of copies of one mesh (grass, asteroids, bricks), use THREE.InstancedMesh.

# glTF models
const { model, animator } = await loadModel(nameOrUrl, { height: 1.8 } or { size: 2 }): a fresh copy per call, feet at y = 0, centered, facing +Z. Add both: game.add(model, animator). animator is null for models without animations.
Free models by name, with their clips:
- robot: Idle, Walking, Running, Jump, WalkJump, Punch, Death, Dance, Wave, Yes, No, ThumbsUp, Sitting, Standing
- soldier: Idle, Walk, Run
- xbot: idle, walk, run, agree, headShake, sad_pose, sneak_pose
- fox: Survey, Walk, Run
- horse, flamingo, parrot, stork: one looping clip each (animator.play(animator.names[0]))
- duck: no animation
animator.play(name, { fade: 0.2, loop: true, timeScale: 1 }) crossfades and is safe to call every frame; names match case-insensitively and by part ("run" finds "Running"). await animator.playOnce("Jump") returns to the previous clip when done ({ then: "Idle" } picks the next one, then: null holds the last frame). animator.names, animator.has(name).
loadModel also takes any .glb/.gltf URL on a CDN that allows cross-origin requests. Models take a moment to download: load them while the title screen shows.

# Physics
Arcade physics with upright boxes, for platformers, top-down games, runners, and shooters. Rotation is ignored.
const physics = new Physics(game, { gravity: -30 }) (gravity: 0 for top-down and space games)
const body = physics.add(object, options), with options:
- type: "dynamic" (the default: moves by velocity and gravity and collides), "static" (floors, walls), or "kinematic" (moved by your code through object.position; carries dynamic bodies standing on it, for moving platforms and elevators).
- sensor: true: nothing is blocked; onEnter/onExit still fire. For pickups, goals, checkpoints, and damage zones.
- size: [w, h, d] (defaults to the object's bounding box), offset, velocity, gravityScale, bounce (0 to 1), friction (horizontal slowdown per second while grounded), drag, tag ("player", "enemy", "coin"), ignore: [tags it passes through].
- onEnter(other, normal) and onExit(other). other is a Body (other.tag, other.object). normal points toward this body: in the player's onEnter, normal.y > 0.5 means the player landed on top of other (stomping an enemy).
A Body has velocity (set it directly to control movement), grounded (standing on something this frame), ground, touching(bodyOrObjectOrTag), contacts, setSize(w, h, d), and enabled.
physics.raycast(origin, direction, maxDistance, { ignore }) returns { body, object, point, distance } or null. physics.query(box3) returns the bodies inside a THREE.Box3. physics.remove(object).
object.position is the truth: teleport by setting it (and body.velocity.set(0, 0, 0)). Put bodies' objects in the scene or in a Group at the origin with no rotation or scale.
Movement: body.velocity.x = direction.x * speed; body.velocity.z = direction.z * speed; jump with if (input.pressed("jump") && body.grounded) body.velocity.y = 11.
For physics with rotation (stacking, rolling, tumbling, ragdolls), use Rapier instead: const RAPIER = (await import("https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.20.0/+esm")).default; await RAPIER.init(); then step a RAPIER.World in onUpdate and copy each body's translation() and rotation() to its mesh.

# Animation
- game.tween(target, props, { duration: 0.5, ease: "outQuad", delay, repeat (Infinity loops), yoyo, onUpdate, onComplete }) returns a tween with stop() and a finished promise. It animates numbers, vectors (a number sets x, y, and z; or pass { x, y, z }), and colors: game.tween(door.position, { y: 3 }), game.tween(mesh, { scale: 1.5, rotation: { y: Math.PI } }), game.tween(mesh.material, { opacity: 0 }). game.tweens.killTweensOf(target).
- Eases: linear, inQuad, outQuad, inOutQuad, inCubic, outCubic, inOutCubic, inSine, outSine, inOutSine, inExpo, outExpo, inBack, outBack, outElastic, outBounce.
- Updaters: spin(object, speed, axis = "y"), bob(object, { height, speed }), pulse(object, { amount, speed }), and combine(...updaters). Use them as coin.update = combine(spin(coin, 3), bob(coin)) before game.add(coin), or with game.onUpdate(spin(windmill, 1)).
- Effects: popIn(game, object) to appear, squash(game, object, { amount }) (positive squashes, negative stretches: jumps, landings, hits), flash(game, object, { color }) for hits, and await fadeTo(game, object, opacity).
- models.character animates itself and glTF models use their animator; animate anything else with tweens, updaters, or code in onUpdate.

# HUD (a DOM overlay that styles itself)
const hud = new Hud(game, { accent: "#EA580C" })
Positions (at): top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right.
- hud.stat(label, value, { at: "top-left", icon }): .set(value) bumps when the value changes.
- hud.bar(label, { value, max, at, color, lowColor, width }): .set(value, max).
- hud.icons(count, { icon: "❤️", max, at }): .set(count), for lives and ammo.
- hud.text(text, { at: "top-center", size: "sm" | "md" | "lg" | "xl", panel }): .set(text).
- hud.controls([["WASD / Arrows", "Move"], ["Space", "Jump"]], { at: "bottom-left" }): key hints that dim after 8 seconds. " / " separates alternative keys.
- hud.crosshair(); hud.label(object, text, { offset: [0, 2.2, 0] }) follows a 3D object; hud.floatText(position, "+10", { color }) pops up and fades; hud.toast("Level 2!", { duration }).
- hud.flash("rgba(255,0,0,.4)") when the player is hurt; await hud.fade(1) and await hud.fade(0) fade to black and back between levels.
- hud.screen({ title, subtitle, text, stats: [["Score", 10]], controls, buttons: [{ label, primary, onClick, close }] }) returns { close() }: a modal card for title, pause, level complete, and game over screens. Clicking a button closes the screen, then runs onClick. Enter presses the primary button.
- Every widget has show(), hide(), and remove(). hud.closeScreens(), hud.clear().

# Sound (sound)
- sound.play(name, { volume, pitch, pan }) plays a built-in synthesized effect: jump, coin, pickup, powerup, laser, shoot, hit, hurt, damage, explosion, click, select, blip, step, land, whoosh, bounce, pop, win, lose. Vary the pitch of repeated sounds (0.9 + Math.random() * 0.2).
- sound.playMusic("arcade" | "chill" | "tense" | "adventure") loops generated music; sound.stopMusic(); sound.setMusicVolume(0 to 1).
- sound.synth({ type: "square" | "sine" | "triangle" | "sawtooth", freq: 440, to: 880, dur: 0.2, vol: 0.3, at: 0 }) or an array of voices makes custom effects; a voice with noise: true, filter: "lowpass" | "highpass" | "bandpass", freq, to, dur is noise.
- await sound.load(name, url), then sound.play(name), for audio files; sound.playMusic(url) loops a file.
- sound.toggleMute() (remembered across reloads). Give games with music a mute key (M).
- Audio starts after the first click or key press: start music from the Play button.

# Particles
const fx = new Particles(game, { max: 1500, shape: "cube" | "sphere" | "tetra", blending: "normal" | "additive" })
fx.explosion(position, { color, scale }), fx.sparkle(position, { color }), fx.hit(position, { color, direction }), fx.dust(position), fx.smoke(position), fx.confetti(position), fx.burst(position, { count, color, colors, speed, direction, spread, size, sizeEnd, life, gravity, drag }), and const stop = fx.trail(object, { color, rate }).

# Post-processing
const post = await createPostFX(game, { bloom: { strength: 0.6, threshold: 0.85 }, outline: { color }, pixelate: { size: 4 }, vignette: true, fxaa: true }): enable only what the look needs, since each effect costs frame time. post.setOutlined(objects) picks what gets the outline. Bloom makes emissive materials glow: material(color, { emissive: color, emissiveIntensity: 2 }).

# Utilities
clamp, lerp, inverseLerp, remap, damp(current, target, lambda, dt) (smooth following; lambda ~10 is snappy), dampVector, dampAngle, approach, wrapAngle, headingFrom(dx, dz), distanceXZ, degToRad, rand(min, max), randInt(min, max), pick(array), chance(probability), shuffle(array), randomInCircle(radius, y) (a Vector3), createRng(seed) (repeatable levels: .next(), .range(), .int(), .pick()), formatTime(seconds) ("1:05").
new StateMachine({ title: { enter, update, exit }, playing: { ... } }, "title") with set(name, data), is(name), update(dt). new Pool(create, reset) with get(), release(item), releaseAll(). storage.get(key, fallback), storage.set(key, value). saveHighScore(key, score, { lowerIsBetter }) returns { best, isNew }.

# Example game.js
A complete small game: title screen, timed round, pickups, jumping, pause, game over with best score, and restart.

\`\`\`js
import {
  THREE, Game, Hud, Physics, Particles, FollowCamera, createEnvironment, models, sound,
  spin, bob, combine, squash, randomInCircle, headingFrom, dampAngle, moveRelativeToCamera,
  saveHighScore, formatTime,
} from "./engine/index.js"

const ROUND_SECONDS = 30
const SPEED = 7
const CONTROLS = [["WASD / Arrows", "Move"], ["Space", "Jump"], ["Esc", "Pause"]]

const game = new Game()
createEnvironment(game, "day")
const physics = new Physics(game)
const hud = new Hud(game)
const fx = new Particles(game)
game.input.enableTouchControls({ buttons: ["jump"] })

// The solid floor; its top surface is y = 0.
const floor = game.add(models.platform({ size: [40, 2, 40] }))
physics.add(floor, { type: "static" })
for (let i = 0; i < 12; i++) {
  const tree = models.tree({ kind: i % 2 ? "pine" : "round", height: 3 + Math.random() * 2 })
  tree.position.copy(randomInCircle(18))
  if (tree.position.length() > 5) game.add(tree)
}

const player = game.add(models.character({ color: models.Palette.orange }))
player.rotation.y = Math.PI // face away from the camera
const body = physics.add(player, { size: [0.8, 1.8, 0.8], tag: "player" })
const camera = new FollowCamera(game, player, { offset: [0, 7, 11] })

// Everything a round creates lives here, so a restart can clear it.
const level = new THREE.Group()
game.add(level)

let score = 0
let timeLeft = 0
let playing = false
const scoreText = hud.stat("Coins", 0)
const timerText = hud.stat("Time", formatTime(ROUND_SECONDS), { at: "top-right" })
hud.controls(CONTROLS)

function spawnCoin() {
  const coin = models.coin()
  coin.position.copy(randomInCircle(17, 1.2))
  coin.update = combine(spin(coin, 3), bob(coin))
  level.add(coin)
  game.add(coin)
  physics.add(coin, {
    type: "static", sensor: true, tag: "coin",
    onEnter: (other) => other.tag === "player" && collect(coin),
  })
}

function collect(coin) {
  if (!playing) return
  score++
  scoreText.set(score)
  sound.play("coin", { pitch: 0.95 + Math.random() * 0.1 })
  fx.sparkle(coin.position, { color: models.Palette.gold })
  hud.floatText(coin.position, "+1", { color: "#fde047" })
  game.remove(coin)
  spawnCoin()
}

function start() {
  score = 0
  timeLeft = ROUND_SECONDS
  scoreText.set(0)
  for (const child of [...level.children]) game.remove(child)
  for (let i = 0; i < 8; i++) spawnCoin()
  player.position.set(0, 0, 0)
  body.velocity.set(0, 0, 0)
  camera.snap()
  playing = true
  sound.playMusic("arcade")
}

function end() {
  playing = false
  sound.stopMusic()
  sound.play(score > 0 ? "win" : "lose")
  const { best, isNew } = saveHighScore("coin-rush-best", score)
  hud.screen({
    title: isNew ? "New record!" : "Time's up!",
    stats: [["Coins", score], ["Best", best]],
    buttons: [{ label: "Play again", primary: true, onClick: start }],
  })
}

function pauseGame() {
  game.pause()
  hud.screen({
    title: "Paused",
    controls: CONTROLS,
    buttons: [{ label: "Resume", primary: true, onClick: () => game.resume() }],
  })
}

game.onUpdate((dt) => {
  const input = game.input
  if (input.pressed("KeyM")) sound.toggleMute()
  let speed = 0
  if (playing) {
    if (input.pressed("pause")) return pauseGame()
    timeLeft -= dt
    timerText.set(formatTime(Math.ceil(timeLeft)))
    if (timeLeft <= 0 || player.position.y < -10) return end()

    const direction = moveRelativeToCamera(game.camera, input.move())
    body.velocity.x = direction.x * SPEED
    body.velocity.z = direction.z * SPEED
    if (direction.lengthSq() > 0.01) {
      player.rotation.y = dampAngle(player.rotation.y, headingFrom(direction.x, direction.z), 12, dt)
    }
    if (input.pressed("jump") && body.grounded) {
      body.velocity.y = 11
      sound.play("jump")
      squash(game, player, { amount: -0.15 })
    }
    speed = Math.hypot(body.velocity.x, body.velocity.z)
  } else {
    body.velocity.x = body.velocity.z = 0
  }
  player.speed = speed
  player.grounded = body.grounded
})

hud.screen({
  title: "Coin Rush",
  subtitle: "Grab as many coins as you can in 30 seconds",
  controls: CONTROLS,
  buttons: [{ label: "Play", primary: true, onClick: start }],
})
\`\`\`

For a 2D-style game, use new Game({ camera: "orthographic", viewHeight: 20 }), keep everything at z = 0 with x right and y up, set the camera with game.camera.position.set(x, y, 100), and use Physics with boxes (gravity -30 for a platformer, 0 for top-down).`,
}

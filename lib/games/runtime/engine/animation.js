// Tweens, easing, procedural motion, hit effects, and glTF clip playback.
import * as THREE from "three"

const report = (error) => (window.reportGameError ?? console.error)(error)
const warned = new Set()
const warnOnce = (message) => {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(message)
}

// ------------------------------------------------------------ easing

const outBounce = (t) => {
  const n = 7.5625
  const d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
  return n * (t -= 2.625 / d) * t + 0.984375
}

/** Easing functions by name; pass the name (e.g. "outBack") or a function as `ease`. */
export const Ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inExpo: (t) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  outExpo: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  inBack: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  outElastic: (t) =>
    t === 0 || t === 1
      ? t
      : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  outBounce,
}

// ------------------------------------------------------------ tweens

class Tween {
  constructor(target, props, options = {}) {
    const {
      duration = 0.5,
      ease = "outQuad",
      delay = 0,
      repeat = 0, // extra plays; Infinity loops forever
      yoyo = false, // every other repeat plays backwards
      onStart,
      onUpdate,
      onComplete,
    } = options
    this.target = target
    this.props = props
    this.duration = duration
    this.ease = typeof ease === "function" ? ease : (Ease[ease] ?? Ease.outQuad)
    this.delay = delay
    this.repeat = repeat
    this.yoyo = yoyo
    this.onStart = onStart
    this.onUpdate = onUpdate
    this.onComplete = onComplete
    this.elapsed = 0
    this.started = false
    this.stopped = false
    this.reversed = false
    this.tracks = []
    /** Resolves when the tween completes or is stopped: `await tween.finished`. */
    this.finished = new Promise((resolve) => (this._resolve = resolve))
  }

  // Captures start values when the tween starts (after its delay), so chained
  // tweens pick up where the previous one left off.
  _setup() {
    for (const [key, to] of Object.entries(this.props)) {
      const current = this.target[key]
      if (typeof current === "number") {
        this.tracks.push({ object: this.target, key, from: current, to: Number(to) })
      } else if (current?.isColor) {
        this.tracks.push({ color: current, from: current.clone(), to: new THREE.Color(to) })
      } else if (current && typeof current === "object") {
        // Vector2/Vector3/Euler: a number sets every axis, or pass {x, y, z} / [x, y, z].
        const goal =
          typeof to === "number"
            ? { x: to, y: to, z: to }
            : Array.isArray(to)
              ? { x: to[0], y: to[1], z: to[2] }
              : to
        for (const axis of ["x", "y", "z"]) {
          if (goal[axis] === undefined || typeof current[axis] !== "number") continue
          this.tracks.push({ object: current, key: axis, from: current[axis], to: goal[axis] })
        }
      } else {
        warnOnce(`tween: "${key}" is not a number, vector, or color on the target`)
      }
    }
  }

  // Returns true when the tween is done.
  _tick(dt) {
    if (this.stopped) return true
    if (this.delay > 0) {
      this.delay -= dt
      if (this.delay > 0) return false
      dt = -this.delay
      this.delay = 0
    }
    if (!this.started) {
      this.started = true
      this._setup()
      this.onStart?.()
    }

    this.elapsed += dt
    const t = this.duration > 0 ? Math.min(this.elapsed / this.duration, 1) : 1
    const k = this.ease(this.reversed ? 1 - t : t)
    for (const track of this.tracks) {
      if (track.color) track.color.lerpColors(track.from, track.to, k)
      else track.object[track.key] = track.from + (track.to - track.from) * k
    }
    this.onUpdate?.(k)
    if (t < 1) return false

    if (this.repeat > 0) {
      this.repeat--
      this.elapsed = 0
      if (this.yoyo) this.reversed = !this.reversed
      return false
    }
    this.onComplete?.()
    this._resolve()
    return true
  }

  /** Stops where it is, without calling onComplete. */
  stop() {
    this.stopped = true
    this._resolve()
  }
}

/** Runs tweens; the game owns one as game.tweens and updates it every frame. */
export class TweenManager {
  constructor() {
    this.tweens = new Set()
  }

  /**
   * Animates properties of `target` to new values over time.
   *
   *   game.tween(mesh.position, { y: 3 }, { duration: 0.4, ease: "outBack" })
   *   game.tween(mesh, { scale: 1.5, rotation: { y: Math.PI } })
   *   game.tween(mesh.material, { opacity: 0, color: "#ff0000" })
   *   await game.tween(door.position, { x: 2 }).finished
   */
  to(target, props, options) {
    const tween = new Tween(target, props, options)
    this.tweens.add(tween)
    return tween
  }

  update(dt) {
    for (const tween of this.tweens) {
      let done
      try {
        done = tween._tick(dt)
      } catch (error) {
        report(error)
        done = true
      }
      if (done) this.tweens.delete(tween)
    }
  }

  /** Stops every tween whose target is `target`. */
  killTweensOf(target) {
    for (const tween of this.tweens) {
      if (tween.target !== target) continue
      tween.stop()
      this.tweens.delete(tween)
    }
  }

  clear() {
    for (const tween of this.tweens) tween.stop()
    this.tweens.clear()
  }
}

// --------------------------------------------------- procedural motion
// Each returns an (dt) => void updater. Use it as a hook, game.onUpdate(spin(coin, 3)),
// or as the object's own update so it stops on game.remove:
// coin.update = combine(spin(coin, 3), bob(coin)); game.add(coin)

/** Rotates around an axis at `speed` radians per second. */
export function spin(object, speed = 1, axis = "y") {
  return (dt) => {
    object.rotation[axis] += speed * dt
  }
}

/** Floats up and down around the current height. */
export function bob(object, { height = 0.2, speed = 2.5 } = {}) {
  const baseY = object.position.y
  let t = Math.random() * 10
  return (dt) => {
    t += dt
    object.position.y = baseY + Math.sin(t * speed) * height
  }
}

/** Breathes in scale around the current scale. */
export function pulse(object, { amount = 0.08, speed = 4 } = {}) {
  const base = object.scale.clone()
  let t = 0
  return (dt) => {
    t += dt
    object.scale.copy(base).multiplyScalar(1 + Math.sin(t * speed) * amount)
  }
}

/** Runs several updaters as one. */
export function combine(...updaters) {
  return (dt, game) => {
    for (const update of updaters) update(dt, game)
  }
}

// ------------------------------------------------------ tween effects

/** Grows the object from nothing to its current scale with an overshoot. */
export function popIn(game, object, { duration = 0.35, delay = 0 } = {}) {
  const { x, y, z } = object.scale
  object.scale.setScalar(0.0001)
  return game.tween(object.scale, { x, y, z }, { duration, delay, ease: "outBack" })
}

/** Squashes (amount > 0) or stretches (amount < 0), then springs back: jumps, landings, hits. */
export function squash(game, object, { amount = 0.25, duration = 0.25 } = {}) {
  const base = (object.userData.baseScale ??= object.scale.clone())
  game.tweens.killTweensOf(object.scale)
  object.scale.set(base.x * (1 + amount), base.y * (1 - amount), base.z * (1 + amount))
  return game.tween(object.scale, { x: base.x, y: base.y, z: base.z }, { duration, ease: "outBack" })
}

// Materials from models.js are shared between objects; give this object its
// own copies before changing them so the effect doesn't leak to others.
function ownMaterials(object, callback) {
  object.traverse((child) => {
    if (!child.isMesh && !child.isSprite) return
    if (!child.userData.ownMaterial) {
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => material.clone())
        : child.material.clone()
      child.userData.ownMaterial = true
    }
    for (const material of [child.material].flat()) callback(material)
  })
}

/** Flashes the object's emissive color, e.g. white when it takes damage. */
export function flash(game, object, { color = 0xffffff, duration = 0.15 } = {}) {
  ownMaterials(object, (material) => {
    if (!material.emissive) return
    material.userData.baseEmissive ??= material.emissive.clone()
    game.tweens.killTweensOf(material)
    material.emissive.set(color)
    game.tween(material, { emissive: material.userData.baseEmissive }, { duration, ease: "inQuad" })
  })
}

/** Fades the object's opacity to `opacity`. Resolves when done. */
export function fadeTo(game, object, opacity, { duration = 0.4 } = {}) {
  const tweens = []
  ownMaterials(object, (material) => {
    material.transparent = true
    game.tweens.killTweensOf(material)
    tweens.push(game.tween(material, { opacity }, { duration }))
  })
  return Promise.all(tweens.map((tween) => tween.finished))
}

// ------------------------------------------------------------ Animator

/**
 * Plays the animation clips of a loaded glTF model with crossfades.
 * loadModel() creates one for animated models. Add it to the game so it updates:
 *
 *   const { model, animator } = await loadModel("robot", { height: 1.8 })
 *   game.add(model, animator)
 *   animator.play("Idle")
 *   animator.play(speed > 0.1 ? "Running" : "Idle")   // safe to call every frame
 *   await animator.playOnce("Jump")                    // then returns to the previous clip
 */
export class Animator {
  constructor(root, clips = []) {
    this.mixer = new THREE.AnimationMixer(root)
    this.clips = clips
    this.actions = new Map()
    this.current = null
    this._pending = new Map()
    this.mixer.addEventListener("finished", (event) => {
      const done = this._pending.get(event.action)
      if (!done) return
      this._pending.delete(event.action)
      done()
    })
  }

  get names() {
    return this.clips.map((clip) => clip.name)
  }

  /** Finds a clip by exact name, then case-insensitively, then by partial name ("run" -> "Running"). */
  find(name) {
    const lower = String(name).toLowerCase()
    return (
      this.clips.find((clip) => clip.name === name) ??
      this.clips.find((clip) => clip.name.toLowerCase() === lower) ??
      this.clips.find((clip) => clip.name.toLowerCase().includes(lower))
    )
  }

  has(name) {
    return !!this.find(name)
  }

  _action(name) {
    const clip = this.find(name)
    if (!clip) return null
    let action = this.actions.get(clip)
    if (!action) {
      action = this.mixer.clipAction(clip)
      this.actions.set(clip, action)
    }
    return action
  }

  /** Crossfades to a clip. Calling it again with the playing clip does nothing. */
  play(name, { fade = 0.2, loop = true, timeScale = 1, restart = false } = {}) {
    const action = this._action(name)
    if (!action) {
      warnOnce(`Animator: no clip matches "${name}". Clips: ${this.names.join(", ")}`)
      return null
    }
    if (action === this.current && !restart) {
      action.setEffectiveTimeScale(timeScale)
      return action
    }
    action.reset()
    action.setEffectiveTimeScale(timeScale)
    action.setEffectiveWeight(1)
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
    action.clampWhenFinished = !loop
    if (this.current && this.current !== action) action.crossFadeFrom(this.current, fade, false)
    action.play()
    this.current = action
    return action
  }

  /**
   * Plays a clip once. When it ends, plays `then` (default: the clip that was
   * playing before; pass null to hold the last frame). Resolves when it ends.
   */
  playOnce(name, { fade = 0.1, timeScale = 1, then } = {}) {
    const previous = this.current?.getClip().name
    const action = this.play(name, { fade, loop: false, timeScale, restart: true })
    if (!action) return Promise.resolve()
    return new Promise((resolve) => {
      this._pending.set(action, () => {
        const next = then === undefined ? previous : then
        if (next && this.current === action) this.play(next, { fade: 0.2 })
        resolve()
      })
    })
  }

  update(dt) {
    this.mixer.update(dt)
  }

  stop() {
    this.mixer.stopAllAction()
    this.current = null
  }
}

// Math, random, flow, and storage helpers shared by the engine and games.
import * as THREE from "three"

// ---------------------------------------------------------------- math

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
export const lerp = (a, b, t) => a + (b - a) * t
export const inverseLerp = (a, b, value) => (a === b ? 0 : (value - a) / (b - a))
export const remap = (value, inMin, inMax, outMin, outMax) =>
  lerp(outMin, outMax, clamp(inverseLerp(inMin, inMax, value), 0, 1))

/**
 * Frame-rate independent smoothing of `current` toward `target`.
 * `lambda` is the sharpness: ~2 is floaty, ~10 is snappy, ~25 is nearly instant.
 */
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

/** Like damp, for a THREE.Vector3/Vector2 (changes `current` in place and returns it). */
export const dampVector = (current, target, lambda, dt) =>
  current.lerp(target, 1 - Math.exp(-lambda * dt))

/** Moves `current` toward `target` by at most `maxStep`. */
export const approach = (current, target, maxStep) =>
  current < target
    ? Math.min(current + maxStep, target)
    : Math.max(current - maxStep, target)

/** Wraps an angle to (-PI, PI]. */
export const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))

/** Like damp, for angles in radians: takes the short way around. */
export const dampAngle = (current, target, lambda, dt) =>
  current + wrapAngle(target - current) * (1 - Math.exp(-lambda * dt))

/** The Y rotation that makes a +Z-facing model face along (dx, dz). */
export const headingFrom = (dx, dz) => Math.atan2(dx, dz)

export const degToRad = THREE.MathUtils.degToRad
export const radToDeg = THREE.MathUtils.radToDeg

/** Distance between two positions on the ground plane, ignoring height. */
export const distanceXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

// -------------------------------------------------------------- random

export const rand = (min = 0, max = 1) => min + Math.random() * (max - min)
/** Random integer from min to max, both included. */
export const randInt = (min, max) => Math.floor(rand(min, max + 1))
export const pick = (items) => items[Math.floor(Math.random() * items.length)]
export const chance = (probability) => Math.random() < probability

/** Shuffles an array in place and returns it. */
export function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

/** A random point on the ground within `radius` of the origin, as a Vector3 at height `y`. */
export function randomInCircle(radius, y = 0) {
  const angle = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.random()) * radius
  return new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r)
}

/** A seeded random generator, for levels that must be the same every time. */
export function createRng(seed = 1) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (min = 0, max = 1) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (probability) => next() < probability,
  }
}

// ---------------------------------------------------------------- flow

/** "1:05" from 65 seconds. */
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/**
 * Game flow states, e.g. title -> playing -> gameover.
 *
 *   const flow = new StateMachine({
 *     title:    { enter() { showTitle() } },
 *     playing:  { enter() { startLevel() }, update(dt) { ... } },
 *     gameover: { enter(prev, data) { showScore(data.score) } },
 *   }, "title")
 *   game.onUpdate((dt) => flow.update(dt))
 *   flow.set("gameover", { score })
 */
export class StateMachine {
  constructor(states, initial) {
    this.states = states
    this.current = null
    this.time = 0 // seconds spent in the current state
    if (initial) this.set(initial)
  }

  set(name, data) {
    if (!this.states[name]) throw new Error(`StateMachine: unknown state "${name}"`)
    const previous = this.current
    if (previous) this.states[previous].exit?.(name, data)
    this.current = name
    this.time = 0
    this.states[name].enter?.(previous, data)
  }

  is(name) {
    return this.current === name
  }

  update(dt) {
    this.time += dt
    if (this.current) this.states[this.current].update?.(dt, this.time)
  }
}

/**
 * Reuses objects instead of creating and garbage-collecting them (bullets, enemies).
 *
 *   const bullets = new Pool(() => makeBullet(), (b) => { b.visible = true })
 *   const b = bullets.get(); ...; bullets.release(b)
 */
export class Pool {
  constructor(create, reset) {
    this.create = create
    this.reset = reset
    this.free = []
    this.active = new Set()
  }

  get() {
    const item = this.free.pop() ?? this.create()
    this.reset?.(item)
    this.active.add(item)
    return item
  }

  release(item) {
    if (!this.active.delete(item)) return
    this.free.push(item)
  }

  releaseAll() {
    for (const item of this.active) this.free.push(item)
    this.active.clear()
  }
}

// ------------------------------------------------------------- storage

/** localStorage that never throws: storage may be blocked inside the preview iframe. */
export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : JSON.parse(raw)
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage unavailable: the value only lives for this session.
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Ignored, as above.
    }
  },
}

/**
 * Records a score and returns the best one so far.
 * Pass `lowerIsBetter: true` for times.
 */
export function saveHighScore(key, score, { lowerIsBetter = false } = {}) {
  const previous = storage.get(key, null)
  const isNew =
    previous === null || (lowerIsBetter ? score < previous : score > previous)
  if (isNew) storage.set(key, score)
  return { best: isNew ? score : previous, isNew }
}

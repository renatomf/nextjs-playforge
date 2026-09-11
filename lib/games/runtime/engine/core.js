// The game loop: renderer, scene, camera, frame phases, timers, and events.
import * as THREE from "three"

import { TweenManager } from "./animation.js"
import { Input } from "./input.js"

/** Shows an error through engine/errors.js when it is loaded, else logs it. */
export function reportError(error) {
  if (window.reportGameError) window.reportGameError(error)
  else console.error(error)
}

const _plane = new THREE.Plane()
const _up = new THREE.Vector3(0, 1, 0)
const _v = new THREE.Vector3()

/**
 * Owns the renderer, scene, and camera, and runs the frame loop.
 *
 * Each frame, while not paused:
 *   timers -> onUpdate callbacks -> update(dt) of objects passed to add()
 *   -> tweens -> physics -> onLateUpdate callbacks (cameras)
 * Then every frame, even while paused: onRender callbacks -> render.
 *
 * An error thrown by a callback is reported and the loop keeps running.
 */
export class Game {
  constructor({
    container = document.body,
    camera = "perspective", // or "orthographic"
    fov = 60,
    near = 0.1,
    far = 1000,
    viewHeight = 20, // orthographic only: world units visible vertically
    background = 0x111116, // any THREE.Color value, or null for a transparent canvas
    shadows = true,
    antialias = true,
    maxPixelRatio = 2,
    toneMapping = THREE.NeutralToneMapping,
    exposure = 1,
    maxDelta = 0.05, // longest frame step in seconds, so a hitch can't tunnel objects
    autoStart = true,
  } = {}) {
    this.container = container
    this.maxDelta = maxDelta
    this.viewHeight = viewHeight

    this.scene = new THREE.Scene()
    if (background !== null) this.scene.background = new THREE.Color(background)

    this.renderer = new THREE.WebGLRenderer({
      antialias,
      alpha: background === null,
      powerPreference: "high-performance",
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio))
    this.renderer.toneMapping = toneMapping
    this.renderer.toneMappingExposure = exposure
    this.renderer.shadowMap.enabled = shadows
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    if (background === null) this.renderer.setClearColor(0x000000, 0)

    this.canvas = this.renderer.domElement
    this.canvas.tabIndex = 0
    this.canvas.className = "game-canvas"
    Object.assign(this.canvas.style, {
      display: "block",
      width: "100%",
      height: "100%",
      outline: "none",
      touchAction: "none",
      userSelect: "none",
      webkitUserSelect: "none",
    })
    if (container === document.body) {
      Object.assign(this.canvas.style, { position: "fixed", inset: "0" })
    }
    container.appendChild(this.canvas)

    const orthographic = camera === "orthographic" || camera === "ortho"
    this.camera = orthographic
      ? new THREE.OrthographicCamera(-1, 1, 1, -1, near, far)
      : new THREE.PerspectiveCamera(fov, 1, near, far)
    if (orthographic) this.camera.position.set(0, 0, 100)
    else this.camera.position.set(0, 6, 12)
    this.camera.lookAt(0, 0, 0)
    // In the scene so objects attached to the camera (a held weapon) render.
    this.scene.add(this.camera)

    this.input = new Input(this.canvas)
    this.tweens = new TweenManager()
    this.raycaster = new THREE.Raycaster()
    this.time = { elapsed: 0, delta: 0, frame: 0, scale: 1 }
    this.paused = false
    this.running = false
    /** Set by createPostFX; replaces renderer.render when present. */
    this.renderFn = null
    this.width = 0
    this.height = 0

    this._hooks = {
      update: new Set(),
      physics: new Set(),
      late: new Set(),
      render: new Set(),
    }
    this._entities = new Set()
    this._timers = new Set()
    this._events = new Map()
    this._shake = { strength: 0, duration: 0, remaining: 0, offset: new THREE.Vector3() }
    this._last = null

    this._frame = this._frame.bind(this)
    this._resizeObserver = new ResizeObserver(() => this.resize())
    this._resizeObserver.observe(this.canvas)
    this.resize()
    if (autoStart) this.start()
  }

  get aspect() {
    return this.width / this.height
  }

  // ------------------------------------------------------------ loop

  start() {
    if (this.running) return
    this.running = true
    this._last = null
    this.renderer.setAnimationLoop(this._frame)
  }

  stop() {
    this.running = false
    this.renderer.setAnimationLoop(null)
  }

  pause() {
    if (this.paused) return
    this.paused = true
    this.emit("pause")
  }

  resume() {
    if (!this.paused) return
    this.paused = false
    this.emit("resume")
  }

  togglePause() {
    if (this.paused) this.resume()
    else this.pause()
    return this.paused
  }

  _frame(now) {
    const realDelta =
      this._last === null ? 0 : Math.min((now - this._last) / 1000, this.maxDelta)
    this._last = now
    this.input._poll()

    if (this.paused) this.time.delta = 0
    else this._step(realDelta * this.time.scale)

    this._run(this._hooks.render, realDelta)
    this._applyShake(realDelta)
    try {
      this.render()
    } catch (error) {
      reportError(error)
    }
    this._clearShake()
    this.input._endFrame()
  }

  _step(dt) {
    const time = this.time
    time.delta = dt
    time.elapsed += dt
    time.frame++

    for (const timer of this._timers) {
      timer.remaining -= dt
      if (timer.remaining > 0) continue
      if (timer.interval) timer.remaining += timer.interval
      else this._timers.delete(timer)
      try {
        timer.fn()
      } catch (error) {
        reportError(error)
      }
    }

    this._run(this._hooks.update, dt)
    for (const entity of this._entities) {
      try {
        entity.update(dt, this)
      } catch (error) {
        reportError(error)
      }
    }
    this.tweens.update(dt)
    this._run(this._hooks.physics, dt)
    this._run(this._hooks.late, dt)
  }

  _run(callbacks, dt) {
    for (const fn of callbacks) {
      try {
        fn(dt, this)
      } catch (error) {
        reportError(error)
      }
    }
  }

  render() {
    if (this.renderFn) this.renderFn()
    else this.renderer.render(this.scene, this.camera)
  }

  // ----------------------------------------------------------- hooks

  /** Runs fn(dt, game) every frame while not paused. Returns a function that stops it. */
  onUpdate(fn) {
    return this._hook("update", fn)
  }

  /** Like onUpdate, but after physics: use it for cameras and anything that follows an object. */
  onLateUpdate(fn) {
    return this._hook("late", fn)
  }

  /** Runs fn(realDt, game) right before every render, even while paused. */
  onRender(fn) {
    return this._hook("render", fn)
  }

  _hook(phase, fn) {
    const callbacks = this._hooks[phase]
    callbacks.add(fn)
    return () => callbacks.delete(fn)
  }

  // --------------------------------------------------------- objects

  /**
   * Adds objects to the scene (if not already parented) and, for objects with
   * an update(dt, game) method, calls it every frame until remove().
   * Works for non-3D objects with update() too (an Animator, a spawner).
   * Returns the first object.
   */
  add(...items) {
    for (const item of items) {
      if (!item) continue
      if (item.isObject3D && !item.parent) this.scene.add(item)
      if (typeof item.update === "function" && !item.isLOD && !item.isCubeCamera) {
        this._entities.add(item)
      }
    }
    return items[0]
  }

  /** Removes objects from the scene, stops their update(), and drops their physics bodies and HUD labels. */
  remove(...items) {
    for (const item of items) {
      if (!item) continue
      if (item.isObject3D) item.removeFromParent()
      this._entities.delete(item)
      this.emit("remove", item)
    }
  }

  // ---------------------------------------------------------- timers

  /** Calls fn once after `seconds` of game time (paused with the game). Returns a cancel function. */
  after(seconds, fn) {
    const timer = { remaining: seconds, fn }
    this._timers.add(timer)
    return () => this._timers.delete(timer)
  }

  /** Calls fn every `seconds` of game time. Returns a cancel function. */
  every(seconds, fn) {
    const timer = { remaining: seconds, interval: seconds, fn }
    this._timers.add(timer)
    return () => this._timers.delete(timer)
  }

  /** Resolves after `seconds` of game time: `await game.wait(1)`. */
  wait(seconds) {
    return new Promise((resolve) => this.after(seconds, resolve))
  }

  clearTimers() {
    this._timers.clear()
  }

  /** Shorthand for game.tweens.to(target, props, options). See animation.js. */
  tween(target, props, options) {
    return this.tweens.to(target, props, options)
  }

  // ---------------------------------------------------------- events

  on(name, fn) {
    let listeners = this._events.get(name)
    if (!listeners) this._events.set(name, (listeners = new Set()))
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  once(name, fn) {
    const off = this.on(name, (...args) => {
      off()
      fn(...args)
    })
    return off
  }

  emit(name, ...args) {
    const listeners = this._events.get(name)
    if (!listeners) return
    for (const fn of [...listeners]) {
      try {
        fn(...args)
      } catch (error) {
        reportError(error)
      }
    }
  }

  // ---------------------------------------------------------- camera

  /** Shakes the camera: strength in world units, decaying over `duration` seconds. */
  shake(strength = 0.3, duration = 0.3) {
    const shake = this._shake
    shake.strength = shake.remaining > 0 ? Math.max(shake.strength, strength) : strength
    shake.duration = duration
    shake.remaining = duration
  }

  _applyShake(dt) {
    const shake = this._shake
    if (shake.remaining <= 0) return
    shake.remaining = Math.max(0, shake.remaining - dt)
    const k = shake.strength * (shake.remaining / shake.duration)
    shake.offset.set(
      (Math.random() * 2 - 1) * k,
      (Math.random() * 2 - 1) * k,
      (Math.random() * 2 - 1) * k
    )
    this.camera.position.add(shake.offset)
  }

  _clearShake() {
    const offset = this._shake.offset
    if (offset.x === 0 && offset.y === 0 && offset.z === 0) return
    this.camera.position.sub(offset)
    offset.set(0, 0, 0)
  }

  /** Orthographic only: how many world units fit vertically. */
  setViewHeight(height) {
    this.viewHeight = height
    this._updateProjection()
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth)
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight)
    if (width === this.width && height === this.height) return
    this.width = width
    this.height = height
    this.renderer.setSize(width, height, false)
    this._updateProjection()
    this.emit("resize", width, height)
  }

  _updateProjection() {
    const camera = this.camera
    const aspect = this.width / this.height
    if (camera.isOrthographicCamera) {
      const half = this.viewHeight / 2
      camera.left = -half * aspect
      camera.right = half * aspect
      camera.top = half
      camera.bottom = -half
    } else {
      camera.aspect = aspect
    }
    camera.updateProjectionMatrix()
  }

  // --------------------------------------------------------- picking

  /** The raycaster aimed from the camera through the pointer. */
  pointerRay() {
    this.raycaster.setFromCamera(this.input.pointer.ndc, this.camera)
    return this.raycaster
  }

  /** The closest intersection under the pointer among `objects` (and their children), or null. */
  pick(objects = this.scene.children, recursive = true) {
    const list = Array.isArray(objects) ? objects : [objects]
    return this.pointerRay().intersectObjects(list, recursive)[0] ?? null
  }

  /** Where the pointer ray hits the horizontal plane at `height` (null if it points away). */
  pointerOnPlane(height = 0, target = new THREE.Vector3()) {
    _plane.set(_up, -height)
    return this.pointerRay().ray.intersectPlane(_plane, target)
  }

  /** CSS pixel position of a world position, and whether it is in front of the camera. */
  worldToScreen(position, target = {}) {
    _v.copy(position).project(this.camera)
    target.x = ((_v.x + 1) / 2) * this.width
    target.y = ((1 - _v.y) / 2) * this.height
    target.visible = _v.z > -1 && _v.z < 1
    return target
  }

  dispose() {
    this.stop()
    this._resizeObserver.disconnect()
    this.input.dispose()
    this.renderer.dispose()
    this.canvas.remove()
  }
}

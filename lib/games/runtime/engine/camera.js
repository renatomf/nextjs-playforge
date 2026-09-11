// Camera rigs. Each one registers itself with the game and moves game.camera
// after physics every frame; create at most one at a time (dispose() the old one).
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"

import { clamp, dampVector } from "./utils.js"

const UP = new THREE.Vector3(0, 1, 0)
const _forward = new THREE.Vector3()
const _right = new THREE.Vector3()
const _v = new THREE.Vector3()
const _euler = new THREE.Euler()

const toVector = (value, fallback) =>
  value?.isVector3
    ? value.clone()
    : Array.isArray(value)
      ? new THREE.Vector3(...value)
      : new THREE.Vector3(...fallback)

// Horizontal direction for input.move() given a camera yaw angle.
function moveFromYaw(yaw, move, target) {
  _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw))
  _right.set(Math.cos(yaw), 0, -Math.sin(yaw))
  return target.copy(_right).multiplyScalar(move.x).addScaledVector(_forward, move.y)
}

/**
 * Turns input.move() into a world direction on the ground (XZ), relative to
 * where the camera looks: up/W walks away from the camera. Length <= 1.
 */
export function moveRelativeToCamera(camera, move, target = new THREE.Vector3()) {
  camera.getWorldDirection(_forward)
  _forward.y = 0
  if (_forward.lengthSq() < 1e-6) _forward.set(0, 0, -1)
  _forward.normalize()
  _right.crossVectors(_forward, UP).normalize()
  return target.copy(_right).multiplyScalar(move.x).addScaledVector(_forward, move.y)
}

/**
 * Follows a target from a fixed offset, smoothly. Covers chase, top-down,
 * isometric, and side-scroller cameras:
 *
 *   new FollowCamera(game, player)                                  // behind and above
 *   new FollowCamera(game, player, { offset: [0, 18, 0.01] })       // top-down
 *   new FollowCamera(game, player, { offset: [10, 12, 10] })        // isometric
 *   new FollowCamera(game, player, { offset: [0, 2, 14] })          // side view
 *   new FollowCamera(game, car, { rotateWithTarget: true })         // chase, turns with the car
 */
export class FollowCamera {
  constructor(game, target, { offset = [0, 6, 10], lookOffset = [0, 1, 0], smoothing = 6, rotateWithTarget = false } = {}) {
    this.game = game
    this.camera = game.camera
    this.target = target
    this.offset = toVector(offset, [0, 6, 10])
    this.lookOffset = toVector(lookOffset, [0, 1, 0])
    this.smoothing = smoothing // 0 = rigid
    this.rotateWithTarget = rotateWithTarget
    this.enabled = true
    this._look = new THREE.Vector3()
    this._desired = new THREE.Vector3()
    this._off = game.onLateUpdate((dt) => this.update(dt))
    this.snap()
  }

  _targetPosition(out) {
    return this.target.getWorldPosition(out)
  }

  _computeDesired() {
    const desired = this._desired.copy(this.offset)
    if (this.rotateWithTarget) {
      _euler.setFromQuaternion(this.target.getWorldQuaternion(new THREE.Quaternion()), "YXZ")
      desired.applyAxisAngle(UP, _euler.y)
    }
    return desired.add(this._targetPosition(_v))
  }

  update(dt) {
    if (!this.enabled || !this.target) return
    const desired = this._computeDesired()
    const look = this._targetPosition(_v).add(this.lookOffset)
    if (this.smoothing > 0) {
      dampVector(this.camera.position, desired, this.smoothing, dt)
      dampVector(this._look, look, this.smoothing * 1.5, dt)
    } else {
      this.camera.position.copy(desired)
      this._look.copy(look)
    }
    this.camera.lookAt(this._look)
  }

  /** Jumps straight to the target, e.g. after a respawn. */
  snap() {
    if (!this.target) return
    this.camera.position.copy(this._computeDesired())
    this._look.copy(this._targetPosition(_v)).add(this.lookOffset)
    this.camera.lookAt(this._look)
  }

  dispose() {
    this._off()
  }
}

/**
 * Orbits a target; drag (or pointer lock) and the right stick turn it, the
 * wheel zooms. Move the player with rig.moveDirection(input.move()).
 */
export class ThirdPersonCamera {
  constructor(game, target, {
    distance = 6,
    height = 1.6, // look-at point above the target's origin
    yaw = 0, // 0 = camera on the target's +Z side
    pitch = 0.35,
    minPitch = -0.3,
    maxPitch = 1.2,
    minDistance = 2,
    maxDistance = 14,
    sensitivity = 0.005,
    pointerLock = false, // true: click locks the mouse, like a shooter
    smoothing = 14,
  } = {}) {
    Object.assign(this, { game, target, distance, height, yaw, pitch, minPitch, maxPitch, minDistance, maxDistance, sensitivity, pointerLock, smoothing })
    this.camera = game.camera
    this.enabled = true
    this._pivot = target.getWorldPosition(new THREE.Vector3())
    this._pivot.y += height
    this._off = game.onLateUpdate((dt) => this.update(dt))
    this._onDown = () => {
      if (this.pointerLock && this.enabled && !game.paused) game.input.lockPointer()
    }
    game.canvas.addEventListener("pointerdown", this._onDown)
    this.update(0)
  }

  update(dt) {
    if (!this.enabled) return
    const input = this.game.input
    const pointer = input.pointer
    if (input.pointerLocked || (!this.pointerLock && pointer.isDown)) {
      this.yaw -= pointer.dx * this.sensitivity
      this.pitch += pointer.dy * this.sensitivity
    }
    const look = input.look()
    this.yaw -= look.x * 2.5 * dt
    this.pitch += look.y * 2 * dt
    if (pointer.wheel) {
      this.distance = clamp(this.distance * (1 + pointer.wheel * 0.001), this.minDistance, this.maxDistance)
    }
    this.pitch = clamp(this.pitch, this.minPitch, this.maxPitch)

    const pivot = this.target.getWorldPosition(_v)
    pivot.y += this.height
    if (this.smoothing > 0 && dt > 0) dampVector(this._pivot, pivot, this.smoothing, dt)
    else this._pivot.copy(pivot)

    const cosPitch = Math.cos(this.pitch)
    this.camera.position.set(
      this._pivot.x + Math.sin(this.yaw) * cosPitch * this.distance,
      this._pivot.y + Math.sin(this.pitch) * this.distance,
      this._pivot.z + Math.cos(this.yaw) * cosPitch * this.distance
    )
    this.camera.lookAt(this._pivot)
  }

  /** World direction on the ground for input.move(), relative to the camera. */
  moveDirection(move, target = new THREE.Vector3()) {
    return moveFromYaw(this.yaw, move, target)
  }

  dispose() {
    this._off()
    this.game.canvas.removeEventListener("pointerdown", this._onDown)
  }
}

/**
 * Mouse look from the eyes of `target` (or from wherever you put the camera
 * if there is no target). Clicking the canvas locks the pointer; Esc frees it.
 */
export class FirstPersonCamera {
  constructor(game, { target = null, height = 1.6, sensitivity = 0.0022, pointerLock = true, yaw = 0, pitch = 0 } = {}) {
    Object.assign(this, { game, target, height, sensitivity, pointerLock, yaw, pitch })
    this.camera = game.camera
    this.camera.rotation.order = "YXZ"
    this.enabled = true
    this._off = game.onLateUpdate((dt) => this.update(dt))
    this._onDown = () => {
      if (this.pointerLock && this.enabled && !game.paused) game.input.lockPointer()
    }
    game.canvas.addEventListener("pointerdown", this._onDown)
    this.update(0)
  }

  update(dt) {
    if (!this.enabled) return
    const input = this.game.input
    const pointer = input.pointer
    if (input.pointerLocked || (!this.pointerLock && pointer.isDown)) {
      this.yaw -= pointer.dx * this.sensitivity
      this.pitch -= pointer.dy * this.sensitivity
    }
    const look = input.look()
    this.yaw -= look.x * 2.5 * dt
    this.pitch -= look.y * 2 * dt
    this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01)
    this.camera.rotation.set(this.pitch, this.yaw, 0)
    if (this.target) {
      this.target.getWorldPosition(_v)
      this.camera.position.set(_v.x, _v.y + this.height, _v.z)
    }
  }

  /** World direction on the ground for input.move(), relative to where the player looks. */
  moveDirection(move, target = new THREE.Vector3()) {
    return moveFromYaw(this.yaw, move, target)
  }

  /** Full 3D look direction (for shooting). */
  lookDirection(target = new THREE.Vector3()) {
    return this.camera.getWorldDirection(target)
  }

  dispose() {
    this._off()
    this.game.canvas.removeEventListener("pointerdown", this._onDown)
    this.game.input.unlockPointer()
  }
}

/** Drag to orbit, wheel to zoom: for puzzles, board games, builders, and showcases. */
export class OrbitCamera {
  constructor(game, {
    target = [0, 0, 0],
    minDistance = 2,
    maxDistance = 60,
    maxPolarAngle = Math.PI * 0.49, // keeps the camera above the ground
    enablePan = false,
    autoRotate = false,
    autoRotateSpeed = 1,
  } = {}) {
    this.game = game
    this.controls = new OrbitControls(game.camera, game.canvas)
    Object.assign(this.controls, { minDistance, maxDistance, maxPolarAngle, enablePan, autoRotate, autoRotateSpeed })
    this.controls.enableDamping = true
    this.controls.target.copy(toVector(target, [0, 0, 0]))
    this._off = game.onLateUpdate((dt) => this.controls.update(dt))
    this.controls.update()
  }

  get target() {
    return this.controls.target
  }

  dispose() {
    this._off()
    this.controls.dispose()
  }
}

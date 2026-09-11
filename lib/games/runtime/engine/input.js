// Keyboard, mouse, touch, and gamepad input, read by name each frame.
import * as THREE from "three"

/**
 * Action names and the inputs that trigger them. Codes are KeyboardEvent.code
 * values ("KeyW", "Space", "ArrowLeft", "ShiftLeft"), "Mouse0" (left),
 * "Mouse1" (middle), "Mouse2" (right), and gamepad buttons (see PAD_BUTTONS).
 */
export const DEFAULT_BINDINGS = {
  left: ["KeyA", "ArrowLeft", "PadLeft"],
  right: ["KeyD", "ArrowRight", "PadRight"],
  up: ["KeyW", "ArrowUp", "PadUp"],
  down: ["KeyS", "ArrowDown", "PadDown"],
  jump: ["Space", "PadA"],
  fire: ["KeyF", "KeyJ", "Mouse0", "PadRT", "PadX"],
  action: ["KeyE", "Enter", "PadY"],
  sprint: ["ShiftLeft", "ShiftRight", "PadB", "PadLB"],
  pause: ["Escape", "KeyP", "PadStart"],
}

// Standard gamepad mapping, by button index.
export const PAD_BUTTONS = [
  "PadA", "PadB", "PadX", "PadY", "PadLB", "PadRB", "PadLT", "PadRT",
  "PadSelect", "PadStart", "PadLS", "PadRS", "PadUp", "PadDown", "PadLeft", "PadRight",
]

// Keys whose default action (scrolling the page) would fight the game.
const PREVENT_DEFAULT = new Set([
  "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown",
])

const isTyping = (target) =>
  target instanceof Element && !!target.closest("input, textarea, select, [contenteditable]")

const TOUCH_CSS = `
.touch-controls{position:fixed;inset:0;pointer-events:none;z-index:20;user-select:none;-webkit-user-select:none}
.touch-stick{position:absolute;left:max(20px,env(safe-area-inset-left));bottom:max(20px,env(safe-area-inset-bottom));width:132px;height:132px;border-radius:50%;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.22);pointer-events:auto;touch-action:none}
.touch-knob{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(255,255,255,.4);box-shadow:0 4px 14px rgba(0,0,0,.3)}
.touch-buttons{position:absolute;right:max(20px,env(safe-area-inset-right));bottom:max(20px,env(safe-area-inset-bottom));display:flex;flex-wrap:wrap-reverse;flex-direction:row-reverse;gap:14px;max-width:190px;justify-content:flex-start}
.touch-button{width:74px;height:74px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.28);color:#fff;font:700 13px/1 system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em;pointer-events:auto;touch-action:none}
.touch-button.is-down{background:rgba(234,88,12,.55);border-color:rgba(255,255,255,.5)}
`

/**
 * Created by Game as game.input. Read it in onUpdate:
 *
 *   if (input.pressed("jump")) ...   // went down this frame
 *   if (input.down("fire")) ...      // held
 *   const move = input.move()        // Vector2, x right, y up/forward, length <= 1
 */
export class Input {
  constructor(element) {
    this.element = element
    this.bindings = Object.fromEntries(
      Object.entries(DEFAULT_BINDINGS).map(([action, codes]) => [action, [...codes]])
    )
    this.deadzone = 0.2
    /** Pointer position over the canvas, in CSS pixels and normalized device coordinates. */
    this.pointer = {
      x: 0,
      y: 0,
      ndc: new THREE.Vector2(),
      dx: 0, // movement this frame (also works while the pointer is locked)
      dy: 0,
      wheel: 0, // wheel delta this frame, positive = scroll down
      isDown: false,
      type: "mouse",
    }
    /** Left gamepad stick (x right, y up) and right stick (x right, y down, like mouse movement). */
    this.stick = new THREE.Vector2()
    this.rightStick = new THREE.Vector2()
    this.gamepad = null

    this._down = new Set()
    this._pressed = new Set()
    this._released = new Set()
    this._touchStick = new THREE.Vector2()
    this._move = new THREE.Vector2()
    this._cleanup = []
    this._touchRoot = null

    this._listen(window, "keydown", (event) => {
      if (isTyping(event.target)) return
      if (PREVENT_DEFAULT.has(event.code)) event.preventDefault()
      this._press(event.code)
    })
    this._listen(window, "keyup", (event) => this._release(event.code))
    this._listen(window, "blur", () => this.reset())
    this._listen(document, "visibilitychange", () => {
      if (document.hidden) this.reset()
    })

    this._listen(element, "pointerdown", (event) => {
      element.focus({ preventScroll: true })
      this._updatePointer(event)
      this.pointer.isDown = true
      this.pointer.type = event.pointerType
      this._press(`Mouse${event.button}`)
      try {
        element.setPointerCapture(event.pointerId)
      } catch {
        // Not capturable (e.g. the pointer is already gone): harmless.
      }
    })
    this._listen(element, "pointermove", (event) => {
      this._updatePointer(event)
      this.pointer.dx += event.movementX || 0
      this.pointer.dy += event.movementY || 0
    })
    const up = (event) => {
      this._release(`Mouse${event.button}`)
      this.pointer.isDown = event.buttons !== 0
    }
    this._listen(element, "pointerup", up)
    this._listen(element, "pointercancel", up)
    this._listen(
      element,
      "wheel",
      (event) => {
        event.preventDefault()
        this.pointer.wheel += event.deltaY
      },
      { passive: false }
    )
    this._listen(element, "contextmenu", (event) => event.preventDefault())
  }

  _listen(target, type, fn, options) {
    target.addEventListener(type, fn, options)
    this._cleanup.push(() => target.removeEventListener(type, fn, options))
  }

  _updatePointer(event) {
    const rect = this.element.getBoundingClientRect()
    this.pointer.x = event.clientX - rect.left
    this.pointer.y = event.clientY - rect.top
    this.pointer.ndc.set(
      (this.pointer.x / rect.width) * 2 - 1,
      -(this.pointer.y / rect.height) * 2 + 1
    )
  }

  _press(code) {
    if (this._down.has(code)) return
    this._down.add(code)
    this._pressed.add(code)
  }

  _release(code) {
    if (!this._down.delete(code)) return
    this._released.add(code)
  }

  _codes(name) {
    return this.bindings[name] ?? [name]
  }

  _check(set, name) {
    if (set.has(`Touch:${name}`)) return true
    for (const code of this._codes(name)) if (set.has(code)) return true
    return false
  }

  // ------------------------------------------------------------- read

  /** True while an action ("jump") or raw code ("KeyQ", "Mouse2", "PadB") is held. */
  down(name) {
    return this._check(this._down, name)
  }

  /** True only on the frame the action or code went down. */
  pressed(name) {
    return this._check(this._pressed, name)
  }

  /** True only on the frame the action or code was let go. */
  released(name) {
    return this._check(this._released, name)
  }

  /** True on the frame anything was pressed: a key, a click or tap, a gamepad button. */
  anyPressed() {
    return this._pressed.size > 0
  }

  /** -1, 0, or 1 from two actions or codes, e.g. axis("left", "right"). */
  axis(negative, positive) {
    return (this.down(positive) ? 1 : 0) - (this.down(negative) ? 1 : 0)
  }

  /**
   * Movement from WASD/arrows, the gamepad stick, and the touch joystick:
   * x is right (+) / left (-), y is up or forward (+) / down or back (-).
   * Length is at most 1. Returns a shared Vector2: copy it to keep it.
   */
  move() {
    const move = this._move.set(this.axis("left", "right"), this.axis("down", "up"))
    move.add(this.stick).add(this._touchStick)
    if (move.lengthSq() > 1) move.normalize()
    return move
  }

  /** Right gamepad stick, for looking around. x right, y down. */
  look() {
    return this.rightStick
  }

  /** Replaces the inputs of an action: bind("jump", ["Space", "KeyW"]). */
  bind(action, codes) {
    this.bindings[action] = Array.isArray(codes) ? [...codes] : [codes]
  }

  /** Forgets every held input, e.g. after a menu closes or the window loses focus. */
  reset() {
    for (const code of this._down) this._released.add(code)
    this._down.clear()
    this._pressed.clear()
    this.pointer.isDown = false
    this._touchStick.set(0, 0)
  }

  // ---------------------------------------------------- pointer lock

  get pointerLocked() {
    return document.pointerLockElement === this.element
  }

  /** Hides the cursor and reports raw mouse movement. Must run inside a click or key handler. */
  lockPointer() {
    if (this.pointerLocked) return
    try {
      const result = this.element.requestPointerLock?.()
      result?.catch?.(() => {})
    } catch {
      // The browser refused (no user gesture): the next click can try again.
    }
  }

  unlockPointer() {
    if (this.pointerLocked) document.exitPointerLock()
  }

  // ------------------------------------------------------------ touch

  /**
   * Adds an on-screen joystick (feeds move()) and buttons that trigger actions.
   * Only shows on touch devices unless `force` is true. Returns whether it showed.
   *
   *   input.enableTouchControls({ buttons: ["jump", { action: "fire", label: "🔥" }] })
   */
  enableTouchControls({ joystick = true, buttons = ["jump"], force = false } = {}) {
    const touch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0
    if (!force && !touch) return false
    if (this._touchRoot) return true

    if (!document.getElementById("touch-controls-style")) {
      const style = document.createElement("style")
      style.id = "touch-controls-style"
      style.textContent = TOUCH_CSS
      document.head.appendChild(style)
    }

    const root = document.createElement("div")
    root.className = "touch-controls"
    document.body.appendChild(root)
    this._touchRoot = root

    if (joystick) {
      const stick = document.createElement("div")
      stick.className = "touch-stick"
      const knob = document.createElement("div")
      knob.className = "touch-knob"
      stick.appendChild(knob)
      root.appendChild(stick)

      let activeId = null
      const moveKnob = (event) => {
        const rect = stick.getBoundingClientRect()
        const radius = rect.width / 2
        let dx = event.clientX - (rect.left + radius)
        let dy = event.clientY - (rect.top + radius)
        const length = Math.hypot(dx, dy)
        if (length > radius) {
          dx = (dx / length) * radius
          dy = (dy / length) * radius
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`
        this._touchStick.set(dx / radius, -dy / radius)
      }
      const endStick = (event) => {
        if (event.pointerId !== activeId) return
        activeId = null
        knob.style.transform = ""
        this._touchStick.set(0, 0)
      }
      stick.addEventListener("pointerdown", (event) => {
        event.preventDefault()
        activeId = event.pointerId
        stick.setPointerCapture(event.pointerId)
        moveKnob(event)
      })
      stick.addEventListener("pointermove", (event) => {
        if (event.pointerId === activeId) moveKnob(event)
      })
      stick.addEventListener("pointerup", endStick)
      stick.addEventListener("pointercancel", endStick)
    }

    if (buttons.length) {
      const group = document.createElement("div")
      group.className = "touch-buttons"
      root.appendChild(group)
      for (const entry of buttons) {
        const { action, label } =
          typeof entry === "string" ? { action: entry, label: entry } : entry
        const button = document.createElement("div")
        button.className = "touch-button"
        button.textContent = label ?? action
        const code = `Touch:${action}`
        const release = () => {
          button.classList.remove("is-down")
          this._release(code)
        }
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault()
          button.setPointerCapture(event.pointerId)
          button.classList.add("is-down")
          this._press(code)
        })
        button.addEventListener("pointerup", release)
        button.addEventListener("pointercancel", release)
        group.appendChild(button)
      }
    }
    return true
  }

  // -------------------------------------------------------- per frame

  _poll() {
    let pads = []
    try {
      pads = navigator.getGamepads?.() ?? []
    } catch {
      // Blocked by the iframe's permissions policy.
    }
    let pad = null
    for (const candidate of pads) {
      if (candidate?.connected) {
        pad = candidate
        break
      }
    }
    this.gamepad = pad

    if (!pad) {
      this.stick.set(0, 0)
      this.rightStick.set(0, 0)
      for (const code of PAD_BUTTONS) this._release(code)
      return
    }

    pad.buttons.forEach((button, index) => {
      const code = PAD_BUTTONS[index]
      if (!code) return
      if (button.pressed || button.value > 0.5) this._press(code)
      else this._release(code)
    })
    const dz = (value = 0) =>
      Math.abs(value) < this.deadzone
        ? 0
        : (value - Math.sign(value) * this.deadzone) / (1 - this.deadzone)
    this.stick.set(dz(pad.axes[0]), -dz(pad.axes[1]))
    this.rightStick.set(dz(pad.axes[2]), dz(pad.axes[3]))
  }

  _endFrame() {
    this._pressed.clear()
    this._released.clear()
    this.pointer.dx = 0
    this.pointer.dy = 0
    this.pointer.wheel = 0
  }

  dispose() {
    for (const cleanup of this._cleanup) cleanup()
    this._cleanup = []
    this._touchRoot?.remove()
    this._touchRoot = null
  }
}

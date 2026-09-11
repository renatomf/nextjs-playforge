// DOM overlay for scores, bars, menus, labels over 3D objects, and screen effects.
// Styles itself: games don't need CSS for anything here.
import * as THREE from "three"

const CSS = `
.hud{position:fixed;inset:0;pointer-events:none;z-index:10;color:#fff;
  font-family:ui-rounded,"SF Pro Rounded","Segoe UI",system-ui,-apple-system,Roboto,sans-serif;
  font-size:clamp(12px,calc(1.2vmin + 8px),16px);line-height:1.3;-webkit-user-select:none;user-select:none;
  --hud-accent:#EA580C;--hud-panel:rgba(12,12,16,.55);--hud-border:rgba(255,255,255,.12)}
.hud *{box-sizing:border-box}
.hud [hidden]{display:none!important}
.hud-anchor{position:absolute;display:flex;flex-direction:column;gap:8px;padding:14px;max-width:100%}
.hud-top-left{top:0;left:0;align-items:flex-start}
.hud-top-center{top:0;left:50%;transform:translateX(-50%);align-items:center;text-align:center}
.hud-top-right{top:0;right:0;align-items:flex-end;text-align:right}
.hud-center-left{top:50%;left:0;transform:translateY(-50%);align-items:flex-start}
.hud-center{top:50%;left:50%;transform:translate(-50%,-50%);align-items:center;text-align:center}
.hud-center-right{top:50%;right:0;transform:translateY(-50%);align-items:flex-end}
.hud-bottom-left{bottom:0;left:0;align-items:flex-start}
.hud-bottom-center{bottom:0;left:50%;transform:translateX(-50%);align-items:center;text-align:center}
.hud-bottom-right{bottom:0;right:0;align-items:flex-end;text-align:right}
.hud-panel{background:var(--hud-panel);border:1px solid var(--hud-border);border-radius:12px;padding:8px 12px;
  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 6px 20px rgba(0,0,0,.25)}
.hud-text{font-weight:700;text-shadow:0 2px 8px rgba(0,0,0,.6);white-space:pre-line}
.hud-size-sm{font-size:.85em}.hud-size-lg{font-size:1.6em}
.hud-size-xl{font-size:clamp(28px,7vmin,64px);font-weight:900;letter-spacing:-.02em}
.hud-stat{display:flex;align-items:baseline;gap:10px;font-variant-numeric:tabular-nums}
.hud-stat-label{font-size:.72em;text-transform:uppercase;letter-spacing:.12em;opacity:.7;font-weight:800}
.hud-stat-value{font-size:1.35em;font-weight:900}
.hud-bump{animation:hud-bump .25s ease-out}
@keyframes hud-bump{40%{transform:scale(1.12)}}
.hud-bar-head{display:flex;justify-content:space-between;gap:12px}
.hud-bar-track{height:10px;border-radius:999px;background:rgba(255,255,255,.14);overflow:hidden;margin-top:6px}
.hud-bar-fill{height:100%;border-radius:inherit;background:var(--hud-accent);transition:width .2s ease,background-color .2s}
.hud-icons{font-size:1.35em;letter-spacing:3px;text-shadow:0 2px 6px rgba(0,0,0,.5)}
.hud-icon-off{opacity:.25;filter:grayscale(1)}
.hud-controls{display:grid;grid-template-columns:auto auto;gap:5px 10px;align-items:center;font-size:.85em;transition:opacity .8s}
.hud-controls-title{grid-column:1/-1;font-size:.75em;text-transform:uppercase;letter-spacing:.12em;opacity:.65;font-weight:800}
.hud-controls .hud-keys{justify-self:end;display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.hud-dimmed{opacity:.3}
.hud-kbd{display:inline-block;padding:2px 7px;border-radius:6px;background:rgba(255,255,255,.14);
  border:1px solid rgba(255,255,255,.2);border-bottom-width:2px;font-weight:800;font-size:.9em;white-space:nowrap}
.hud-toast{font-size:clamp(22px,5vmin,44px);font-weight:900;letter-spacing:-.01em;text-shadow:0 3px 14px rgba(0,0,0,.6);
  animation:hud-toast var(--d,1.6s) ease forwards;white-space:pre-line}
@keyframes hud-toast{0%{opacity:0;transform:scale(.6)}12%{opacity:1;transform:scale(1.08)}20%{transform:scale(1)}
  80%{opacity:1}100%{opacity:0;transform:translateY(-12px)}}
.hud-screen{position:absolute;inset:0;display:grid;place-items:center;padding:16px;pointer-events:auto;animation:hud-in .25s ease}
.hud-dim{background:radial-gradient(ellipse at center,rgba(0,0,0,.4),rgba(0,0,0,.75))}
.hud-leaving{animation:hud-out .2s ease forwards}
@keyframes hud-in{from{opacity:0}}
@keyframes hud-out{to{opacity:0}}
.hud-card{width:min(440px,100%);max-height:100%;overflow:auto;text-align:center;background:rgba(14,14,18,.82);
  border:1px solid var(--hud-border);border-radius:20px;padding:28px 24px;box-shadow:0 20px 60px rgba(0,0,0,.5);
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);animation:hud-card .35s cubic-bezier(.2,1.4,.4,1)}
@keyframes hud-card{from{transform:translateY(16px) scale(.96)}}
.hud-title{margin:0 0 6px;font-size:clamp(28px,6vmin,48px);font-weight:900;letter-spacing:-.02em;line-height:1.05}
.hud-subtitle{margin:0 0 14px;opacity:.75;font-size:1.05em}
.hud-body{margin:0 0 16px;opacity:.9;line-height:1.5;white-space:pre-line}
.hud-stats{display:grid;grid-template-columns:1fr auto;gap:6px 16px;margin:0 auto 18px;max-width:260px;text-align:left}
.hud-stats dt{opacity:.7}.hud-stats dd{margin:0;font-weight:900;text-align:right;font-variant-numeric:tabular-nums}
.hud-card .hud-controls{margin:0 auto 18px;justify-content:center;width:max-content;max-width:100%}
.hud-buttons{display:flex;flex-direction:column;gap:10px;margin-top:6px}
.hud-button{appearance:none;border:1px solid var(--hud-border);background:rgba(255,255,255,.08);color:#fff;font:inherit;
  font-weight:800;font-size:1.05em;padding:12px 18px;border-radius:12px;cursor:pointer;transition:transform .08s,background .15s,filter .15s}
.hud-button:hover{background:rgba(255,255,255,.15)}.hud-button:active{transform:scale(.97)}
.hud-button:focus-visible{outline:2px solid #fff;outline-offset:2px}
.hud-button.primary{background:var(--hud-accent);border-color:transparent;box-shadow:0 6px 20px color-mix(in srgb,var(--hud-accent) 45%,transparent)}
.hud-button.primary:hover{filter:brightness(1.1)}
.hud-crosshair{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:22px;height:22px}
.hud-crosshair::before,.hud-crosshair::after{content:"";position:absolute;background:#fff;box-shadow:0 0 3px rgba(0,0,0,.8)}
.hud-crosshair::before{left:10px;top:0;width:2px;height:22px}.hud-crosshair::after{top:10px;left:0;height:2px;width:22px}
.hud-crosshair.dot::before{left:8px;top:8px;width:6px;height:6px;border-radius:50%}.hud-crosshair.dot::after{display:none}
.hud-label{position:absolute;left:0;top:0;white-space:nowrap;font-size:.85em;font-weight:800;padding:2px 8px;border-radius:999px;
  background:rgba(0,0,0,.5);will-change:transform}
.hud-float{position:absolute;font-weight:900;font-size:1.3em;text-shadow:0 2px 6px rgba(0,0,0,.7);white-space:nowrap;
  animation:hud-float var(--d,.9s) ease-out forwards}
@keyframes hud-float{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}15%{opacity:1;transform:translate(-50%,-90%) scale(1.15)}
  100%{opacity:0;transform:translate(-50%,-260%) scale(1)}}
.hud-cover{position:absolute;inset:0;opacity:0}
`

const ANCHORS = new Set([
  "top-left", "top-center", "top-right",
  "center-left", "center", "center-right",
  "bottom-left", "bottom-center", "bottom-right",
])

const element = (tag, className, text) => {
  const el = document.createElement(tag)
  if (className) el.className = className
  if (text !== undefined) el.textContent = text
  return el
}

const bump = (el) => {
  el.classList.remove("hud-bump")
  void el.offsetWidth
  el.classList.add("hud-bump")
}

// A list of [keys, action] pairs or a { keys: action } object -> rows.
const controlRows = (list) => (Array.isArray(list) ? list : Object.entries(list))

function buildControls(list, title) {
  const grid = element("div", "hud-controls")
  if (title) grid.appendChild(element("div", "hud-controls-title", title))
  for (const [keys, action] of controlRows(list)) {
    const keyCell = element("div", "hud-keys")
    for (const key of String(keys).split(/\s*\/\s*/)) keyCell.appendChild(element("span", "hud-kbd", key))
    grid.appendChild(keyCell)
    grid.appendChild(element("div", "", action))
  }
  return grid
}

/** Something the HUD shows. set() changes what it displays. */
class Widget {
  constructor(hud, el) {
    this.hud = hud
    this.el = el
  }

  set(text) {
    this.el.textContent = text
    return this
  }

  show() {
    this.el.hidden = false
    return this
  }

  hide() {
    this.el.hidden = true
    return this
  }

  remove() {
    this.el.remove()
    this.hud._widgets.delete(this)
    this.hud._labels.delete(this)
  }
}

/**
 *   const hud = new Hud(game)
 *   const score = hud.stat("Score", 0)          ; score.set(10)
 *   const health = hud.bar("Health", { value: 100, max: 100 }) ; health.set(40)
 *   hud.controls([["WASD", "Move"], ["Space", "Jump"]])
 *   hud.screen({ title: "Game Over", buttons: [{ label: "Play again", primary: true, onClick: restart }] })
 *
 * Positions (`at`): top-left, top-center, top-right, center-left, center,
 * center-right, bottom-left, bottom-center, bottom-right.
 */
export class Hud {
  constructor(game = null, { accent = "#EA580C" } = {}) {
    if (!document.getElementById("hud-style")) {
      const style = element("style")
      style.id = "hud-style"
      style.textContent = CSS
      document.head.appendChild(style)
    }
    this.game = game
    this.root = element("div", "hud")
    this.root.style.setProperty("--hud-accent", accent)
    document.body.appendChild(this.root)
    this._anchors = {}
    this._widgets = new Set()
    this._labels = new Set()
    this._screens = new Set()
    this._fadeEl = null
    this._point = {}
    this._v = new THREE.Vector3()

    if (game) {
      game.onRender(() => this._updateLabels())
      game.on("remove", (object) => {
        for (const label of this._labels) {
          let node = label.object
          while (node && node !== object) node = node.parent
          if (node === object) label.remove()
        }
      })
    }
  }

  _anchor(at) {
    if (!ANCHORS.has(at)) at = "top-left"
    let anchor = this._anchors[at]
    if (!anchor) {
      anchor = element("div", `hud-anchor hud-${at}`)
      this.root.appendChild(anchor)
      this._anchors[at] = anchor
    }
    return anchor
  }

  _add(el, at) {
    this._anchor(at).appendChild(el)
    const widget = new Widget(this, el)
    this._widgets.add(widget)
    return widget
  }

  // --------------------------------------------------------- widgets

  /** Plain text. size: sm, md, lg, xl. Set `panel: true` for a background. */
  text(content, { at = "top-center", size = "md", panel = false } = {}) {
    const el = element("div", `hud-text hud-size-${size}${panel ? " hud-panel" : ""}`, content)
    return this._add(el, at)
  }

  /** A labeled number, like Score 120. The value bumps when it changes. */
  stat(label, value = "", { at = "top-left", icon = "" } = {}) {
    const el = element("div", "hud-panel hud-stat")
    el.appendChild(element("span", "hud-stat-label", icon ? `${icon} ${label}` : label))
    const valueEl = element("span", "hud-stat-value", String(value))
    el.appendChild(valueEl)
    const widget = this._add(el, at)
    widget.set = (next) => {
      const text = String(next)
      if (valueEl.textContent !== text) {
        valueEl.textContent = text
        bump(el)
      }
      return widget
    }
    return widget
  }

  /** A progress bar for health, energy, or time. Turns `lowColor` under 30%. */
  bar(label, { value = 1, max = 1, at = "top-left", color, lowColor = "#ef4444", width = 180, showValue = true } = {}) {
    const el = element("div", "hud-panel")
    el.style.width = `${width}px`
    const head = element("div", "hud-bar-head")
    head.appendChild(element("span", "hud-stat-label", label))
    const valueEl = element("span", "hud-stat-label")
    if (showValue) head.appendChild(valueEl)
    const track = element("div", "hud-bar-track")
    const fill = element("div", "hud-bar-fill")
    track.appendChild(fill)
    el.appendChild(head)
    el.appendChild(track)
    const widget = this._add(el, at)
    let currentMax = max
    widget.set = (next, nextMax = currentMax) => {
      currentMax = nextMax
      const ratio = Math.min(1, Math.max(0, next / currentMax))
      fill.style.width = `${ratio * 100}%`
      fill.style.background = ratio < 0.3 ? lowColor : (color ?? "")
      valueEl.textContent = `${Math.round(next)}/${Math.round(currentMax)}`
      return widget
    }
    widget.set(value, max)
    return widget
  }

  /** Repeated icons for lives or ammo: set(2) shows 2 full and the rest faded. */
  icons(count, { icon = "❤️", max = count, at = "top-left" } = {}) {
    const el = element("div", "hud-icons")
    const widget = this._add(el, at)
    widget.set = (next, nextMax = max) => {
      max = nextMax
      el.replaceChildren()
      for (let i = 0; i < Math.max(max, next); i++) {
        el.appendChild(element("span", i < next ? "" : "hud-icon-off", icon))
      }
      return widget
    }
    widget.set(count)
    return widget
  }

  /**
   * Key hints: controls([["WASD / Arrows", "Move"], ["Space", "Jump"]]).
   * " / " separates alternative keys. Fades to dim after `fadeAfter` seconds (0 = never).
   */
  controls(list, { at = "bottom-left", title = "Controls", fadeAfter = 8 } = {}) {
    const el = buildControls(list, title)
    el.classList.add("hud-panel")
    const widget = this._add(el, at)
    if (fadeAfter > 0) setTimeout(() => el.classList.add("hud-dimmed"), fadeAfter * 1000)
    return widget
  }

  crosshair({ style = "cross" } = {}) {
    return this._add(element("div", `hud-crosshair ${style}`), "center")
  }

  // ---------------------------------------------------------- moments

  /** A big message that pops in and fades out: "Level 2!", "+100". */
  toast(message, { duration = 1.6, at = "center" } = {}) {
    const el = element("div", "hud-toast", message)
    el.style.setProperty("--d", `${duration}s`)
    this._anchor(at).appendChild(el)
    setTimeout(() => el.remove(), duration * 1000)
  }

  /** Text that pops up from a world position and floats away (damage numbers, "+10"). Needs a game. */
  floatText(position, text, { color = "#ffffff", duration = 0.9 } = {}) {
    if (!this.game) throw new Error("hud.floatText needs the HUD to be created with a game: new Hud(game)")
    const point = this.game.worldToScreen(position, {})
    if (!point.visible) return
    const el = element("div", "hud-float", text)
    el.style.left = `${point.x}px`
    el.style.top = `${point.y}px`
    el.style.color = color
    el.style.setProperty("--d", `${duration}s`)
    this.root.appendChild(el)
    setTimeout(() => el.remove(), duration * 1000)
  }

  /** A text tag that follows a 3D object, like a name or health. Needs a game. */
  label(object, text, { offset = [0, 2.2, 0], color } = {}) {
    if (!this.game) throw new Error("hud.label needs the HUD to be created with a game: new Hud(game)")
    const el = element("div", "hud-label", text)
    if (color) el.style.color = color
    this.root.appendChild(el)
    const widget = new Widget(this, el)
    widget.object = object
    widget.offset = new THREE.Vector3(...offset)
    this._labels.add(widget)
    this._widgets.add(widget)
    return widget
  }

  _updateLabels() {
    for (const label of this._labels) {
      const v = label.object.getWorldPosition(this._v).add(label.offset)
      const point = this.game.worldToScreen(v, this._point)
      const visible = point.visible && label.object.visible && !label.el.hidden
      label.el.style.visibility = visible ? "" : "hidden"
      if (visible) {
        label.el.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -100%)`
      }
    }
  }

  /** Flashes the whole screen, e.g. red when the player is hurt. */
  flash(color = "rgba(255,255,255,.6)", duration = 0.15) {
    const el = element("div", "hud-cover")
    el.style.background = color
    this.root.appendChild(el)
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: duration * 1000, easing: "ease-out" }).onfinish =
      () => el.remove()
  }

  /** Fades the screen to a color (to = 1) or back (to = 0). Resolves when done. */
  fade(to = 1, { duration = 0.4, color = "#000" } = {}) {
    if (!this._fadeEl) {
      this._fadeEl = element("div", "hud-cover")
      this.root.appendChild(this._fadeEl)
    }
    const el = this._fadeEl
    el.style.background = color
    const from = Number(getComputedStyle(el).opacity)
    const animation = el.animate([{ opacity: from }, { opacity: to }], {
      duration: duration * 1000,
      fill: "forwards",
    })
    return animation.finished.then(() => {
      el.style.opacity = String(to)
      animation.cancel()
    })
  }

  // --------------------------------------------------------- screens

  /**
   * A centered card for title, pause, win, and game over screens. Blocks clicks
   * to the game until closed. Clicking a button closes the screen (unless the
   * button has `close: false`) and then calls its onClick. Enter clicks the
   * primary button.
   *
   *   hud.screen({
   *     title: "Space Dodge", subtitle: "Survive the asteroid field",
   *     controls: [["A / D", "Steer"]], stats: [["Best", 120]],
   *     buttons: [{ label: "Play", primary: true, onClick: start }],
   *   })
   */
  screen({ title = "", subtitle = "", text = "", stats = null, controls = null, buttons = [], dim = true } = {}) {
    const overlay = element("div", `hud-screen${dim ? " hud-dim" : ""}`)
    const card = element("div", "hud-card")
    overlay.appendChild(card)
    if (title) card.appendChild(element("h1", "hud-title", title))
    if (subtitle) card.appendChild(element("p", "hud-subtitle", subtitle))
    if (text) card.appendChild(element("p", "hud-body", text))
    if (stats) {
      const list = element("dl", "hud-stats")
      for (const [label, value] of controlRows(stats)) {
        list.appendChild(element("dt", "", label))
        list.appendChild(element("dd", "", String(value)))
      }
      card.appendChild(list)
    }
    if (controls) card.appendChild(buildControls(controls, "Controls"))

    let closed = false
    const close = () => {
      if (closed) return
      closed = true
      window.removeEventListener("keydown", onKey, true)
      this._screens.delete(handle)
      overlay.classList.add("hud-leaving")
      setTimeout(() => overlay.remove(), 200)
    }

    let primary = null
    if (buttons.length) {
      const row = element("div", "hud-buttons")
      for (const button of buttons) {
        const el = element("button", `hud-button${button.primary ? " primary" : ""}`, button.label)
        el.type = "button"
        el.addEventListener("click", () => {
          if (closed) return
          if (button.close !== false) close()
          // The key or click that pressed the button shouldn't also act in the game.
          this.game?.input.reset()
          button.onClick?.()
        })
        if (button.primary && !primary) primary = el
        row.appendChild(el)
      }
      card.appendChild(row)
    }
    primary ??= card.querySelector(".hud-button")

    const onKey = (event) => {
      if (event.key !== "Enter" || !primary) return
      if (overlay.contains(document.activeElement)) return // the focused button handles it
      event.preventDefault()
      primary.click()
    }
    window.addEventListener("keydown", onKey, true)

    this.root.appendChild(overlay)
    setTimeout(() => primary?.focus({ preventScroll: true }), 0)
    const handle = { el: overlay, close }
    this._screens.add(handle)
    return handle
  }

  /** Closes every open screen. */
  closeScreens() {
    for (const screen of [...this._screens]) screen.close()
  }

  /** Removes every widget, label, and screen. */
  clear() {
    for (const widget of [...this._widgets]) widget.remove()
    this.closeScreens()
  }

  dispose() {
    this.clear()
    this.root.remove()
  }
}

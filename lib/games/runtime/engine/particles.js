// Particle bursts drawn as one instanced mesh: explosions, sparkles, dust, trails.
import * as THREE from "three"

const _matrix = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _quaternion = new THREE.Quaternion()
const _scale = new THREE.Vector3()
const _euler = new THREE.Euler()
const _color = new THREE.Color()
const _direction = new THREE.Vector3()
const _random = new THREE.Vector3()
const _world = new THREE.Vector3()

const SHAPES = {
  cube: () => new THREE.BoxGeometry(1, 1, 1),
  sphere: () => new THREE.IcosahedronGeometry(0.6, 0),
  tetra: () => new THREE.TetrahedronGeometry(0.75),
}

const randomUnit = (target) => {
  const u = Math.random() * 2 - 1
  const a = Math.random() * Math.PI * 2
  const r = Math.sqrt(1 - u * u)
  return target.set(r * Math.cos(a), u, r * Math.sin(a))
}

const vary = (value, variance) => value * (1 + (Math.random() * 2 - 1) * variance)

/**
 *   const fx = new Particles(game)
 *   fx.explosion(enemy.position)
 *   fx.sparkle(coin.position, { color: "#ffd34d" })
 *   fx.burst(position, { count: 30, colors: ["#fff", "#f60"], speed: 6, gravity: -9.8 })
 *   const stop = fx.trail(rocket, { color: "#ff9a3c" })
 *
 * blending "additive" makes overlapping particles glow (sparks, magic, fire).
 */
export class Particles {
  constructor(game, { max = 1500, shape = "cube", blending = "normal" } = {}) {
    this.game = game
    this.max = max
    this.count = 0
    const additive = blending === "additive"
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !additive,
      transparent: additive,
      toneMapped: false,
    })
    this.mesh = new THREE.InstancedMesh((SHAPES[shape] ?? SHAPES.cube)(), this.material, max)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.setColorAt(0, _color.set(0xffffff))
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.castShadow = false
    this.mesh.receiveShadow = false
    game.scene.add(this.mesh)

    const f = (n) => new Float32Array(max * n)
    this._pos = f(3)
    this._vel = f(3)
    this._rot = f(3)
    this._spin = f(3)
    this._color = f(3)
    this._life = f(1)
    this._maxLife = f(1)
    this._size = f(1)
    this._sizeEnd = f(1)
    this._gravity = f(1)
    this._drag = f(1)
    this._colorsDirty = false
    this._off = game.onUpdate((dt) => this.update(dt))
  }

  /**
   * Emits `count` particles from `position`. Without `direction` they fly out
   * in every direction; with it, `spread` (0-1) widens the cone around it.
   */
  burst(position, {
    count = 20, color = 0xffffff, colors = null, speed = 5, speedVariance = 0.5,
    direction = null, spread = 0.5, radius = 0, size = 0.2, sizeEnd = 0, sizeVariance = 0.3,
    life = 0.8, lifeVariance = 0.3, gravity = -9.8, drag = 1.5, spin = 6,
  } = {}) {
    for (let n = 0; n < count; n++) {
      if (this.count >= this.max) return
      const i = this.count++
      const i3 = i * 3

      randomUnit(_random)
      if (direction) {
        _direction.set(direction.x ?? direction[0], direction.y ?? direction[1], direction.z ?? direction[2])
          .normalize().addScaledVector(_random, spread).normalize()
      } else {
        _direction.copy(_random)
      }
      const s = vary(speed, speedVariance)
      randomUnit(_random).multiplyScalar(radius * Math.random())
      this._pos[i3] = position.x + _random.x
      this._pos[i3 + 1] = position.y + _random.y
      this._pos[i3 + 2] = position.z + _random.z
      this._vel[i3] = _direction.x * s
      this._vel[i3 + 1] = _direction.y * s
      this._vel[i3 + 2] = _direction.z * s
      this._rot[i3] = Math.random() * 6.28
      this._rot[i3 + 1] = Math.random() * 6.28
      this._rot[i3 + 2] = Math.random() * 6.28
      this._spin[i3] = (Math.random() * 2 - 1) * spin
      this._spin[i3 + 1] = (Math.random() * 2 - 1) * spin
      this._spin[i3 + 2] = (Math.random() * 2 - 1) * spin
      const k = vary(1, sizeVariance)
      this._size[i] = size * k
      this._sizeEnd[i] = sizeEnd * k
      this._life[i] = this._maxLife[i] = Math.max(0.05, vary(life, lifeVariance))
      this._gravity[i] = gravity
      this._drag[i] = drag

      _color.set(colors ? colors[Math.floor(Math.random() * colors.length)] : color)
      this._color[i3] = _color.r
      this._color[i3 + 1] = _color.g
      this._color[i3 + 2] = _color.b
      this.mesh.setColorAt(i, _color)
      this._colorsDirty = true
    }
  }

  // --------------------------------------------------------------- presets

  explosion(position, { color = 0xff7a1a, scale = 1 } = {}) {
    this.burst(position, {
      count: Math.round(36 * scale), colors: [color, 0xffd166, 0xfff3d6], speed: 8 * scale,
      size: 0.35 * scale, life: 0.6, gravity: -4, drag: 2.5,
    })
    this.burst(position, {
      count: Math.round(14 * scale), colors: [0x6b7280, 0x9ca3af, 0x4b5563], speed: 2.5 * scale,
      size: 0.35 * scale, sizeEnd: 0.9 * scale, life: 1.1, gravity: 1.5, drag: 1.5, spin: 2,
    })
  }

  sparkle(position, { color = 0xfff3a0, count = 16 } = {}) {
    this.burst(position, { count, colors: [color, 0xffffff], speed: 3, size: 0.12, life: 0.5, gravity: 0, drag: 3 })
  }

  /** Small debris, e.g. where a bullet hits; `direction` aims it (like a surface normal). */
  hit(position, { color = 0xffffff, direction = null, count = 10 } = {}) {
    this.burst(position, { count, color, direction, spread: 0.7, speed: 5, size: 0.1, life: 0.35, gravity: -12 })
  }

  /** Puffs for landing, running, and skidding. */
  dust(position, { color = 0xd6c7a1, count = 8 } = {}) {
    this.burst(position, {
      count, color, direction: [0, 1, 0], spread: 1.2, speed: 1.6, size: 0.22, sizeEnd: 0.45,
      life: 0.5, gravity: 0, drag: 4, spin: 2,
    })
  }

  smoke(position, { color = 0x9ca3af, count = 10 } = {}) {
    this.burst(position, {
      count, colors: [color, 0x6b7280], direction: [0, 1, 0], spread: 0.5, speed: 1.2, size: 0.3,
      sizeEnd: 0.9, life: 1.4, gravity: 0.8, drag: 1, spin: 1,
    })
  }

  confetti(position, { count = 60 } = {}) {
    this.burst(position, {
      count, colors: [0xef4444, 0xfacc15, 0x22c55e, 0x3b82f6, 0xa855f7, 0xea580c], direction: [0, 1, 0],
      spread: 0.7, speed: 9, size: 0.15, sizeEnd: 0.15, life: 2, gravity: -9, drag: 1.2, spin: 12,
    })
  }

  /** Emits continuously from an object's position. Returns a function that stops it. */
  trail(object, { rate = 40, ...options } = {}) {
    let carry = 0
    return this.game.onUpdate((dt) => {
      carry += rate * dt
      const count = Math.floor(carry)
      if (!count) return
      carry -= count
      this.burst(object.getWorldPosition(_world), {
        count, speed: 0.4, size: 0.18, sizeEnd: 0, life: 0.45, gravity: 0, drag: 2, ...options,
      })
    })
  }

  // ---------------------------------------------------------------- update

  update(dt) {
    let i = 0
    while (i < this.count) {
      this._life[i] -= dt
      if (this._life[i] <= 0) {
        this._removeAt(i)
        continue
      }
      const i3 = i * 3
      const drag = Math.exp(-this._drag[i] * dt)
      this._vel[i3 + 1] += this._gravity[i] * dt
      for (let a = 0; a < 3; a++) {
        this._vel[i3 + a] *= drag
        this._pos[i3 + a] += this._vel[i3 + a] * dt
        this._rot[i3 + a] += this._spin[i3 + a] * dt
      }
      const t = 1 - this._life[i] / this._maxLife[i]
      const size = Math.max(0.0001, this._size[i] + (this._sizeEnd[i] - this._size[i]) * t)
      _position.set(this._pos[i3], this._pos[i3 + 1], this._pos[i3 + 2])
      _quaternion.setFromEuler(_euler.set(this._rot[i3], this._rot[i3 + 1], this._rot[i3 + 2]))
      _matrix.compose(_position, _quaternion, _scale.setScalar(size))
      this.mesh.setMatrixAt(i, _matrix)
      i++
    }
    this.mesh.count = this.count
    this.mesh.instanceMatrix.needsUpdate = true
    if (this._colorsDirty) {
      this.mesh.instanceColor.needsUpdate = true
      this._colorsDirty = false
    }
  }

  // Keeps live particles packed at the front by moving the last one into slot i.
  _removeAt(i) {
    const last = --this.count
    if (i === last) return
    const i3 = i * 3
    const l3 = last * 3
    for (const array of [this._pos, this._vel, this._rot, this._spin, this._color]) {
      array[i3] = array[l3]
      array[i3 + 1] = array[l3 + 1]
      array[i3 + 2] = array[l3 + 2]
    }
    for (const array of [this._life, this._maxLife, this._size, this._sizeEnd, this._gravity, this._drag]) {
      array[i] = array[last]
    }
    this.mesh.setColorAt(i, _color.setRGB(this._color[i3], this._color[i3 + 1], this._color[i3 + 2]))
    this._colorsDirty = true
  }

  clear() {
    this.count = 0
    this.mesh.count = 0
  }

  dispose() {
    this._off()
    this.mesh.removeFromParent()
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}

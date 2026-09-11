// Arcade physics with axis-aligned boxes: gravity, solid floors and walls,
// jumping, moving platforms, and trigger zones. Rotation is ignored: every
// body is an upright box. For real rigid bodies (tumbling, stacking, rolling),
// use Rapier instead (see the engine instructions).
import * as THREE from "three"

const report = (error) => (window.reportGameError ?? console.error)(error)
const CONTACT_EPSILON = 0.02
const _center = new THREE.Vector3()
const _hit = new THREE.Vector3()
const _ray = new THREE.Ray()

const toVector = (value, fallback = [0, 0, 0]) =>
  value?.isVector3 ? value.clone() : new THREE.Vector3(...(Array.isArray(value) ? value : typeof value === "number" ? [value, value, value] : fallback))

// Strict overlap: boxes that only touch don't overlap.
const overlaps = (a, b) =>
  a.max.x > b.min.x && a.min.x < b.max.x &&
  a.max.y > b.min.y && a.min.y < b.max.y &&
  a.max.z > b.min.z && a.min.z < b.max.z

const near = (a, b, e) =>
  a.max.x + e > b.min.x && a.min.x - e < b.max.x &&
  a.max.y + e > b.min.y && a.min.y - e < b.max.y &&
  a.max.z + e > b.min.z && a.min.z - e < b.max.z

/** A physics body attached to an object; returned by physics.add(). */
class Body {
  constructor(object, {
    type = "dynamic", // dynamic: moved by velocity and gravity | static: never moves | kinematic: moved by your code, carries riders
    sensor = false, // true: detects overlaps (onEnter/onExit) but doesn't block
    size, // [w, h, d]; defaults to the object's bounding box
    offset, // box center relative to object.position; defaults to the bounding box center
    velocity,
    gravityScale = 1,
    bounce = 0, // 0 = stop on impact, 1 = perfectly bouncy
    friction = 0, // horizontal slowdown per second while grounded (e.g. 8)
    drag = 0, // slowdown per second in every direction
    tag = "", // a name for the kind of body: "player", "enemy", "coin"
    ignore = [], // tags this body passes through
    onEnter = null, // (otherBody, normal) when contact starts; normal points from other to this
    onExit = null, // (otherBody) when contact ends
  } = {}) {
    this.isBody = true
    this.object = object
    this.type = type
    this.sensor = sensor
    this.velocity = toVector(velocity)
    Object.assign(this, { gravityScale, bounce, friction, drag, tag, ignore, onEnter, onExit })
    this.enabled = true
    /** True when standing on something this step; `ground` is that body. */
    this.grounded = false
    this.ground = null
    /** Bodies touching this one, with the contact normal (pointing toward this body). */
    this.contacts = new Map()
    this.box = new THREE.Box3()
    this.half = new THREE.Vector3()
    this.offset = new THREE.Vector3()
    this.delta = new THREE.Vector3() // kinematic: movement during the last step
    this._lastPosition = object.position.clone()

    object.updateWorldMatrix(true, true)
    const bounds = new THREE.Box3().setFromObject(object)
    const worldPosition = object.getWorldPosition(new THREE.Vector3())
    if (bounds.isEmpty()) {
      this.half.copy(toVector(size, [1, 1, 1])).multiplyScalar(0.5)
      this.offset.copy(toVector(offset))
    } else {
      this.half.copy(size ? toVector(size) : bounds.getSize(new THREE.Vector3())).multiplyScalar(0.5)
      this.offset.copy(offset ? toVector(offset) : bounds.getCenter(new THREE.Vector3()).sub(worldPosition))
    }
    this.sync()
  }

  /** Recomputes the box from object.position. Call after moving the object yourself mid-frame. */
  sync() {
    const p = this.object.position
    this.box.min.set(p.x + this.offset.x - this.half.x, p.y + this.offset.y - this.half.y, p.z + this.offset.z - this.half.z)
    this.box.max.set(p.x + this.offset.x + this.half.x, p.y + this.offset.y + this.half.y, p.z + this.offset.z + this.half.z)
  }

  get size() {
    return this.half.clone().multiplyScalar(2)
  }

  setSize(x, y = x, z = x) {
    this.half.set(x / 2, y / 2, z / 2)
    this.sync()
  }

  /** Whether this body touches a body, an object, or any body with a tag. */
  touching(target) {
    for (const other of this.contacts.keys()) {
      if (other === target || other.object === target || other.tag === target) return true
    }
    return false
  }

  ignores(other) {
    return (this.ignore.length && this.ignore.includes(other.tag)) ||
      (other.ignore.length && other.ignore.includes(this.tag))
  }
}

/**
 *   const physics = new Physics(game)                    // gravity -30; pass { gravity: 0 } for top-down
 *   physics.add(floor, { type: "static" })
 *   const body = physics.add(player, { size: [0.8, 1.8, 0.8] })
 *   // in onUpdate:
 *   body.velocity.x = move.x * 6
 *   if (input.pressed("jump") && body.grounded) body.velocity.y = 12
 *   physics.add(coin, { type: "static", sensor: true, tag: "coin",
 *     onEnter: (other) => { if (other.tag === "player") collect(coin) } })
 *
 * object.position is the source of truth: move static/kinematic objects by
 * changing their position. Bodies are removed with game.remove(object).
 */
export class Physics {
  constructor(game, { gravity = -30, maxSubstep = 1 / 120 } = {}) {
    this.game = game
    this.gravity = typeof gravity === "number" ? new THREE.Vector3(0, gravity, 0) : toVector(gravity)
    this.maxSubstep = maxSubstep
    this.bodies = new Set()
    this._off = game._hook("physics", (dt) => this.step(dt))
    this._offRemove = game.on("remove", (object) => {
      if (!object?.isObject3D) return
      object.traverse((child) => {
        if (child.userData.body) this.remove(child)
      })
    })
  }

  add(object, options) {
    if (object.userData.body) this.remove(object)
    const body = new Body(object, options)
    object.userData.body = body
    this.bodies.add(body)
    return body
  }

  remove(objectOrBody) {
    const body = objectOrBody?.isBody ? objectOrBody : objectOrBody?.userData?.body
    if (!body) return
    this.bodies.delete(body)
    if (body.object.userData.body === body) delete body.object.userData.body
    for (const other of body.contacts.keys()) other.contacts.delete(body)
    body.contacts.clear()
  }

  step(dt) {
    if (dt <= 0) return
    // Bodies whose object is out of the scene (e.g. pooled) are skipped.
    const bodies = []
    for (const body of this.bodies) if (body.enabled && body.object.parent) bodies.push(body)

    for (const body of bodies) {
      body.sync()
      if (body.type === "kinematic") {
        body.delta.subVectors(body.object.position, body._lastPosition)
        body._lastPosition.copy(body.object.position)
      }
    }

    const solids = bodies.filter((body) => !body.sensor)
    const dynamics = bodies.filter((body) => body.type === "dynamic")

    for (const body of dynamics) {
      // Ride moving platforms.
      if (body.grounded && body.ground?.type === "kinematic") {
        body.object.position.add(body.ground.delta)
        body.sync()
      }
      body.grounded = false
      body.ground = null
      if (!body.sensor) this._depenetrate(body, solids)
    }

    const steps = Math.max(1, Math.ceil(dt / this.maxSubstep))
    const h = dt / steps
    for (let s = 0; s < steps; s++) {
      for (const body of dynamics) {
        const v = body.velocity
        v.addScaledVector(this.gravity, body.gravityScale * h)
        if (body.drag) v.multiplyScalar(Math.exp(-body.drag * h))
        if (body.friction && body.grounded) {
          const k = Math.exp(-body.friction * h)
          v.x *= k
          v.z *= k
        }
        // Moving one axis at a time keeps corners from snagging; y last so landing is clean.
        this._moveAxis(body, "x", v.x * h, solids)
        this._moveAxis(body, "z", v.z * h, solids)
        this._moveAxis(body, "y", v.y * h, solids)
      }
    }

    this._updateContacts(bodies, dynamics)
  }

  _moveAxis(body, axis, amount, solids) {
    if (amount === 0) return
    body.object.position[axis] += amount
    body.sync()
    if (body.sensor) return

    for (const other of solids) {
      if (other === body || !overlaps(body.box, other.box) || body.ignores(other)) continue
      const push = amount > 0 ? other.box.min[axis] - body.box.max[axis] : other.box.max[axis] - body.box.min[axis]
      // Share the push with another dynamic body, unless it stands on something and we land on it.
      if (other.type === "dynamic" && !(axis === "y" && other.grounded)) {
        body.object.position[axis] += push / 2
        other.object.position[axis] -= push / 2
        other.sync()
      } else {
        body.object.position[axis] += push
      }
      body.sync()

      const v = body.velocity
      if (axis === "y" && amount < 0) {
        body.grounded = true
        body.ground = other
      }
      v[axis] = body.bounce > 0 && Math.abs(v[axis]) > 1 ? -v[axis] * body.bounce : 0
    }
  }

  // Pushes a body out of solids that moved into it (platforms, spawn overlaps).
  _depenetrate(body, solids) {
    for (const other of solids) {
      if (other === body || other.type === "dynamic" || !overlaps(body.box, other.box) || body.ignores(other)) continue
      let bestAxis = "y"
      let bestPush = Infinity
      for (const axis of ["x", "y", "z"]) {
        const up = other.box.max[axis] - body.box.min[axis]
        const down = other.box.min[axis] - body.box.max[axis]
        const push = Math.abs(up) < Math.abs(down) ? up : down
        if (Math.abs(push) < Math.abs(bestPush)) {
          bestPush = push
          bestAxis = axis
        }
      }
      body.object.position[bestAxis] += bestPush
      body.sync()
      if (bestAxis === "y" && bestPush > 0) {
        body.grounded = true
        body.ground = other
        body.velocity.y = Math.max(0, body.velocity.y)
      }
    }
  }

  _normal(a, b) {
    // Axis of least overlap; points from b toward a.
    let axis = "y"
    let least = Infinity
    for (const key of ["x", "y", "z"]) {
      const overlap = Math.min(a.box.max[key], b.box.max[key]) - Math.max(a.box.min[key], b.box.min[key])
      if (overlap < least) {
        least = overlap
        axis = key
      }
    }
    a.box.getCenter(_center)
    const centerA = _center[axis]
    b.box.getCenter(_center)
    const normal = new THREE.Vector3()
    normal[axis] = centerA >= _center[axis] ? 1 : -1
    return normal
  }

  _updateContacts(bodies, dynamics) {
    const previous = new Map()
    for (const body of bodies) {
      previous.set(body, body.contacts)
      body.contacts = new Map()
    }
    dynamics.forEach((body, i) => (body._index = i))

    for (const a of dynamics) {
      for (const b of bodies) {
        if (a === b || (b.type === "dynamic" && b._index < a._index)) continue
        if (!near(a.box, b.box, CONTACT_EPSILON) || a.ignores(b)) continue
        const normal = this._normal(a, b)
        a.contacts.set(b, normal)
        b.contacts.set(a, normal.clone().negate())
        if (!a.sensor && !b.sensor && normal.y > 0.7 && !a.grounded) {
          a.grounded = true
          a.ground = b
        }
      }
    }

    for (const body of bodies) {
      const before = previous.get(body)
      for (const [other, normal] of body.contacts) {
        if (!before.has(other) && body.onEnter) {
          try {
            body.onEnter(other, normal)
          } catch (error) {
            report(error)
          }
        }
      }
      for (const other of before.keys()) {
        if (!body.contacts.has(other) && body.onExit) {
          try {
            body.onExit(other)
          } catch (error) {
            report(error)
          }
        }
      }
    }
  }

  /**
   * Casts a ray against body boxes. Returns { body, object, point, distance } for
   * the closest hit, or null. `ignore` skips a body or object (e.g. the shooter).
   */
  raycast(origin, direction, maxDistance = Infinity, { ignore = null, sensors = false } = {}) {
    _ray.set(origin, direction.clone().normalize())
    let best = null
    for (const body of this.bodies) {
      if (!body.enabled || !body.object.parent) continue
      if (body === ignore || body.object === ignore || (body.sensor && !sensors)) continue
      if (!_ray.intersectBox(body.box, _hit)) continue
      const distance = origin.distanceTo(_hit)
      if (distance <= maxDistance && (!best || distance < best.distance)) {
        best = { body, object: body.object, point: _hit.clone(), distance }
      }
    }
    return best
  }

  /** Bodies whose boxes overlap `box` (a THREE.Box3). */
  query(box) {
    const result = []
    for (const body of this.bodies) {
      if (body.enabled && body.object.parent && overlaps(body.box, box)) result.push(body)
    }
    return result
  }

  dispose() {
    this._off()
    this._offRemove()
    this.bodies.clear()
  }
}

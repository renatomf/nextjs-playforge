// Ready-made low-poly models built from primitives, plus glTF loading.
//
// Conventions: 1 unit = 1 meter, +Y is up, and models face +Z (so
// object.lookAt(target) and rotation.y = headingFrom(dx, dz) turn them the
// right way). Standing models have their origin at their feet; floating ones
// (coin, gem, heart, star) at their center; platform() at its top surface.
// Geometries and materials are shared between models: clone a material
// before changing it on one object (animation.js effects do this for you).
import * as THREE from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

import { Animator } from "./animation.js"
import { damp } from "./utils.js"

/** A bright, friendly palette that works with every lighting preset. */
export const Palette = {
  orange: 0xea580c, red: 0xef4444, yellow: 0xfacc15, gold: 0xfbbf24,
  green: 0x22c55e, grass: 0x5fb34a, leaf: 0x3f9d3a, pine: 0x2f7d4f,
  blue: 0x3b82f6, sky: 0x7dd3fc, water: 0x38bdf8, purple: 0xa855f7,
  pink: 0xec4899, white: 0xf8fafc, black: 0x111111, gray: 0x9ca3af,
  stone: 0x8b8f98, dark: 0x374151, wood: 0xa0703f, bark: 0x6b4226,
  dirt: 0x8d6e4e, sand: 0xe9d8a6, snow: 0xf1f5f9, skin: 0xf2c6a0,
}

// ------------------------------------------------------------ caches

const materials = new Map()
const geometries = new Map()

/** A shared flat-shaded material for a color. Same options -> same material. */
export function material(color = Palette.white, {
  flat = true, roughness = 0.8, metalness = 0, emissive = 0x000000, emissiveIntensity = 1, opacity = 1,
} = {}) {
  const key = [
    new THREE.Color(color).getHexString(), flat, roughness, metalness,
    new THREE.Color(emissive).getHexString(), emissiveIntensity, opacity,
  ].join("|")
  let result = materials.get(key)
  if (!result) {
    result = new THREE.MeshStandardMaterial({
      color, flatShading: flat, roughness, metalness, emissive, emissiveIntensity,
      opacity, transparent: opacity < 1,
    })
    materials.set(key, result)
  }
  return result
}

const toMaterial = (value, options) => (value?.isMaterial ? value : material(value, options))

function cachedGeometry(key, create) {
  let geometry = geometries.get(key)
  if (!geometry) {
    geometry = create()
    geometries.set(key, geometry)
  }
  return geometry
}

const size3 = (size) => (Array.isArray(size) ? size : [size, size, size])

function place(object, { position, rotation, scale } = {}) {
  if (position) object.position.set(...position)
  if (rotation) object.rotation.set(...rotation)
  if (typeof scale === "number") object.scale.setScalar(scale)
  else if (scale) object.scale.set(...scale)
  return object
}

function shadows(object, cast = true) {
  object.traverse((child) => {
    if (!child.isMesh) return
    child.castShadow = cast
    child.receiveShadow = true
  })
  return object
}

// -------------------------------------------------------- primitives
// All primitives take { color | material, flat, position, rotation, scale, castShadow }
// and have their origin at their center.

/** A mesh from any geometry with a color or material. */
export function mesh(geometry, colorOrMaterial = Palette.white, { flat, position, rotation, scale, castShadow = true } = {}) {
  const result = new THREE.Mesh(geometry, toMaterial(colorOrMaterial, flat === undefined ? {} : { flat }))
  result.castShadow = castShadow
  result.receiveShadow = true
  return place(result, { position, rotation, scale })
}

/** size: number or [width, height, depth]. radius > 0 rounds the edges. */
export function box({ size = 1, color = Palette.white, material: mat, radius = 0, ...options } = {}) {
  const [w, h, d] = size3(size)
  const geometry = radius > 0
    ? cachedGeometry(`rbox:${w},${h},${d},${radius}`, () => new RoundedBoxGeometry(w, h, d, 3, radius))
    : cachedGeometry(`box:${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d))
  return mesh(geometry, mat ?? color, options)
}

/** detail: 0 = chunky low-poly, 1 = default, 3+ = smooth (pass flat: false too). */
export function sphere({ radius = 0.5, detail = 1, color = Palette.white, material: mat, ...options } = {}) {
  const geometry = cachedGeometry(`sphere:${radius},${detail}`, () => new THREE.IcosahedronGeometry(radius, detail))
  return mesh(geometry, mat ?? color, options)
}

export function cylinder({ radius = 0.5, radiusTop = radius, radiusBottom = radius, height = 1, segments = 12, color = Palette.white, material: mat, ...options } = {}) {
  const geometry = cachedGeometry(
    `cylinder:${radiusTop},${radiusBottom},${height},${segments}`,
    () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments)
  )
  return mesh(geometry, mat ?? color, options)
}

/** Points up (+Y). segments: 3 = pyramid-ish, 4 = pyramid, 12 = round. */
export function cone({ radius = 0.5, height = 1, segments = 12, color = Palette.white, material: mat, ...options } = {}) {
  const geometry = cachedGeometry(`cone:${radius},${height},${segments}`, () => new THREE.ConeGeometry(radius, height, segments))
  return mesh(geometry, mat ?? color, options)
}

/** Total height is length + 2 * radius. */
export function capsule({ radius = 0.35, length = 1, color = Palette.white, material: mat, ...options } = {}) {
  const geometry = cachedGeometry(`capsule:${radius},${length}`, () => new THREE.CapsuleGeometry(radius, length, 4, 12))
  return mesh(geometry, mat ?? color, options)
}

/** A ring standing up, facing +Z (fly-through hoops). */
export function torus({ radius = 1, tube = 0.15, color = Palette.white, material: mat, ...options } = {}) {
  const geometry = cachedGeometry(`torus:${radius},${tube}`, () => new THREE.TorusGeometry(radius, tube, 10, 36))
  return mesh(geometry, mat ?? color, options)
}

// --------------------------------------------------------- characters

/**
 * A blocky humanoid, 1.8 units tall by default, with a procedural walk cycle.
 * Set `speed` (horizontal units/second) and `grounded` each frame and
 * game.add() it: it animates itself. Attach items to `parts.hand`.
 */
export class Character extends THREE.Group {
  constructor({ color = Palette.blue, skin = Palette.skin, pants = Palette.dark, hair = 0x3b2a1a, shoes = 0x1f2937, height = 1.8 } = {}) {
    super()
    this.speed = 0
    this.grounded = true
    this._phase = 0
    this._swing = 0
    this._time = Math.random() * 10

    const rig = new THREE.Group()
    rig.scale.setScalar(height / 1.85)
    this.add(rig)
    this._rig = rig

    const limb = (x, y) => {
      const pivot = new THREE.Group()
      pivot.position.set(x, y, 0)
      rig.add(pivot)
      return pivot
    }

    const leftLeg = limb(0.16, 0.75)
    const rightLeg = limb(-0.16, 0.75)
    for (const leg of [leftLeg, rightLeg]) {
      leg.add(place(box({ size: [0.22, 0.7, 0.26], color: pants }), { position: [0, -0.35, 0] }))
      leg.add(place(box({ size: [0.24, 0.1, 0.34], color: shoes }), { position: [0, -0.7, 0.04] }))
    }

    const torso = place(box({ size: [0.62, 0.62, 0.34], color, radius: 0.05 }), { position: [0, 1.06, 0] })
    rig.add(torso)

    const head = new THREE.Group()
    head.position.set(0, 1.6, 0)
    head.add(box({ size: 0.44, color: skin, radius: 0.06 }))
    head.add(place(box({ size: [0.47, 0.14, 0.47], color: hair }), { position: [0, 0.2, -0.01] }))
    for (const x of [-0.1, 0.1]) {
      head.add(place(box({ size: [0.07, 0.09, 0.02], color: Palette.black }), { position: [x, 0.02, 0.225] }))
    }
    rig.add(head)

    const leftArm = limb(0.4, 1.3)
    const rightArm = limb(-0.4, 1.3)
    for (const arm of [leftArm, rightArm]) {
      arm.add(place(box({ size: [0.17, 0.52, 0.2], color }), { position: [0, -0.24, 0] }))
      arm.add(place(box({ size: 0.15, color: skin }), { position: [0, -0.56, 0] }))
    }
    const hand = new THREE.Group()
    hand.position.set(0, -0.62, 0.05)
    rightArm.add(hand)

    this.parts = { torso, head, leftArm, rightArm, leftLeg, rightLeg, hand }
    shadows(this)
  }

  update(dt) {
    this._time += dt
    const { leftArm, rightArm, leftLeg, rightLeg, torso } = this.parts
    this._swing = damp(this._swing, this.grounded ? Math.min(this.speed / 5, 1) : 0, 10, dt)
    this._phase += dt * (4 + this.speed * 1.6)
    const swing = Math.sin(this._phase) * 0.9 * this._swing

    let legL = swing
    let legR = -swing
    let armL = -swing * 0.8
    let armR = swing * 0.8
    if (!this.grounded) {
      legL = -0.6
      legR = 0.4
      armL = -0.5
      armR = -2.6
    }
    const k = 18
    leftLeg.rotation.x = damp(leftLeg.rotation.x, legL, k, dt)
    rightLeg.rotation.x = damp(rightLeg.rotation.x, legR, k, dt)
    leftArm.rotation.x = damp(leftArm.rotation.x, armL, k, dt)
    rightArm.rotation.x = damp(rightArm.rotation.x, armR, k, dt)
    this._rig.position.y = Math.abs(Math.sin(this._phase)) * 0.06 * this._swing
    torso.scale.y = 1 + Math.sin(this._time * 2.5) * 0.015 * (1 - this._swing)
  }
}

export const character = (options) => new Character(options)

/** A bouncy blob enemy. Set `speed` to make it bounce faster; game.add() it. */
export class Slime extends THREE.Group {
  constructor({ color = Palette.green, size = 1 } = {}) {
    super()
    this.speed = 0
    this._time = Math.random() * 10
    const body = sphere({ radius: 0.5, detail: 2, color })
    body.position.y = 0.4
    body.scale.set(1, 0.8, 1)
    this.add(body)
    for (const x of [-0.17, 0.17]) {
      const eye = sphere({ radius: 0.11, detail: 1, color: Palette.white, position: [x, 0.5, 0.38] })
      eye.add(sphere({ radius: 0.055, detail: 1, color: Palette.black, position: [0, 0, 0.07] }))
      this.add(eye)
    }
    this._body = body
    this.scale.setScalar(size)
    shadows(this)
  }

  update(dt) {
    this._time += dt * (5 + this.speed)
    const s = Math.sin(this._time)
    this._body.scale.set(1 + s * 0.06, 0.8 - s * 0.08, 1 + s * 0.06)
  }
}

export const slime = (options) => new Slime(options)

// --------------------------------------------------------------- nature

/** kind: "round", "pine", or "palm". */
export function tree({ kind = "round", height = 3, color, trunkColor = Palette.bark } = {}) {
  const group = new THREE.Group()
  const h = height
  if (kind === "pine") {
    group.add(cylinder({ radius: 0.12 * h / 3, height: 0.35 * h, color: trunkColor, position: [0, 0.175 * h, 0] }))
    const tiers = [[0.38, 0.3, 0.42], [0.3, 0.5, 0.36], [0.2, 0.68, 0.3]]
    for (const [radius, y, tierHeight] of tiers) {
      group.add(cone({ radius: radius * h, height: tierHeight * h, segments: 7, color: color ?? Palette.pine, position: [0, y * h, 0] }))
    }
  } else if (kind === "palm") {
    for (let i = 0; i < 5; i++) {
      group.add(cylinder({ radiusTop: 0.09 * h / 3, radiusBottom: 0.12 * h / 3, height: 0.17 * h, segments: 6, color: trunkColor, position: [i * 0.03 * h, (0.085 + i * 0.16) * h, 0], rotation: [0, 0, -0.08] }))
    }
    const top = new THREE.Group()
    top.position.set(0.15 * h, 0.82 * h, 0)
    for (let i = 0; i < 7; i++) {
      const leaf = box({ size: [0.14 * h, 0.03 * h, 0.5 * h], color: color ?? Palette.leaf, position: [0, 0, 0.22 * h] })
      const holder = new THREE.Group()
      holder.rotation.set(0.45, (i / 7) * Math.PI * 2, 0)
      holder.add(leaf)
      top.add(holder)
    }
    group.add(top)
  } else {
    group.add(cylinder({ radiusTop: 0.12 * h / 3, radiusBottom: 0.17 * h / 3, height: 0.45 * h, segments: 7, color: trunkColor, position: [0, 0.225 * h, 0] }))
    group.add(sphere({ radius: 0.33 * h, detail: 0, color: color ?? Palette.leaf, position: [0, 0.66 * h, 0] }))
    group.add(sphere({ radius: 0.2 * h, detail: 0, color: color ?? Palette.leaf, position: [0.18 * h, 0.52 * h, 0.1 * h] }))
  }
  group.rotation.y = Math.random() * Math.PI * 2
  return shadows(group)
}

// Rock shapes are jittered icosahedra; a few variants are shared by all rocks.
function rockGeometry(variant) {
  return cachedGeometry(`rock:${variant}`, () => {
    const geometry = new THREE.DodecahedronGeometry(0.5, 0)
    const position = geometry.attributes.position
    const offsets = new Map()
    const v = new THREE.Vector3()
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i)
      // Vertices shared by several faces must move together, or faces split.
      const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`
      if (!offsets.has(key)) offsets.set(key, 0.75 + Math.random() * 0.45)
      v.multiplyScalar(offsets.get(key))
      position.setXYZ(i, v.x, v.y * 0.75, v.z)
    }
    geometry.computeVertexNormals()
    return geometry
  })
}

export function rock({ size = 1, color = Palette.stone } = {}) {
  const result = mesh(rockGeometry(Math.floor(Math.random() * 4)), color)
  result.scale.setScalar(size)
  result.position.y = size * 0.25
  result.rotation.y = Math.random() * Math.PI * 2
  const group = new THREE.Group()
  group.add(result)
  return group
}

export function bush({ size = 1, color = Palette.leaf } = {}) {
  const group = new THREE.Group()
  for (const [x, y, z, r] of [[0, 0.35, 0, 0.45], [0.35, 0.25, 0.1, 0.32], [-0.3, 0.25, -0.05, 0.34]]) {
    group.add(sphere({ radius: r * size, detail: 0, color, position: [x * size, y * size, z * size] }))
  }
  return shadows(group)
}

/** A puffy cloud, centered. Doesn't cast shadows. */
export function cloud({ size = 1, color = Palette.white } = {}) {
  const group = new THREE.Group()
  for (const [x, y, z, r] of [[0, 0, 0, 0.8], [0.9, -0.15, 0.1, 0.6], [-0.85, -0.1, -0.1, 0.65], [0.3, 0.35, -0.2, 0.55]]) {
    group.add(sphere({ radius: r * size, detail: 1, color, position: [x * size, y * size, z * size], castShadow: false }))
  }
  return group
}

// ------------------------------------------------------------------ props

const lineMaterials = new Map()

export function crate({ size = 1, color = Palette.wood } = {}) {
  const group = new THREE.Group()
  const body = box({ size, color, position: [0, size / 2, 0] })
  const edgesKey = `edges:${size}`
  const edges = cachedGeometry(edgesKey, () => new THREE.EdgesGeometry(new THREE.BoxGeometry(size * 1.001, size * 1.001, size * 1.001)))
  const edgeColor = new THREE.Color(color).multiplyScalar(0.45).getHex()
  if (!lineMaterials.has(edgeColor)) lineMaterials.set(edgeColor, new THREE.LineBasicMaterial({ color: edgeColor }))
  body.add(new THREE.LineSegments(edges, lineMaterials.get(edgeColor)))
  group.add(body)
  return shadows(group)
}

export function barrel({ color = 0xb45309, bandColor = Palette.dark } = {}) {
  const group = new THREE.Group()
  group.add(cylinder({ radiusTop: 0.38, radiusBottom: 0.38, height: 1.1, segments: 14, color, position: [0, 0.55, 0] }))
  for (const y of [0.22, 0.88]) {
    group.add(torus({ radius: 0.39, tube: 0.035, color: bandColor, position: [0, y, 0], rotation: [Math.PI / 2, 0, 0] }))
  }
  return shadows(group)
}

/** A spinning-ready gold coin, standing up and facing +Z. Centered. */
export function coin({ color = Palette.gold, size = 1 } = {}) {
  const gold = material(color, { roughness: 0.3, metalness: 0.6, emissive: color, emissiveIntensity: 0.25 })
  const group = new THREE.Group()
  group.add(cylinder({ radius: 0.35 * size, height: 0.08 * size, segments: 20, material: gold, rotation: [Math.PI / 2, 0, 0] }))
  group.add(cylinder({ radius: 0.22 * size, height: 0.1 * size, segments: 20, material: gold, rotation: [Math.PI / 2, 0, 0] }))
  return shadows(group)
}

/** A glowing crystal. Centered. */
export function gem({ color = Palette.purple, size = 1 } = {}) {
  const shiny = material(color, { roughness: 0.2, metalness: 0.1, emissive: color, emissiveIntensity: 0.35 })
  const geometry = cachedGeometry("gem", () => new THREE.OctahedronGeometry(0.3, 0).scale(1, 1.5, 1))
  const group = new THREE.Group()
  group.add(mesh(geometry, shiny, { scale: size }))
  return shadows(group)
}

function extruded(key, shape, depth) {
  return cachedGeometry(key, () => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelThickness: depth * 0.3, bevelSize: depth * 0.3, bevelSegments: 2,
    })
    geometry.center()
    return geometry
  })
}

/** A heart pickup, facing +Z. Centered. */
export function heart({ color = Palette.red, size = 1 } = {}) {
  const shape = new THREE.Shape()
  // Drawn point-down in a 0..1 box.
  shape.moveTo(0.5, 0.2)
  shape.bezierCurveTo(0.5, 0.2, 0.42, 0, 0.25, 0)
  shape.bezierCurveTo(0, 0, 0, 0.35, 0, 0.35)
  shape.bezierCurveTo(0, 0.55, 0.2, 0.77, 0.5, 0.95)
  shape.bezierCurveTo(0.8, 0.77, 1, 0.55, 1, 0.35)
  shape.bezierCurveTo(1, 0.35, 1, 0, 0.75, 0)
  shape.bezierCurveTo(0.6, 0, 0.5, 0.2, 0.5, 0.2)
  const geometry = extruded("heart", shape, 0.2)
  const shiny = material(color, { roughness: 0.35, emissive: color, emissiveIntensity: 0.25 })
  const group = new THREE.Group()
  group.add(mesh(geometry, shiny, { scale: size * 0.7, rotation: [0, 0, Math.PI] }))
  return shadows(group)
}

/** A five-pointed star, facing +Z. Centered. */
export function star({ color = Palette.yellow, size = 1 } = {}) {
  const shape = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.5 : 0.22
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  const geometry = extruded("star", shape, 0.12)
  const shiny = material(color, { roughness: 0.3, metalness: 0.2, emissive: color, emissiveIntensity: 0.35 })
  const group = new THREE.Group()
  group.add(mesh(geometry, shiny, { scale: size }))
  return shadows(group)
}

/** A goal flag on a pole; the cloth points +X. */
export function flag({ color = Palette.red, height = 3 } = {}) {
  const group = new THREE.Group()
  group.add(cylinder({ radius: 0.05, height, segments: 8, color: Palette.gray, position: [0, height / 2, 0] }))
  group.add(sphere({ radius: 0.1, detail: 1, color: Palette.gold, position: [0, height + 0.05, 0] }))
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(1, 0.35)
  shape.lineTo(0, 0.7)
  const cloth = cachedGeometry("flag", () => new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false }))
  group.add(mesh(cloth, color, { position: [0.04, height - 0.78, -0.02] }))
  return shadows(group)
}

/** A floor block; its origin is the middle of the TOP surface, so position.y = walking height. */
export function platform({ size = [4, 1, 4], color = Palette.dirt, top = Palette.grass } = {}) {
  const [w, h, d] = size3(size)
  const group = new THREE.Group()
  // Stacked, not overlapping: coplanar faces would flicker (z-fighting).
  const topHeight = top === null ? 0 : Math.min(0.2, h / 3)
  group.add(box({ size: [w, h - topHeight, d], color, position: [0, -topHeight - (h - topHeight) / 2, 0] }))
  if (top !== null) group.add(box({ size: [w, topHeight, d], color: top, position: [0, -topHeight / 2, 0] }))
  return shadows(group)
}

/** A flat ground plane at y = 0. `checker` adds a second tile color. */
export function ground({ size = 200, color = Palette.grass, checker = null, tiles = size / 2 } = {}) {
  let mat
  if (checker !== null) {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 2
    const ctx = canvas.getContext("2d")
    const a = `#${new THREE.Color(color).getHexString()}`
    const b = `#${new THREE.Color(checker).getHexString()}`
    ctx.fillStyle = a
    ctx.fillRect(0, 0, 2, 2)
    ctx.fillStyle = b
    ctx.fillRect(0, 0, 1, 1)
    ctx.fillRect(1, 1, 1, 1)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.magFilter = THREE.NearestFilter
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(tiles / 2, tiles / 2)
    mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 })
  } else {
    mat = material(color, { roughness: 1 })
  }
  const plane = new THREE.Mesh(cachedGeometry(`plane:${size}`, () => new THREE.PlaneGeometry(size, size)), mat)
  plane.rotation.x = -Math.PI / 2
  plane.receiveShadow = true
  return plane
}

// --------------------------------------------------------------- vehicles

/** A toy car facing +Z. userData.wheels lets you spin the wheels. */
export function car({ color = Palette.red } = {}) {
  const group = new THREE.Group()
  group.add(box({ size: [1.6, 0.5, 3.2], color, radius: 0.12, position: [0, 0.6, 0] }))
  group.add(box({ size: [1.36, 0.5, 1.6], color: 0x1e293b, radius: 0.1, position: [0, 1.05, -0.2] }))
  group.add(box({ size: [1.42, 0.08, 1.66], color, radius: 0.03, position: [0, 1.31, -0.2] }))
  const wheels = []
  for (const [x, z] of [[0.78, 1.05], [-0.78, 1.05], [0.78, -1.05], [-0.78, -1.05]]) {
    const wheel = new THREE.Group()
    wheel.position.set(x, 0.38, z)
    wheel.add(cylinder({ radius: 0.38, height: 0.3, segments: 14, color: 0x111111, rotation: [0, 0, Math.PI / 2] }))
    wheel.add(cylinder({ radius: 0.18, height: 0.32, segments: 8, color: Palette.gray, rotation: [0, 0, Math.PI / 2] }))
    group.add(wheel)
    wheels.push(wheel)
  }
  const lamp = material(0xfff7d6, { emissive: 0xfff7d6, emissiveIntensity: 1.2 })
  const tail = material(Palette.red, { emissive: Palette.red, emissiveIntensity: 0.8 })
  for (const x of [-0.5, 0.5]) {
    group.add(box({ size: [0.3, 0.14, 0.05], material: lamp, position: [x, 0.7, 1.6] }))
    group.add(box({ size: [0.3, 0.12, 0.05], material: tail, position: [x, 0.7, -1.6] }))
  }
  group.userData.wheels = wheels
  return shadows(group)
}

/** A small spaceship facing +Z, centered. userData.engine is its glowing exhaust. */
export function spaceship({ color = Palette.white, accent = Palette.orange } = {}) {
  const group = new THREE.Group()
  group.add(cylinder({ radiusTop: 0.45, radiusBottom: 0.35, height: 1.2, segments: 8, color, rotation: [Math.PI / 2, 0, 0], position: [0, 0, -0.2] }))
  group.add(cone({ radius: 0.45, height: 1, segments: 8, color, rotation: [Math.PI / 2, 0, 0], position: [0, 0, 0.9] }))
  group.add(sphere({ radius: 0.28, detail: 1, color: 0x0f172a, position: [0, 0.22, 0.35], scale: [1, 0.8, 1.6], flat: false }))
  group.add(box({ size: [2.6, 0.08, 0.8], color: accent, position: [0, -0.05, -0.35] }))
  group.add(box({ size: [0.08, 0.6, 0.6], color: accent, position: [0, 0.35, -0.6] }))
  const glow = material(0xffa24d, { emissive: 0xff7a1a, emissiveIntensity: 2 })
  const engine = cylinder({ radius: 0.28, height: 0.1, segments: 12, material: glow, rotation: [Math.PI / 2, 0, 0], position: [0, 0, -0.85], castShadow: false })
  group.add(engine)
  group.userData.engine = engine
  return shadows(group)
}

// --------------------------------------------------------------- buildings

export function house({ color = 0xf5e6c8, roof = Palette.red, size = 3 } = {}) {
  const group = new THREE.Group()
  const wallHeight = size * 0.75
  group.add(box({ size: [size, wallHeight, size], color, position: [0, wallHeight / 2, 0] }))
  const roofHeight = size * 0.55
  group.add(cone({ radius: size * 0.8, height: roofHeight, segments: 4, color: roof, position: [0, wallHeight + roofHeight / 2, 0], rotation: [0, Math.PI / 4, 0] }))
  group.add(box({ size: [size * 0.22, size * 0.38, 0.06], color: Palette.bark, position: [0, size * 0.19, size / 2 + 0.03] }))
  const glass = material(0xbfe6ff, { emissive: 0x6fb7e8, emissiveIntensity: 0.3 })
  for (const x of [-size * 0.3, size * 0.3]) {
    group.add(box({ size: [size * 0.18, size * 0.18, 0.06], material: glass, position: [x, wallHeight * 0.6, size / 2 + 0.03] }))
  }
  return shadows(group)
}

// ------------------------------------------------------------------- text

/**
 * Text on a camera-facing sprite: signs, names, score popups in the world.
 * `size` is the world height. Change the text later with sprite.setText().
 */
export function textSprite(text, { size = 0.5, color = "#ffffff", background = "rgba(0,0,0,0.55)", font = "800 64px system-ui, sans-serif", padding = 18 } = {}) {
  const canvas = document.createElement("canvas")
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  sprite.setText = (value) => {
    const ctx = canvas.getContext("2d")
    ctx.font = font
    const width = Math.ceil(ctx.measureText(String(value)).width) + padding * 2
    const height = 64 + padding * 2
    canvas.width = width
    canvas.height = height
    ctx.font = font
    if (background) {
      ctx.fillStyle = background
      ctx.beginPath()
      ctx.roundRect?.(0, 0, width, height, height / 2) ?? ctx.rect(0, 0, width, height)
      ctx.fill()
    }
    ctx.fillStyle = color
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(String(value), width / 2, height / 2 + 4)
    texture.dispose()
    texture.needsUpdate = true
    sprite.scale.set((size * width) / height, size, 1)
  }
  sprite.setText(text)
  return sprite
}

const FONT_BASE = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r186/examples/fonts/"
const fonts = new Map()

/**
 * 3D extruded text, centered (async: loads the font the first time).
 * font: helvetiker_regular, helvetiker_bold, optimer_regular, optimer_bold, or a typeface.json URL.
 */
export async function text3d(text, { size = 1, depth = 0.25, color = Palette.white, font = "helvetiker_bold", bevel = true } = {}) {
  const [{ FontLoader }, { TextGeometry }] = await Promise.all([
    import("three/addons/loaders/FontLoader.js"),
    import("three/addons/geometries/TextGeometry.js"),
  ])
  const url = font.includes("/") ? font : `${FONT_BASE}${font}.typeface.json`
  if (!fonts.has(url)) fonts.set(url, new FontLoader().loadAsync(url))
  const geometry = new TextGeometry(String(text), {
    font: await fonts.get(url), size, depth, curveSegments: 6,
    bevelEnabled: bevel, bevelThickness: depth * 0.2, bevelSize: size * 0.03, bevelSegments: 2,
  })
  geometry.center()
  return mesh(geometry, color)
}

// -------------------------------------------------------------- glTF models

const THREE_MODELS = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r186/examples/models/gltf/"
const KHRONOS_MODELS = "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@90d7ede14c7e280af263824604b427a1ca02cb66/Models/"

/**
 * Free animated models on a CDN, by name for loadModel(). `clips` are the
 * animation names; `rotateY` turns the model to face +Z like everything else.
 */
export const MODELS = {
  robot: {
    url: `${THREE_MODELS}RobotExpressive/RobotExpressive.glb`,
    clips: ["Idle", "Walking", "Running", "Jump", "WalkJump", "Punch", "Death", "Dance", "Wave", "Yes", "No", "ThumbsUp", "Sitting", "Standing"],
  },
  soldier: { url: `${THREE_MODELS}Soldier.glb`, clips: ["Idle", "Walk", "Run", "TPose"], rotateY: Math.PI },
  xbot: { url: `${THREE_MODELS}Xbot.glb`, clips: ["idle", "walk", "run", "agree", "headShake", "sad_pose", "sneak_pose"] },
  fox: { url: `${KHRONOS_MODELS}Fox/glTF-Binary/Fox.glb`, clips: ["Survey", "Walk", "Run"] },
  horse: { url: `${THREE_MODELS}Horse.glb`, clips: ["horse_A_"] },
  flamingo: { url: `${THREE_MODELS}Flamingo.glb`, clips: ["flamingo_flyA_"] },
  parrot: { url: `${THREE_MODELS}Parrot.glb`, clips: ["parrot_A_"] },
  stork: { url: `${THREE_MODELS}Stork.glb`, clips: ["storkFly_B_"] },
  duck: { url: `${KHRONOS_MODELS}Duck/glTF-Binary/Duck.glb`, clips: [], rotateY: -Math.PI / 2 },
}

const gltfs = new Map()
let gltfLoader = null
let skeletonUtils = null

/**
 * Loads a glTF/GLB model by MODELS name or URL. Returns a fresh copy each call
 * (load the same model many times for many enemies). The model is wrapped in
 * a Group with its feet at y = 0, centered, and scaled to `height` (or to fit
 * `size` on its largest side). animator is null for models without clips.
 *
 *   const { model, animator } = await loadModel("robot", { height: 1.8 })
 *   game.add(model, animator)
 */
export async function loadModel(nameOrUrl, { height, size, rotateY, castShadow = true } = {}) {
  const entry = MODELS[nameOrUrl]
  const url = entry?.url ?? nameOrUrl
  if (!gltfs.has(url)) {
    gltfLoader ??= import("three/addons/loaders/GLTFLoader.js").then(({ GLTFLoader }) => new GLTFLoader())
    gltfs.set(url, gltfLoader.then((loader) => loader.loadAsync(url)))
  }
  let gltf
  try {
    gltf = await gltfs.get(url)
  } catch (error) {
    gltfs.delete(url)
    throw new Error(`loadModel: could not load "${url}": ${error?.message ?? error}`)
  }
  skeletonUtils ??= await import("three/addons/utils/SkeletonUtils.js")

  const inner = skeletonUtils.clone(gltf.scene)
  inner.rotation.y = rotateY ?? entry?.rotateY ?? 0
  inner.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(inner)
  const dimensions = bounds.getSize(new THREE.Vector3())
  let scale = 1
  if (height) scale = height / dimensions.y
  else if (size) scale = size / Math.max(dimensions.x, dimensions.y, dimensions.z)
  inner.scale.multiplyScalar(scale)
  inner.updateMatrixWorld(true)
  bounds.setFromObject(inner)
  const center = bounds.getCenter(new THREE.Vector3())
  inner.position.x -= center.x
  inner.position.z -= center.z
  inner.position.y -= bounds.min.y

  inner.traverse((child) => {
    if (!child.isMesh) return
    child.castShadow = castShadow
    child.receiveShadow = true
    // Skinned meshes animate outside their bind-pose bounds.
    if (child.isSkinnedMesh) child.frustumCulled = false
  })

  const model = new THREE.Group()
  model.name = typeof nameOrUrl === "string" ? nameOrUrl : "model"
  model.add(inner)
  const animator = gltf.animations.length ? new Animator(inner, gltf.animations) : null
  return { model, animator, animations: gltf.animations }
}

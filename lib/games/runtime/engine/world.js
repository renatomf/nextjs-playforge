// Lighting, sky, fog, and stars in one call.
import * as THREE from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"

import { ground as makeGround } from "./models.js"

const PRESETS = {
  day: {
    sky: ["#5fb4ff", "#d7eeff"], fog: "#d0e8ff", fogRange: [60, 240],
    sun: ["#fff4e0", 2.4], sunDirection: [0.5, 1, 0.35], hemi: ["#cde8ff", "#6b5a45", 1.1], environment: 0.35,
  },
  sunset: {
    sky: ["#3b3b8f", "#ff9a5a"], fog: "#f2a07a", fogRange: [50, 200],
    sun: ["#ffb27a", 2.2], sunDirection: [-0.8, 0.35, 0.3], hemi: ["#ffc6a0", "#3d2f4f", 0.9], environment: 0.3,
  },
  night: {
    sky: ["#03040c", "#141a36"], fog: "#0d1126", fogRange: [30, 140],
    sun: ["#9db8ff", 0.9], sunDirection: [-0.4, 1, -0.3], hemi: ["#3a4a80", "#0b0d18", 0.5], environment: 0.12, stars: true,
  },
  space: {
    sky: ["#000000", "#07071a"], fog: null,
    sun: ["#ffffff", 2.6], sunDirection: [1, 0.6, 0.5], hemi: ["#8899ff", "#110b1e", 0.35], environment: 0.2, stars: true,
  },
  studio: {
    sky: ["#2a2a30", "#0f0f12"], fog: null,
    sun: ["#ffffff", 2], sunDirection: [0.6, 1, 0.8], hemi: ["#ffffff", "#444450", 0.7], environment: 0.8,
  },
  dark: {
    sky: ["#07070a", "#12121a"], fog: "#0a0a10", fogRange: [5, 45],
    sun: ["#8090b0", 0.35], sunDirection: [0.3, 1, 0.2], hemi: ["#303040", "#080808", 0.25], environment: 0.05,
  },
}

/** A vertical gradient texture, for scene.background. */
export function gradientTexture(top, bottom) {
  const canvas = document.createElement("canvas")
  canvas.width = 2
  canvas.height = 256
  const ctx = canvas.getContext("2d")
  const gradient = ctx.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, top)
  gradient.addColorStop(1, bottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 2, 256)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeStars(count = 1500, radius = 400) {
  const positions = new Float32Array(count * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i < count; i++) {
    v.randomDirection().multiplyScalar(radius)
    positions.set([v.x, v.y, v.z], i * 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  const stars = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9, depthWrite: false,
  }))
  stars.frustumCulled = false
  return stars
}

const environments = new WeakMap()

/**
 * Sets up sky, fog, sun (with shadows), sky light, and reflections. Call once.
 * Presets: day, sunset, night, space, studio, dark (dark wants your own lights, e.g. torches).
 *
 *   const env = createEnvironment(game, "day", { ground: true })
 *   env.follow(player)   // keeps sharp shadows around the player in big levels
 */
export function createEnvironment(game, preset = "day", { shadows = true, shadowArea = 50, fog = true, ground = false, stars } = {}) {
  const settings = typeof preset === "string" ? (PRESETS[preset] ?? PRESETS.day) : preset
  const scene = game.scene
  const added = []

  scene.background = gradientTexture(settings.sky[0], settings.sky[1])
  scene.fog = fog && settings.fog ? new THREE.Fog(settings.fog, ...settings.fogRange) : null

  // A soft studio reflection map so metal and shiny materials look right.
  if (!environments.has(game.renderer)) {
    const pmrem = new THREE.PMREMGenerator(game.renderer)
    environments.set(game.renderer, pmrem.fromScene(new RoomEnvironment(), 0.04).texture)
    pmrem.dispose()
  }
  scene.environment = environments.get(game.renderer)
  scene.environmentIntensity = settings.environment

  const hemi = new THREE.HemisphereLight(settings.hemi[0], settings.hemi[1], settings.hemi[2])
  scene.add(hemi)
  added.push(hemi)

  const sun = new THREE.DirectionalLight(settings.sun[0], settings.sun[1])
  const sunOffset = new THREE.Vector3(...settings.sunDirection).normalize().multiplyScalar(60)
  sun.position.copy(sunOffset)
  sun.castShadow = shadows && game.renderer.shadowMap.enabled
  sun.shadow.mapSize.set(2048, 2048)
  const half = shadowArea / 2
  Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 200 })
  sun.shadow.camera.updateProjectionMatrix()
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03
  scene.add(sun, sun.target)
  added.push(sun, sun.target)

  let starField = null
  if (stars ?? settings.stars) {
    starField = makeStars()
    scene.add(starField)
    added.push(starField)
  }

  let groundMesh = null
  if (ground) {
    groundMesh = makeGround(ground === true ? {} : ground)
    scene.add(groundMesh)
    added.push(groundMesh)
  }

  let followTarget = null
  const target = new THREE.Vector3()
  const offHook = game.onRender(() => {
    if (followTarget) {
      followTarget.getWorldPosition(target)
      sun.target.position.copy(target)
      sun.position.copy(target).add(sunOffset)
    }
    starField?.position.copy(game.camera.position)
  })

  return {
    sun,
    hemi,
    stars: starField,
    ground: groundMesh,
    /** Moves the shadow area with an object. */
    follow(object) {
      followTarget = object
    },
    dispose() {
      offHook()
      for (const object of added) object.removeFromParent()
      scene.fog = null
      scene.background = null
    },
  }
}

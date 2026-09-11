// Optional post-processing: bloom, outlines, pixel art, vignette, anti-aliasing.
// Each effect costs a full-screen pass, so only enable what the game needs.
import * as THREE from "three"

/**
 * Renders the game through an effect chain from now on. Async: loads the
 * passes on first use.
 *
 *   const fx = await createPostFX(game, { bloom: { strength: 0.8 } })
 *   const fx = await createPostFX(game, { outline: { color: "#ffcc00" } })
 *   fx.setOutlined([hoveredObject])
 *   const fx = await createPostFX(game, { pixelate: { size: 4 } })
 *
 * Bloom makes bright and emissive materials glow (emissiveIntensity > 1 glows most).
 */
export async function createPostFX(game, { bloom = false, outline = false, pixelate = false, vignette = false, fxaa = false } = {}) {
  const base = "three/addons/postprocessing/"
  const [{ EffectComposer }, { RenderPass }, { OutputPass }] = await Promise.all([
    import(`${base}EffectComposer.js`),
    import(`${base}RenderPass.js`),
    import(`${base}OutputPass.js`),
  ])
  const option = (value) => (value === true ? {} : value)
  const size = () => new THREE.Vector2(game.width, game.height)
  const composer = new EffectComposer(game.renderer)
  const passes = {}
  const result = { composer, passes, setOutlined: () => {} }

  if (pixelate) {
    const { RenderPixelatedPass } = await import(`${base}RenderPixelatedPass.js`)
    const o = option(pixelate)
    passes.pixelate = new RenderPixelatedPass(o.size ?? 4, game.scene, game.camera, {
      normalEdgeStrength: o.normalEdges ?? 0.3,
      depthEdgeStrength: o.depthEdges ?? 0.4,
    })
    composer.addPass(passes.pixelate)
  } else {
    composer.addPass(new RenderPass(game.scene, game.camera))
  }

  if (outline) {
    const { OutlinePass } = await import(`${base}OutlinePass.js`)
    const o = option(outline)
    const pass = new OutlinePass(size(), game.scene, game.camera)
    pass.edgeStrength = o.strength ?? 4
    pass.edgeThickness = o.thickness ?? 1
    pass.edgeGlow = o.glow ?? 0
    pass.visibleEdgeColor.set(o.color ?? "#ffffff")
    pass.hiddenEdgeColor.set(o.hiddenColor ?? "#190a05")
    composer.addPass(pass)
    passes.outline = pass
    /** Which objects get the outline (e.g. the hovered or selected one). */
    result.setOutlined = (objects) => {
      pass.selectedObjects = [objects].flat().filter(Boolean)
    }
  }

  if (bloom) {
    const { UnrealBloomPass } = await import(`${base}UnrealBloomPass.js`)
    const o = option(bloom)
    passes.bloom = new UnrealBloomPass(size(), o.strength ?? 0.6, o.radius ?? 0.4, o.threshold ?? 0.85)
    composer.addPass(passes.bloom)
  }

  if (vignette) {
    const [{ ShaderPass }, { VignetteShader }] = await Promise.all([
      import(`${base}ShaderPass.js`),
      import("three/addons/shaders/VignetteShader.js"),
    ])
    const o = option(vignette)
    passes.vignette = new ShaderPass(VignetteShader)
    passes.vignette.uniforms.offset.value = o.offset ?? 1
    passes.vignette.uniforms.darkness.value = o.darkness ?? 1.1
    composer.addPass(passes.vignette)
  }

  // Tone mapping and sRGB output, which the renderer skips when a composer draws.
  composer.addPass(new OutputPass())

  if (fxaa) {
    const { FXAAPass } = await import(`${base}FXAAPass.js`)
    passes.fxaa = new FXAAPass()
    composer.addPass(passes.fxaa)
  }

  composer.setSize(game.width, game.height)
  const offResize = game.on("resize", (width, height) => composer.setSize(width, height))
  game.renderFn = () => composer.render(game.time.delta)

  result.dispose = () => {
    offResize()
    if (game.renderFn) game.renderFn = null
    composer.dispose()
  }
  return result
}

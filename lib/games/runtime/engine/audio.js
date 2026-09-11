// Sound effects and music synthesized with the Web Audio API: no files needed.
// Audio can only start after the player clicks or presses a key; until then
// play() is silently skipped and music waits.
import { storage } from "./utils.js"

const warned = new Set()
const warnOnce = (message) => {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(message)
}

const NOTE_INDEX = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
}

/** Frequency in Hz of a note name like "A4" or "C#3" (numbers pass through). */
export function noteToFreq(note) {
  if (typeof note === "number") return note
  const match = /^([A-G][#b]?)(-?\d)$/.exec(note)
  if (!match) throw new Error(`noteToFreq: invalid note "${note}"`)
  const midi = NOTE_INDEX[match[1]] + (Number(match[2]) + 1) * 12
  return 440 * 2 ** ((midi - 69) / 12)
}

// Each effect gets { tone, noise } that schedule synth voices; see Sound._voice.
const SFX = {
  jump: ({ tone }) => tone({ type: "square", freq: 260, to: 620, dur: 0.16, vol: 0.16 }),
  coin: ({ tone }) => {
    tone({ type: "square", freq: 988, dur: 0.08, vol: 0.13 })
    tone({ type: "square", freq: 1319, at: 0.07, dur: 0.24, vol: 0.13 })
  },
  powerup: ({ tone }) =>
    [523, 659, 784, 1047, 1319].forEach((freq, i) =>
      tone({ type: "triangle", freq, at: i * 0.06, dur: 0.14, vol: 0.25 })
    ),
  laser: ({ tone }) => tone({ type: "sawtooth", freq: 1400, to: 180, dur: 0.18, vol: 0.11 }),
  shoot: ({ tone, noise }) => {
    tone({ type: "square", freq: 900, to: 120, dur: 0.1, vol: 0.11 })
    noise({ dur: 0.06, vol: 0.12, filter: "highpass", freq: 3000 })
  },
  hit: ({ tone, noise }) => {
    tone({ type: "square", freq: 220, to: 70, dur: 0.14, vol: 0.2 })
    noise({ dur: 0.08, vol: 0.18, freq: 1800 })
  },
  hurt: ({ tone }) => {
    tone({ type: "sawtooth", freq: 440, to: 110, dur: 0.3, vol: 0.16 })
    tone({ type: "square", freq: 330, to: 90, at: 0.05, dur: 0.25, vol: 0.1 })
  },
  explosion: ({ tone, noise }) => {
    noise({ dur: 0.9, vol: 0.5, freq: 1600, to: 60, attack: 0.005 })
    tone({ type: "sine", freq: 140, to: 30, dur: 0.5, vol: 0.5 })
  },
  click: ({ tone }) => tone({ type: "sine", freq: 820, dur: 0.05, vol: 0.2 }),
  select: ({ tone }) => {
    tone({ type: "triangle", freq: 660, dur: 0.07, vol: 0.2 })
    tone({ type: "triangle", freq: 990, at: 0.06, dur: 0.1, vol: 0.2 })
  },
  blip: ({ tone }) => tone({ type: "square", freq: 660, dur: 0.06, vol: 0.11 }),
  step: ({ noise }) => noise({ dur: 0.05, vol: 0.12, freq: 900 }),
  land: ({ tone, noise }) => {
    noise({ dur: 0.1, vol: 0.2, freq: 600 })
    tone({ type: "sine", freq: 120, to: 60, dur: 0.1, vol: 0.2 })
  },
  whoosh: ({ noise }) =>
    noise({ dur: 0.35, vol: 0.25, filter: "bandpass", freq: 400, to: 3000, q: 2, attack: 0.1 }),
  bounce: ({ tone }) => tone({ type: "sine", freq: 180, to: 520, dur: 0.14, vol: 0.3 }),
  pop: ({ tone }) => tone({ type: "sine", freq: 500, to: 1100, dur: 0.08, vol: 0.3 }),
  win: ({ tone }) =>
    [523, 659, 784, 1047].forEach((freq, i) =>
      tone({ type: "triangle", freq, at: i * 0.12, dur: i === 3 ? 0.6 : 0.16, vol: 0.28 })
    ),
  lose: ({ tone }) =>
    [392, 330, 262, 196].forEach((freq, i) =>
      tone({ type: "sawtooth", freq, at: i * 0.18, dur: i === 3 ? 0.6 : 0.2, vol: 0.11 })
    ),
}
SFX.pickup = SFX.coin
SFX.damage = SFX.hurt

// Music: one chord per bar; patterns are 16 steps (sixteenth notes) where "x" plays.
const TRACKS = {
  arcade: {
    bpm: 132,
    chords: [["C4", "E4", "G4"], ["G3", "B3", "D4"], ["A3", "C4", "E4"], ["F3", "A3", "C4"]],
    lead: "square", arp: "x.x.x.x.x.x.x.x.",
    bass: "triangle", bassPattern: "x...x...x...x.x.",
    kick: "x...x...x...x...", snare: "....x.......x...", hat: "..x...x...x...x.",
  },
  chill: {
    bpm: 84,
    chords: [["A3", "C4", "E4", "G4"], ["F3", "A3", "C4", "E4"], ["C4", "E4", "G4", "B4"], ["G3", "B3", "D4", "F#4"]],
    lead: "triangle", arp: "x..x..x.x..x..x.",
    bass: "sine", bassPattern: "x.......x.......",
    pad: "sine",
    kick: "x.........x.....", hat: "....x.......x...",
  },
  tense: {
    bpm: 150,
    chords: [["A3", "C4", "E4"], ["A3", "C4", "E4"], ["F3", "A3", "C4"], ["E3", "G#3", "B3"]],
    lead: "square", arp: "x..x..x.x..x..x.",
    bass: "sawtooth", bassPattern: "x.x.x.x.x.x.x.x.",
    kick: "x...x...x...x...", snare: "....x.......x..x", hat: "xxxxxxxxxxxxxxxx",
  },
  adventure: {
    bpm: 112,
    chords: [["D4", "F4", "A4"], ["A#3", "D4", "F4"], ["F3", "A3", "C4"], ["C4", "E4", "G4"]],
    lead: "triangle", arp: "x.xx.x.xx.x.x.x.",
    bass: "square", bassPattern: "x..x..x.x..x..x.",
    pad: "triangle",
    kick: "x.....x...x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.",
  },
}

/**
 * The shared sound player, exported as `sound`.
 *
 *   sound.play("coin")                        // built-in effect
 *   sound.play("hit", { pitch: 1.3, volume: 0.5, pan: -0.5 })
 *   sound.playMusic("arcade")                 // arcade | chill | tense | adventure
 *   await sound.load("boom", "https://.../boom.mp3"); sound.play("boom")
 */
class Sound {
  constructor() {
    this.context = null
    this.buffers = new Map()
    this._lastPlayed = new Map()
    this._muted = storage.get("engine:muted", false)
    this._volume = 1
    this._music = null
    const unlock = () => this.unlock()
    for (const type of ["pointerdown", "keydown", "touchstart"]) {
      window.addEventListener(type, unlock, { capture: true, passive: true })
    }
  }

  /** Names of the built-in effects and music tracks. */
  get effects() {
    return Object.keys(SFX)
  }

  get tracks() {
    return Object.keys(TRACKS)
  }

  _ensure() {
    if (this.context) return this.context
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return null
    const ctx = new AudioContext()
    this.context = ctx

    this.master = ctx.createGain()
    this.master.gain.value = this._muted ? 0 : this._volume
    this.master.connect(ctx.destination)
    // Keeps many overlapping sounds from clipping.
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -12
    compressor.knee.value = 10
    compressor.ratio.value = 4
    compressor.connect(this.master)
    this.sfxBus = ctx.createGain()
    this.sfxBus.gain.value = 0.8
    this.sfxBus.connect(compressor)
    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = 0.35
    this.musicBus.connect(compressor)

    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    this._noise = noise
    return ctx
  }

  /** Starts audio. Runs automatically on the first click, tap, or key press. */
  unlock() {
    const ctx = this._ensure()
    if (!ctx) return
    const startPending = () => {
      if (this._music?.pending) this._startMusic()
    }
    if (ctx.state === "suspended") ctx.resume().then(startPending, () => {})
    else startPending()
  }

  get ready() {
    return this.context?.state === "running"
  }

  // ------------------------------------------------------------ volume

  get muted() {
    return this._muted
  }

  set muted(value) {
    this.mute(value)
  }

  /** Mutes or unmutes everything; remembered across reloads. Returns the new state. */
  mute(value = true) {
    this._muted = !!value
    storage.set("engine:muted", this._muted)
    this.master?.gain.setTargetAtTime(this._muted ? 0 : this._volume, this.context.currentTime, 0.02)
    return this._muted
  }

  toggleMute() {
    return this.mute(!this._muted)
  }

  get volume() {
    return this._volume
  }

  set volume(value) {
    this._volume = Math.min(1, Math.max(0, value))
    if (!this._muted) this.master?.gain.setTargetAtTime(this._volume, this.context.currentTime, 0.02)
  }

  setMusicVolume(value) {
    this._ensure()
    this.musicBus?.gain.setTargetAtTime(Math.max(0, value) * 0.35, this.context.currentTime, 0.05)
  }

  // ----------------------------------------------------------- effects

  /**
   * Plays a built-in effect or a sound added with load(). Options: volume (0-1),
   * pitch (playback rate, 1 = normal), pan (-1 left to 1 right), and throttle:
   * seconds during which repeats of the same sound are skipped.
   */
  play(name, { volume = 1, pitch = 1, pan = 0, throttle = 0.03 } = {}) {
    const ctx = this._ensure()
    if (!ctx || ctx.state !== "running") return
    const now = ctx.currentTime
    if (now - (this._lastPlayed.get(name) ?? -1) < throttle) return
    this._lastPlayed.set(name, now)

    let out = this.sfxBus
    if (pan) {
      const panner = ctx.createStereoPanner()
      panner.pan.value = Math.min(1, Math.max(-1, pan))
      panner.connect(this.sfxBus)
      out = panner
    }

    const buffer = this.buffers.get(name)
    if (buffer) {
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.playbackRate.value = pitch
      const gain = ctx.createGain()
      gain.gain.value = volume
      source.connect(gain).connect(out)
      source.start(now)
      return
    }

    const effect = SFX[name]
    if (!effect) {
      warnOnce(`sound.play: unknown sound "${name}". Built-in: ${Object.keys(SFX).join(", ")}`)
      return
    }
    effect(this._voice(out, now, volume, pitch))
  }

  /**
   * Plays a custom synthesized sound. Pass one voice or an array of voices:
   * { type: "square"|"sine"|"triangle"|"sawtooth", freq, to (slide to Hz), at (delay s),
   *   dur (s), vol (0-1), attack (s) } or { noise: true, filter, freq, to, q, dur, vol, at }.
   */
  synth(voices, { volume = 1, pitch = 1 } = {}) {
    const ctx = this._ensure()
    if (!ctx || ctx.state !== "running") return
    const voice = this._voice(this.sfxBus, ctx.currentTime, volume, pitch)
    for (const params of [voices].flat()) {
      if (params.noise) voice.noise(params)
      else voice.tone(params)
    }
  }

  _voice(out, t0, volume, pitch) {
    const ctx = this.context
    const envelope = (gain, t, vol, attack, dur) => {
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * volume), t + attack)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    }
    return {
      tone: ({ type = "square", freq = 440, to, at = 0, dur = 0.15, vol = 0.3, attack = 0.005 }) => {
        const t = t0 + at
        const osc = ctx.createOscillator()
        osc.type = type
        osc.frequency.setValueAtTime(freq * pitch, t)
        if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to * pitch), t + dur)
        const gain = ctx.createGain()
        envelope(gain, t, vol, attack, dur)
        osc.connect(gain).connect(out)
        osc.start(t)
        osc.stop(t + dur + 0.02)
      },
      noise: ({ at = 0, dur = 0.2, vol = 0.3, filter = "lowpass", freq = 2000, to, q = 1, attack = 0.002 }) => {
        const t = t0 + at
        const source = ctx.createBufferSource()
        source.buffer = this._noise
        source.loop = true
        source.playbackRate.value = pitch
        const biquad = ctx.createBiquadFilter()
        biquad.type = filter
        biquad.frequency.setValueAtTime(freq, t)
        if (to) biquad.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur)
        biquad.Q.value = q
        const gain = ctx.createGain()
        envelope(gain, t, vol, attack, dur)
        source.connect(biquad).connect(gain).connect(out)
        source.start(t, Math.random() * 0.5)
        source.stop(t + dur + 0.02)
      },
    }
  }

  /** Loads an audio file (mp3/ogg/wav URL) under a name for play(name). */
  async load(name, url) {
    const buffer = await this._fetchBuffer(url)
    this.buffers.set(name, buffer)
    return buffer
  }

  async _fetchBuffer(url) {
    const ctx = this._ensure()
    const response = await fetch(url)
    if (!response.ok) throw new Error(`sound: could not load ${url} (${response.status})`)
    return ctx.decodeAudioData(await response.arrayBuffer())
  }

  // ------------------------------------------------------------- music

  /**
   * Loops background music: a built-in track name (arcade, chill, tense,
   * adventure), a track definition like the ones in TRACKS, or an audio file URL.
   * Starts as soon as audio is unlocked. Replaces any music playing.
   */
  playMusic(track = "arcade", { volume = 1 } = {}) {
    this.stopMusic()
    const isFile = typeof track === "string" && /[./]/.test(track)
    const definition = isFile ? null : typeof track === "string" ? TRACKS[track] : track
    if (!isFile && !definition) {
      warnOnce(`sound.playMusic: unknown track "${track}". Built-in: ${Object.keys(TRACKS).join(", ")}`)
      return
    }
    this._music = { file: isFile ? track : null, definition, volume, step: 0, arp: 0, pending: true }
    this._startMusic()
  }

  get musicPlaying() {
    return !!this._music
  }

  _startMusic() {
    const music = this._music
    const ctx = this._ensure()
    if (!music || !ctx) return
    if (ctx.state !== "running") {
      music.pending = true
      return
    }
    music.pending = false
    music.gain = ctx.createGain()
    music.gain.gain.value = music.volume
    music.gain.connect(this.musicBus)

    if (music.file) {
      this._fetchBuffer(music.file).then((buffer) => {
        if (this._music !== music) return
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true
        source.connect(music.gain)
        source.start()
        music.source = source
      }, (error) => (window.reportGameError ?? console.error)(error))
      return
    }

    music.nextTime = ctx.currentTime + 0.05
    // Schedules notes slightly ahead of time so timers can't make them late.
    music.timer = setInterval(() => {
      const stepDuration = 60 / music.definition.bpm / 4
      while (music.nextTime < ctx.currentTime + 0.12) {
        this._playStep(music, stepDuration)
        music.nextTime += stepDuration
        music.step++
      }
    }, 25)
  }

  _playStep(music, stepDuration) {
    const track = music.definition
    const step = music.step % 16
    const bar = Math.floor(music.step / 16) % track.chords.length
    const chord = track.chords[bar].map(noteToFreq)
    const { tone, noise } = this._voice(music.gain, music.nextTime, 1, 1)

    if (track.pad && step === 0) {
      for (const freq of chord) tone({ type: track.pad, freq, dur: stepDuration * 16, vol: 0.045, attack: 0.3 })
    }
    if (track.arp?.[step] === "x") {
      const freq = chord[music.arp++ % chord.length] * 2
      tone({ type: track.lead, freq, dur: stepDuration * 1.6, vol: 0.07 })
    }
    if (track.bassPattern?.[step] === "x") {
      tone({ type: track.bass, freq: chord[0] / 2, dur: stepDuration * 2.5, vol: 0.16 })
    }
    if (track.kick?.[step] === "x") tone({ type: "sine", freq: 150, to: 40, dur: 0.16, vol: 0.5 })
    if (track.snare?.[step] === "x") noise({ dur: 0.12, vol: 0.18, filter: "highpass", freq: 1200 })
    if (track.hat?.[step] === "x") noise({ dur: 0.03, vol: 0.06, filter: "highpass", freq: 7000 })
  }

  stopMusic({ fade = 0.3 } = {}) {
    const music = this._music
    if (!music) return
    this._music = null
    clearInterval(music.timer)
    if (!music.gain) return
    const ctx = this.context
    music.gain.gain.setTargetAtTime(0, ctx.currentTime, fade / 3)
    setTimeout(() => {
      music.source?.stop()
      music.gain.disconnect()
    }, fade * 1000 + 200)
  }
}

export const sound = new Sound()

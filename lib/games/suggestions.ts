import {
  CarIcon,
  CrosshairIcon,
  Gamepad2Icon,
  PickaxeIcon,
  PlaneIcon,
  SwordsIcon,
  ZapIcon,
} from "lucide-react"

// Each suggestion submits its full prompt; the label is only the button text.
export const suggestions = [
  {
    icon: PickaxeIcon,
    label: "Voxel survival",
    prompt:
      "Build a first-person voxel survival game in a procedurally generated " +
      "blocky world with hills, trees, water, and caves. The player can walk, " +
      "jump, mine blocks with a left click, and place blocks with a right " +
      "click from a hotbar of materials (dirt, stone, wood, sand). Add a " +
      "day/night cycle where zombie-like mobs spawn at night and chase the " +
      "player, plus health and hunger bars that drain over time. Eating " +
      "apples dropped by trees restores hunger.",
  },
  {
    icon: SwordsIcon,
    label: "Ink samurai duel",
    prompt:
      "Build a 1v1 samurai duel game in a sumi-e ink-wash art style: " +
      "black-and-white brush-stroke characters on rice-paper backgrounds with " +
      "splashes of red for hits. The player faces an AI opponent in " +
      "best-of-three rounds, with a light attack, a heavy attack, a parry " +
      "that rewards precise timing, and a quick dash. Each duel opens with a " +
      "tense standoff where the first to strike after a 'draw!' cue gains the " +
      "advantage. Show a stamina bar that limits attacks and dashes.",
  },
  {
    icon: ZapIcon,
    label: "Comic-book firefight",
    prompt:
      "Build a top-down twin-stick shooter styled like a comic book: bold " +
      "ink outlines, halftone shading, flat bright colors, and onomatopoeia " +
      "pop-ups like 'BLAM!' and 'POW!' on hits. Move with WASD and aim and " +
      "shoot with the mouse. Waves of goons pour into a city block, with a " +
      "boss every fifth wave. Enemies drop weapon pickups (shotgun, rapid-fire " +
      "blaster, rocket launcher) and each wave ends with a panel-style " +
      "'CHAPTER COMPLETE' splash showing the score.",
  },
  {
    icon: PlaneIcon,
    label: "Realistic battlefield",
    prompt:
      "Build a realistic 3D air combat game where the player pilots a " +
      "fighter jet over a large terrain with mountains, a river valley, and " +
      "an enemy airbase. Use believable flight controls (pitch, roll, yaw, " +
      "throttle) with a cockpit HUD showing altitude, speed, heading, and a " +
      "target lock indicator. Enemy jets dogfight the player while " +
      "anti-aircraft guns fire from the ground. Weapons are a machine gun and " +
      "a limited number of heat-seeking missiles, and the mission is to " +
      "destroy the airbase's hangars and return alive.",
  },
  {
    icon: CrosshairIcon,
    label: "Fight-first shooter",
    prompt:
      "Build a fast-paced first-person arena shooter that drops the player " +
      "straight into combat with no menus. The arena has multiple levels, " +
      "jump pads, and cover. Enemy bots rush, strafe, and flank in escalating " +
      "waves. The player can sprint, slide, and double jump, and switches " +
      "between a pistol, an assault rifle, and a shotgun with the number " +
      "keys. Show health, ammo, a kill counter, and a combo multiplier for " +
      "rapid kills, and instantly restart on death with a single key press.",
  },
  {
    icon: CarIcon,
    label: "Jungle expedition drive",
    prompt:
      "Build a 3D off-road driving game where the player drives a rugged " +
      "4x4 through a dense jungle along a winding dirt trail with mud pits, " +
      "river crossings, wooden rope bridges, and steep rocky climbs. Give the " +
      "vehicle physics-based suspension that bounces and tilts over bumps, " +
      "and a fuel gauge the player refills by collecting jerry cans. The goal " +
      "is to reach a hidden temple at the end of the trail while collecting " +
      "ancient relics along the way before the fuel runs out.",
  },
  {
    icon: Gamepad2Icon,
    label: "Sunny kingdom platformer",
    prompt:
      "Build a cheerful side-scrolling platformer set in a sunny fairy-tale " +
      "kingdom with rolling green hills, castles, and fluffy clouds. The " +
      "player runs and jumps across floating platforms, stomps on slimes and " +
      "armored beetles, and collects gold coins and hidden stars. Include " +
      "three levels (meadow, castle walls, and a cloud palace) with moving " +
      "platforms and springboards, a checkpoint flag mid-level, and a friendly " +
      "boss fight against a grumpy dragon at the end.",
  },
]

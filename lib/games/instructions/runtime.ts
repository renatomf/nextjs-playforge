import type { SystemModelMessage } from "ai"

import { GAME_DIR, GAME_PORT } from "@/lib/daytona/utils"

// The Three.js release the engine is written for. lib/games/runtime/index.html
// pins the same version in its import map: change both together.
export const THREE_VERSION = "0.186.0"

// Where the game's files live, how the preview serves them, and the page
// skeleton every game starts from.
export const runtimeInstructions: SystemModelMessage = {
  role: "system",
  content: `The game runs in its own Daytona sandbox, a Linux machine that belongs to this chat only.

- The game directory is ${GAME_DIR}. Every file of the game lives there, and nothing outside it is served.
- ${GAME_DIR}/index.html is the entry point: the preview opens it.
- A new game starts with:
  - index.html and style.css: a welcome page with a spinning logo cube. Replace index.html with the game. style.css starts with a full-screen, no-scroll reset worth keeping; replace its welcome styles.
  - engine/: the game engine, built on Three.js (see the engine instructions). It is part of the game: import it, and never delete it or rewrite it from scratch. You may fix or extend an engine file when a game needs it, after reading it.
- The directory is served as static files by \`python3 -m http.server ${GAME_PORT} --directory ${GAME_DIR}\`. There is no build step, no npm, and no server-side code: write plain HTML, CSS, and JavaScript ES modules that run directly in the browser. Put the game's code in game.js, and split it into more modules (\`./js/enemies.js\`) when it grows past a few hundred lines.
- Three.js comes from a CDN through an import map. Every game's index.html looks like this:

\`\`\`html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Game title</title>
    <link rel="stylesheet" href="./style.css" />
    <script type="importmap">
      {
        "imports": {
          "three": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js",
          "three/addons/": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/"
        }
      }
    </script>
    <script src="./engine/errors.js"></script>
  </head>
  <body>
    <script type="module" src="./game.js"></script>
  </body>
</html>
\`\`\`

  Keep the import map and errors.js exactly as shown: the engine imports "three" through the map, and errors.js shows any error in a red panel on the page, so the user can see it and tell you.
- Import Three.js add-ons as "three/addons/..." (e.g. \`import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"\`) so they share the page's Three.js. Other libraries can be loaded from https://cdn.jsdelivr.net with a pinned version.
- Reference the game's own files with relative paths (\`./game.js\`, \`./js/level.js\`), never absolute paths or localhost URLs: the preview is served from a Daytona preview URL, not from localhost.
- The preview loads inside an iframe. Size the game to fill the viewport (the engine does this), and don't rely on window.alert, window.prompt, or opening new windows.
- Keyboard input and audio only reach the game after the player clicks into the preview. Start every game from a title screen with a Play button (hud.screen): that click focuses the game and unlocks sound.
- You can't upload binary files such as images, models, or recordings. Build visuals from the engine's models and primitives, draw textures on a <canvas>, synthesize sound with the engine, or load free models and files from a CDN that allows cross-origin requests (jsDelivr does; the engine lists ready-made models).
- Sandboxes stop when idle and are restarted when the game is opened, so keep all game state in the files. Don't rely on anything outside ${GAME_DIR}, such as background processes or files in /tmp, surviving between turns.`,
}

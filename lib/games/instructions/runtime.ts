import type { SystemModelMessage } from "ai"

import { GAME_DIR, GAME_PORT } from "@/lib/daytona/utils"

// Where the game's files live and how the preview serves them.
export const runtimeInstructions: SystemModelMessage = {
  role: "system",
  content: `The game runs in its own Daytona sandbox, a Linux machine that belongs to this chat only.

- The game directory is ${GAME_DIR}. Every file of the game lives there, and nothing outside it is served.
- ${GAME_DIR}/index.html is the entry point: the preview opens it. A new game starts with a placeholder index.html that only says "New game"; replace it with the real game.
- The directory is served as static files by \`python3 -m http.server ${GAME_PORT} --directory ${GAME_DIR}\`. There is no build step and no server-side code: write plain HTML, CSS, and JavaScript that runs directly in the browser. Use ES modules (\`<script type="module">\`) to split code across files if the game grows.
- Reference the game's own files with relative paths (e.g. \`./game.js\`, \`./assets/player.png\`), never absolute paths or localhost URLs: the preview is served from a Daytona preview URL, not from localhost.
- The preview loads inside an iframe. Size the game to fill the viewport, and don't rely on window.alert, window.prompt, or opening new windows.
- Libraries can be loaded from a CDN (e.g. https://cdn.jsdelivr.net) with a pinned version. Prefer the plain Canvas or DOM APIs for simple games.
- Sandboxes stop when idle and are restarted when the game is opened, so keep all game state in the files. Don't rely on anything outside ${GAME_DIR}, such as background processes or files in /tmp, surviving between turns.`,
}

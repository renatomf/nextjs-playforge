import "server-only"

import { Daytona } from "@daytona/sdk"

// Reads DAYTONA_API_KEY from the environment.
export const daytona = new Daytona()

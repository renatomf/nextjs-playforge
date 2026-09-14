import { GameActionsMenu } from "@/components/game-actions-menu"
import { Button } from "@/components/ui/button"

export function GameHeader({ gameId, title }: { gameId: string; title: string }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <h1 className="truncate text-sm font-medium">{title}</h1>
      <GameActionsMenu
        gameId={gameId}
        title={title}
        trigger={<Button variant="ghost" size="icon-sm" className="ms-auto" />}
      />
    </header>
  )
}

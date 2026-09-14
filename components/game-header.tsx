export function GameHeader({ title }: { title: string }) {
  return (
    <header className="flex h-12 shrink-0 items-center border-b px-4">
      <h1 className="truncate text-sm font-medium">{title}</h1>
    </header>
  )
}

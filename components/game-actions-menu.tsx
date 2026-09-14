"use client"

import { useState, useTransition } from "react"
import { usePathname } from "next/navigation"
import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { deleteGame, renameGame } from "@/lib/games/actions"
import { GAME_TITLE_MAX_LENGTH } from "@/lib/games/title"

type GameProps = {
  gameId: string
  title: string
}

// Lives inside the dialog's popup, which unmounts on close, so each opening
// starts from the current title.
function RenameGameForm({
  gameId,
  title,
  onRenamed,
}: GameProps & { onRenamed: () => void }) {
  const [value, setValue] = useState(title)
  const [isPending, startTransition] = useTransition()

  const nextTitle = value.trim()
  const canSave = nextTitle.length > 0 && nextTitle !== title && !isPending

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSave) return

    startTransition(async () => {
      await renameGame(gameId, nextTitle)
      onRenamed()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Rename game</DialogTitle>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor={`game-title-${gameId}`}>Title</FieldLabel>
        <Input
          id={`game-title-${gameId}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          maxLength={GAME_TITLE_MAX_LENGTH}
          disabled={isPending}
        />
      </Field>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" disabled={!canSave}>
          {isPending && <Spinner />}
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}

function DeleteGameDialog({
  gameId,
  title,
  open,
  onOpenChange,
}: GameProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  // Deleting the game being viewed leaves its page for home; from anywhere
  // else the player stays put. Either way the dialog stays pending until the
  // game is gone from the page.
  function handleDelete() {
    startTransition(async () => {
      await deleteGame(gameId, pathname === `/games/${gameId}`)
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) onOpenChange(nextOpen)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this game?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{title}&rdquo;, its chat and its sandbox will be deleted for
            good. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending && <Spinner />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// A game's rename and delete options, each confirmed in a dialog. `trigger`
// is the element that opens the menu; it gets the menu's icon as children.
export function GameActionsMenu({
  gameId,
  title,
  trigger,
  side = "bottom",
  align = "end",
}: GameProps & {
  trigger: React.ReactElement
} & Pick<React.ComponentProps<typeof DropdownMenuContent>, "side" | "align">) {
  // The menu closes as an item is picked; the dialog it opens lives out here.
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger}>
          <EllipsisIcon />
          <span className="sr-only">Game options</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side={side} align={align} className="w-40">
          <DropdownMenuItem onClick={() => setDialog("rename")}>
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDialog("delete")}
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={dialog === "rename"}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      >
        <DialogContent>
          <RenameGameForm
            gameId={gameId}
            title={title}
            onRenamed={() => setDialog(null)}
          />
        </DialogContent>
      </Dialog>
      <DeleteGameDialog
        gameId={gameId}
        title={title}
        open={dialog === "delete"}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      />
    </>
  )
}

import { auth } from "@clerk/nextjs/server"
import Image from "next/image"

import {
  ChatComposer,
  ChatComposerProvider,
  ChatSuggestion,
} from "@/components/chat-composer"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { suggestions } from "@/lib/games/suggestions"

export default async function Page() {
  await auth.protect()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center">
      <Empty className="flex-none">
        <EmptyHeader>
          <EmptyMedia>
            <Image src="/logo.svg" alt="Logo" width={48} height={48} />
          </EmptyMedia>
          <EmptyTitle className="text-2xl">
            What should we build today?
          </EmptyTitle>
          <EmptyDescription>
            Build your own racers, shooters, puzzles and whole worlds using your
            own words. If you can describe it, you can play it.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="max-w-2xl gap-6">
          <ChatComposerProvider>
            <ChatComposer />
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map(({ icon: Icon, label }) => (
                <ChatSuggestion
                  key={label}
                  label={label}
                  variant="outline"
                  className="rounded-full font-normal text-muted-foreground"
                >
                  <Icon data-icon="inline-start" />
                  {label}
                </ChatSuggestion>
              ))}
            </div>
          </ChatComposerProvider>
        </EmptyContent>
      </Empty>
    </div>
  )
}

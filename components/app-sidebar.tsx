"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs"
import { CoinsIcon, MessageSquareIcon, SquarePenIcon } from "lucide-react"
import { cn } from "cn"

import { useCreditBalance } from "@/components/credit-balance"
import { Empty, EmptyDescription } from "@/components/ui/empty"
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { formatDollars } from "@/lib/credits/format"
import type { Game } from "@/lib/db/schema"

function GamesMenu({
  games,
  pathname,
  closeOnSelect = false,
  className,
  ...props
}: React.ComponentProps<typeof SidebarMenu> & {
  games: Pick<Game, "id" | "title">[]
  pathname: string
  closeOnSelect?: boolean
}) {
  return (
    <SidebarMenu className={cn("gap-1", className)} {...props}>
      {games.map((game) => {
        const button = (
          <SidebarMenuButton
            isActive={pathname === `/games/${game.id}`}
            render={<Link href={`/games/${game.id}`} />}
          >
            <span>{game.title}</span>
          </SidebarMenuButton>
        )

        return (
          <SidebarMenuItem key={game.id}>
            {closeOnSelect ? (
              <PopoverClose nativeButton={false} render={button} />
            ) : (
              button
            )}
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

export function AppSidebar({
  games,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  games: Pick<Game, "id" | "title">[]
}) {
  const pathname = usePathname()
  const { balance } = useCreditBalance()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="flex-row items-center">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
          <Image
            src="/logo.svg"
            alt="Sandbox"
            width={20}
            height={20}
            className="size-5"
          />
          <span className="font-logo text-base">Sandbox</span>
        </div>
        <SidebarTrigger className="ms-auto group-data-[collapsible=icon]:ms-0" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/"}
                render={<Link href="/" />}
              >
                <SquarePenIcon />
                <span>New game</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Recents</SidebarGroupLabel>
          <SidebarGroupContent>
            {games.length === 0 ? (
              <Empty className="border p-2 group-data-[collapsible=icon]:hidden">
                <EmptyDescription className="text-xs">
                  Your games will live here.
                </EmptyDescription>
              </Empty>
            ) : (
              <GamesMenu
                games={games}
                pathname={pathname}
                className="group-data-[collapsible=icon]:hidden"
              />
            )}
            <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
              <SidebarMenuItem>
                <Popover>
                  <PopoverTrigger render={<SidebarMenuButton />}>
                    <MessageSquareIcon />
                    <span>Recents</span>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" className="w-56">
                    <PopoverHeader>
                      <PopoverTitle>Recents</PopoverTitle>
                    </PopoverHeader>
                    {games.length === 0 ? (
                      <PopoverDescription className="text-xs">
                        Your games will live here.
                      </PopoverDescription>
                    ) : (
                      <GamesMenu
                        games={games}
                        pathname={pathname}
                        closeOnSelect
                      />
                    )}
                  </PopoverContent>
                </Popover>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/billing"}
              render={<Link href="/billing" />}
            >
              <CoinsIcon />
              <span>Credits</span>
            </SidebarMenuButton>
            <SidebarMenuBadge>{formatDollars(balance)}</SidebarMenuBadge>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center justify-between px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <OrganizationSwitcher
              appearance={{
                elements: {
                  rootBox: "w-full! max-w-full",
                  organizationSwitcherTrigger:
                    "w-full! max-w-full justify-between!",
                  organizationPreview: "min-w-0",
                  organizationPreviewTextContainer: "min-w-0",
                  organizationPreviewMainIdentifier: "truncate",
                },
              }}
            />
          </div>
          <UserButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

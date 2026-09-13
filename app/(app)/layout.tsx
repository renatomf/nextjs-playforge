import { auth } from "@clerk/nextjs/server"

import { AppSidebar } from "@/components/app-sidebar"
import { CreditBalanceProvider } from "@/components/credit-balance"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { FREE_CREDITS, getBalance } from "@/lib/credits/ledger"
import { listGames } from "@/lib/games/queries"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { orgId } = await auth()
  const [games, balance] = await Promise.all([
    listGames(),
    orgId ? getBalance(orgId) : FREE_CREDITS,
  ])

  return (
    <CreditBalanceProvider balance={balance}>
      <SidebarProvider>
        <AppSidebar games={games} />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </CreditBalanceProvider>
  )
}

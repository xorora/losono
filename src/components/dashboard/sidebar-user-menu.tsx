"use client";

import { ChevronsUpDownIcon, CreditCard, User } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type SidebarUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type SidebarUserMenuProps = {
  user: SidebarUser;
  logout: ReactNode;
};

function getUserLabel(user: SidebarUser) {
  return user.name ?? user.email ?? "Account";
}

function getUserInitials(user: SidebarUser) {
  const source = user.name ?? user.email ?? "?";
  const parts = source.trim().split(/\s+/);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function SidebarUserMenu({ user, logout }: SidebarUserMenuProps) {
  const { isMobile } = useSidebar();
  const label = getUserLabel(user);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                {user.image ? (
                  <AvatarImage src={user.image} alt={label} />
                ) : null}
                <AvatarFallback className="rounded-lg">
                  {getUserInitials(user)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{label}</span>
                {user.email ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                ) : null}
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg">
                  {user.image ? (
                    <AvatarImage src={user.image} alt={label} />
                  ) : null}
                  <AvatarFallback className="rounded-lg">
                    {getUserInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{label}</span>
                  {user.email ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  ) : null}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <User />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/billing">
                <CreditCard />
                Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {logout}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LayoutDashboard, Plus, Youtube } from "lucide-react";

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/plans/new", icon: Plus, label: "New Plan" },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="w-16 border-r border-zinc-200 dark:border-zinc-800 flex flex-col items-center py-4 bg-white dark:bg-zinc-900">
        {/* Logo */}
        <Link
          href="/"
          className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center mb-6"
        >
          <Youtube className="w-6 h-6 text-white" />
        </Link>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link href={item.href}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "w-10 h-10 rounded-xl transition-colors",
                        isActive
                          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* User section */}
        <div className="flex flex-col gap-2 items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/profile">
                <Avatar
                  className={cn(
                    "w-9 h-9 cursor-pointer ring-2 ring-transparent transition-all hover:ring-zinc-300 dark:hover:ring-zinc-600",
                    pathname === "/profile" &&
                      "ring-red-500 dark:ring-red-500"
                  )}
                >
                  <AvatarImage src={user.image ?? undefined} />
                  <AvatarFallback className="text-xs bg-zinc-100 dark:bg-zinc-800">
                    {user.name?.[0] ?? user.email?.[0] ?? "?"}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Profile</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}

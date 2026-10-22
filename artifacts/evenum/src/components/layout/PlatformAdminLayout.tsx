import React from "react";
import { Link } from "wouter";
import { useLogout } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { EvenumLogo } from "@/components/branding/EvenumLogo";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Activity, ArrowLeft, LogOut, Settings, ShieldCheck } from "lucide-react";

export function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const logout = useLogout();
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.href = import.meta.env.BASE_URL;
      },
      onError: () => {
        toast({
          title: t("nav.logOut"),
          description: t("common.tryAgain"),
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="min-h-[100dvh] bg-muted/20">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Link href="/admin" aria-label="ROBYNE platform operations home" className="shrink-0">
              <EvenumLogo size="md" showWordmark />
            </Link>
            <div className="hidden min-w-0 border-l border-border pl-4 sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("admin.platformWorkspace")}
              </p>
              <p className="truncate text-sm font-semibold">{t("admin.commandCenter")}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <div className="hidden items-center gap-2 rounded-sm border border-emerald-600/20 bg-emerald-600/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400 lg:flex">
              <Activity className="h-3.5 w-3.5" />
              <span>{t("admin.platformWorkspace")}</span>
            </div>
            <LanguageSwitcher />
            <ThemeToggle />
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("admin.returnToWorkspace")}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" className="sm:hidden" aria-label={t("admin.returnToWorkspace")}>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 w-9 rounded-full p-0" aria-label={user?.name ?? t("admin.platformWorkspace")}>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() ?? <ShieldCheck className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{user?.name}</span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      <ShieldCheck className="h-3 w-3" />
                      {t("admin.platformWorkspace")}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex w-full cursor-pointer items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    {t("settings.title")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  disabled={logout.isPending}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("nav.logOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="border-t border-border/40 px-4 py-2 sm:hidden">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("admin.platformWorkspace")}
          </p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}

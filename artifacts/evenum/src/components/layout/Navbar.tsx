import React from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useLogout } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { EvenumLogo } from '@/components/branding/EvenumLogo';
import { 
  Building2, 
  Vote, 
  CalendarDays, 
  Megaphone, 
  LayoutDashboard,
  LogOut,
  User,
  Plus,
  ShieldCheck
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function Navbar() {
  const { user, isAuthenticated } = useAuth();
  const logout = useLogout();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.href = '/';
      },
      onError: () => {
        toast({
          title: t('nav.logOut'),
           description: t('common.tryAgain'),
          variant: "destructive"
        });
      }
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex shrink-0 items-center" aria-label="ROBLYNE home">
            <EvenumLogo size="md" showWordmark />
          </Link>
          
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-foreground">{t('nav.discovery')}</Link>
            {isAuthenticated && (
              <>
                <Link href="/dashboard" className="transition-colors hover:text-foreground">{t('nav.dashboard')}</Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden sm:block"><LanguageSwitcher /></div>
          {!isAuthenticated ? (
            <>
              <Button variant="ghost" asChild className="hidden sm:inline-flex">
                <Link href="/login">{t('common.signIn')}</Link>
              </Button>
              <Button asChild>
                <Link href="/register">{t('common.getStarted')}</Link>
              </Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary">{user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="cursor-pointer flex items-center w-full">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    <span>{t('nav.dashboard')}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/organizations/new" className="cursor-pointer flex items-center w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    <span>{t('nav.createOrganization')}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer flex items-center w-full">
                    <User className="mr-2 h-4 w-4" />
                     <span>{t('settings.title')}</span>
                  </Link>
                </DropdownMenuItem>
                {user?.isPlatformAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer flex items-center w-full text-primary">
                        <ShieldCheck className="mr-2 h-4 w-4" />
                         <span>{t('admin.platformAdmin')}</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('nav.logOut')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Public mobile menu. Authenticated workspace navigation is provided by DashboardLayout. */}
          {!isAuthenticated && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle className="font-serif text-2xl font-bold flex items-center gap-2">
                    <EvenumLogo size="lg" showWordmark />
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-6 mt-8">
                  <nav className="flex flex-col gap-4 text-base font-medium">
                    <Link href="/" className="transition-colors hover:text-primary">{t('nav.discovery')}</Link>
                  </nav>
                  <div className="flex flex-col gap-4 pt-6 border-t">
                    <div className="sm:hidden flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('theme.label')}</span>
                      <div className="flex items-center gap-1">
                        <LanguageSwitcher />
                        <ThemeToggle />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" asChild className="w-full justify-start">
                        <Link href="/login">{t('common.signIn')}</Link>
                      </Button>
                      <Button asChild className="w-full justify-start">
                        <Link href="/register">{t('common.getStarted')}</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  );
}

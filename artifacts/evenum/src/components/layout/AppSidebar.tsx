import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Building2, 
  Vote, 
  CalendarDays, 
  Megaphone,
  ChevronDown,
  LayoutDashboard,
  Settings
} from 'lucide-react';
import { useListOrganizations, Organization } from '@workspace/api-client-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function AppSidebar({ orgId }: { orgId?: string }) {
  const { data: organizations } = useListOrganizations();
  const [location] = useLocation();
  const { t } = useTranslation();

  const currentOrgId = orgId ? parseInt(orgId, 10) : undefined;
  const currentOrg = organizations?.find(o => o.id === currentOrgId);

  return (
    <Sidebar variant="inset" className="border-r">
      <SidebarHeader className="border-b px-4 py-4">
        {currentOrg ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('sidebar.organization')}</span>
            <span className="font-serif font-bold text-lg">{currentOrg.name}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('sidebar.workspace')}</span>
            <span className="font-serif font-bold text-lg">{t('sidebar.dashboard')}</span>
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('sidebar.overview')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === '/dashboard'}>
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>{t('sidebar.myOrganizations')}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {currentOrg && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === `/organizations/${currentOrg.id}`}>
                    <Link href={`/organizations/${currentOrg.id}`}>
                      <Building2 className="h-4 w-4" />
                      <span>{t('sidebar.orgOverview')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {currentOrg && (
          <SidebarGroup>
            <SidebarGroupLabel>{t('sidebar.engines')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.startsWith('/elections')}>
                    <Link href={`/organizations/${currentOrg.id}?tab=elections`}>
                      <Vote className="h-4 w-4" />
                      <span>{t('sidebar.elections')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.startsWith('/events')}>
                    <Link href={`/organizations/${currentOrg.id}?tab=events`}>
                      <CalendarDays className="h-4 w-4" />
                      <span>{t('sidebar.events')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.startsWith('/campaigns')}>
                    <Link href={`/organizations/${currentOrg.id}?tab=campaigns`}>
                      <Megaphone className="h-4 w-4" />
                      <span>{t('sidebar.campaigns')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location === '/settings'}>
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center justify-end mt-2 pt-2 border-t">
          <LanguageSwitcher />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

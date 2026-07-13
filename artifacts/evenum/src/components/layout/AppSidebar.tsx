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
import {
  Sidebar,
  SidebarContent,
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

  const currentOrgId = orgId ? parseInt(orgId, 10) : undefined;
  const currentOrg = organizations?.find(o => o.id === currentOrgId);

  return (
    <Sidebar variant="inset" className="border-r">
      <SidebarHeader className="border-b px-4 py-4">
        {currentOrg ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Organization</span>
            <span className="font-serif font-bold text-lg">{currentOrg.name}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Workspace</span>
            <span className="font-serif font-bold text-lg">Dashboard</span>
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === '/dashboard'}>
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>My Organizations</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {currentOrg && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === `/organizations/${currentOrg.id}`}>
                    <Link href={`/organizations/${currentOrg.id}`}>
                      <Building2 className="h-4 w-4" />
                      <span>Org Overview</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {currentOrg && (
          <SidebarGroup>
            <SidebarGroupLabel>Engines</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.startsWith('/elections')}>
                    <Link href={`/organizations/${currentOrg.id}?tab=elections`}>
                      <Vote className="h-4 w-4" />
                      <span>Elections</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.startsWith('/events')}>
                    <Link href={`/organizations/${currentOrg.id}?tab=events`}>
                      <CalendarDays className="h-4 w-4" />
                      <span>Events</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.startsWith('/campaigns')}>
                    <Link href={`/organizations/${currentOrg.id}?tab=campaigns`}>
                      <Megaphone className="h-4 w-4" />
                      <span>Campaigns</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

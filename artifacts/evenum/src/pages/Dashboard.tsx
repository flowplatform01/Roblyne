import React from 'react';
import { Link } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListOrganizations } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Plus, ArrowRight, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: organizations, isLoading } = useListOrganizations();

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold tracking-tight">Your Organizations</h1>
            <p className="text-muted-foreground">Manage your workspaces and access their engines.</p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 h-4 w-4" />
              New Organization
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
          </div>
        ) : !organizations || organizations.length === 0 ? (
          <div className="bg-card border border-dashed rounded-xl p-12 text-center max-w-2xl mx-auto w-full">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Building2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-serif font-bold mb-2">No organizations yet</h2>
            <p className="text-muted-foreground mb-8">
              Create your first organization to start managing elections, events, and campaigns.
            </p>
            <Button size="lg" asChild>
              <Link href="/organizations/new">
                <Plus className="mr-2 h-5 w-5" />
                Create Organization
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map(org => (
              <Card key={org.id} className="hover:border-primary/50 transition-colors flex flex-col group">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    {org.logoUrl ? (
                      <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Building2 className="h-6 w-6" />
                    )}
                  </div>
                  <CardTitle className="font-serif text-xl">{org.name}</CardTitle>
                  <CardDescription>Created {format(new Date(org.createdAt), 'MMM d, yyyy')}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  {org.description ? (
                    <p className="text-sm text-muted-foreground line-clamp-2">{org.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No description provided</p>
                  )}
                </CardContent>
                <CardFooter className="pt-4 border-t">
                  <Button variant="ghost" className="w-full justify-between" asChild>
                    <Link href={`/organizations/${org.id}`}>
                      Enter Workspace <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

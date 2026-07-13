import React, { useState } from 'react';
import { useRoute, Link, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { 
  useGetElection, 
  useListPositions,
  useCreatePosition,
  useUpdateElection,
  useListCandidates,
  useGetElectionAnalytics,
  getListPositionsQueryKey,
  getGetElectionQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Users, Vote, ArrowLeft, MoreVertical, Play, Square, ExternalLink, BarChart3, Clock, Copy } from "lucide-react";
import { format } from "date-fns";
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from "@tanstack/react-query";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const positionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  maxSelections: z.coerce.number().min(1).default(1),
  sortOrder: z.coerce.number().default(0),
});

export default function ElectionDetail() {
  const [match, params] = useRoute("/elections/:id");
  const electionId = params?.id ? parseInt(params.id, 10) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("positions");
  const [isPositionDialogOpen, setIsPositionDialogOpen] = useState(false);

  const { data: election, isLoading: isElectionLoading } = useGetElection(electionId);
  const { data: positions, isLoading: isPositionsLoading } = useListPositions(electionId);
  const { data: candidates, isLoading: isCandidatesLoading } = useListCandidates(electionId);
  const { data: analytics, isLoading: isAnalyticsLoading } = useGetElectionAnalytics(electionId);
  
  const updateElection = useUpdateElection();
  const createPosition = useCreatePosition();

  const form = useForm<z.infer<typeof positionSchema>>({
    resolver: zodResolver(positionSchema),
    defaultValues: {
      title: "",
      description: "",
      maxSelections: 1,
      sortOrder: 0,
    },
  });

  if (isElectionLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        </div>
      </DashboardLayout>
    );
  }

  if (!election) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-2">Election Not Found</h2>
          <Button asChild><Link href="/dashboard">Return to Dashboard</Link></Button>
        </div>
      </DashboardLayout>
    );
  }

  const handleStatusChange = (newStatus: 'draft' | 'active' | 'ended') => {
    updateElection.mutate(
      { electionId, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetElectionQueryKey(electionId) });
          toast({ title: `Election marked as ${newStatus}` });
        }
      }
    );
  };

  const handleCreatePosition = (values: z.infer<typeof positionSchema>) => {
    createPosition.mutate(
      { electionId, data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPositionsQueryKey(electionId) });
          setIsPositionDialogOpen(false);
          form.reset();
          toast({ title: "Position created" });
        }
      }
    );
  };

  const copyVotingLink = () => {
    const url = `${window.location.origin}/elections/${election.id}/vote`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied to clipboard" });
  };

  const getStatusBadge = () => {
    switch (election.status) {
      case 'active': return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge>;
      case 'draft': return <Badge variant="outline" className="bg-slate-100 text-slate-800">Draft</Badge>;
      case 'ended': return <Badge variant="secondary">Ended</Badge>;
      default: return null;
    }
  };

  return (
    <DashboardLayout orgId={election.orgId.toString()}>
      <div className="mb-6">
        <Button variant="ghost" asChild className="-ml-4 text-muted-foreground mb-4">
          <Link href={`/organizations/${election.orgId}?tab=elections`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Organization
          </Link>
        </Button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded bg-blue-100 text-blue-700 flex items-center justify-center">
                <Vote className="h-5 w-5" />
              </div>
              <h1 className="text-3xl font-serif font-bold tracking-tight">{election.title}</h1>
              {getStatusBadge()}
            </div>
            {election.description && <p className="text-muted-foreground max-w-3xl mt-2">{election.description}</p>}
            
            <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Badge variant="outline">{election.visibility}</Badge></span>
              {election.requiresAuth && <span className="flex items-center gap-1.5"><Badge variant="outline">Requires Auth</Badge></span>}
              {election.startsAt && <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {format(new Date(election.startsAt), 'MMM d, yyyy h:mm a')}</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {election.status === 'active' && (
              <Button onClick={copyVotingLink} variant="outline">
                <Copy className="mr-2 h-4 w-4" /> Copy Voting Link
              </Button>
            )}
            
            <Button asChild variant={election.status === 'active' ? "default" : "secondary"}>
              <Link href={`/elections/${election.id}/vote`}>
                <ExternalLink className="mr-2 h-4 w-4" /> View Voting Page
              </Link>
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {election.status === 'draft' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('active')}>
                    <Play className="mr-2 h-4 w-4 text-emerald-600" /> Start Election
                  </DropdownMenuItem>
                )}
                {election.status === 'active' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('ended')}>
                    <Square className="mr-2 h-4 w-4 text-amber-600" /> End Election
                  </DropdownMenuItem>
                )}
                {election.status === 'ended' && (
                  <DropdownMenuItem asChild>
                    <Link href={`/elections/${election.id}/results`} className="w-full flex items-center">
                      <BarChart3 className="mr-2 h-4 w-4" /> View Results
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 border-b rounded-none bg-transparent p-0 w-full justify-start h-auto">
              <TabsTrigger 
                value="positions" 
                className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Positions & Candidates
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Analytics & Results
              </TabsTrigger>
            </TabsList>

            <TabsContent value="positions" className="mt-0 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-serif font-bold">Positions</h2>
                <Dialog open={isPositionDialogOpen} onOpenChange={setIsPositionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" /> Add Position</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Position</DialogTitle>
                      <DialogDescription>Create a position or question for voters to vote on.</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleCreatePosition)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Position Title</FormLabel>
                              <FormControl><Input placeholder="e.g. President" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description (Optional)</FormLabel>
                              <FormControl><Textarea placeholder="Responsibilities..." {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="maxSelections"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Max Selections</FormLabel>
                              <FormControl><Input type="number" min={1} {...field} /></FormControl>
                              <FormDescription>How many candidates can a voter choose?</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="submit" disabled={createPosition.isPending}>
                            {createPosition.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Position
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {isPositionsLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary/50" /></div>
              ) : !positions || positions.length === 0 ? (
                <Card className="border-dashed bg-muted/20">
                  <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                    <Vote className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No positions added yet</h3>
                    <p className="text-muted-foreground mb-4">Start by adding the offices or questions to your ballot.</p>
                    <Button onClick={() => setIsPositionDialogOpen(true)}>Add First Position</Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {positions.map(position => {
                    const posCandidates = candidates?.filter(c => c.positionId === position.id) || [];
                    return (
                      <Card key={position.id} className="overflow-hidden border-border/60">
                        <CardHeader className="bg-muted/30 pb-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="font-serif">{position.title}</CardTitle>
                              {position.description && <CardDescription className="mt-1">{position.description}</CardDescription>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Max Select: {position.maxSelections}</Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          {posCandidates.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground">
                              No candidates added to this position yet.
                            </div>
                          ) : (
                            <div className="divide-y">
                              {posCandidates.map(candidate => (
                                <div key={candidate.id} className="p-4 flex items-center gap-4 hover:bg-muted/10 transition-colors">
                                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 overflow-hidden">
                                    {candidate.photoUrl ? (
                                      <img src={candidate.photoUrl} alt={candidate.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="font-serif font-bold text-lg">{candidate.name.charAt(0)}</span>
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-medium text-base">{candidate.name}</h4>
                                    {candidate.bio && <p className="text-sm text-muted-foreground line-clamp-1">{candidate.bio}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="bg-muted/10 p-3 border-t">
                          <Button variant="ghost" size="sm" className="w-full" onClick={() => {
                            // Basic interaction stub for adding candidate
                            toast({ title: "Adding candidates coming soon" });
                          }}>
                            <Plus className="mr-2 h-4 w-4" /> Add Candidate
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="analytics" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Votes Cast</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-serif font-bold">{analytics?.totalVotes || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Voter Turnout Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-serif font-bold">
                      {analytics?.turnoutRate ? `${(analytics.turnoutRate * 100).toFixed(1)}%` : 'N/A'}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {election.status === 'ended' && (
                <div className="mt-8 text-center p-12 border border-dashed rounded-xl bg-muted/20">
                  <BarChart3 className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-serif font-bold mb-2">Election Concluded</h3>
                  <p className="text-muted-foreground mb-6">Voting has ended. You can view the final, official results.</p>
                  <Button asChild size="lg">
                    <Link href={`/elections/${election.id}/results`}>View Detailed Results</Link>
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-serif">Election Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Status</span>
                {getStatusBadge()}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Positions</span>
                <span className="font-medium">{election.positionsCount || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Candidates</span>
                <span className="font-medium">{election.candidatesCount || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Total Votes</span>
                <span className="font-medium">{election.totalVotes || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

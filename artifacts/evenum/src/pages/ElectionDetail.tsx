import React, { useState } from 'react';
import { useRoute, Link, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { 
  useGetElection, 
  useListPositions,
  useCreatePosition,
  useUpdateElection,
  useListCandidates,
  useCreateCandidate,
  useDeleteCandidate,
  useGetElectionAnalytics,
  useListEligibleVoters,
  useAddEligibleVoters,
  useRemoveEligibleVoter,
  getListPositionsQueryKey,
  getGetElectionQueryKey,
  getListEligibleVotersQueryKey,
  getListCandidatesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Users, Vote, ArrowLeft, MoreVertical, Play, Square, ExternalLink, BarChart3, Clock, Copy, Trash2, Key, Shield, UserPlus, Save, DollarSign, CreditCard } from "lucide-react";
import { ShareButton } from "@/components/branding/ShareButton";
import { ImageUpload } from "@/components/ui/image-upload";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccentColorPicker } from "@/components/branding/AccentColorPicker";
import { format } from "date-fns";
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from "@tanstack/react-query";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const candidateSchema = z.object({
  name: z.string().min(1, "Candidate name is required"),
  bio: z.string().optional(),
  platform: z.string().optional(),
  photoUrl: z.string().optional(), // accepts base64 data URLs from ImageUpload
});

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
  const [isCandidateDialogOpen, setIsCandidateDialogOpen] = useState(false);
  const [candidatePositionId, setCandidatePositionId] = useState<number | null>(null);
  const [voterEmailsInput, setVoterEmailsInput] = useState("");

  const { data: election, isLoading: isElectionLoading } = useGetElection(electionId);
  const { data: positions, isLoading: isPositionsLoading } = useListPositions(electionId);
  const { data: candidates, isLoading: isCandidatesLoading } = useListCandidates(electionId);
  const { data: analytics, isLoading: isAnalyticsLoading } = useGetElectionAnalytics(electionId);
  const { data: eligibleVoters, isLoading: isEligibleVotersLoading } = useListEligibleVoters(
    electionId,
    { query: { enabled: !!election && election.eligibilityMode === 'allowlist', queryKey: getListEligibleVotersQueryKey(electionId) } }
  );
  
  const updateElection = useUpdateElection();
  const createPosition = useCreatePosition();
  const createCandidate = useCreateCandidate();
  const deleteCandidate = useDeleteCandidate();
  const addEligibleVoters = useAddEligibleVoters();
  const removeEligibleVoter = useRemoveEligibleVoter();

  const form = useForm<z.infer<typeof positionSchema>>({
    resolver: zodResolver(positionSchema),
    defaultValues: {
      title: "",
      description: "",
      maxSelections: 1,
      sortOrder: 0,
    },
  });

  const candidateForm = useForm<z.infer<typeof candidateSchema>>({
    resolver: zodResolver(candidateSchema),
    defaultValues: {
      name: "",
      bio: "",
      platform: "",
      photoUrl: "",
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

  const handleCreateCandidate = (values: z.infer<typeof candidateSchema>) => {
    if (!candidatePositionId) return;
    createCandidate.mutate(
      {
        electionId,
        data: {
          positionId: candidatePositionId,
          name: values.name,
          bio: values.bio || undefined,
          platform: values.platform || undefined,
          photoUrl: values.photoUrl || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCandidatesQueryKey(electionId) });
          setIsCandidateDialogOpen(false);
          setCandidatePositionId(null);
          candidateForm.reset();
          toast({ title: "Candidate added" });
        },
        onError: (error: any) => {
          toast({ variant: "destructive", title: "Failed to add candidate", description: error?.data?.error || "Please try again." });
        },
      }
    );
  };

  const handleDeleteCandidate = (candidateId: number, candidateName: string) => {
    deleteCandidate.mutate(
      { electionId, candidateId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCandidatesQueryKey(electionId) });
          toast({ title: "Candidate removed", description: `${candidateName} has been removed.` });
        },
        onError: (error: any) => {
          toast({ variant: "destructive", title: "Failed to remove candidate", description: error?.data?.error || "Please try again." });
        },
      }
    );
  };

  const openCandidateDialog = (positionId: number) => {
    setCandidatePositionId(positionId);
    candidateForm.reset();
    setIsCandidateDialogOpen(true);
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

  const handleAddVoters = (e: React.FormEvent) => {
    e.preventDefault();
    const emails = voterEmailsInput
      .split(/[\n,]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0);
    if (emails.length === 0) return;

    addEligibleVoters.mutate(
      { electionId, data: { emails } },
      {
        onSuccess: (added) => {
          queryClient.invalidateQueries({ queryKey: getListEligibleVotersQueryKey(electionId) });
          setVoterEmailsInput("");
          toast({ title: `${added.length} voter(s) added to allowlist` });
        },
        onError: (error: any) => {
          toast({ variant: "destructive", title: "Failed to add voters", description: error?.data?.error || "Please try again." });
        }
      }
    );
  };

  const handleRemoveVoter = (voterId: number, email: string) => {
    removeEligibleVoter.mutate(
      { electionId, voterId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEligibleVotersQueryKey(electionId) });
          toast({ title: "Voter removed", description: `${email} has been removed from the allowlist.` });
        },
        onError: (error: any) => {
          toast({ variant: "destructive", title: "Failed to remove voter", description: error?.data?.error || "Please try again." });
        }
      }
    );
  };

  const copyVotingLink = () => {
    const url = `${window.location.origin}/elections/${election.id}/vote`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied to clipboard" });
  };

  const copyInviteCode = () => {
    if (election.inviteCode) {
      navigator.clipboard.writeText(election.inviteCode);
      toast({ title: "Invite code copied to clipboard" });
    }
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
            
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Badge variant="outline">{election.visibility.replace('_', ' ')}</Badge></span>
              {election.eligibilityMode === 'allowlist' && (
                <span className="flex items-center gap-1.5"><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Shield className="h-3 w-3 mr-1" />Allowlist</Badge></span>
              )}
              {election.requiresAuth && <span className="flex items-center gap-1.5"><Badge variant="outline">Requires Auth</Badge></span>}
              {election.startsAt && <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {format(new Date(election.startsAt), 'MMM d, yyyy h:mm a')}</span>}
            </div>

            {/* Invite Code Banner */}
            {election.visibility === 'invite_only' && election.inviteCode && (
              <div className="mt-4 flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 max-w-md">
                <Key className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-0.5">Invite Code (share with voters)</div>
                  <div className="font-mono text-sm font-bold text-amber-900 dark:text-amber-200 truncate">{election.inviteCode}</div>
                </div>
                <Button size="sm" variant="outline" onClick={copyInviteCode} className="shrink-0 border-amber-300 bg-amber-100 hover:bg-amber-200 text-amber-800">
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                </Button>
              </div>
            )}
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
            <ShareButton
              url={`${window.location.origin}/elections/${election.id}/vote`}
              title={election.title}
              description={election.description || `Vote in ${election.title}`}
              variant="icon"
            />
            
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
        <div className="lg:col-span-3 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 border-b rounded-none bg-transparent p-0 w-full justify-start h-auto overflow-x-auto scrollbar-none">
              <TabsTrigger 
                value="positions" 
                className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none whitespace-nowrap shrink-0"
              >
                Positions & Candidates
              </TabsTrigger>
              {election.eligibilityMode === 'allowlist' && (
                <TabsTrigger 
                  value="voters" 
                  className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none whitespace-nowrap shrink-0"
                >
                  Voter Allowlist
                </TabsTrigger>
              )}
              <TabsTrigger 
                value="analytics" 
                className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none whitespace-nowrap shrink-0"
              >
                Analytics & Results
              </TabsTrigger>
              <TabsTrigger 
                value="branding" 
                className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none whitespace-nowrap shrink-0"
              >
                Branding
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
                                <div key={candidate.id} className="p-4 flex items-center gap-4 hover:bg-muted/10 transition-colors group">
                                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 overflow-hidden">
                                    {candidate.photoUrl ? (
                                      <img src={candidate.photoUrl} alt={candidate.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="font-serif font-bold text-lg">{candidate.name.charAt(0)}</span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-base">{candidate.name}</h4>
                                    {candidate.bio && <p className="text-sm text-muted-foreground line-clamp-1">{candidate.bio}</p>}
                                    {candidate.platform && <p className="text-xs text-muted-foreground/70 line-clamp-1 italic mt-0.5">{candidate.platform}</p>}
                                  </div>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remove Candidate</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to remove {candidate.name} from this position? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          onClick={() => handleDeleteCandidate(candidate.id, candidate.name)}
                                        >
                                          Remove
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="bg-muted/10 p-3 border-t">
                          <Button variant="ghost" size="sm" className="w-full" onClick={() => openCandidateDialog(position.id)}>
                            <UserPlus className="mr-2 h-4 w-4" /> Add Candidate
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {election.eligibilityMode === 'allowlist' && (
              <TabsContent value="voters" className="mt-0 space-y-6">
                <div>
                  <h2 className="text-xl font-serif font-bold mb-1">Voter Allowlist</h2>
                  <p className="text-sm text-muted-foreground">Only voters whose email is on this list will be permitted to cast a ballot.</p>
                </div>

                <Card className="border-border/50">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-serif">Add Voters</CardTitle>
                    <CardDescription>Enter email addresses separated by commas or new lines.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleAddVoters} className="space-y-3">
                      <Textarea
                        placeholder={"alice@example.com\nbob@example.com, carol@example.com"}
                        className="min-h-[100px] font-mono text-sm"
                        value={voterEmailsInput}
                        onChange={e => setVoterEmailsInput(e.target.value)}
                        disabled={addEligibleVoters.isPending}
                      />
                      <div className="flex justify-end">
                        <Button type="submit" disabled={addEligibleVoters.isPending || !voterEmailsInput.trim()}>
                          {addEligibleVoters.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <Plus className="mr-2 h-4 w-4" /> Add to Allowlist
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                {isEligibleVotersLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary/50" /></div>
                ) : !eligibleVoters || eligibleVoters.length === 0 ? (
                  <Card className="border-dashed bg-muted/20">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                      <Users className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">No voters on the allowlist</h3>
                      <p className="text-muted-foreground">Add voter emails above to grant them access to this election.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-serif">{eligibleVoters.length} Approved Voter{eligibleVoters.length !== 1 ? 's' : ''}</CardTitle>
                    </CardHeader>
                    <div className="divide-y divide-border/50">
                      {eligibleVoters.map(voter => (
                        <div key={voter.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/20 transition-colors">
                          <span className="text-sm font-mono">{voter.email}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveVoter(voter.id, voter.email)}
                            disabled={removeEligibleVoter.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </TabsContent>
            )}

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

            <TabsContent value="branding" className="mt-0">
              <ElectionBrandingSection election={election} electionId={electionId} />
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
              {election.eligibilityMode === 'allowlist' && (
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-muted-foreground text-sm">Allowlisted Voters</span>
                  <span className="font-medium">{eligibleVoters?.length ?? '—'}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Candidate Dialog */}
      <Dialog open={isCandidateDialogOpen} onOpenChange={(open) => {
        setIsCandidateDialogOpen(open);
        if (!open) { setCandidatePositionId(null); candidateForm.reset(); }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Candidate</DialogTitle>
            <DialogDescription>
              Add a candidate to this position. Provide their name and optional profile details.
            </DialogDescription>
          </DialogHeader>
          <Form {...candidateForm}>
            <form onSubmit={candidateForm.handleSubmit(handleCreateCandidate)} className="space-y-4">
              <FormField
                control={candidateForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Candidate Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Jane Smith" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={candidateForm.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Biography (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Brief background or experience..." className="resize-none" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={candidateForm.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform Statement (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Key goals and policy positions..." className="resize-none" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={candidateForm.control}
                name="photoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photo (Optional)</FormLabel>
                    <FormControl>
                      <ImageUpload
                        value={field.value}
                        onChange={field.onChange}
                        aspectRatio="square"
                        label=""
                        placeholder="Upload candidate photo"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCandidateDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createCandidate.isPending}>
                  {createCandidate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Candidate
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

const CURRENCIES = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "NGN", label: "NGN — Nigerian Naira" },
  { value: "KES", label: "KES — Kenyan Shilling" },
  { value: "ZAR", label: "ZAR — South African Rand" },
  { value: "GHS", label: "GHS — Ghanaian Cedi" },
];

function ElectionBrandingSection({ election, electionId }: { election: any; electionId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [heroImageUrl, setHeroImageUrl] = useState<string>(election.heroImageUrl ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState<string>(election.coverImageUrl ?? '');
  const [accentColor, setAccentColor] = useState<string>(election.accentColor ?? '#4F46E5');
  const [theme, setTheme] = useState<'evenum' | 'light' | 'dark'>(election.theme ?? 'evenum');

  // Monetization state
  const [requiresPayment, setRequiresPayment] = useState<boolean>(election.requiresPayment ?? false);
  const [paymentAmount, setPaymentAmount] = useState<string>(election.paymentAmount ? String(election.paymentAmount) : '');
  const [currency, setCurrency] = useState<string>(election.currency ?? 'USD');

  const updateElection = useUpdateElection();

  const handleSaveBranding = () => {
    updateElection.mutate(
      {
        electionId,
        data: {
          heroImageUrl: heroImageUrl || undefined,
          coverImageUrl: coverImageUrl || undefined,
          accentColor,
          theme,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetElectionQueryKey(electionId) });
          toast({ title: 'Branding saved', description: 'Election branding updated.' });
        },
        onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
      }
    );
  };

  const handleSaveFees = () => {
    if (requiresPayment && (!paymentAmount || parseFloat(paymentAmount) <= 0)) {
      toast({ title: 'Invalid fee amount', description: 'Please enter a fee amount greater than 0.', variant: 'destructive' });
      return;
    }
    updateElection.mutate(
      {
        electionId,
        data: {
          requiresPayment,
          paymentAmount: requiresPayment && paymentAmount ? parseFloat(paymentAmount) : undefined,
          currency,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetElectionQueryKey(electionId) });
          toast({ title: 'Fees saved', description: requiresPayment ? `Entry fee set to ${currency} ${parseFloat(paymentAmount).toFixed(2)}.` : 'Participation is now free.' });
        },
        onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
      }
    );
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-xl font-serif font-bold mb-1">Election Branding</h2>
        <p className="text-sm text-muted-foreground">These settings override the organization theme for this election's public voting page.</p>
      </div>

      {/* Participation & Fees */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-serif">Participation & Fees</CardTitle>
          </div>
          <CardDescription>Configure whether voters must pay an entry fee before accessing the ballot.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Require Participation Fee
              </Label>
              <p className="text-xs text-muted-foreground">Voters must pay before accessing the ballot</p>
            </div>
            <input
              type="checkbox"
              checked={requiresPayment}
              onChange={e => setRequiresPayment(e.target.checked)}
              className="w-4 h-4 rounded accent-primary cursor-pointer"
            />
          </div>

          {requiresPayment && (
            <>
              <div className="border-t border-border/50" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fee-amount" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Fee Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
                      {({ USD: '$', EUR: '€', GBP: '£' } as Record<string, string>)[currency] ?? currency}
                    </span>
                    <input
                      id="fee-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="10.00"
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="currency" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency" className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {paymentAmount && parseFloat(paymentAmount) > 0 && (
                <div className="flex items-center gap-2 text-sm bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 rounded-md px-3 py-2">
                  <CreditCard className="h-4 w-4 shrink-0" />
                  Voters will be charged <strong className="ml-1">{currency} {parseFloat(paymentAmount).toFixed(2)}</strong> before accessing this ballot.
                </div>
              )}
            </>
          )}
        </CardContent>
        <CardFooter className="border-t pt-4 flex justify-end">
          <Button onClick={handleSaveFees} disabled={updateElection.isPending} size="sm" className="rounded-sm">
            {updateElection.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Fees
          </Button>
        </CardFooter>
      </Card>

      {/* Media */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-serif">Media</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ImageUpload
              label="Hero Image"
              value={heroImageUrl || undefined}
              onChange={v => setHeroImageUrl(v ?? '')}
            />
            <ImageUpload
              label="Cover Image"
              value={coverImageUrl || undefined}
              onChange={v => setCoverImageUrl(v ?? '')}
            />
          </div>
          <p className="text-xs text-muted-foreground">Hero: full-width background on the public voting page. Cover: cards and social sharing.</p>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-serif">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Accent Color</Label>
            <p className="text-xs text-muted-foreground">Primary color for buttons and highlights on the voting page</p>
            <AccentColorPicker value={accentColor} onChange={setAccentColor} />
          </div>
          <div className="space-y-2">
            <Label>Theme</Label>
            <p className="text-xs text-muted-foreground">Visual theme for the public voting experience</p>
            <Select value={theme} onValueChange={v => setTheme(v as 'evenum' | 'light' | 'dark')}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="evenum">Evenum (Dark Blue)</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveBranding} disabled={updateElection.isPending} className="h-10 px-8 rounded-sm">
          {updateElection.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Branding
        </Button>
      </div>
    </div>
  );
}

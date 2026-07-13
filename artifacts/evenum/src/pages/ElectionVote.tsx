import React from 'react';
import { useRoute } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useGetElection, useListPositions, useListCandidates, useSubmitVote } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Vote as VoteIcon, AlertCircle, CheckCircle2, Key, Mail } from "lucide-react";
import { useToast } from '@/hooks/use-toast';

export default function ElectionVote() {
  const [match, params] = useRoute("/elections/:id/vote");
  const electionId = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();

  const { data: election, isLoading: isElectionLoading } = useGetElection(electionId);
  const { data: positions, isLoading: isPositionsLoading } = useListPositions(electionId);
  const { data: candidates, isLoading: isCandidatesLoading } = useListCandidates(electionId);
  const submitVote = useSubmitVote();

  const [selections, setSelections] = React.useState<Record<number, number[]>>({});
  const [inviteCode, setInviteCode] = React.useState("");
  const [voterEmail, setVoterEmail] = React.useState("");
  const [isSuccess, setIsSuccess] = React.useState(false);

  const toggleSelection = (positionId: number, candidateId: number, maxSelections: number) => {
    setSelections(prev => {
      const posSelections = prev[positionId] || [];
      
      if (posSelections.includes(candidateId)) {
        return { ...prev, [positionId]: posSelections.filter(id => id !== candidateId) };
      }
      
      if (posSelections.length >= maxSelections) {
        toast({
          title: "Selection limit reached",
          description: `You can only select up to ${maxSelections} candidate(s) for this position.`,
          variant: "destructive"
        });
        return prev;
      }
      
      return { ...prev, [positionId]: [...posSelections, candidateId] };
    });
  };

  const submitBallot = () => {
    const selectionsPayload = Object.entries(selections).map(([positionId, candidateIds]) => ({
      positionId: parseInt(positionId, 10),
      candidateIds,
    }));

    submitVote.mutate(
      {
        electionId,
        data: {
          selections: selectionsPayload,
          inviteCode: election?.visibility === 'invite_only' ? inviteCode : undefined,
          voterEmail: election?.eligibilityMode === 'allowlist' ? voterEmail : undefined,
        }
      },
      {
        onSuccess: () => {
          setIsSuccess(true);
        },
        onError: (error: any) => {
          const status = error?.status;
          const msg = error?.data?.error;
          if (status === 403) {
            toast({
              variant: "destructive",
              title: "Vote not accepted",
              description: msg || "You are not authorized to vote in this election.",
            });
          } else {
            toast({
              variant: "destructive",
              title: "Ballot submission failed",
              description: msg || "There was an error submitting your ballot. Please try again.",
            });
          }
        }
      }
    );
  };

  if (isElectionLoading || isPositionsLoading || isCandidatesLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        </div>
      </Layout>
    );
  }

  if (!election) return null;

  if (election.status === 'draft') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center max-w-2xl">
          <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
          <h1 className="text-3xl font-serif font-bold mb-4">Election Not Started</h1>
          <p className="text-lg text-muted-foreground">This election is currently in draft mode and is not yet open for voting.</p>
        </div>
      </Layout>
    );
  }

  if (election.status === 'ended') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center max-w-2xl">
          <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
          <h1 className="text-3xl font-serif font-bold mb-4">Election Ended</h1>
          <p className="text-lg text-muted-foreground mb-8">Voting for this election has concluded.</p>
        </div>
      </Layout>
    );
  }

  if (isSuccess) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center max-w-lg">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-serif font-bold mb-4">Ballot Submitted!</h1>
          <p className="text-lg text-muted-foreground">
            Thank you for participating! Your vote has been securely recorded.
          </p>
        </div>
      </Layout>
    );
  }

  const needsInviteCode = election.visibility === 'invite_only';
  const needsVoterEmail = election.eligibilityMode === 'allowlist';

  return (
    <Layout>
      <div className="bg-primary/5 py-12 border-b">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground mb-6 shadow-sm">
            <VoteIcon className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-serif font-bold tracking-tight mb-4">{election.title}</h1>
          {election.description && <p className="text-lg text-muted-foreground">{election.description}</p>}
          <div className="mt-6 inline-block bg-background px-4 py-2 rounded-full border shadow-sm text-sm font-medium">
            Official Ballot
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-3xl flex-1">
        {/* Access fields (invite code / voter email) */}
        {(needsInviteCode || needsVoterEmail) && (
          <Card className="mb-8 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-serif">Voter Verification</CardTitle>
              <CardDescription>This election requires additional information before you can vote.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {needsInviteCode && (
                <div className="space-y-2">
                  <Label htmlFor="invite-code" className="flex items-center gap-2">
                    <Key className="h-4 w-4" /> Invite Code
                  </Label>
                  <Input
                    id="invite-code"
                    placeholder="Enter your invite code"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">You received this code from the election organizer.</p>
                </div>
              )}
              {needsVoterEmail && (
                <div className="space-y-2">
                  <Label htmlFor="voter-email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Your Email Address
                  </Label>
                  <Input
                    id="voter-email"
                    type="email"
                    placeholder="your@email.com"
                    value={voterEmail}
                    onChange={e => setVoterEmail(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Must match the email on the voter allowlist.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(!positions || positions.length === 0) ? (
          <div className="text-center py-12 text-muted-foreground">
            No positions found on this ballot.
          </div>
        ) : (
          <div className="space-y-12">
            {positions.map((position, index) => {
              const posCandidates = candidates?.filter(c => c.positionId === position.id) || [];
              const currentSelections = selections[position.id] || [];
              
              return (
                <div key={position.id} className="relative">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-serif font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <h2 className="text-2xl font-serif font-bold">{position.title}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs font-normal">
                          Vote for up to {position.maxSelections}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          ({currentSelections.length} selected)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {posCandidates.length === 0 ? (
                      <p className="text-muted-foreground text-sm pl-12">No candidates available.</p>
                    ) : (
                      posCandidates.map(candidate => {
                        const isSelected = currentSelections.includes(candidate.id);
                        return (
                          <div 
                            key={candidate.id}
                            onClick={() => toggleSelection(position.id, candidate.id, position.maxSelections)}
                            className={`flex items-start gap-4 p-5 rounded-xl border transition-all cursor-pointer ${
                              isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : 'bg-card hover:border-primary/50 hover:bg-muted/20'
                            }`}
                          >
                            <Checkbox 
                              checked={isSelected} 
                              className="mt-1"
                              onCheckedChange={() => toggleSelection(position.id, candidate.id, position.maxSelections)} 
                            />
                            
                            <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 border">
                              {candidate.photoUrl ? (
                                <img src={candidate.photoUrl} alt={candidate.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-serif font-bold text-lg text-muted-foreground">{candidate.name.charAt(0)}</span>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h3 className={`font-semibold text-lg truncate ${isSelected ? 'text-primary' : ''}`}>{candidate.name}</h3>
                              {candidate.bio && <p className="text-muted-foreground mt-1 leading-snug break-words">{candidate.bio}</p>}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}

            <div className="pt-8 border-t sticky bottom-0 z-20 pb-6 bg-background">
              <Card className="bg-muted/30 border-dashed shadow-xl border-primary/20 bg-card">
                <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="font-serif font-bold text-lg mb-1">Ready to cast your ballot?</h3>
                    <p className="text-muted-foreground text-sm">Please review your selections before submitting. This action cannot be undone.</p>
                  </div>
                  <Button 
                    size="lg" 
                    className="w-full sm:w-auto shrink-0 h-14 px-8" 
                    onClick={submitBallot}
                    disabled={
                      submitVote.isPending ||
                      (needsInviteCode && !inviteCode.trim()) ||
                      (needsVoterEmail && !voterEmail.trim())
                    }
                  >
                    {submitVote.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                    Submit Ballot
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

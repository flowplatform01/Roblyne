import React, { useState } from 'react';
import { useRoute } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useGetElection, useListPositions, useListCandidates, useSubmitVote } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Vote as VoteIcon, AlertCircle, CheckCircle2, Key, Mail, ShieldCheck, FileSignature, ArrowRight } from "lucide-react";
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
  const [showConfirm, setShowConfirm] = useState(false);

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

  const getSelectionCount = () => {
    return Object.values(selections).reduce((acc, curr) => acc + curr.length, 0);
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
          setShowConfirm(false);
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
        <div className="flex-1 flex items-center justify-center min-h-screen paper-grain">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!election) return null;

  if (election.status === 'draft') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-2xl animate-in fade-in duration-700">
          <AlertCircle className="h-16 w-16 text-muted-foreground/50 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">Election Not Started</h1>
          <p className="text-xl text-muted-foreground font-light">This election is currently in draft mode and is not yet open for voting.</p>
        </div>
      </Layout>
    );
  }

  if (election.status === 'ended') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-2xl animate-in fade-in duration-700">
          <FileSignature className="h-16 w-16 text-muted-foreground/50 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">Election Ended</h1>
          <p className="text-xl text-muted-foreground font-light mb-8">Voting for this election has concluded. The polls are closed.</p>
        </div>
      </Layout>
    );
  }

  if (isSuccess) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-2xl animate-in zoom-in-95 duration-700">
          <div className="w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h1 className="text-5xl font-serif font-bold mb-6 tracking-tight text-foreground">Ballot Secured</h1>
          <p className="text-xl text-muted-foreground font-light leading-relaxed mb-12">
            Your vote has been cryptographically recorded. Thank you for participating in {election.organizationName || 'this organization'}'s democratic process.
          </p>
          <div className="inline-flex items-center gap-2 text-sm font-mono text-muted-foreground bg-muted/50 px-4 py-2 rounded-sm border border-border/50">
            <ShieldCheck className="h-4 w-4" />
            <span>Verifiable & Anonymous</span>
          </div>
        </div>
      </Layout>
    );
  }

  const needsInviteCode = election.visibility === 'invite_only';
  const needsVoterEmail = election.eligibilityMode === 'allowlist';

  if (showConfirm) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 max-w-3xl animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-serif font-bold tracking-tight mb-4">Review Your Ballot</h1>
            <p className="text-xl text-muted-foreground font-light">Please verify your selections before casting your final vote.</p>
          </div>

          <div className="bg-card border border-border shadow-xl rounded-sm overflow-hidden mb-12">
            <div className="bg-muted/30 px-8 py-4 border-b flex justify-between items-center">
              <h3 className="font-serif font-bold text-lg uppercase tracking-widest text-muted-foreground">Official Selections</h3>
              <Badge variant="outline" className="bg-background">{getSelectionCount()} Total Votes</Badge>
            </div>
            
            <div className="divide-y divide-border/50">
              {positions?.map((position) => {
                const selectedIds = selections[position.id] || [];
                const selectedCandidates = candidates?.filter(c => selectedIds.includes(c.id)) || [];
                
                return (
                  <div key={position.id} className="p-8">
                    <h4 className="font-serif font-bold text-xl mb-4">{position.title}</h4>
                    {selectedCandidates.length === 0 ? (
                      <p className="text-muted-foreground italic font-light">No selection made (Abstain)</p>
                    ) : (
                      <div className="grid gap-4">
                        {selectedCandidates.map(c => (
                          <div key={c.id} className="flex items-center gap-4 bg-primary/5 border border-primary/20 p-4 rounded-sm">
                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                            <div className="flex-1">
                              <p className="font-bold text-lg text-primary">{c.name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <Button variant="outline" size="lg" className="w-full sm:w-auto h-14 px-8 text-base" onClick={() => setShowConfirm(false)}>
              Back to Ballot
            </Button>
            <Button size="lg" className="w-full sm:w-auto h-14 px-12 text-lg shadow-lg hover:shadow-xl transition-all" onClick={submitBallot}>
              <ShieldCheck className="mr-2 h-5 w-5" /> Cast Official Vote
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-foreground text-background py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/attached_assets/generated_images/voting-abstract.jpg')] bg-cover bg-center opacity-20 mix-blend-screen" />
        <div className="container mx-auto px-4 max-w-4xl text-center relative z-10">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-sm bg-primary/20 text-primary-foreground mb-8 shadow-sm border border-primary/30 backdrop-blur-sm">
            <VoteIcon className="h-8 w-8" />
          </div>
          <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tight mb-6 leading-tight">{election.title}</h1>
          {election.description && <p className="text-xl text-muted/80 font-light max-w-2xl mx-auto">{election.description}</p>}
          <div className="mt-10 inline-flex items-center justify-center gap-2 bg-background/10 backdrop-blur-md px-6 py-2.5 rounded-full border border-border/20 text-sm font-medium tracking-widest uppercase shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Official Ballot
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16 max-w-3xl flex-1 paper-grain relative z-20 -mt-8">
        {/* Access fields (invite code / voter email) */}
        {(needsInviteCode || needsVoterEmail) && (
          <Card className="mb-12 border-border shadow-lg bg-card/95 backdrop-blur-sm rounded-sm">
            <CardHeader className="bg-muted/30 border-b pb-6 pt-8 px-8">
              <CardTitle className="text-2xl font-serif flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-primary" /> Voter Verification
              </CardTitle>
              <CardDescription className="text-base mt-2">Authentication is required to ensure election integrity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-8">
              {needsInviteCode && (
                <div className="space-y-3">
                  <Label htmlFor="invite-code" className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    <Key className="h-4 w-4" /> Secure Invite Code
                  </Label>
                  <Input
                    id="invite-code"
                    placeholder="Enter the code provided by the organizer"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value)}
                    className="font-mono h-14 text-lg bg-background border-border/60 focus:border-primary"
                  />
                </div>
              )}
              {needsVoterEmail && (
                <div className="space-y-3">
                  <Label htmlFor="voter-email" className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    <Mail className="h-4 w-4" /> Registered Email
                  </Label>
                  <Input
                    id="voter-email"
                    type="email"
                    placeholder="your@email.com"
                    value={voterEmail}
                    onChange={e => setVoterEmail(e.target.value)}
                    className="h-14 text-lg bg-background border-border/60 focus:border-primary"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(!positions || positions.length === 0) ? (
          <div className="text-center py-24 bg-card border border-border/50 shadow-sm rounded-sm">
            <FileSignature className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-serif font-bold text-muted-foreground">Ballot is empty</h3>
          </div>
        ) : (
          <div className="space-y-16">
            {positions.map((position, index) => {
              const posCandidates = candidates?.filter(c => c.positionId === position.id) || [];
              const currentSelections = selections[position.id] || [];
              
              return (
                <div key={position.id} className="relative animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ animationDelay: `${index * 150}ms` }}>
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-4 border-b border-border">
                    <div>
                      <div className="text-sm font-bold uppercase tracking-widest text-primary mb-2">Position 0{index + 1}</div>
                      <h2 className="text-3xl font-serif font-bold">{position.title}</h2>
                    </div>
                    <div className="bg-muted px-4 py-2 rounded-sm border border-border/50 text-sm font-medium">
                      Select up to {position.maxSelections} 
                      <span className="text-muted-foreground ml-2 font-normal">({currentSelections.length} chosen)</span>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {posCandidates.length === 0 ? (
                      <p className="text-muted-foreground italic font-light p-8 text-center bg-card border border-dashed rounded-sm">No candidates available for this position.</p>
                    ) : (
                      posCandidates.map(candidate => {
                        const isSelected = currentSelections.includes(candidate.id);
                        return (
                          <div 
                            key={candidate.id}
                            onClick={() => toggleSelection(position.id, candidate.id, position.maxSelections)}
                            className={`flex flex-col sm:flex-row sm:items-center gap-6 p-6 rounded-sm border-2 transition-all cursor-pointer shadow-sm hover:shadow-md ${
                              isSelected 
                                ? 'border-primary bg-primary/5 ring-4 ring-primary/10' 
                                : 'bg-card border-border/60 hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-center gap-6 w-full sm:w-auto">
                              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 bg-background'
                              }`}>
                                {isSelected && <CheckCircle2 className="w-5 h-5" />}
                              </div>
                              
                              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-sm overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border shadow-inner">
                                {candidate.photoUrl ? (
                                  <img src={candidate.photoUrl} alt={candidate.name} className="w-full h-full object-cover grayscale-[20%] contrast-125" />
                                ) : (
                                  <span className="font-serif font-bold text-3xl text-muted-foreground/50">{candidate.name.charAt(0)}</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h3 className={`font-serif font-bold text-2xl mb-2 ${isSelected ? 'text-primary' : 'text-foreground'}`}>{candidate.name}</h3>
                              {candidate.bio && <p className="text-muted-foreground leading-relaxed font-light mb-3">{candidate.bio}</p>}
                              {candidate.platform && (
                                <div className="bg-background/50 border border-border/50 p-4 rounded-sm mt-2 relative">
                                  <div className="absolute top-0 left-0 w-1 h-full bg-primary/30 rounded-l-sm" />
                                  <p className="text-sm font-medium italic text-foreground/80">"{candidate.platform}"</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}

            <div className="pt-16 pb-32">
              <Card className="bg-card border-2 border-primary/20 shadow-2xl relative overflow-hidden rounded-sm animate-in fade-in duration-1000 delay-500">
                <div className="absolute top-0 left-0 w-full h-2 bg-primary" />
                <CardContent className="p-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                  <div>
                    <h3 className="font-serif font-bold text-3xl mb-3">Review & Submit</h3>
                    <p className="text-muted-foreground text-lg font-light max-w-md">Your selections are ready. Proceed to the final review screen to cast your official ballot.</p>
                  </div>
                  <Button 
                    size="lg" 
                    className="w-full md:w-auto shrink-0 h-16 px-10 text-lg shadow-lg hover:shadow-xl transition-all" 
                    onClick={() => setShowConfirm(true)}
                    disabled={
                      (needsInviteCode && !inviteCode.trim()) ||
                      (needsVoterEmail && !voterEmail.trim())
                    }
                  >
                    Review Selections <ArrowRight className="ml-2 h-5 w-5" />
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

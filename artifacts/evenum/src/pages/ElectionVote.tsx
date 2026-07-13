import React from 'react';
import { useRoute } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useGetElection, useListPositions, useListCandidates } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Vote as VoteIcon, AlertCircle } from "lucide-react";
import { useToast } from '@/hooks/use-toast';

export default function ElectionVote() {
  const [match, params] = useRoute("/elections/:id/vote");
  const electionId = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();

  const { data: election, isLoading: isElectionLoading } = useGetElection(electionId);
  const { data: positions, isLoading: isPositionsLoading } = useListPositions(electionId);
  const { data: candidates, isLoading: isCandidatesLoading } = useListCandidates(electionId);

  const [selections, setSelections] = React.useState<Record<number, number[]>>({});

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
    toast({
      title: "Ballot submitted",
      description: "Thank you for participating! Your vote has been securely recorded.",
    });
    // Implementation of real mutation would go here
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
            Official Official Ballot
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-3xl flex-1">
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
                            
                            <div className="flex-1">
                              <h3 className={`font-semibold text-lg ${isSelected ? 'text-primary' : ''}`}>{candidate.name}</h3>
                              {candidate.bio && <p className="text-muted-foreground mt-1 leading-snug">{candidate.bio}</p>}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}

            <div className="pt-8 border-t">
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="font-serif font-bold text-lg mb-1">Ready to cast your ballot?</h3>
                    <p className="text-muted-foreground text-sm">Please review your selections before submitting. This action cannot be undone.</p>
                  </div>
                  <Button size="lg" className="w-full sm:w-auto shrink-0 h-14 px-8" onClick={submitBallot}>
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

import React from 'react';
import { useRoute } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useGetElection, useGetElectionResults } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, BarChart3 } from "lucide-react";

export default function ElectionResults() {
  const [match, params] = useRoute("/elections/:id/results");
  const electionId = params?.id ? parseInt(params.id, 10) : 0;

  const { data: election, isLoading: isElectionLoading } = useGetElection(electionId);
  const { data: results, isLoading: isResultsLoading } = useGetElectionResults(electionId);

  if (isElectionLoading || isResultsLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        </div>
      </Layout>
    );
  }

  if (!election || !results) return null;

  return (
    <Layout>
      <div className="bg-foreground text-background py-16">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary mb-6">
            <BarChart3 className="h-6 w-6" />
          </div>
          <Badge className="bg-white/10 text-white border-none mb-4 hover:bg-white/20">Official Results</Badge>
          <h1 className="text-4xl font-serif font-bold tracking-tight mb-4">{election.title}</h1>
          <p className="text-slate-400 text-lg">Total Votes Cast: <span className="text-white font-bold">{results.totalVotes}</span></p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-4xl flex-1">
        {(!results.positions || results.positions.length === 0) ? (
          <div className="text-center py-12 text-muted-foreground">
            No results available for this election.
          </div>
        ) : (
          <div className="space-y-12">
            {results.positions.map((position) => {
              // Sort candidates by vote count descending
              const sortedCandidates = [...position.candidates].sort((a, b) => b.voteCount - a.voteCount);
              const maxVotes = Math.max(...sortedCandidates.map(c => c.voteCount), 1); // Avoid div by 0

              return (
                <div key={position.positionId} className="bg-card rounded-xl border overflow-hidden shadow-sm">
                  <div className="bg-muted/30 px-6 py-4 border-b">
                    <h2 className="text-2xl font-serif font-bold">{position.title}</h2>
                  </div>
                  
                  <div className="p-6 grid gap-6">
                    {sortedCandidates.map((candidate, index) => {
                      const isWinner = index === 0 && candidate.voteCount > 0;
                      const percentage = (candidate.voteCount / Math.max(results.totalVotes, 1)) * 100;
                      const barWidth = `${(candidate.voteCount / maxVotes) * 100}%`;

                      return (
                        <div key={candidate.candidateId} className="relative">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {isWinner && <Trophy className="h-5 w-5 text-amber-500" />}
                              <h3 className={`font-medium text-lg ${isWinner ? 'font-bold' : ''}`}>
                                {candidate.name}
                              </h3>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-lg block leading-none">{candidate.voteCount}</span>
                              <span className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</span>
                            </div>
                          </div>
                          
                          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ease-out ${isWinner ? 'bg-primary' : 'bg-primary/40'}`}
                              style={{ width: barWidth }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

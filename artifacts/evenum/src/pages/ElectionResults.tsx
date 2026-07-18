import React, { useState } from 'react';
import { useRoute } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useGetElection, useGetElectionResults, exportElectionResults } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, BarChart3, Download, FileSignature, CheckCircle2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';

export default function ElectionResults() {
  const [match, params] = useRoute("/elections/:id/results");
  const electionId = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const { data: election, isLoading: isElectionLoading } = useGetElection(electionId);
  const { data: results, isLoading: isResultsLoading } = useGetElectionResults(electionId);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const csvText = await exportElectionResults(electionId);
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `election-${electionId}-results.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "CSV exported successfully" });
    } catch {
      toast({ title: "Failed to export CSV", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  if (isElectionLoading || isResultsLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center min-h-screen paper-grain">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!election || !results) return null;

  return (
    <Layout>
      <div className="bg-foreground text-background py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/attached_assets/generated_images/voting-abstract.jpg')] bg-cover bg-center opacity-10 mix-blend-screen grayscale" />
        <div className="container mx-auto px-4 max-w-4xl text-center relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-sm bg-primary border border-primary-foreground/20 text-primary-foreground mb-8 shadow-lg">
            <BarChart3 className="h-8 w-8" />
          </div>
          <div className="mb-6 flex justify-center">
            <Badge className="bg-background/10 text-background hover:bg-background/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-sm border border-background/20 backdrop-blur-md">
              <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Official Results
            </Badge>
          </div>
          <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tight mb-8 leading-tight text-card">{election.title}</h1>
          <div className="flex items-center justify-center gap-4 bg-background/5 p-4 rounded-sm border border-background/10 max-w-md mx-auto mb-10">
            <div className="text-center px-6 border-r border-background/20">
              <p className="text-xs uppercase tracking-widest text-muted/60 mb-1 font-semibold">Total Votes</p>
              <p className="text-3xl font-bold text-card">{results.totalVotes}</p>
            </div>
            <div className="text-center px-6">
              <p className="text-xs uppercase tracking-widest text-muted/60 mb-1 font-semibold">Status</p>
              <p className="text-lg font-medium text-emerald-400 capitalize">{election.status}</p>
            </div>
          </div>
          <div className="flex justify-center">
            <Button
              size="lg"
              variant="outline"
              onClick={handleExportCSV}
              disabled={isExporting}
              className="h-14 px-8 bg-transparent border-card/30 text-card hover:bg-card/10 hover:border-card/50 hover:text-card transition-all"
            >
              {isExporting ? (
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              ) : (
                <Download className="mr-3 h-5 w-5" />
              )}
              Export Certified CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-20 max-w-4xl flex-1 paper-grain relative z-20 -mt-8">
        {(!results.positions || results.positions.length === 0) ? (
          <div className="text-center py-24 bg-card border border-border/50 shadow-sm rounded-sm">
            <FileSignature className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-serif font-bold text-muted-foreground">No data available</h3>
          </div>
        ) : (
          <div className="space-y-16">
            {results.positions.map((position, index) => {
              // Sort candidates by vote count descending
              const sortedCandidates = [...position.candidates].sort((a, b) => b.voteCount - a.voteCount);
              const maxVotes = Math.max(...sortedCandidates.map(c => c.voteCount), 1); // Avoid div by 0

              return (
                <div key={position.positionId} className="bg-card rounded-sm border border-border shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ animationDelay: `${index * 150}ms` }}>
                  <div className="bg-muted/30 px-10 py-8 border-b border-border flex justify-between items-end">
                    <div>
                      <div className="text-sm font-bold uppercase tracking-widest text-primary mb-2">Position 0{index + 1}</div>
                      <h2 className="text-3xl font-serif font-bold">{position.title}</h2>
                    </div>
                    <div className="hidden sm:block">
                      <Badge variant="outline" className="bg-background">Max Select: {position.candidates.length}</Badge>
                    </div>
                  </div>
                  
                  <div className="p-10 grid gap-8">
                    {sortedCandidates.map((candidate, candidateIndex) => {
                      const isWinner = candidateIndex === 0 && candidate.voteCount > 0 && election.status === 'ended';
                      const percentage = (candidate.voteCount / Math.max(results.totalVotes, 1)) * 100;
                      const barWidth = `${(candidate.voteCount / maxVotes) * 100}%`;

                      return (
                        <div key={candidate.candidateId} className="relative group">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-sm overflow-hidden border ${isWinner ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-border'} flex items-center justify-center bg-muted shrink-0`}>
                                {candidate.photoUrl ? (
                                  <img src={candidate.photoUrl} alt={candidate.name} className={`w-full h-full object-cover ${!isWinner && 'grayscale opacity-80'}`} />
                                ) : (
                                  <span className="font-serif font-bold text-muted-foreground">{candidate.name.charAt(0)}</span>
                                )}
                              </div>
                              <div>
                                <h3 className={`font-serif text-2xl flex items-center gap-2 ${isWinner ? 'font-bold text-foreground' : 'text-foreground/80'}`}>
                                  {candidate.name}
                                  {isWinner && <Trophy className="h-5 w-5 text-amber-500 fill-amber-500/20 animate-in zoom-in duration-500" />}
                                </h3>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`font-bold text-3xl block leading-none font-serif ${isWinner ? 'text-primary' : 'text-foreground'}`}>
                                {candidate.voteCount}
                              </span>
                              <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{percentage.toFixed(1)}%</span>
                            </div>
                          </div>
                          
                          <div className="h-4 w-full bg-muted/50 rounded-r-full overflow-hidden border border-border/50">
                            <div 
                              className={`h-full transition-all duration-1000 ease-out relative overflow-hidden ${isWinner ? 'bg-primary' : 'bg-primary/30'}`}
                              style={{ width: barWidth }}
                            >
                              <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite] -translate-x-full" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />
                            </div>
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

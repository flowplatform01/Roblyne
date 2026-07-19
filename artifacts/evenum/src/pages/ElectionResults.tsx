import React, { useState, useEffect } from 'react';
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useGetElection, useGetElectionResults, useGetElectionAnalytics, exportElectionResults } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, BarChart3, Download, FileSignature, CheckCircle2, Users, ArrowRight } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function ElectionResults() {
  const [, params] = useRoute("/elections/:id/results");
  const electionId = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [barsVisible, setBarsVisible] = useState(false);

  const { data: election, isLoading: isElectionLoading } = useGetElection(electionId);
  const { data: results, isLoading: isResultsLoading } = useGetElectionResults(electionId);
  const { data: analytics } = useGetElectionAnalytics(electionId);

  // Animate bars after mount
  useEffect(() => {
    const t = setTimeout(() => setBarsVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const csvText = await exportElectionResults(electionId);
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `election-${electionId}-results.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'CSV exported successfully' });
    } catch {
      toast({ title: 'Failed to export CSV', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  if (isElectionLoading || isResultsLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        </div>
      </Layout>
    );
  }

  if (!election || !results) return null;

  const participationRate = analytics?.turnoutRate != null
    ? Math.round(analytics.turnoutRate * 100)
    : null;

  return (
    <Layout>
      {/* Hero */}
      <div className="bg-foreground text-background relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-foreground via-foreground to-primary/40" />
        <div className="relative z-10 container mx-auto px-4 pt-20 pb-16 max-w-4xl text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center gap-2 bg-background/10 backdrop-blur-md border border-background/20 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-8">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Official Results
          </div>
          <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tight leading-tight text-background mb-4">
            {election.title}
          </h1>
          {election.organizationName && (
            <p className="text-background/60 font-medium mb-10">{election.organizationName}</p>
          )}
          {election.endsAt && (
            <p className="text-background/40 text-sm mb-10">
              Concluded {format(new Date(election.endsAt), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          )}

          {/* Key metrics */}
          <div className="flex flex-wrap items-center justify-center gap-px bg-background/10 rounded-sm border border-background/10 overflow-hidden max-w-lg mx-auto mb-10">
            <div className="flex-1 text-center px-6 py-5 bg-background/5 hover:bg-background/10 transition-colors">
              <p className="text-3xl font-serif font-bold text-background tabular-nums">{results.totalVotes}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-background/40 mt-1">Total Votes</p>
            </div>
            {participationRate !== null && (
              <div className="flex-1 text-center px-6 py-5 bg-background/5 hover:bg-background/10 transition-colors">
                <p className="text-3xl font-serif font-bold text-emerald-400 tabular-nums">{participationRate}%</p>
                <p className="text-xs font-bold uppercase tracking-widest text-background/40 mt-1">Turnout</p>
              </div>
            )}
            {analytics?.totalVotes != null && participationRate !== null && (
              <div className="flex-1 text-center px-6 py-5 bg-background/5 hover:bg-background/10 transition-colors">
                <p className="text-3xl font-serif font-bold text-background tabular-nums">{analytics.totalVotes}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-background/40 mt-1">Recorded</p>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={isExporting}
            className="h-12 px-8 bg-transparent border-background/30 text-background hover:bg-background/10 hover:border-background/50 hover:text-background transition-all"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export Certified CSV
          </Button>
        </div>
      </div>

      {/* Results by position */}
      <div className="container mx-auto px-4 py-20 max-w-4xl">
        {(!results.positions || results.positions.length === 0) ? (
          <div className="text-center py-24 bg-card border border-border/50 rounded-sm">
            <FileSignature className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-serif font-bold text-muted-foreground">No results to display</h3>
          </div>
        ) : (
          <div className="space-y-16">
            {results.positions.map((position, posIndex) => {
              const sorted = [...position.candidates].sort((a, b) => b.voteCount - a.voteCount);
              const maxVotes = Math.max(...sorted.map(c => c.voteCount), 1);
              const hasWinner = sorted.length > 0 && sorted[0].voteCount > 0 && election.status === 'ended';

              return (
                <div
                  key={position.positionId}
                  className="animate-in fade-in slide-in-from-bottom-8 duration-700"
                  style={{ animationDelay: `${posIndex * 120}ms` }}
                >
                  {/* Position header */}
                  <div className="flex items-end justify-between gap-4 mb-8 pb-4 border-b border-border">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
                        Position {posIndex + 1}
                      </div>
                      <h2 className="text-3xl font-serif font-bold">{position.title}</h2>
                    </div>
                    <Badge variant="outline" className="shrink-0 mb-1">
                      {sorted.length} candidates
                    </Badge>
                  </div>

                  {/* Winner spotlight */}
                  {hasWinner && sorted[0] && (
                    <div className="mb-8 bg-gradient-to-r from-amber-50 to-amber-50/30 border border-amber-200/60 rounded-sm overflow-hidden p-6 flex items-center gap-6">
                      <div className="w-16 h-16 rounded-sm overflow-hidden border-2 border-amber-300 shrink-0 shadow-md">
                        {sorted[0].photoUrl ? (
                          <img src={sorted[0].photoUrl} alt={sorted[0].name} className="w-full h-full object-cover object-top" />
                        ) : (
                          <div className="w-full h-full bg-amber-100 flex items-center justify-center">
                            <span className="font-serif font-bold text-2xl text-amber-600">{sorted[0].name.charAt(0)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Trophy className="h-4 w-4 text-amber-500 fill-amber-500/30" />
                          <span className="text-xs font-bold uppercase tracking-widest text-amber-700">Winner</span>
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-foreground truncate">{sorted[0].name}</h3>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-4xl font-serif font-bold text-amber-700 tabular-nums">{sorted[0].voteCount}</div>
                        <div className="text-sm font-bold text-amber-600/60 uppercase tracking-widest">votes</div>
                      </div>
                    </div>
                  )}

                  {/* All candidates bar chart */}
                  <div className="space-y-6">
                    {sorted.map((candidate, ci) => {
                      const isWinner = hasWinner && ci === 0;
                      const pct = results.totalVotes > 0
                        ? ((candidate.voteCount / results.totalVotes) * 100).toFixed(1)
                        : '0.0';
                      const barPct = (candidate.voteCount / maxVotes) * 100;

                      return (
                        <div key={candidate.candidateId} className="group">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-9 h-9 rounded-sm overflow-hidden border shrink-0 ${isWinner ? 'border-amber-300' : 'border-border/60'}`}>
                                {candidate.photoUrl ? (
                                  <img
                                    src={candidate.photoUrl}
                                    alt={candidate.name}
                                    className={`w-full h-full object-cover object-top ${!isWinner && 'grayscale opacity-70'}`}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-muted flex items-center justify-center">
                                    <span className="font-serif font-bold text-sm text-muted-foreground">{candidate.name.charAt(0)}</span>
                                  </div>
                                )}
                              </div>
                              <span className={`font-serif font-bold text-lg truncate ${isWinner ? 'text-foreground' : 'text-foreground/70'}`}>
                                {candidate.name}
                              </span>
                              {isWinner && <Trophy className="h-4 w-4 text-amber-500 fill-amber-500/20 shrink-0" />}
                            </div>
                            <div className="text-right shrink-0 pl-4">
                              <span className={`font-serif font-bold text-2xl tabular-nums ${isWinner ? 'text-primary' : 'text-foreground/70'}`}>
                                {candidate.voteCount}
                              </span>
                              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-2">{pct}%</span>
                            </div>
                          </div>

                          {/* Animated bar */}
                          <div className="h-3 w-full bg-muted/60 rounded-full overflow-hidden border border-border/40">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ease-out ${isWinner ? 'bg-primary' : 'bg-primary/25'}`}
                              style={{ width: barsVisible ? `${barPct}%` : '0%' }}
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

        {/* Footer CTA */}
        {election.status === 'active' && (
          <div className="mt-16 text-center">
            <Button asChild size="lg" className="h-14 px-10">
              <Link href={`/elections/${electionId}/vote`}>
                <Users className="mr-2 h-5 w-5" /> Cast Your Vote
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}

import React, { useState, useEffect } from 'react';
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useGetElection, useGetElectionResults, useGetElectionAnalytics, exportElectionResults } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, Download, FileSignature, CheckCircle2, Users, ArrowRight, Activity, TrendingUp, Medal } from "lucide-react";
import { ShareButton } from "@/components/branding/ShareButton";
import { useToast } from '@/hooks/use-toast';
import { hexToHsl } from "@/lib/branding";
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

  useEffect(() => {
    const t = setTimeout(() => setBarsVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  const shareUrl = `${window.location.origin}/elections/${electionId}/results`;

  useEffect(() => {
    if (election) {
      document.title = `${election.title} — Results | Evenum`;
      const setMeta = (name: string, content: string, prop = false) => {
        const attr = prop ? 'property' : 'name';
        let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
        if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
        el.content = content;
      };
      setMeta('og:title', `${election.title} — Official Results`, true);
      setMeta('og:description', `View the official results for ${election.title}`, true);
      setMeta('og:url', shareUrl, true);
      setMeta('og:type', 'website', true);
    }
  }, [election, shareUrl]);

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
        <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">Loading Results</p>
        </div>
      </Layout>
    );
  }

  if (!election || !results) return null;

  const turnoutPct = analytics?.turnoutRate != null ? Math.round(analytics.turnoutRate * 100) : null;
  const isEnded = election.status === 'ended';

  // Branding
  const heroImageUrl = (election as any).heroImageUrl || election.coverImageUrl;
  const primaryStyle: React.CSSProperties = (election as any).accentColor
    ? { "--primary": hexToHsl((election as any).accentColor) } as React.CSSProperties
    : {};

  // Build votesByHour chart data
  const votesByHour = analytics?.votesByHour ?? [];
  const maxHourCount = Math.max(...votesByHour.map(h => h.count), 1);

  return (
    <Layout>
      {/* Hero */}
      <div className="bg-foreground text-background relative overflow-hidden" style={primaryStyle}>
        {heroImageUrl ? (
          <>
            <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${heroImageUrl})` }} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/70 to-black/90" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-foreground via-foreground to-primary/30" />
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, currentColor 39px, currentColor 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, currentColor 39px, currentColor 40px)',
            }} />
          </>
        )}
        <div className="relative z-10 container mx-auto px-4 pt-20 pb-16 max-w-4xl text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center gap-2 bg-background/10 backdrop-blur-md border border-background/20 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-8">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {isEnded ? 'Official Results' : 'Live Results'}
          </div>
          <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tight leading-tight text-background mb-4">
            {election.title}
          </h1>
          {election.organizationName && (
            <p className="text-background/50 font-medium mb-6 text-lg">{election.organizationName}</p>
          )}
          {election.endsAt && isEnded && (
            <p className="text-background/30 text-sm mb-10">
              Concluded {format(new Date(election.endsAt), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          )}

          {/* Key metrics */}
          <div className="flex flex-wrap items-stretch justify-center gap-px bg-background/10 rounded-sm border border-background/10 overflow-hidden max-w-lg mx-auto mb-10">
            <div className="flex-1 text-center px-6 py-5 bg-background/5 hover:bg-background/10 transition-colors min-w-[100px]">
              <p className="text-3xl font-serif font-bold text-background tabular-nums">{results.totalVotes}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-background/40 mt-1">Total Votes</p>
            </div>
            {turnoutPct !== null && (
              <div className="flex-1 text-center px-6 py-5 bg-background/5 hover:bg-background/10 transition-colors min-w-[100px]">
                <p className="text-3xl font-serif font-bold text-emerald-400 tabular-nums">{turnoutPct}%</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-background/40 mt-1">Turnout</p>
              </div>
            )}
            {results.positions && (
              <div className="flex-1 text-center px-6 py-5 bg-background/5 hover:bg-background/10 transition-colors min-w-[100px]">
                <p className="text-3xl font-serif font-bold text-background tabular-nums">{results.positions.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-background/40 mt-1">Positions</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={isExporting}
              className="h-12 px-8 bg-transparent border-background/30 text-background hover:bg-background/10 hover:border-background/50 hover:text-background transition-all rounded-sm"
            >
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export Certified CSV
            </Button>
            <ShareButton
              url={`${window.location.origin}/elections/${electionId}/results`}
              title={election.title + ' — Results'}
              description={`Official results for ${election.title}`}
              className="h-12 px-6 bg-transparent border-background/30 text-background hover:bg-background/10 hover:border-background/50 hover:text-background rounded-sm"
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-20 max-w-4xl space-y-20">

        {/* Voting Activity Chart */}
        {votesByHour.length > 1 && (
          <section className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-2xl font-serif font-bold">Voting Activity</h2>
              <Badge variant="outline" className="ml-auto text-xs">By Hour</Badge>
            </div>
            <div className="bg-card border border-border/50 rounded-sm p-6 shadow-sm">
              <div className="flex items-end gap-1 h-32">
                {votesByHour.map((h, i) => {
                  const heightPct = (h.count / maxHourCount) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 group" title={`${h.hour}: ${h.count} votes`}>
                      <div
                        className="w-full bg-primary/20 rounded-sm group-hover:bg-primary/40 transition-all duration-700 ease-out relative overflow-hidden"
                        style={{ height: barsVisible ? `${Math.max(heightPct, 2)}%` : '2%' }}
                      >
                        <div
                          className="absolute bottom-0 left-0 right-0 bg-primary rounded-sm transition-all duration-700 ease-out"
                          style={{ height: barsVisible ? '100%' : '0%' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground">
                  {votesByHour[0]?.hour && format(new Date(votesByHour[0].hour), 'MMM d, h a')}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Peak: {Math.max(...votesByHour.map(h => h.count))} votes/hr
                </div>
                <p className="text-xs text-muted-foreground">
                  {votesByHour[votesByHour.length - 1]?.hour && format(new Date(votesByHour[votesByHour.length - 1].hour), 'MMM d, h a')}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Results by position */}
        {(!results.positions || results.positions.length === 0) ? (
          <div className="text-center py-24 bg-card border border-border/50 rounded-sm">
            <FileSignature className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-serif font-bold text-muted-foreground">No results to display</h3>
          </div>
        ) : (
          <div className="space-y-20">
            {results.positions.map((position, posIndex) => {
              const sorted = [...position.candidates].sort((a, b) => b.voteCount - a.voteCount);
              const maxVotes = Math.max(...sorted.map(c => c.voteCount), 1);
              const hasWinner = isEnded && sorted.length > 0 && sorted[0].voteCount > 0;
              const winner = hasWinner ? sorted[0] : null;

              return (
                <section
                  key={position.positionId}
                  className="animate-in fade-in slide-in-from-bottom-8 duration-700"
                  style={{ animationDelay: `${posIndex * 150}ms` }}
                >
                  {/* Position header */}
                  <div className="flex items-end justify-between gap-4 mb-8 pb-5 border-b border-border">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
                        Position {posIndex + 1}
                      </div>
                      <h2 className="text-3xl font-serif font-bold">{position.title}</h2>
                    </div>
                    <Badge variant="outline" className="shrink-0 mb-1.5">
                      {sorted.length} {sorted.length === 1 ? 'candidate' : 'candidates'}
                    </Badge>
                  </div>

                  {/* Winner announcement */}
                  {winner && (
                    <div className="mb-10 bg-gradient-to-r from-amber-50 via-amber-50/60 to-transparent border border-amber-200/60 rounded-sm overflow-hidden">
                      <div className="flex items-stretch">
                        {/* Winner photo */}
                        <div className="w-24 sm:w-32 shrink-0 relative">
                          {winner.photoUrl ? (
                            <img src={winner.photoUrl} alt={winner.name} className="w-full h-full object-cover object-top" />
                          ) : (
                            <div className="w-full h-full bg-amber-100 flex items-center justify-center">
                              <span className="font-serif font-bold text-3xl text-amber-500">{winner.name.charAt(0)}</span>
                            </div>
                          )}
                        </div>
                        {/* Winner info */}
                        <div className="flex-1 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <Trophy className="h-4 w-4 text-amber-500 fill-amber-500/30" />
                              <span className="text-xs font-bold uppercase tracking-widest text-amber-700">
                                {position.title} — Winner
                              </span>
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">{winner.name}</h3>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-4xl font-serif font-bold text-amber-700 tabular-nums">{winner.voteCount}</p>
                            <p className="text-xs font-bold text-amber-600/60 uppercase tracking-widest mt-0.5">
                              votes · {results.totalVotes > 0 ? ((winner.voteCount / results.totalVotes) * 100).toFixed(1) : 0}%
                            </p>
                          </div>
                        </div>
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
                      const medal = ci === 0 ? '🥇' : ci === 1 ? '🥈' : ci === 2 ? '🥉' : null;

                      return (
                        <div key={candidate.candidateId} className="group">
                          <div className="flex items-center justify-between mb-2.5 gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Photo or initial */}
                              <div className={`w-10 h-10 rounded-sm overflow-hidden border shrink-0 ${isWinner ? 'border-amber-300 shadow-sm' : 'border-border/50'}`}>
                                {candidate.photoUrl ? (
                                  <img
                                    src={candidate.photoUrl}
                                    alt={candidate.name}
                                    className={`w-full h-full object-cover object-top transition-all ${!isWinner ? 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100' : ''}`}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-muted flex items-center justify-center">
                                    <span className="font-serif font-bold text-sm text-muted-foreground">{candidate.name.charAt(0)}</span>
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  {medal && <span className="text-base leading-none">{medal}</span>}
                                  <span className={`font-serif font-bold text-lg truncate ${isWinner ? 'text-foreground' : 'text-foreground/70'}`}>
                                    {candidate.name}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">Rank #{ci + 1}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 pl-4">
                              <span className={`font-serif font-bold text-2xl tabular-nums ${isWinner ? 'text-primary' : 'text-foreground/60'}`}>
                                {candidate.voteCount}
                              </span>
                              <span className="text-xs font-bold text-muted-foreground ml-2 tabular-nums">{pct}%</span>
                            </div>
                          </div>

                          {/* Bar */}
                          <div className="h-3 w-full bg-muted/50 rounded-full overflow-hidden border border-border/30">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ease-out ${isWinner ? 'bg-primary' : 'bg-primary/20'}`}
                              style={{ width: barsVisible ? `${barPct}%` : '0%', transitionDelay: `${ci * 100}ms` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* CTA if still active */}
        {election.status === 'active' && (
          <div className="pt-4 text-center">
            <p className="text-muted-foreground font-light mb-6">Polls are still open — every vote matters.</p>
            <Button asChild size="lg" className="h-14 px-10 rounded-sm shadow-lg">
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

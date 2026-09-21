import React, { useState, useEffect } from 'react';
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useGetElection, useGetElectionResults, useGetElectionAnalytics } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, FileSignature, CheckCircle2, Users, ArrowRight, Activity, TrendingUp, Building2, ExternalLink } from "lucide-react";
import { ShareButton } from "@/components/branding/ShareButton";
import { hexToHsl } from "@/lib/branding";
import { format } from 'date-fns';

export default function ElectionResults() {
  const [, params] = useRoute("/elections/:id/results");
  const electionId = params?.id ? parseInt(params.id, 10) : 0;
  const [barsVisible, setBarsVisible] = useState(false);

  const { data: election, isLoading: isElectionLoading } = useGetElection(electionId);
  const { data: results, isLoading: isResultsLoading } = useGetElectionResults(electionId);
  const { data: analytics } = useGetElectionAnalytics(electionId);

  useEffect(() => {
    const t = setTimeout(() => setBarsVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  const shareUrl = `${window.location.origin}/elections/${electionId}/results`;

  usePageMeta(election ? {
    title: `${election.title} — Official Results`,
    description: `View the official results for ${election.title}. Powered by Evenum.`,
    image: (election as any).heroImageUrl || (election as any).coverImageUrl || null,
    url: shareUrl,
  } : null);


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
      <div className="bg-[#0A1628] text-white relative overflow-hidden" style={primaryStyle}>
        {heroImageUrl ? (
          <>
            <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${heroImageUrl})` }} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/70 to-black/90" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-[#0A1628] via-[#0A1628] to-primary/30" />
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
          <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tight leading-tight text-white mb-4">
            {election.title}
          </h1>
          {election.organizationName && (
            (() => {
              const orgId = (election as any).orgId;
              return orgId ? (
                <Link
                  href={`/organizations/${orgId}/public`}
                  className="inline-flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors font-medium mb-6 text-lg group"
                >
                  {(election as any).organizationLogoUrl ? (
                    <img src={(election as any).organizationLogoUrl} alt={election.organizationName} className="w-6 h-6 rounded object-cover border border-background/20" />
                  ) : (
                    <Building2 className="h-4 w-4" />
                  )}
                  {election.organizationName}
                  <ExternalLink className="h-3 w-3 opacity-40 group-hover:opacity-80 transition-opacity" />
                </Link>
              ) : (
                <p className="text-white/50 font-medium mb-6 text-lg">{election.organizationName}</p>
              );
            })()
          )}
          {election.endsAt && isEnded && (
            <p className="text-white/30 text-sm mb-10">
              Concluded {format(new Date(election.endsAt), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          )}

          {/* Key metrics */}
          <div className="flex flex-wrap items-stretch justify-center gap-px bg-white/10 rounded-sm border border-white/10 overflow-hidden max-w-lg mx-auto mb-10">
            <div className="flex-1 text-center px-6 py-5 bg-white/5 hover:bg-white/10 transition-colors min-w-[100px]">
              <p className="text-3xl font-serif font-bold text-white tabular-nums">{results.totalVotes}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">Total Votes</p>
            </div>
            {turnoutPct !== null && (
              <div className="flex-1 text-center px-6 py-5 bg-white/5 hover:bg-white/10 transition-colors min-w-[100px]">
                <p className="text-3xl font-serif font-bold text-emerald-400 tabular-nums">{turnoutPct}%</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">Turnout</p>
              </div>
            )}
            {results.positions && (
              <div className="flex-1 text-center px-6 py-5 bg-white/5 hover:bg-white/10 transition-colors min-w-[100px]">
                <p className="text-3xl font-serif font-bold text-white tabular-nums">{results.positions.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">Positions</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            <ShareButton
              url={`${window.location.origin}/elections/${electionId}/results`}
              title={election.title + ' — Results'}
              description={`Official results for ${election.title}`}
              className="h-12 px-6 bg-transparent border-white/30 text-white hover:bg-white/10 hover:border-white/50 hover:text-white rounded-sm"
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-20 max-w-4xl space-y-20">

        {/* Winners at a Glance — compact summary across all positions */}
        {isEnded && results.positions && results.positions.length > 0 && (() => {
          const winners = results.positions
            .map(p => {
              const sorted = [...p.candidates].sort((a, b) => b.voteCount - a.voteCount);
              const w = sorted[0];
              return w && w.voteCount > 0 ? { position: p.title, winner: w, totalVotes: results.totalVotes } : null;
            })
            .filter(Boolean) as { position: string; winner: { candidateId: number; name: string; photoUrl?: string | null; voteCount: number }; totalVotes: number }[];

          if (winners.length === 0) return null;
          return (
            <section className="animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="flex items-center gap-3 mb-6">
                <Trophy className="h-5 w-5 text-amber-500 fill-amber-500/30 shrink-0" />
                <h2 className="text-2xl font-serif font-bold">Winners</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {winners.map(({ position, winner, totalVotes }) => {
                  const pct = totalVotes > 0 ? ((winner.voteCount / totalVotes) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={winner.candidateId} className="flex items-center gap-4 bg-gradient-to-r from-amber-50 to-amber-50/30 border border-amber-200/60 rounded-sm px-5 py-4">
                      <div className="w-12 h-12 rounded-sm overflow-hidden border border-amber-200/60 shrink-0 bg-amber-100">
                        {winner.photoUrl ? (
                          <img src={winner.photoUrl} alt={winner.name} className="w-full h-full object-cover object-top" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="font-serif font-bold text-xl text-amber-500">{winner.name.charAt(0)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600/70 mb-0.5 truncate">{position}</p>
                        <p className="font-serif font-bold text-lg leading-tight truncate">{winner.name}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-serif font-bold text-xl text-amber-700 tabular-nums">{winner.voteCount}</p>
                        <p className="text-[10px] font-bold text-amber-600/60 tabular-nums">{pct}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* Voting Activity Chart */}
        {votesByHour.length >= 1 && (() => {
          // Aggregate to daily buckets when span > 2 days (> 48 hourly points)
          // so bars remain wide enough to be visible
          const useDaily = votesByHour.length > 48;
          type Bucket = { label: string; count: number };
          let buckets: Bucket[];
          if (useDaily) {
            const dailyMap: Record<string, number> = {};
            for (const h of votesByHour) {
              const day = h.hour.slice(0, 10);
              dailyMap[day] = (dailyMap[day] || 0) + h.count;
            }
            buckets = Object.entries(dailyMap)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([day, count]) => ({ label: day, count }));
          } else {
            buckets = votesByHour.map(h => ({ label: h.hour, count: h.count }));
          }
          const maxCount = Math.max(...buckets.map(b => b.count), 1);
          const peakCount = Math.max(...votesByHour.map(h => h.count));
          const firstHour = votesByHour[0]?.hour;
          const lastHour = votesByHour[votesByHour.length - 1]?.hour;

          return (
            <section className="animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="flex items-center gap-3 mb-6">
                <Activity className="h-5 w-5 text-primary shrink-0" />
                <h2 className="text-2xl font-serif font-bold">Voting Activity</h2>
                <Badge variant="outline" className="ml-auto text-xs">{useDaily ? 'By Day' : 'By Hour'}</Badge>
              </div>
              <div className="bg-card border border-border/50 rounded-sm p-6 shadow-sm">
                <div className="relative h-32 flex items-end gap-[2px]">
                  {buckets.map((b, i) => {
                    const pct = Math.max((b.count / maxCount) * 100, b.count > 0 ? 8 : 2);
                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col justify-end group cursor-default"
                        style={{ height: '100%' }}
                        title={`${b.count} vote${b.count !== 1 ? 's' : ''}`}
                      >
                        <div
                          className={`w-full rounded-sm transition-all duration-700 ease-out ${b.count > 0 ? 'bg-primary/40 group-hover:bg-primary/70' : 'bg-muted/30'}`}
                          style={{
                            height: barsVisible ? `${pct}%` : '2%',
                            transitionDelay: `${Math.min(i * 8, 300)}ms`,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-muted-foreground">
                    {firstHour && format(new Date(firstHour), useDaily ? 'MMM d' : 'MMM d, h a')}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Peak: {peakCount} {useDaily ? 'votes/day' : 'votes/hr'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lastHour && format(new Date(lastHour), useDaily ? 'MMM d' : 'MMM d, h a')}
                  </p>
                </div>
              </div>
            </section>
          );
        })()}

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

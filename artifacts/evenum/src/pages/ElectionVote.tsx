import React, { useState, useEffect } from 'react';
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useGetElection, useListPositions, useListCandidates, useSubmitVote } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, Vote as VoteIcon, AlertCircle, CheckCircle2, Key, Mail,
  ShieldCheck, FileSignature, ArrowRight, ArrowLeft, Clock, Building2, ChevronRight
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

function useCountdown(targetDate: string | null | undefined) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ days, hours, minutes, seconds, expired: false });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return timeLeft;
}

// Step 0: Election landing / identity
// Step 1–N: One position per step (ballot)
// Step confirm: Review before casting
// Step success: Voted

export default function ElectionVote() {
  const [, params] = useRoute("/elections/:id/vote");
  const electionId = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();

  const { data: election, isLoading: isElectionLoading } = useGetElection(electionId);
  const { data: positions, isLoading: isPositionsLoading } = useListPositions(electionId);
  const { data: candidates, isLoading: isCandidatesLoading } = useListCandidates(electionId);
  const submitVote = useSubmitVote();

  const [step, setStep] = useState<'landing' | number | 'review' | 'success'>('landing');
  const [selections, setSelections] = useState<Record<number, number[]>>({});
  const [inviteCode, setInviteCode] = useState('');
  const [voterEmail, setVoterEmail] = useState('');

  const countdown = useCountdown(election?.endsAt);

  const toggleSelection = (positionId: number, candidateId: number, maxSelections: number) => {
    setSelections(prev => {
      const cur = prev[positionId] || [];
      if (cur.includes(candidateId)) {
        return { ...prev, [positionId]: cur.filter(id => id !== candidateId) };
      }
      if (cur.length >= maxSelections) {
        toast({
          title: 'Selection limit reached',
          description: `You can only select up to ${maxSelections} candidate(s) for this position.`,
          variant: 'destructive',
        });
        return prev;
      }
      return { ...prev, [positionId]: [...cur, candidateId] };
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
        },
      },
      {
        onSuccess: () => setStep('success'),
        onError: (error: any) => {
          setStep('review');
          const msg = error?.data?.error;
          toast({
            variant: 'destructive',
            title: 'Ballot submission failed',
            description: msg || 'There was an error submitting your ballot. Please try again.',
          });
        },
      }
    );
  };

  if (isElectionLoading || isPositionsLoading || isCandidatesLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        </div>
      </Layout>
    );
  }

  if (!election) return null;

  const needsInviteCode = election.visibility === 'invite_only';
  const needsVoterEmail = election.eligibilityMode === 'allowlist';
  const positionList = positions || [];
  const totalPositions = positionList.length;

  // ── Draft / Ended guards ──────────────────────────────────────────────────

  if (election.status === 'draft') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl animate-in fade-in duration-700">
          <AlertCircle className="h-14 w-14 text-muted-foreground/40 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">Polls Not Yet Open</h1>
          <p className="text-xl text-muted-foreground font-light">This election is in draft mode and has not opened for voting yet.</p>
        </div>
      </Layout>
    );
  }

  if (election.status === 'ended') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl animate-in fade-in duration-700">
          <FileSignature className="h-14 w-14 text-muted-foreground/40 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">Polls Have Closed</h1>
          <p className="text-xl text-muted-foreground font-light mb-8">Voting for this election has concluded.</p>
          <Button asChild variant="outline" className="h-12 px-8">
            <Link href={`/elections/${electionId}/results`}>View Official Results <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </Layout>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="container mx-auto px-4 py-24 text-center max-w-2xl animate-in zoom-in-95 fade-in duration-700">
            <div className="relative inline-flex mb-12">
              <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-14 w-14 text-primary animate-in zoom-in duration-500 delay-200" />
              </div>
            </div>
            <h1 className="text-5xl md:text-6xl font-serif font-bold mb-6 tracking-tight">Ballot Cast</h1>
            <p className="text-xl text-muted-foreground font-light leading-relaxed mb-4">
              Your vote has been securely recorded in{' '}
              <span className="font-medium text-foreground">{election.organizationName || 'this election'}</span>.
            </p>
            <p className="text-base text-muted-foreground mb-12">
              Submitted {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
            </p>
            <div className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground bg-muted/60 px-5 py-2.5 rounded-sm border border-border/60 mb-12">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Verifiable &amp; Anonymous
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild variant="outline" className="h-12 px-8">
                <Link href={`/elections/${electionId}/results`}>View Results</Link>
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Landing (Step 0 — Election Identity) ──────────────────────────────────

  if (step === 'landing') {
    return (
      <Layout>
        {/* Hero */}
        <div className="relative bg-foreground text-background overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/60 to-foreground/95" />
          <div className="relative z-10 container mx-auto px-4 pt-20 pb-16 max-w-4xl text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
            {election.organizationName && (
              <div className="flex items-center justify-center gap-2 text-background/60 text-sm font-medium uppercase tracking-widest mb-6">
                <Building2 className="h-4 w-4" />
                {election.organizationName}
              </div>
            )}
            <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tight leading-tight mb-6">
              {election.title}
            </h1>
            {election.description && (
              <p className="text-xl text-background/70 font-light max-w-2xl mx-auto mb-10 leading-relaxed">
                {election.description}
              </p>
            )}

            {/* Status & countdown */}
            <div className="inline-flex items-center gap-2 bg-background/10 backdrop-blur-md px-5 py-2.5 rounded-full border border-background/20 text-sm font-bold uppercase tracking-widest mb-10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Polls Open
            </div>

            {election.endsAt && !countdown.expired && (
              <div className="mb-12">
                <p className="text-background/50 text-xs font-bold uppercase tracking-widest mb-4">Polls close in</p>
                <div className="flex items-center justify-center gap-3">
                  {[
                    { value: countdown.days, label: 'Days' },
                    { value: countdown.hours, label: 'Hours' },
                    { value: countdown.minutes, label: 'Min' },
                    { value: countdown.seconds, label: 'Sec' },
                  ].map(({ value, label }) => (
                    <div key={label} className="flex flex-col items-center bg-background/10 backdrop-blur-md border border-background/20 rounded-sm px-4 py-3 min-w-[60px]">
                      <span className="text-3xl font-serif font-bold tabular-nums leading-none mb-1">
                        {String(value).padStart(2, '0')}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-background/50">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Election meta */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-12 text-sm">
              <Badge variant="secondary" className="bg-background/10 text-background border-background/20 capitalize">
                {election.visibility?.replace('_', ' ')}
              </Badge>
              <Badge variant="secondary" className="bg-background/10 text-background border-background/20">
                {totalPositions} {totalPositions === 1 ? 'Position' : 'Positions'}
              </Badge>
              {election.eligibilityMode && (
                <Badge variant="secondary" className="bg-background/10 text-background border-background/20 capitalize">
                  {election.eligibilityMode}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Access verification (if needed) + CTA */}
        <div className="container mx-auto px-4 py-16 max-w-2xl paper-grain">
          {(needsInviteCode || needsVoterEmail) && (
            <div className="bg-card border border-border rounded-sm shadow-lg overflow-hidden mb-10">
              <div className="bg-muted/40 px-8 py-5 border-b flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="font-serif font-bold text-lg">Voter Verification</h3>
              </div>
              <div className="p-8 space-y-6">
                <p className="text-muted-foreground font-light text-sm">
                  Authentication is required to participate in this election.
                </p>
                {needsInviteCode && (
                  <div className="space-y-2">
                    <Label htmlFor="invite-code" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <Key className="h-3.5 w-3.5" /> Invite Code
                    </Label>
                    <Input
                      id="invite-code"
                      placeholder="Enter the code provided by the organizer"
                      value={inviteCode}
                      onChange={e => setInviteCode(e.target.value)}
                      className="font-mono h-12 text-base"
                    />
                  </div>
                )}
                {needsVoterEmail && (
                  <div className="space-y-2">
                    <Label htmlFor="voter-email" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" /> Registered Email
                    </Label>
                    <Input
                      id="voter-email"
                      type="email"
                      placeholder="your@email.com"
                      value={voterEmail}
                      onChange={e => setVoterEmail(e.target.value)}
                      className="h-12 text-base"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="text-center">
            <Button
              size="lg"
              className="h-16 px-12 text-lg shadow-xl hover:shadow-2xl transition-all"
              disabled={
                (needsInviteCode && !inviteCode.trim()) ||
                (needsVoterEmail && !voterEmail.trim()) ||
                totalPositions === 0
              }
              onClick={() => setStep(0)}
            >
              <VoteIcon className="mr-3 h-5 w-5" />
              Enter the Ballot
              <ArrowRight className="ml-3 h-5 w-5" />
            </Button>
            {totalPositions > 0 && (
              <p className="text-sm text-muted-foreground mt-4">
                You will vote on {totalPositions} {totalPositions === 1 ? 'position' : 'positions'} one at a time.
              </p>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  // ── Ballot: position by position ──────────────────────────────────────────

  if (typeof step === 'number') {
    const position = positionList[step];
    if (!position) return null;
    const posCandidates = (candidates || []).filter(c => c.positionId === position.id);
    const currentSelections = selections[position.id] || [];
    const isLast = step === totalPositions - 1;

    return (
      <Layout>
        {/* Sticky progress header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60 shadow-sm">
          <div className="container mx-auto px-4 max-w-3xl py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-bold text-primary font-mono">
                {step + 1} / {totalPositions}
              </span>
              <span className="text-muted-foreground hidden sm:block">{election.title}</span>
            </div>
            {/* Progress bar */}
            <div className="flex-1 max-w-48 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${((step + 1) / totalPositions) * 100}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground hidden sm:block">
              {currentSelections.length} / {position.maxSelections} selected
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-14 max-w-3xl">
          {/* Position header */}
          <div className="mb-12 animate-in fade-in duration-500">
            <div className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
              Position {step + 1} of {totalPositions}
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight mb-3">
              {position.title}
            </h1>
            {position.description && (
              <p className="text-lg text-muted-foreground font-light">{position.description}</p>
            )}
            <div className="mt-4 text-sm text-muted-foreground">
              Select{' '}
              <span className="font-bold text-foreground">
                {position.maxSelections === 1 ? 'one candidate' : `up to ${position.maxSelections} candidates`}
              </span>
            </div>
          </div>

          {/* Candidate cards */}
          {posCandidates.length === 0 ? (
            <div className="text-center py-16 bg-card border border-dashed rounded-sm text-muted-foreground">
              No candidates listed for this position.
            </div>
          ) : (
            <div className="space-y-5">
              {posCandidates.map((candidate, idx) => {
                const isSelected = currentSelections.includes(candidate.id);
                return (
                  <div
                    key={candidate.id}
                    onClick={() => toggleSelection(position.id, candidate.id, position.maxSelections)}
                    className={`relative group rounded-sm border-2 overflow-hidden cursor-pointer transition-all duration-200 shadow-sm
                      ${isSelected
                        ? 'border-primary ring-4 ring-primary/10 shadow-md'
                        : 'border-border/60 bg-card hover:border-primary/40 hover:shadow-md'
                      }`}
                    style={{ animationDelay: `${idx * 80}ms` }}
                  >
                    <div className="flex flex-col sm:flex-row">
                      {/* Photo */}
                      <div className="sm:w-40 h-36 sm:h-auto bg-muted shrink-0 overflow-hidden">
                        {candidate.photoUrl ? (
                          <img
                            src={candidate.photoUrl}
                            alt={candidate.name}
                            className={`w-full h-full object-cover object-top transition-all duration-300
                              ${isSelected ? 'scale-105' : 'grayscale-[30%] group-hover:grayscale-0'}`}
                          />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center transition-colors
                            ${isSelected ? 'bg-primary/15' : 'bg-muted'}`}>
                            <span className="font-serif font-bold text-5xl text-muted-foreground/40">
                              {candidate.name.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className={`flex-1 p-6 transition-colors ${isSelected ? 'bg-primary/5' : 'bg-card'}`}>
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <h3 className={`font-serif font-bold text-2xl leading-tight ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                            {candidate.name}
                          </h3>
                          {/* Selection indicator */}
                          <div className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all mt-0.5
                            ${isSelected
                              ? 'bg-primary border-primary text-primary-foreground scale-110'
                              : 'border-muted-foreground/30 bg-background'
                            }`}>
                            {isSelected && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                        </div>

                        {candidate.bio && (
                          <p className="text-muted-foreground font-light text-sm leading-relaxed mb-4">{candidate.bio}</p>
                        )}

                        {candidate.platform && (
                          <div className="relative pl-4 border-l-2 border-primary/30 mt-3">
                            <p className="text-sm italic text-foreground/70 font-medium">"{candidate.platform}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-14 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto h-13 px-8"
              onClick={() => setStep(step === 0 ? 'landing' : step - 1)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {step === 0 ? 'Back to Election' : 'Previous Position'}
            </Button>

            <Button
              size="lg"
              className="w-full sm:w-auto h-13 px-10 shadow-lg"
              onClick={() => setStep(isLast ? 'review' : step + 1)}
            >
              {isLast ? (
                <>Review My Ballot <ChevronRight className="ml-2 h-5 w-5" /></>
              ) : (
                <>Next Position <ArrowRight className="ml-2 h-5 w-5" /></>
              )}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Review & Submit ───────────────────────────────────────────────────────

  if (step === 'review') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-2xl animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-4">
              <ShieldCheck className="h-4 w-4" /> Final Review
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight mb-4">Review Your Ballot</h1>
            <p className="text-lg text-muted-foreground font-light">
              Once submitted, your vote cannot be changed.
            </p>
          </div>

          {/* Official ballot card */}
          <div className="bg-card border-2 border-border rounded-sm shadow-2xl overflow-hidden mb-10">
            <div className="bg-foreground text-background px-8 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <VoteIcon className="h-5 w-5 text-background/70" />
                <span className="font-serif font-bold text-lg">Official Ballot</span>
              </div>
              <span className="text-xs text-background/50 font-mono">{election.title}</span>
            </div>

            <div className="divide-y divide-border/50">
              {positionList.map((position, idx) => {
                const selectedIds = selections[position.id] || [];
                const selectedCandidates = (candidates || []).filter(c => selectedIds.includes(c.id));

                return (
                  <div key={position.id} className="px-8 py-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                          Position {idx + 1}
                        </div>
                        <h4 className="font-serif font-bold text-xl">{position.title}</h4>
                      </div>
                      <button
                        onClick={() => setStep(idx)}
                        className="text-xs text-primary hover:underline font-medium shrink-0 mt-1"
                      >
                        Edit
                      </button>
                    </div>

                    {selectedCandidates.length === 0 ? (
                      <p className="text-muted-foreground italic font-light text-sm">Abstained</p>
                    ) : (
                      <div className="space-y-2 mt-3">
                        {selectedCandidates.map(c => (
                          <div key={c.id} className="flex items-center gap-3 bg-primary/5 border border-primary/20 px-4 py-3 rounded-sm">
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                            <span className="font-bold text-primary">{c.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <Button variant="outline" size="lg" className="h-14 px-8" onClick={() => setStep(totalPositions - 1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Ballot
            </Button>
            <Button
              size="lg"
              className="h-14 px-12 text-base shadow-xl hover:shadow-2xl transition-all"
              onClick={submitBallot}
              disabled={submitVote.isPending}
            >
              {submitVote.isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-5 w-5" />
              )}
              Cast Official Vote
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return null;
}

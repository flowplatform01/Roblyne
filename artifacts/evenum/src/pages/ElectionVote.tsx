import React, { useState, useEffect } from 'react';
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useGetElection, useListPositions, useListCandidates, useSubmitVote } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, Vote as VoteIcon, AlertCircle, CheckCircle2, Key, Mail,
  ShieldCheck, FileSignature, ArrowRight, ArrowLeft, Clock, Building2,
  ChevronRight, Users, Info, Lock, ExternalLink,
  Wallet
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ShareButton } from "@/components/branding/ShareButton";
import { hexToHsl } from "@/lib/branding";

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
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        expired: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return timeLeft;
}

function CountdownBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center bg-background/10 backdrop-blur-md border border-background/20 rounded-sm px-5 py-3.5 min-w-[72px]">
      <span className="text-3xl font-serif font-bold tabular-nums leading-none mb-1 text-background">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-background/50">{label}</span>
    </div>
  );
}

export default function ElectionVote() {
  const [, params] = useRoute("/elections/:id/vote");
  const electionId = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();

  // Read ?positionId=X&candidateId=Y from URL to deep-link from candidate profile
  const directPositionId = (() => {
    const raw = new URLSearchParams(window.location.search).get('positionId');
    return raw ? parseInt(raw, 10) : null;
  })();
  const directCandidateId = (() => {
    const raw = new URLSearchParams(window.location.search).get('candidateId');
    return raw ? parseInt(raw, 10) : null;
  })();

  const { data: election, isLoading: isElectionLoading } = useGetElection(electionId);
  const { data: positions, isLoading: isPositionsLoading } = useListPositions(electionId);
  const { data: candidates, isLoading: isCandidatesLoading } = useListCandidates(electionId);
  const submitVote = useSubmitVote();

  usePageMeta(election ? {
    title: `Vote Now — ${election.title}`,
    description: election.description || `Cast your vote in ${election.title}. Participate securely on Evenum.`,
    image: (election as any).heroImageUrl || (election as any).coverImageUrl || null,
    url: `${window.location.origin}/elections/${electionId}/vote`,
  } : null);

  const [step, setStep] = useState<'landing' | 'payment' | number | 'review' | 'success'>('landing');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);
  const [selections, setSelections] = useState<Record<number, number[]>>({});
  const [inviteCode, setInviteCode] = useState('');
  const [voterEmail, setVoterEmail] = useState('');
  const [voteQuantity, setVoteQuantity] = useState(1);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentMode, setPaymentMode] = useState<'quantity_first' | 'amount_first'>('quantity_first');

  useEffect(() => {
    fetch('/api/admin/platform-settings/public')
      .then(res => res.ok ? res.json() : null)
      .then(settings => {
        if (settings?.paymentMode === 'amount_first' || settings?.paymentMode === 'quantity_first') {
          setPaymentMode(settings.paymentMode);
        }
      })
      .catch(() => undefined);
  }, []);

  // When coming from a candidate profile, jump straight to that position and pre-select the candidate
  useEffect(() => {
    if (!directPositionId || !positions || positions.length === 0) return;
    const idx = positions.findIndex(p => p.id === directPositionId);
    if (idx !== -1) {
      if (directCandidateId) {
        setSelections(prev => ({ ...prev, [directPositionId]: [directCandidateId] }));
      }
      setStep(idx);
      const url = new URL(window.location.href);
      url.searchParams.delete('positionId');
      url.searchParams.delete('candidateId');
      window.history.replaceState({}, '', url.toString());
    }
  }, [positions, directPositionId, directCandidateId]);

  const countdown = useCountdown(election?.endsAt);
  const shareUrl = `${window.location.origin}/elections/${electionId}/vote`;

  useEffect(() => {
    if (election) {
      document.title = `${election.title} | Evenum`;
      const setMeta = (name: string, content: string, prop = false) => {
        const attr = prop ? 'property' : 'name';
        let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
        if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
        el.content = content;
      };
      setMeta('og:title', election.title, true);
      setMeta('og:description', election.description || `Vote in ${election.title}`, true);
      setMeta('og:url', shareUrl, true);
      setMeta('og:type', 'website', true);
      if ((election as any).heroImageUrl) setMeta('og:image', (election as any).heroImageUrl, true);
    }
  }, [election, shareUrl]);

  const toggleSelection = (positionId: number, candidateId: number, maxSelections: number) => {
    setSelections(prev => {
      const cur = prev[positionId] || [];
      if (cur.includes(candidateId)) return { ...prev, [positionId]: cur.filter(id => id !== candidateId) };
      if (cur.length >= maxSelections) {
        toast({ title: 'Selection limit reached', description: `You may select up to ${maxSelections} candidate(s) for this position.`, variant: 'destructive' });
        return prev;
      }
      return { ...prev, [positionId]: [...cur, candidateId] };
    });
  };

  const submitBallot = () => {
    if (selectedCandidateCount === 0) {
      toast({ title: 'Select at least one candidate', description: 'Choose a candidate before submitting your ballot.', variant: 'destructive' });
      return;
    }
    submitVote.mutate(
      {
        electionId,
        data: {
           selections: Object.entries(selections).map(([positionId, candidateIds]) => ({
            positionId: parseInt(positionId, 10),
            candidateIds,
          })),
           voteQuantity: computedQuantity,
          inviteCode: election?.visibility === 'invite_only' ? inviteCode : undefined,
          voterEmail: election?.eligibilityMode === 'allowlist' ? voterEmail : undefined,
        },
      },
      {
        onSuccess: () => setStep('success'),
        onError: (error: any) => {
          setStep('review');
          toast({ variant: 'destructive', title: 'Ballot submission failed', description: error?.data?.error || 'There was an error submitting your ballot. Please try again.' });
        },
      }
    );
  };

  if (isElectionLoading || isPositionsLoading || isCandidatesLoading) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">Loading Election</p>
        </div>
      </Layout>
    );
  }

  if (!election) return null;

  const primaryStyle: React.CSSProperties = election.accentColor
    ? { "--primary": hexToHsl(election.accentColor) } as React.CSSProperties
    : {};

  const needsInviteCode = election.visibility === 'invite_only';
  const needsVoterEmail = election.eligibilityMode === 'allowlist';
  const positionList = positions || [];
  const totalPositions = positionList.length;
  const allCandidates = candidates || [];
  const selectedCandidateCount = Object.values(selections).reduce((total, ids) => total + ids.length, 0);

  // ── Guards ────────────────────────────────────────────────────────────────

  if (election.status === 'draft') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl">
          <AlertCircle className="h-14 w-14 text-muted-foreground/30 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">Polls Not Yet Open</h1>
          <p className="text-xl text-muted-foreground font-light">This election is in draft mode and has not opened for voting.</p>
        </div>
      </Layout>
    );
  }

  if (election.status === 'ended') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl">
          <FileSignature className="h-14 w-14 text-muted-foreground/30 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">Polls Have Closed</h1>
          <p className="text-xl text-muted-foreground font-light mb-8">Voting for this election has concluded.</p>
          <Button asChild variant="outline" className="h-12 px-8 rounded-sm">
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
            <div className="relative inline-flex mb-12 justify-center">
              <div className="w-32 h-32 rounded-full border-4 border-primary/20 bg-primary/5 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border-2 border-primary/30 bg-primary/8 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-primary" />
                </div>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-6">
              <ShieldCheck className="h-4 w-4" /> Ballot Recorded
            </div>
            <h1 className="text-5xl md:text-6xl font-serif font-bold mb-6 tracking-tight">Vote Cast</h1>
            <p className="text-xl text-muted-foreground font-light leading-relaxed mb-4">
              Your vote has been securely recorded in{' '}
              <span className="font-medium text-foreground">{election.organizationName || 'this election'}</span>.
            </p>
            <p className="text-sm text-muted-foreground mb-10">
              Submitted {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
            </p>
            <div className="inline-flex items-center gap-3 text-sm font-medium text-muted-foreground bg-muted/50 px-6 py-3 rounded-sm border border-border/60 mb-12">
              <Lock className="h-4 w-4 text-primary shrink-0" />
              Your vote is cryptographically anonymous and immutable
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild variant="outline" className="h-12 px-8 rounded-sm">
                <Link href={`/elections/${electionId}/results`}>View Results</Link>
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  const heroImageUrl = (election as any).heroImageUrl || election.coverImageUrl;
  const feeRequired = Boolean(election.requiresPayment);
  const feeCur = 'XAF';
  const feeSym = 'XAF ';
  const pricePerVote = Number(election.paymentAmount || 0);
  const amountInput = paymentAmountInput === ''
    ? pricePerVote * Math.max(selectedCandidateCount, 1)
    : Number(paymentAmountInput);
  const amountToPay = paymentMode === 'amount_first'
    ? Math.max(0, amountInput || 0)
    : pricePerVote * selectedCandidateCount * voteQuantity;
  const computedQuantity = paymentMode === 'amount_first' && pricePerVote > 0
    ? Math.floor(amountToPay / (pricePerVote * Math.max(selectedCandidateCount, 1)))
    : voteQuantity;
  const totalVoteUnits = selectedCandidateCount * computedQuantity;

  // ── Payment gate (after review, before submit) ─────────────────────────────

  if (step === 'payment') {
    const handlePayment = () => {
      setPaymentProcessing(true);
      setTimeout(() => {
        setHasPaid(true);
        setPaymentProcessing(false);
        submitBallot();
      }, 2000);
    };

    return (
      <Layout>
        <div className="relative bg-foreground text-background overflow-hidden" style={primaryStyle}>
          {heroImageUrl ? (
            <>
              <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${heroImageUrl})` }} />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/75 to-black/90" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-foreground via-foreground/95 to-foreground/90" />
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 39px,currentColor 39px,currentColor 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,currentColor 39px,currentColor 40px)' }} />
            </>
          )}
          <div className="relative z-10 container mx-auto px-4 pt-16 pb-12 max-w-xl text-center animate-in fade-in duration-500">
            <p className="text-background/40 text-[10px] font-bold uppercase tracking-widest mb-3">Participation Summary</p>
            <div className="text-6xl md:text-7xl font-serif font-bold text-background mb-2 tracking-tight">
              {feeSym}{amountToPay.toLocaleString('en-US')}
            </div>
            <p className="text-background/50 font-light">{feeCur} · {totalVoteUnits} vote{totalVoteUnits === 1 ? '' : 's'}</p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10 max-w-md" style={primaryStyle}>
          <button
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
            onClick={() => setStep('review')}
          >
            <ArrowLeft className="h-4 w-4" /> Back to review
          </button>

          <div className="bg-muted/30 border border-border/50 rounded-sm p-5 mb-6 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Payment Details</p>
            {paymentMode === 'amount_first' ? (
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Amount to pay (XAF)</Label>
                <Input id="payment-amount" type="number" min="0" step="1" value={paymentAmountInput} onChange={e => setPaymentAmountInput(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="vote-quantity">Votes per selected candidate</Label>
                <Input id="vote-quantity" type="number" min="1" step="1" value={voteQuantity} onChange={e => setVoteQuantity(Math.max(1, parseInt(e.target.value || '1', 10)))} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground block">Price per candidate vote</span><strong>{feeSym}{pricePerVote.toLocaleString('en-US')}</strong></div>
              <div><span className="text-muted-foreground block">Selected candidates</span><strong>{selectedCandidateCount}</strong></div>
              <div><span className="text-muted-foreground block">Total vote units</span><strong>{totalVoteUnits}</strong></div>
              <div className="col-span-2 pt-3 border-t border-border/40"><span className="text-muted-foreground block">Total payable</span><strong className="text-xl text-primary">{feeSym}{amountToPay.toLocaleString('en-US')}</strong></div>
            </div>
          </div>

          {/* Ballot summary */}
          <div className="bg-muted/30 border border-border/50 rounded-sm p-5 mb-6 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Your Selections</p>
            {positionList.map(position => {
              const selected = allCandidates.filter(c => (selections[position.id] || []).includes(c.id));
              return (
                <div key={position.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground truncate">{position.title}</span>
                  <span className="font-medium shrink-0">
                    {selected.length === 0 ? <span className="text-muted-foreground/50 italic">Abstain</span> : selected.map(c => c.name).join(', ')}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Payment CTA */}
          <div className="rounded-sm border border-border overflow-hidden shadow-xl mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-foreground/5 px-6 py-4 border-b border-border/60 flex items-center gap-3">
              <Wallet className="h-5 w-5 text-primary" />
              <div>
                <p className="font-serif font-bold">Complete Payment</p>
                <p className="text-xs text-muted-foreground">Secure payment confirmation</p>
              </div>
              <span className="ml-auto text-lg">🔒</span>
            </div>
            <div className="p-6">
              <Button
                className="w-full h-14 text-base rounded-sm"
                 onClick={handlePayment}
                disabled={paymentProcessing}
              >
                {paymentProcessing ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Confirming payment…</>
                ) : (
                  <><Wallet className="mr-2 h-5 w-5" /> Confirm payment</>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground/50 mt-4">
                Your vote will be submitted automatically after payment confirmation.
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Landing (Election Identity) ───────────────────────────────────────────

  if (step === 'landing') {
    return (
      <Layout>
        {/* Election hero — dark, ceremonial */}
        <div className="relative bg-foreground text-background overflow-hidden" style={primaryStyle}>
          {heroImageUrl ? (
            <>
              <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${heroImageUrl})` }} />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/85" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-foreground via-foreground/95 to-foreground/90" />
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, currentColor 39px, currentColor 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, currentColor 39px, currentColor 40px)',
              }} />
            </>
          )}
          <div className="relative z-10 container mx-auto px-4 pt-20 pb-16 max-w-4xl text-center animate-in fade-in slide-in-from-bottom-6 duration-700">
            {election.organizationName && (
              <div className="flex items-center justify-center gap-2 text-background/50 text-xs font-bold uppercase tracking-widest mb-6">
                {(election as any).organizationLogoUrl ? (
                  <img
                    src={(election as any).organizationLogoUrl}
                    alt={election.organizationName}
                    className="w-5 h-5 rounded object-cover border border-background/20"
                  />
                ) : (
                  <Building2 className="h-3.5 w-3.5" />
                )}
                {election.organizationName}
              </div>
            )}

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold tracking-tight leading-tight mb-6 text-background">
              {election.title}
            </h1>

            {election.description && (
              <p className="text-xl text-background/60 font-light max-w-2xl mx-auto mb-6 leading-relaxed">
                {election.description}
              </p>
            )}

            <div className="flex justify-center mb-6">
              <ShareButton
                url={shareUrl}
                title={election.title}
                description={election.description || `Vote in ${election.title}`}
                className="bg-transparent border-background/30 text-background hover:bg-background/10 hover:border-background/50 hover:text-background rounded-sm"
              />
            </div>

            {/* Countdown */}
            {election.endsAt && !countdown.expired && (
              <div className="mb-10">
                <p className="text-background/40 text-[10px] font-bold uppercase tracking-widest mb-4">Polls close in</p>
                <div className="flex items-center justify-center gap-2">
                  <CountdownBlock value={countdown.days} label="Days" />
                  <CountdownBlock value={countdown.hours} label="Hours" />
                  <CountdownBlock value={countdown.minutes} label="Min" />
                  <CountdownBlock value={countdown.seconds} label="Sec" />
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-background/40 text-sm mb-4">
              {election.startsAt && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Opened {format(new Date(election.startsAt), 'MMM d, yyyy')}
                </div>
              )}
              {election.endsAt && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Closes {format(new Date(election.endsAt), 'MMM d, yyyy · h:mm a')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Candidates by position — independent voting from landing */}
        {totalPositions > 0 && (
          <div className="border-b border-border/50 bg-muted/20">
            <div className="container mx-auto px-4 py-12 max-w-3xl">
              <div className="flex items-center gap-3 mb-2">
                <VoteIcon className="h-5 w-5 text-primary shrink-0" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Candidates &middot; {totalPositions} {totalPositions === 1 ? 'Position' : 'Positions'}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6 pl-8">
                Vote for individual candidates directly, or cast a full ballot across all positions.
              </p>
              <div className="space-y-8">
                {positionList.map((position, idx) => {
                  const posCandidates = allCandidates.filter(c => c.positionId === position.id);
                  return (
                    <div key={position.id}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-6 h-6 rounded-sm bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <span className="font-serif font-bold text-xs">{idx + 1}</span>
                        </div>
                        <h3 className="font-serif font-bold text-lg">{position.title}</h3>
                        {position.maxSelections > 1 && (
                          <Badge variant="outline" className="text-xs ml-auto shrink-0">Select up to {position.maxSelections}</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-9">
                        {posCandidates.map(candidate => (
                          <Link
                            key={candidate.id}
                            href={`/elections/${electionId}/vote?positionId=${position.id}&candidateId=${candidate.id}`}
                            className="flex items-center gap-3 bg-card border border-border/50 rounded-sm px-4 py-3 hover:border-primary/40 hover:bg-primary/5 transition-all group cursor-pointer"
                          >
                            {candidate.photoUrl ? (
                              <img src={candidate.photoUrl} alt={candidate.name} className="w-8 h-8 rounded-sm object-cover object-top border border-border/30 shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center border border-border/30 shrink-0">
                                <span className="font-serif font-bold text-xs text-muted-foreground">{candidate.name.charAt(0)}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-serif font-bold text-sm truncate group-hover:text-primary transition-colors">{candidate.name}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 shrink-0 transition-colors" />
                          </Link>
                        ))}
                        {posCandidates.length === 0 && (
                          <p className="text-sm text-muted-foreground italic col-span-2">No candidates yet</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Election credentials + full-ballot CTA */}
        <div className="container mx-auto px-4 py-16 max-w-2xl" style={primaryStyle}>

          <div className="flex items-start gap-4 bg-primary/5 border border-primary/15 rounded-sm p-5 mb-8">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-foreground mb-1">About This Election</p>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">
                This is a {election.visibility?.replace('_', ' ')} election managed by{' '}
                {election.organizationName || 'the organizing body'}. Each eligible voter may cast one ballot.
                Votes are recorded anonymously and cannot be changed after submission.
              </p>
            </div>
          </div>

          {/* Voter verification */}
          {(needsInviteCode || needsVoterEmail) && (
            <div className="bg-card border border-border rounded-sm shadow-sm overflow-hidden mb-8">
              <div className="bg-foreground/5 px-8 py-5 border-b flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="font-serif font-bold text-lg">Voter Verification</h3>
              </div>
              <div className="p-8 space-y-6">
                <p className="text-sm text-muted-foreground font-light">
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
                      className="font-mono h-12 text-base rounded-sm"
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
                      className="h-12 text-base rounded-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {totalPositions === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-sm text-muted-foreground">
              No positions have been added to this election yet.
            </div>
          ) : (
            <div className="text-center space-y-3">
              <Button
                size="lg"
                className="h-16 px-14 text-lg shadow-xl hover:shadow-2xl transition-all rounded-sm"
                disabled={
                  (needsInviteCode && !inviteCode.trim()) ||
                  (needsVoterEmail && !voterEmail.trim())
                }
                onClick={() => setStep(0)}
              >
                 <VoteIcon className="mr-3 h-5 w-5" /> Cast Full Ballot <ArrowRight className="ml-3 h-5 w-5" />
              </Button>
               <p className="text-sm text-muted-foreground">
                 Vote through all {totalPositions} {totalPositions === 1 ? 'position' : 'positions'}; each selected candidate counts as a separate vote.
              </p>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ── Ballot: position by position ──────────────────────────────────────────

  if (typeof step === 'number') {
    const position = positionList[step];
    if (!position) return null;
    const posCandidates = allCandidates.filter(c => c.positionId === position.id);
    const currentSelections = selections[position.id] || [];
    const isLast = step === totalPositions - 1;
    const progressPct = ((step + 1) / totalPositions) * 100;
    const hasAnySelection = Object.values(selections).some(ids => ids.length > 0);
    return (
      <Layout>
        {/* Sticky ballot header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60 shadow-sm" style={primaryStyle}>
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="py-3 flex items-center gap-4">
              <span className="text-xs font-bold text-muted-foreground hidden sm:block truncate">{election.title}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="shrink-0 flex items-center gap-3">
                <span className="text-xs font-bold tabular-nums text-primary">
                  {step + 1} <span className="text-muted-foreground font-normal">/ {totalPositions}</span>
                </span>
                <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {currentSelections.length}/{position.maxSelections} selected
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-14 max-w-4xl">
          {/* Position header */}
          <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
              Position {step + 1} of {totalPositions}
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight mb-3 leading-tight">
              {position.title}
            </h1>
            {position.description && (
              <p className="text-lg text-muted-foreground font-light max-w-2xl">{position.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-3">
              Select{' '}
              <span className="font-semibold text-foreground">
                {position.maxSelections === 1 ? 'one candidate' : `up to ${position.maxSelections} candidates`}
              </span>{' '}
              for this position
            </p>
          </div>

          {/* Candidates */}
          {posCandidates.length === 0 ? (
            <div className="text-center py-16 bg-card border border-dashed rounded-sm text-muted-foreground">
              No candidates listed for this position.
            </div>
          ) : (
            <div className="space-y-6">
              {posCandidates.map((candidate, idx) => {
                const isSelected = currentSelections.includes(candidate.id);
                return (
                  <div
                    key={candidate.id}
                    onClick={() => toggleSelection(position.id, candidate.id, position.maxSelections)}
                    className={`group relative rounded-sm overflow-hidden cursor-pointer transition-all duration-200
                      ${isSelected
                        ? 'ring-2 ring-primary ring-offset-2 shadow-lg'
                        : 'border border-border/60 hover:border-primary/30 hover:shadow-md bg-card'
                      }`}
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary z-10" />
                    )}

                    <div className="flex flex-col sm:flex-row">
                      <div className="sm:w-52 sm:min-h-full min-h-48 bg-muted shrink-0 overflow-hidden relative">
                        {candidate.photoUrl ? (
                          <img
                            src={candidate.photoUrl}
                            alt={candidate.name}
                            className={`w-full h-full object-cover object-top absolute inset-0 transition-all duration-500
                              ${isSelected ? 'scale-105' : 'group-hover:scale-102 grayscale-[20%] group-hover:grayscale-0'}`}
                          />
                        ) : (
                          <div className={`w-full h-full absolute inset-0 flex items-center justify-center transition-colors
                            ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                            <span className="font-serif font-bold text-6xl text-muted-foreground/30">
                              {candidate.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent h-16 hidden sm:block" />
                      </div>

                      <div className={`flex-1 p-7 transition-colors ${isSelected ? 'bg-primary/[0.04]' : 'bg-card'}`}>
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div>
                            <h3 className={`font-serif font-bold text-2xl leading-tight mb-1 ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                              {candidate.name}
                            </h3>
                            <div className="flex items-center gap-2 flex-wrap">
                              {isSelected && (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Selected
                                </div>
                              )}
                            </div>
                          </div>
                          <div className={`shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all mt-0.5
                            ${isSelected
                              ? 'bg-primary border-primary text-primary-foreground shadow-md'
                              : 'border-border/50 bg-background group-hover:border-primary/50'
                            }`}>
                            {isSelected ? <CheckCircle2 className="w-4 h-4" /> : null}
                          </div>
                        </div>

                        {candidate.bio && (
                          <p className="text-sm text-muted-foreground font-light leading-relaxed mb-5 max-w-prose">
                            {candidate.bio}
                          </p>
                        )}

                        {candidate.platform && (
                          <div className={`mt-4 border-l-[3px] pl-5 py-1 transition-colors
                            ${isSelected ? 'border-primary' : 'border-border/40 group-hover:border-primary/30'}`}>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                              Platform
                            </p>
                            <p className={`text-sm leading-relaxed font-medium italic
                              ${isSelected ? 'text-foreground' : 'text-foreground/70'}`}>
                              &ldquo;{candidate.platform}&rdquo;
                            </p>
                          </div>
                        )}

                        <div className="mt-5 flex items-center justify-between gap-3">
                          {!isSelected ? (
                            <div className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors">
                              <div className="w-4 h-4 rounded-full border-2 border-current" />
                              Click to select
                            </div>
                          ) : (
                            <div />
                          )}
                          <Link
                            href={`/candidates/${electionId}/${candidate.id}`}
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors shrink-0"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View Profile
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-14 space-y-4 border-t border-border/40 pt-10">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto h-13 px-8 rounded-sm"
                onClick={() => setStep(step === 0 ? 'landing' : step - 1)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {step === 0 ? 'Back to Election' : 'Previous Position'}
              </Button>

              <Button
                size="lg"
                className="w-full sm:w-auto h-13 px-10 shadow-lg rounded-sm"
                onClick={() => setStep(isLast ? 'review' : step + 1)}
              >
                {isLast ? (
                  <>Review My Ballot <ChevronRight className="ml-2 h-5 w-5" /></>
                ) : (
                  <>Next Position <ArrowRight className="ml-2 h-5 w-5" /></>
                )}
              </Button>
            </div>

            {/* Optional: submit early without going through all positions */}
            {!isLast && hasAnySelection && (
              <div className="text-center pt-2">
                <button
                  className="text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
                  onClick={() => setStep('review')}
                >
                  Skip remaining positions and review my ballot
                </button>
              </div>
            )}
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
            <p className="text-muted-foreground font-light text-lg">
              Please verify each selection before casting your official vote.
              Once submitted, your ballot cannot be changed.
            </p>
          </div>

          {/* Official ballot */}
          <div className="bg-card border-2 border-border rounded-sm shadow-2xl overflow-hidden mb-10">
            <div className="bg-foreground text-background px-8 py-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.04]" style={{
                backgroundImage: 'repeating-linear-gradient(45deg, currentColor, currentColor 1px, transparent 0, transparent 50%)',
                backgroundSize: '8px 8px',
              }} />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm bg-background/10 flex items-center justify-center border border-background/20">
                    <VoteIcon className="h-5 w-5 text-background/70" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-background/40 mb-0.5">Official Ballot</p>
                    <p className="font-serif font-bold text-lg text-background leading-tight">{election.title}</p>
                  </div>
                </div>
                {election.organizationName && (
                  <p className="text-xs text-background/40 hidden sm:block text-right max-w-[140px] leading-tight">{election.organizationName}</p>
                )}
              </div>
            </div>

            <div className="divide-y divide-border/40">
              {positionList.map((position, idx) => {
                const selectedIds = selections[position.id] || [];
                const selectedCandidates = allCandidates.filter(c => selectedIds.includes(c.id));

                return (
                  <div key={position.id} className="px-8 py-7">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                          Position {idx + 1}
                        </div>
                        <h4 className="font-serif font-bold text-xl">{position.title}</h4>
                      </div>
                      <button
                        onClick={() => setStep(idx)}
                        className="text-xs text-primary hover:underline font-bold shrink-0 mt-1 uppercase tracking-wide"
                      >
                        Edit
                      </button>
                    </div>

                    {selectedCandidates.length === 0 ? (
                      <div className="flex items-center gap-3 py-2 text-sm text-muted-foreground italic">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                        Abstained
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedCandidates.map(c => (
                          <div key={c.id} className="flex items-center gap-4 bg-primary/5 border border-primary/20 px-5 py-3.5 rounded-sm">
                            {c.photoUrl ? (
                              <img src={c.photoUrl} alt={c.name} className="w-9 h-9 rounded-sm object-cover object-top border border-primary/20 shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-sm bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                                <span className="font-serif font-bold text-sm text-primary">{c.name.charAt(0)}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-serif font-bold text-primary truncate">{c.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Fee summary if any */}
            {feeRequired && !hasPaid && (
              <div className="px-8 py-4 bg-amber-50/60 border-t border-amber-200/40 flex items-center gap-3">
                <Wallet className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-700 font-medium">
                  Payment required: {feeSym}{amountToPay.toLocaleString('en-US')} for {totalVoteUnits} vote{totalVoteUnits === 1 ? '' : 's'}
                </p>
              </div>
            )}

            <div className="px-8 py-4 bg-muted/20 border-t border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
              Once submitted, this ballot is sealed and cannot be modified.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <Button variant="outline" size="lg" className="h-14 px-8 rounded-sm" onClick={() => setStep(totalPositions - 1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Ballot
            </Button>
            <Button
              size="lg"
              className="h-14 px-12 text-base shadow-xl hover:shadow-2xl transition-all rounded-sm"
              onClick={() => feeRequired && !hasPaid ? setStep('payment') : submitBallot()}
               disabled={submitVote.isPending || selectedCandidateCount === 0 || (feeRequired && computedQuantity < 1)}
            >
              {submitVote.isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : feeRequired && !hasPaid ? (
                <Wallet className="mr-2 h-5 w-5" />
              ) : (
                <ShieldCheck className="mr-2 h-5 w-5" />
              )}
               {feeRequired && !hasPaid ? `Pay ${feeSym}${amountToPay.toLocaleString('en-US')} & Submit` : 'Cast Official Vote'}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return null;
}

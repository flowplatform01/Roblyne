import React, { useState, useEffect, useRef } from 'react';
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  useGetElection, useListPositions, useListCandidates,
  useSubmitVote, useGetElectionResults,
} from "@workspace/api-client-react";
import type { Candidate, Election, Position } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, Vote as VoteIcon, AlertCircle, CheckCircle2, Key, Mail,
  ShieldCheck, FileSignature, ArrowRight, ArrowLeft, Clock, Building2,
  ChevronRight, Users, Info, Lock, ExternalLink,
  Wallet, LayoutGrid, List, Hash, ExternalLink as LinkIcon,
  Sparkles, Trophy, BarChart2,
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ShareButton } from "@/components/branding/ShareButton";
import { PublicHeroBackdrop } from "@/components/branding/PublicHeroBackdrop";
import { ElectionCountdown } from "@/components/elections/ElectionCountdown";
import { hexToHsl } from "@/lib/branding";
import { useElectionLifecycle } from "@/hooks/useLifecycle";
import { formatCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { BallotLoadingSkeleton } from "@/components/loading/LoadingStates";
import { openFlowPayCheckout } from "@/lib/flowpay-checkout";
import { apiUrl } from "@/lib/api-url";
import { useQuery } from "@tanstack/react-query";

// ── Main component ─────────────────────────────────────────────────────────────

export default function ElectionVote() {
  const [, params] = useRoute("/elections/:id/vote");
  const electionId = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  // Deep-link support: ?positionId=X&candidateId=Y from candidate profile page
  const directPositionId = (() => {
    const raw = new URLSearchParams(window.location.search).get('positionId');
    return raw ? parseInt(raw, 10) : null;
  })();
  const directCandidateId = (() => {
    const raw = new URLSearchParams(window.location.search).get('candidateId');
    return raw ? parseInt(raw, 10) : null;
  })();
  const inviteFromLink = new URLSearchParams(window.location.search).get('invite')?.trim().toUpperCase() || '';
  const hasInviteLink = inviteFromLink.length > 0;
  const inviteVerification = useQuery({
    queryKey: ['election-invite-verification', electionId, inviteFromLink],
    enabled: hasInviteLink && Number.isInteger(electionId) && electionId > 0,
    retry: false,
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/elections/${electionId}/invite-verification`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteFromLink }),
      });
      const body = await response.json().catch(() => null) as { error?: string; verified?: boolean } | null;
      if (!response.ok || !body?.verified) {
        throw new Error(body?.error || 'This invite link is invalid or no longer available.');
      }
      return body;
    },
  });

  const standardElection = useGetElection(electionId, { query: { enabled: !hasInviteLink } });
  const standardPositions = useListPositions(electionId, { query: { enabled: !hasInviteLink } });
  const standardCandidates = useListCandidates(electionId, undefined, { query: { enabled: !hasInviteLink } });
  const standardResults = useGetElectionResults(electionId, { query: { enabled: !hasInviteLink } });
  const inviteResources = useQuery({
    queryKey: ['invite-election', electionId, inviteFromLink],
    enabled: hasInviteLink && inviteVerification.isSuccess && Number.isInteger(electionId) && electionId > 0,
    retry: false,
    queryFn: async (): Promise<[Election, Position[], Candidate[]]> => {
      const responses = await Promise.all([
        fetch(apiUrl(`/api/elections/${electionId}`), { credentials: 'include' }),
        fetch(apiUrl(`/api/elections/${electionId}/positions`), { credentials: 'include' }),
        fetch(apiUrl(`/api/elections/${electionId}/candidates`), { credentials: 'include' }),
      ]);
      if (responses.some(response => !response.ok)) throw new Error('This invite link is invalid or no longer available.');
      const [electionData, positionsData, candidatesData] = await Promise.all(responses.map(response => response.json()));
      return [electionData as Election, positionsData as Position[], candidatesData as Candidate[]];
    },
  });
  const [inviteElection, invitePositions, inviteCandidates] = inviteResources.data ?? [];
  const election = hasInviteLink ? inviteElection : standardElection.data;
  const positions = hasInviteLink ? invitePositions : standardPositions.data;
  const candidates = hasInviteLink ? inviteCandidates : standardCandidates.data;
  const liveResults = hasInviteLink ? undefined : standardResults.data;
  const isElectionLoading = hasInviteLink ? inviteVerification.isLoading || inviteResources.isLoading : standardElection.isLoading;
  const isPositionsLoading = hasInviteLink ? inviteVerification.isLoading || inviteResources.isLoading : standardPositions.isLoading;
  const isCandidatesLoading = hasInviteLink ? inviteVerification.isLoading || inviteResources.isLoading : standardCandidates.isLoading;
  const submitVote = useSubmitVote();

  usePageMeta(election ? {
    title: `Vote Now — ${election.title}`,
    description: election.description || `Cast your vote in ${election.title}. Participate securely on ROBLYNE.`,
    image: (election as any).heroImageUrl || (election as any).coverImageUrl || null,
    url: `${window.location.origin}/elections/${electionId}/vote`,
  } : null);

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<'landing' | 'payment' | number | 'review' | 'success'>('landing');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);
  const [selections, setSelections] = useState<Record<number, number[]>>({});
  const [inviteCode, setInviteCode] = useState(inviteFromLink);
  const [voterEmail, setVoterEmail] = useState('');
  const [voteQuantity, setVoteQuantity] = useState(1);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentCustomerName, setPaymentCustomerName] = useState('');
  const [paymentCustomerEmail, setPaymentCustomerEmail] = useState('');
  const [paymentCustomerPhone, setPaymentCustomerPhone] = useState('');
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [paymentStatusToken, setPaymentStatusToken] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<'quantity_first' | 'amount_first'>('quantity_first');
  const { data: paymentStatus } = usePaymentStatus(paymentId, paymentStatusToken);

  useEffect(() => {
    if (!inviteVerification.isSuccess || !hasInviteLink) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('invite');
    window.history.replaceState({}, '', url.toString());
    setInviteCode('');
  }, [hasInviteLink, inviteVerification.isSuccess]);

  // ── Display preferences ───────────────────────────────────────────────────
  const [layoutMode, setLayoutMode] = useState<'list' | 'grid'>('grid');
  const [showNumbers, setShowNumbers] = useState(true);

  // ── Position section refs (for chip-nav scroll-to) ────────────────────────
  const positionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    fetch(apiUrl('/api/admin/platform-settings/public'))
      .then(res => res.ok ? res.json() : null)
      .then(settings => {
        if (settings?.paymentMode === 'amount_first' || settings?.paymentMode === 'quantity_first') {
          setPaymentMode(settings.paymentMode);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!paymentStatus || paymentId === null) return;
    if (paymentStatus.status === "succeeded") {
      setHasPaid(true);
      setPaymentProcessing(false);
      setPaymentId(null);
      setPaymentStatusToken(null);
      setCheckoutUrl(null);
      setStep("success");
      toast({
        title: "Vote recorded",
        description: "Payment confirmed and your ballot has been sealed.",
      });
    } else if (paymentStatus.status === "failed") {
      setPaymentProcessing(false);
      setPaymentId(null);
      setPaymentStatusToken(null);
      setCheckoutUrl(null);
      setStep("review");
      toast({ title: "Payment failed", description: "Your ballot was not recorded. Please try again.", variant: "destructive" });
    }
  }, [paymentStatus, paymentId, toast]);

  // Jump to position when arriving from a candidate profile deep-link
  useEffect(() => {
    if (!directPositionId || !positions || positions.length === 0) return;
    const idx = positions.findIndex(p => p.id === directPositionId);
    if (idx !== -1) {
      if (directCandidateId) setSelections(prev => ({ ...prev, [directPositionId]: [directCandidateId] }));
      setStep(idx);
      const url = new URL(window.location.href);
      url.searchParams.delete('positionId');
      url.searchParams.delete('candidateId');
      window.history.replaceState({}, '', url.toString());
    }
  }, [positions, directPositionId, directCandidateId]);

  const electionClock = useElectionLifecycle(election?.startsAt, election?.endsAt);
  const countdown = electionClock.countdown;
  const lifecycleState = election?.status === "ended"
    ? "ended"
    : electionClock.lifecycleState;
  const shareUrl = `${window.location.origin}/elections/${electionId}/vote`;

  // ── Selection logic ───────────────────────────────────────────────────────
  // Single-select positions auto-switch (no error); multi-select enforces the cap.
  const toggleSelection = (positionId: number, candidateId: number, maxSelections: number) => {
    setSelections(prev => {
      const cur = prev[positionId] || [];
      // Clicking an already-selected candidate deselects it
      if (cur.includes(candidateId)) return { ...prev, [positionId]: cur.filter(id => id !== candidateId) };
      // Single-select: silently switch to the new candidate
      if (maxSelections === 1 && cur.length >= 1) {
        return { ...prev, [positionId]: [candidateId] };
      }
      // Multi-select: enforce the cap with a toast
      if (cur.length >= maxSelections) {
        toast({
          title: t("voting.selectionLimitReached"),
          description: t("voting.selectionLimitDescription", { count: maxSelections }),
          variant: 'destructive',
        });
        return prev;
      }
      return { ...prev, [positionId]: [...cur, candidateId] };
    });
  };

  const submitBallot = () => {
    const pricePerVoteForSubmit = Number(election?.paymentAmount || 0);
    const paidBallot = Boolean(election?.requiresPayment && pricePerVoteForSubmit > 0);

    if (lifecycleState !== "live") {
      toast({
        title: lifecycleState === "upcoming" ? t("voting.notOpen") : t("voting.ended"),
        description: lifecycleState === "upcoming"
          ? t("voting.notOpenDescription")
          : t("voting.endedDescription"),
        variant: "destructive",
      });
      return;
    }
    if (selectedCandidateCount === 0) {
      toast({ title: t("voting.selectCandidate"), description: t("voting.selectCandidateDescription"), variant: 'destructive' });
      return;
    }

    const customerName = paymentCustomerName.trim();
    const customerEmail = (paymentCustomerEmail || voterEmail).trim();
    const customerPhone = paymentCustomerPhone.trim();
    const quantityForSubmit = paymentMode === 'amount_first' && pricePerVoteForSubmit > 0
      ? Math.floor(
        (paymentMode === 'amount_first'
          ? Math.max(0, paymentAmountInput === '' ? pricePerVoteForSubmit * Math.max(selectedCandidateCount, 1) : Number(paymentAmountInput))
          : pricePerVoteForSubmit * selectedCandidateCount * voteQuantity)
        / (pricePerVoteForSubmit * Math.max(selectedCandidateCount, 1)),
      )
      : voteQuantity;

    if (paidBallot) {
      if (!customerName || !customerEmail || !customerPhone) {
        toast({
          title: t("voting.submissionFailed"),
          description: "Enter your full name, email, and phone number before paying.",
          variant: "destructive",
        });
        setStep("payment");
        return;
      }
      if (quantityForSubmit < 1) {
        toast({
          title: t("voting.submissionFailed"),
          description: "The payment amount is too low for at least one vote at the selected price.",
          variant: "destructive",
        });
        setStep("payment");
        return;
      }
    }

    submitVote.mutate(
      {
        electionId,
        data: {
          selections: Object.entries(selections).map(([positionId, candidateIds]) => ({
            positionId: parseInt(positionId, 10),
            candidateIds,
          })),
          voteQuantity: quantityForSubmit,
          inviteCode: election?.visibility === 'invite_only' && !inviteVerification.isSuccess
            ? inviteCode || undefined
            : undefined,
          voterEmail: election?.eligibilityMode === 'allowlist' ? voterEmail.trim() || undefined : undefined,
          customerName: paidBallot ? customerName : undefined,
          customerEmail: paidBallot ? customerEmail : undefined,
          customerPhone: paidBallot ? customerPhone : undefined,
        },
      },
      {
        onSuccess: (result) => {
          setPaymentProcessing(false);
          if ("paymentRequired" in result) {
            if (!result.checkoutUrl) {
              toast({ title: "Payment unavailable", description: "No payment checkout link was returned.", variant: "destructive" });
              setStep("review");
              return;
            }
            setPaymentId(result.paymentId);
            setPaymentStatusToken(result.statusToken);
            setCheckoutUrl(result.checkoutUrl);
            openFlowPayCheckout({
              checkoutUrl: result.checkoutUrl,
              paymentId: result.paymentId,
              statusToken: result.statusToken,
              title: t("voting.completePayment", "Cast Ballot — Complete Payment"),
              onCompleted: () => {
                // Keep paymentId/statusToken so usePaymentStatus can confirm
                // ROBLYNE finalization before clearing checkout state.
                setPaymentProcessing(true);
                setHasPaid(true);
              },
              onFailed: () => {
                setPaymentProcessing(false);
                setStep("review");
                toast({
                  title: "Payment failed",
                  description: "Your ballot was not recorded. Please try again.",
                  variant: "destructive",
                });
              },
            });
            return;
          }
          setStep('success');
        },
        onError: (error: any) => {
          setPaymentProcessing(false);
          setStep('review');
          toast({ variant: 'destructive', title: t("voting.submissionFailed"), description: error?.data?.error || t("voting.submissionFailedDescription") });
        },
      }
    );
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isElectionLoading || isPositionsLoading || isCandidatesLoading) {
    return (
      <Layout>
        <BallotLoadingSkeleton />
      </Layout>
    );
  }

  if (!election) {
    return (
      <Layout>
        <main className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4 py-12">
          <div className="w-full rounded-lg border bg-card p-8 text-center shadow-sm">
            <Lock className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">This voting page needs access</h1>
            <p className="mt-3 text-sm text-muted-foreground">Use the complete link provided by the organizer, or enter an invite code below. Private elections remain visible only to their organization.</p>
            <form className="mt-6 flex gap-2" onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const code = String(form.get('invite') || '').trim().toUpperCase();
              if (code) window.location.assign(`/elections/${electionId}/vote?invite=${encodeURIComponent(code)}`);
            }}>
              <Input name="invite" aria-label="Invite code" placeholder="Invite code" className="font-mono" autoComplete="off" />
              <Button type="submit">Continue</Button>
            </form>
            <Button asChild variant="link" className="mt-4"><Link href="/elections">Browse public elections</Link></Button>
          </div>
        </main>
      </Layout>
    );
  }

  const primaryStyle: React.CSSProperties = election.accentColor
    ? { "--primary": hexToHsl(election.accentColor) } as React.CSSProperties
    : {};

  const inviteAccessVerified = inviteVerification.isSuccess || Boolean((election as any).inviteVerified);
  const needsInviteCode = election.visibility === 'invite_only' && !inviteAccessVerified;
  const needsVoterEmail = election.eligibilityMode === 'allowlist';
  const positionList = positions || [];
  const totalPositions = positionList.length;
  const allCandidates = candidates || [];
  const selectedCandidateCount = Object.values(selections).reduce((total, ids) => total + ids.length, 0);
  const heroImageUrl = (election as any).heroImageUrl || election.coverImageUrl;
  const orgId = (election as any).orgId;
  const orgPublicUrl = orgId ? `/organizations/${orgId}/public` : null;

  // Payment helpers
  const pricePerVote = Number(election.paymentAmount || 0);
  const feeRequired = Boolean(election.requiresPayment && pricePerVote > 0);
  const feeCur = election.currency || 'XAF';
  const formatMoney = (amount: number | string | null | undefined) =>
    formatCurrency(amount, feeCur, i18n.language.startsWith("fr") ? "fr-FR" : "en-US");
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

  // Build a quick lookup: candidateId → vote percentage from live results
  const percentageMap: Record<number, string> = {};
  if (liveResults?.totalVotes && liveResults.totalVotes > 0 && liveResults.positions) {
    for (const pos of liveResults.positions) {
      for (const c of pos.candidates) {
        percentageMap[c.candidateId] = ((c.voteCount / liveResults.totalVotes) * 100).toFixed(1);
      }
    }
  }
  const hasLiveData = Object.keys(percentageMap).length > 0;

  // ── Guards ────────────────────────────────────────────────────────────────

  if (election.status === 'draft') {
    const orgId = (election as any).orgId;
    const orgLogoUrl = (election as any).organizationLogoUrl;
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl">
          <AlertCircle className="h-14 w-14 text-muted-foreground/30 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">Polls Not Yet Open</h1>
          <p className="text-xl text-muted-foreground font-light mb-8">This election is in draft mode and has not opened for voting.</p>
          {election.organizationName && (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground/70 border border-border/50 rounded-full px-4 py-1.5">
              {orgLogoUrl
                ? <img src={orgLogoUrl} alt={election.organizationName} className="w-4 h-4 rounded-full object-cover shrink-0" />
                : <Building2 className="h-3.5 w-3.5 shrink-0" />}
              {orgId
                ? <Link href={`/organizations/${orgId}/public`} className="hover:text-foreground transition-colors">{election.organizationName}</Link>
                : <span>{election.organizationName}</span>}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (lifecycleState === 'upcoming') {
    const orgId = (election as any).orgId;
    const orgLogoUrl = (election as any).organizationLogoUrl;
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl">
          <Clock className="h-14 w-14 text-muted-foreground/30 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">Voting Opens Soon</h1>
          <p className="text-xl text-muted-foreground font-light mb-8">
            Voting opens {election.startsAt ? format(new Date(election.startsAt), "MMMM d, yyyy 'at' h:mm a") : "soon"}.
          </p>
          {election.organizationName && (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground/70 border border-border/50 rounded-full px-4 py-1.5">
              {orgLogoUrl
                ? <img src={orgLogoUrl} alt={election.organizationName} className="w-4 h-4 rounded-full object-cover shrink-0" />
                : <Building2 className="h-3.5 w-3.5 shrink-0" />}
              {orgId
                ? <Link href={`/organizations/${orgId}/public`} className="hover:text-foreground transition-colors">{election.organizationName}</Link>
                : <span>{election.organizationName}</span>}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (election.status === 'ended' || lifecycleState === 'ended') {
    const orgId = (election as any).orgId;
    const orgLogoUrl = (election as any).organizationLogoUrl;
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl">
          <FileSignature className="h-14 w-14 text-muted-foreground/30 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">Polls Have Closed</h1>
          <p className="text-xl text-muted-foreground font-light mb-8">Voting for this election has concluded.</p>
          {election.organizationName && (
            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2.5">Administered by</p>
              {orgId ? (
                <Link
                  href={`/organizations/${orgId}/public`}
                  className="inline-flex items-center gap-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border border-border/60 rounded-sm px-4 py-2 hover:border-border"
                >
                  {orgLogoUrl
                    ? <img src={orgLogoUrl} alt={election.organizationName} className="w-5 h-5 rounded object-cover shrink-0" />
                    : <Building2 className="h-4 w-4 shrink-0" />}
                  {election.organizationName}
                  <ExternalLink className="h-3 w-3 opacity-40" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2.5 text-sm font-medium text-muted-foreground border border-border/60 rounded-sm px-4 py-2">
                  {orgLogoUrl
                    ? <img src={orgLogoUrl} alt={election.organizationName} className="w-5 h-5 rounded object-cover shrink-0" />
                    : <Building2 className="h-4 w-4 shrink-0" />}
                  {election.organizationName}
                </span>
              )}
            </div>
          )}
          <Button asChild variant="outline" className="h-12 px-8 rounded-sm">
            <Link href={`/elections/${electionId}/results`}>View Official Results <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </Layout>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────

  if (step === 'success') {
    const submittedAt = format(new Date(), "MMMM d, yyyy 'at' h:mm a");
    const voteSelections = positionList.map(pos => ({
      position: pos.title,
      candidates: allCandidates.filter(c => (selections[pos.id] || []).includes(c.id)),
      abstained: (selections[pos.id] || []).length === 0,
    }));
    const anySelections = voteSelections.some(v => !v.abstained);

    return (
      <Layout>
        <div className="min-h-[85vh] flex items-center justify-center bg-gradient-to-b from-background to-muted/20" style={primaryStyle}>
          <div className="container mx-auto px-4 py-20 text-center max-w-2xl animate-in zoom-in-95 fade-in duration-700">

            {/* Animated success icon */}
            <div className="relative inline-flex mb-10 justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/10" style={{ animationDuration: '2.5s' }} />
              <div className="w-28 h-28 rounded-full border-4 border-primary/20 bg-primary/5 flex items-center justify-center relative">
                <div className="w-20 h-20 rounded-full border-2 border-primary/30 bg-primary/8 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-primary animate-in zoom-in-50 duration-500" />
                </div>
              </div>
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-4 bg-primary/8 border border-primary/20 px-4 py-2 rounded-full">
              <ShieldCheck className="h-3.5 w-3.5" /> Ballot Officially Recorded
            </div>

            <h1 className="text-5xl md:text-6xl font-serif font-bold mb-4 tracking-tight">Your Vote Is Cast</h1>

            <p className="text-xl text-muted-foreground font-light leading-relaxed mb-2">
              Submitted to{' '}
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground align-middle">
                {(election as any).organizationLogoUrl && (
                  <img
                    src={(election as any).organizationLogoUrl}
                    alt={election.organizationName || ''}
                    className="w-5 h-5 rounded object-cover border border-primary/20 inline-block align-middle"
                  />
                )}
                {orgPublicUrl
                  ? <Link href={orgPublicUrl} className="hover:text-primary transition-colors">{election.organizationName}</Link>
                  : (election.organizationName || 'this election')
                }
              </span>{' '}
              on {submittedAt}.
            </p>

            {/* Security assurance */}
            <div className="inline-flex items-center gap-3 text-sm font-medium text-muted-foreground bg-muted/60 border border-border/60 px-5 py-3 rounded-sm mb-10 mt-4">
              <Lock className="h-4 w-4 text-primary shrink-0" />
              Cryptographically sealed · Anonymous · Immutable
            </div>

            {/* Vote summary */}
            {anySelections && (
              <div className="bg-card border-2 border-border rounded-sm shadow-lg overflow-hidden text-left mb-10">
                <div className="bg-foreground/5 px-6 py-4 border-b border-border/60 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Your Ballot</span>
                </div>
                <div className="divide-y divide-border/40">
                  {voteSelections.map(({ position, candidates: voted, abstained }) => (
                    <div key={position} className="flex items-center justify-between px-6 py-4 gap-4">
                      <span className="text-sm text-muted-foreground shrink-0 truncate max-w-[140px]">{position}</span>
                      {abstained ? (
                        <span className="text-sm text-muted-foreground/50 italic">Abstained</span>
                      ) : (
                        <div className="flex items-center gap-2 justify-end flex-wrap">
                          {voted.map(c => (
                            <div key={c.id} className="flex items-center gap-2">
                              {c.photoUrl ? (
                                <img src={c.photoUrl} alt={c.name} className="w-7 h-7 rounded-sm object-cover object-top border border-primary/20 shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded-sm bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                                  <span className="font-serif font-bold text-xs text-primary">{c.name.charAt(0)}</span>
                                </div>
                              )}
                              <span className="font-serif font-bold text-sm text-primary">{c.name}</span>
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="outline" size="lg" className="h-12 px-8 rounded-sm">
                <Link href={`/elections/${electionId}/results`}>
                  View Live Results <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <ShareButton
                url={`${window.location.origin}/elections/${electionId}/results`}
                title={`${election.title} — Results`}
                description={`I just voted in ${election.title}. See the live results.`}
                ctaLabel="Share Results"
              />
            </div>

            {/* Sparkle accent */}
            <p className="text-xs text-muted-foreground/50 mt-10 flex items-center justify-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Powered by ROBLYNE — Organized Participation
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Payment gate ──────────────────────────────────────────────────────────

  if (step === 'payment') {
    const handlePayment = () => {
      if (lifecycleState !== "live") {
        setStep("review");
        toast({ title: "Voting has ended", description: "The ballot deadline passed before payment completed.", variant: "destructive" });
        return;
      }
      if (paymentId !== null) return;
      setPaymentProcessing(true);
      submitBallot();
    };

    return (
      <Layout>
        <div className="relative bg-[#0A1628] text-white overflow-hidden" style={primaryStyle}>
          <PublicHeroBackdrop imageUrl={heroImageUrl} />
          <div className="relative z-10 container mx-auto px-4 pt-16 pb-12 max-w-xl text-center animate-in fade-in duration-500">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3">{t("voting.participationSummary")}</p>
            <div className="text-6xl md:text-7xl font-serif font-bold text-white mb-2 tracking-tight">
              {formatMoney(amountToPay)}
            </div>
            <p className="text-white/50 font-light">{feeCur} · {totalVoteUnits} {totalVoteUnits === 1 ? t("voting.vote") : t("voting.votes")}</p>
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
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("voting.paymentDetails")}</p>
            {paymentMode === 'amount_first' ? (
              <div className="space-y-2">
                 <Label htmlFor="payment-amount">{t("voting.amountToPay", { currency: feeCur })}</Label>
                <Input id="payment-amount" type="number" min="0" step="1" value={paymentAmountInput} onChange={e => setPaymentAmountInput(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="vote-quantity">Votes per selected candidate</Label>
                <Input id="vote-quantity" type="number" min="1" step="1" value={voteQuantity} onChange={e => setVoteQuantity(Math.max(1, parseInt(e.target.value || '1', 10)))} />
              </div>
            )}
            <div className="space-y-3 pt-2">
              <Label htmlFor="payment-customer-name">Full name</Label>
              <Input
                id="payment-customer-name"
                value={paymentCustomerName}
                onChange={e => setPaymentCustomerName(e.target.value)}
                placeholder="Your full name"
                disabled={paymentProcessing}
              />
              <Label htmlFor="payment-customer-email">Email address</Label>
              <Input
                id="payment-customer-email"
                type="email"
                value={paymentCustomerEmail}
                onChange={e => setPaymentCustomerEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={paymentProcessing}
              />
              <Label htmlFor="payment-customer-phone">Phone number</Label>
              <Input
                id="payment-customer-phone"
                type="tel"
                value={paymentCustomerPhone}
                onChange={e => setPaymentCustomerPhone(e.target.value)}
                placeholder="+237 6XX XXX XXX"
                disabled={paymentProcessing}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
               <div><span className="text-muted-foreground block">{t("voting.pricePerVote")}</span><strong>{formatMoney(pricePerVote)}</strong></div>
               <div><span className="text-muted-foreground block">{t("voting.selectedCandidates")}</span><strong>{selectedCandidateCount}</strong></div>
               <div><span className="text-muted-foreground block">{t("voting.totalVoteUnits")}</span><strong>{totalVoteUnits}</strong></div>
               <div className="col-span-2 pt-3 border-t border-border/40"><span className="text-muted-foreground block">{t("voting.totalPayable")}</span><strong className="text-xl text-primary">{formatMoney(amountToPay)}</strong></div>
            </div>
          </div>

          <div className="bg-muted/30 border border-border/50 rounded-sm p-5 mb-6 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t("voting.yourSelections")}</p>
            {positionList.map(position => {
              const selected = allCandidates.filter(c => (selections[position.id] || []).includes(c.id));
              return (
                <div key={position.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground truncate">{position.title}</span>
                  <span className="font-medium shrink-0">
                     {selected.length === 0 ? <span className="text-muted-foreground/50 italic">{t("voting.abstain")}</span> : selected.map(c => c.name).join(', ')}
                  </span>
                </div>
              );
            })}
          </div>

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
              <Button className="w-full h-14 text-base rounded-sm" onClick={handlePayment} disabled={paymentProcessing || paymentId !== null || !paymentCustomerName || !paymentCustomerEmail || !paymentCustomerPhone}>
                {paymentProcessing || paymentId !== null ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {hasPaid ? "Recording your ballot…" : "Confirming payment…"}</>
                ) : (
                  <><Wallet className="mr-2 h-5 w-5" /> Confirm payment</>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground/50 mt-4">
                {hasPaid
                  ? "Payment succeeded. Waiting for ROBLYNE to seal your ballot…"
                  : "Your vote will be submitted automatically after payment confirmation."}
              </p>
              {checkoutUrl && !hasPaid && (
                <Button asChild variant="outline" className="mt-4 w-full">
                  <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">Open payment checkout</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Landing (Election Identity) ───────────────────────────────────────────

  if (step === 'landing') {
    const showChipNav = totalPositions > 4;

    return (
      <Layout>
        {/* Election hero */}
        <div className="relative bg-[#0A1628] text-white overflow-hidden" style={primaryStyle}>
          <PublicHeroBackdrop imageUrl={heroImageUrl} />
          <div className="relative z-10 container mx-auto px-4 pt-20 pb-16 max-w-4xl text-center animate-in fade-in slide-in-from-bottom-6 duration-700">

            {/* Organization identity — clickable to org public profile */}
            {election.organizationName && (
              orgPublicUrl ? (
                <Link
                  href={orgPublicUrl}
                  className="inline-flex items-center justify-center gap-2 text-white/60 text-xs font-bold uppercase tracking-widest mb-6 hover:text-white/90 transition-colors group"
                >
                  {(election as any).organizationLogoUrl ? (
                    <img
                      src={(election as any).organizationLogoUrl}
                      alt={election.organizationName}
                        className="w-7 h-7 rounded object-cover border border-white/20 group-hover:border-white/50 transition-colors"
                    />
                  ) : (
                    <Building2 className="h-3.5 w-3.5" />
                  )}
                  {election.organizationName}
                  <LinkIcon className="h-3 w-3 opacity-40 group-hover:opacity-80 transition-opacity" />
                </Link>
              ) : (
                <div className="flex items-center justify-center gap-2 text-white/50 text-xs font-bold uppercase tracking-widest mb-6">
                  {(election as any).organizationLogoUrl ? (
                    <img src={(election as any).organizationLogoUrl} alt={election.organizationName} className="w-7 h-7 rounded object-cover border border-white/20" />
                  ) : (
                    <Building2 className="h-3.5 w-3.5" />
                  )}
                  {election.organizationName}
                </div>
              )
            )}

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold tracking-tight leading-tight mb-6 text-white">
              {election.title}
            </h1>

            {election.description && (
              <p className="text-xl text-white/60 font-light max-w-2xl mx-auto mb-6 leading-relaxed">
                {election.description}
              </p>
            )}

            <div className="flex justify-center mb-6">
              <ShareButton
                url={shareUrl}
                title={election.title}
                description={election.description || `Vote in ${election.title}`}
                className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:border-white/50 hover:text-white rounded-sm"
              />
            </div>

            {/* Shared timing context also appears on the public results page. */}
            <div className="mb-10">
              <ElectionCountdown lifecycleState={lifecycleState} countdown={countdown} />
            </div>

            {/* Dates */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-white/40 text-sm mb-4">
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

            {/* Results discovery link — shown during active voting when there are votes */}
            {election.status === 'active' && hasLiveData && (
              <div className="mt-2 mb-2">
                <Link
                  href={`/elections/${electionId}/results`}
                  className="inline-flex items-center gap-1.5 text-white/50 hover:text-white/80 text-xs font-medium transition-colors border border-white/20 hover:border-white/40 rounded-sm px-3 py-1.5"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  View current standings
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Sticky position chip nav — shown when there are many positions */}
        {showChipNav && totalPositions > 0 && (
          <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-sm border-b border-border/60 shadow-sm">
            <div className="container mx-auto px-4 max-w-3xl">
              <div className="flex items-center gap-2 overflow-x-auto py-2.5 scrollbar-none no-scrollbar">
                {positionList.map((position, idx) => (
                  <button
                    key={position.id}
                    onClick={() => {
                      positionRefs.current[position.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border/60 text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all whitespace-nowrap"
                  >
                    <span className="text-[10px] font-bold text-muted-foreground/50 tabular-nums">{idx + 1}</span>
                    {position.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Candidates by position */}
        {totalPositions > 0 && (
          <div className="border-b border-border/50 bg-muted/20">
            <div className="container mx-auto px-4 py-12 max-w-3xl">
              {/* Section header with display controls */}
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <VoteIcon className="h-5 w-5 text-primary shrink-0" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Candidates &middot; {totalPositions} {totalPositions === 1 ? 'Position' : 'Positions'}
                </h2>
                <div className="ml-auto flex items-center gap-1.5">
                  {/* Candidate numbering toggle */}
                  <button
                    onClick={() => setShowNumbers(v => !v)}
                    title={showNumbers ? 'Hide numbering' : 'Show numbering'}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm border text-xs font-bold transition-all ${
                      showNumbers
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-primary'
                    }`}
                  >
                    <Hash className="h-3 w-3" />
                  </button>
                  {/* Layout toggle */}
                  <button
                    onClick={() => setLayoutMode('list')}
                    title="List view"
                    className={`inline-flex items-center px-2.5 py-1.5 rounded-sm border text-xs font-bold transition-all ${
                      layoutMode === 'list'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-primary'
                    }`}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setLayoutMode('grid')}
                    title="Grid view"
                    className={`inline-flex items-center px-2.5 py-1.5 rounded-sm border text-xs font-bold transition-all ${
                      layoutMode === 'grid'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-primary'
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-8 pl-8">
                View individual candidates, or cast a full ballot across all positions below.
              </p>

              <div className="space-y-10">
                {positionList.map((position, idx) => {
                  const posCandidates = allCandidates.filter(c => c.positionId === position.id);
                  return (
                    <div
                      key={position.id}
                      ref={el => { positionRefs.current[position.id] = el; }}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-6 h-6 rounded-sm bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <span className="font-serif font-bold text-xs">{idx + 1}</span>
                        </div>
                        <h3 className="font-serif font-bold text-lg">{position.title}</h3>
                        {position.maxSelections > 1 && (
                          <Badge variant="outline" className="text-xs ml-auto shrink-0">Select up to {position.maxSelections}</Badge>
                        )}
                      </div>

                      {layoutMode === 'list' ? (
                        /* ── List layout ── */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-9">
                          {posCandidates.map((candidate, ci) => (
                            <Link
                              key={candidate.id}
                              href={`/elections/${electionId}/vote?positionId=${position.id}&candidateId=${candidate.id}`}
                              className="flex items-center gap-3 bg-card border border-border/50 rounded-sm px-4 py-3 hover:border-primary/40 hover:bg-primary/5 transition-all group cursor-pointer"
                            >
                              {showNumbers && (
                                <span className="text-[10px] font-bold text-muted-foreground/50 tabular-nums shrink-0 w-5 text-center">#{ci + 1}</span>
                              )}
                              {candidate.photoUrl ? (
                                <img src={candidate.photoUrl} alt={candidate.name} className="w-8 h-8 rounded-sm object-cover object-top border border-border/30 shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center border border-border/30 shrink-0">
                                  <span className="font-serif font-bold text-xs text-muted-foreground">{candidate.name.charAt(0)}</span>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-serif font-bold text-sm truncate group-hover:text-primary transition-colors">{candidate.name}</p>
                                {hasLiveData && percentageMap[candidate.id] !== undefined && (
                                  <p className="text-[10px] text-muted-foreground/60 font-medium tabular-nums">{percentageMap[candidate.id]}% of votes</p>
                                )}
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 shrink-0 transition-colors" />
                            </Link>
                          ))}
                          {posCandidates.length === 0 && (
                            <p className="text-sm text-muted-foreground italic col-span-2">No candidates yet</p>
                          )}
                        </div>
                      ) : (
                        /* ── Grid layout ── */
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pl-9">
                          {posCandidates.map((candidate, ci) => (
                            <Link
                              key={candidate.id}
                              href={`/elections/${electionId}/vote?positionId=${position.id}&candidateId=${candidate.id}`}
                              className="group flex flex-col bg-card border border-border/50 rounded-sm overflow-hidden hover:border-primary/40 hover:shadow-md transition-all"
                            >
                              {/* Photo */}
                              <div className="aspect-[3/4] bg-muted relative overflow-hidden">
                                {candidate.photoUrl ? (
                                  <img
                                    src={candidate.photoUrl}
                                    alt={candidate.name}
                                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/70">
                                    <span className="font-serif font-bold text-4xl text-muted-foreground/30">{candidate.name.charAt(0)}</span>
                                  </div>
                                )}
                                {showNumbers && (
                                  <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-sm border border-border/40 tabular-nums">
                                    #{ci + 1}
                                  </div>
                                )}
                                {hasLiveData && percentageMap[candidate.id] !== undefined && (
                                  <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm text-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-sm border border-border/40 tabular-nums">
                                    {percentageMap[candidate.id]}%
                                  </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
                              </div>
                              {/* Name + CTA */}
                              <div className="p-3 flex-1 flex flex-col gap-2">
                                <p className="font-serif font-bold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">{candidate.name}</p>
                                <div className="mt-auto pt-1 flex items-center gap-1 text-[10px] font-bold text-primary/70 group-hover:text-primary transition-colors uppercase tracking-wider">
                                  <VoteIcon className="h-3 w-3" /> Vote
                                </div>
                              </div>
                            </Link>
                          ))}
                          {posCandidates.length === 0 && (
                            <p className="text-sm text-muted-foreground italic col-span-4">No candidates yet</p>
                          )}
                        </div>
                      )}
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
                {election.visibility === 'public' ? 'This is a public election' :
                 election.visibility === 'private' ? 'This is a private election' :
                 'This is an invite-only election'} managed by{' '}
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
                    <Input id="invite-code" placeholder="Enter the code provided by the organizer" value={inviteCode} onChange={e => setInviteCode(e.target.value)} className="font-mono h-12 text-base rounded-sm" />
                  </div>
                )}
                {needsVoterEmail && (
                  <div className="space-y-2">
                    <Label htmlFor="voter-email" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" /> Registered Email
                    </Label>
                    <Input id="voter-email" type="email" placeholder="your@email.com" value={voterEmail} onChange={e => setVoterEmail(e.target.value)} className="h-12 text-base rounded-sm" />
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
                disabled={(needsInviteCode && !inviteCode.trim()) || (needsVoterEmail && !voterEmail.trim())}
                onClick={() => setStep(0)}
              >
                <VoteIcon className="mr-3 h-5 w-5" /> Cast Full Ballot <ArrowRight className="ml-3 h-5 w-5" />
              </Button>
              <p className="text-sm text-muted-foreground">
                Vote through all {totalPositions} {totalPositions === 1 ? 'position' : 'positions'} — each selected candidate counts as a separate vote.
              </p>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ── Ballot: position-by-position wizard ───────────────────────────────────

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
        {/* Sticky ballot progress header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60 shadow-sm" style={primaryStyle}>
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="py-3 flex items-center gap-4">
              <span className="text-xs font-bold text-muted-foreground hidden sm:block truncate">{election.title}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-700 ease-out" style={{ width: `${progressPct}%` }} />
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

        {/* Ballot content — extra bottom padding for the sticky nav bar */}
        <div className="container mx-auto px-4 pt-14 pb-36 max-w-4xl">
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
              for this position.
              {position.maxSelections === 1 && currentSelections.length === 1 && (
                <span className="text-muted-foreground/60"> Selecting another will replace your current choice.</span>
              )}
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
                const pct = percentageMap[candidate.id];
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
                        {showNumbers && (
                          <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-sm border border-border/40 tabular-nums">
                            #{idx + 1}
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
                              {showNumbers && (
                                <span className="text-xs font-bold text-muted-foreground/50 tabular-nums">#{idx + 1}</span>
                              )}
                              {isSelected && (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                                </div>
                              )}
                              {hasLiveData && pct !== undefined && (
                                <span className="text-xs text-muted-foreground/60 font-medium tabular-nums">{pct}% of votes</span>
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
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Platform</p>
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

          {/* Optional early submit */}
          {!isLast && hasAnySelection && (
            <div className="text-center pt-10 mt-6">
              <button
                className="text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
                onClick={() => setStep('review')}
              >
                Skip remaining positions and review my ballot
              </button>
            </div>
          )}
        </div>

        {/* ── Sticky bottom navigation bar ─────────────────────────────────── */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border/60 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]" style={primaryStyle}>
          <div className="container mx-auto px-4 max-w-4xl py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="lg"
                className="h-11 px-6 rounded-sm shrink-0"
                onClick={() => setStep(step === 0 ? 'landing' : step - 1)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">{step === 0 ? 'Back to Election' : 'Previous'}</span>
                <span className="sm:hidden">Back</span>
              </Button>

              {/* Position quick-jump pills (mobile-friendly) */}
              <div className="flex-1 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1.5 justify-center">
                  {positionList.map((pos, i) => {
                    const sel = (selections[pos.id] || []).length;
                    return (
                      <button
                        key={pos.id}
                        onClick={() => setStep(i)}
                        className={`shrink-0 w-7 h-7 rounded-full text-[10px] font-bold tabular-nums border-2 transition-all
                          ${i === step ? 'bg-primary border-primary text-primary-foreground scale-110' :
                            sel > 0 ? 'border-primary/40 text-primary bg-primary/10' :
                            'border-border/50 text-muted-foreground hover:border-primary/40'}`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                size="lg"
                className="h-11 px-7 shadow-md rounded-sm shrink-0"
                onClick={() => setStep(isLast ? 'review' : step + 1)}
              >
                {isLast ? (
                  <><span className="hidden sm:inline">Review Ballot</span><span className="sm:hidden">Review</span> <ChevronRight className="ml-2 h-5 w-5" /></>
                ) : (
                  <><span className="hidden sm:inline">Next Position</span><span className="sm:hidden">Next</span> <ArrowRight className="ml-2 h-5 w-5" /></>
                )}
              </Button>
            </div>
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

          {/* Official ballot card */}
          <div className="bg-card border-2 border-border rounded-sm shadow-2xl overflow-hidden mb-10">
            <div className="bg-[#0A1628] text-white px-8 py-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.04]" style={{
                backgroundImage: 'repeating-linear-gradient(45deg, currentColor, currentColor 1px, transparent 0, transparent 50%)',
                backgroundSize: '8px 8px',
              }} />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm bg-white/10 flex items-center justify-center border border-white/20">
                    <VoteIcon className="h-5 w-5 text-white/70" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-0.5">Official Ballot</p>
                    <p className="font-serif font-bold text-lg text-white leading-tight">{election.title}</p>
                  </div>
                </div>
                {election.organizationName && (
                  <p className="text-xs text-white/40 hidden sm:block text-right max-w-[140px] leading-tight">{election.organizationName}</p>
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
                      <button onClick={() => setStep(idx)} className="text-xs text-primary hover:underline font-bold shrink-0 mt-1 uppercase tracking-wide">
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

            {feeRequired && !hasPaid && (
              <div className="px-8 py-4 bg-amber-50/60 border-t border-amber-200/40 flex items-center gap-3">
                <Wallet className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-700 font-medium">
                  {t("voting.paymentRequired", { amount: formatMoney(amountToPay), count: totalVoteUnits, votes: totalVoteUnits === 1 ? t("voting.vote") : t("voting.votes") })}
                </p>
              </div>
            )}

            <div className="px-8 py-4 bg-muted/20 border-t border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
              {t("voting.sealedBallot")}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <Button variant="outline" size="lg" className="h-14 px-8 rounded-sm" onClick={() => setStep(totalPositions - 1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> {t("common.back")} to Ballot
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
              {feeRequired && !hasPaid ? t("voting.payAndSubmit", { amount: formatMoney(amountToPay) }) : t("voting.castOfficialVote")}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return null;
}

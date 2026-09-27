import React from 'react';
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useGetCandidate, useGetElection, useListPositions } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/branding/ShareButton";
import { BrandedHero } from "@/components/branding/BrandedHero";
import { Loader2, Vote, Building2, ArrowLeft, User } from "lucide-react";
import { PublicPageLoadingSkeleton } from "@/components/loading/LoadingStates";

export default function CandidateProfile() {
  const [, params] = useRoute("/candidates/:electionId/:candidateId");
  const electionId = params?.electionId ? parseInt(params.electionId, 10) : 0;
  const candidateId = params?.candidateId ? parseInt(params.candidateId, 10) : 0;

  const { data: candidate, isLoading: isCandidateLoading } = useGetCandidate(electionId, candidateId);
  const { data: election, isLoading: isElectionLoading } = useGetElection(electionId);
  const { data: positions } = useListPositions(electionId);

  const position = positions?.find(p => p.id === candidate?.positionId);
  const shareUrl = `${window.location.origin}/candidates/${electionId}/${candidateId}`;

  usePageMeta(candidate && election ? {
    title: position
      ? `${candidate.name} — ${position.title} · ${election.title}`
      : `${candidate.name} — ${election.title}`,
    description: candidate.bio || `Meet ${candidate.name}, a candidate for ${position?.title || 'office'} in ${election.title}. View their profile and platform on Evenum.`,
    image: candidate.photoUrl || null,
    type: "profile",
    url: shareUrl,
  } : null);

  if (isCandidateLoading || isElectionLoading) {
    return (
      <Layout>
        <PublicPageLoadingSkeleton label="Loading candidate profile" />
      </Layout>
    );
  }

  if (!candidate || !election) return null;

  const isActive = election.status === 'active';

  return (
    <Layout>
      <BrandedHero
        title={candidate.name}
        subtitle={position ? `Candidate for ${position.title}` : undefined}
        org={election}
        imageUrl={candidate.photoUrl || (election as any).heroImageUrl || (election as any).coverImageUrl}
        logoUrl={null}
        badge={
          <Badge className="bg-background/20 text-background border-background/30 backdrop-blur-sm text-xs font-bold uppercase tracking-widest">
            {election.title}
          </Badge>
        }
        actions={
          <>
            {isActive && (
              <Button asChild size="lg" className="h-12 px-8 rounded-sm shadow-lg">
                <Link href={`/elections/${electionId}/vote?positionId=${candidate.positionId}&candidateId=${candidateId}`}>
                  <Vote className="mr-2 h-4 w-4" />
                  Cast Your Vote
                </Link>
              </Button>
            )}
            <ShareButton
              url={shareUrl}
              title={candidate.name}
              description={`View ${candidate.name}'s candidate profile for ${election.title}`}
              className="bg-transparent border-background/30 text-background hover:bg-background/10 hover:border-background/50 hover:text-background rounded-sm"
            />
          </>
        }
      />

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <Button variant="ghost" asChild className="-ml-4 text-muted-foreground mb-8">
          <Link href={`/elections/${electionId}/vote`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Election
          </Link>
        </Button>


        <div className="grid gap-10">
          {/* Photo + basic info */}
          <div className="flex items-start gap-6">
            {candidate.photoUrl ? (
              <img
                src={candidate.photoUrl}
                alt={candidate.name}
                className="w-24 h-24 rounded-lg object-cover border border-border shrink-0 shadow-md"
              />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-primary/10 flex items-center justify-center border border-border shrink-0">
                <User className="h-10 w-10 text-primary/60" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-serif font-bold mb-1">{candidate.name}</h2>
              {position && (
                <p className="text-muted-foreground mb-3">
                  Candidate for <span className="font-medium text-foreground">{position.title}</span>
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {(election as any).organizationName && (
                  <Badge variant="outline" className="flex items-center gap-1.5 text-xs">
                    <Building2 className="h-3 w-3" />
                    {(election as any).organizationName}
                  </Badge>
                )}
                <Badge variant={isActive ? 'default' : 'secondary'} className="capitalize text-xs">
                  Election {election.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Bio */}
          {candidate.bio && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">About</h3>
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">{candidate.bio}</p>
            </div>
          )}

          {/* Platform */}
          {candidate.platform && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Platform & Positions</h3>
              <div className="bg-muted/30 rounded-sm border border-border/50 p-6">
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">{candidate.platform}</p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!candidate.bio && !candidate.platform && (
            <div className="text-center py-12 border border-dashed border-border rounded-sm">
              <User className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No additional profile information has been provided.</p>
            </div>
          )}

          {/* Share */}
          <div className="flex items-center gap-3 pt-2 border-t border-border/50">
            <p className="text-sm text-muted-foreground">Share this profile</p>
            <ShareButton url={shareUrl} title={candidate.name} description={`${candidate.name} — ${election.title}`} variant="icon" />
          </div>

          {/* Voting CTA */}
          {isActive && (
            <div className="border border-primary/20 bg-primary/5 rounded-sm p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-serif font-bold text-lg mb-1">Ready to vote?</p>
                <p className="text-sm text-muted-foreground">This election is open. Cast your official ballot now.</p>
              </div>
              <Button asChild size="lg" className="shrink-0 rounded-sm h-12 px-8">
                <Link href={`/elections/${electionId}/vote?positionId=${candidate.positionId}&candidateId=${candidateId}`}>
                  <Vote className="mr-2 h-4 w-4" />
                  Vote Now
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

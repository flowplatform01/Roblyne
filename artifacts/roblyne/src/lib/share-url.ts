import { apiUrl } from "@/lib/api-url";

function absoluteApiUrl(path: string): string {
  return new URL(apiUrl(path), window.location.origin).toString();
}

export function getCampaignShareUrl(campaignId: number): string {
  return absoluteApiUrl(`/api/share/campaigns/${campaignId}`);
}

export function getEventShareUrl(eventId: number): string {
  return absoluteApiUrl(`/api/share/events/${eventId}`);
}

export function getElectionShareUrl(electionId: number, destination: "vote" | "results" = "vote"): string {
  return absoluteApiUrl(`/api/share/elections/${electionId}/${destination}`);
}

export function getCandidateShareUrl(electionId: number, candidateId: number): string {
  return absoluteApiUrl(`/api/share/candidates/${electionId}/${candidateId}`);
}

export function getOrganizationShareUrl(organizationId: number): string {
  return absoluteApiUrl(`/api/share/organizations/${organizationId}`);
}

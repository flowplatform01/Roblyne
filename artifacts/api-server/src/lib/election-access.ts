export function canViewElectionResults(
  visibility: string,
  status: string,
  hasOrganizationAccess: boolean,
): boolean {
  return (visibility === "public" && status !== "draft") || hasOrganizationAccess;
}

export function canReadElection(
  visibility: string,
  status: string,
  hasOrganizationAccess: boolean,
  inviteCodeMatches: boolean,
): boolean {
  if (hasOrganizationAccess) return true;
  if (status === "draft") return false;
  if (visibility === "public") return true;
  return visibility === "invite_only" && inviteCodeMatches;
}

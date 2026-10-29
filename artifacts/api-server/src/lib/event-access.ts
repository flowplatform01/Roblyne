export function canReadEvent(
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

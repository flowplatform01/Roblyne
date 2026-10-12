export function canViewElectionResults(
  visibility: string,
  status: string,
  hasOrganizationAccess: boolean,
): boolean {
  return (visibility === "public" && status !== "draft") || hasOrganizationAccess;
}

export const ELECTION_INVITE_VERIFICATION_TTL_MS = 4 * 60 * 60 * 1000;

export type ElectionInviteVerifications = Record<string, number>;

export function hasElectionInviteVerification(
  verifications: ElectionInviteVerifications | undefined,
  electionId: number,
  now = Date.now(),
): boolean {
  const verifiedAt = verifications?.[String(electionId)];
  return typeof verifiedAt === "number" && verifiedAt > now - ELECTION_INVITE_VERIFICATION_TTL_MS && verifiedAt <= now;
}

export function addElectionInviteVerification(
  verifications: ElectionInviteVerifications | undefined,
  electionId: number,
  now = Date.now(),
): ElectionInviteVerifications {
  const freshEntries = Object.entries(verifications ?? {}).filter(([, verifiedAt]) => (
    typeof verifiedAt === "number" && verifiedAt > now - ELECTION_INVITE_VERIFICATION_TTL_MS && verifiedAt <= now
  ));
  return { ...Object.fromEntries(freshEntries), [String(electionId)]: now };
}

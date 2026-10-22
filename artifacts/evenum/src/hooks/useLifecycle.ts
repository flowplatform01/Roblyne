import { useEffect, useState } from "react";

export type LifecycleState = "upcoming" | "live" | "ended";

export interface CountdownValue {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
  hasTarget: boolean;
  now: number;
}

export function getLifecycleState(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now = Date.now(),
): LifecycleState {
  if (startsAt && Date.parse(startsAt) > now) return "upcoming";
  if (endsAt && Date.parse(endsAt) <= now) return "ended";
  return "live";
}

export function useLifecycleClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const intervalId = window.setInterval(tick, 1000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", tick);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", tick);
    };
  }, []);

  return now;
}

export function getCountdownValue(
  targetDate: string | null | undefined,
  now: number,
): CountdownValue {
  const target = targetDate ? Date.parse(targetDate) : Number.NaN;
  const hasTarget = Number.isFinite(target);
  const diff = hasTarget ? target - now : 0;
  const remaining = Math.max(0, diff);

  return {
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining % 86_400_000) / 3_600_000),
    minutes: Math.floor((remaining % 3_600_000) / 60_000),
    seconds: Math.floor((remaining % 60_000) / 1_000),
    expired: Boolean(targetDate) && (!Number.isFinite(target) || diff <= 0),
    hasTarget,
    now,
  };
}

export function getElectionCountdown(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now = Date.now(),
) {
  const lifecycleState = getLifecycleState(startsAt, endsAt, now);
  const targetDate = lifecycleState === "upcoming"
    ? startsAt
    : lifecycleState === "live"
      ? endsAt
      : undefined;

  return {
    lifecycleState,
    targetDate,
    countdown: getCountdownValue(targetDate, now),
    now,
  };
}

export function useElectionLifecycle(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
) {
  const now = useLifecycleClock();
  return getElectionCountdown(startsAt, endsAt, now);
}

export function useCountdown(targetDate: string | null | undefined): CountdownValue {
  const now = useLifecycleClock();
  return getCountdownValue(targetDate, now);
}
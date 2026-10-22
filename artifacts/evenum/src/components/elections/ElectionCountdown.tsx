import type { CountdownValue, LifecycleState } from "@/hooks/useLifecycle";

interface ElectionCountdownProps {
  lifecycleState: LifecycleState;
  countdown: CountdownValue;
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[54px] flex-col items-center rounded-sm border border-white/20 bg-white/10 px-3 py-3 backdrop-blur-md sm:min-w-[72px] sm:px-5 sm:py-3.5">
      <span className="mb-1 text-2xl font-serif font-bold leading-none tabular-nums text-white sm:text-3xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/55">{label}</span>
    </div>
  );
}

export function ElectionCountdown({ lifecycleState, countdown }: ElectionCountdownProps) {
  if (lifecycleState === "ended") return null;

  const label = lifecycleState === "upcoming" ? "Voting opens in" : "Polls close in";

  return (
    <div className="mx-auto w-fit" role="group" aria-label={countdown.hasTarget ? label : "Election timing"}>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/45">
        {countdown.hasTarget ? label : "Election timing unavailable"}
      </p>
      {countdown.hasTarget && (
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
          <CountdownUnit value={countdown.days} label="Days" />
          <CountdownUnit value={countdown.hours} label="Hours" />
          <CountdownUnit value={countdown.minutes} label="Min" />
          <CountdownUnit value={countdown.seconds} label="Sec" />
        </div>
      )}
    </div>
  );
}

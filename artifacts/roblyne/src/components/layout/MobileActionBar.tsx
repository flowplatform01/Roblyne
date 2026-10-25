import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type MobileActionBarProps = {
  label: string;
  pending?: boolean;
  pendingLabel?: string;
};

export function MobileActionBar({
  label,
  pending = false,
  pendingLabel = "Saving…",
}: MobileActionBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <Button
        type="submit"
        size="lg"
        className="h-11 w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {pending ? pendingLabel : label}
      </Button>
    </div>
  );
}
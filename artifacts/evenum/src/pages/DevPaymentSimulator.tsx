import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetPaymentStatusQueryKey,
  useGetPaymentStatus,
  useSimulateDevelopmentPayment,
} from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SimulatedStatus = "pending" | "processing" | "succeeded" | "failed";
type SimulationOutcome = SimulatedStatus | "cancelled";

export default function DevPaymentSimulator() {
  const queryClient = useQueryClient();
  const [cancelledOutcome, setCancelledOutcome] = useState(false);
  const paymentId = useMemo(() => {
    const segment = window.location.pathname.split("/").filter(Boolean).at(-1);
    return Number(segment);
  }, []);
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const paymentQuery = useGetPaymentStatus(paymentId, {
    query: {
      queryKey: getGetPaymentStatusQueryKey(paymentId),
      enabled: Number.isInteger(paymentId) && paymentId > 0,
      refetchInterval: 1500,
    },
  });
  const simulation = useSimulateDevelopmentPayment({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: paymentQuery.queryKey }),
    },
  });

  const paymentStatus = (paymentQuery.data as any)?.paymentStatus as SimulatedStatus | undefined;
  const terminal = paymentStatus === "succeeded" || paymentStatus === "failed";

  const setStatus = (status: SimulationOutcome) => {
    setCancelledOutcome(status === "cancelled");
    simulation.mutate({ paymentId, data: { token, status } });
  };
  const displayedStatus = cancelledOutcome && paymentStatus === "failed" ? "cancelled" : paymentStatus;

  return (
    <Layout>
      <main className="container mx-auto flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <Badge variant="outline" className="mb-3 w-fit gap-2 border-amber-500/40 text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Development only
            </Badge>
            <CardTitle>Simulate payment</CardTitle>
            <CardDescription>
              This test checkout does not contact FlowPay or move real money. Choose an outcome to test the full Evenum payment flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {paymentQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading payment attempt…
              </div>
            ) : paymentQuery.isError ? (
              <p className="text-sm text-destructive">This payment attempt is invalid or no longer available.</p>
            ) : (
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
                {paymentStatus === "succeeded" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  : paymentStatus === "failed" ? <XCircle className="h-4 w-4 text-destructive" />
                    : <Loader2 className="h-4 w-4 text-muted-foreground" />}
                <span>Payment status:</span>
                <strong className="capitalize">{displayedStatus ?? "unknown"}</strong>
              </div>
            )}

            {cancelledOutcome && paymentStatus === "failed" && (
              <p role="status" className="rounded-md border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                Checkout cancellation is processed as a failed payment. No ticket, campaign submission, or vote is recorded.
              </p>
            )}

            {simulation.isError && (
              <p role="alert" className="text-sm text-destructive">
                {simulation.error instanceof Error ? simulation.error.message : "Could not update the simulated payment."}
              </p>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                onClick={() => setStatus("succeeded")}
                disabled={!token || terminal || simulation.isPending || paymentQuery.isError}
              >
                Simulate successful payment
              </Button>
              <Button
                variant="destructive"
                onClick={() => setStatus("failed")}
                disabled={!token || terminal || simulation.isPending || paymentQuery.isError}
              >
                Simulate failed payment
              </Button>
              <Button
                variant="outline"
                onClick={() => setStatus("cancelled")}
                disabled={!token || terminal || simulation.isPending || paymentQuery.isError}
              >
                Simulate cancelled checkout
              </Button>
              <Button
                variant="outline"
                onClick={() => setStatus("processing")}
                disabled={!token || terminal || simulation.isPending || paymentQuery.isError}
              >
                Leave processing
              </Button>
              <Button
                variant="outline"
                onClick={() => setStatus("pending")}
                disabled={!token || terminal || simulation.isPending || paymentQuery.isError}
              >
                Leave pending
              </Button>
            </div>

            {simulation.isPending && (
              <p className="text-center text-xs text-muted-foreground">Updating the payment result…</p>
            )}
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}

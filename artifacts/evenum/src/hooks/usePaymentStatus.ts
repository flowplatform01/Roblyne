import { useGetPaymentStatus } from "@workspace/api-client-react";

export function usePaymentStatus(paymentId: number | null) {
  return useGetPaymentStatus(paymentId ?? 0, {
    query: {
      queryKey: ["/api/payments", paymentId],
      enabled: paymentId !== null,
      refetchInterval: paymentId !== null ? 1500 : false,
    },
  });
}
import { useGetPaymentStatus } from "@workspace/api-client-react";

export function usePaymentStatus(paymentId: number | null, statusToken: string | null) {
  return useGetPaymentStatus(paymentId ?? 0, { statusToken: statusToken ?? "" }, {
    query: {
      queryKey: ["/api/payments", paymentId, statusToken],
      enabled: paymentId !== null && statusToken !== null,
      refetchInterval: paymentId !== null ? 1500 : false,
    },
  });
}
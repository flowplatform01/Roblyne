export function formatCurrency(
  amount: number | string | null | undefined,
  currency = "XAF",
  locale = "fr-FR",
): string {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "XAF" ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}
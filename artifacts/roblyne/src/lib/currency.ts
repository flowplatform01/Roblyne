export function normalizeCurrency(currency: unknown, fallback = "XAF"): string {
  const normalized = typeof currency === "string" ? currency.trim().toUpperCase() : "";
  return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: unknown = "XAF",
  locale = "fr-FR",
): string {
  const value = Number(amount ?? 0);
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeCurrency = normalizeCurrency(currency);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(safeValue);
  } catch {
    return `${safeCurrency} ${safeValue.toLocaleString(locale, { maximumFractionDigits: 2 })}`;
  }
}

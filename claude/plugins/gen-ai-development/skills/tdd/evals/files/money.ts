// A tiny money module. All amounts are integer cents.

/** Format integer cents as a "$12.34" / "-$0.05" string. */
export function formatMoney(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error(`formatMoney expects integer cents, got ${cents}`);
  }
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = (abs % 100).toString().padStart(2, "0");
  const sign = negative ? "-" : "";
  return `${sign}$${dollars}.${remainder}`;
}

/** Parse a "$12.34" / "-$0.05" string back into integer cents. */
export function parseMoney(text: string): number {
  const match = /^(-)?\$(\d+)\.(\d{2})$/.exec(text.trim());
  if (!match) {
    throw new Error(`parseMoney cannot parse: ${text}`);
  }
  const sign = match[1] ? -1 : 1;
  const dollars = Number.parseInt(match[2], 10);
  const fraction = Number.parseInt(match[3], 10);
  return sign * (dollars * 100 + fraction);
}

/** Collapse a negative-zero cents value (-0) into a plain 0. */
export function normalizeNegativeZero(cents: number): number {
  return cents === 0 ? 0 : cents;
}

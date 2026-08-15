const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCents(cents: number): string {
  return money.format(cents / 100);
}

export function photoUrl(file: string | null): string | null {
  return file ? `/api/photos/${file}` : null;
}
export const MAX_SHOWCASE_ITEMS = 3;
export const SHOWCASE_TYPE_LABELS = { product: "Produto", service: "Serviço", other: "Outra solução" };

export function normalizeShowcasePrice(value?: string | null) {
  const price = value?.trim();
  if (!price) return null;
  return price.includes(",") ? price.replace(/\./g, "").replace(",", ".") : price;
}

export function formatShowcasePrice(value?: string | null) {
  const price = normalizeShowcasePrice(value);
  if (price === null) return null;
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

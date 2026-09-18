import type { Locator } from 'playwright';

const PRICE_RANGE_PATTERN = /[¥￥]\s*\d+(?:\.\d+)?\s*[-~—－]\s*[¥￥]?\s*\d+(?:\.\d+)?/;
export type ProductSelectionMode = 'nonSelfOperated' | 'selfOperated';

export function findPriceRange(text: string) {
  return text.replace(/\s+/g, ' ').match(PRICE_RANGE_PATTERN)?.[0] ?? null;
}

export function isPriceRange(text: string) {
  return findPriceRange(text) !== null;
}

export function isSelfOperatedProduct(text: string) {
  return text.includes('自营品');
}

export function shouldSelectProductRow(text: string, mode: ProductSelectionMode = 'nonSelfOperated') {
  if (isPriceRange(text)) return false;
  return mode === 'selfOperated' ? isSelfOperatedProduct(text) : !isSelfOperatedProduct(text);
}

export async function selectableProductRows(rows: Locator[], mode: ProductSelectionMode = 'nonSelfOperated') {
  const selectable: Locator[] = [];
  for (const row of rows) {
    if (shouldSelectProductRow(await row.innerText().catch(() => ''), mode)) selectable.push(row);
  }
  return selectable;
}

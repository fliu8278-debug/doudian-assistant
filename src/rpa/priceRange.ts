import type { Locator } from 'playwright';

const PRICE_RANGE_PATTERN = /[¥￥]\s*\d+(?:\.\d+)?\s*[-~—－]\s*[¥￥]?\s*\d+(?:\.\d+)?/;

export function findPriceRange(text: string) {
  return text.replace(/\s+/g, ' ').match(PRICE_RANGE_PATTERN)?.[0] ?? null;
}

export async function assertRowsHaveNoPriceRange(rows: Locator[], keyword: string) {
  for (const row of rows) {
    const matched = findPriceRange(await row.innerText().catch(() => ''));
    if (matched) {
      throw new Error(`商品 ${keyword} 是区间价 ${matched}，不建立任务`);
    }
  }
}

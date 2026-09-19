export type SearchAfterViewDraft = {
  shopId: string;
  keywords: string[];
  sku?: string;
};

export function extractSearchAfterViewSku(title: string) {
  return title.match(/(?:^|\s)(\d{6})-\d{1,3}(?:\s|$)/)?.[1] ?? null;
}

export function validateSearchAfterViewKeywords(keywords: string[]) {
  const values = keywords.map((value) => value.trim()).filter(Boolean);
  if (values.length < 1 || values.length > 3) throw new Error('看后搜词需要填写 1 至 3 个');
  return values;
}

import { describe, expect, it } from 'vitest';
import { findPriceRange, isPriceRange, isSelfOperatedProduct, shouldSelectProductRow } from './priceRange';

describe('price range guard', () => {
  it('detects doudian price ranges', () => {
    expect(findPriceRange('商品原价 ¥339 - ¥399 商品库存')).toBe('¥339 - ¥399');
    expect(findPriceRange('商品原价 ￥339-￥399')).toBe('￥339-￥399');
  });

  it('allows single prices', () => {
    expect(findPriceRange('商品原价 ¥339 商品库存')).toBeNull();
  });

  it('marks range-price products for skipping', () => {
    expect(isPriceRange('商品原价 ¥449 - ¥749')).toBe(true);
    expect(isPriceRange('商品原价 ¥449')).toBe(false);
  });

  it('marks self-operated products for skipping', () => {
    expect(isSelfOperatedProduct('商品信息 【国补】男鞋 自营品')).toBe(true);
    expect(isSelfOperatedProduct('商品信息 【国补】男鞋')).toBe(false);
  });

  it('keeps only single-price non-self-operated product links', () => {
    expect(shouldSelectProductRow('商品信息 216704 自营品 ¥269')).toBe(false);
    expect(shouldSelectProductRow('商品信息 237464 ¥449 - ¥749')).toBe(false);
    expect(shouldSelectProductRow('商品信息 216704 ¥269')).toBe(true);
  });
});

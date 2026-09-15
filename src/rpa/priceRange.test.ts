import { describe, expect, it } from 'vitest';
import { findPriceRange } from './priceRange';

describe('price range guard', () => {
  it('detects doudian price ranges', () => {
    expect(findPriceRange('商品原价 ¥339 - ¥399 商品库存')).toBe('¥339 - ¥399');
    expect(findPriceRange('商品原价 ￥339-￥399')).toBe('￥339-￥399');
  });

  it('allows single prices', () => {
    expect(findPriceRange('商品原价 ¥339 商品库存')).toBeNull();
  });
});

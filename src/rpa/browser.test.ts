import { describe, expect, it } from 'vitest';
import { DOUDIAN_PRODUCT_COUPON_CREATE_URL } from './browser';

describe('抖店营销链接', () => {
  it('uses the specified-product coupon creation page', () => {
    expect(DOUDIAN_PRODUCT_COUPON_CREATE_URL).toBe(
      'https://fxg.jinritemai.com/ffa/marketing/coupon/detail?type=1&categorySource=1&scope=part&discount_type=2&from_page=marketing_tool_page_create'
    );
  });
});

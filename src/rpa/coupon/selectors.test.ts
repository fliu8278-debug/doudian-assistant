import { describe, expect, it } from 'vitest';
import { productCouponSelectors } from './selectors';

describe('商品优惠券固定选项', () => {
  it('uses the labels verified on the product coupon page', () => {
    expect(productCouponSelectors).toMatchObject({
      publicPromotion: '全网公开推广',
      validDays: '限制有效天数',
      noAutoRenew: '不开启',
      fullReduction: '满减',
      unlimitedIssue: '不限',
      specifiedProduct: '指定商品（商品券）',
      onlineProductSelection: '在线选择',
      keepNonSelfOperated: '仅保留非自营品',
      submit: 'button.ecom-mcenter-btn.ecom-mcenter-btn-primary'
    });
  });
});

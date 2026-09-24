import { describe, expect, it } from 'vitest';
import { PRODUCT_COUPON_STEP_DELAY_MS } from './productCoupon';

describe('商品优惠券建券节奏', () => {
  it('步骤间隔为 0，依靠各步骤自身的页面校验推进', () => {
    expect(PRODUCT_COUPON_STEP_DELAY_MS).toBe(0);
  });
});

export const fanCouponSelectors = {
  couponName: '#coupon_name',
  startDate: 'input[placeholder="开始日期"]',
  endDate: 'input[placeholder="结束日期"]',
  validPeriod: '#valid_period',
  discountType: '#discountType',
  totalAmountType: '#total_amount_type',
  goodsScope: '#goodsScope',
  productSearch: '#search_value'
} as const;

export const productCouponSelectors = {
  publicPromotion: '全网公开推广',
  validDays: '限制有效天数',
  noAutoRenew: '不开启',
  fullReduction: '满减',
  unlimitedIssue: '不限',
  specifiedProduct: '指定商品（商品券）',
  onlineProductSelection: '在线选择',
  keepNonSelfOperated: '仅保留非自营品',
  submit: 'button.ecom-mcenter-btn.ecom-mcenter-btn-primary'
} as const;

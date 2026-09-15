export type ShopStatus = 'active' | 'need_login' | 'expired';

export type Shop = {
  id: string;
  name: string;
  remark: string;
  platform: 'doudian';
  officialAccountName: string;
  status: ShopStatus;
  current: boolean;
  lastLoginAt: string | null;
  lastSyncedAt: string | null;
  snapshot: ShopSnapshot;
  createdAt: string;
};

export type NewShop = {
  name: string;
  remark: string;
  officialAccountName: string;
};

export type ShopSnapshot = {
  pendingPayment?: string;
  pendingShipment?: string;
  abnormalPackage?: string;
  pendingAfterSale?: string;
  serviceTicket?: string;
  riskPoint?: string;
  violation?: string;
  revenueAmount?: string;
  orderCount?: string;
  spendAmount?: string;
  refundAmount?: string;
  shopRank?: string;
  experienceScore?: string;
};

export type CouponTaskStatus =
  | 'pending'
  | 'running'
  | 'waiting_confirm'
  | 'success'
  | 'failed';

export type CouponBatchStatus =
  | 'pending'
  | 'running'
  | 'waiting_confirm'
  | 'success'
  | 'failed'
  | 'partial';

export type CouponBatchTime = {
  startTime: string;
  endTime: string;
};

export type CouponRow = {
  sku: string;
  couponName: string;
  productSearchKeyword: string;
  startTime: string;
  endTime: string;
  validDays: number;
  thresholdAmount: number;
  discountAmount: number;
  issueAmountType: 'unlimited' | 'limited';
  perUserLimit: 'unlimited' | number;
  goodsScope: 'specified' | 'all';
};

export type CouponTask = CouponRow & {
  id: string;
  batchId: string;
  shopId: string;
  status: CouponTaskStatus;
  errorMessage: string | null;
  screenshotPath: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CouponBatch = {
  id: string;
  shopId: string;
  fileName: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  status: CouponBatchStatus;
  createdAt: string;
  tasks: CouponTask[];
};

export type NewcomerGiftRow = {
  sku: string;
  activityName: string;
  productSearchKeyword: string;
  startTime: string;
  endTime: string;
  discountAmount: number;
};

export type NewcomerGiftTask = NewcomerGiftRow & {
  id: string;
  batchId: string;
  shopId: string;
  status: CouponTaskStatus;
  errorMessage: string | null;
  screenshotPath: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewcomerGiftBatch = {
  id: string;
  shopId: string;
  fileName: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  status: CouponBatchStatus;
  createdAt: string;
  tasks: NewcomerGiftTask[];
};

import { describe, expect, it } from 'vitest';
import { parseDoudianHomeSnapshot } from './shopSnapshot';

describe('shop snapshot parser', () => {
  it('reads current shop metrics from doudian homepage text', () => {
    const result = parseDoudianHomeSnapshot(`
      店铺管理
      商家体验分
      违规管理
      服务工单
      斯凯奇SKECHERS斯凯彻斯运动鞋专卖店
      待支付
      0
      待发货
      0
      异常包裹
      0
      待处理售后
      6
      服务工单
      0
      待整改风险点
      0
      待处理违规
      0
      经营数据
      7日店铺排行
      第
      2,358
      名
      成交金额
      0
      成交订单数
      0
      支出金额
      ¥33.61
      退款金额(支付时间)
      0
      商家体验分
      91
      分
    `);

    expect(result.name).toBe('斯凯奇SKECHERS斯凯彻斯运动鞋专卖店');
    expect(result.snapshot).toMatchObject({
      pendingShipment: '0',
      pendingAfterSale: '6',
      revenueAmount: '0',
      orderCount: '0',
      spendAmount: '¥33.61',
      refundAmount: '0',
      shopRank: '第2,358名',
      experienceScore: '91'
    });
  });

  it('reads compact homepage metric text without taking sidebar labels as values', () => {
    const result = parseDoudianHomeSnapshot(`
      店铺管理账号管理商家体验分违规管理售后售后工作台服务工单
      待支付0待发货0异常包裹0待处理售后6服务工单0待整改风险点0待处理违规0
      经营数据7日店铺排行第2,358名649看看我超过谁
      成交金额0较昨日100.00%成交订单数0较昨日持平支出金额¥33.61构成较昨日81.12%退款金额(支付时间)0较昨日100.00%
      斯凯奇SKECHERS斯凯彻斯运动鞋专卖店添加小二商家体验分91分较昨日持平详情商品80分物流100分服务96分
    `);

    expect(result.name).toBe('斯凯奇SKECHERS斯凯彻斯运动鞋专卖店');
    expect(result.snapshot).toMatchObject({
      serviceTicket: '0',
      pendingAfterSale: '6',
      spendAmount: '¥33.61',
      shopRank: '第2,358名',
      experienceScore: '91'
    });
  });
});

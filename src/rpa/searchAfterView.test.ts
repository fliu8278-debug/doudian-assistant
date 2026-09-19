import { describe, expect, it } from 'vitest';
import {
  chooseSearchAfterViewMainProduct,
  extractSearchAfterViewSku,
  validateSearchAfterViewKeywords
} from './searchAfterView';

describe('看后搜配置输入规则', () => {
  it('从视频标题提取六码款号', () => {
    expect(extractSearchAfterViewSku('黑色网面鞋 232939-45')).toBe('232939');
  });

  it('忽略没有款号的视频标题', () => {
    expect(extractSearchAfterViewSku('这双鞋日常很好搭')).toBeNull();
  });

  it('保留一至三个非空自定义词', () => {
    expect(validateSearchAfterViewKeywords([' 斯凯奇男鞋 ', '一脚蹬鞋'])).toEqual(['斯凯奇男鞋', '一脚蹬鞋']);
  });

  it('拒绝少于一个或多于三个自定义词', () => {
    expect(() => validateSearchAfterViewKeywords([])).toThrow('看后搜词需要填写 1 至 3 个');
    expect(() => validateSearchAfterViewKeywords(['a', 'b', 'c', 'd'])).toThrow('看后搜词需要填写 1 至 3 个');
  });
});

describe('看后搜承接商品规则', () => {
  it('优先将非国补商品设为主推', () => {
    expect(chooseSearchAfterViewMainProduct([
      { id: 'subsidy', title: '【国补】斯凯奇男鞋216704' },
      { id: 'regular', title: '【毒刺】斯凯奇男鞋216704' }
    ])).toBe('regular');
  });

  it('只有国补商品时不强行设置主推', () => {
    expect(chooseSearchAfterViewMainProduct([
      { id: 'subsidy', title: '【国补】斯凯奇男鞋216704' }
    ])).toBeNull();
  });
});

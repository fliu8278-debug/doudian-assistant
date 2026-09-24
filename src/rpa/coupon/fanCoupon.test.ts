import { chromium, type Browser } from 'playwright';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { fillDoudianDateTimeRange } = vi.hoisted(() => ({
  fillDoudianDateTimeRange: vi.fn()
}));

vi.mock('./timePicker', () => ({ fillDoudianDateTimeRange }));

import {
  chooseFormOption,
  fillFanCouponReceiveTime,
  fanCouponSkipResult,
  shouldSelectFanCouponProductRow,
  submitFanCouponProductSearch,
  waitForFanCouponProductRows
} from './fanCoupon';

let browser: Browser | undefined;

afterEach(async () => {
  await browser?.close();
  browser = undefined;
});

describe('涨粉券入口', () => {
  it('自动续期已选不开启且控件禁用时直接继续', async () => {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent('<label class="ecom-mcenter-radio-wrapper ecom-mcenter-radio-wrapper-disabled">' +
      '<input type="radio" checked disabled>不开启</label>');

    await chooseFormOption(page, '自动续期', '不开启');

    expect(await page.locator('input[type="radio"]').isChecked()).toBe(true);
  });
  it('没有可选商品时返回软件内部的已跳过结果', () => {
    expect(fanCouponSkipResult('216704')).toEqual({
      submitted: false,
      skipped: true,
      message: '已跳过款号：216704，没有普通单价商品'
    });
  });
  it('填写领取时间时使用稳定的日期控件，不点击固定页面坐标', async () => {
    const page = {} as import('playwright').Page;

    await fillFanCouponReceiveTime(page, '2026-09-25 00:00:00', '2026-10-01 23:59:59');

    expect(fillDoudianDateTimeRange).toHaveBeenCalledWith(
      page,
      '2026-09-25 00:00:00',
      '2026-10-01 23:59:59'
    );
  });

  it('跳过区间价和国补商品，只保留普通单价商品', () => {
    expect(shouldSelectFanCouponProductRow('216704 ¥269')).toBe(true);
    expect(shouldSelectFanCouponProductRow('216704 ¥269 - ¥299')).toBe(false);
    expect(shouldSelectFanCouponProductRow('商品原价\n¥269\n价格区间：¥269 - ¥299')).toBe(false);
    expect(shouldSelectFanCouponProductRow('216704 【国补】¥269')).toBe(false);
    expect(shouldSelectFanCouponProductRow('216704 国家补贴 ¥269')).toBe(false);
  });

  it('按每条商品文字判断，不依赖国补商品所在行号', () => {
    const rows = [
      '【国补】商品216704 商品ID：3841688501649277214 ¥269',
      '普通商品216704 商品ID：3801264213733802241 ¥269'
    ];

    expect(rows.filter(shouldSelectFanCouponProductRow)).toEqual([rows[1]]);
  });

  it('排除页面明确禁用的商品复选框', () => {
    const rows = [
      { text: '普通商品 商品ID：1 ¥269', enabled: true },
      { text: '普通商品 商品ID：2 ¥269', enabled: false }
    ];

    expect(rows.filter((row) => row.enabled && shouldSelectFanCouponProductRow(row.text)).map((row) => row.text)).toEqual([
      '普通商品 商品ID：1 ¥269'
    ]);
  });

  it('保持当前搜索类型，直接填款号并点击搜索按钮', async () => {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(`
      <button id="search-type">按商品ID搜索</button>
      <input id="search_value" placeholder="请输入商品ID" />
      <button id="search-button" aria-label="搜索">⌕</button>
      <div id="status"></div>
      <script>
        document.querySelector('#search-button').addEventListener('click', () => {
          document.querySelector('#status').textContent = document.querySelector('#search_value').value;
        });
      </script>
    `);
    const search = page.locator('#search_value');
    await search.fill('216704');

    await submitFanCouponProductSearch(search);

    expect(await page.locator('#search-type').innerText()).toBe('按商品ID搜索');
    expect(await page.locator('#status').innerText()).toBe('216704');
  });

  it('输入款号后点击放大镜，不点击输入框里的清除按钮', async () => {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(`
      <div id="search-control">
        <input id="search_value" placeholder="请输入商品ID" />
        <span role="button" aria-label="search">⌕</span>
        <span role="button" aria-label="close-circle">×</span>
      </div>
      <div id="status"></div>
      <script>
        document.querySelector('[aria-label="search"]').addEventListener('click', () => {
          document.querySelector('#status').textContent = document.querySelector('#search_value').value;
        });
        document.querySelector('[aria-label="close-circle"]').addEventListener('click', () => {
          document.querySelector('#search_value').value = '';
        });
      </script>
    `);
    const search = page.locator('#search_value');
    await search.fill('216704');

    await submitFanCouponProductSearch(search);

    expect(await search.inputValue()).toBe('216704');
    expect(await page.locator('#status').innerText()).toBe('216704');
  });

  it('搜索商品后最多等待5秒加载匹配商品行', async () => {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(`
      <div id="rows"></div>
      <script>
        setTimeout(() => {
          document.querySelector('#rows').innerHTML = '<table><tr class="ecom-mcenter-table-row"><td>普通商品 商品ID：3801264213733802241 ¥269 <input type="checkbox" /></td></tr></table>';
        }, 100);
      </script>
    `);

    const rows = await waitForFanCouponProductRows(page);

    expect(await rows.first().innerText()).toContain('商品ID：3801264213733802241');
  });

  it('输入货号后点击搜索按钮提交查询', async () => {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(`
      <input id="search_value" />
      <button id="search-button" aria-label="搜索">⌕</button>
      <div id="status"></div>
      <script>
        document.querySelector('#search-button').addEventListener('click', () => {
          document.querySelector('#status').textContent = document.querySelector('#search_value').value;
        });
      </script>
    `);
    const search = page.locator('#search_value');
    await search.fill('216704');

    await submitFanCouponProductSearch(search);

    expect(await page.locator('#status').innerText()).toBe('216704');
  });
});

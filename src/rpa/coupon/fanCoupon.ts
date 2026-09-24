import type { CouponRow } from '../../shared/types';
import { DOUDIAN_FAN_COUPON_CREATE_URL } from '../browser';
import { openDoudianShopPage } from '../doudianSession';
import type { ShopAuthStorage } from '../../db/shops';
import { fanCouponSelectors } from './selectors';
import type { Locator, Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { shouldSelectProductRow } from '../priceRange';
import { appDataPath } from '../../paths';
import { fillDoudianDateTimeRange } from './timePicker';

export type FanCouponDraft = CouponRow & { shopId: string };
export type SubmitFanCouponOptions = { autoSubmit?: boolean };
export type FanCouponTaskResult = { submitted: boolean; skipped?: boolean; message: string };

const FAN_COUPON_STEP_TIMEOUT_MS = 3_000;
const FAN_COUPON_DIRECT_ENTRY_TIMEOUT_MS = 5_000;
const FAN_COUPON_SEARCH_TIMEOUT_MS = 5_000;

export async function submitFanCouponTask(profile: ShopAuthStorage, draft: FanCouponDraft, options: SubmitFanCouponOptions = {}): Promise<FanCouponTaskResult> {
  const { page } = await openDoudianShopPage(profile, DOUDIAN_FAN_COUPON_CREATE_URL, { headless: false, newPage: true });
  page.setDefaultTimeout(FAN_COUPON_STEP_TIMEOUT_MS);
  try {
    await page.waitForLoadState('domcontentloaded');
    if (await isLoginPage(page)) throw new Error('自动化浏览器未登录：请先在店铺窗口完成登录并保存登录状态');
    await couponNameField(page).waitFor({ state: 'visible', timeout: FAN_COUPON_DIRECT_ENTRY_TIMEOUT_MS });
    await fill(couponNameField(page), draft.couponName);
    await chooseFormOption(page, '涨粉账号', '店铺官方账号');
    await chooseFormOption(page, '使用时间', '限制有效天数');
    await fill(validPeriodField(page), String(draft.validDays));
    await fillReceiveTime(page, draft.startTime, draft.endTime);
    await chooseFormOption(page, '自动续期', '不开启');
    await chooseSelect(page, fanCouponSelectors.discountType, '满减');
    await fillDiscountAmount(page, draft.thresholdAmount, draft.discountAmount);
    await chooseSelect(page, fanCouponSelectors.totalAmountType, '不限');
    await choosePerUserLimit(page);
    await chooseFormOption(page, '商品范围', '指定商品');
    await pickProduct(page, draft.productSearchKeyword || draft.sku);
    await assertCouponDraft(page, draft);
    if (options.autoSubmit === false) return { submitted: false, message: `已填好并停在提交前：${draft.couponName}` };
    await submitCoupon(page);
    await page.close().catch(() => undefined);
    return { submitted: true, message: `已提交涨粉券：${draft.couponName}` };
  } catch (caught) {
    if (caught instanceof FanCouponSkipError) {
      await page.close().catch(() => undefined);
      return fanCouponSkipResult(caught.keyword);
    }
    const path = await saveFailureScreenshot(page, draft.couponName);
    await page.close().catch(() => undefined);
    throw new Error(`${caught instanceof Error ? caught.message : '涨粉券填写失败'}，截图：${path}`);
  }
}

export function fanCouponSkipResult(keyword: string): FanCouponTaskResult {
  return { submitted: false, skipped: true, message: `已跳过款号：${keyword}，没有普通单价商品` };
}

class FanCouponSkipError extends Error {
  constructor(readonly keyword: string) {
    super(`没有普通单价商品：${keyword}`);
  }
}

export async function fillFanCouponReceiveTime(page: Page, startTime: string, endTime: string) {
  await fillDoudianDateTimeRange(page, startTime, endTime);
}

export function shouldSelectFanCouponProductRow(text: string) {
  return shouldSelectProductRow(text) && !/(国补|国家补贴|政府补贴)/.test(text);
}

export async function submitFanCouponProductSearch(search: Locator) {
  const siblingButton = search.locator('xpath=following-sibling::button').last();
  if (await siblingButton.count() && await siblingButton.isVisible().catch(() => false)) {
    await siblingButton.click();
    return;
  }
  const searchButton = search.locator('xpath=..').locator('[role="button"]:not([aria-label="close-circle"])').last();
  if (await searchButton.count()) {
    await searchButton.click();
    return;
  }
  await search.press('Enter');
}

export async function waitForFanCouponProductRows(page: Page) {
  const rows = page
    .locator('tr.ecom-mcenter-table-row:visible')
    .filter({ hasText: /商品ID[：:]/ })
    .filter({ has: page.locator('input[type="checkbox"], [role="checkbox"], [class*="checkbox"], [class*="Checkbox"]') });
  await rows.first().waitFor({ state: 'visible', timeout: FAN_COUPON_SEARCH_TIMEOUT_MS });
  return rows;
}

function couponNameField(page: Page) { return page.locator(`${fanCouponSelectors.couponName}, input[placeholder="请输入优惠券名称"]`).first(); }
function validPeriodField(page: Page) { return page.locator(`${fanCouponSelectors.validPeriod}, input[placeholder="请输入天数"]`).first(); }

async function fill(locator: Locator, value: string) {
  await locator.fill(value).catch(async () => locator.evaluate((input, next) => {
    const field = input as HTMLInputElement;
    field.value = next;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }, value));
}

async function isLoginPage(page: Page) {
  return page.url().includes('/login/') || (await page.title()).includes('登录') || await page.getByText('手机登录', { exact: false }).count() > 0;
}

async function fillReceiveTime(page: Page, startTime: string, endTime: string) {
  await fillFanCouponReceiveTime(page, startTime, endTime);
}

async function chooseSelect(page: Page, selector: string, text: string) {
  const control = page.locator(selector).first();
  if (await control.count()) await control.click();
  await page.getByText(text, { exact: false }).last().click();
}

export async function chooseFormOption(page: Page, fieldLabel: string, optionText: string) {
  const radio = page.locator('label.ecom-mcenter-radio-wrapper').filter({ hasText: optionText }).last();
  if (await radio.count() && await radio.isVisible().catch(() => false)) {
    const input = radio.locator('input[type="radio"]').first();
    if (await input.isChecked().catch(() => false)) return;
    await radio.click();
    await input.check({ force: true });
    if (await input.isChecked().catch(() => false)) return;
    throw new Error(`选项未生效：${optionText}`);
  }
  const field = page.locator(`xpath=//*[contains(normalize-space(.),"${fieldLabel}")]/ancestor::*[contains(@class,"semi-form-field")][1]`);
  if (await field.count()) return field.getByText(optionText, { exact: false }).click();
  await page.getByText(optionText, { exact: false }).last().click();
}

async function fillDiscountAmount(page: Page, threshold: number, discount: number) {
  const fields = page.locator('xpath=//*[contains(normalize-space(.),"满减面额")]/following::input');
  await fill(fields.nth(0), String(threshold));
  await fill(fields.nth(1), String(discount));
}

async function choosePerUserLimit(page: Page) {
  await page.getByText('3张', { exact: true }).last().click();
  await page.getByText('不限', { exact: true }).last().click();
}

async function pickProduct(page: Page, keyword: string) {
  const add = page.locator('button.ecom-mcenter-btn-dashed').filter({ hasText: '添加商品' }).last();
  await add.scrollIntoViewIfNeeded();
  await add.click();
  const search = page.locator('#search_value:visible');
  await search.waitFor({ state: 'visible', timeout: 10_000 });
  await search.fill(keyword);
  if ((await search.inputValue()).trim() !== keyword) throw new Error(`商品搜索框未填入款号：${keyword}`);
  await submitFanCouponProductSearch(search);
  const rows = await (await waitForFanCouponProductRows(page)).all();
  const selectableRows: Locator[] = [];
  for (const row of rows) {
    const checkbox = row.locator('input.ecom-mcenter-checkbox-input').first();
    const selectable = shouldSelectFanCouponProductRow(await row.innerText().catch(() => ''));
    const enabled = await checkbox.isEnabled().catch(() => true);
    if (selectable && enabled) selectableRows.push(row);
  }
  if (!selectableRows.length) throw new FanCouponSkipError(keyword);
  for (const row of selectableRows) await checkProductRow(row);
  await page.getByText('选择', { exact: true }).last().click();
}

async function checkProductRow(row: Locator) {
  const exactInput = row.locator('input.ecom-mcenter-checkbox-input').first();
  if (await exactInput.count()) {
    if (await exactInput.isChecked().catch(() => false)) return;
    await exactInput.check({ force: true });
    if (await exactInput.isChecked().catch(() => false)) return;
    const selectionCell = row.locator('td.ecom-mcenter-table-selection-column').first();
    if (await selectionCell.count()) await selectionCell.click({ force: true });
    if (await exactInput.isChecked().catch(() => false)) return;
    throw new Error('商品复选框点击后仍未选中');
  }
  const selectionCell = row.locator('td.ecom-mcenter-table-selection-column').first();
  if (await selectionCell.count()) return selectionCell.click({ force: true });
  const input = row.locator('input[type="checkbox"]').first();
  if (await input.count()) return input.check({ force: true }).catch(() => input.click({ force: true }));
  const checkbox = row.locator('[role="checkbox"], label[class*="checkbox"], [class*="checkbox"], [class*="Checkbox"]').first();
  if (await checkbox.count()) return checkbox.click({ force: true });
  throw new Error('商品行没有找到复选框');
}

async function assertCouponDraft(page: Page, draft: FanCouponDraft) {
  if ((await couponNameField(page).inputValue()).trim() !== draft.couponName) throw new Error('优惠券名称未生效');
  const fields = page.locator('xpath=//*[contains(normalize-space(.),"满减面额")]/following::input');
  if (Number(await fields.nth(0).inputValue()) !== draft.thresholdAmount || Number(await fields.nth(1).inputValue()) !== draft.discountAmount) throw new Error('满减金额未生效');
}

async function submitCoupon(page: Page) {
  const button = page.locator('button.ecom-mcenter-btn-primary:visible').filter({ hasText: '提交' }).last();
  if (!button) throw new Error('没有找到提交按钮');
  await button.scrollIntoViewIfNeeded();
  await button.click({ force: true });
  if (page.url().includes('/coupon/detail') && await button.isVisible().catch(() => false)) {
    await page.waitForTimeout(500);
    await button.click({ force: true });
  }
  const confirm = page.locator('.semi-modal, .arco-modal, .semi-popover, .arco-popover').getByRole('button', { name: /确认|确定/ }).last();
  await confirm.waitFor({ state: 'visible', timeout: 3_000 }).then(() => confirm.click({ force: true })).catch(() => undefined);
  await Promise.race([
    page.getByText(/成功|创建成功|提交成功/, { exact: false }).first().waitFor({ state: 'visible', timeout: 12_000 }),
    page.waitForURL((url) => !url.href.includes('/coupon/detail'), { timeout: 12_000 })
  ]);
  if (page.url().includes('/coupon/detail')) throw new Error('提交后没有确认成功，已保留页面等待检查');
}

async function saveFailureScreenshot(page: Page, name: string) {
  const dir = appDataPath('screenshots');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `fan-coupon-${name}-failed-${Date.now()}.png`);
  await page.screenshot({ path, fullPage: true }).catch(() => undefined);
  return path;
}

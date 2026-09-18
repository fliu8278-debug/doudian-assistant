import type { CouponRow } from '../../shared/types';
import { DOUDIAN_FAN_COUPON_CREATE_URL } from '../browser';
import { openDoudianShopPage } from '../doudianSession';
import type { ShopAuthStorage } from '../../db/shops';
import { fanCouponSelectors } from './selectors';
import type { Locator, Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { selectableProductRows } from '../priceRange';
import { appDataPath } from '../../paths';

export type FanCouponDraft = CouponRow & { shopId: string };
export type SubmitFanCouponOptions = { autoSubmit?: boolean };

export async function submitFanCouponTask(profile: ShopAuthStorage, draft: FanCouponDraft, options: SubmitFanCouponOptions = {}) {
  const { page } = await openDoudianShopPage(profile, DOUDIAN_FAN_COUPON_CREATE_URL, { headless: false, newPage: true });
  page.setDefaultTimeout(15_000);
  await page.waitForLoadState('domcontentloaded');
  try {
    await couponNameField(page).waitFor({ state: 'visible' });
    if (await isLoginPage(page)) throw new Error('自动化浏览器未登录：请先在店铺窗口完成登录并保存登录状态');
    await fill(couponNameField(page), draft.couponName);
    await chooseFormOption(page, '涨粉账号', '店铺官方账号');
    await fillReceiveTime(page, draft.startTime, draft.endTime);
    await chooseFormOption(page, '使用时间', '限制有效天数');
    await fill(validPeriodField(page), String(draft.validDays));
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
    const path = await saveFailureScreenshot(page, draft.couponName);
    throw new Error(`${caught instanceof Error ? caught.message : '涨粉券填写失败'}，截图：${path}`);
  }
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
  const inputs = page.locator('.arco-picker-range input:visible');
  if ((await inputs.count()) < 2) throw new Error('没有找到领取时间输入框');
  for (const [index, value] of [startTime, endTime].entries()) {
    await inputs.nth(index).click();
    await inputs.nth(index).press('Control+A');
    await inputs.nth(index).type(value, { delay: 8 });
  }
  await inputs.nth(1).press('Enter').catch(() => undefined);
  await page.mouse.click(20, 20);
  await page.waitForTimeout(500);
}

async function chooseSelect(page: Page, selector: string, text: string) {
  const control = page.locator(selector).first();
  if (await control.count()) await control.click();
  await page.getByText(text, { exact: false }).last().click();
}

async function chooseFormOption(page: Page, fieldLabel: string, optionText: string) {
  const checked = page.locator('label').filter({ hasText: optionText }).filter({ has: page.locator('input:checked') }).first();
  if (await checked.count()) return;
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
  await page.getByText('添加商品', { exact: false }).last().click();
  const type = page.getByText('按商品ID搜索', { exact: true }).last();
  if (await type.count()) {
    await type.click();
    await page.getByText('按货号搜索', { exact: true }).last().click();
  }
  const search = page.locator(`${fanCouponSelectors.productSearch}:visible, input[placeholder="请输入商品ID"]:visible, input[placeholder*="货号"]:visible`).last();
  await fill(search, keyword);
  await search.press('Enter');
  const rows = await page.locator('tr, .semi-table-row, .ecom-mcenter-table-row').filter({ hasText: keyword }).all();
  const selectableRows = await selectableProductRows(rows);
  if (!selectableRows.length) throw new Error(`商品搜索无可选结果：${keyword}`);
  for (const row of selectableRows) await checkProductRow(row);
  await page.getByText('选择', { exact: true }).last().click();
  await page.waitForTimeout(800);
}

async function checkProductRow(row: Locator) {
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
  const buttons = await page.getByRole('button', { name: '提交', exact: true }).all();
  const visible = [] as Locator[];
  for (const button of buttons) if (await button.isVisible().catch(() => false)) visible.push(button);
  const button = visible.at(-1);
  if (!button) throw new Error('没有找到提交按钮');
  await button.scrollIntoViewIfNeeded();
  await button.click();
  const confirm = page.locator('.semi-modal, .arco-modal, .semi-popover, .arco-popover').getByRole('button', { name: /确认|确定/ }).last();
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await Promise.race([
    page.getByText(/成功|创建成功|提交成功/, { exact: false }).first().waitFor({ state: 'visible', timeout: 12_000 }),
    page.waitForURL((url) => !url.href.includes('/coupon/detail'), { timeout: 12_000 })
  ]).catch(() => undefined);
  if (page.url().includes('/coupon/detail')) throw new Error('提交后没有确认成功，已保留页面等待检查');
}

async function saveFailureScreenshot(page: Page, name: string) {
  const dir = appDataPath('screenshots');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `fan-coupon-${name}-failed-${Date.now()}.png`);
  await page.screenshot({ path, fullPage: true }).catch(() => undefined);
  return path;
}

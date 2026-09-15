import type { CouponRow } from '../../shared/types';
import { DOUDIAN_FAN_COUPON_CREATE_URL } from '../browser';
import { openDoudianShopPage } from '../doudianSession';
import type { ShopAuthStorage } from '../../db/shops';
import { fanCouponSelectors } from './selectors';
import type { Locator, Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { assertRowsHaveNoPriceRange } from '../priceRange';
import { appDataPath } from '../../paths';

export type FanCouponDraft = CouponRow & {
  shopId: string;
};

export type SubmitFanCouponOptions = {
  autoSubmit?: boolean;
};

export async function submitFanCouponTask(
  profile: ShopAuthStorage,
  draft: FanCouponDraft,
  options: SubmitFanCouponOptions = {}
) {
  const { page } = await openDoudianShopPage(profile, DOUDIAN_FAN_COUPON_CREATE_URL, { headless: false, newPage: true });
  page.setDefaultTimeout(15_000);
  await page.waitForLoadState('domcontentloaded');
  await waitForCouponForm(page);
  if (await isDoudianLoginPage(page)) {
    throw new Error('自动化浏览器未登录：请先在弹出的 Chromium 店铺窗口完成登录并保存登录状态');
  }

  const warmup = await inspectFanCouponCreatePage(page);
  if (!warmup.ready && await isDoudianLoginPage(page)) {
    throw new Error('自动化浏览器未登录：请先在弹出的 Chromium 店铺窗口完成登录并保存登录状态');
  }
  if (!warmup.ready) {
    throw new Error(`涨粉券创建页未就绪：${warmup.missing.join('、')}，当前URL：${page.url()}`);
  }

  try {
    await step('填写优惠券名称', () => fillInput(couponNameField(page), draft.couponName));
    await step('选择涨粉账号', () => chooseFormOption(page, '涨粉账号', '店铺官方账号'));
    await step('填写领取时间', () => fillReceiveTime(page, draft.startTime, draft.endTime));
    await step('选择使用时间', () => chooseFormOption(page, '使用时间', '限制有效天数'));
    await step('填写有效天数', () => fillIfPresent(validPeriodField(page), String(draft.validDays)));
    await step('选择自动续期', () => chooseFormOption(page, '自动续期', '不开启'));
    await step('选择优惠方式', () => chooseSelect(page, fanCouponSelectors.discountType, '满减'));
    await step('填写满减面额', () => fillDiscountAmount(page, draft.thresholdAmount, draft.discountAmount));
    await step('选择券发放量', () => chooseSelect(page, fanCouponSelectors.totalAmountType, '不限'));
    await step('选择每人限领', () => choosePerUserLimit(page));
    await step('选择商品范围', () => chooseFormOption(page, '商品范围', '指定商品'));
    await step('添加指定商品', () => pickProduct(page, draft.productSearchKeyword || draft.sku));
    await step('核对建券数据', () => assertCouponDraft(page, draft));
  } catch (caught) {
    const screenshotPath = await saveFailureScreenshot(page, draft.couponName);
    const message = caught instanceof Error ? caught.message : '建券填写失败';
    throw new Error(`${message}，截图：${screenshotPath}`);
  }

  if (options.autoSubmit === false) {
    return {
      submitted: false,
      message: `已填好并停在提交前：${draft.couponName}`
    };
  }

  await step('提交优惠券', () => submitCoupon(page));
  await page.close().catch(() => undefined);
  return {
    submitted: true,
    message: `已提交优惠券：${draft.couponName}`
  };
}

async function saveFailureScreenshot(page: Page, couponName: string) {
  const dir = appDataPath('screenshots');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `coupon-${couponName}-failed-${Date.now()}.png`);
  await page.screenshot({ path, fullPage: true }).catch(() => undefined);
  return path;
}

async function step(label: string, action: () => Promise<void>) {
  try {
    await action();
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : '未知错误';
    throw new Error(`${label}失败：${message}`);
  }
}

async function isDoudianLoginPage(page: Page) {
  if (page.url().includes('/login/')) return true;
  if ((await page.title()).includes('登录')) return true;
  return await page.getByText('手机登录', { exact: false }).count() > 0;
}

async function waitForCouponForm(page: Page) {
  await couponNameField(page).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
}

async function inspectFanCouponCreatePage(page: Page) {
  const missing: string[] = [];
  if (await couponNameField(page).count() === 0) missing.push('优惠券名称');
  if (await page.locator(fanCouponSelectors.startDate).count() === 0) missing.push('领取开始时间');
  if (await page.locator(fanCouponSelectors.endDate).count() === 0) missing.push('领取结束时间');
  if (await page.getByText('优惠方式', { exact: false }).count() === 0) missing.push('优惠方式');
  if (await page.getByText('商品范围', { exact: false }).count() === 0) missing.push('商品范围');

  return {
    ready: missing.length === 0,
    url: page.url(),
    missing
  };
}

function couponNameField(page: Page) {
  return page.locator(`${fanCouponSelectors.couponName}, input[placeholder="请输入优惠券名称"]`).first();
}

function validPeriodField(page: Page) {
  return page.locator(`${fanCouponSelectors.validPeriod}, input[placeholder="请输入天数"]`).first();
}

async function fillInput(locator: Locator, value: string) {
  await locator.waitFor({ state: 'visible', timeout: 15_000 });
  await locator.fill(value).catch(async () => {
    await locator.evaluate((input, nextValue) => {
      const field = input as HTMLInputElement;
      field.value = nextValue;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  });
}

async function fillIfPresent(locator: Locator, value: string) {
  if (await locator.count()) {
    await fillInput(locator.first(), value);
  }
}

async function fillReceiveTime(page: Page, startTime: string, endTime: string) {
  const start = parseDateTime(startTime);
  const end = parseDateTime(endTime);

  if (await fillRangeInputs(page, startTime, endTime)) return;

  await page.locator('.arco-picker-range input[placeholder="开始日期"]').first().click();
  await clickCalendarDate(page, start);
  await clickCalendarDate(page, end);
  await page.getByText('确定', { exact: true }).last().click();
  await page.waitForTimeout(500);

  const values = await page.locator('.arco-picker-range input:visible').evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value.replace(/\//g, '-'))
  );
  if (values[0] !== startTime || values[1] !== endTime) {
    throw new Error(`领取时间未生效，应为 ${startTime} - ${endTime}，实际为 ${values.join(' - ')}`);
  }
}

async function fillRangeInputs(page: Page, startTime: string, endTime: string) {
  const inputs = page.locator('.arco-picker-range input:visible');
  if ((await inputs.count()) < 2) return false;

  await typeDateTime(inputs.nth(0), startTime);
  await typeDateTime(inputs.nth(1), endTime);
  await inputs.nth(1).press('Enter').catch(() => undefined);
  await page.mouse.click(20, 20).catch(() => undefined);
  await page.waitForTimeout(500);

  const values = await inputs.evaluateAll((rangeInputs) =>
    rangeInputs.map((input) => (input as HTMLInputElement).value.replace(/\//g, '-'))
  );
  if (values[0] === startTime && values[1] === endTime) return true;
  return false;
}

async function typeDateTime(locator: Locator, value: string) {
  await locator.click();
  await locator.press('Control+A');
  await locator.type(value, { delay: 8 });
}

async function clickCalendarDate(page: Page, date: Date) {
  const panel = page
    .locator('.arco-panel-date')
    .filter({ hasText: `${date.getFullYear()}年${date.getMonth() + 1}月` })
    .first();

  await panel
    .locator('.arco-picker-cell-in-view')
    .filter({ hasText: new RegExp(`^${date.getDate()}$`) })
    .first()
    .click();
}

function parseDateTime(value: string) {
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) throw new Error(`时间格式不正确：${value}`);
  return date;
}

async function chooseSelect(page: Page, selector: string, optionText: string) {
  const control = page.locator(selector).first();
  if (await control.count()) {
    await control.click();
    await clickVisibleText(page, optionText);
  } else {
    await chooseText(page, optionText);
  }
}

async function chooseText(page: Page, text: string) {
  await clickVisibleText(page, text).catch(() => undefined);
}

async function chooseFormOption(page: Page, fieldLabel: string, optionText: string) {
  const checkedOption = page.locator('label').filter({ hasText: optionText }).filter({ has: page.locator('input:checked') }).first();
  if (await checkedOption.count()) return;

  const field = page.locator(`xpath=//*[contains(normalize-space(.),"${fieldLabel}")]/ancestor::*[contains(@class,"semi-form-field")][1]`);
  if (await field.count()) {
    await field.getByText(optionText, { exact: false }).click({ timeout: 8_000 });
    return;
  }

  await clickVisibleText(page, optionText);
}

async function clickVisibleText(page: Page, text: string) {
  await page.getByText(text, { exact: false }).last().click({ timeout: 8_000 });
}

async function fillDiscountAmount(page: Page, thresholdAmount: number, discountAmount: number) {
  const fields = page.locator('xpath=//*[contains(normalize-space(.),"满减面额")]/ancestor::*[contains(@class,"semi-form-field")][1]//input');
  if ((await fields.count()) >= 2) {
    await fillInput(fields.nth(0), String(thresholdAmount));
    await fillInput(fields.nth(1), String(discountAmount));
    return;
  }

  const fallback = page.locator('xpath=//*[contains(normalize-space(.),"满减面额")]/following::input');
  await fillInput(fallback.nth(0), String(thresholdAmount));
  await fillInput(fallback.nth(1), String(discountAmount));
}

async function submitCoupon(page: Page) {
  const submitButton = await bottomVisibleButton(page, '提交');
  await submitButton.scrollIntoViewIfNeeded();
  await submitButton.click({ timeout: 8_000 });

  const confirmButton = page
    .locator('.semi-modal, .arco-modal, .semi-popover, .arco-popover')
    .getByRole('button', { name: /确认|确定/ })
    .last();
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click({ timeout: 8_000 });
  }

  await Promise.race([
    page.getByText(/成功|创建成功|提交成功/, { exact: false }).first().waitFor({ state: 'visible', timeout: 12_000 }),
    page.waitForURL((url) => !url.href.includes('/coupon/detail'), { timeout: 12_000 })
  ]).catch(() => undefined);

  const errorText = await page.locator('.semi-toast-content, .semi-notification-notice-content, .arco-message, .arco-notification').last().textContent().catch(() => '');
  if (errorText && /失败|错误|不能为空|请选择|不能|未/.test(errorText)) {
    throw new Error(`提交后页面提示：${errorText.trim()}`);
  }

  const successHint = page.getByText(/成功|创建成功|提交成功/, { exact: false });
  if (await successHint.count()) return;
  if (!page.url().includes('/coupon/detail')) return;
  throw new Error('提交后没有确认成功，已保留页面等待检查');
}

async function assertCouponDraft(page: Page, draft: FanCouponDraft) {
  const couponName = await couponNameField(page).inputValue();
  if (couponName.trim() !== draft.couponName) {
    throw new Error(`优惠券名称不一致，应为 ${draft.couponName}，实际为 ${couponName}`);
  }

  const [threshold, discount] = await readDiscountAmounts(page);
  if (Number(threshold) !== draft.thresholdAmount || Number(discount) !== draft.discountAmount) {
    throw new Error(`满减金额不一致，应为满 ${draft.thresholdAmount} 减 ${draft.discountAmount}，实际为满 ${threshold} 减 ${discount}`);
  }

  const keyword = draft.productSearchKeyword || draft.sku;
  if (await page.getByText(keyword, { exact: false }).count() === 0) {
    throw new Error(`页面未找到已添加商品款号：${keyword}`);
  }
}

async function readDiscountAmounts(page: Page) {
  const fields = page.locator('xpath=//*[contains(normalize-space(.),"满减面额")]/ancestor::*[contains(@class,"semi-form-field")][1]//input');
  if ((await fields.count()) >= 2) {
    return [await fields.nth(0).inputValue(), await fields.nth(1).inputValue()];
  }

  const fallback = page.locator('xpath=//*[contains(normalize-space(.),"满减面额")]/following::input');
  return [await fallback.nth(0).inputValue(), await fallback.nth(1).inputValue()];
}

async function bottomVisibleButton(page: Page, text: string) {
  const buttons = await page.getByRole('button', { name: text, exact: true }).all();
  let bottomButton: Locator | undefined;
  let bottomY = -1;

  for (const button of buttons) {
    if (!await button.isVisible().catch(() => false)) continue;
    const box = await button.boundingBox().catch(() => null);
    if (box && box.y > bottomY) {
      bottomButton = button;
      bottomY = box.y;
    }
  }

  if (!bottomButton) throw new Error(`没有找到可见的${text}按钮`);
  return bottomButton;
}

async function choosePerUserLimit(page: Page) {
  await page.getByText('3张', { exact: true }).last().click();
  await page.getByText('不限', { exact: true }).last().click();
}

async function pickProduct(page: Page, keyword: string) {
  await clickVisibleText(page, '添加商品');
  await page.getByText('添加商品', { exact: true }).last().waitFor({ state: 'visible', timeout: 15_000 });
  await chooseProductSearchType(page);

  const search = page.locator(`${fanCouponSelectors.productSearch}:visible, input[placeholder="请输入商品ID"]:visible, input[placeholder*="货号"]:visible`).last();
  await search.waitFor({ state: 'visible', timeout: 15_000 });
  await fillInput(search, keyword);
  await search.press('Enter');
  const matchingRows = page.locator('tr, .semi-table-row, .ecom-mcenter-table-row').filter({ hasText: keyword });
  await matchingRows.first().waitFor({ state: 'visible', timeout: 15_000 }).catch(async () => {
    const empty = await page.getByText('暂无数据', { exact: false }).count();
    throw new Error(empty ? `商品搜索无结果：${keyword}` : `商品搜索结果未加载：${keyword}`);
  });

  await checkMatchingProductRows(page, keyword, 'tr, .semi-table-row, .ecom-mcenter-table-row');
  await page.getByText('选择', { exact: true }).last().click();
  await page.waitForTimeout(800);
}

async function checkMatchingProductRows(page: Page, keyword: string, rowSelector: string) {
  const rows = await page.locator(rowSelector).filter({ hasText: keyword }).all();
  let checkedCount = 0;

  await assertRowsHaveNoPriceRange(rows, keyword);

  for (const row of rows) {
    await checkProductRow(row);
    checkedCount += 1;
  }

  if (checkedCount === 0) {
    throw new Error(`没有找到可勾选的商品：${keyword}`);
  }
}

async function checkProductRow(row: Locator) {
  const input = row.locator('input[type="checkbox"]').first();
  if (await input.count()) {
    await input.check({ force: true }).catch(async () => input.click({ force: true }));
    return;
  }

  const visibleCheckbox = row
    .locator('[role="checkbox"], label[class*="checkbox"], [class*="checkbox"], [class*="Checkbox"]')
    .first();
  if (await visibleCheckbox.count()) {
    await visibleCheckbox.click({ force: true });
    return;
  }

  throw new Error('商品行没有找到复选框');
}

async function chooseProductSearchType(page: Page) {
  const currentType = page.getByText('按商品ID搜索', { exact: true }).last();
  if (await currentType.count()) {
    await currentType.click();
    await page.getByText('按货号搜索', { exact: true }).last().click();
  }
}

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from 'playwright';
import type { ShopAuthStorage } from '../db/shops';
import { appDataPath } from '../paths';
import { DOUDIAN_NEWCOMER_GIFT_CREATE_URL } from './browser';
import { openDoudianShopPage } from './doudianSession';
import { assertRowsHaveNoPriceRange } from './priceRange';

export type NewcomerGiftDraft = {
  shopId: string;
  activityName: string;
  productSearchKeyword: string;
  startTime: string;
  endTime: string;
  discountAmount: number;
};

export async function submitNewcomerGiftTask(profile: ShopAuthStorage, draft: NewcomerGiftDraft) {
  const { page } = await openDoudianShopPage(profile, DOUDIAN_NEWCOMER_GIFT_CREATE_URL, { headless: false, newPage: true });
  page.setDefaultTimeout(10_000);
  await page.waitForLoadState('domcontentloaded');
  const activityNameInput = activityNameField(page);
  await activityNameInput.waitFor({ state: 'visible', timeout: 15_000 });

  try {
    await step('填写活动名称', () => fillInput(activityNameInput, draft.activityName));
    await step('填写活动时间', () => fillAllowanceTime(page, draft.startTime, draft.endTime));
    await step('固定自动续期不开启', () => chooseRadioGroup(page, '自动续期', '不开启', '#auto_renewal'));
    await step('固定优惠范围为指定商品', () => chooseRadioGroup(page, '优惠范围', '指定商品', '#participate_type'));
    await step('固定浮动面额不开启', () => chooseRadioGroup(page, '浮动面额', '不开启', '#deduction_discount_type'));
    await step('添加指定商品', () => pickAllowanceProduct(page, draft.productSearchKeyword));
    await step('填写优惠金额', () => fillProductDiscount(page, draft.discountAmount));
    await step('核对新人礼金数据', () => assertNewcomerGiftDraft(page, draft));
    await step('提交新人礼金', () => submitNewcomerGift(page));
  } catch (caught) {
    const screenshotPath = await saveFailureScreenshot(page, draft.activityName);
    const message = caught instanceof Error ? caught.message : '新人礼金填写失败';
    throw new Error(`${message}，截图：${screenshotPath}`);
  }

  await closeSubmittedPage(page);
  return {
    submitted: true,
    message: `已提交新人礼金：${draft.activityName}`
  };
}

async function step(label: string, action: () => Promise<void>) {
  try {
    await action();
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : '未知错误';
    throw new Error(`${label}失败：${message}`);
  }
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

function activityNameField(page: Page) {
  return page.locator('#activity_name, input[placeholder="请输入活动名称"]').first();
}

async function fillAllowanceTime(page: Page, startTime: string, endTime: string) {
  const start = parseDateTime(startTime);
  const end = parseDateTime(endTime);

  await page.locator('.arco-picker-range input[placeholder="开始日期"], input[placeholder="开始日期"]').first().click();
  await clickCalendarDate(page, start);
  await clickCalendarDate(page, end);
  await page.getByText('选择时间', { exact: true }).last().click();
  await selectTime(page, 0, start.getHours());
  await selectTime(page, 1, start.getMinutes());
  await selectTime(page, 2, start.getSeconds());
  await selectTime(page, 3, end.getHours());
  await selectTime(page, 4, end.getMinutes());
  await selectTime(page, 5, end.getSeconds());
  await page.getByText('确定', { exact: true }).last().click();
  await page.waitForTimeout(500);

  const values = await page.locator('.arco-picker-range input:visible, input[placeholder="开始日期"]:visible, input[placeholder="结束日期"]:visible').evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value.replace(/\//g, '-'))
  );
  if (values[0] !== startTime || values[1] !== endTime) {
    throw new Error(`活动时间未生效，应为 ${startTime} - ${endTime}，实际为 ${values.join(' - ')}`);
  }
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

async function selectTime(page: Page, columnIndex: number, value: number) {
  const text = String(value).padStart(2, '0');
  await page
    .locator('.arco-timepicker-list')
    .nth(columnIndex)
    .locator('.arco-timepicker-cell')
    .filter({ hasText: new RegExp(`^${text}$`) })
    .first()
    .click();
}

async function chooseRadioGroup(page: Page, fieldLabel: string, optionText: string, selector?: string) {
  const group = selector && await page.locator(selector).count()
    ? page.locator(selector)
    : fieldContainer(page, fieldLabel);
  const checkedOption = group.locator('label').filter({ hasText: optionText }).filter({ has: page.locator('input:checked') }).first();
  if (await checkedOption.count()) return;
  await group.locator('label').filter({ hasText: optionText }).first().click();
}

function fieldContainer(page: Page, fieldLabel: string) {
  return page
    .locator(`xpath=//*[contains(normalize-space(.),"${fieldLabel}")]/ancestor::*[contains(@class,"Form") or contains(@class,"form") or contains(@class,"field") or contains(@class,"item")][1]`)
    .first();
}

async function pickAllowanceProduct(page: Page, keyword: string) {
  await page.getByText('添加商品', { exact: true }).last().click();
  const search = page.locator('.ecom-mcenter-input-tag-input').last();
  await search.waitFor({ state: 'visible', timeout: 15_000 });
  await fillInput(search, keyword);
  await search.press('Enter').catch(() => undefined);
  await page.locator('.index-searchBtn--zzy7W').last().click();
  const matchingRows = page.locator('tr, .ecom-mcenter-table-row').filter({ hasText: keyword });
  await matchingRows.first().waitFor({ state: 'visible', timeout: 15_000 }).catch(async () => {
    const empty = await page.getByText('暂无数据', { exact: false }).count();
    throw new Error(empty ? `商品搜索无结果：${keyword}` : `商品搜索结果未加载：${keyword}`);
  });

  await checkMatchingProductRows(page, keyword, 'tr, .ecom-mcenter-table-row');
  await page.getByText('确定', { exact: true }).last().click();
  await page.waitForTimeout(800);
}

async function checkMatchingProductRows(page: Page, keyword: string, rowSelector: string) {
  const rows = await page.locator(rowSelector).filter({ hasText: keyword }).all();
  let checkedCount = 0;

  await assertRowsHaveNoPriceRange(rows, keyword);

  for (const row of rows) {
    if (await checkProductRow(page, row)) checkedCount += 1;
  }

  if (checkedCount === 0) {
    throw new Error(`没有找到可勾选的商品：${keyword}`);
  }
}

async function checkProductRow(page: Page, row: Locator) {
  if (!await row.isVisible().catch(() => false)) return false;
  if (await isProductRowChecked(row)) return true;

  const input = row.locator('input[type="checkbox"]').first();
  if (await input.count()) {
    await input.check({ force: true }).catch(async () => input.click({ force: true }));
    await page.waitForTimeout(150);
    return isProductRowChecked(row);
  }

  const visibleCheckbox = row
    .locator('[role="checkbox"], label[class*="checkbox"], [class*="checkbox"], [class*="Checkbox"]')
    .first();
  if (await visibleCheckbox.count()) {
    await visibleCheckbox.click({ force: true });
    await page.waitForTimeout(150);
    return isProductRowChecked(row);
  }

  if (await clickRowCheckboxInDom(row)) {
    await page.waitForTimeout(150);
    return isProductRowChecked(row);
  }

  const box = await row.boundingBox();
  if (box) {
    const y = box.y + box.height / 2;
    const xCandidates = [box.x + 24, box.x - 22, 88].filter((x) => x > 0);
    for (const x of xCandidates) {
      await page.mouse.click(x, y);
      await page.waitForTimeout(150);
      if (await isProductRowChecked(row)) return true;
    }
  }

  return false;
}

async function clickRowCheckboxInDom(row: Locator) {
  return row.evaluate((rowElement) => {
    const container =
      rowElement.closest('tr,[class*="table-row"],[class*="TableRow"]') ?? rowElement;
    const checkbox = container.querySelector<HTMLElement>(
      'input[type="checkbox"], [role="checkbox"], label[class*="checkbox"], [class*="checkbox"], [class*="Checkbox"]'
    );
    if (!checkbox) return false;
    checkbox.click();
    return true;
  }).catch(() => false);
}

async function isProductRowChecked(row: Locator) {
  return row.evaluate((rowElement) => {
    const container =
      rowElement.closest('tr,[class*="table-row"],[class*="TableRow"]') ?? rowElement;
    const checkedInput = container.querySelector<HTMLInputElement>('input[type="checkbox"]:checked');
    if (checkedInput) return true;

    const checkedBox = container.querySelector<HTMLElement>(
      '[aria-checked="true"], [class*="checkbox"][class*="checked"], [class*="Checkbox"][class*="checked"]'
    );
    return Boolean(checkedBox);
  }).catch(() => false);
}

async function fillProductDiscount(page: Page, discountAmount: number) {
  const inputs = await page.locator('input[placeholder="请输入"]:visible').all();
  if (inputs.length === 0) throw new Error('没有找到商品优惠金额输入框');

  for (const input of inputs) {
    await input.fill(String(discountAmount));
    await input.press('Enter');
  }
  await activityNameField(page).click();
  await page.waitForTimeout(500);

  const bodyText = await page.locator('body').innerText();
  const completed = bodyText.match(/已完成\s*(\d+)\/(\d+)/);
  if (!completed || completed[1] !== completed[2]) {
    throw new Error(`商品优惠金额未完成校验：${completed?.[0] ?? '未找到完成状态'}`);
  }
}

async function assertNewcomerGiftDraft(page: Page, draft: NewcomerGiftDraft) {
  const activityName = await activityNameField(page).inputValue();
  if (activityName.trim() !== draft.activityName) {
    throw new Error(`活动名称不一致，应为 ${draft.activityName}，实际为 ${activityName}`);
  }

  if (await page.getByText(draft.productSearchKeyword, { exact: false }).count() === 0) {
    throw new Error(`页面未找到已添加商品款号：${draft.productSearchKeyword}`);
  }

  const discountInput = page.locator('input[placeholder="请输入"]').last();
  const discountValue = Number(await discountInput.inputValue());
  if (discountValue !== draft.discountAmount) {
    throw new Error(`礼金金额不一致，应为 ${draft.discountAmount}，实际为 ${discountValue}`);
  }
}

async function submitNewcomerGift(page: Page) {
  await clickNewcomerGiftSubmit(page);
  await clickSubmitConfirmIfPresent(page);
  if (await waitForSubmitJump(page)) return;

  if (await shouldRetrySubmit(page)) {
    await clickNewcomerGiftSubmit(page);
    await clickSubmitConfirmIfPresent(page);
    if (await waitForSubmitJump(page)) return;
  }

  const errorText = await page.locator('.semi-toast-content, .semi-notification-notice-content, .arco-message, .arco-notification').last().textContent().catch(() => '');
  if (errorText && /失败|错误|不能为空|请选择|不能|未/.test(errorText)) {
    throw new Error(`提交后页面提示：${errorText.trim()}`);
  }

  throw new Error('提交后没有跳转成功，已保留页面等待检查');
}

async function clickSubmitConfirmIfPresent(page: Page) {
  await page.waitForTimeout(800);
  const confirmButton = page
    .locator('.semi-modal, .arco-modal, .semi-popover, .arco-popover')
    .getByRole('button', { name: /确认|确定/ })
    .last();
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click({ timeout: 8_000 });
  }
}

async function waitForSubmitJump(page: Page) {
  if (!page.url().includes('/allowance/create')) return true;
  await page.waitForURL((url) => !url.href.includes('/allowance/create'), { timeout: 12_000 }).catch(() => undefined);
  return !page.url().includes('/allowance/create');
}

async function closeSubmittedPage(page: Page) {
  if (page.isClosed()) return;
  await page.waitForLoadState('domcontentloaded', { timeout: 3_000 }).catch(() => undefined);
  await page.close({ runBeforeUnload: false }).catch(() => undefined);
}

async function clickNewcomerGiftSubmit(page: Page) {
  const submitButton = await newcomerGiftSubmitButton(page);
  await submitButton.scrollIntoViewIfNeeded();
  const box = await submitButton.boundingBox();
  if (!box) throw new Error('提交按钮不可点击');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function shouldRetrySubmit(page: Page) {
  if (!page.url().includes('/allowance/create')) return false;
  if (await page.getByText(/成功|创建成功|提交成功/, { exact: false }).count()) return false;
  const submitButton = await newcomerGiftSubmitButton(page);
  return submitButton.isVisible().catch(() => false);
}

async function newcomerGiftSubmitButton(page: Page) {
  const footerButton = page
    .locator('div[class*="index-footer"] button.ecom-mcenter-btn-primary')
    .filter({ hasText: /^提交$/ })
    .first();

  if (await footerButton.isVisible().catch(() => false)) return footerButton;
  return bottomVisibleButton(page, '提交');
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

function parseDateTime(value: string) {
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) throw new Error(`时间格式不正确：${value}`);
  return date;
}

async function saveFailureScreenshot(page: Page, activityName: string) {
  const dir = appDataPath('screenshots');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `newcomer-gift-${activityName}-failed-${Date.now()}.png`);
  await page.screenshot({ path, fullPage: true }).catch(() => undefined);
  return path;
}

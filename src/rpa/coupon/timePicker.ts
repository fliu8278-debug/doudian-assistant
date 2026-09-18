import type { Page } from 'playwright';

export type CouponDateTimeRange = {
  startTime: string;
  endTime: string;
};

export type DoudianDateTime = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function parseDoudianDateTime(value: string): DoudianDateTime {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    throw new Error(`时间格式不正确：${value}`);
  }
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) throw new Error(`时间格式不正确：${value}`);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds()
  };
}

export async function fillDoudianDateTimeRange(page: Page, startTime: string, endTime: string) {
  const start = parseDoudianDateTime(startTime);
  const end = parseDoudianDateTime(endTime);

  await page.locator('.arco-picker-range input[placeholder="开始日期"], input[placeholder="开始日期"]').first().click();
  await clickCalendarDate(page, start);
  await clickCalendarDate(page, end);
  await page.getByText('选择时间', { exact: true }).last().click();
  await selectTime(page, 0, start.hours);
  await selectTime(page, 1, start.minutes);
  await selectTime(page, 2, start.seconds);
  await selectTime(page, 3, end.hours);
  await selectTime(page, 4, end.minutes);
  await selectTime(page, 5, end.seconds);
  await page.getByText('确定', { exact: true }).last().click();
  await page.waitForTimeout(500);

  const values = await page.locator('.arco-picker-range input:visible, input[placeholder="开始日期"]:visible, input[placeholder="结束日期"]:visible').evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value.replace(/\//g, '-'))
  );
  if (values[0] !== startTime || values[1] !== endTime) {
    throw new Error(`领取时间未生效，应为 ${startTime} - ${endTime}，实际为 ${values.join(' - ')}`);
  }
}

async function clickCalendarDate(page: Page, date: DoudianDateTime) {
  const panel = page
    .locator('.arco-panel-date')
    .filter({ hasText: `${date.year}年${date.month}月` })
    .first();

  await panel
    .locator('.arco-picker-cell-in-view')
    .filter({ hasText: new RegExp(`^${date.day}$`) })
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

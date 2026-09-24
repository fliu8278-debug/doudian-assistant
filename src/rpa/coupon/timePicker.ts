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

export function calendarMonthOffset(
  from: Pick<DoudianDateTime, 'year' | 'month'>,
  to: Pick<DoudianDateTime, 'year' | 'month'>
) {
  return (to.year - from.year) * 12 + to.month - from.month;
}

function calendarMonthKey(value: Pick<DoudianDateTime, 'year' | 'month'>) {
  return calendarMonthOffset({ year: 0, month: 1 }, value);
}

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
  await page.locator('.arco-picker-btn-select-time:visible').last().click();
  await selectTime(page, 0, start.hours);
  await selectTime(page, 1, start.minutes);
  await selectTime(page, 2, start.seconds);
  await selectTime(page, 3, end.hours);
  await selectTime(page, 4, end.minutes);
  await selectTime(page, 5, end.seconds);
  await page.locator('.arco-picker-btn-confirm:visible').last().click();
  await page.waitForTimeout(500);

  const values = await page.locator('.arco-picker-range input:visible, input[placeholder="开始日期"]:visible, input[placeholder="结束日期"]:visible').evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value.replace(/\//g, '-'))
  );
  if (values[0] !== startTime || values[1] !== endTime) {
    throw new Error(`领取时间未生效，应为 ${startTime} - ${endTime}，实际为 ${values.join(' - ')}`);
  }
}

async function clickCalendarDate(page: Page, date: DoudianDateTime) {
  await moveCalendarToMonth(page, date);
  const panel = page
    .locator('.arco-panel-date:visible')
    .filter({ hasText: `${date.year}年${date.month}月` })
    .first();

  await panel
    .locator('.arco-picker-cell-in-view')
    .filter({ hasText: new RegExp(`^${date.day}$`) })
    .first()
    .click();
}

async function moveCalendarToMonth(page: Page, target: Pick<DoudianDateTime, 'year' | 'month'>) {
  const targetKey = calendarMonthKey(target);

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const panels = page.locator('.arco-panel-date:visible');
    const months = (await panels.allTextContents())
      .map((text) => text.match(/(\d{4})年\s*(\d{1,2})月/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => ({ year: Number(match[1]), month: Number(match[2]) }));

    if (months.some((month) => calendarMonthKey(month) === targetKey)) return;
    if (months.length === 0) throw new Error(`日历月份未加载：${target.year}年${target.month}月`);

    const minKey = Math.min(...months.map(calendarMonthKey));
    const maxKey = Math.max(...months.map(calendarMonthKey));
    const direction = targetKey > maxKey ? 'next' : targetKey < minKey ? 'previous' : undefined;
    if (!direction) throw new Error(`日历无法定位：${target.year}年${target.month}月`);

    const outerPanel = direction === 'next' ? panels.last() : panels.first();
    const monthIcon = direction === 'next' ? 'arco-icon-right' : 'arco-icon-left';
    const button = outerPanel.locator(`.arco-picker-header-icon:has(.${monthIcon})`).first();
    await button.click();
    await page.waitForTimeout(100);
  }

  throw new Error(`日历翻页超出范围：${target.year}年${target.month}月`);
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

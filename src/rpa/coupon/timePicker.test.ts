import { describe, expect, it } from 'vitest';
import { calendarMonthOffset, parseDoudianDateTime } from './timePicker';

describe('抖店时间选择', () => {
  it('splits the imported date time into calendar and clock values', () => {
    expect(parseDoudianDateTime('2026-09-19 10:30:05')).toMatchObject({
      year: 2026,
      month: 9,
      day: 19,
      hours: 10,
      minutes: 30,
      seconds: 5
    });
  });

  it('rejects an invalid imported date time', () => {
    expect(() => parseDoudianDateTime('2026-09-19')).toThrow('时间格式不正确');
  });

  it('calculates how far the calendar must move for a later month', () => {
    expect(calendarMonthOffset({ year: 2026, month: 9 }, { year: 2026, month: 12 })).toBe(3);
  });
});

import { describe, expect, it } from 'vitest';
import { formatAutomationError } from './errorMessage';

describe('自动化失败原因', () => {
  it('turns a Playwright timeout into a Chinese explanation', () => {
    expect(formatAutomationError(new Error('Timeout 3000ms exceeded while waiting for locator')))
      .toBe('页面元素加载超时，请检查网络或页面是否加载完成');
  });

  it('keeps an existing Chinese step explanation', () => {
    expect(formatAutomationError(new Error('填写领取时间失败：时间未生效')))
      .toBe('填写领取时间失败：时间未生效');
  });
});

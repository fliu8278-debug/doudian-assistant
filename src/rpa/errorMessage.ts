export function formatAutomationError(caught: unknown, fallback = '自动化操作失败') {
  const message = caught instanceof Error ? caught.message : String(caught ?? '');
  if (!message.trim()) return fallback;
  if (/[㐀-鿿]/.test(message)) return message;
  if (/timeout|waiting for locator|waiting for selector/i.test(message)) {
    return '页面元素加载超时，请检查网络或页面是否加载完成';
  }
  if (/page.*closed|context.*closed|browser.*closed/i.test(message)) {
    return '浏览器页面已关闭';
  }
  if (/navigation|net::ERR|ERR_/i.test(message)) {
    return '页面跳转失败，请检查网络或登录状态';
  }
  return fallback;
}

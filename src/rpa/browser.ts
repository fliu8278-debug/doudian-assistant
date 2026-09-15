import type { BrowserContext } from 'playwright';
import { readCookieFile, writeCookieFile } from './cookies';

export type BrowserProfile = {
  shopId: string;
  profilePath: string;
  cookiePath: string;
};

export const DOUDIAN_HOME_URL = 'https://fxg.jinritemai.com/ffa/mshop/homepage/index';
export const DOUDIAN_COUPON_HOME_URL = 'https://fxg.jinritemai.com/ffa/marketing/coupon/home';
export const DOUDIAN_FAN_COUPON_CREATE_URL = 'https://fxg.jinritemai.com/ffa/marketing/coupon/detail?type=2&categorySource=4&from_page=marketing_tool_page_create';
export const DOUDIAN_NEWCOMER_GIFT_CREATE_URL = 'https://fxg.jinritemai.com/ffa/marketing/union/allowance/create?activityId=7089387213862994213&from_page=doudian_homepage';

export async function loadShopCookies(context: BrowserContext, profile: BrowserProfile) {
  const cookies = readCookieFile(profile.cookiePath);
  if (cookies.length > 0) {
    await context.addCookies(cookies);
  }
  return cookies.length;
}

export async function saveShopCookies(context: BrowserContext, profile: BrowserProfile) {
  const cookies = await context.cookies();
  writeCookieFile(profile.cookiePath, cookies);
  return cookies.length;
}

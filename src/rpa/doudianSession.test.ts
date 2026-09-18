import { describe, expect, it } from 'vitest';
import { launchShopContext } from './doudianSession';

describe('店铺浏览器启动', () => {
  it('uses a separate runtime profile when the saved profile is occupied', async () => {
    const paths: string[] = [];
    const context = {} as Awaited<ReturnType<typeof launchShopContext>>;
    const launch = async (profilePath: string) => {
      paths.push(profilePath);
      if (paths.length === 1) throw new Error('profile is already in use');
      return context;
    };

    await expect(launchShopContext({
      shopId: 'shop-1',
      profilePath: 'C:/saved-profile',
      cookiePath: 'C:/cookies.json'
    }, false, launch)).resolves.toBe(context);
    expect(paths[0]).toBe('C:/saved-profile');
    expect(paths[1]).toMatch(/[\\/]runtime-profiles[\\/]shop-1$/);
  });
});

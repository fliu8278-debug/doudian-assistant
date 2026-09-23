import { describe, expect, it, vi } from 'vitest';

const { openDoudianShopPage } = vi.hoisted(() => ({
  openDoudianShopPage: vi.fn()
}));

vi.mock('./doudianSession', () => ({ openDoudianShopPage }));

import {
  chooseSearchAfterViewMainProduct,
  closeSearchAfterViewDrawer,
  DOUDIAN_SEARCH_AFTER_VIEW_URL,
  goToNextSearchAfterViewPage,
  runSearchAfterViewAbortable,
  isSearchAfterViewListReady,
  extractSearchAfterViewSku,
  resolveSearchAfterViewTitleSku,
  getSearchAfterViewTaskPage,
  isSearchAfterViewTaskAborted,
  SearchAfterViewTaskAbortedError,
  submitSearchAfterViewTask,
  validateSearchAfterViewKeywords,
  confirmSearchAfterViewKeywords,
  waitBeforeSearchAfterViewConfigure,
  waitForSearchAfterViewProductPicker,
  isSearchAfterViewDrawerMatch,
  isSearchAfterViewVideoRowMatch,
  isSearchAfterViewPageBusy,
  shouldResetSearchAfterViewPagination
} from './searchAfterView';

describe('看后搜配置输入规则', () => {
  it('从视频标题提取六码款号', () => {
    expect(extractSearchAfterViewSku('黑色网面鞋 232939-45')).toBe('232939');
    expect(extractSearchAfterViewSku('宽楦舒适男鞋 232619')).toBe('232619');
  });

  it('忽略没有款号的视频标题', () => {
    expect(extractSearchAfterViewSku('这双鞋日常很好搭')).toBeNull();
  });

  it('只认可设置视频标题中与指定款号一致的六码款号', () => {
    expect(resolveSearchAfterViewTitleSku('白灰卡其新绒厚底系带鞋 232619-01', undefined)).toBe('232619');
    expect(resolveSearchAfterViewTitleSku('白灰卡其232619-01厚底系带鞋', undefined)).toBe('232619');
    expect(resolveSearchAfterViewTitleSku('白灰卡其新绒厚底系带鞋', undefined)).toBeNull();
    expect(resolveSearchAfterViewTitleSku('白灰卡其新绒厚底系带鞋 232619-01', '216704')).toBeNull();
  });

  it('拒绝把旧抽屉商品带到另一个视频', () => {
    expect(isSearchAfterViewDrawerMatch('不爱系带就穿藏青网面一脚蹬 视频观看次数 426', '7678541053254814986', '黑色针织网面配灰白厚底上班赶路 232939-45')).toBe(false);
    expect(isSearchAfterViewDrawerMatch('黑色针织网面配灰白厚底上班赶路 232939-45 视频观看次数 22', '7678541053254814986', '黑色针织网面配灰白厚底上班赶路 232939-45')).toBe(true);
  });

  it('用视频 ID 锁定列表行，不随行号变化错点立即配置', () => {
    expect(isSearchAfterViewVideoRowMatch('短视频 ID 7677566971231178018 待配置', '7677566971231178018')).toBe(true);
    expect(isSearchAfterViewVideoRowMatch('短视频 ID 7681153853005303075 待配置', '7677566971231178018')).toBe(false);
  });

  it('保留一至三个非空自定义词', () => {
    expect(validateSearchAfterViewKeywords([' 斯凯奇男鞋 ', '一脚蹬鞋'])).toEqual(['斯凯奇男鞋', '一脚蹬鞋']);
  });

  it('拒绝少于一个或多于三个自定义词', () => {
    expect(() => validateSearchAfterViewKeywords([])).toThrow('看后搜词需要填写 1 至 3 个');
    expect(() => validateSearchAfterViewKeywords(['a', 'b', 'c', 'd'])).toThrow('看后搜词需要填写 1 至 3 个');
  });
});

describe('看后搜承接商品规则', () => {
  it('初始商品列表出现后即可搜索，不要求复选框先渲染', async () => {
    const filter = vi.fn();
    const rows = {
      filter,
      first: () => ({ isVisible: vi.fn().mockResolvedValue(true) })
    };
    filter.mockReturnValue(rows);
    const productDrawer = { locator: vi.fn(() => rows) };

    await waitForSearchAfterViewProductPicker({ waitForTimeout: vi.fn() } as never, productDrawer as never);

    expect(filter).toHaveBeenCalledTimes(1);
    expect(filter).toHaveBeenCalledWith({ hasText: /ID\s*\d{10,}/ });
  });

  it('优先将非国补商品设为主推', () => {
    expect(chooseSearchAfterViewMainProduct([
      { id: 'subsidy', title: '【国补】斯凯奇男鞋216704' },
      { id: 'regular', title: '【毒刺】斯凯奇男鞋216704' }
    ])).toBe('regular');
  });

  it('只有国补商品时不强行设置主推', () => {
    expect(chooseSearchAfterViewMainProduct([
      { id: 'subsidy', title: '【国补】斯凯奇男鞋216704' }
    ])).toBeNull();
  });
});

describe('看后搜任务暂停', () => {
  it('将中断错误识别为用户暂停，而不是配置失败', () => {
    expect(isSearchAfterViewTaskAborted(new SearchAfterViewTaskAbortedError())).toBe(true);
    expect(isSearchAfterViewTaskAborted(new Error('页面未加载'))).toBe(false);
  });

  it('在提交前等待期间立刻中断任务', async () => {
    const controller = new AbortController();
    const action = new Promise<void>(() => undefined);
    const pending = runSearchAfterViewAbortable(() => action, controller.signal);

    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(SearchAfterViewTaskAbortedError);
  });

  it('暂停时只关闭独立任务页，不关闭店铺当前页面', async () => {
    const controller = new AbortController();
    const close = vi.fn().mockResolvedValue(undefined);
    openDoudianShopPage.mockResolvedValue({
      page: {
        url: () => DOUDIAN_SEARCH_AFTER_VIEW_URL,
        title: async () => {
          controller.abort();
          return '';
        },
        close,
        setDefaultTimeout: vi.fn()
      }
    });

    await expect(submitSearchAfterViewTask({
      shopId: 'shop-1',
      profilePath: 'C:/profile',
      cookiePath: 'C:/cookies.json',
      status: 'active',
      lastCheckedAt: null
    }, {
      shopId: 'shop-1',
      keywords: ['斯凯奇男鞋']
    }, { signal: controller.signal })).rejects.toBeInstanceOf(SearchAfterViewTaskAbortedError);

    expect(openDoudianShopPage).toHaveBeenCalledWith(expect.anything(), DOUDIAN_SEARCH_AFTER_VIEW_URL, {
      headless: false,
      newPage: false
    });
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('看后搜配置节奏', () => {
  it('点击立即配置前等待三秒', async () => {
    const waitForTimeout = vi.fn().mockResolvedValue(undefined);

    await waitBeforeSearchAfterViewConfigure({ waitForTimeout } as never);

    expect(waitForTimeout).toHaveBeenCalledWith(3_000);
  });

  it('词条录入后点击白色看后搜词框内部，确认显示', async () => {
    const click = vi.fn().mockResolvedValue(undefined);
    const keywordBox = {
      boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 200, width: 600, height: 48 }),
      click
    };
    const page = {
      locator: vi.fn((selector: string) => {
        expect(selector).toBe('div.ecom-input-tag:visible');
        return { last: () => keywordBox };
      })
    };

    await confirmSearchAfterViewKeywords(page as never);

    expect(click).toHaveBeenCalledWith({ force: true, position: { x: 300, y: 24 } });
  });
});

describe('看后搜页面返回', () => {
  it('新任务不是第一页时先回到第一页', () => {
    expect(shouldResetSearchAfterViewPagination('1')).toBe(false);
    expect(shouldResetSearchAfterViewPagination('2')).toBe(true);
    expect(shouldResetSearchAfterViewPagination(null)).toBe(true);
  });

  it('抽屉关闭按钮不可用时用 Escape 收起残留遮罩', async () => {
    const press = vi.fn().mockResolvedValue(undefined);
    const page = {
      locator: vi.fn(() => ({ last: () => ({ click: vi.fn().mockRejectedValue(new Error('无关闭按钮')) }) })),
      keyboard: { press }
    };

    await closeSearchAfterViewDrawer(page as never);

    expect(press).toHaveBeenCalledWith('Escape');
  });

  it('翻页前页面加载遮罩仍在时不点击下一页', () => {
    expect(isSearchAfterViewPageBusy(1)).toBe(true);
    expect(isSearchAfterViewPageBusy(0)).toBe(false);
  });

  it('筛选条件虽可见但配置遮罩未消失时，仍不算回到列表', () => {
    expect(isSearchAfterViewListReady(true, true)).toBe(false);
    expect(isSearchAfterViewListReady(true, false)).toBe(true);
  });

  it('标题没有款号时通过抽屉右上角关闭按钮返回列表', async () => {
    const click = vi.fn().mockResolvedValue(undefined);
    const close = { click };
    const page = {
      locator: vi.fn((selector: string) => {
        expect(selector).toBe('button.auxo-drawer-close:visible');
        return { last: () => close };
      })
    };

    await closeSearchAfterViewDrawer(page as never);

    expect(click).toHaveBeenCalledOnce();
  });
});

describe('看后搜任务页面', () => {
  it('配置异常时保留任务浏览器页面，不关闭登录浏览器', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const locator = {
      count: vi.fn().mockResolvedValue(0),
      first: () => locator,
      last: () => ({ click: vi.fn().mockRejectedValue(new Error('没有抽屉')) }),
      innerText: vi.fn().mockResolvedValue(''),
      isVisible: vi.fn().mockResolvedValue(false)
    };
    const page = {
      url: () => DOUDIAN_SEARCH_AFTER_VIEW_URL,
      title: vi.fn().mockResolvedValue('看后搜视频运营'),
      close,
      setDefaultTimeout: vi.fn(),
      getByText: vi.fn(() => ({
        waitFor: vi.fn().mockRejectedValue(new Error('列表加载失败')),
        isVisible: vi.fn().mockResolvedValue(false)
      })),
      locator: vi.fn(() => locator),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      keyboard: { press: vi.fn().mockResolvedValue(undefined) }
    };
    openDoudianShopPage.mockReset();
    openDoudianShopPage.mockResolvedValue({ page });

    await expect(submitSearchAfterViewTask({
      shopId: 'shop-1',
      profilePath: 'C:/profile',
      cookiePath: 'C:/cookies.json',
      status: 'active',
      lastCheckedAt: null
    }, {
      shopId: 'shop-1',
      keywords: ['斯凯奇男鞋']
    }, { signal: new AbortController().signal })).rejects.toThrow('看后搜页面未加载');

    expect(close).not.toHaveBeenCalled();
  });

  it('同一个任务连续配置时复用同一任务页', async () => {
    const page = { isClosed: () => false, setDefaultTimeout: vi.fn() };
    openDoudianShopPage.mockReset();
    openDoudianShopPage.mockResolvedValue({ page });
    const controller = new AbortController();
    const profile = {
      shopId: 'shop-1',
      profilePath: 'C:/profile',
      cookiePath: 'C:/cookies.json',
      status: 'active' as const,
      lastCheckedAt: null
    };

    const first = await getSearchAfterViewTaskPage(profile, controller.signal);
    const second = await getSearchAfterViewTaskPage(profile, controller.signal);

    expect(first).toBe(page);
    expect(second).toBe(page);
    expect(openDoudianShopPage).toHaveBeenCalledTimes(1);
  });

  it('分页结构变化时仍能点击下一页', async () => {
    const click = vi.fn().mockResolvedValue(undefined);
    const nextButton = {
      isVisible: vi.fn().mockResolvedValue(true),
      evaluate: vi.fn().mockResolvedValue(false),
      click
    };
    const empty = {
      all: vi.fn().mockResolvedValue([]),
      first: () => ({
        getAttribute: vi.fn().mockResolvedValue(null),
        textContent: vi.fn().mockResolvedValue(null),
        innerText: vi.fn().mockResolvedValue('')
      })
    };
    const page = {
      locator: vi.fn((selector: string) => selector.includes('button[aria-label*="下一页"]')
        ? { ...empty, all: vi.fn().mockResolvedValue([nextButton]) }
        : empty),
      waitForFunction: vi.fn().mockResolvedValue(undefined)
    };

    await expect(goToNextSearchAfterViewPage(page as never)).resolves.toBe(true);
    expect(click).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it, vi } from 'vitest';

const { openDoudianShopPage } = vi.hoisted(() => ({
  openDoudianShopPage: vi.fn()
}));

vi.mock('./doudianSession', () => ({ openDoudianShopPage }));

import {
  chooseSearchAfterViewMainProduct,
  shouldSetSearchAfterViewMainProduct,
  isSearchAfterViewMainProductConfirmed,
  waitForSearchAfterViewMainProductConfirmation,
  clickSearchAfterViewMainProductButton,
  waitForSearchAfterViewSubmitCompletion,
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
  parseSearchAfterViewRowMetadata,
  waitForSearchAfterViewProductPicker,
  waitForSearchAfterViewProductResults,
  enterSearchAfterViewProductSku,
  isSearchAfterViewDrawerMatch,
  isSearchAfterViewVideoRowMatch,
  isSearchAfterViewVideoTargetMatch,
  isSearchAfterViewPageBusy,
  hasSearchAfterViewConfigureAction,
  shouldResetSearchAfterViewPagination,
  collectSearchAfterViewCandidates,
  findSearchAfterViewCandidateRowIndex,
  isSearchAfterViewPageDataChanged
} from './searchAfterView';

describe('看后搜配置输入规则', () => {
  it('先扫描整页视频，只保留有款号的视频 ID 并保持顺序', () => {
    expect(collectSearchAfterViewCandidates([
      { title: '视频一 232619-01', videoId: '1000000000001', pending: true, hasConfigure: true },
      { title: '视频二', videoId: '1000000000002', pending: true, hasConfigure: true },
      { title: '视频三 232939', videoId: '1000000000003', pending: true, hasConfigure: true },
      { title: '视频四 216704', videoId: '1000000000004', pending: false, hasConfigure: true }
    ])).toEqual([
      { videoId: '1000000000001', sku: '232619', title: '视频一 232619-01' },
      { videoId: '1000000000003', sku: '232939', title: '视频三 232939' }
    ]);
  });

  it('从视频标题提取六码款号', () => {
    expect(extractSearchAfterViewSku('黑色网面鞋 232939-45')).toBe('232939');
    expect(extractSearchAfterViewSku('宽楦舒适男鞋 232619')).toBe('232619');
  });

  it('从视频标题提取任意位数款号并截断横杠后缀', () => {
    expect(extractSearchAfterViewSku('新款鞋 1234-01')).toBe('1234');
    expect(extractSearchAfterViewSku('新款鞋 1234567-01')).toBe('1234567');
    expect(extractSearchAfterViewSku('新款鞋 12345678')).toBe('12345678');
  });

  it('忽略没有款号的视频标题', () => {
    expect(extractSearchAfterViewSku('这双鞋日常很好搭')).toBeNull();
  });

  it('一次解析扫描行的标题、视频 ID、状态和配置入口', () => {
    expect(parseSearchAfterViewRowMetadata(
      '黑色网面鞋 232939-45',
      '黑色网面鞋 232939-45 短视频 ID 7677566971231178018 待配置 立即配置'
    )).toEqual({
      title: '黑色网面鞋 232939-45',
      videoId: '7677566971231178018',
      pending: true,
      hasConfigure: true
    });
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

  it('点击立即配置前同时核对视频 ID 和标题款号', () => {
    expect(isSearchAfterViewVideoTargetMatch(
      '黑色网面鞋 232939-45',
      '短视频 ID 7677566971231178018 待配置',
      '7677566971231178018',
      '232939'
    )).toBe(true);
    expect(isSearchAfterViewVideoTargetMatch(
      '黑色网面鞋 216704-1',
      '短视频 ID 7677566971231178018 待配置',
      '7677566971231178018',
      '232939'
    )).toBe(false);
  });

  it('页面重绘后只重新定位 ID 与款号仍一致的同一行', () => {
    const candidate = { videoId: '7677566971231178018', sku: '232939', title: '黑色网面鞋 232939-45' };
    expect(findSearchAfterViewCandidateRowIndex([
      { title: '黑色网面鞋 216704-45', videoId: '7677566971231178018', pending: true, hasConfigure: true },
      { title: '黑色网面鞋 232939-45', videoId: '7677458730568518952', pending: true, hasConfigure: true },
      { title: '黑色网面鞋 232939-45', videoId: '7677566971231178018', pending: true, hasConfigure: true }
    ], candidate)).toBe(2);
    expect(findSearchAfterViewCandidateRowIndex([
      { title: '黑色网面鞋 216704-45', videoId: '7677566971231178018', pending: true, hasConfigure: true }
    ], candidate)).toBe(-1);
  });

  it('翻页后立即配置即使渲染为链接也能识别', async () => {
    const link = { count: vi.fn().mockResolvedValue(1) };
    const row = {
      getByRole: vi.fn((role: string) => role === 'button'
        ? { count: vi.fn().mockResolvedValue(0) }
        : link),
      getByText: vi.fn(() => ({ count: vi.fn().mockResolvedValue(0) }))
    };

    await expect(hasSearchAfterViewConfigureAction(row as never)).resolves.toBe(true);
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
  it('逐字输入款号后再触发商品搜索', async () => {
    const search = {
      click: vi.fn().mockResolvedValue(undefined),
      fill: vi.fn().mockResolvedValue(undefined),
      pressSequentially: vi.fn().mockResolvedValue(undefined),
      press: vi.fn().mockResolvedValue(undefined)
    };

    await enterSearchAfterViewProductSku(search as never, '210797');

    expect(search.click).toHaveBeenCalledOnce();
    expect(search.fill).toHaveBeenCalledWith('');
    expect(search.pressSequentially).toHaveBeenCalledWith('210797', { delay: 80 });
    expect(search.press).toHaveBeenCalledWith('Enter');
  });

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

  it('款号搜索结果只保留包含该款号的商品行', async () => {
    const first = { isVisible: vi.fn().mockResolvedValue(true) };
    const filter = vi.fn();
    const rows = { filter, first: () => first };
    filter.mockReturnValue(rows);
    const productDrawer = {
      locator: vi.fn(() => rows),
      getByText: vi.fn(() => ({ last: () => ({ isVisible: vi.fn().mockResolvedValue(false) }) }))
    };

    await waitForSearchAfterViewProductResults({ waitForTimeout: vi.fn() } as never, productDrawer as never, '118415');

    expect(filter).toHaveBeenCalledTimes(1);
    expect(filter).toHaveBeenCalledWith({ hasText: '118415' });
  });

  it('不把右侧已选商品的暂无商品误判为搜索无结果', async () => {
    const isVisible = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const rows = {
      filter: vi.fn(),
      first: () => ({ isVisible })
    };
    rows.filter.mockReturnValue(rows);
    const productDrawer = {
      locator: vi.fn(() => rows),
      getByText: vi.fn(() => ({ last: () => ({ isVisible: vi.fn().mockResolvedValue(true) }) }))
    };
    const waitForTimeout = vi.fn().mockResolvedValue(undefined);

    await waitForSearchAfterViewProductResults({ waitForTimeout } as never, productDrawer as never, '210797');

    expect(waitForTimeout).toHaveBeenCalledOnce();
    expect(isVisible).toHaveBeenCalledTimes(2);
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

  it('商品勾选完成后只为第一个非国补商品立即设置主推', () => {
    expect(shouldSetSearchAfterViewMainProduct({ id: 'subsidy', title: '【国补】商品' }, null)).toBe(false);
    expect(shouldSetSearchAfterViewMainProduct({ id: 'normal', title: '普通商品' }, null)).toBe(true);
    expect(shouldSetSearchAfterViewMainProduct({ id: 'later', title: '另一个普通商品' }, 'normal')).toBe(false);
  });

  it('只有页面确认已设为主推后才算设置成功', () => {
    expect(isSearchAfterViewMainProductConfirmed('商品 ID 123 已成功设为主推品')).toBe(true);
    expect(isSearchAfterViewMainProductConfirmed('商品 ID 123 设置主推')).toBe(false);
  });

  it('主推确认使用更短的条件轮询而不是固定长等待', async () => {
    const waitForTimeout = vi.fn().mockResolvedValue(undefined);
    const drawer = {
      innerText: vi.fn()
        .mockResolvedValueOnce('设置主推')
        .mockResolvedValueOnce('商品已成功设为主推品')
    };

    await waitForSearchAfterViewMainProductConfirmation({ waitForTimeout } as never, drawer as never);

    expect(waitForTimeout).toHaveBeenCalledWith(50);
    expect(drawer.innerText).toHaveBeenCalledTimes(2);
  });

  it('主推确认优先等待成功提示的 DOM 变化，不反复读取整个抽屉', async () => {
    const waitForTimeout = vi.fn().mockResolvedValue(undefined);
    const drawer = {
      innerText: vi.fn().mockResolvedValue('设置主推')
    };
    const waitForFunction = vi.fn().mockResolvedValue(undefined);

    await waitForSearchAfterViewMainProductConfirmation({ waitForTimeout, waitForFunction } as never, drawer as never);

    expect(waitForFunction).toHaveBeenCalledWith(
      expect.any(Function),
      { selector: 'body', phrase: '已成功设为主推品' },
      { timeout: 5_000, polling: 50 }
    );
    expect(drawer.innerText).not.toHaveBeenCalled();
    expect(waitForTimeout).not.toHaveBeenCalled();
  });

  it('设置主推按钮出现后使用原生点击', async () => {
    const calls: string[] = [];
    const button = {
      waitFor: vi.fn(async () => { calls.push('waitFor'); }),
      evaluate: vi.fn(async (callback: (element: HTMLElement) => void) => {
        calls.push('evaluate');
        callback({ click: () => calls.push('native-click') } as unknown as HTMLElement);
      }),
      click: vi.fn(async () => { calls.push('playwright-click'); })
    };

    await clickSearchAfterViewMainProductButton(button as never);

    expect(calls).toEqual(['waitFor', 'evaluate', 'native-click']);
    expect(button.waitFor).toHaveBeenCalledWith({ state: 'visible' });
    expect(button.click).not.toHaveBeenCalled();
  });

  it('提交完成以返回视频列表为准，不等待立即提交按钮隐藏', async () => {
    const row = {
      waitFor: vi.fn().mockResolvedValue(undefined),
      isVisible: vi.fn().mockResolvedValue(true)
    };
    const rows = { first: () => row };
    const page = {
      getByText: vi.fn(() => ({ isVisible: vi.fn().mockResolvedValue(true) })),
      locator: vi.fn((selector: string) => selector.includes('drawer')
        ? { count: vi.fn().mockResolvedValue(0) }
        : rows),
      waitForTimeout: vi.fn().mockResolvedValue(undefined)
    };

    await waitForSearchAfterViewSubmitCompletion(page as never);

    expect(row.waitFor).toHaveBeenCalledWith({ state: 'visible', timeout: 10_000 });
    expect(page.waitForTimeout).not.toHaveBeenCalled();
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
  it('点击立即配置前保留短暂稳定等待', async () => {
    const waitForTimeout = vi.fn().mockResolvedValue(undefined);

    await waitBeforeSearchAfterViewConfigure({ waitForTimeout } as never);

    expect(waitForTimeout).toHaveBeenCalledWith(750);
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
  it('只有页码和首行数据都变化后才算翻页完成', () => {
    expect(isSearchAfterViewPageDataChanged('1', '2', '旧行', '旧行')).toBe(false);
    expect(isSearchAfterViewPageDataChanged('1', '2', '旧行', '新行')).toBe(true);
  });

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
    let moved = false;
    click.mockImplementation(async () => { moved = true; });
    const waitForFunction = vi.fn().mockResolvedValue(undefined);
    const nextButton = {
      isVisible: vi.fn().mockResolvedValue(true),
      evaluate: vi.fn().mockResolvedValue(false),
      click
    };
    const empty = {
      all: vi.fn().mockResolvedValue([]),
      first: () => ({
        getAttribute: vi.fn().mockImplementation(async () => moved ? '2' : null),
        textContent: vi.fn().mockImplementation(async () => moved ? '2' : null),
        innerText: vi.fn().mockImplementation(async () => moved ? '短视频 ID 2000000000001' : '')
      })
    };
    const page = {
      locator: vi.fn((selector: string) => selector.includes('button[aria-label*="下一页"]')
        ? { ...empty, all: vi.fn().mockResolvedValue([nextButton]) }
        : empty),
      waitForFunction,
      waitForTimeout: vi.fn().mockResolvedValue(undefined)
    };

    await expect(goToNextSearchAfterViewPage(page as never)).resolves.toBe(true);
    expect(click).toHaveBeenCalledOnce();
    expect(waitForFunction).toHaveBeenCalledWith(expect.any(String), expect.anything(), expect.anything());
  });
});

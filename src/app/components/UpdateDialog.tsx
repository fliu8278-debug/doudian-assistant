import type { UpdateState } from '../updater';

type Props = {
  state: UpdateState;
  onCheck(): void;
  onDownload(): void;
  onOpenRelease(): void;
  onRestart(): void;
};

export function UpdateDialog({ state, onCheck, onDownload, onOpenRelease, onRestart }: Props) {
  const version = state.version ? ` v${state.version}` : '';
  const title = state.justUpdated ? `已更新至 v${state.currentVersion}`
    : state.phase === 'downloading' ? `正在下载${version}`
    : state.phase === 'ready' ? '更新已准备好'
      : state.phase === 'available' ? `发现新版本${version}`
        : state.phase === 'error' ? '更新失败'
          : '软件更新';

  return (
    <section aria-label="软件更新" className="updateDialog" role="dialog">
      <header><div><span>软件更新</span><h2>{title}</h2></div><b>当前 v{state.currentVersion}</b></header>
      {state.releaseNotes ? <p className="updateNotes">{state.releaseNotes}</p> : <p className="updateNotes">新版本已准备好，更新不会影响本地数据。</p>}
      {state.phase === 'downloading' ? <div className="updateProgress"><progress max={100} value={state.percent ?? 0} /><strong>{Math.round(state.percent ?? 0)}%</strong></div> : null}
      {state.error ? <p className="updateError">{state.error}</p> : null}
      <footer>
        {state.phase === 'available' ? <button className="primaryButton" onClick={onDownload} type="button">立即更新</button> : null}
        {state.phase === 'ready' ? <button className="primaryButton" onClick={onRestart} type="button">重启更新</button> : null}
        {state.phase === 'error' ? <><button onClick={onOpenRelease} type="button">打开下载页</button><button className="primaryButton" onClick={onCheck} type="button">重试</button></> : null}
      </footer>
    </section>
  );
}

import type { UpdateState } from '../updater';

type Props = {
  state: UpdateState;
  onCheck(): void;
  onDownload(): void;
  onOpenRelease(): void;
  onRestart(): void;
};

function formatBytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export function UpdateDialog({ state, onCheck, onDownload, onOpenRelease, onRestart }: Props) {
  const version = state.version ? ` v${state.version}` : '';
  const percent = Math.max(0, Math.min(100, Math.round(state.percent ?? 0)));
  const transferred = state.transferred ?? 0;
  const total = state.total ?? 0;
  const hasSize = total > 0 && transferred >= 0;
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
      {state.phase === 'downloading' ? <section aria-label={`下载进度 ${percent}%`} aria-live="polite" className="updateProgress">
        <div className="updateProgressHead"><span>下载更新包</span><strong>{percent}%</strong></div>
        <div aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} className="updateProgressTrack" role="progressbar"><i aria-hidden="true" style={{ width: `${percent}%` }} /></div>
        {hasSize ? <div className="updateProgressMeta"><span>已下载 {formatBytes(transferred)}</span><span>共 {formatBytes(total)}</span></div> : null}
        <div className="updateProgressStages"><span className="done">检查更新</span><span className="active">下载更新包</span><span>重启安装</span></div>
      </section> : null}
      {state.error ? <p className="updateError">{state.error}</p> : null}
      <footer>
        {state.phase === 'available' ? <button className="primaryButton" onClick={onDownload} type="button">立即更新</button> : null}
        {state.phase === 'ready' ? <button className="primaryButton" onClick={onRestart} type="button">重启更新</button> : null}
        {state.phase === 'error' ? <><button onClick={onOpenRelease} type="button">打开下载页</button><button className="primaryButton" onClick={onCheck} type="button">重试</button></> : null}
      </footer>
    </section>
  );
}

import type { UpdateState } from '../updater';

type Props = {
  state: UpdateState;
  onCheck(): void;
  onClose?(): void;
  onDownload(): void;
  onOpenRelease(): void;
  onRestart(): void;
};

export function UpdateDialog({ state, onCheck, onClose, onDownload, onOpenRelease, onRestart }: Props) {
  const targetVersion = state.version ?? state.currentVersion;
  const percent = Math.max(0, Math.min(100, Math.round(state.percent ?? 0)));
  const isSuccess = Boolean(state.justUpdated);
  const isReady = state.phase === 'ready';
  const isDownloading = state.phase === 'downloading';
  const title = isSuccess ? '🎉 更新成功！' : state.phase === 'error' ? '更新失败' : '发现新版本';
  const summary = isSuccess
    ? `更新已完成，当前版本 v${state.currentVersion}`
    : `当前版本 v${state.currentVersion}，新版本已可用。`;
  const notes = state.releaseNotes || '本次更新包含体验优化与问题修复，更新不会影响本地数据。';

  return (
    <section aria-label="软件更新" aria-modal="true" className="updateDialog" role="dialog">
      <header className="updateDialogHeader">
        <div className="updateDialogTitle"><span aria-hidden="true" className="updateDialogIcon"><svg data-icon="update" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3.5 13.5 9l5.5 1.5-5.5 1.5-1.5 5.5-1.5-5.5L5.5 10.5 11 9l1-5.5Z" /><path d="m18 4 .5 1.5L20 6l-1.5.5L18 8l-.5-1.5L16 6l1.5-.5L18 4Z" /></svg></span><h2>{title}</h2></div>
        <button aria-label="关闭更新窗口" className="updateDialogClose" onClick={onClose} type="button">×</button>
      </header>
      <div className="updateDialogBody">
        <div className="updateDialogVersion">v{targetVersion}</div>
        <p className="updateDialogSummary">{summary}</p>
        {isReady ? <p className="updateReadyNotice">✓ <strong>v{targetVersion} 已就绪，重启后生效。</strong></p> : null}
        {isDownloading ? <section aria-label={`下载进度 ${percent}%`} aria-live="polite" className="updateProgress">
          <div className="updateProgressRow"><div aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} className="updateProgressTrack" role="progressbar"><i aria-hidden="true" style={{ width: `${percent}%` }} /></div></div>
          <span className="updateProgressText">下载中… {percent}%</span>
        </section> : null}
        {state.error ? <p className="updateError">{state.error}</p> : null}
        <div className="updateDialogRule" />
        <h3>更新内容</h3>
        <div className="updateDialogNotes">{notes}</div>
      </div>
      <footer className="updateDialogFooter">
        {!isSuccess ? <button className="updateDialogSecondary" onClick={onClose} type="button">稍后</button> : null}
        {state.phase === 'available' ? <button className="updateDialogPrimary" onClick={onDownload} type="button">立即更新</button> : null}
        {isDownloading ? <button className="updateDialogPrimary" disabled type="button">下载中…</button> : null}
        {isReady ? <button className="updateDialogPrimary" onClick={onRestart} type="button">⟳ 立即重启</button> : null}
        {state.phase === 'error' ? <><button className="updateDialogSecondary" onClick={onOpenRelease} type="button">打开下载页</button><button className="updateDialogPrimary" onClick={onCheck} type="button">重试</button></> : null}
        {isSuccess ? <button className="updateDialogPrimary" onClick={onClose} type="button">✓ 我知道了</button> : null}
      </footer>
    </section>
  );
}

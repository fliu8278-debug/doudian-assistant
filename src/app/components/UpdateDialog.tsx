import type { UpdateState } from '../updater';

type Props = {
  state: UpdateState;
  onCheck(): void;
  onClose?(): void;
  onDownload(): void;
  onCancelDownload?(): void;
  onOpenRelease(): void;
  onRestart(): void;
  onSkip?(): void;
};

export function UpdateDialog({ state, onCheck, onClose, onDownload, onCancelDownload, onOpenRelease, onRestart, onSkip }: Props) {
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
        <button aria-label="关闭更新窗口" className="updateDialogClose" onClick={onClose} type="button"><UpdateActionIcon name="close" /></button>
      </header>
      <div className="updateDialogBody">
        <div className="updateDialogVersion">v{targetVersion}</div>
        <p className="updateDialogSummary">{summary}</p>
        {isReady ? <p className="updateReadyNotice"><UpdateActionIcon name="confirm" /><strong>v{targetVersion} 已就绪，重启后生效。</strong></p> : null}
        {isDownloading ? <section aria-label={`下载进度 ${percent}%`} aria-live="polite" className="updateProgress">
          <div className="updateProgressRow"><div aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} className="updateProgressTrack" role="progressbar"><i aria-hidden="true" style={{ width: `${percent}%` }} /></div><button aria-label="取消下载" className="updateProgressCancel" onClick={onCancelDownload} type="button"><UpdateActionIcon name="close" /></button></div>
          <span className="updateProgressText">下载中… {percent}%</span>
        </section> : null}
        {state.error ? <p className="updateError">{state.error}</p> : null}
        <div className="updateDialogRule" />
        <h3>更新内容</h3>
        <div className="updateDialogNotes">{notes}</div>
      </div>
      <footer className="updateDialogFooter">
        {state.phase === 'available' ? <><button className="updateDialogSecondary" onClick={onClose} type="button">取消</button><button className="updateDialogTertiary" onClick={onSkip} type="button">跳过此版本</button><button className="updateDialogPrimary" onClick={onDownload} type="button"><UpdateActionIcon name="download" />立即更新</button></> : null}
        {isDownloading ? <><button className="updateDialogSecondary" onClick={onClose} type="button">稍后</button><button className="updateDialogPrimary" disabled type="button"><UpdateActionIcon name="restart" />下载中…</button></> : null}
        {isReady ? <><button className="updateDialogSecondary" onClick={onClose} type="button">稍后</button><button className="updateDialogTertiary" onClick={onSkip} type="button">跳过此版本</button><button className="updateDialogPrimary" onClick={onRestart} type="button"><UpdateActionIcon name="restart" />立即重启</button></> : null}
        {state.phase === 'error' ? <><button className="updateDialogSecondary" onClick={onOpenRelease} type="button">打开下载页</button><button className="updateDialogPrimary" onClick={onCheck} type="button">重试</button></> : null}
        {isSuccess ? <button className="updateDialogPrimary" onClick={onClose} type="button"><UpdateActionIcon name="confirm" />我知道了</button> : null}
      </footer>
    </section>
  );
}

function UpdateActionIcon({ name }: { name: 'close' | 'confirm' | 'download' | 'restart' }) {
  if (name === 'download') return <svg aria-hidden="true" className="updateButtonIcon" data-icon="download" fill="none" viewBox="0 0 24 24"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 20h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>;
  if (name === 'restart') return <svg aria-hidden="true" className="updateButtonIcon" data-icon="restart" fill="none" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0 2 5.3M20 5v6h-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>;
  if (name === 'confirm') return <svg aria-hidden="true" className="updateButtonIcon" data-icon="confirm" fill="none" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" /></svg>;
  return <svg aria-hidden="true" className="updateButtonIcon" data-icon="close" fill="none" viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>;
}

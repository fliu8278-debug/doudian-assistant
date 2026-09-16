import { useEffect, useState } from 'react';

export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'not-available' | 'error';

export type UpdateState = {
  phase: UpdatePhase;
  currentVersion: string;
  backgroundEnabled?: boolean;
  version?: string;
  releaseNotes?: string;
  error?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  justUpdated?: boolean;
};

type UpdaterBridge = {
  getState(): Promise<UpdateState>;
  check(): Promise<UpdateState>;
  download(): Promise<UpdateState>;
  restart(): Promise<UpdateState>;
  setBackground(enabled: boolean): Promise<UpdateState>;
  openRelease(): Promise<void>;
  onState(listener: (state: UpdateState) => void): () => void;
};

declare global {
  interface Window {
    doudianUpdater?: UpdaterBridge;
  }
}

const previewState: UpdateState = { phase: 'idle', currentVersion: '开发预览' };

export async function readInitialUpdateState(bridge: UpdaterBridge | undefined): Promise<UpdateState> {
  return bridge ? bridge.getState() : previewState;
}

export function updateActionLabel(state: Pick<UpdateState, 'phase' | 'percent' | 'version'>) {
  if (state.phase === 'checking') return '检查中…';
  if (state.phase === 'available') return `更新 v${state.version ?? ''}`.trim();
  if (state.phase === 'downloading') return `下载中 ${Math.round(state.percent ?? 0)}%`;
  if (state.phase === 'ready') return '重启更新';
  return '检查更新';
}

export function useUpdater() {
  const [state, setState] = useState<UpdateState>(previewState);

  useEffect(() => {
    const bridge = window.doudianUpdater;
    void readInitialUpdateState(bridge).then(setState);
    return bridge?.onState(setState);
  }, []);

  const bridge = typeof window === 'undefined' ? undefined : window.doudianUpdater;
  return {
    state,
    check: () => bridge?.check(),
    download: () => bridge?.download(),
    restart: () => bridge?.restart(),
    setBackground: (enabled: boolean) => bridge?.setBackground(enabled),
    openRelease: () => bridge?.openRelease()
  };
}

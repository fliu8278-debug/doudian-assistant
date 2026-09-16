function startAutoUpdater({ app, autoUpdater, dialog, getWindow, log = console }) {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.on('update-available', async ({ version }) => {
    const { response } = await dialog.showMessageBox(getWindow(), {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 v${version}`,
      detail: '下载完成后，你可以选择重启软件安装更新。',
      buttons: ['立即更新', '稍后'],
      defaultId: 0,
      cancelId: 1
    });

    if (response === 0) await autoUpdater.downloadUpdate();
  });
  autoUpdater.on('update-downloaded', async () => {
    const { response } = await dialog.showMessageBox(getWindow(), {
      type: 'info',
      title: '更新已下载',
      message: '更新已下载完成。',
      detail: '重启软件后将完成安装。',
      buttons: ['重启安装', '稍后'],
      defaultId: 0,
      cancelId: 1
    });

    if (response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', (error) => log.error('更新检查失败', error));
  autoUpdater.checkForUpdates().catch((error) => log.error('更新检查失败', error));
}

module.exports = { startAutoUpdater };

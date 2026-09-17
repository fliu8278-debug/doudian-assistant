const { join } = require('node:path');

function bundledBrowserPath(resourcesPath) {
  return join(resourcesPath, 'playwright', 'chromium', 'chrome-win64', 'chrome.exe');
}

module.exports = { bundledBrowserPath };

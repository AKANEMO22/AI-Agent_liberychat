const { contextBridge, webUtils } = require('electron');

/**
 * Expose lightweight native bridge APIs to the existing LibreChat frontend.
 * Zero duplicate logic - only exposes native OS filesystem path resolution for dropped items.
 */
contextBridge.exposeInMainWorld('desktopBridge', {
  isDesktop: true,
  /**
   * Resolves the true, authoritative absolute Windows filesystem path for a dropped File object.
   * @param {File} file 
   * @returns {string} Real absolute filesystem path (e.g. "D:\\Code\\MyProject" or "C:\\test\\main.py")
   */
  getPathForFile: (file) => {
    try {
      if (!file) return '';
      return webUtils.getPathForFile(file) || file.path || '';
    } catch (err) {
      console.error('[desktopBridge.getPathForFile] Error:', err);
      return file.path || '';
    }
  },
});

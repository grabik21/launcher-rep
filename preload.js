const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    downloadMinecraft: (progressCallback) => {
        ipcRenderer.on('download-progress', (event, progress) => {
            progressCallback(progress);
        });
        ipcRenderer.on('download-error', (event, error) => {
            alert(`Error: ${error}`);
        });
        return ipcRenderer.invoke('download-minecraft');
    },
    launchMinecraft: (username) => {
        ipcRenderer.on('launch-error', (event, error) => {
            alert(`Error: ${error}`);
        });
        ipcRenderer.on('launch-success', (event, message) => {
            alert(`Success: ${message}`);
        });
        return ipcRenderer.invoke('launch-minecraft', username);
    }
});
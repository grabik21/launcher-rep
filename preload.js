const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    downloadMinecraft: (progressCallback) => {
        ipcRenderer.on('download-progress', (event, { fileName, progress }) => {
            progressCallback(fileName, progress);
        });
        ipcRenderer.on('download-error', (event, error) => {
            alert(`Error: ${error}`);
        });
        ipcRenderer.on('download-complete', () => {
            ipcRenderer.send('hide-select-folder-button');
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
    },
    openFolder: () => ipcRenderer.invoke('open-folder')
});
// https://piston-data.mojang.com/v1/objects/b88808bbb3da8d9f453694b5d8f74a3396f1a533/client.jar
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

let selectedFolderPath = '';
let isDownloaded = false;

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// Обработка IPC сообщений
ipcMain.handle('select-folder', async (event) => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });

    if (!result.canceled) {
        selectedFolderPath = result.filePaths[0];
        return selectedFolderPath;
    } else {
        throw new Error('Folder selection canceled');
    }
});

ipcMain.handle('download-minecraft', async (event) => {
    if (!selectedFolderPath) {
        throw new Error('No folder selected');
    }

    if (isDownloaded) {
        throw new Error('Minecraft is already downloaded');
    }

    const clientUrl = 'https://piston-data.mojang.com/v1/objects/b88808bbb3da8d9f453694b5d8f74a3396f1a533/client.jar';
    const joptsimpleUrl = 'https://repo1.maven.org/maven2/net/sf/jopt-simple/jopt-simple/5.0.4/jopt-simple-5.0.4.jar';
    const folderPath = path.join(selectedFolderPath, 'stormland-launcher');
    const clientPath = path.join(folderPath, 'minecraft_client.jar');
    const joptsimplePath = path.join(folderPath, 'jopt-simple-5.0.4.jar');

    // Создаем папку, если она не существует
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }

    // Функция для скачивания файла
    const downloadFile = async (url, outputPath, fileName) => {
        try {
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(outputPath);
            const totalLength = response.headers['content-length'];

            let downloadedLength = 0;

            response.data.on('data', (chunk) => {
                downloadedLength += chunk.length;
                const progress = Math.round((downloadedLength / totalLength) * 100);
                event.sender.send('download-progress', { fileName, progress });
            });

            await pipeline(response.data, writer);
            console.log(`${fileName} downloaded successfully.`);
        } catch (error) {
            console.error(`Error downloading ${fileName}:`, error);
            throw new Error(`Failed to download ${fileName}: ${error.message}`);
        }
    };

    // Скачиваем клиентский JAR
    await downloadFile(clientUrl, clientPath, 'Minecraft Client');

    // Скачиваем библиотеку joptsimple
    await downloadFile(joptsimpleUrl, joptsimplePath, 'joptsimple Library');

    // Устанавливаем флаг, что загрузка завершена
    isDownloaded = true;

    // Отправляем событие о завершении загрузки
    event.sender.send('download-complete');
});

ipcMain.handle('launch-minecraft', async (event, username) => {
    if (!selectedFolderPath) {
        throw new Error('No folder selected');
    }

    const folderPath = path.join(selectedFolderPath, 'stormland-launcher');
    const clientPath = path.join(folderPath, 'minecraft_client.jar');
    const joptsimplePath = path.join(folderPath, 'jopt-simple-5.0.4.jar');

    if (!fs.existsSync(clientPath)) {
        event.sender.send('launch-error', 'Minecraft client file not found.');
        return;
    }

    if (!fs.existsSync(joptsimplePath)) {
        event.sender.send('launch-error', 'joptsimple library not found.');
        return;
    }

    try {
        const command = `java -Xmx1024M -Xms1024M -cp "${clientPath}:${joptsimplePath}" -jar "${clientPath}" --username "${username}"`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                event.sender.send('launch-error', `Error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
                event.sender.send('launch-error', `Stderr: ${stderr}`);
                return;
            }
            console.log(`Stdout: ${stdout}`);
            event.sender.send('launch-success', `Stdout: ${stdout}`);
            app.quit(); // Закрываем приложение после успешного запуска
        });
    } catch (error) {
        console.error('Error launching Minecraft:', error);
        event.sender.send('launch-error', `Failed to launch Minecraft: ${error.message}`);
    }
});

ipcMain.handle('open-folder', async (event) => {
    if (!selectedFolderPath) {
        throw new Error('No folder selected');
    }

    const folderPath = path.join(selectedFolderPath, 'stormland-launcher');
    shell.openPath(folderPath);
});
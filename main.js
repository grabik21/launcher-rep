// https://piston-data.mojang.com/v1/objects/b88808bbb3da8d9f453694b5d8f74a3396f1a533/client.jar
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');

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
ipcMain.handle('download-minecraft', async (event) => {
    const url = 'https://launcher.mojang.com/v1/objects/3737db93722a9e39eeada7c27e7aca28b971b9a5/client.jar';
    const extension = path.extname(url).substring(1); // Получаем расширение файла
    const folderPath = path.join(__dirname, 'stormland-launcher');
    const output = path.join(folderPath, `minecraft_client.${extension}`);

    // Проверяем, существует ли файл
    if (fs.existsSync(output)) {
        event.sender.send('download-error', 'Minecraft client file already exists.');
        return;
    }

    // Создаем папку, если она не существует
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }

    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(output);
        const totalLength = response.headers['content-length'];

        let downloadedLength = 0;

        response.data.on('data', (chunk) => {
            downloadedLength += chunk.length;
            const progress = Math.round((downloadedLength / totalLength) * 100);
            event.sender.send('download-progress', progress);
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        console.error('Error downloading file:', error);
        throw new Error(`Failed to download file: ${error.message}`);
    }
});

ipcMain.handle('launch-minecraft', async (event, username) => {
    const folderPath = path.join(__dirname, 'stormland-launcher');
    const clientPath = path.join(folderPath, `minecraft_client.jar`);

    if (!fs.existsSync(clientPath)) {
        event.sender.send('launch-error', 'Minecraft client file not found.');
        return;
    }

    try {
        const command = `java -Xmx1024M -Xms1024M -jar "${clientPath}" --username "${username}"`;
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
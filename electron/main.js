const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const Store = require('electron-store');
const { parse } = require('csv-parse/sync');
const { autoUpdater } = require('electron-updater');

// Disable auto-downloading to ask user for permission first
autoUpdater.autoDownload = false;

const store = new Store();

function createWindow() {
    const win = new BrowserWindow({
        width: 1100,
        height: 850,
        titleBarStyle: 'hiddenInset',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        },
        title: "Hatch | OG Project Initializer",
        backgroundColor: '#16191f',
        show: false
    });

    win.setMenu(null);

    win.once('ready-to-show', () => {
        win.show();
    });

    const isDev = !app.isPackaged;

    if (isDev) {
        win.loadURL('http://localhost:5173');
    } else {
        const indexPath = path.join(__dirname, '../dist/index.html');
        // console.log("Loading index from:", indexPath); // Optional cleanup
        win.loadFile(indexPath);
    }
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    if (app.isPackaged) {
        autoUpdater.checkForUpdates();
    }
});

// --- Auto Updater Events ---

autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available. Would you like to download it now?`,
        buttons: ['Download', 'Later'],
        defaultId: 0,
        cancelId: 1
    }).then((result) => {
        if (result.response === 0) {
            autoUpdater.downloadUpdate();
        }
    });
});

autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'The update has been downloaded. Restart now to install?',
        buttons: ['Restart', 'Later'],
        defaultId: 0,
        cancelId: 1
    }).then((result) => {
        if (result.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
});

autoUpdater.on('error', (err) => {
    console.error('Auto Updater Error:', err);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---

ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory']
    });
    if (canceled) return null;
    return filePaths[0];
});

ipcMain.handle('hatch:create', async (event, { destination, rootName, structure }) => {
    try {
        if (!destination || !rootName) throw new Error("Missing params");

        const rootPath = path.join(destination, rootName);

        try {
            await fs.access(rootPath);
            return { success: false, error: 'Folder already exists!' };
        } catch {
            // Good
        }

        await fs.mkdir(rootPath, { recursive: true });

        if (Array.isArray(structure)) {
            for (const relPath of structure) {
                if (typeof relPath === 'string' && relPath.trim().length > 0) {
                    const safePath = relPath.replace(/\.\./g, '');
                    await fs.mkdir(path.join(rootPath, safePath), { recursive: true });
                }
            }
        }

        // Automatically open folder
        shell.openPath(rootPath);

        return { success: true, path: rootPath };

    } catch (error) {
        console.error(error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('store:get', (event, key) => {
    return store.get(key);
});

ipcMain.handle('store:set', (event, key, value) => {
    store.set(key, value);
});

ipcMain.handle('utils:parseCSV', async (event, fileContent) => {
    try {
        const records = parse(fileContent, {
            columns: false,
            skip_empty_lines: true
        });
        // Return just the first column
        return records.map(row => row[0]).filter(Boolean);
    } catch (e) {
        throw new Error('Failed to parse CSV');
    }
});

ipcMain.handle('utils:fetchGoogleSheet', async (event, url) => {
    try {
        // Basic conversion to export URL if it's a standard edit URL
        // https://docs.google.com/spreadsheets/d/ID/edit#gid=0 -> https://docs.google.com/spreadsheets/d/ID/export?format=csv
        let csvUrl = url;
        const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
            csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
        }

        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        const text = await response.text();

        const records = parse(text, {
            columns: false,
            skip_empty_lines: true
        });
        return records.map(row => row[0]).filter(Boolean);

    } catch (e) {
        console.error(e);
        return { error: e.message };
    }
});

// --- File Copy Module ---

async function getDirStats(dirPath) {
    let size = 0;
    let files = 0;
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            const stats = await getDirStats(fullPath);
            size += stats.size;
            files += stats.files;
        } else {
            const stat = await fs.stat(fullPath);
            size += stat.size;
            files += 1;
        }
    }
    return { size, files };
}

ipcMain.handle('media:copyFiles', async (event, { source, destination, projectName }) => {
    try {
        if (!source || !destination) throw new Error("Source and Destination required");

        // 1. Pre-copy Check
        const sourceStats = await getDirStats(source);

        // Ensure destination exists
        await fs.mkdir(destination, { recursive: true });

        // 2. Perform Copy (using Node's experimental-but-stable cp in v16.7+)
        // If not available, we might need a manual recursive copy, but Electron 28 has Node 18.
        // We use preserveTimestamps to ensure metadata integrity
        await fs.cp(source, destination, { recursive: true, preserveTimestamps: true });

        // 3. Post-copy Verification
        const destStats = await getDirStats(destination);

        const isIntegrityVerified = sourceStats.size === destStats.size && sourceStats.files === destStats.files;

        const logEntry = {
            id: Date.now().toString(),
            projectName: projectName || "Unnamed Project",
            timestamp: new Date().toISOString(),
            source,
            destination,
            filesCount: destStats.files,
            totalSize: destStats.size,
            verified: isIntegrityVerified,
            status: isIntegrityVerified ? 'SUCCESS' : 'WARNING_MISMATCH'
        };

        // 4. Save Log
        const currentLogs = store.get('ingestLogs') || [];
        store.set('ingestLogs', [logEntry, ...currentLogs]);

        return { success: true, log: logEntry };

    } catch (error) {
        console.error("Copy Error:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('logs:get', () => {
    return store.get('ingestLogs') || [];
});

ipcMain.handle('logs:clear', () => {
    store.set('ingestLogs', []);
    return true;
});

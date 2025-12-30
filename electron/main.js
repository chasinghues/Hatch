const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const Store = require('electron-store');
const { parse } = require('csv-parse/sync');
const { autoUpdater } = require('electron-updater');

// Disable auto-downloading to ask user for permission first
autoUpdater.autoDownload = false;
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";

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
        win.webContents.openDevTools();
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
    // macOS Workaround for unsigned builds
    if (process.platform === 'darwin') {
        dialog.showMessageBox({
            type: 'info',
            title: 'Update Available',
            message: `Version ${info.version} is available.\n\nSince this app involves a manual update process on macOS, please download the new version manually to update.`,
            buttons: ['Download from GitHub', 'Later'],
            defaultId: 0,
            cancelId: 1
        }).then((result) => {
            if (result.response === 0) {
                const arch = process.arch === 'arm64' ? 'arm64' : 'universal';
                const filename = arch === 'arm64' ? `Hatch-${info.version}-arm64.dmg` : `Hatch-${info.version}-universal.dmg`;
                shell.openExternal(`https://github.com/chasinghues/Hatch/releases/download/v${info.version}/${filename}`);
            }
        });
        return;
    }

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
    dialog.showErrorBox('Update Error', err == null ? "unknown" : (err.stack || err).toString());
});

autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
});

autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available.', info);
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

ipcMain.handle('hatch:create', async (event, { destination, rootName, structure, metadata }) => {
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

        // Save Metadata File
        const projectData = {
            id: Date.now().toString(),
            name: metadata?.projectName || rootName,
            client: metadata?.clientName || "",
            type: metadata?.projectType || "",
            date: metadata?.date || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            version: "1.0.0"
        };

        await fs.writeFile(
            path.join(rootPath, 'hatch.metadata.json'),
            JSON.stringify(projectData, null, 2)
        );

        if (Array.isArray(structure)) {
            for (const relPath of structure) {
                if (typeof relPath === 'string' && relPath.trim().length > 0) {
                    const safePath = relPath.replace(/\.\./g, '');
                    await fs.mkdir(path.join(rootPath, safePath), { recursive: true });
                }
            }
        }

        // Save Project to Store
        const projects = store.get('projects') || [];
        const newProject = {
            ...projectData,
            path: rootPath
        };
        const filtered = projects.filter(p => p.path !== rootPath);
        store.set('projects', [newProject, ...filtered]);

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

// --- Robust Ingest Module ---

async function getFilesRecursively(dir) {
    let results = [];
    const list = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of list) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(await getFilesRecursively(fullPath));
        } else {
            if (!entry.name.startsWith('.')) {
                results.push({
                    path: fullPath,
                    size: (await fs.stat(fullPath)).size
                });
            }
        }
    }
    return results;
}

async function getDirectoryStructure(dirPath) {
    try {
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) return null;

        const list = await fs.readdir(dirPath, { withFileTypes: true });
        const children = [];
        const name = path.basename(dirPath);

        for (const entry of list) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                const sub = await getDirectoryStructure(path.join(dirPath, entry.name));
                if (sub) children.push(sub);
            }
        }

        return {
            id: dirPath,
            name: name,
            type: 'folder',
            children: children
        };
    } catch { return null; }
}

ipcMain.handle('ingest:selectFiles', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile', 'openDirectory', 'multiSelections']
    });
    if (canceled) return [];

    let allFiles = [];

    for (const fp of filePaths) {
        try {
            const stat = await fs.stat(fp);
            if (stat.isDirectory()) {
                const files = await getFilesRecursively(fp);
                const parentDir = path.dirname(fp);
                const mapped = files.map(f => ({
                    path: f.path,
                    name: path.basename(f.path),
                    size: f.size,
                    relativePath: path.relative(parentDir, f.path)
                }));
                allFiles = allFiles.concat(mapped);
            } else {
                const name = path.basename(fp);
                if (!name.startsWith('.')) {
                    allFiles.push({
                        path: fp,
                        name: name,
                        size: stat.size,
                        relativePath: name
                    });
                }
            }
        } catch (e) { console.error("Error selection", e); }
    }
    return allFiles;
});

ipcMain.handle('ingest:scanPaths', async (event, filePaths) => {
    let allFiles = [];

    for (const fp of filePaths) {
        try {
            const stat = await fs.stat(fp);
            if (stat.isDirectory()) {
                const files = await getFilesRecursively(fp);
                const parentDir = path.dirname(fp);
                const mapped = files.map(f => ({
                    path: f.path,
                    name: path.basename(f.path),
                    size: f.size,
                    relativePath: path.relative(parentDir, f.path)
                }));
                allFiles = allFiles.concat(mapped);
            } else {
                const name = path.basename(fp);
                if (!name.startsWith('.')) {
                    allFiles.push({
                        path: fp,
                        name: name,
                        size: stat.size,
                        relativePath: name
                    });
                }
            }
        } catch (e) {
            console.error("Error scanning path:", fp, e);
        }
    }
    return allFiles;
});


ipcMain.handle('fs:readStructure', async (event, rootPath) => {
    if (!rootPath) return null;
    return await getDirectoryStructure(rootPath);
});

ipcMain.handle('ingest:process', async (event, { files, destination, projectMetadata }) => {
    const results = {
        copied: [],
        skipped: [],
        failed: [],
        conflicts: [],
        totalSize: 0
    };

    if (!files || !files.length) return results;
    if (!destination || typeof destination !== 'string') throw new Error(`Invalid destination path: ${destination}`);

    // Ensure dest exists
    await fs.mkdir(destination, { recursive: true });

    let processedCount = 0;
    const totalCount = files.length;

    for (const file of files) {
        // Use relative path for structure, fall back to name
        const relPath = file.relativePath || file.name;
        const destPath = path.join(destination, relPath);

        // 1. Check for Conflict
        try {
            await fs.access(destPath);
            // File exists -> Add to conflicts
            results.conflicts.push({
                source: file.path,
                dest: destPath,
                name: relPath, // Use relative path as display name for verification/context
                size: file.size,
                relativePath: relPath
            });
            processedCount++;
            event.sender.send('ingest:progress', {
                percent: Math.round((processedCount / totalCount) * 100),
                message: `Found conflict: ${relPath}`
            });
            continue;
        } catch {
            // File does not exist, proceed
        }

        // 2. Perform Copy
        try {
            // Ensure parent directory exists
            await fs.mkdir(path.dirname(destPath), { recursive: true });

            await fs.copyFile(file.path, destPath);

            // 3. Verification
            const srcStat = await fs.stat(file.path);
            const destStat = await fs.stat(destPath);

            if (srcStat.size === destStat.size) {
                // Expanded detail object
                results.copied.push({
                    name: relPath, // Log relative path
                    source: file.path,
                    size: destStat.size,
                    path: destPath,
                    verification: 'MATCH'
                });
                results.totalSize += destStat.size;
            } else {
                results.failed.push({ file: relPath, source: file.path, error: "Size Mismatch Verification Failed" });
            }
        } catch (err) {
            results.failed.push({ file: relPath, source: file.path, error: err.message });
        }

        processedCount++;
        event.sender.send('ingest:progress', {
            percent: Math.round((processedCount / totalCount) * 100),
            message: `Copied: ${relPath}`
        });
    }

    const logId = Date.now().toString();
    const sourceDirectory = (files && files.length > 0) ? path.dirname(files[0].path) : null;

    // Log the operation
    logIngestOperation({
        id: logId,
        projectMetadata,
        timestamp: new Date().toISOString(),
        destination,
        sourceDirectory,
        results
    });

    return { ...results, logId };
});

ipcMain.handle('ingest:resolveConflicts', async (event, { conflicts, action, destination, projectMetadata, logId }) => {
    // action: 'overwrite' | 'skip'
    // logId: ID of log to update
    const results = { copied: [], failed: [], skipped: [] };

    const total = conflicts.length;
    let current = 0;

    for (const conflict of conflicts) {
        current++;
        event.sender.send('ingest:progress', {
            percent: Math.round((current / total) * 100),
            message: `Resolving conflict (${action}): ${conflict.name}`
        });

        if (action === 'skip') {
            results.skipped.push({ name: conflict.name, source: conflict.source, reason: 'User Skipped [Resolved]' });
            continue;
        }

        if (action === 'overwrite') {
            try {
                // Ensure dir exists (redundant if overwrite, but safe)
                await fs.mkdir(path.dirname(conflict.dest), { recursive: true });

                await fs.copyFile(conflict.source, conflict.dest);

                // Verify
                const srcStat = await fs.stat(conflict.source);
                const destStat = await fs.stat(conflict.dest);

                if (srcStat.size === destStat.size) {
                    results.copied.push({
                        name: conflict.name,
                        source: conflict.source,
                        size: destStat.size,
                        path: conflict.dest,
                        verification: 'OVERWRITTEN'
                    });
                } else {
                    results.failed.push({ file: conflict.name, source: conflict.source, error: "Verification Failed After Overwrite" });
                }
            } catch (err) {
                results.failed.push({ file: conflict.name, source: conflict.source, error: err.message });
            }
        }
    }

    // Update log
    logIngestOperation({
        id: logId,
        projectMetadata, // Should be same
        timestamp: new Date().toISOString(),
        destination,
        description: `Ingest (Resolved: ${action})`, // Append description?
        results,
        remainingConflicts: 0 // Assumed
    });

    return results;
});

function logIngestOperation(entry) {
    const currentLogs = store.get('ingestLogs') || [];
    let logEntry;

    // Attempt update
    if (entry.id) {
        const index = currentLogs.findIndex(l => l.id === entry.id);
        if (index !== -1) {
            const oldLog = currentLogs[index];
            const newDetails = { ...oldLog.details };

            if (entry.results.copied) newDetails.copied = [...(newDetails.copied || []), ...entry.results.copied];
            if (entry.results.skipped) newDetails.skipped = [...(newDetails.skipped || []), ...entry.results.skipped];
            if (entry.results.failed) newDetails.failed = [...(newDetails.failed || []), ...entry.results.failed];

            // Note: entry.results.conflicts usually not passed in resolution update

            logEntry = {
                ...oldLog,
                description: entry.description ? `${oldLog.description} > ${entry.description}` : oldLog.description, // Chain descriptions or replace? Replace for now but maybe append
                details: newDetails,
                filesCopied: (newDetails.copied?.length || 0),
                filesSkipped: (newDetails.skipped?.length || 0),
                filesFailed: (newDetails.failed?.length || 0),
                filesConflict: entry.remainingConflicts !== undefined ? entry.remainingConflicts : (oldLog.filesConflict || 0),
                status: (newDetails.failed?.length > 0) ? 'WARNING' : ((entry.remainingConflicts > 0 && entry.remainingConflicts !== undefined) ? 'WARNING' : 'SUCCESS')
            };

            currentLogs[index] = logEntry;
            store.set('ingestLogs', currentLogs);
            return;
        }
    }

    // Create New
    const newId = entry.id || Date.now().toString();
    logEntry = {
        id: newId,
        timestamp: entry.timestamp,
        ...entry.projectMetadata,
        destination: entry.destination,
        sourceDirectory: entry.sourceDirectory,
        description: entry.description || "Ingest Operation",
        details: entry.results,
        filesCopied: entry.results.copied ? entry.results.copied.length : 0,
        filesSkipped: entry.results.skipped ? entry.results.skipped.length : 0,
        filesFailed: entry.results.failed ? entry.results.failed.length : 0,
        filesConflict: entry.results.conflicts ? entry.results.conflicts.length : 0,
        status: (entry.results.failed && entry.results.failed.length > 0) ? 'WARNING' : ((entry.results.conflicts && entry.results.conflicts.length > 0) ? 'WARNING' : 'SUCCESS')
    };

    store.set('ingestLogs', [logEntry, ...currentLogs]);
}

ipcMain.handle('logs:get', () => {
    return store.get('ingestLogs') || [];
});

ipcMain.handle('logs:clear', () => {
    store.set('ingestLogs', []);
    return true;
});

ipcMain.handle('projects:delete', async (event, projectId) => {
    const projects = store.get('projects') || [];
    const filtered = projects.filter(p => p.id !== projectId);
    store.set('projects', filtered);
    return true;
});

ipcMain.handle('projects:get', () => {
    return store.get('projects') || [];
});

ipcMain.handle('utils:openPath', async (event, targetPath) => {
    await shell.openPath(targetPath);
});

ipcMain.handle('utils:openExternal', async (event, url) => {
    await shell.openExternal(url);
});

ipcMain.handle('dialog:saveJSON', async (event, { title, defaultPath, data }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title,
        defaultPath,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (canceled || !filePath) return null;

    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        return { success: true, filePath };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('dialog:readJSON', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        properties: ['openFile']
    });

    if (canceled || !filePaths.length) return null;

    try {
        const content = await fs.readFile(filePaths[0], 'utf-8');
        const data = JSON.parse(content);
        return { success: true, data, filePath: filePaths[0] };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { connectDb } = require('./database/database');

const SESSIONS_DIR = path.join(__dirname, 'sessions');

const activeSockets = new Map();
const runningTasks = new Map();
// Track which sessions are being reconnected (to avoid duplicate reconnects)
const reconnectingSet = new Set();

let broadcastFunction = null;

function setBroadcastFunction(fn) {
    broadcastFunction = fn;
}

function broadcastLog(message, level = 'info') {
    console.log(`[${level.toUpperCase()}] ${message}`);
    if (broadcastFunction) {
        broadcastFunction({ type: 'log', message, level });
    }
}

async function updateSessionStatus(sessionId, status, log = null) {
    const db = await connectDb();
    await db.run('UPDATE sessions SET status = ?, last_log = ? WHERE id = ?', [status, log, sessionId]);

    if (log) {
        broadcastLog(`Session ${sessionId}: ${log}`, status === 'connected' ? 'info' : status === 'disconnected' ? 'error' : 'warning');
    }

    if (broadcastFunction) {
        broadcastFunction({ type: 'status_update', sessionId, status, log });
    }
}

async function updateTaskStatus(taskId, status, log = null) {
    const db = await connectDb();
    await db.run('UPDATE tasks SET status = ?, last_log = ? WHERE id = ?', [status, log, taskId]);

    if (log) {
        broadcastLog(`Task ${taskId}: ${log}`, status === 'running' ? 'info' : 'warning');
    }

    if (broadcastFunction) {
        broadcastFunction({ type: 'status_update', taskId, status, log });
    }
}

// ✅ FIX: Auto-reconnect with retry logic
async function startSession(sessionId, retryCount = 0) {
    // Agar already connected hai toh wahi return karo
    if (activeSockets.has(sessionId)) return activeSockets.get(sessionId);

    const sessionFile = path.join(SESSIONS_DIR, `session-${sessionId}`);
    if (!fs.existsSync(sessionFile)) {
        await updateSessionStatus(sessionId, 'logged_out', 'Session file missing.');
        return null;
    }

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionFile);

        // ✅ FIX: Version hardcode - internet fail hone par bhi kaam kare
        let version;
        try {
            const result = await fetchLatestBaileysVersion();
            version = result.version;
        } catch (e) {
            version = [2, 3000, 1019140517]; // fallback version
            broadcastLog(`Session ${sessionId}: Using fallback Baileys version`, 'warning');
        }

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            generateHighQualityLinkPreview: false,
            // ✅ FIX: Keep-alive settings
            keepAliveIntervalMs: 30000,
            connectTimeoutMs: 60000,
            retryRequestDelayMs: 2000,
        });

        activeSockets.set(sessionId, sock);
        await updateSessionStatus(sessionId, 'connecting');

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                activeSockets.delete(sessionId);
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'Unknown error';

                if (statusCode === DisconnectReason.loggedOut) {
                    // ✅ Logged out - session delete karo, restart mat karo
                    fs.rmSync(sessionFile, { recursive: true, force: true });
                    await updateSessionStatus(sessionId, 'logged_out', 'Logged out from WhatsApp. Please re-scan QR.');
                    await stopTasksForSession(sessionId);
                } else {
                    // ✅ FIX: Koi bhi aur reason ho - AUTO RECONNECT KARO
                    broadcastLog(`Session ${sessionId}: Disconnected (${errorMessage}). Auto-reconnecting...`, 'warning');
                    await updateSessionStatus(sessionId, 'connecting', `Reconnecting... (attempt ${retryCount + 1})`);

                    // Exponential backoff: 5s, 10s, 20s, max 60s
                    const delay = Math.min(5000 * Math.pow(2, retryCount), 60000);
                    
                    setTimeout(async () => {
                        if (!reconnectingSet.has(sessionId)) {
                            reconnectingSet.add(sessionId);
                            try {
                                await startSession(sessionId, retryCount + 1);
                            } finally {
                                reconnectingSet.delete(sessionId);
                            }
                        }
                    }, delay);
                }
            } else if (connection === 'open') {
                // ✅ Connected - retry count reset karo aur tasks restart karo
                const userName = sock.user?.name || 'Unknown User';
                const userNumber = sock.user?.id?.split(':')[0] || 'Unknown Number';
                const log = `Connected as ${userName} (${userNumber})`;
                await updateSessionStatus(sessionId, 'connected', log);
                broadcastLog(`Session ${sessionId}: ${log}`, 'info');

                // ✅ FIX: Reconnect ke baad jo tasks running the unhe restart karo
                await restartTasksForSession(sessionId);
            }
        });

        return sock;
    } catch (error) {
        broadcastLog(`Session ${sessionId}: Failed to start - ${error.message}`, 'error');
        await updateSessionStatus(sessionId, 'disconnected', `Failed to start: ${error.message}`);

        // ✅ Retry after error
        const delay = Math.min(5000 * Math.pow(2, retryCount), 60000);
        broadcastLog(`Session ${sessionId}: Retrying in ${delay / 1000}s...`, 'warning');
        setTimeout(async () => {
            if (!reconnectingSet.has(sessionId)) {
                reconnectingSet.add(sessionId);
                try {
                    await startSession(sessionId, retryCount + 1);
                } finally {
                    reconnectingSet.delete(sessionId);
                }
            }
        }, delay);

        return null;
    }
}

// ✅ FIX: Session reconnect hone ke baad running tasks restart karo
async function restartTasksForSession(sessionId) {
    const db = await connectDb();
    const tasks = await db.all('SELECT id FROM tasks WHERE session_id = ? AND status = ?', [sessionId, 'running']);
    for (const task of tasks) {
        if (!runningTasks.has(task.id)) {
            broadcastLog(`Restarting task ${task.id} after session reconnect`, 'info');
            await startTask(task.id);
        }
    }
}

async function stopTasksForSession(sessionId) {
    const db = await connectDb();
    const tasks = await db.all('SELECT id FROM tasks WHERE session_id = ? AND status = ?', [sessionId, 'running']);
    for (const task of tasks) {
        await stopTask(task.id);
    }
}

async function startTask(taskId) {
    // Agar pehle se chal raha hai toh dobara mat chalao
    if (runningTasks.has(taskId)) return;

    const db = await connectDb();
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', taskId);
    if (!task) return;

    const sock = await startSession(task.session_id);
    if (!sock) {
        await updateTaskStatus(taskId, 'running', 'Session starting, task will begin once connected.');
        return;
    }

    await updateTaskStatus(taskId, 'running', 'Task started.');

    let target = task.target;
    let messages = [];

    try {
        messages = JSON.parse(task.messages || '[]');
    } catch (e) {
        await updateTaskStatus(taskId, 'stopped', 'Invalid task configuration.');
        return;
    }

    if (!target || messages.length === 0) {
        await updateTaskStatus(taskId, 'stopped', 'No target or messages configured.');
        return;
    }

    if (task.target_type === 'group') {
        if (!target.includes('@g.us')) target = target + '@g.us';
    } else {
        if (!target.includes('@c.us')) target = target + '@c.us';
    }

    let messageIndex = 0;

    const intervalId = setInterval(async () => {
        // ✅ FIX: Har baar check karo ki socket abhi bhi active hai
        const currentSock = activeSockets.get(task.session_id);
        if (!currentSock) {
            // Socket disconnect hai - interval rok do, session reconnect hone par restart hoga
            clearInterval(runningTasks.get(taskId));
            runningTasks.delete(taskId);
            await updateTaskStatus(taskId, 'running', 'Session disconnected, waiting for reconnect...');
            return;
        }

        try {
            let message = messages[messageIndex % messages.length];

            if (message && message.trim()) {
                if (task.prefix_name && task.prefix_name.trim()) {
                    message = `${task.prefix_name.trim()}: ${message}`;
                }

                await currentSock.sendMessage(target, { text: message });

                const targetType = target.includes('@g.us') ? 'Group' : 'Contact';
                const targetDisplay = target.replace('@g.us', '').replace('@c.us', '');
                await updateTaskStatus(taskId, 'running', `Sent to ${targetType} (${targetDisplay}): "${message}"`);
            }

            messageIndex++;
        } catch (error) {
            broadcastLog(`Task ${taskId} send error: ${error.message}`, 'error');
            await updateTaskStatus(taskId, 'running', `Send error: ${error.message} - retrying next interval`);
        }
    }, task.interval * 1000);

    runningTasks.set(taskId, intervalId);
    broadcastLog(`Task ${taskId} started`, 'info');
}

async function getGroups(sessionId) {
    const sock = activeSockets.get(sessionId);
    if (!sock) return [];

    try {
        const groups = await sock.groupFetchAllParticipating();
        const groupList = [];
        for (const [groupId, group] of Object.entries(groups)) {
            groupList.push({
                id: groupId,
                name: group.subject || 'Unknown Group',
                participants: group.participants ? group.participants.length : 0
            });
        }
        return groupList;
    } catch (error) {
        console.error('Error fetching groups:', error);
        return [];
    }
}

async function stopTask(taskId) {
    if (runningTasks.has(taskId)) {
        clearInterval(runningTasks.get(taskId));
        runningTasks.delete(taskId);
    }
    await updateTaskStatus(taskId, 'stopped', 'Task stopped by user.');
    broadcastLog(`Task ${taskId} stopped`, 'warning');
}

async function initializeRunningTasks() {
    broadcastLog("Initializing tasks from previous session...", 'info');
    const db = await connectDb();

    // ✅ FIX: Pehle sessions start karo jo tasks mein use ho rahe hain
    const tasksToRun = await db.all('SELECT DISTINCT session_id FROM tasks WHERE status = ?', 'running');
    for (const row of tasksToRun) {
        broadcastLog(`Pre-starting session ${row.session_id}...`, 'info');
        startSession(row.session_id); // async - background mein chalega
    }

    // Thoda wait karo sessions ke connect hone ke liye
    await new Promise(resolve => setTimeout(resolve, 3000));

    const tasks = await db.all('SELECT id FROM tasks WHERE status = ?', 'running');
    for (const task of tasks) {
        await startTask(task.id);
    }
    broadcastLog(`Initialized ${tasks.length} tasks.`, 'info');
}

module.exports = {
    startSession,
    startTask,
    stopTask,
    initializeRunningTasks,
    setBroadcastFunction,
    broadcastLog,
    getGroups
};

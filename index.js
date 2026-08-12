const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const WebSocket = require('ws');
const fileUpload = require('express-fileupload');

// --- Safe Import for Bot Manager ---
let initializeRunningTasks, setBroadcastFunction;
try {
    const botManager = require('./botManager');
    initializeRunningTasks = botManager.initializeRunningTasks;
    setBroadcastFunction = botManager.setBroadcastFunction;
} catch (err) {
    console.log('botManager import warning:', err.message);
}

// --- Safe Imports for Routes & Database (Server crash hone se bachane ke liye) ---
let authRoutes, apiRoutes, initDb;
try { authRoutes = require('./routes/auth'); } catch (e) { console.log('routes/auth file nahi mili, ignore kar rahe hain.'); }
try { apiRoutes = require('./routes/api'); } catch (e) { console.log('routes/api file nahi mili, ignore kar rahe hain.'); }
try { 
    const db = require('./database/database'); 
    initDb = db.initDb; 
} catch (e) { 
    console.log('database/database file nahi mili, ignore kar rahe hain.'); 
}

// --- Basic Setup ---
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

app.use(session({
    secret: 'a-very-secret-key-that-you-should-change',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Serve static files from 'public'
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'views', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.send('Server live ho chuka hai! (views/index.html nahi mili)');
        }
    });
});

// --- Routes (Agar files milengi tabhi load hongi) ---
if (authRoutes) app.use('/auth', authRoutes);
if (apiRoutes) app.use('/api', apiRoutes);

// --- WebSocket Server ---
const wss = new WebSocket.Server({ server });
const userSockets = new Map();

wss.on('connection', (ws, req) => {
    console.log('Client connected via WebSocket');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'auth' && data.userId) {
                userSockets.set(data.userId, ws);
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('Client disconnected');
        for (const [userId, socket] of userSockets.entries()) {
            if (socket === ws) {
                userSockets.delete(userId);
                break;
            }
        }
    });
    
    ws.send(JSON.stringify({
        type: 'log',
        message: 'Connected to real-time updates',
        level: 'info'
    }));
});

function broadcastToAll(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

if (typeof setBroadcastFunction === 'function') {
    setBroadcastFunction(broadcastToAll);
}

// --- Server Initialization ---
async function startServer() {
    if (typeof initDb === 'function') {
        try {
            await initDb();
        } catch (e) {
            console.error('DB Init Error:', e.message);
        }
    }

    if (typeof initializeRunningTasks === 'function') {
        try {
            await initializeRunningTasks();
        } catch (e) {
            console.error('Running Tasks Error:', e.message);
        }
    }

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is listening on port ${PORT}`);
    });
}

startServer();

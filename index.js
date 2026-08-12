
const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const WebSocket = require('ws');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const { initializeRunningTasks, setBroadcastFunction } = require('./botManager');
const { connectDb, initDb } = require('./database/database');

// --- Basic Setup ---
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 21247;

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const fileUpload = require('express-fileupload');
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
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// --- Routes ---
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

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

setBroadcastFunction(broadcastToAll);

// --- Server Initialization ---
async function startServer() {
    await initDb(); // FIX: initDb() call karo taaki tables ban sake
    await initializeRunningTasks();

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is listening on http://0.0.0.0:${PORT}`);
    });
}

startServer();

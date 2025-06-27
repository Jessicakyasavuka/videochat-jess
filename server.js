const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const HTTP_PORT = process.env.PORT || 3000; // Port pour le serveur HTTP
const WS_PORT = process.env.PORT || 8080;   // Port pour le serveur WebSocket (Render utilise le même port pour HTTP et WS)

// Serveur HTTP pour servir les fichiers statiques
const httpServer = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './call_only.html'; // Servir call_only.html par défaut
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8'); // Simplifié pour l'exemple
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

httpServer.listen(HTTP_PORT, () => {
    console.log(`Serveur HTTP en écoute sur http://localhost:${HTTP_PORT}`);
});

// Serveur WebSocket
const wss = new WebSocket.Server({ server: httpServer }); // Utiliser le serveur HTTP existant
let callRooms = {}; // Stocke les salles d'appel, chaque salle contient les utilisateurs

wss.on('connection', socket => {
    // Attacher les informations d'utilisateur et de salle directement au socket
    socket.userName = null;
    socket.callId = null;

    socket.on('message', message => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.error('Invalid JSON', e);
            return;
        }

        switch (data.type) {
            case 'login':
                socket.userName = data.name;
                console.log(`${socket.userName} est connecté au serveur de signalisation.`);
                break;

            case 'create_call':
                socket.callId = data.callId;
                if (!callRooms[socket.callId]) {
                    callRooms[socket.callId] = {};
                }
                callRooms[socket.callId][socket.userName] = socket;
                console.log(`${socket.userName} a créé la salle d'appel : ${socket.callId}`);
                break;

            case 'join_call':
                socket.callId = data.callId;
                console.log(`Tentative de rejoindre la salle: ${socket.callId}. État actuel des salles:`, Object.keys(callRooms));
                if (callRooms[socket.callId]) {
                    callRooms[socket.callId][socket.userName] = socket;
                    console.log(`${socket.userName} a rejoint la salle d'appel : ${socket.callId}`);

                    // Informer tous les autres participants de la salle de la nouvelle arrivée
                    for (let userInRoom in callRooms[socket.callId]) {
                        if (userInRoom !== socket.userName) {
                            callRooms[socket.callId][userInRoom].send(JSON.stringify({
                                type: 'new_participant', // Nouveau type pour informer de l'arrivée
                                from: socket.userName,
                                callId: socket.callId
                            }));
                            console.log(`Signal 'new_participant' envoyé à ${userInRoom} par ${socket.userName}`);
                        }
                    }
                } else {
                    socket.send(JSON.stringify({ type: 'error', message: 'Salle d\'appel non trouvée.' }));
                    console.log(`Tentative de rejoindre une salle inexistante : ${socket.callId}`);
                }
                break;

            case 'signal':
                if (socket.callId && callRooms[socket.callId]) {
                    for (let userInRoom in callRooms[socket.callId]) {
                        if (userInRoom !== socket.userName) {
                            callRooms[socket.callId][userInRoom].send(JSON.stringify({
                                type: 'signal',
                                from: socket.userName,
                                callId: socket.callId,
                                signalData: data.signalData
                            }));
                            console.log(`Signal de ${socket.userName} envoyé à ${userInRoom} dans la salle ${socket.callId}`);
                        }
                    }
                } else {
                    console.warn(`Signal reçu sans salle d'appel ou utilisateur non connecté: ${socket.userName}, ${socket.callId}`);
                }
                break;

            case 'hangup':
                if (socket.callId && callRooms[socket.callId]) {
                    for (let userInRoom in callRooms[socket.callId]) {
                        if (userInRoom !== socket.userName) {
                            callRooms[socket.callId][userInRoom].send(JSON.stringify({
                                type: 'hangup',
                                from: socket.userName,
                                callId: socket.callId
                            }));
                            console.log(`${socket.userName} a raccroché dans la salle ${socket.callId}. Signal envoyé à ${userInRoom}`);
                        }
                    }
                    // Supprimer l'utilisateur de la salle
                    delete callRooms[socket.callId][socket.userName];
                    if (Object.keys(callRooms[socket.callId]).length === 0) {
                        delete callRooms[socket.callId]; // Supprimer la salle si elle est vide
                        console.log(`Salle ${socket.callId} supprimée car vide.`);
                    }
                }
                break;
        }
    });

    socket.on('close', () => {
        if (socket.callId && socket.userName && callRooms[socket.callId]) {
            console.log(`${socket.userName} s'est déconnecté de la salle ${socket.callId}.`);
            delete callRooms[socket.callId][socket.userName];
            if (Object.keys(callRooms[socket.callId]).length === 0) {
                delete callRooms[socket.callId];
                console.log(`Salle ${socket.callId} supprimée car vide.`);
            } else {
                // Informer les autres utilisateurs de la salle que cet utilisateur s'est déconnecté
                for (let userInRoom in callRooms[socket.callId]) {
                    callRooms[socket.callId][userInRoom].send(JSON.stringify({
                        type: 'user_disconnected',
                        from: socket.userName,
                        callId: socket.callId
                    }));
                }
            }
        } else if (socket.userName) {
            console.log(`${socket.userName} s'est déconnecté du serveur de signalisation.`);
        }
    });
});

// Le message de log pour le serveur WebSocket n'est plus nécessaire ici car il est géré par le serveur HTTP
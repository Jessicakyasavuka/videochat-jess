const WebSocket = require('ws');

const server = new WebSocket.Server({ port: 8080 });
let users = {};

server.on('connection', socket => {
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
                users[data.name] = socket;
                console.log(`${data.name} est connecté`);
                break;

            case 'call':
                let targetSocket = users[data.target];
                if (targetSocket) {
                    targetSocket.send(JSON.stringify({
                        type: 'incoming_call',
                        from: data.name
                    }));
                    console.log(`${data.name} appelle ${data.target}`);
                }
                break;

            case 'accept_call':
                let callerSocket = users[data.target];
                if (callerSocket) {
                    callerSocket.send(JSON.stringify({
                        type: 'call_accepted',
                        from: data.name
                    }));
                    console.log(`${data.name} a accepté l'appel de ${data.target}`);
                }
                break;

            case 'signal':
                let receiverSocket = users[data.target];
                if (receiverSocket) {
                    receiverSocket.send(JSON.stringify({
                        type: 'signal',
                        from: data.name,
                        signalData: data.signalData
                    }));
                }
                break;

            case 'logout':
                delete users[data.name];
                break;
        }
    });

    socket.on('close', () => {
        for (let name in users) {
            if (users[name] === socket) {
                delete users[name];
                break;
            }
        }
    });
});

console.log('Serveur WebSocket en écoute sur ws://localhost:8080');
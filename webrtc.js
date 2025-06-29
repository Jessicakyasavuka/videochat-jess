let localStream;
let remoteStream;
let peerConnection;
let isMuted = false;
let connection; // Déclarée ici pour être accessible globalement dans webrtc.js
let myUsername; // Déclarée ici pour être accessible globalement dans webrtc.js
let currentCallId; // Déclarée ici pour être accessible globalement dans webrtc.js
let isCallCreator; // Déclarée ici pour être accessible globalement dans webrtc.js

const iceServersConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.voipbuster.com:3478' }, // Ajout d'un serveur STUN supplémentaire
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:numb.viagenie.ca',
            username: 'webrtc@live.com',
            credential: 'muazkh'
        }
    ]
};

// Accès à la caméra et au micro
async function startLocalStream() {
    console.log('Tentative de démarrage du flux local...');
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('localVideo').srcObject = localStream;
        console.log('Flux local démarré avec succès.');
    } catch (err) {
        console.error("Erreur d'accès à la caméra/micro:", err);
        alert("Impossible d'accéder à la caméra/micro. Veuillez vérifier les permissions.");
    }
}

// Réinitialiser l'état WebRTC
function resetWebRTCState() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    document.getElementById('remoteVideo').srcObject = null;
    document.getElementById('localVideo').srcObject = null;
}

// Démarrer la connexion PeerConnection
function startPeerConnection(targetUserForSignal) {
    console.log('Démarrage de PeerConnection avec cible:', targetUserForSignal);
    peerConnection = new RTCPeerConnection(iceServersConfig);

    peerConnection.onicecandidate = (event) => {
        console.log('ICE Candidate:', event.candidate);
        if (event.candidate) {
            console.log('Envoi de ICE Candidate au serveur.');
            connection.send(JSON.stringify({
                type: 'signal',
                name: myUsername,
                target: targetUserForSignal, // La cible est l'autre utilisateur spécifique
                callId: currentCallId, // Inclure l'ID d'appel
                signalData: { type: 'ice', candidate: event.candidate }
            }));
        }
    };

    peerConnection.ontrack = (event) => {
        console.log('Flux distant reçu (ontrack) :', event.streams[0]);
        if (event.streams && event.streams[0]) {
            document.getElementById('remoteVideo').srcObject = event.streams[0];
            console.log('Flux distant assigné à remoteVideo.');
        } else {
            console.warn('Aucun flux valide dans event.streams[0] pour ontrack.');
        }
    };

    peerConnection.onconnectionstatechange = (event) => {
        console.log('Connection State Change:', peerConnection.connectionState);
    };

    peerConnection.oniceconnectionstatechange = (event) => {
        console.log('ICE Connection State Change:', peerConnection.iceConnectionState);
    };

    if (localStream) {
        console.log('Ajout des pistes locales à PeerConnection.');
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    } else {
        console.log('Démarrage du flux local avant d\'ajouter les pistes.');
        startLocalStream().then(() => {
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        });
    }
}

async function createAndSendOffer() {
    console.log('Création et envoi de l\'offre...');
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    connection.send(JSON.stringify({
        type: 'signal',
        name: myUsername,
        target: currentCallId, // La cible est l'ID de l'appel pour le routage serveur
        callId: currentCallId,
        signalData: { type: 'offer', offer: offer }
    }));
    console.log('Offre envoyée.');
}

async function createAndSendAnswer() {
    console.log('Création et envoi de la réponse...');
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    connection.send(JSON.stringify({
        type: 'signal',
        name: myUsername,
        target: currentCallId, // La cible est l'ID de l'appel pour le routage serveur
        callId: currentCallId,
        signalData: { type: 'answer', answer: answer }
    }));
    console.log('Réponse envoyée.');
}

async function handleSignal(from, signal) {
    console.log(`Gestion du signal de ${from}:`, signal.type);
    if (signal.type === 'offer') {
        if (!peerConnection) {
            console.log('PeerConnection non existante, création pour l\'offre entrante.');
            startPeerConnection(from); // La cible pour la réponse est l'expéditeur de l'offre
        }
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.offer));
        console.log('Offre distante définie. Création et envoi de la réponse.');
        createAndSendAnswer(); // Répondre à l'offre
    } else if (signal.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.answer));
        console.log('Réponse distante définie.');
    } else if (signal.type === 'ice') {
        if (peerConnection && signal.candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
            console.log('ICE Candidate ajouté.');
        } else {
            console.warn('Impossible d\'ajouter ICE Candidate: peerConnection non défini ou candidate manquant.');
        }
    }
}

function handleRemoteHangUp() {
    alert('L\'autre partie a raccroché.');
    resetWebRTCState();
    // showSection('initial-options'); // Cette partie sera gérée par call_only.html
}

// Fonction Mute / Unmute Micro
function toggleMute() {
    if (!localStream) return;

    localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
    });

    isMuted = !isMuted;
    document.getElementById('muteBtn').innerText = isMuted ? "🔊 Unmute" : "🔇 Mute";
}

// Fonction pour Raccrocher
function hangUpCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    document.getElementById('remoteVideo').srcObject = null;
    // La signalisation de raccrochage sera gérée par call_only.html
}

// Initialisation de la logique WebRTC et gestion des messages WebSocket
function initWebRTC(wsConnection, user, callId, creatorStatus, onIncomingCallCallback, onCallAcceptedCallback) {
    connection = wsConnection;
    myUsername = user;
    currentCallId = callId;
    isCallCreator = creatorStatus;

    connection.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Message reçu dans webrtc.js :', data);

        switch (data.type) {
            case 'new_participant':
                alert(`Un nouveau participant a rejoint l'appel : ${data.from}`);
                if (isCallCreator) {
                    startPeerConnection(data.from);
                    createAndSendOffer();
                }
                break;
            case 'signal':
                handleSignal(data.from, data.signalData);
                break;
            case 'hangup':
                handleRemoteHangUp();
                break;
            case 'user_disconnected':
                alert(`${data.from} a quitté l'appel.`);
                break;
            case 'error':
                alert('Erreur du serveur: ' + data.message);
                break;
            case 'incoming_call':
                if (onIncomingCallCallback) {
                    onIncomingCallCallback(data.from, data.callId);
                }
                break;
            case 'call_accepted':
                if (onCallAcceptedCallback) {
                    onCallAcceptedCallback(data.from);
                }
                // Si nous sommes l'appelant et que l'appel est accepté, nous devons initier la PeerConnection et envoyer l'offre.
                // Ceci est déjà géré par new_participant si le serveur envoie ce type de message.
                // Si le serveur envoie 'call_accepted' sans 'new_participant', nous devons le gérer ici.
                if (isCallCreator) { // Si je suis celui qui a initié l'appel
                    startPeerConnection(data.from); // Démarrer la PeerConnection avec celui qui a accepté
                    createAndSendOffer(); // Envoyer l'offre
                }
                break;
        }
    };

    connection.onerror = (error) => {
        console.error("❌ Erreur WebSocket dans webrtc.js :", error);
        alert("Erreur de connexion WebSocket. Veuillez vérifier le serveur.");
    };

    connection.onclose = () => {
        console.log("❌ Déconnecté du serveur WebSocket dans webrtc.js");
        // resetCallState(); // Cette partie sera gérée par call_only.html
        alert('Déconnecté du serveur ou l\'appel a été raccroché.');
        // showSection('initial-options'); // Cette partie sera gérée par call_only.html
    };
}

// Exposer les fonctions nécessaires globalement pour call_only.html
window.startLocalStream = startLocalStream;
window.resetWebRTCState = resetWebRTCState;
window.initWebRTC = initWebRTC;
window.toggleMute = toggleMute;
window.hangUpCall = hangUpCall;
window.startPeerConnection = startPeerConnection; // Exposer pour le créateur d'appel
window.createAndSendOffer = createAndSendOffer; // Exposer pour le créateur d'appel
window.myUsername = myUsername; // Exposer myUsername
window.currentCallId = currentCallId; // Exposer currentCallId
window.isCallCreator = isCallCreator; // Exposer isCallCreator
window.connection = connection; // Exposer la connexion WebSocket
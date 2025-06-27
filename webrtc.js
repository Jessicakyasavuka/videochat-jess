let localStream;
let remoteStream;
let peerConnection;
let isMuted = false;

const servers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
    ],
};

// Accès à la caméra et au micro
async function startLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('localVideo').srcObject = localStream;
    } catch (err) {
        console.error("Erreur d'accès à la caméra/micro:", err);
    }
}

// Créer et démarrer la connexion WebRTC
async function startCall(socket, targetUserId) {
    peerConnection = new RTCPeerConnection(servers);

    // Ajout du flux local
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Quand un flux distant arrive
    peerConnection.ontrack = (event) => {
        if (!remoteStream) {
            remoteStream = new MediaStream();
            document.getElementById('remoteVideo').srcObject = remoteStream;
        }
        remoteStream.addTrack(event.track);
    };

    // ICE Candidate
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                to: targetUserId,
                candidate: event.candidate
            });
        }
    };

    // Création de l'offre
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Envoi de l'offre au serveur de signalisation
    socket.emit('offer', {
        to: targetUserId,
        offer: offer
    });
}

// Réception d'une offre
async function handleOffer(socket, offer, fromUserId) {
    peerConnection = new RTCPeerConnection(servers);

    // Ajout du flux local
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Flux distant
    peerConnection.ontrack = (event) => {
        if (!remoteStream) {
            remoteStream = new MediaStream();
            document.getElementById('remoteVideo').srcObject = remoteStream;
        }
        remoteStream.addTrack(event.track);
    };

    // ICE
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                to: fromUserId,
                candidate: event.candidate
            });
        }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', {
        to: fromUserId,
        answer: answer
    });
}

// Réception d'une réponse
async function handleAnswer(answer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

// Réception d'un ICE Candidate
async function handleICECandidate(candidate) {
    if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
}

// Fonction Mute / Unmute Micro
function toggleMute() {
    if (!localStream) return;

    localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
    });

    isMuted = !isMuted;
    document.getElementById('muteButton').innerText = isMuted ? "Unmute" : "Mute";
}

// Fonction pour Raccrocher
function hangUp(socket, targetUserId) {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    document.getElementById('remoteVideo').srcObject = null;

    socket.emit('hangup', { to: targetUserId });
}

// Fonction quand l'autre raccroche
function handleRemoteHangUp() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    document.getElementById('remoteVideo').srcObject = null;
}
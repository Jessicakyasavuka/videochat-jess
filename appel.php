<?php
session_start();
if (!isset($_SESSION['user'])) {
    header('Location: index.php');
    exit();
}

$monUsername = $_SESSION['user'];
$cible = isset($_GET['cible']) ? $_GET['cible'] : '';
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Appel Vidéo avec <?php echo htmlspecialchars($cible); ?></title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <style>
        video {
            border: 2px solid #333;
            border-radius: 10px;
            margin-bottom: 10px;
        }
        #controls button {
            margin-right: 10px;
        }
    </style>
</head>
<body class="container mt-4">

    <h3>Appel Vidéo avec <?php echo htmlspecialchars($cible); ?></h3>

    <div class="row">
        <div class="col-md-6">
            <h5>Ma vidéo (local)</h5>
            <video id="localVideo" autoplay muted playsinline style="width:100%; height:auto;"></video>
        </div>
        <div class="col-md-6">
            <h5>Vidéo distante</h5>
            <video id="remoteVideo" autoplay playsinline style="width:100%; height:auto;"></video>
        </div>
    </div>

    <div id="controls" class="mt-3">
        <button id="appelBtn" class="btn btn-primary">📞 Appeler <?php echo htmlspecialchars($cible); ?></button>
        <button id="acceptBtn" class="btn btn-success" style="display:none;">✅ Accepter l'appel</button>
        <button id="muteBtn" class="btn btn-warning">🔇 Mute</button>
        <button id="hangupBtn" class="btn btn-danger">❌ Raccrocher</button>
    </div>

<script src="webrtc.js"></script>
<script>
    const monUsername = "<?php echo $monUsername; ?>";
    const cible = "<?php echo $cible; ?>";

    // Initialiser la connexion WebSocket et WebRTC via webrtc.js
    // Utiliser une URL relative pour le WebSocket si le serveur Node.js est sur le même hôte
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const connection = new WebSocket('wss://fresh-parents-pick.loca.lt');

    connection.onopen = () => {
        console.log("✅ Connecté au serveur WebSocket !");
        // Envoyer le login après l'ouverture de la connexion
        connection.send(JSON.stringify({ type: 'login', name: monUsername }));

        // Initialiser WebRTC avec la connexion WebSocket et les informations d'appel
        // Pour un appel direct, nous n'avons pas d'ID d'appel généré, nous utilisons la cible comme ID d'appel
        // et l'appelant est le créateur de l'appel.
        // Définir les callbacks pour les appels entrants et acceptés
        const onIncomingCall = (fromUser, callId) => {
            alert('📞 Appel entrant de : ' + fromUser);
            document.getElementById('acceptBtn').style.display = 'inline-block';
            document.getElementById('acceptBtn').onclick = () => {
                connection.send(JSON.stringify({
                    type: 'accept_call',
                    name: monUsername,
                    target: fromUser,
                    callId: callId
                }));
                startPeerConnection(fromUser); // Démarrer la PeerConnection avec l'expéditeur de l'appel
            };
        };

        const onCallAccepted = (fromUser) => {
            console.log('Appel accepté par ' + fromUser);
            // La logique de startPeerConnection et createAndSendOffer est déjà dans webrtc.js
            // si isCallCreator est true et que le serveur envoie un 'call_accepted' après un 'new_participant'.
            // Si le serveur envoie 'call_accepted' directement, webrtc.js le gérera.
        };

        initWebRTC(connection, monUsername, cible, true, onIncomingCall, onCallAccepted); // true car l'appelant est le créateur

        // Démarrer le flux local et la PeerConnection
        startLocalStream().then(() => {
            startPeerConnection(cible); // La cible est l'utilisateur à appeler
            // Envoyer un signal 'call' au serveur pour initier l'appel
            connection.send(JSON.stringify({
                type: 'call',
                name: monUsername,
                target: cible,
                callId: cible // Utiliser la cible comme ID d'appel
            }));
        });
    };

    // Gestionnaires d'événements pour les boutons
    document.getElementById('appelBtn').onclick = () => {
        // La logique d'appel est déjà initiée dans connection.onopen
        console.log('Bouton Appeler cliqué. L\'appel devrait déjà être en cours d\'établissement.');
    };

    document.getElementById('muteBtn').onclick = () => {
        toggleMute(); // Appelle la fonction de webrtc.js
    };

    document.getElementById('hangupBtn').onclick = () => {
        if (window.connection && window.connection.readyState === WebSocket.OPEN) {
            window.connection.send(JSON.stringify({ type: 'hangup', from: monUsername, callId: cible }));
        }
        hangUpCall(); // Appelle la fonction de webrtc.js pour fermer la PeerConnection
        alert('Appel terminé.');
        window.location.href = 'tableau_de_bord.php';
    };
</script>

</body>
</html>
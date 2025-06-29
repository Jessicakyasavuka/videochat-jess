<?php
include 'base.php';
session_start();
$message = '';

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $nom = $_POST['nom'];
    $mdp = $_POST['mdp'];

    $stmt = $pdo->prepare("SELECT * FROM utilisateurs WHERE nom_utilisateur = ?");
    $stmt->execute([$nom]);
    $user = $stmt->fetch();

    if ($user && password_verify($mdp, $user['mot_de_passe'])) {
        $_SESSION['user'] = $user['nom_utilisateur'];
        header('Location: tableau_de_bord.php');
        exit;
    } else {
        $message = "Identifiants incorrects.";
    }
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>Connexion - Appel Vidéo</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
</head>
<body class="container">
    <h2>Connexion</h2>
    <form method="post">
        <input class="form-control" name="nom" placeholder="Nom d'utilisateur" required><br>
        <input class="form-control" name="mdp" type="password" placeholder="Mot de passe" required><br>
        <button class="btn btn-success">Se connecter</button>
    </form>
    <p><?= $message ?></p>
    <p><a href="inscription.php">Créer un compte</a></p>
</body>

<script>
    // Connexion WebSocket au serveur Node.js via LocalTunnel
    const socket = new WebSocket('wss://fresh-parents-pick.loca.lt');

    socket.onopen = function() {
        console.log("✅ Connecté au serveur WebSocket !");
    };

    socket.onerror = function(error) {
        console.error("❌ Erreur WebSocket :", error);
    };

    socket.onmessage = function(event) {
        console.log("📨 Message reçu du serveur :", event.data);
        // Ici tu peux gérer les signaux WebRTC reçus
    };

    socket.onclose = function() {
        console.log("❌ Déconnecté du serveur WebSocket");
    };
</script>
</html>
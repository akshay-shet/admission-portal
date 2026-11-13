<?php
require_once __DIR__ . '/includes/functions.php';

if (!empty($_SESSION['admin'])) {
    header('Location: dashboard.php');
    exit;
}

$error = '';
if (isset($_POST['login'])) {
    $username = post('username');
    $password = post('password');
    $stmt = $conn->prepare("SELECT * FROM admins WHERE username=? LIMIT 1");
    $stmt->bind_param('s', $username);
    $stmt->execute();
    $admin = $stmt->get_result()->fetch_assoc();
    if ($admin && password_verify($password, $admin['password'])) {
        session_regenerate_id(true);
        $_SESSION['admin'] = $admin['username'];
        header('Location: dashboard.php');
        exit;
    }
    $error = 'Invalid username or password';
}
?>
<html><head>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<style>
body {background: linear-gradient(135deg,#667eea,#764ba2);}
.card {border-radius:15px;}
</style>
</head>

<body class="d-flex justify-content-center align-items-center vh-100">

<div class="card p-4 shadow" style="width:350px;">
<h3 class="text-center">Admin Login</h3>

<?php if ($error): ?><div class="alert alert-danger"><?= e($error) ?></div><?php endif; ?>

<form method="POST">
<input name="username" class="form-control mb-2" placeholder="Username">
<input type="password" name="password" class="form-control mb-2" placeholder="Password">
<button name="login" class="btn btn-primary w-100">Login</button>
</form>

</div>

</body></html>

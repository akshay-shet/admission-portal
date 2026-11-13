<?php
require_once __DIR__ . '/../includes/installment.php';
require_login();
$id = (int)($_GET['id'] ?? 0);
$stmt = $conn->prepare("DELETE FROM installments WHERE id=?");
$stmt->bind_param('i', $id);
$stmt->execute();
header('Location: manage_installments.php');
exit;

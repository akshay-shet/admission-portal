<?php
require_once __DIR__ . '/../includes/installment.php';
require_login();
header('Content-Type: application/json');

$id  = (int)($_GET['id'] ?? 0);
$row = get_row($conn, 'installments', $id);
$p   = $row ? student_paid($conn, $row['student_id'], $id) : ['paid' => 0];

echo json_encode([
    'paid'   => (float)$p['paid'],            // paid by this student excluding this installment
    'amount' => $row ? (float)$row['amount'] : 0,
    'total'  => $row ? (float)$row['total_fees'] : 0,
]);

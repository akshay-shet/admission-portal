<?php
require_once __DIR__ . '/../includes/installment.php';
require_login();
header('Content-Type: application/json');

$sid = $_GET['student_id'] ?? '';
$st  = find_student($conn, $sid);
$p   = student_paid($conn, $sid);

$stmt = $conn->prepare("SELECT total_fees, amount, course FROM installments WHERE student_id=? ORDER BY id DESC LIMIT 1");
$stmt->bind_param('s', $sid);
$stmt->execute();
$last = $stmt->get_result()->fetch_assoc();

echo json_encode([
    'paid'             => (float)$p['paid'],
    'count'            => (int)$p['cnt'],
    'total'            => $last['total_fees'] ?? null,
    'admission_year'   => $st['admission_year'] ?? '',
    'admission_batch'  => $st['admission_batch'] ?? '',
    'admission_number' => $st['admission_number'] ?? '',
    'register_number'  => $st['register_number'] ?? '',
    'phone'            => $st['mobile'] ?? '',
    'amount'           => $last['amount'] ?? null,
    'course'           => $last['course'] ?? '',
]);

<?php
require_once __DIR__ . '/functions.php';

/** Find a student (any level) by student code, e.g. SSL002 / PUC010 / DEG003 / PGO001 */
function find_student($conn, $studentId) {
    foreach (['sslc_students', 'puc_students', 'degree_students', 'pg_students'] as $t) {
        $stmt = $conn->prepare("SELECT * FROM `$t` WHERE student_id=? LIMIT 1");
        $stmt->bind_param('s', $studentId);
        $stmt->execute();
        if ($r = $stmt->get_result()->fetch_assoc()) {
            $r['_level'] = $t;
            return $r;
        }
    }
    return null;
}

/** All students across levels for the dropdown */
function all_students($conn) {
    $sql = "SELECT student_id, student_name FROM sslc_students
            UNION ALL SELECT student_id, student_name FROM puc_students
            UNION ALL SELECT student_id, student_name FROM degree_students
            UNION ALL SELECT student_id, student_name FROM pg_students";
    return $conn->query($sql)->fetch_all(MYSQLI_ASSOC);
}

/** Sum paid for a student, optionally excluding one installment */
function student_paid($conn, $studentId, $excludeId = 0) {
    $stmt = $conn->prepare("SELECT COALESCE(SUM(amount),0) AS paid, COUNT(*) AS cnt FROM installments WHERE student_id=? AND id<>?");
    $stmt->bind_param('si', $studentId, $excludeId);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc();
}

const COURSE_OPTIONS = ['SSLC', 'PUC/SCI', 'PUC/COM', 'PUC/ARTS', 'BA', 'B.Com', 'BCA', 'BBA', 'BSC', 'MA', 'M.Com', 'MCA', 'MBA', 'MSC'];
const PAYMENT_MODES  = ['Cash', 'Online', 'UPI', 'Cash/Online'];

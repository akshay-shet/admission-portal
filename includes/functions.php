<?php
require_once __DIR__ . '/../config.php';

function require_login() {
    if (empty($_SESSION['admin'])) {
        header('Location: ' . BASE_URL . '/index.php');
        exit;
    }
}

function e($v) {
    return htmlspecialchars((string)($v ?? ''), ENT_QUOTES, 'UTF-8');
}

function post($key, $default = '') {
    return isset($_POST[$key]) ? trim($_POST[$key]) : $default;
}

function calc_age($dob) {
    if (!$dob || $dob === '0000-00-00') return 0;
    try {
        return (new DateTime($dob))->diff(new DateTime('today'))->y;
    } catch (Exception $ex) {
        return 0;
    }
}

/** Save an uploaded file into /uploads and return the stored file name (or $existing). */
function upload_file($field, $existing = '') {
    if (empty($_FILES[$field]['name']) || $_FILES[$field]['error'] !== UPLOAD_ERR_OK) {
        return $existing;
    }
    $ext = strtolower(pathinfo($_FILES[$field]['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'];
    if (!in_array($ext, $allowed, true)) return $existing;
    $name = $field . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $dir = __DIR__ . '/../uploads/';
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    move_uploaded_file($_FILES[$field]['tmp_name'], $dir . $name);
    return $name;
}

/** Generate next student code: SSL001, PUC001, DEG001, PGO001 */
function next_student_id($conn, $table, $prefix) {
    $res = $conn->query("SELECT student_id FROM `$table` WHERE student_id LIKE '{$prefix}%' ORDER BY CAST(SUBSTRING(student_id," . (strlen($prefix) + 1) . ") AS UNSIGNED) DESC LIMIT 1");
    $n = 1;
    if ($row = $res->fetch_assoc()) {
        $n = (int)substr($row['student_id'], strlen($prefix)) + 1;
    }
    return $prefix . str_pad($n, 3, '0', STR_PAD_LEFT);
}

/** Build a WHERE clause for From/To date filters on created_at */
function date_filter_sql($conn, $col = 'created_at') {
    $w = [];
    if (!empty($_GET['from_date'])) $w[] = "DATE($col) >= '" . $conn->real_escape_string($_GET['from_date']) . "'";
    if (!empty($_GET['to_date']))   $w[] = "DATE($col) <= '" . $conn->real_escape_string($_GET['to_date']) . "'";
    return $w ? ' WHERE ' . implode(' AND ', $w) : '';
}

/** Insert or update a row from an associative array */
function save_row($conn, $table, $data, $id = null) {
    $cols = array_keys($data);
    if ($id === null) {
        $sql = "INSERT INTO `$table` (`" . implode('`,`', $cols) . "`) VALUES (" . implode(',', array_fill(0, count($cols), '?')) . ")";
    } else {
        $sql = "UPDATE `$table` SET `" . implode('`=?,`', $cols) . "`=? WHERE id=?";
    }
    $stmt = $conn->prepare($sql);
    $vals = array_values($data);
    $types = str_repeat('s', count($vals));
    if ($id !== null) { $vals[] = $id; $types .= 'i'; }
    $stmt->bind_param($types, ...$vals);
    $stmt->execute();
    return $id ?? $conn->insert_id;
}

function get_row($conn, $table, $id) {
    $stmt = $conn->prepare("SELECT * FROM `$table` WHERE id=?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc();
}

function lookup_options($conn, $table, $nameCol, $selected = '') {
    $html = '';
    $res = $conn->query("SELECT id, `$nameCol` AS name FROM `$table` ORDER BY `$nameCol`");
    while ($r = $res->fetch_assoc()) {
        $sel = ((string)$selected === (string)$r['id'] || (string)$selected === (string)$r['name']) ? 'selected' : '';
        $html .= '<option value="' . e($r['id']) . '" ' . $sel . '>' . e($r['name']) . "</option>\n";
    }
    return $html;
}

function photo_cell($photo, $muted = false) {
    if ($photo) {
        return '<img src="' . BASE_URL . '/uploads/' . e($photo) . '" width="50" height="50" style="object-fit:cover;border-radius:5px;">';
    }
    return $muted ? '<span class="text-muted">No Photo</span>' : 'No Photo';
}

function file_cell($file) {
    if ($file) {
        return '<a href="' . BASE_URL . '/uploads/' . e($file) . '" target="_blank" class="btn btn-sm btn-info">View</a>';
    }
    return 'No File';
}

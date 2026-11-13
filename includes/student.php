<?php
/**
 * Shared student-record logic for SSLC / PUC / Degree / PG.
 */
require_once __DIR__ . '/functions.php';

const STUDENT_LEVELS = [
    'sslc' => [
        'table'  => 'sslc_students',
        'prefix' => 'SSL',
        'extra'  => [],
        'files'  => ['photo'],
    ],
    'puc' => [
        'table'  => 'puc_students',
        'prefix' => 'PUC',
        'extra'  => ['sslc_register_number', 'sslc_passed_year', 'sslc_board_name'],
        'files'  => ['photo', 'sslc_marks_card'],
    ],
    'degree' => [
        'table'  => 'degree_students',
        'prefix' => 'DEG',
        'extra'  => ['sslc_register_number', 'sslc_passed_year', 'sslc_board_name',
                     'puc_register_number', 'puc_passed_year', 'puc_board_name',
                     'year', 'batch', 'sem'],
        'files'  => ['photo', 'sslc_marks_card', 'puc_marks_card'],
    ],
    'pg' => [
        'table'  => 'pg_students',
        'prefix' => 'PGO',
        'extra'  => ['sslc_register_number', 'sslc_passed_year', 'sslc_board_name',
                     'puc_register_number', 'puc_passed_year', 'puc_board_name',
                     'degree_register_number', 'degree_passed_year', 'degree_board_name',
                     'degree_course_id', 'degree_combination_id',
                     'year', 'batch', 'sem'],
        'files'  => ['photo', 'sslc_marks_card', 'puc_marks_card', 'degree_marks_card'],
    ],
];

const STUDENT_COMMON = [
    'student_name', 'father_name', 'mother_name', 'dob', 'category', 'caste', 'subcaste',
    'gender', 'aadhar_card', 'address', 'mobile', 'whatsapp', 'email', 'nationality',
    'religion', 'mother_tongue', 'admission_year', 'admission_batch', 'admission_number',
    'register_number', 'board_id', 'course_id', 'combination_id', 'language1', 'language2',
];

/** Handle POST for add (id = null) or edit. Returns true when saved. */
function student_handle_post($conn, $level, $existing = null) {
    if (!isset($_POST['save']) && !isset($_POST['update'])) return false;
    $cfg = STUDENT_LEVELS[$level];

    // Some forms post "aadhar" instead of "aadhar_card"
    if (isset($_POST['aadhar']) && !isset($_POST['aadhar_card'])) {
        $_POST['aadhar_card'] = $_POST['aadhar'];
    }

    $data = [];
    foreach (array_merge(STUDENT_COMMON, $cfg['extra']) as $f) {
        // On edit only overwrite fields that the form actually sends
        if ($existing !== null && !array_key_exists($f, $_POST)) continue;
        $data[$f] = post($f);
    }
    if (array_key_exists('dob', $data)) {
        $data['dob'] = $data['dob'] !== '' ? $data['dob'] : null;
        $data['age'] = (string)calc_age($data['dob']);
    }
    foreach ($cfg['files'] as $f) {
        $data[$f] = upload_file($f, $existing[$f] ?? '');
    }

    if ($existing === null) {
        $data['student_id'] = next_student_id($conn, $cfg['table'], $cfg['prefix']);
        save_row($conn, $cfg['table'], $data);
    } else {
        save_row($conn, $cfg['table'], $data, (int)$existing['id']);
    }
    header('Location: ../dashboard.php?tab=' . $level);
    exit;
}

function student_load_or_die($conn, $level) {
    $id = (int)($_GET['id'] ?? 0);
    $row = get_row($conn, STUDENT_LEVELS[$level]['table'], $id);
    if (!$row) {
        header('Location: ../dashboard.php?tab=' . $level);
        exit;
    }
    return $row;
}

function student_delete($conn, $level) {
    require_login();
    $id = (int)($_GET['id'] ?? 0);
    $table = STUDENT_LEVELS[$level]['table'];
    $row = get_row($conn, $table, $id);
    if ($row) {
        foreach (STUDENT_LEVELS[$level]['files'] as $f) {
            if (!empty($row[$f]) && is_file(__DIR__ . '/../uploads/' . $row[$f])) {
                @unlink(__DIR__ . '/../uploads/' . $row[$f]);
            }
        }
        $stmt = $conn->prepare("DELETE FROM `$table` WHERE id=?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
    }
    header('Location: ../dashboard.php?tab=' . $level);
    exit;
}

function sel($a, $b) { return (string)$a === (string)$b ? 'selected' : ''; }

function gender_options($cur = '') {
    $o = '';
    foreach (['Male', 'Female', 'Other'] as $g) {
        $o .= '<option ' . ($cur !== '' ? sel($cur, $g) : '') . ">$g</option>\n";
    }
    return $o;
}

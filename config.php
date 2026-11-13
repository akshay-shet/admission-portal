<?php
// Database configuration - update these for your server
$DB_HOST = 'localhost';
$DB_USER = 'root';
$DB_PASS = '';
$DB_NAME = 'student_portal';

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$conn = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
$conn->set_charset('utf8mb4');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Base URL path of the app (e.g. '' when at web root, '/admission-portal' when in a subfolder)
if (!defined('BASE_URL')) {
    define('BASE_URL', '');
}

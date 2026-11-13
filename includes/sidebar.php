<?php
$__tab  = $_GET['tab'] ?? '';
$__path = $_SERVER['PHP_SELF'];
$__cur  = function ($t) use ($__tab, $__path) {
    if (strpos($__path, '/' . $t . '/') !== false) return 'active';
    return ($__tab === $t || ($__tab === '' && $t === 'sslc' && basename($__path) === 'dashboard.php')) ? 'active' : '';
};
$__in = function ($dir) use ($__path) { return strpos($__path, '/' . $dir . '/') !== false ? 'active' : ''; };
?>
<div class="sidebar">

    <div class="logo">
        🎓 Student Portal
    </div>

    <!-- Students -->
    <a href="<?= BASE_URL ?>/dashboard.php?tab=sslc" class="<?= $__cur('sslc') ?>">SSLC Students</a>
    <a href="<?= BASE_URL ?>/dashboard.php?tab=puc" class="<?= $__cur('puc') ?>">PUC Students</a>
    <a href="<?= BASE_URL ?>/dashboard.php?tab=degree" class="<?= $__cur('degree') ?>">Degree Students</a>
    <a href="<?= BASE_URL ?>/dashboard.php?tab=pg" class="<?= $__cur('pg') ?>">PG Students</a>

    <!-- Management Links -->
    <!--<a href="<?= BASE_URL ?>/courses/manage_courses.php" class="<?= $__in('courses') ?>">📘 Manage Courses</a>
    <a href="<?= BASE_URL ?>/combinations/manage_combinations.php" class="<?= $__in('combinations') ?>">🧩 Manage Combinations</a>
    <a href="<?= BASE_URL ?>/boards/manage_boards.php" class="<?= $__in('boards') ?>">🏫 Manage Boards</a>-->

    <div class="divider"></div>
    <a href="<?= BASE_URL ?>/installments/manage_installments.php" class="<?= $__in('installments') ?>">💰 Manage Installments</a>

    <!-- Logout -->
    <a href="<?= BASE_URL ?>/logout.php" class="logout">🚪 Logout</a>
</div>

<style>
.sidebar {
    width: 240px;
    height: 100vh;
    position: fixed;
    background: linear-gradient(180deg,#1e293b,#0f172a);
    color: white;
    padding: 20px 10px;
    font-family: 'Segoe UI', sans-serif;
}
.logo {
    text-align: center;
    margin-bottom: 25px;
    font-weight: bold;
    font-size: 1.2rem;
}
.sidebar a {
    display: block;
    color: #cbd5e1;
    padding: 12px 15px;
    margin: 5px 10px;
    border-radius: 8px;
    text-decoration: none;
    transition: 0.3s;
}
.sidebar a:hover {
    background: #2563eb;
    color: white;
}
.sidebar a.active {
    background: #3b82f6;
    color: white;
}
.divider {
    height: 1px;
    background: #334155;
    margin: 15px 10px;
}
.logout {
    background: #ef4444 !important;
    color: white !important;
    text-align: center;
}
.logout:hover {
    background: #dc2626 !important;
}
</style>

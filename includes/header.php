<?php
require_once __DIR__ . '/functions.php';
require_login();
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Student Portal</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

    <style>
        body {
            margin:0;
            background:#f1f5f9;
            font-family: 'Segoe UI', sans-serif;
        }

        /* Sidebar */
        .sidebar {
            width:240px;
            height:100vh;
            position:fixed;
            background:linear-gradient(180deg,#1e293b,#0f172a);
            color:white;
            padding:20px 10px;
        }

        /* Logo */
        .logo {
            text-align:center;
            margin-bottom:20px;
            font-weight:bold;
        }

        /* Links */
        .sidebar a {
            display:block;
            color:#cbd5e1;
            padding:12px 15px;
            margin:5px 10px;
            border-radius:8px;
            text-decoration:none;
            transition:0.3s;
        }

        /* Hover */
        .sidebar a:hover {
            background:#2563eb;
            color:white;
        }

        /* Active */
        .sidebar a.active {
            background:#3b82f6;
            color:white;
        }

        /* Divider */
        .divider {
            height:1px;
            background:#334155;
            margin:15px 10px;
        }

        /* Logout */
        .logout {
            background:#ef4444;
            color:white !important;
            text-align:center;
        }

        .logout:hover {
            background:#dc2626;
        }

        /* Content area */
        .main-content {
            margin-left:240px;
            padding:20px;
        }

        /* Navbar fix */
        .navbar {
            margin-left:240px;
            background:#1e293b !important;
        }
        .spinner-border {
            border: 5px solid #f3f3f3;
            border-top: 5px solid #fff;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        table.dataTable thead th.sorting::before, table.dataTable thead th.sorting::after,
        table.dataTable thead th.sorting_asc::before, table.dataTable thead th.sorting_desc::after {
            display: none !important;
        }
    </style>
</head>

<body>

<!-- Top Navbar -->
<nav class="navbar navbar-dark px-3">
    <span class="navbar-brand">🎓 Student Admin Panel</span>
    <span class="text-white">Welcome, <?= e($_SESSION['admin']) ?></span>
</nav>

<?php
require_once __DIR__ . '/../includes/functions.php';
require_login();

if (isset($_POST['save'])) {
    save_row($conn, 'courses', ['course_name' => post('course_name'), 'level' => post('level')]);
    header('Location: manage_courses.php');
    exit;
}

include __DIR__ . '/../includes/header.php';
include __DIR__ . '/../includes/sidebar.php';
?>

<div class="main-content">
<h4>➕ Add New Course</h4>

<form method="POST">
    <div class="mb-3">
        <label for="course_name" class="form-label">Course Name</label>
        <input type="text" name="course_name" id="course_name" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="level" class="form-label">Level</label>
        <select name="level" id="level" class="form-control" required>
        <option value="SSLC">SSLC</option>
        <option value="PUC">PUC</option>
        <option value="Degree">Degree</option>
        </select>
    </div>
    <button type="submit" name="save" class="btn btn-success">Save</button>
    <a href="manage_courses.php" class="btn btn-secondary">Back</a>
</form>
</div>

<?php include __DIR__ . '/../includes/footer.php'; ?>

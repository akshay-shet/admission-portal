<?php
require_once __DIR__ . '/../includes/functions.php';
require_login();

if (isset($_GET['delete'])) {
    $id = (int)$_GET['delete'];
    $stmt = $conn->prepare("DELETE FROM courses WHERE id=?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    header('Location: manage_courses.php');
    exit;
}

include __DIR__ . '/../includes/header.php';
include __DIR__ . '/../includes/sidebar.php';
$result = $conn->query("SELECT * FROM courses ORDER BY course_name ASC");
?>

<div class="main-content">
<h4>📘 Manage Courses</h4>
<form method="GET" class="row g-3 mb-4">
<input type="hidden" name="tab" value="courses">
<a href="add_course.php" class="btn btn-success mb-3">➕ Add New Course</a>

<table class="table table-bordered">
<thead>
<tr>
    <th>#</th>
    <th>Course Name</th>
    <th>Level</th>
    <th>Actions</th>
</tr>
</thead>
<tbody>
<?php $i = 1; while ($row = $result->fetch_assoc()): ?>
<tr>
    <td><?= $i++ ?></td>
    <td><?= e($row['course_name']) ?></td>
    <td><?= e($row['level']) ?></td>
    <td>
        <a href="edit_course.php?id=<?= $row['id'] ?>" class="btn btn-warning btn-sm">Edit</a>
        <a href="?delete=<?= $row['id'] ?>" class="btn btn-danger btn-sm" onclick="return confirm('Are you sure to delete this course?')">Delete</a>
    </td>
</tr>
<?php endwhile; ?>
</tbody>
</table>
</form></div>

<?php include __DIR__ . '/../includes/footer.php'; ?>

<?php
require_once __DIR__ . '/../includes/functions.php';
require_login();

if (isset($_GET['delete'])) {
    $id = (int)$_GET['delete'];
    $stmt = $conn->prepare("DELETE FROM boards WHERE id=?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    header('Location: manage_boards.php');
    exit;
}

include __DIR__ . '/../includes/header.php';
include __DIR__ . '/../includes/sidebar.php';
$result = $conn->query("SELECT * FROM boards ORDER BY board_name ASC");
?>

<div class="main-content">
<h4>🏫 Manage Boards</h4>
<a href="add_board.php" class="btn btn-success mb-3">➕ Add New Board</a>

<table class="table table-bordered">
<thead>
<tr>
    <th>#</th>
    <th>Board Name</th>
    <th>Level</th>
    <th>Actions</th>
</tr>
</thead>
<tbody>
<?php $i = 1; while ($row = $result->fetch_assoc()): ?>
<tr>
    <td><?= $i++ ?></td>
    <td><?= e($row['board_name']) ?></td>
    <td><?= e($row['level']) ?></td>
    <td>
        <a href="edit_board.php?id=<?= $row['id'] ?>" class="btn btn-warning btn-sm">Edit</a>
        <a href="?delete=<?= $row['id'] ?>" class="btn btn-danger btn-sm" onclick="return confirm('Are you sure to delete this board?')">Delete</a>
    </td>
</tr>
<?php endwhile; ?>
</tbody>
</table>
</div>

<?php include __DIR__ . '/../includes/footer.php'; ?>

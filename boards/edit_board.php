<?php
require_once __DIR__ . '/../includes/functions.php';
require_login();
$id = (int)($_GET['id'] ?? 0);
$row = get_row($conn, 'boards', $id);
if (!$row) { header('Location: manage_boards.php'); exit; }

if (isset($_POST['update'])) {
    save_row($conn, 'boards', ['board_name' => post('board_name'), 'level' => post('level')], $id);
    header('Location: manage_boards.php');
    exit;
}

include __DIR__ . '/../includes/header.php';
include __DIR__ . '/../includes/sidebar.php';
?>

<div class="main-content">
<h4>✏️ Edit Board</h4>

<form method="POST">
    <div class="mb-3">
        <label for="board_name" class="form-label">Board Name</label>
        <input type="text" name="board_name" id="board_name" class="form-control" value="<?= e($row['board_name']) ?>" required>
    </div>
    <div class="mb-3">
        <label for="level" class="form-label">Level</label>
        <select name="level" id="level" class="form-control" required>
        <option value="SSLC" <?= $row['level'] === 'SSLC' ? 'selected' : '' ?>>SSLC</option>
        <option value="PUC" <?= $row['level'] === 'PUC' ? 'selected' : '' ?>>PUC</option>
        <option value="Degree" <?= $row['level'] === 'Degree' ? 'selected' : '' ?>>Degree</option>
        </select>
    </div>
    <button type="submit" name="update" class="btn btn-warning">Update</button>
    <a href="manage_boards.php" class="btn btn-secondary">Back</a>
</form>
</div>

<?php include __DIR__ . '/../includes/footer.php'; ?>

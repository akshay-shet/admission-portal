<?php
require_once __DIR__ . '/../includes/functions.php';
require_login();

if (isset($_POST['save'])) {
    save_row($conn, 'boards', ['board_name' => post('board_name'), 'level' => post('level')]);
    header('Location: manage_boards.php');
    exit;
}

include __DIR__ . '/../includes/header.php';
include __DIR__ . '/../includes/sidebar.php';
?>

<div class="main-content">
<h4>➕ Add New Board</h4>

<form method="POST">
    <div class="mb-3">
        <label for="board_name" class="form-label">Board Name</label>
        <input type="text" name="board_name" id="board_name" class="form-control" required>
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
    <a href="manage_boards.php" class="btn btn-secondary">Back</a>
</form>
</div>

<?php include __DIR__ . '/../includes/footer.php'; ?>

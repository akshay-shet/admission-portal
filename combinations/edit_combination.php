<?php
require_once __DIR__ . '/../includes/functions.php';
require_login();
$id = (int)($_GET['id'] ?? 0);
$row = get_row($conn, 'combinations', $id);
if (!$row) { header('Location: manage_combinations.php'); exit; }

if (isset($_POST['update'])) {
    save_row($conn, 'combinations', ['combination_name' => post('combination_name'), 'level' => post('level')], $id);
    header('Location: manage_combinations.php');
    exit;
}

include __DIR__ . '/../includes/header.php';
include __DIR__ . '/../includes/sidebar.php';
?>

<div class="main-content">
<h4>✏️ Edit Combination</h4>

<form method="POST">
    <div class="mb-3">
        <label for="combination_name" class="form-label">Combination Name</label>
        <input type="text" name="combination_name" id="combination_name" class="form-control" value="<?= e($row['combination_name']) ?>" required>
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
    <a href="manage_combinations.php" class="btn btn-secondary">Back</a>
</form>
</div>

<?php include __DIR__ . '/../includes/footer.php'; ?>

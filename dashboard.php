<?php
require_once __DIR__ . '/includes/header.php';
require_once __DIR__ . '/includes/sidebar.php';

$tab = $_GET['tab'] ?? 'sslc';
if (!in_array($tab, ['sslc', 'puc', 'degree', 'pg'], true)) $tab = 'sslc';
$tables = ['sslc' => 'sslc_students', 'puc' => 'puc_students', 'degree' => 'degree_students', 'pg' => 'pg_students'];
$board = e($_GET['board'] ?? '');
$batch = e($_GET['batch'] ?? '');
$search = e($_GET['search'] ?? '');
$conditions = [];
if ($board !== '') $conditions[] = "board_id = '" . $conn->real_escape_string($board) . "'";
if ($batch !== '') $conditions[] = "(admission_batch = '" . $conn->real_escape_string($batch) . "' OR batch = '" . $conn->real_escape_string($batch) . "')";
if ($search !== '') {
    $s = $conn->real_escape_string($search);
    $conditions[] = "(student_name LIKE '%$s%' OR admission_number LIKE '%$s%' OR mobile LIKE '%$s%' OR aadhar_card LIKE '%$s%')";
}
$where = !empty($conditions) ? ' WHERE ' . implode(' AND ', $conditions) : '';
$result = $conn->query("SELECT * FROM `{$tables[$tab]}`$where ORDER BY student_name ASC");
?>

<div class="main-content">

<h3 class="mb-4">Dashboard</h3>

<?php if ($tab === 'sslc'): ?>
<div class="card p-3 shadow">
<div class="d-flex justify-content-between align-items-center mb-3">
    <h4 class="m-0">📋 SSLC Students List</h4>
    <a href="sslc/add.php" class="btn btn-success">➕ Add New Student</a>
</div>

<!-- Filter -->
<form method="GET" class="row g-3 mb-4">
    <input type="hidden" name="tab" value="sslc">
    <div class="col-md-3">
        <label>Board</label>
        <select name="board" class="form-select">
            <option value="">All Boards</option>
            <option value="BOSSE" <?= $board === 'BOSSE' ? 'selected' : '' ?>>BOSSE</option>
            <option value="BISE" <?= $board === 'BISE' ? 'selected' : '' ?>>BISE</option>
            <option value="KSOU" <?= $board === 'KSOU' ? 'selected' : '' ?>>KSOU</option>
            <option value="State" <?= $board === 'State' ? 'selected' : '' ?>>State</option>
        </select>
    </div>
    <div class="col-md-3">
        <label>Batch</label>
        <select name="batch" class="form-select">
            <option value="">All Batches</option>
            <option value="1" <?= $batch === '1' ? 'selected' : '' ?>>Batch 1 (Dec – Feb)</option>
            <option value="2" <?= $batch === '2' ? 'selected' : '' ?>>Batch 2 (Feb – June)</option>
            <option value="3" <?= $batch === '3' ? 'selected' : '' ?>>Batch 3 (June – Oct)</option>
            <option value="4" <?= $batch === '4' ? 'selected' : '' ?>>Batch 4 (Oct – Dec)</option>
        </select>
    </div>
    <div class="col-md-3">
        <label>Search</label>
        <input type="text" name="search" value="<?= $search ?>" class="form-control" placeholder="Search...">
    </div>
    <div class="col-md-3 align-self-end">
        <button type="submit" class="btn btn-primary">Filter</button>
        <button type="submit" class="btn btn-success">Enter</button>
        <a href="dashboard.php?tab=sslc" class="btn btn-secondary">Reset</a>
    </div>
</form>

<div class="table-responsive">
<table id="sslcTable" class="table table-bordered table-striped table-hover">
<thead class="table-dark">
<tr>
    <th>Admission no</th>
    <th>Board</th>
    <th>Batch no</th>
    <th>Name</th>
    <th>Gender</th>
    <th>Aadhar no</th>
    <th>Phone no 1</th>
    <th>Previous class</th>
    <th>Medium</th>
    <th>TC no/Reg no</th>
    <th>Year of Passing</th>
    <th>Actions</th>
</tr>
</thead>
<tbody>
<?php while ($row = $result->fetch_assoc()): ?>
<tr>
    <td><?= e($row['admission_number']) ?></td>
    <td><?= e($row['board_id']) ?></td>
    <td><?= e($row['admission_batch'] ?: ($row['batch'] ?? '')) ?></td>
    <td><?= e($row['student_name']) ?></td>
    <td><?= e($row['gender']) ?></td>
    <td><?= e($row['aadhar_card']) ?></td>
    <td><?= e($row['mobile']) ?></td>
    <td><?= e($row['prev_class'] ?? '') ?></td>
    <td><?= e($row['medium'] ?: ($row['prev_medium'] ?? '')) ?></td>
    <td><?= e($row['prev_register_number'] ?: ($row['register_number'] ?? '')) ?></td>
    <td><?= e($row['prev_passing_year'] ?? '') ?></td>
    <td>
        <a href="sslc/edit.php?id=<?= $row['id'] ?>" class="btn btn-sm btn-warning mb-1">Edit</a>
        <a href="sslc/delete.php?id=<?= $row['id'] ?>" class="btn btn-sm btn-danger mb-1" onclick="return confirm('Are you sure to delete this student?')"> Delete </a>
    </td>
</tr>
<?php endwhile; ?>
</tbody>
</table>
</div>
</div>
<?php include __DIR__ . '/includes/datatables.php'; ?>
<script>
$(document).ready(function() {
    $('#sslcTable').DataTable({
        dom: 'Bfrtip',
        buttons: ['copy','csv','excel','pdf','print'],
        pageLength: 10,
        order: [[3, 'asc']],
        responsive: true
    });
});
</script>

<?php elseif ($tab === 'puc'): ?>
<div class="card p-3 shadow">
<div class="d-flex justify-content-between align-items-center mb-3">
    <h4 class="m-0">📋 PUC Students List</h4>
    <a href="puc/add.php" class="btn btn-success">➕ Add New Student</a>
</div>

<form method="GET" class="row g-3 mb-4">
    <input type="hidden" name="tab" value="puc">
    <div class="col-md-3">
        <label>Board</label>
        <select name="board" class="form-select">
            <option value="">All Boards</option>
            <option value="BISE" <?= $board === 'BISE' ? 'selected' : '' ?>>BISE</option>
            <option value="BOSSE" <?= $board === 'BOSSE' ? 'selected' : '' ?>>BOSSE</option>
            <option value="State" <?= $board === 'State' ? 'selected' : '' ?>>State</option>
        </select>
    </div>
    <div class="col-md-3">
        <label>Batch</label>
        <select name="batch" class="form-select">
            <option value="">All Batches</option>
            <option value="1" <?= $batch === '1' ? 'selected' : '' ?>>Batch 1 (Dec – Feb)</option>
            <option value="2" <?= $batch === '2' ? 'selected' : '' ?>>Batch 2 (Feb – June)</option>
            <option value="3" <?= $batch === '3' ? 'selected' : '' ?>>Batch 3 (June – Oct)</option>
            <option value="4" <?= $batch === '4' ? 'selected' : '' ?>>Batch 4 (Oct – Dec)</option>
        </select>
    </div>
    <div class="col-md-3">
        <label>Search</label>
        <input type="text" name="search" value="<?= $search ?>" class="form-control" placeholder="Search...">
    </div>
    <div class="col-md-3 align-self-end">
        <button type="submit" class="btn btn-primary">Filter</button>
        <button type="submit" class="btn btn-success">Enter</button>
        <a href="dashboard.php?tab=puc" class="btn btn-secondary">Reset</a>
    </div>
</form>

<div class="table-responsive">
<table id="pucTable" class="table table-bordered table-striped table-hover">
<thead class="table-dark">
<tr>
    <th>#</th>
    <th>Photo</th>
    <th>Name</th>
    <th>Father</th>
    <th>Mother</th>
    <th>DOB</th>
    <th>Age</th>
    <th>Caste</th>
    <th>Subcaste</th>
    <th>Gender</th>
    <th>Aadhar</th>
    <th>Mobile</th>
    <th>WhatsApp</th>
    <th>Admission No</th>
    <th>Register No</th>
    <th>SSLC Reg</th>
    <th>SSLC Year</th>
    <th>SSLC Board</th>
    <th>Marks Card</th>
    <th>Board</th>
    <th>Course</th>
    <th>Combination</th>
    <th>Actions</th>
</tr>
</thead>
<tbody>
<?php $i = 1; while ($row = $result->fetch_assoc()): ?>
<tr>
    <td><?= $i++ ?></td>
    <td> <?= photo_cell($row['photo']) ?> </td>
    <td><?= e($row['student_name']) ?></td>
    <td><?= e($row['father_name']) ?></td>
    <td><?= e($row['mother_name']) ?></td>
    <td><?= e($row['dob'] ?: '0000-00-00') ?></td>
    <td><?= e($row['age']) ?></td>
    <td><?= e($row['caste']) ?></td>
    <td><?= e($row['subcaste']) ?></td>
    <td><?= e($row['gender']) ?></td>
    <td><?= e($row['aadhar_card']) ?></td>
    <td><?= e($row['mobile']) ?></td>
    <td><?= e($row['whatsapp']) ?></td>
    <td><?= e($row['admission_number']) ?></td>
    <td><?= e($row['register_number']) ?></td>
    <td><?= e($row['sslc_register_number']) ?></td>
    <td><?= e($row['sslc_passed_year']) ?></td>
    <td><?= e($row['sslc_board_name']) ?></td>
    <td> <?= file_cell($row['sslc_marks_card']) ?> </td>
    <td><?= e($row['board_id']) ?></td>
    <td><?= e($row['course_id']) ?></td>
    <td><?= e($row['combination_id']) ?></td>
    <td>
        <a href="puc/edit.php?id=<?= $row['id'] ?>" class="btn btn-sm btn-warning">Edit</a>
        <a href="puc/delete.php?id=<?= $row['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('Delete this student?')">Delete</a>
    </td>
</tr>
<?php endwhile; ?>
</tbody>
</table>
</div>
</div>
<?php include __DIR__ . '/includes/datatables.php'; ?>
<script>
$(document).ready(function() {
    $('#pucTable').DataTable({
        dom: 'Bfrtip',
        buttons: ['copy','csv','excel','pdf','print'],
        pageLength: 10,
        order: [[2, 'asc']],
        responsive: true
    });
});
</script>

<?php elseif ($tab === 'degree'): ?>
<div class="card p-3 shadow">
<div class="d-flex justify-content-between align-items-center mb-3">
    <h4 class="m-0">📋 Degree Students List</h4>
    <a href="degree/add.php" class="btn btn-success">➕ Add New Student</a>
</div>

<form method="GET" class="row g-3 mb-4">
    <input type="hidden" name="tab" value="degree">
    <div class="col-md-3">
        <label>Board</label>
        <select name="board" class="form-select">
            <option value="">All Boards</option>
            <option value="KSOU" <?= $board === 'KSOU' ? 'selected' : '' ?>>KSOU</option>
            <option value="State" <?= $board === 'State' ? 'selected' : '' ?>>State</option>
            <option value="BISE" <?= $board === 'BISE' ? 'selected' : '' ?>>BISE</option>
            <option value="BOSSE" <?= $board === 'BOSSE' ? 'selected' : '' ?>>BOSSE</option>
        </select>
    </div>
    <div class="col-md-3">
        <label>Batch</label>
        <select name="batch" class="form-select">
            <option value="">All Batches</option>
            <option value="1" <?= $batch === '1' ? 'selected' : '' ?>>Batch 1 (Dec – Feb)</option>
            <option value="2" <?= $batch === '2' ? 'selected' : '' ?>>Batch 2 (Feb – June)</option>
            <option value="3" <?= $batch === '3' ? 'selected' : '' ?>>Batch 3 (June – Oct)</option>
            <option value="4" <?= $batch === '4' ? 'selected' : '' ?>>Batch 4 (Oct – Dec)</option>
            <option value="JAN" <?= $batch === 'JAN' ? 'selected' : '' ?>>JAN</option>
        </select>
    </div>
    <div class="col-md-3">
        <label>Search</label>
        <input type="text" name="search" value="<?= $search ?>" class="form-control" placeholder="Search...">
    </div>
    <div class="col-md-3 align-self-end">
        <button type="submit" class="btn btn-primary">Filter</button>
        <button type="submit" class="btn btn-success">Enter</button>
        <a href="dashboard.php?tab=degree" class="btn btn-secondary">Reset</a>
    </div>
</form>

<div class="table-responsive">
<table id="degreeTable" class="table table-bordered table-striped table-hover">
<thead class="table-dark">
<tr>
    <th>#</th>
    <th>Photo</th>
    <th>Name</th>
    <th>Father</th>
    <th>Mother</th>
    <th>DOB</th>
    <th>Age</th>
    <th>Caste</th>
    <th>Subcaste</th>
    <th>Gender</th>
    <th>Aadhar</th>
    <th>Mobile</th>
    <th>WhatsApp</th>
    <th>Admission No</th>
    <th>Register No</th>
    <th>SSLC Reg</th>
    <th>SSLC Year</th>
    <th>SSLC Board</th>
    <th>SSLC Marks Card</th>
    <th>PUC Reg</th>
    <th>PUC Year</th>
    <th>PUC Board</th>
    <th>PUC Marks Card</th>
    <th>Board</th>
    <th>Course</th>
    <th>Combination</th>
    <th>Year</th>
    <th>Batch</th>
    <th>Sem</th>
    <th>Actions</th>
</tr>
</thead>
<tbody>
<?php $i = 1; while ($row = $result->fetch_assoc()): ?>
<tr>
    <td><?= $i++ ?></td>
    <td> <?= photo_cell($row['photo']) ?> </td>
    <td><?= e($row['student_name']) ?></td>
    <td><?= e($row['father_name']) ?></td>
    <td><?= e($row['mother_name']) ?></td>
    <td><?= e($row['dob'] ?: '0000-00-00') ?></td>
    <td><?= e($row['age']) ?></td>
    <td><?= e($row['caste']) ?></td>
    <td><?= e($row['subcaste']) ?></td>
    <td><?= e($row['gender']) ?></td>
    <td><?= e($row['aadhar_card']) ?></td>
    <td><?= e($row['mobile']) ?></td>
    <td><?= e($row['whatsapp']) ?></td>
    <td><?= e($row['admission_number']) ?></td>
    <td><?= e($row['register_number']) ?></td>
    <td><?= e($row['sslc_register_number']) ?></td>
    <td><?= e($row['sslc_passed_year']) ?></td>
    <td><?= e($row['sslc_board_name']) ?></td>
    <td> <?= file_cell($row['sslc_marks_card']) ?> </td>
    <td><?= e($row['puc_register_number']) ?></td>
    <td><?= e($row['puc_passed_year']) ?></td>
    <td><?= e($row['puc_board_name']) ?></td>
    <td> <?= file_cell($row['puc_marks_card']) ?> </td>
    <td><?= e($row['board_id']) ?></td>
    <td><?= e($row['course_id']) ?></td>
    <td><?= e($row['combination_id']) ?></td>
    <td><?= e($row['year']) ?></td>
    <td><?= e($row['batch']) ?></td>
    <td><?= e($row['sem']) ?></td>
    <td>
        <a href="degree/edit.php?id=<?= $row['id'] ?>" class="btn btn-sm btn-warning">Edit</a>
        <a href="degree/delete.php?id=<?= $row['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('Delete this student?')">Delete</a>
    </td>
</tr>
<?php endwhile; ?>
</tbody>
</table>
</div>
</div>
<?php include __DIR__ . '/includes/datatables.php'; ?>
<script>
$(document).ready(function() {
    $('#degreeTable').DataTable({
        dom: 'Bfrtip',
        buttons: ['copy','csv','excel','pdf','print'],
        pageLength: 10,
        order: [[2, 'asc']],
        responsive: true
    });
});
</script>

<?php else: /* pg */ ?>
<div class="card p-3 shadow">
<div class="d-flex justify-content-between align-items-center mb-3">
    <h4 class="m-0">📋 PG Students List</h4>
    <a href="pg/add.php" class="btn btn-success">➕ Add New Student</a>
</div>

<form method="GET" class="row g-3 mb-4">
    <input type="hidden" name="tab" value="pg">
    <div class="col-md-3">
        <label>Board</label>
        <select name="board" class="form-select">
            <option value="">All Boards</option>
            <option value="State" <?= $board === 'State' ? 'selected' : '' ?>>State</option>
            <option value="KSOU" <?= $board === 'KSOU' ? 'selected' : '' ?>>KSOU</option>
            <option value="BISE" <?= $board === 'BISE' ? 'selected' : '' ?>>BISE</option>
            <option value="BOSSE" <?= $board === 'BOSSE' ? 'selected' : '' ?>>BOSSE</option>
        </select>
    </div>
    <div class="col-md-3">
        <label>Batch</label>
        <select name="batch" class="form-select">
            <option value="">All Batches</option>
            <option value="1" <?= $batch === '1' ? 'selected' : '' ?>>Batch 1 (Dec – Feb)</option>
            <option value="2" <?= $batch === '2' ? 'selected' : '' ?>>Batch 2 (Feb – June)</option>
            <option value="3" <?= $batch === '3' ? 'selected' : '' ?>>Batch 3 (June – Oct)</option>
            <option value="4" <?= $batch === '4' ? 'selected' : '' ?>>Batch 4 (Oct – Dec)</option>
        </select>
    </div>
    <div class="col-md-3">
        <label>Search</label>
        <input type="text" name="search" value="<?= $search ?>" class="form-control" placeholder="Search...">
    </div>
    <div class="col-md-3 align-self-end">
        <button type="submit" class="btn btn-primary">Filter</button>
        <button type="submit" class="btn btn-success">Enter</button>
        <a href="dashboard.php?tab=pg" class="btn btn-secondary">Reset</a>
    </div>
</form>

<div class="table-responsive">
<table id="pgTable" class="table table-bordered table-striped table-hover" style="font-size:12px;">
<thead class="table-dark">
<tr>
    <th>#</th>
    <th>Photo</th>
    <th>Student Name</th>
    <th>Father</th>
    <th>Mother</th>
    <th>DOB</th>
    <th>Age</th>
    <th>Category</th>
    <th>Caste</th>
    <th>Subcaste</th>
    <th>Gender</th>
    <th>Aadhar</th>
    <th>Address</th>
    <th>Mobile</th>
    <th>WhatsApp</th>
    <th>Email</th>
    <th>Nationality</th>
    <th>Religion</th>
    <th>Mother Tongue</th>
    <th>Admission Year</th>
    <th>Admission Batch</th>
    <th>Admission No</th>
    <th>Register No</th>
    <th>SSLC Reg No</th>
    <th>SSLC Passed Year</th>
    <th>SSLC Board</th>
    <th>SSLC Marks Card</th>
    <th>PUC Reg No</th>
    <th>PUC Passed Year</th>
    <th>PUC Board</th>
    <th>PUC Marks Card</th>
    <th>Degree Reg No</th>
    <th>Degree Passed Year</th>
    <th>Degree Board</th>
    <th>Degree Marks Card</th>
    <th>Degree Course</th>
    <th>Degree Combination</th>
    <th>PG Board</th>
    <th>PG Course</th>
    <th>PG Combination</th>
    <th>Language 1</th>
    <th>Language 2</th>
    <th>Student ID</th>
    <th>Actions</th>
</tr>
</thead>
<tbody>
<?php $i = 1; while ($row = $result->fetch_assoc()):
    $fc = function ($f) { return $f ? file_cell($f) : ''; };
?>
<tr>
    <td><?= $i++ ?></td>
    <td><?= photo_cell($row['photo']) ?></td>
    <td><?= e($row['student_name']) ?></td>
    <td><?= e($row['father_name']) ?></td>
    <td><?= e($row['mother_name']) ?></td>
    <td><?= e($row['dob'] ?: '0000-00-00') ?></td>
    <td><?= e($row['age']) ?></td>
    <td><?= e($row['category']) ?></td>
    <td><?= e($row['caste']) ?></td>
    <td><?= e($row['subcaste']) ?></td>
    <td><?= e($row['gender']) ?></td>
    <td><?= e($row['aadhar_card']) ?></td>
    <td><?= e($row['address']) ?></td>
    <td><?= e($row['mobile']) ?></td>
    <td><?= e($row['whatsapp']) ?></td>
    <td><?= e($row['email']) ?></td>
    <td><?= e($row['nationality']) ?></td>
    <td><?= e($row['religion']) ?></td>
    <td><?= e($row['mother_tongue']) ?></td>
    <td><?= e($row['admission_year']) ?></td>
    <td><?= e($row['admission_batch']) ?></td>
    <td><?= e($row['admission_number']) ?></td>
    <td><?= e($row['register_number']) ?></td>
    <td><?= e($row['sslc_register_number']) ?></td>
    <td><?= e($row['sslc_passed_year']) ?></td>
    <td><?= e($row['sslc_board_name']) ?></td>
    <td><?= $fc($row['sslc_marks_card']) ?></td>
    <td><?= e($row['puc_register_number']) ?></td>
    <td><?= e($row['puc_passed_year']) ?></td>
    <td><?= e($row['puc_board_name']) ?></td>
    <td><?= $fc($row['puc_marks_card']) ?></td>
    <td><?= e($row['degree_register_number']) ?></td>
    <td><?= e($row['degree_passed_year']) ?></td>
    <td><?= e($row['degree_board_name']) ?></td>
    <td><?= $fc($row['degree_marks_card']) ?></td>
    <td><?= e($row['degree_course_id']) ?></td>
    <td><?= e($row['degree_combination_id']) ?></td>
    <td><?= e($row['board_id']) ?></td>
    <td><?= e($row['course_id']) ?></td>
    <td><?= e($row['combination_id']) ?></td>
    <td><?= e($row['language1']) ?></td>
    <td><?= e($row['language2']) ?></td>
    <td><?= e($row['student_id']) ?></td>
    <td>
        <a href="pg/edit.php?id=<?= $row['id'] ?>" class="btn btn-sm btn-warning">Edit</a>
        <a href="pg/delete.php?id=<?= $row['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('Delete this student?')">Delete</a>
    </td>
</tr>
<?php endwhile; ?>
</tbody>
</table>
</div>
</div>
</div>

<link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css">
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
<script>
$(document).ready(function(){
    $('#pgTable').DataTable({pageLength:10,order:[[2,'asc']],responsive:true});
});
</script>
<?php include __DIR__ . '/includes/footer.php'; exit; ?>
<?php endif; ?>

</div>

<?php include __DIR__ . '/includes/footer.php'; ?>

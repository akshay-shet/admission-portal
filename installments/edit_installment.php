<?php
require_once __DIR__ . '/../includes/installment.php';
require_login();

$id  = (int)($_GET['id'] ?? 0);
$row = get_row($conn, 'installments', $id);
if (!$row) { header('Location: manage_installments.php'); exit; }

if (isset($_POST['update'])) {
    $sid     = post('student_id');
    $student = find_student($conn, $sid);
    $total   = (float)post('total');
    $amount  = (float)post('amount');
    $p       = student_paid($conn, $sid, $id);
    $balance = max(0, $total - ($p['paid'] + $amount));
    $mode    = post('payment_mode', 'Cash');

    save_row($conn, 'installments', [
        'student_id'       => $sid,
        'student_name'     => $student['student_name'] ?? $row['student_name'],
        'admission_year'   => post('admission_year'),
        'admission_batch'  => post('admission_batch'),
        'admission_number' => post('admission_number'),
        'register_number'  => post('register_number'),
        'phone'            => post('phone'),
        'course'           => post('course'),
        'board_id'         => $student['board_id'] ?? $row['board_id'],
        'course_id'        => $student['course_id'] ?? $row['course_id'],
        'combination_id'   => $student['combination_id'] ?? $row['combination_id'],
        'total_fees'       => $total,
        'installment_no'   => (int)post('installment_no'),
        'amount'           => $amount,
        'balance'          => $balance,
        'payment_date'     => post('payment_date') ?: $row['payment_date'],
        'status'           => post('status', 'Paid'),
        'payment_mode'     => $mode,
        'cash_amount'      => $mode === 'Cash/Online' ? $row['cash_amount'] : null,
        'online_amount'    => $mode === 'Cash/Online' ? $row['online_amount'] : null,
        'reference'        => post('reference'),
    ], $id);
    header('Location: manage_installments.php');
    exit;
}

include __DIR__ . '/../includes/header.php';
include __DIR__ . '/../includes/sidebar.php';
$students = all_students($conn);
?>

<div class="main-content">
<h4>✏️ Edit Installment</h4>

<form method="POST" id="installmentForm">
<input type="hidden" id="installment_id" value="<?= $id ?>">

<!-- Student -->
<div class="col-md-6">
<label>Student Name</label>
<select name="student_id" id="student_id" class="form-control" required onchange="fetchStudentData()">
    <?php foreach ($students as $s): ?>
    <option value="<?= e($s['student_id']) ?>" <?= $s['student_id'] === $row['student_id'] ? 'selected' : '' ?>> <?= e($s['student_name']) ?> </option>
    <?php endforeach; ?>
</select>
</div>

<!-- Admission -->
<div class="col-md-6">
<label>Admission Year</label>
<input type="text" name="admission_year" class="form-control" value="<?= e($row['admission_year']) ?>">
</div>

<div class="col-md-6">
<label>Admission Batch</label>
<input type="text" name="admission_batch" class="form-control" value="<?= e($row['admission_batch']) ?>">
</div>

<div class="col-md-6">
<label>Admission Number</label>
<input type="text" name="admission_number" class="form-control" value="<?= e($row['admission_number']) ?>">
</div>

<div class="col-md-6">
<label>Register Number</label>
<input type="text" name="register_number" class="form-control" value="<?= e($row['register_number']) ?>">
</div>

<div class="col-md-6">
<label>Phone</label>
<input type="text" name="phone" class="form-control" value="<?= e($row['phone']) ?>">
</div>

<!-- Course -->
<div class="col-md-6">
<label>Course</label>
<input type="text" name="course" class="form-control" value="<?= e($row['course']) ?>">
</div>

<!-- Installment -->
<div class="col-md-6">
<label>Total Fees</label>
<input type="number" name="total" id="total_fees" class="form-control" step="0.01" value="<?= e($row['total_fees']) ?>" oninput="updateBalance()">
</div>

<div class="col-md-6">
<label>Installment No</label>
<input type="number" name="installment_no" id="installment_no" class="form-control" value="<?= e($row['installment_no']) ?>">
</div>

<div class="col-md-6">
<label>Amount</label>
<input type="number" name="amount" id="amount" class="form-control" step="0.01" value="<?= e($row['amount']) ?>" oninput="updateBalance()">
</div>

<div class="col-md-6">
<label>Date</label>
<input type="date" name="payment_date" class="form-control" value="<?= e($row['payment_date']) ?>">
</div>

<div class="col-md-6">
<label>Status</label>
<select name="status" class="form-control">
    <option value="Paid" <?= $row['status'] === 'Paid' ? 'selected' : '' ?>>Paid</option>
    <option value="Pending" <?= $row['status'] === 'Pending' ? 'selected' : '' ?>>Pending</option>
</select>
</div>

<div class="col-md-6">
<label>Balance</label>
<input type="number" name="balance" id="balance" class="form-control" value="<?= e($row['balance']) ?>" readonly>
</div>

<!-- Payment -->
<div class="col-md-6">
<label>Payment Mode</label>
<select name="payment_mode" id="payment_mode" class="form-control">
    <?php foreach (PAYMENT_MODES as $m): ?>
    <option value="<?= e($m) ?>" <?= $row['payment_mode'] === $m ? 'selected' : '' ?>><?= e($m) ?></option>
    <?php endforeach; ?>
</select>
</div>

<div class="col-md-6" id="reference_field">
<label>Reference</label>
<input type="text" name="reference" class="form-control" value="<?= e($row['reference']) ?>">
</div>

<div class="col-12 mt-3">
<button type="submit" name="update" class="btn btn-warning">💾 Update</button>
<a href="manage_installments.php" class="btn btn-secondary">Back</a>
</div>

</form>
</div>

<script>
function toggleRef() {
    let mode = document.getElementById('payment_mode').value;
    let ref = document.getElementById('reference_field');
    ref.style.display = (mode === 'Online' || mode === 'UPI' || mode === 'Cash/Online') ? 'block' : 'none';
}

document.getElementById('payment_mode').addEventListener('change', toggleRef);
window.onload = () => { toggleRef(); }

function fetchStudentData(){
    const studentId = document.getElementById('student_id').value;
    if(!studentId) return;
    fetch('get_student_paid.php?student_id=' + encodeURIComponent(studentId))
    .then(res => res.json())
    .then(data => {
        document.querySelector("[name='admission_year']").value = data.admission_year;
        document.querySelector("[name='admission_batch']").value = data.admission_batch;
        document.querySelector("[name='admission_number']").value = data.admission_number;
        document.querySelector("[name='register_number']").value = data.register_number;
        document.querySelector("[name='phone']").value = data.phone;
        updateBalance();
    });
}

function updateBalance(){
    const total = parseFloat(document.getElementById('total_fees').value) || 0;
    const amount = parseFloat(document.getElementById('amount').value) || 0;
    const id = document.getElementById('installment_id').value;

    fetch('get_installment_paid.php?id=' + id)
    .then(res => res.json())
    .then(data => {
        const paid = parseFloat(data.paid) || 0;   // other installments of this student
        let balance = total - (paid + amount);
        if (balance < 0) balance = 0;
        document.getElementById('balance').value = balance.toFixed(2);
    });
}
</script>
<?php include __DIR__ . '/../includes/footer.php'; ?>

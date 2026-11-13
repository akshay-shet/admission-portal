<?php
require_once __DIR__ . '/../includes/installment.php';
require_login();

if (isset($_POST['save'])) {
    $sid     = post('student_id');
    $student = find_student($conn, $sid);
    $total   = (float)post('total_fees');
    $mode    = post('payment_mode', 'Cash');
    $cash    = $mode === 'Cash/Online' ? (float)post('cash_amount') : null;
    $online  = $mode === 'Cash/Online' ? (float)post('online_amount') : null;
    $amount  = $mode === 'Cash/Online' ? $cash + $online : (float)post('amount');
    $p       = student_paid($conn, $sid);
    $balance = max(0, $total - ($p['paid'] + $amount));

    save_row($conn, 'installments', [
        'student_id'       => $sid,
        'student_name'     => $student['student_name'] ?? '',
        'admission_year'   => post('admission_year'),
        'admission_batch'  => post('admission_batch'),
        'admission_number' => post('admission_number'),
        'register_number'  => post('register_number'),
        'phone'            => post('phone'),
        'course'           => post('course'),
        'board_id'         => $student['board_id'] ?? '',
        'course_id'        => $student['course_id'] ?? '',
        'combination_id'   => $student['combination_id'] ?? '',
        'total_fees'       => $total,
        'installment_no'   => $p['cnt'] + 1,
        'amount'           => $amount,
        'balance'          => $balance,
        'payment_date'     => post('payment_date') ?: date('Y-m-d'),
        'status'           => post('status', 'Paid'),
        'payment_mode'     => $mode,
        'cash_amount'      => $cash,
        'online_amount'    => $online,
        'reference'        => post('reference'),
    ]);
    header('Location: manage_installments.php');
    exit;
}

include __DIR__ . '/../includes/header.php';
include __DIR__ . '/../includes/sidebar.php';
$students = all_students($conn);
?>

<div class="main-content">
<h4>➕ Add Installment</h4>

<form method="POST">

<!-- Student -->
<div class="col-md-6">
<label>Student Name</label>
<select name="student_id" id="student_id" class="form-control" required onchange="updateInstallment()">
    <option value="">Select Student</option>
    <?php foreach ($students as $s): ?>
    <option value="<?= e($s['student_id']) ?>"><?= e($s['student_name']) ?> </option>
    <?php endforeach; ?>
</select>
</div>

<!-- Admission -->
<div class="col-md-6">
<label>Admission Year</label>
<input type="text" name="admission_year" id="admission_year" class="form-control">
</div>

<div class="col-md-6">
<label>Admission Batch</label>
<input type="text" name="admission_batch" id="admission_batch" class="form-control">
</div>

<div class="col-md-6">
<label>Admission Number</label>
<input type="text" name="admission_number" id="admission_number" class="form-control">
</div>

<div class="col-md-6">
<label>Register Number</label>
<input type="text" name="register_number" id="register_number" class="form-control">
</div>

<div class="col-md-6">
<label>Phone</label>
<input type="text" name="phone" id="phone" class="form-control">
</div>

<!-- Course -->
<div class="col-md-6">
<label>Course</label>
<select name="course" id="course" class="form-control">
    <option value="">Select Course</option>
    <?php foreach (COURSE_OPTIONS as $c): ?>
    <option value="<?= e($c) ?>"><?= e($c) ?></option>
    <?php endforeach; ?>
</select>
</div>

<!-- Fees -->
<div class="col-md-6">
<label>Total Fees</label>
<input type="number" name="total_fees" id="total_fees" class="form-control" step="0.01" required oninput="updateBalance()">
</div>

<div class="col-md-6">
<label>Installment No</label>
<input type="number" id="installment_no" class="form-control" readonly>
</div>

<div class="col-md-6">
<label>Amount</label>
<input type="number" name="amount" id="amount" class="form-control" step="0.01" required oninput="updateBalance()">
</div>

<div class="col-md-6">
<label>Balance</label>
<input type="number" name="balance" id="balance" class="form-control" readonly>
</div>

<div class="col-md-6">
<label>Date</label>
<input type="date" name="payment_date" class="form-control">
</div>

<div class="col-md-6">
<label>Status</label>
<select name="status" class="form-control">
    <option value="Paid">Paid</option>
    <option value="Pending">Pending</option>
</select>
</div>

<!-- Payment Mode -->
<div class="col-md-6">
<label>Payment Mode</label>
<select name="payment_mode" id="payment_mode" class="form-control" onchange="togglePaymentMode()">
    <?php foreach (PAYMENT_MODES as $m): ?>
    <option value="<?= e($m) ?>"><?= e($m) ?></option>
    <?php endforeach; ?>
</select>
</div>

<!-- Reference -->
<div class="col-md-6" id="reference_field">
<label>Reference</label>
<input type="text" name="reference" class="form-control">
</div>

<!-- Split Payment -->
<div class="col-md-6" id="cash_field" style="display:none;">
<label>Cash Amount</label>
<input type="number" name="cash_amount" id="cash_amount" class="form-control" step="0.01" oninput="updateSplitAmount()">
</div>

<div class="col-md-6" id="online_field" style="display:none;">
<label>Online Amount</label>
<input type="number" name="online_amount" id="online_amount" class="form-control" step="0.01" oninput="updateSplitAmount()">
</div>

<div class="col-12 mt-3">
<button type="submit" name="save" class="btn btn-success">💾 Save</button>
<a href="manage_installments.php" class="btn btn-secondary">Back</a>
</div>

</form>

<div id="loaderOverlay" style="
    display:none;
    position:fixed;
    top:0; left:0;
    width:100%; height:100%;
    background:rgba(0,0,0,0.5);
    z-index:9999;
    justify-content:center;
    align-items:center;
">
    <div style="text-align:center; color:white;">
        <div class="spinner-border" role="status" style="width:3rem;height:3rem;"></div>
        <p>Loading student data...</p>
    </div>
</div>
</div>

<script>
function togglePaymentMode(){
    let mode = document.getElementById('payment_mode').value;
    let ref = document.getElementById('reference_field');
    let cash = document.getElementById('cash_field');
    let online = document.getElementById('online_field');

    ref.style.display = (mode === 'Online' || mode === 'UPI' || mode === 'Cash/Online') ? 'block' : 'none';

    if(mode === 'Cash/Online'){
        cash.style.display = 'block';
        online.style.display = 'block';
    } else {
        cash.style.display = 'none';
        online.style.display = 'none';
    }
}

function updateSplitAmount(){
    let cash = parseFloat(document.getElementById('cash_amount').value) || 0;
    let online = parseFloat(document.getElementById('online_amount').value) || 0;
    document.getElementById('amount').value = (cash + online).toFixed(2);
    updateBalance();
}

window.onload = togglePaymentMode;

// Update installment number & balance dynamically
function updateInstallment(){
    const studentId = document.getElementById('student_id').value;
    if(!studentId) return;

    showLoader();

    fetch('get_student_paid.php?student_id=' + encodeURIComponent(studentId))
    .then(res => res.json())
    .then(data => {
        document.getElementById('installment_no').value = parseInt(data.count) + 1;
        if(data.total && !document.getElementById('total_fees').value){
            document.getElementById('total_fees').value = parseFloat(data.total).toFixed(2);
        }
        updateBalance();
    })
    .catch(err => {
        console.error(err);
        alert("Error loading student data");
    })
    .finally(() => {
        hideLoader();
    });
}

function updateBalance(){
    const total = parseFloat(document.getElementById('total_fees').value) || 0;
    const amount = parseFloat(document.getElementById('amount').value) || 0;
    const studentId = document.getElementById('student_id').value;
    if(!studentId) return;

    showLoader();

    fetch('get_student_paid.php?student_id=' + encodeURIComponent(studentId))
    .then(res => res.json())
    .then(data => {
        document.getElementById('admission_year').value = data.admission_year;
        document.getElementById('admission_batch').value = data.admission_batch;
        document.getElementById('register_number').value = data.register_number;
        document.getElementById('admission_number').value = data.admission_number;
        document.getElementById('phone').value = data.phone;
        if (data.course) document.getElementById('course').value = data.course;

        const paid = parseFloat(data.paid) || 0;
        let balance = total - (paid + amount);
        if(balance < 0) balance = 0;
        document.getElementById('balance').value = balance.toFixed(2);
    })
    .finally(() => {
        hideLoader();
    });
}

function showLoader(){
    document.getElementById('loaderOverlay').style.display = 'flex';
}

function hideLoader(){
    document.getElementById('loaderOverlay').style.display = 'none';
}
</script>
<?php include __DIR__ . '/../includes/footer.php'; ?>

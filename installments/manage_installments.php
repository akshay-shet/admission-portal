<?php
require_once __DIR__ . '/../includes/installment.php';
include __DIR__ . '/../includes/header.php';
include __DIR__ . '/../includes/sidebar.php';

$w = [];
$filter = $_GET['filter'] ?? '';
if ($filter === 'last_week')  $w[] = "payment_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
if ($filter === 'last_month') $w[] = "payment_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)";
if (!empty($_GET['from_date'])) $w[] = "payment_date >= '" . $conn->real_escape_string($_GET['from_date']) . "'";
if (!empty($_GET['to_date']))   $w[] = "payment_date <= '" . $conn->real_escape_string($_GET['to_date']) . "'";
foreach (['board_id', 'course_id', 'combination_id'] as $f) {
    if (isset($_GET[$f]) && $_GET[$f] !== '') $w[] = "`$f` = '" . $conn->real_escape_string($_GET[$f]) . "'";
}
$where  = $w ? 'WHERE ' . implode(' AND ', $w) : '';
$result = $conn->query("SELECT * FROM installments $where ORDER BY id DESC");

$distinct = function ($col) use ($conn) {
    return $conn->query("SELECT DISTINCT `$col` AS v FROM installments WHERE `$col` IS NOT NULL AND `$col`<>'' ORDER BY id")->fetch_all(MYSQLI_ASSOC);
};
$opt = function ($col) use ($distinct) {
    $h = '';
    foreach ($distinct($col) as $r) {
        $s = (($_GET[$col] ?? '') === (string)$r['v']) ? 'selected' : '';
        $h .= '<option value="' . e($r['v']) . '" ' . $s . '> ' . e($r['v']) . " </option>\n";
    }
    return $h;
};
?>

<div class="main-content">
<h4>💰 Manage Installments</h4>

<!-- FILTER -->
<form method="GET" class="row g-3 mb-4">

<div class="col-md-3">
<label>Filter</label>
<select name="filter" class="form-control">
    <option value="">Select</option>
    <option value="last_week" <?= $filter === 'last_week' ? 'selected' : '' ?>>Last Week</option>
    <option value="last_month" <?= $filter === 'last_month' ? 'selected' : '' ?>>Last Month</option>
</select>
</div>

<div class="col-md-3">
<label>From</label>
<input type="date" name="from_date" value="<?= e($_GET['from_date'] ?? '') ?>" class="form-control">
</div>

<div class="col-md-3">
<label>To</label>
<input type="date" name="to_date" value="<?= e($_GET['to_date'] ?? '') ?>" class="form-control">
</div>

<div class="col-md-3">
<label>Board</label>
<select name="board_id" class="form-control">
    <option value="">All</option>
    <?= $opt('board_id') ?>
</select>
</div>

<div class="col-md-3">
<label>Course</label>
<select name="course_id" class="form-control">
    <option value="">All</option>
    <?= $opt('course_id') ?>
</select>
</div>

<div class="col-md-3">
<label>Combination</label>
<select name="combination_id" class="form-control">
    <option value="">All</option>
    <?= $opt('combination_id') ?>
</select>
</div>

<div class="col-md-3 align-self-end">
<button class="btn btn-primary">Filter</button>
<a href="manage_installments.php" class="btn btn-secondary">Reset</a>
</div>

</form>

<a href="add_installment.php" class="btn btn-success mb-3">➕ Add Installment</a>

<!-- TABLE -->
<table id="installmentsTable" class="table table-bordered table-striped">
<thead class="table-dark">
<tr>
    <th>#</th>
    <th>Student</th>
    <th>Total Amt</th>
    <th>Installment Amt</th>
    <th>Balance</th>
    <th>Date</th>
    <th>Status</th>
    <th>Board</th>
    <th>Course</th>
    <th>Combination</th>
    <th>Inst No</th>
    <th>Payment Mode</th>
    <th>Cash Amount</th>
    <th>Online Amount</th>
    <th>Reference</th>
    <th>Action</th>
</tr>
</thead>
<tbody>
<?php $i = 1; while ($r = $result->fetch_assoc()): ?>
<tr>
    <td><?= $i++ ?></td>
    <td><?= e($r['student_name']) ?> </td>
    <td><?= number_format((float)$r['total_fees']) ?></td>
    <td><?= number_format((float)$r['amount'], 2) ?></td>
    <td><?= number_format((float)$r['balance'], 2) ?></td>
    <td><?= e($r['payment_date']) ?></td>
    <td><?= e($r['status']) ?></td>
    <td><?= e($r['board_id']) ?></td>
    <td><?= e($r['course_id']) ?></td>
    <td><?= e($r['combination_id']) ?></td>
    <td><?= e($r['installment_no']) ?></td>
    <td> <?= e($r['payment_mode']) ?> </td>
    <td><?= $r['cash_amount'] !== null ? number_format((float)$r['cash_amount'], 2) : 'NA' ?></td>
    <td><?= $r['online_amount'] !== null ? number_format((float)$r['online_amount'], 2) : 'NA' ?></td>
    <td><?= e($r['reference']) ?></td>
    <td>
        <a href="edit_installment.php?id=<?= $r['id'] ?>" class="btn btn-warning btn-sm">Edit</a>
        <a href="delete_installment.php?id=<?= $r['id'] ?>" class="btn btn-danger btn-sm" onclick="return confirm('Delete?')">Delete</a>
    </td>
</tr>
<?php endwhile; ?>
</tbody>
<tfoot>
<tr>
    <th colspan="2" style="text-align:right">Total:</th>
    <th></th> <!-- Total Amt -->
    <th></th> <!-- Installment Amt -->
    <th></th> <!-- Balance -->
    <th colspan="7"></th>
    <th></th> <!-- Cash -->
    <th></th> <!-- Online -->
    <th colspan="2"></th>
</tr>
</tfoot>
</table>
</div>

<?php include __DIR__ . '/../includes/datatables.php'; ?>
<script>
$(document).ready(function() {
    $('#installmentsTable').DataTable({
        dom: 'Bfrtip',
        buttons: ['copy','csv','excel','pdf','print'],
        pageLength: 10,
        order: [[0, 'asc']],
        responsive: true,
        footerCallback: function (row, data, start, end, display) {
            var api = this.api();

            // Convert to number
            var parseVal = function (i) {
                return typeof i === 'string' ? i.replace(/[^0-9.-]+/g, '') * 1 :
                       typeof i === 'number' ? i : 0;
            };

            // Function to calculate column total
            function getTotal(colIndex) {
                return api
                    .column(colIndex, { page: 'current' })
                    .data()
                    .reduce(function (a, b) {
                        return parseVal(a) + parseVal(b);
                    }, 0);
            }

            var totalAmt = getTotal(2);
            var installmentAmt = getTotal(3);
            var balance = getTotal(4);
            var cash = getTotal(12);
            var online = getTotal(13);

            // Update footer
            $(api.column(2).footer()).html(totalAmt.toFixed(2));
            $(api.column(3).footer()).html(installmentAmt.toFixed(2));
            $(api.column(4).footer()).html(balance.toFixed(2));
            $(api.column(12).footer()).html(cash.toFixed(2));
            $(api.column(13).footer()).html(online.toFixed(2));
        }
    });
});
</script>
<?php include __DIR__ . '/../includes/footer.php'; ?>

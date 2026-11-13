<?php
require_once __DIR__ . '/../includes/student.php';
require_login();
student_handle_post($conn, 'sslc');
include __DIR__ . '/../includes/header.php';
?>
<div class="container-fluid">
<div class="row">

<div class="col-md-2 p-0">
<?php include __DIR__ . '/../includes/sidebar.php'; ?>
</div>

<div class="col-md-10 p-4">
<div class="card shadow p-4">

<h4 class="mb-3">➕ Add SSLC Student</h4>

<form method="POST" enctype="multipart/form-data" class="row g-3">

<!-- Basic Info -->
<div class="col-md-6">
<label>Student Name</label>
<input name="student_name" class="form-control" required>
</div>

<div class="col-md-6">
<label>Father Name</label>
<input name="father_name" class="form-control">
</div>

<div class="col-md-6">
<label>Mother Name</label>
<input name="mother_name" class="form-control">
</div>

<div class="col-md-3">
<label>DOB</label>
<input type="date" name="dob" class="form-control">
</div>

<div class="col-md-3">
<label>Age</label>
<input name="age" class="form-control" readonly>
</div>

<div class="col-md-4">
<label>Category</label>
<input name="category" class="form-control">
</div>

<div class="col-md-4">
<label>Caste</label>
<input name="caste" class="form-control">
</div>

<div class="col-md-4">
<label>Subcaste</label>
<input name="subcaste" class="form-control">
</div>

<div class="col-md-4">
<label>Gender</label>
<select name="gender" class="form-control">
<option>Male</option>
<option>Female</option>
<option>Other</option>
</select>
</div>

<div class="col-md-6">
<label>Aadhar Card Number</label>
<input name="aadhar_card" class="form-control">
</div>

<div class="col-md-12">
<label>Address</label>
<textarea name="address" class="form-control"></textarea>
</div>

<div class="col-md-6">
<label>Mobile</label>
<input name="mobile" class="form-control">
</div>

<div class="col-md-6">
<label>WhatsApp</label>
<input name="whatsapp" class="form-control">
</div>

<div class="col-md-6">
<label>Email</label>
<input name="email" class="form-control">
</div>

<div class="col-md-4">
<label>Nationality</label>
<input name="nationality" class="form-control">
</div>

<div class="col-md-4">
<label>Religion</label>
<input name="religion" class="form-control">
</div>

<div class="col-md-4">
<label>Mother Tongue</label>
<input name="mother_tongue" class="form-control">
</div>

<hr>
<h5>Admission Details</h5>

<div class="col-md-3">
<label>Admission Year</label>
<input name="admission_year" class="form-control">
</div>

<div class="col-md-3">
<label>Admission Batch</label>
<input name="admission_batch" class="form-control">
</div>

<div class="col-md-3">
<label>Admission Number</label>
<input name="admission_number" class="form-control">
</div>

<div class="col-md-3">
<label>Register Number</label>
<input name="register_number" class="form-control">
</div>

<div class="col-md-6">
<label>Photo</label>
<input type="file" name="photo" class="form-control">
</div>

<hr>
<h5>Course Details</h5>

<div class="col-md-4">
<label>Board</label>
<input name="board_id" class="form-control">
</div>

<div class="col-md-4">
<label>Course</label>
<input name="course_id" class="form-control">
</div>

<div class="col-md-4">
<label>Combination</label>
<input name="combination_id" class="form-control">
</div>

<div class="col-md-6">
<label>Language 1</label>
<input name="language1" class="form-control">
</div>

<div class="col-md-6">
<label>Language 2</label>
<input name="language2" class="form-control">
</div>

<div class="col-12">
<button name="save" class="btn btn-success">💾 Save</button>
<a href="../dashboard.php?tab=sslc" class="btn btn-secondary">Back</a>
</div>

</form>
</div>
</div>
</div>
</div>

<!-- Auto Age Script -->
<script>
document.querySelector("input[name='dob']").addEventListener("change", function() {
    let dob = new Date(this.value);
    let today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    let m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    document.querySelector("input[name='age']").value = age;
});
</script>
<?php include __DIR__ . '/../includes/footer.php'; ?>

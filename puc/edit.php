<?php
require_once __DIR__ . '/../includes/student.php';
require_login();
$row = student_load_or_die($conn, 'puc');
student_handle_post($conn, 'puc', $row);
include __DIR__ . '/../includes/header.php';
?>
<div class="container-fluid">
<div class="row">

<div class="col-md-2 p-0">
<?php include __DIR__ . '/../includes/sidebar.php'; ?>
</div>

<div class="col-md-10 p-4">
<div class="card shadow p-4">


<h4 class="mb-3">✏️ Edit PUC Student</h4>

<form method="POST" enctype="multipart/form-data" class="row g-3">

<!-- Basic Info -->
<div class="col-md-6">
<label>Student Name</label>
<input name="student_name" class="form-control" value="<?= e($row['student_name']) ?>" required>
</div>
<div class="col-md-6">
<label>Father Name</label>
<input name="father_name" class="form-control" value="<?= e($row['father_name']) ?>">
</div>
<div class="col-md-6">
<label>Mother Name</label>
<input name="mother_name" class="form-control" value="<?= e($row['mother_name']) ?>">
</div>
<div class="col-md-3">
<label>DOB</label>
<input type="date" name="dob" class="form-control" value="<?= e($row['dob']) ?>">
</div>
<div class="col-md-3">
<label>Age</label>
<input name="age" class="form-control" value="<?= e($row['age']) ?>" readonly>
</div>
<div class="col-md-4">
<label>Category</label>
<input name="category" class="form-control" value="<?= e($row['category']) ?>">
</div>
<div class="col-md-4">
<label>Caste</label>
<input name="caste" class="form-control" value="<?= e($row['caste']) ?>">
</div>
<div class="col-md-4">
<label>Subcaste</label>
<input name="subcaste" class="form-control" value="<?= e($row['subcaste']) ?>">
</div>
<div class="col-md-4">
<label>Gender</label>
<select name="gender" class="form-control">
<?= gender_options($row['gender']) ?>
</select>
</div>
<div class="col-md-6">
<label>Aadhar Number</label>
<input name="aadhar_card" class="form-control" value="<?= e($row['aadhar_card']) ?>">
</div>
<div class="col-md-6">
<label>Mobile</label>
<input name="mobile" class="form-control" value="<?= e($row['mobile']) ?>">
</div>
<div class="col-md-6">
<label>Whatsapp</label>
<input name="whatsapp" class="form-control" value="<?= e($row['whatsapp']) ?>">
</div>
<div class="col-md-6">
<label>Email</label>
<input name="email" class="form-control" value="<?= e($row['email']) ?>">
</div>
<div class="col-md-4">
<label>Nationality</label>
<input name="nationality" class="form-control" value="<?= e($row['nationality']) ?>">
</div>
<div class="col-md-4">
<label>Religion</label>
<input name="religion" class="form-control" value="<?= e($row['religion']) ?>">
</div>
<div class="col-md-4">
<label>Mother Tongue</label>
<input name="mother_tongue" class="form-control" value="<?= e($row['mother_tongue']) ?>">
</div>
<!-- Student Photo -->
<div class="col-md-6">
<label>Student Photo</label>
<input type="file" name="photo" class="form-control">
</div>
<hr>
<h5>Course Details</h5>
<div class="col-md-4">
<label>Board</label>
<input name="board_id" class="form-control" value="<?= e($row['board_id']) ?>">
</div>
<div class="col-md-4">
<label>Course</label>
<input name="course_id" class="form-control" value="<?= e($row['course_id']) ?>">
</div>
<div class="col-md-4">
<label>Combination</label>
<input name="combination_id" class="form-control" value="<?= e($row['combination_id']) ?>">
</div>
<div class="col-md-6">
<label>Language 1</label>
<input name="language1" class="form-control" value="<?= e($row['language1']) ?>">
</div>
<div class="col-md-6">
<label>Language 2</label>
<input name="language2" class="form-control" value="<?= e($row['language2']) ?>">
</div>
<hr>
<h5>SSLC Details</h5>
<div class="col-md-4">
<label>SSLC Register Number</label>
<input name="sslc_register_number" class="form-control" value="<?= e($row['sslc_register_number']) ?>">
</div>
<div class="col-md-4">
<label>SSLC Passed Year</label>
<input type="number" name="sslc_passed_year" class="form-control" value="<?= e($row['sslc_passed_year']) ?>">
</div>
<div class="col-md-4">
<label>SSLC Board Name</label>
<input name="sslc_board_name" class="form-control" value="<?= e($row['sslc_board_name']) ?>">
</div>
<div class="col-md-6">
<label>Upload SSLC Marks Card</label>
<input type="file" name="sslc_marks_card" class="form-control">
</div>
<hr>
<div class="col-md-6">
<label>Admission Number</label>
<input name="admission_number" class="form-control" value="<?= e($row['admission_number']) ?>">
</div>
<div class="col-md-6">
<label>Register Number</label>
<input name="register_number" class="form-control" value="<?= e($row['register_number']) ?>">
</div>
<div class="col-12">
<button name="update" class="btn btn-warning">💾 Update</button>
<a href="../dashboard.php?tab=puc" class="btn btn-secondary">Back</a>
</div>

</form>
</div>
</div>
</div>
</div>

<script>
// Auto-update age when DOB changes
const dobInput = document.querySelector("[name='dob']");
const ageInput = document.querySelector("[name='age']");

function updateAge() {
    if(dobInput.value){
        const dob = new Date(dobInput.value);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        if(today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())){
            age--;
        }
        ageInput.value = age;
    } else {
        ageInput.value = '';
    }
}

// Update on page load
updateAge();

// Update on change
dobInput.addEventListener("change", updateAge);
</script>

<?php include __DIR__ . '/../includes/footer.php'; ?>

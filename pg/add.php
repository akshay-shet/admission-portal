<?php
require_once __DIR__ . '/../includes/student.php';
require_login();
student_handle_post($conn, 'pg');
include __DIR__ . '/../includes/header.php';
?>
<div class="container-fluid">
<div class="row">

<div class="col-md-2 p-0">
<?php include __DIR__ . '/../includes/sidebar.php'; ?>
</div>

<div class="col-md-10 p-4">
<div class="card shadow p-4">


<h4>➕ Add PG Student</h4>

<form method="POST" enctype="multipart/form-data" class="row g-3">

<!-- Personal Info -->
<div class="col-md-6"><label>Name</label><input name="student_name" class="form-control" required></div>
<div class="col-md-6"><label>Father Name</label><input name="father_name" class="form-control"></div>
<div class="col-md-6"><label>Mother Name</label><input name="mother_name" class="form-control"></div>
<div class="col-md-3"><label>DOB</label><input type="date" name="dob" class="form-control"></div>
<div class="col-md-3"><label>Age</label><input name="age" class="form-control" readonly></div>
<div class="col-md-4"><label>Category</label><input name="category" class="form-control"></div>
<div class="col-md-4"><label>Caste</label><input name="caste" class="form-control"></div>
<div class="col-md-4"><label>Subcaste</label><input name="subcaste" class="form-control"></div>
<div class="col-md-4">
<label>Gender</label>
<select name="gender" class="form-control">
<option>Male</option>
<option>Female</option>
<option>Other</option>
</select>
</div>
<div class="col-md-6"><label>Aadhar</label><input name="aadhar" class="form-control"></div>
<div class="col-md-6"><label>Mobile</label><input name="mobile" class="form-control"></div>
<div class="col-md-6"><label>WhatsApp</label><input name="whatsapp" class="form-control"></div>
<div class="col-md-6"><label>Email</label><input name="email" class="form-control"></div>
<div class="col-md-4"><label>Nationality</label><input name="nationality" class="form-control"></div>
<div class="col-md-4"><label>Religion</label><input name="religion" class="form-control"></div>
<div class="col-md-4"><label>Mother Tongue</label><input name="mother_tongue" class="form-control"></div>
<div class="col-md-6"><label>Photo</label><input type="file" name="photo" class="form-control"></div>
<!-- Admission -->
<h5>Admission</h5>
<div class="col-md-3"><input name="admission_year" placeholder="Year" class="form-control"></div>
<div class="col-md-3"><input name="admission_batch" placeholder="Batch" class="form-control"></div>
<div class="col-md-3"><input name="admission_number" placeholder="Admission No" class="form-control"></div>
<div class="col-md-3"><input name="register_number" placeholder="Register No" class="form-control"></div>
<!-- SSLC -->
<h5>SSLC Details</h5>
<div class="col-md-3"><input name="sslc_register_number" placeholder="SSLC Reg No" class="form-control"></div>
<div class="col-md-3"><input name="sslc_passed_year" placeholder="Passed Year" class="form-control"></div>
<div class="col-md-3"><input name="sslc_board_name" placeholder="Board Name" class="form-control"></div>
<div class="col-md-3"><label>SSLC Marks Card</label><input type="file" name="sslc_marks_card" class="form-control"></div>
<!-- PUC -->
<h5>PUC Details</h5>
<div class="col-md-3"><input name="puc_register_number" placeholder="PUC Reg No" class="form-control"></div>
<div class="col-md-3"><input name="puc_passed_year" placeholder="Passed Year" class="form-control"></div>
<div class="col-md-3"><input name="puc_board_name" placeholder="Board Name" class="form-control"></div>
<div class="col-md-3"><label>PUC Marks Card</label><input type="file" name="puc_marks_card" class="form-control"></div>
<!-- Degree -->
<h5>Degree Details</h5>
<div class="col-md-3"><input name="degree_register_number" placeholder="Degree Reg No" class="form-control"></div>
<div class="col-md-3"><input name="degree_passed_year" placeholder="Passed Year" class="form-control"></div>
<div class="col-md-3"><input name="degree_board_name" placeholder="Board Name" class="form-control"></div>
<div class="col-md-3"><label>Degree Marks Card</label><input type="file" name="degree_marks_card" class="form-control"></div>
<div class="col-md-6"><input name="degree_course_id" placeholder="Degree Course Name" class="form-control"></div>
<div class="col-md-6"><input name="degree_combination_id" placeholder="Degree Combination Name" class="form-control"></div>
<!-- PG Course -->
<h5>PG Course Details</h5>
<div class="col-md-4"><input name="board_id" placeholder="Board Name" class="form-control"></div>
<div class="col-md-4"><input name="course_id" placeholder="Course Name" class="form-control"></div>
<div class="col-md-4"><input name="combination_id" placeholder="Combination Name" class="form-control"></div>
<div class="col-md-4"><input name="year" placeholder="Year" class="form-control"></div>
<div class="col-md-4"><input name="batch" placeholder="Batch" class="form-control"></div>
<div class="col-md-4"><input name="sem" placeholder="SEM" class="form-control"></div>
<div class="col-md-6"><input name="language1" placeholder="Language 1" class="form-control"></div>
<div class="col-md-6"><input name="language2" placeholder="Language 2" class="form-control"></div>
<div class="col-12"><button name="save" class="btn btn-success">Save</button></div>

</form>
</div>
</div>
</div>
</div>

<script>
document.querySelector("[name='dob']").addEventListener("change", function(){
    let dob = new Date(this.value);
    let today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    if(today.getMonth() < dob.getMonth() || (today.getMonth() == dob.getMonth() && today.getDate() < dob.getDate())) {
        age--;
    }
    document.querySelector("[name='age']").value = age;
});
</script>

<?php include __DIR__ . '/../includes/footer.php'; ?>

(function () {
  window.syncEmployeeSalaryFromDepartment = function (sourceElement) {
    const departmentInput = sourceElement || document.getElementById("id_department");
    const salaryInput = document.getElementById("id_salary");

    if (!departmentInput || !salaryInput) {
      return;
    }

    let salaryMap = {};
    try {
      salaryMap = JSON.parse(departmentInput.dataset.salaryMap || "{}");
    } catch (error) {
      salaryMap = {};
    }

    const selectedDepartmentId = departmentInput.value;
    salaryInput.value = salaryMap[selectedDepartmentId] || "";
  };

  document.addEventListener("DOMContentLoaded", function () {
    const departmentInput = document.getElementById("id_department");
    if (!departmentInput) {
      return;
    }

    window.syncEmployeeSalaryFromDepartment(departmentInput);
    departmentInput.addEventListener("change", function () {
      window.syncEmployeeSalaryFromDepartment(departmentInput);
    });

    if (window.django && window.django.jQuery) {
      window.django.jQuery(departmentInput).on(
        "change select2:select select2:clear",
        function () {
          window.syncEmployeeSalaryFromDepartment(departmentInput);
        }
      );
    }
  });
})();

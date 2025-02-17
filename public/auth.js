document.addEventListener("DOMContentLoaded", function () {
    const toggleToLogin = document.getElementById("toggle-to-login");
    const toggleToRegister = document.getElementById("toggle-to-register");
    const registerForm = document.getElementById("register-form");
    const loginForm = document.getElementById("login-form");

    if (toggleToLogin && toggleToRegister) {
        toggleToRegister.addEventListener("click", function (e) {
            e.preventDefault();
            registerForm.style.display = "block";
            loginForm.style.display = "none";
            toggleToRegister.style.display = "none"; // Hide "Register here" link
            toggleToLogin.style.display = "inline"; // Show "Already have an account?" link
        });

        toggleToLogin.addEventListener("click", function (e) {
            e.preventDefault();
            registerForm.style.display = "none";
            loginForm.style.display = "block";
            toggleToRegister.style.display = "inline"; // Show "Register here" link
            toggleToLogin.style.display = "none"; // Hide "Already have an account?" link
        });
    }
});

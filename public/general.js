document.addEventListener("DOMContentLoaded", function () {
    // Sidebar Elements
    const menuIcon = document.querySelector(".menu-icon");
    const sidebar = document.querySelector(".sidebar");

    // Login & Register Elements
    const toggleToLogin = document.getElementById("toggle-to-login");
    const toggleToRegister = document.getElementById("toggle-to-register");
    const registerForm = document.getElementById("register-form");
    const loginForm = document.getElementById("login-form");

    const navbar = document.querySelector(".navbar");
    const containers = document.querySelectorAll(".container, .account-container, .workout-container");

    // ✅ **Adjust Padding for Fixed Navbar**
    function adjustPadding() {
        if (!navbar) return;
        const navbarHeight = navbar.offsetHeight + 10; // Add extra padding
        containers.forEach(container => {
            container.style.paddingTop = `${navbarHeight}px`;
        });
    }

    adjustPadding(); // Run on load
    window.addEventListener("resize", adjustPadding); // Adjust on resize

    // ✅ **Sidebar Toggle (Open & Close with Hamburger Click)**
    if (menuIcon && sidebar) {
        menuIcon.addEventListener("click", () => {
            sidebar.classList.toggle("open"); // ✅ Toggle open/close
            console.log(sidebar.classList.contains("open") ? "Sidebar Opened" : "Sidebar Closed"); // ✅ Debugging log
        });

        // ✅ Close Sidebar When Clicking Outside
        document.addEventListener("click", (event) => {
            if (!sidebar.contains(event.target) && !menuIcon.contains(event.target)) {
                sidebar.classList.remove("open");
            }
        });
    }

    // ✅ **Login & Register Toggle**
    if (toggleToLogin && toggleToRegister) {
        toggleToLogin.addEventListener("click", function (e) {
            e.preventDefault();
            registerForm.style.display = "none";
            loginForm.style.display = "block";
        });

        toggleToRegister.addEventListener("click", function (e) {
            e.preventDefault();
            registerForm.style.display = "block";
            loginForm.style.display = "none";
        });
    }
});
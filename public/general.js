document.addEventListener("DOMContentLoaded", function () {
    // Sidebar Elements
    const menuIcon = document.querySelector(".menu-icon");
    const sidebar = document.querySelector(".sidebar");
    const closeBtn = document.querySelector(".close-btn");
    const overlay = document.querySelector(".overlay");

    // Login & Register Elements
    const toggleToLogin = document.getElementById("toggle-to-login");
    const toggleToRegister = document.getElementById("toggle-to-register");
    const registerForm = document.getElementById("register-form");
    const loginForm = document.getElementById("login-form");

    const navbar = document.querySelector(".navbar");
    const containers = document.querySelectorAll(".container, .account-container, .workout-container");

    function adjustPadding() {
        if (!navbar) return;
        const navbarHeight = navbar.offsetHeight + 10; // Add extra padding for spacing
        containers.forEach(container => {
            container.style.paddingTop = `${navbarHeight}px`;
        });
    }

    // ✅ **Adjust on Load & Resize**
    adjustPadding();
    window.addEventListener("resize", adjustPadding);

    // ✅ Sidebar Toggle
    // if (menuIcon && sidebar && closeBtn) {
    //     menuIcon.addEventListener("click", () => sidebar.classList.add("open"));
    //     closeBtn.addEventListener("click", () => sidebar.classList.remove("open"));
    // }

    // Function to toggle sidebar visibility
    function toggleSidebar() {
        sidebar.classList.toggle("open");
    }

    // Open sidebar when menu icon is clicked
    menuIcon.addEventListener("click", function (event) {
        event.stopPropagation(); // Prevent click from propagating to document
        toggleSidebar();
    });

    // Close sidebar when close button is clicked
    closeBtn.addEventListener("click", function () {
        sidebar.classList.remove("open");
    });

    // Close sidebar when clicking outside of it
    document.addEventListener("click", function (event) {
        if (!sidebar.contains(event.target) && !menuIcon.contains(event.target)) {
            sidebar.classList.remove("open");
        }
    });

    // ✅ Login & Register Toggle
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

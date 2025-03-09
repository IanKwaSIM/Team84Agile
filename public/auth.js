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
    
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const authContainer = document.getElementById('auth-container');

    if (loginBtn) {
        loginBtn.addEventListener('click', function () {
            authContainer.style.display = 'block';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            // Redirect to the logout route
            window.location.href = '/logout';
        });
    }
    
    if (loginForm) {
        loginForm.addEventListener("submit", async function (event) {
            event.preventDefault(); // Prevent default form submission

            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            try {
                const response = await fetch("/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                });

                const data = await response.json();

                if (data.success) {
                    // Redirect silently without showing a popup
                    window.location.href = data.redirect;
                } else {
                    // Show an error popup for failed login
                    alert(data.message);
                }
            } catch (error) {
                console.error("Error:", error);
                alert("An unexpected error occurred. Please try again.");
            }
        });
    }
});
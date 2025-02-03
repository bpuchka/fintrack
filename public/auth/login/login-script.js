document.addEventListener("DOMContentLoaded", function() {
    var validation_box;
    
    const validationState = {
        "email": false,
        "password": false
    };

    function addValidationClass(input, checker, validation_box) {
        const validationActions = {
            0: () => {
                input.classList.remove("invalid-field", "valid-field");
                validation_box.classList.remove("show-message");
                validationState[input.id] = false;
            },
            1: () => {
                input.classList.remove("invalid-field");
                input.classList.add("valid-field");
                validation_box.classList.remove("show-message");
                validationState[input.id] = true;
            },
            2: () => {
                input.classList.remove("valid-field");
                input.classList.add("invalid-field");
                validation_box.classList.add("show-message");
                validationState[input.id] = false;
            }
        };
    
        (validationActions[checker] || (() => {}))();
        updateButtonState();
    }

    const loginBtn = document.getElementById("login-btn");

    function updateButtonState() {
        const allValid = Object.values(validationState).every(state => state === true);
        loginBtn.disabled = !allValid;
        loginBtn.style.opacity = allValid ? "1" : "0.5";
        loginBtn.style.cursor = allValid ? "pointer" : "not-allowed";
    }

    const emailInput = document.getElementById("email");
    emailInput.addEventListener("input", function() {
        const emailValue = emailInput.value;
        validation_box = document.getElementById("email-validation-box");
        addValidationClass(emailInput, checkEmail(emailValue), validation_box);
    });

    function checkEmail(emailValue) {
        if(emailValue === "") return 0;
        const regexEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return regexEmail.test(emailValue) ? 1 : 2;
    }

    const passwordInput = document.getElementById("password");
    passwordInput.addEventListener("input", function() {
        const passwordValue = passwordInput.value;
        validation_box = document.getElementById("password-validation-box");
        addValidationClass(passwordInput, checkPassword(passwordValue), validation_box);
    });

    function checkPassword(passwordValue) {
        if(passwordValue === "") return 0;
        return passwordValue.length >= 8 ? 1 : 2;
    }

    const form = document.getElementById("login-form");
    form.addEventListener("submit", function(e) {
        e.preventDefault();
        
        if (!Object.values(validationState).every(state => state === true)) {
            return;
        }

        const formData = new FormData(form);
        const { email, password } = Object.fromEntries(formData.entries());
        const remember = document.getElementById("remember").checked;
    
        fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password,
                remember
            })
        })
        .then(async response => {
            if (!response.ok) {
                const error = await response.text();
                throw new Error(error);
            }
            return response.json();
        })
        .then(data => {
            if (data.message === "Login successful") {
                window.location.href = "/home";
            } else {
                alert(data.message);
            }
        })
        .catch(error => {
            console.error("Error:", error);
            alert("Login failed. Please check your credentials.");
        });
    });

    updateButtonState();
});
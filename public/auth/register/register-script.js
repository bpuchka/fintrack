document.addEventListener("DOMContentLoaded", function() {
    // Validation box variable - used across different validation functions
    var validation_box;
    
    // Track current password value at the form level scope
    var currentPassword = '';

    // Function to handle validation class changes and button state updates
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

    // Initialize validation state for all form fields
    const validationState = {
        "username": false,
        "email": false,
        "password": false,
        "repeated-password": false
    };

    // Button state handler
    const registerBtn = document.getElementById("register-btn");

    // Update button state based on all validation states
    function updateButtonState() {
        const allValid = Object.values(validationState).every(state => state === true);
        registerBtn.disabled = !allValid;
        registerBtn.style.opacity = allValid ? "1" : "0.5";
        registerBtn.style.cursor = allValid ? "pointer" : "not-allowed";
    }

    // Username validation
    const usernameInput = document.getElementById("username");
    usernameInput.addEventListener("input", function() {
        const usernameValue = usernameInput.value;
        validation_box = document.getElementById("username-validation-box");
        addValidationClass(usernameInput, checkUsername(usernameValue), validation_box);
    });

    function checkUsername(username){
        if(username == ""){
            return 0;
        } else{
            if(username.length>=6){
                return 1;
            } else{return 2;}
        }
    }

    // Email validation
    const emailInput = document.getElementById("email");
    emailInput.addEventListener("input", function() {
        const emailValue = emailInput.value;
        validation_box = document.getElementById("email-validation-box");
        addValidationClass(emailInput, checkEmail(emailValue), validation_box);
    });

    function checkEmail(emailValue){
        if(emailValue==""){ // Check for empty field
            return 0;
        }
        else{
            const regexEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            const emailCheck = regexEmail.test(emailValue);
            if(emailCheck===true){
                return 1;
            }else{
                return 2;
            }
        }
    }

    // Password validation
    const passwordInput = document.getElementById("password");
    const repeatedPw = document.getElementById("repeated-password");

    const requirements = {
        "length-requirement": (password) => password.length >= 8 && password.length <= 32,
        "uppercase-requirement": (password) => /[A-Z]/.test(password),
        "lowercase-requirement": (password) => /[a-z]/.test(password),
        "digit-requirement": (password) => /\d/.test(password),
        "special-requirement": (password) => /[@$!%*?&]/.test(password),
    };

    // Password input event handler
    passwordInput.addEventListener("input", function() {
        currentPassword = passwordInput.value; // Update the current password
        validation_box = document.getElementById("password-validation-box");
        addValidationClass(passwordInput, checkPassword(currentPassword), validation_box);
        
        // Update requirements visualization
        for (const [id, check] of Object.entries(requirements)) {
            const element = document.getElementById(id);
            if (check(currentPassword)) {
                element.classList.add("valid-requirement");
            } else {
                element.classList.remove("valid-requirement");
            }
        }

        // Revalidate repeated password when main password changes
        if (repeatedPw.value !== '') {
            validation_box = document.getElementById("confPass-validation-box");
            addValidationClass(repeatedPw, checkRepeatedPw(repeatedPw.value, currentPassword), validation_box);
        }
    });

    function checkPassword(passwordValue) {
        if(passwordValue==""){
            return 0;
        }else{  // Regex to check password requirements
            const regexPassword = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,32}$/;
            const passwordCheck = regexPassword.test(passwordValue);
            if (passwordCheck === true) {
                return 1;
            } else {
                return 2;
            }
        }
    }

    // Repeated password validation
    repeatedPw.addEventListener("input", function() {
        const repeatedPwValue = repeatedPw.value;
        validation_box = document.getElementById("confPass-validation-box");
        addValidationClass(repeatedPw, checkRepeatedPw(repeatedPwValue, currentPassword), validation_box);
    });

    function checkRepeatedPw(repPass, password) {
        if(repPass == "") {
            return 0;
        } else {
            return repPass === password ? 1 : 2;
        }
    }

    // Initialize button state
    updateButtonState();


    // Form submission
    const form = document.getElementById("register-form");
    form.addEventListener("submit", function(e) {
        e.preventDefault();
        
        if (!Object.values(validationState).every(state => state === true)) {
            return;
        }

        const formData = new FormData(form);
        const formObject = Object.fromEntries(formData.entries());
        const { username, email, password } = formObject;
    
        fetch("/api/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                email,
                password
            })
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                if (response.status === 400 && data.message === "Email already exists") {
                    throw new Error("This email is already registered");
                }
                throw new Error(data.message || "Registration failed");
            }
            return data;
        })
        .then(data => {
            if (data.message === "Registration successful") {
                window.location.href = "/login";
            } else {
                alert(data.message);
            }
        })
        .catch(error => {
            console.error("Error:", error);
            alert(error.message);
        });
    });
});
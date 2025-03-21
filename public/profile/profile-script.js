document.addEventListener("DOMContentLoaded", function() {
    // Get all forms
    const profileInfoForm = document.getElementById("profile-info-form");
    const passwordForm = document.getElementById("password-form");
    
    // Get all buttons
    const updateInfoBtn = document.getElementById("update-info-btn");
    const updatePasswordBtn = document.getElementById("update-password-btn");
    const logoutAllBtn = document.getElementById("logout-all-btn");
    const deleteAccountBtn = document.getElementById("delete-account-btn");
    
    // Get modal elements
    const confirmModal = document.getElementById("confirm-modal");
    const modalTitle = document.getElementById("modal-title");
    const modalMessage = document.getElementById("modal-message");
    const confirmActionBtn = document.getElementById("confirm-action");
    const cancelActionBtn = document.getElementById("cancel-action");
    const closeModalBtn = document.querySelector(".close-modal");
    
    // Variables for validation tracking
    let validation_box;
    let currentNewPassword = "";
    
    // Initialize validation states
    const profileValidationState = {
        "username": true, // Initially valid as it's pre-filled
        "email": true // Initially valid as it's pre-filled
    };
    
    const passwordValidationState = {
        "current-password": false,
        "new-password": false,
        "confirm-password": false
    };
    
    // Requirements for password validation
    const requirements = {
        "length-requirement": (password) => password.length >= 8 && password.length <= 32,
        "uppercase-requirement": (password) => /[A-Z]/.test(password),
        "lowercase-requirement": (password) => /[a-z]/.test(password),
        "digit-requirement": (password) => /\d/.test(password),
        "special-requirement": (password) => /[@$!%*?&]/.test(password),
    };
    
    // Function to handle validation class changes
    function addValidationClass(input, checker, validation_box, validationState) {
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
        updateButtonStates();
    }
    
    // Update button states based on validation
    function updateButtonStates() {
        // Profile Info Form
        const profileValid = Object.values(profileValidationState).every(state => state === true);
        updateInfoBtn.disabled = !profileValid;
        updateInfoBtn.style.opacity = profileValid ? "1" : "0.5";
        updateInfoBtn.style.cursor = profileValid ? "pointer" : "not-allowed";
        
        // Password Form
        const passwordValid = Object.values(passwordValidationState).every(state => state === true);
        updatePasswordBtn.disabled = !passwordValid;
        updatePasswordBtn.style.opacity = passwordValid ? "1" : "0.5";
        updatePasswordBtn.style.cursor = passwordValid ? "pointer" : "not-allowed";
    }
    
    // Username validation
    const usernameInput = document.getElementById("username");
    usernameInput.addEventListener("input", function() {
        const usernameValue = usernameInput.value;
        validation_box = document.getElementById("username-validation-box");
        addValidationClass(usernameInput, checkUsername(usernameValue), validation_box, profileValidationState);
    });
    
    function checkUsername(username) {
        if(username == "") {
            return 0;
        } else {
            if(username.length >= 6) {
                return 1;
            } else {
                return 2;
            }
        }
    }
    
    // Email validation
    const emailInput = document.getElementById("email");
    emailInput.addEventListener("input", function() {
        const emailValue = emailInput.value;
        validation_box = document.getElementById("email-validation-box");
        addValidationClass(emailInput, checkEmail(emailValue), validation_box, profileValidationState);
    });
    
    function checkEmail(emailValue) {
        if(emailValue == "") {
            return 0;
        } else {
            const regexEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            const emailCheck = regexEmail.test(emailValue);
            if(emailCheck === true) {
                return 1;
            } else {
                return 2;
            }
        }
    }
    
    // Current password validation
    const currentPasswordInput = document.getElementById("current-password");
    currentPasswordInput.addEventListener("input", function() {
        const passwordValue = currentPasswordInput.value;
        validation_box = document.getElementById("current-password-validation-box");
        addValidationClass(currentPasswordInput, passwordValue ? 1 : 0, validation_box, passwordValidationState);
    });
    
    // New password validation
    const newPasswordInput = document.getElementById("new-password");
    const confirmPasswordInput = document.getElementById("confirm-password");
    
    newPasswordInput.addEventListener("input", function() {
        currentNewPassword = newPasswordInput.value;
        validation_box = document.getElementById("new-password-validation-box");
        addValidationClass(newPasswordInput, checkPassword(currentNewPassword), validation_box, passwordValidationState);
        
        // Update requirements visualization
        for (const [id, check] of Object.entries(requirements)) {
            const element = document.getElementById(id);
            if (check(currentNewPassword)) {
                element.classList.add("valid-requirement");
            } else {
                element.classList.remove("valid-requirement");
            }
        }
        
        // Revalidate confirm password when new password changes
        if (confirmPasswordInput.value !== '') {
            validation_box = document.getElementById("confirm-password-validation-box");
            addValidationClass(confirmPasswordInput, checkConfirmPassword(confirmPasswordInput.value, currentNewPassword), validation_box, passwordValidationState);
        }
    });
    
    function checkPassword(passwordValue) {
        if(passwordValue == "") {
            return 0;
        } else {
            const regexPassword = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,32}$/;
            const passwordCheck = regexPassword.test(passwordValue);
            if (passwordCheck === true) {
                return 1;
            } else {
                return 2;
            }
        }
    }
    
    // Confirm password validation
    confirmPasswordInput.addEventListener("input", function() {
        const confirmValue = confirmPasswordInput.value;
        validation_box = document.getElementById("confirm-password-validation-box");
        addValidationClass(confirmPasswordInput, checkConfirmPassword(confirmValue, currentNewPassword), validation_box, passwordValidationState);
    });
    
    function checkConfirmPassword(confirmPassword, newPassword) {
        if(confirmPassword == "") {
            return 0;
        } else {
            return confirmPassword === newPassword ? 1 : 2;
        }
    }
    
    // Modal functions
    function openModal(title, message, actionText, callback) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        confirmActionBtn.textContent = actionText;
        
        // Set the action for confirm button
        confirmActionBtn.onclick = function() {
            closeModal();
            if (callback) callback();
        };
        
        confirmModal.style.display = "flex";
        document.body.style.overflow = "hidden"; // Prevent background scrolling
    }
    
    function closeModal() {
        confirmModal.style.display = "none";
        document.body.style.overflow = "auto"; // Re-enable scrolling
    }
    
    // Modal close events
    if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
    if (cancelActionBtn) cancelActionBtn.addEventListener("click", closeModal);
    
    // Close modal when clicking outside of it
    window.addEventListener("click", function(event) {
        if (event.target === confirmModal) {
            closeModal();
        }
    });
    
    // Form submission handlers
    if (profileInfoForm) {
        profileInfoForm.addEventListener("submit", function(e) {
            e.preventDefault();
            
            // Check if form is valid
            if (!Object.values(profileValidationState).every(state => state === true)) {
                return;
            }
            
            const formData = new FormData(profileInfoForm);
            const { username, email } = Object.fromEntries(formData.entries());
            
            // Send data to server
            fetch("/profile/update-info", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, email }),
                credentials: "same-origin"
            })
            .then(async response => {
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || "Failed to update profile");
                }
                return data;
            })
            .then(data => {
                Notify.success("Успех", "Профилната информация беше обновена успешно!");
                // If email was changed, you might want to refresh the page or update the UI
            })
            .catch(error => {
                console.error("Error:", error);
                Notify.error("Грешка", error.message);
            });
        });
    }
    
    if (passwordForm) {
        passwordForm.addEventListener("submit", function(e) {
            e.preventDefault();
            
            // Check if form is valid
            if (!Object.values(passwordValidationState).every(state => state === true)) {
                return;
            }
            
            const formData = new FormData(passwordForm);
            const { currentPassword, newPassword } = Object.fromEntries(formData.entries());
            
            // Send data to server
            fetch("/profile/update-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ currentPassword, newPassword }),
                credentials: "same-origin"
            })
            .then(async response => {
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || "Failed to update password");
                }
                return data;
            })
            .then(data => {
                Notify.success("Успех", "Паролата беше сменена успешно!");
                passwordForm.reset();
                // Reset validation states
                passwordValidationState["current-password"] = false;
                passwordValidationState["new-password"] = false;
                passwordValidationState["confirm-password"] = false;
                updateButtonStates();
                
                // Remove validation classes
                currentPasswordInput.classList.remove("valid-field", "invalid-field");
                newPasswordInput.classList.remove("valid-field", "invalid-field");
                confirmPasswordInput.classList.remove("valid-field", "invalid-field");
                
                // Reset requirements visualization
                for (const id of Object.keys(requirements)) {
                    const element = document.getElementById(id);
                    element.classList.remove("valid-requirement");
                }
            })
            .catch(error => {
                console.error("Error:", error);
                Notify.error("Грешка", error.message);
            });
        });
    }
    
    // Danger zone button handlers
    if (logoutAllBtn) {
        logoutAllBtn.addEventListener("click", function() {
            openModal(
                "Излизане от всички устройства", 
                "Сигурни ли сте, че искате да излезете от всички устройства? Ще трябва да влезете отново на всички устройства.",
                "Излез от всички",
                logoutFromAllDevices
            );
        });
    }
    
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener("click", function() {
            openModal(
                "Изтриване на акаунт", 
                "Сигурни ли сте, че искате да изтриете акаунта си? Това действие е необратимо и всички ваши данни ще бъдат загубени.",
                "Изтрий акаунта",
                deleteAccount
            );
        });
    }
    
    // API functions
    function logoutFromAllDevices() {
        fetch("/profile/logout-all", {
            method: "POST",
            credentials: "same-origin"
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to logout from all devices");
            }
            return data;
        })
        .then(data => {
            // Redirect to login page
            window.location.href = "/login";
        })
        .catch(error => {
            console.error("Error:", error);
            Notify.error("Грешка", error.message);
        });
    }
    
    function deleteAccount() {
        fetch("/profile/delete-account", {
            method: "DELETE",
            credentials: "same-origin"
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to delete account");
            }
            return data;
        })
        .then(data => {
            // Redirect to home page
            window.location.href = "/";
        })
        .catch(error => {
            console.error("Error:", error);
            Notify.error("Грешка", error.message);
        });
    }
    
    // Initialize button states on page load
    updateButtonStates();
});
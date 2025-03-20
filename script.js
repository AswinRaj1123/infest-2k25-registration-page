document.addEventListener("DOMContentLoaded", function () {
    const steps = document.querySelectorAll(".step");
    const formSections = document.querySelectorAll(".form-section");
    const nextStepBtn = document.getElementById("next-step-btn");
    const nextToPaymentBtn = document.getElementById("next-to-payment");
    const backToPersonalBtn = document.getElementById("back-to-personal");
    const backToEventsBtn = document.getElementById("back-to-events");
    const submitButton = document.getElementById("submit-registration");
    const successContainer = document.getElementById("success-container");
    const pendingContainer = document.getElementById("pending-container");
    const registrationForm = document.getElementById("registration-form");
    const registrationIDElement = document.getElementById("registration-id");
    const copyIDButton = document.getElementById("copy-id");
    const ticketQRCode = document.getElementById("qrcode");
    const paymentRedirectBtn = document.getElementById("payment-redirect-btn");
    const checkStatusBtn = document.getElementById("check-status-btn");
    let currentStep = 0;
    let currentRegistrationId = null;
    let paymentUrl = null;

    // ✅ Function to update form steps and progress bar
    function updateStep(step) {
        formSections.forEach((section, index) => {
            section.classList.toggle("hidden", index !== step);
        });

        steps.forEach((stepElement, index) => {
            stepElement.classList.toggle("active", index === step);
            stepElement.classList.toggle("completed", index < step);
        });
    }

    // ✅ Event Listener for Next Step Button
    nextStepBtn.addEventListener("click", function (event) {
        event.preventDefault();
        if (currentStep < formSections.length - 1) {
            currentStep++;
            updateStep(currentStep);
        }
    });

    // ✅ Event Listener for Next to Payment Button
    nextToPaymentBtn.addEventListener("click", function (event) {
        event.preventDefault();
        if (currentStep < formSections.length - 1) {
            currentStep++;
            updateStep(currentStep);
        }
    });

    // ✅ Event Listener for Back to Personal Button
    backToPersonalBtn.addEventListener("click", function (event) {
        event.preventDefault();
        if (currentStep > 0) {
            currentStep--;
            updateStep(currentStep);
        }
    });

    // ✅ Event Listener for Back to Events Button
    backToEventsBtn.addEventListener("click", function (event) {
        event.preventDefault();
        if (currentStep > 0) {
            currentStep--;
            updateStep(currentStep);
        }
    });

    // ✅ Form Submission - Sends data to backend and redirects to payment
    submitButton.addEventListener("click", async function (event) {
        event.preventDefault();

        // Get form values
        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const phone = document.getElementById("phone").value;
        const whatsapp = document.getElementById("whatsapp").value;
        const college = document.getElementById("college").value;
        const year = document.getElementById("year").value;
        const department = document.getElementById("department").value;
        const payment_mode = document.querySelector("input[name='payment-mode']:checked").value;

        // Get selected events
        const selectedEvents = [];
        document.querySelectorAll("input[name='selected_events[]']:checked").forEach(event => {
            selectedEvents.push(event.value);
        });

        // Validate form
        if (!name || !email || !phone || !college || !year || !department || selectedEvents.length === 0) {
            alert("Please fill in all required fields and select at least one event.");
            return;
        }

        // Prepare data object
        const userData = {
            name, email, phone, whatsapp, college, year, department,
            events: selectedEvents, payment_mode
        };

        try {
            const response = await fetch("https://infest-2k25-registration-page.onrender.com/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });
            
            const result = await response.json();

            if (response.ok) {
                // Store registration ID and payment URL
                currentRegistrationId = result.registration_id;
                paymentUrl = result.payment_url;
                
                // Hide form & show pending payment container
                registrationForm.classList.add("hidden");
                pendingContainer.classList.remove("hidden");
                
                // Display Registration ID
                if (registrationIDElement) {
                    registrationIDElement.textContent = currentRegistrationId;
                }
                
                // Set up payment redirect button
                if (paymentRedirectBtn) {
                    paymentRedirectBtn.addEventListener("click", function() {
                        window.location.href = paymentUrl;
                    });
                }
                
                // Save registration ID to localStorage for later status checks
                localStorage.setItem("infestRegistrationId", currentRegistrationId);
                
                alert("Registration initiated! Click the button to proceed to payment.");
            } else {
                alert(`Error: ${result.detail || "Could not process registration."}`);
            }
        } catch (error) {
            console.error("Registration Error:", error);
            alert("An error occurred. Please try again.");
        }
    });

    // ✅ Check Registration Status
    function checkRegistrationStatus(registrationId) {
        fetch(`https://infest-2k25-registration-page.onrender.com/registration/${registrationId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Registration not found");
                }
                return response.json();
            })
            .then(data => {
                if (data.payment_status === "completed" && data.ticket_id) {
                    // Payment completed, show success screen
                    pendingContainer.classList.add("hidden");
                    successContainer.classList.remove("hidden");
                    
                    // Display Ticket ID
                    document.getElementById("ticket-id").textContent = data.ticket_id;
                    
                    // Generate QR Code
                    if (ticketQRCode) {
                        ticketQRCode.innerHTML = ''; // Clear previous QR code
                        new QRCode(ticketQRCode, {
                            text: data.ticket_id,
                            width: 160,
                            height: 160
                        });
                    }
                    
                    // Show success message
                    alert("Registration and payment completed! Check your email for details.");
                } else {
                    // Still pending
                    alert(`Payment status: ${data.payment_status}. Please complete payment to receive your ticket.`);
                }
            })
            .catch(error => {
                console.error("Status check error:", error);
                alert("Could not verify registration status. Please try again later.");
            });
    }

    // ✅ Check Status Button
    if (checkStatusBtn) {
        checkStatusBtn.addEventListener("click", function() {
            const savedRegistrationId = localStorage.getItem("infestRegistrationId") || currentRegistrationId;
            
            if (savedRegistrationId) {
                checkRegistrationStatus(savedRegistrationId);
            } else {
                const manualId = prompt("Please enter your registration ID:");
                if (manualId) {
                    checkRegistrationStatus(manualId);
                }
            }
        });
    }

    // ✅ Copy Registration ID to Clipboard
    if (copyIDButton) {
        copyIDButton.addEventListener("click", function () {
            navigator.clipboard.writeText(registrationIDElement.textContent)
                .then(() => alert("Registration ID copied!"))
                .catch(err => console.error("Failed to copy ID:", err));
        });
    }

    // ✅ Limit Event Selection to 3
    document.querySelectorAll("input[name='selected_events[]']").forEach(checkbox => {
        checkbox.addEventListener("change", function () {
            const checkedBoxes = document.querySelectorAll("input[name='selected_events[]']:checked");
            if (checkedBoxes.length > 3) {
                this.checked = false;
                alert("You can only select up to 3 events.");
            }
        });
    });

    // ✅ Check if returning from payment page
    window.addEventListener("load", function() {
        const urlParams = new URLSearchParams(window.location.search);
        const registrationId = urlParams.get("registration_id");
        const paymentStatus = urlParams.get("payment_status");
        
        if (registrationId) {
            // Show the pending container
            registrationForm.classList.add("hidden");
            pendingContainer.classList.remove("hidden");
            currentRegistrationId = registrationId;
            
            if (registrationIDElement) {
                registrationIDElement.textContent = registrationId;
            }
            
            // If payment status is included in URL, show appropriate message
            if (paymentStatus === "success") {
                checkRegistrationStatus(registrationId);
            }
        }
        
        // Check if there's a saved registration in progress
        const savedRegistrationId = localStorage.getItem("infestRegistrationId");
        if (savedRegistrationId && !registrationId) {
            const resumeRegistration = confirm("You have a registration in progress. Would you like to check its status?");
            if (resumeRegistration) {
                registrationForm.classList.add("hidden");
                pendingContainer.classList.remove("hidden");
                currentRegistrationId = savedRegistrationId;
                
                if (registrationIDElement) {
                    registrationIDElement.textContent = savedRegistrationId;
                }
                
                checkRegistrationStatus(savedRegistrationId);
            } else {
                // Clear saved registration if user doesn't want to resume
                localStorage.removeItem("infestRegistrationId");
            }
        }
    });

    // ✅ Initialize Step 1
    updateStep(currentStep);
});
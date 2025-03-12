document.addEventListener("DOMContentLoaded", function () {
    const steps = document.querySelectorAll(".step");
    const formSections = document.querySelectorAll(".form-section");
    const nextButtons = document.querySelectorAll(".primary-btn"); // For next step navigation
    const prevButtons = document.querySelectorAll(".secondary-btn"); // For previous step navigation
    const submitButton = document.getElementById("submit-registration");
    const successContainer = document.getElementById("success-container");
    const registrationForm = document.getElementById("registration-form");
    const registrationIDElement = document.getElementById("registration-id");
    const copyIDButton = document.getElementById("copy-id");
    const ticketQRCode = document.getElementById("qrcode");
    let currentStep = 0;

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

    // ✅ Event Listener for Next Buttons
    nextButtons.forEach(button => {
        button.addEventListener("click", function (event) {
            event.preventDefault();
            if (currentStep < formSections.length - 1) {
                currentStep++;
                updateStep(currentStep);
            }
        });
    });

    // ✅ Event Listener for Previous Buttons
    prevButtons.forEach(button => {
        button.addEventListener("click", function (event) {
            event.preventDefault();
            if (currentStep > 0) {
                currentStep--;
                updateStep(currentStep);
            }
        });
    });

    // ✅ Form Submission - Sends data to backend (MongoDB)
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

        // Prepare data object
        const userData = {
            name, email, phone, whatsapp, college, year, department,
            events: selectedEvents, payment_mode
        };

        try {
            const response = await fetch("http://localhost:8000/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (result.status === "success") {
                // Hide form & show confirmation
                registrationForm.classList.add("hidden");
                successContainer.classList.remove("hidden");

                // Display Ticket ID
                registrationIDElement.textContent = result.ticket_id;

                // Generate QR Code
                new QRCode(ticketQRCode, {
                    text: result.ticket_id,
                    width: 160,
                    height: 160
                });

                alert("Registration Successful! Check your email.");
            } else {
                alert("Error: Could not process registration.");
            }
        } catch (error) {
            console.error("Registration Error:", error);
            alert("An error occurred. Please try again.");
        }
    });

    // ✅ Copy Registration ID to Clipboard
    copyIDButton.addEventListener("click", function () {
        navigator.clipboard.writeText(registrationIDElement.textContent)
            .then(() => alert("Registration ID copied!"))
            .catch(err => console.error("Failed to copy ID:", err));
    });

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

    // ✅ Initialize Step 1
    updateStep(currentStep);
});
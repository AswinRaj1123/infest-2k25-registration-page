document.addEventListener("DOMContentLoaded", function () {
    const steps = document.querySelectorAll(".step");
    const formSections = document.querySelectorAll(".form-section");
    const nextStepBtn = document.getElementById("next-step-btn");
    const nextToPaymentBtn = document.getElementById("next-to-payment");
    const backToPersonalBtn = document.getElementById("back-to-personal");
    const backToEventsBtn = document.getElementById("back-to-events");
    const submitButton = document.getElementById("submit-registration");
    const successContainer = document.getElementById("success-container");
    const registrationForm = document.getElementById("registration-form");
    const registrationIDElement = document.getElementById("registration-id");
    const copyIDButton = document.getElementById("copy-id");
    const ticketQRCode = document.getElementById("qrcode");
    const offlineMessage = document.getElementById("offline-message");
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
        window.scrollTo(0, 0);
        // Scroll to top of the form
    
        // Then, if needed, scroll to the specific section
        if (formSections[step]) {
            // You can adjust this timeout if needed
            setTimeout(() => {
                // Force scroll to top of the window
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }, 10);
        }
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
    document.getElementById("submit-registration").addEventListener('click', function(event) {
        const button = event.target;

        // Disable the button
        button.disabled = true;

        // Change button text to indicate waiting
        button.textContent = "Please wait...";
        
    });

    // ✅ Function to handle Razorpay payment
    function handleRazorpayPayment(userData) {
        const options = {
            key: "rzp_test_0DbywO9fUpbt3w", // Replace with your Razorpay key
            amount: 25000, // Amount in paise (e.g., 50000 = ₹500)
            currency: "INR",
            name: "INFEST 2K25",
            description: "Event Registration Fee",
            image: "infest-2k25 logo.png", // Replace with your logo URL
            order_id: "order_9A33XWu170gUtm", // Replace with your order ID (generated from your backend)
            handler: function (response) {
                alert("Payment successful! Payment ID: " + response.razorpay_payment_id);
                // You can send the payment ID to your backend for verification
            },
            prefill: {
                name: userData.name,
                email: userData.email,
                contact: userData.phone,
            },
            theme: {
                color: "#3399cc",
            },
        };

        const rzp = new Razorpay(options);
        rzp.open();
    }

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
            const response = await fetch("https://infest-2k25-registration-page.onrender.com/register", {
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

                // Handle payment mode
                if (payment_mode === "offline") {
                    // Show offline payment message
                    offlineMessage.classList.remove("hidden");
                } else if (payment_mode === "online") {
                    // Initiate Razorpay payment
                    handleRazorpayPayment(userData);
                }

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
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
    const ticketPaymentStatus = document.getElementById("ticket-payment-status");
    let currentStep = 0;
    let paymentId = null;
    let orderId = null;
    let registrationData = null;

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


    // Function to complete registration after payment
    async function completeRegistration(userData, paymentId = null) {
        // Add payment ID if payment was made
        if (paymentId) {
            userData.payment_id = paymentId;
            userData.payment_status = "paid";
        } else {
            userData.payment_status = "pending";
        }
    
        try {
            const response = await fetch("https://infest-2k25-registration-page.onrender.com/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });
            
            const result = await response.json();
    
            if (result.status === "success") {
                showTicket(result.ticket_id, userData, userData.payment_status);
                alert("Registration Successful! Check your email.");
            } else {
                alert(`Error: ${result.detail || 'Could not process registration.'}`);
            }
        } catch (error) {
            console.error("Registration Error:", error);
            alert("An error occurred. Please try again.");
        }
    }
    // Add a function to check for payment redirect and handle it
function checkPaymentRedirect() {
    // Check URL parameters for payment_id
    const urlParams = new URLSearchParams(window.location.search);
    const paymentId = urlParams.get('payment_id');
    
    if (paymentId) {
        // Clear the URL parameters without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Get registration data from sessionStorage if available
        const storedData = sessionStorage.getItem("registrationData");
        
        if (storedData) {
            registrationData = JSON.parse(storedData);
            verifyPaymentAndRedirect(paymentId);
        } else {
            alert("Session expired. Please fill the form again.");
        }
    }
    
    // Check if we have a stored ticket to display (for page refreshes)
    const storedTicketId = sessionStorage.getItem("ticketId");
    if (storedTicketId && !paymentId) {
        const storedData = sessionStorage.getItem("registrationData");
        const paymentStatus = sessionStorage.getItem("paymentStatus");
        
        if (storedData) {
            showTicket(storedTicketId, JSON.parse(storedData), paymentStatus);
        }
    }
}

// Modify the submit button handler for online payments
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
    const paymentMode = document.querySelector("input[name='payment-mode']:checked").value;
    const projectLink = document.getElementById("project-link").value;

    // Get selected events
    const events = [];
    document.querySelectorAll("input[name='selected_events[]']:checked").forEach(event => {
        events.push(event.value);
    });

    // Prepare data object
    const userData = {
        name, email, phone, whatsapp, college, year, department,
        events, payment_mode: paymentMode, project_link: projectLink
    };
    
    // Store registration data globally and in sessionStorage
    registrationData = userData;
    sessionStorage.setItem("registrationData", JSON.stringify(userData));

    // Handle different payment methods
    if (paymentMode === "online") {
        // Store that we're expecting a payment
        sessionStorage.setItem("awaitingPayment", "true");
        
        // Redirect to Razorpay payment page with return URL
        const returnUrl = encodeURIComponent(window.location.href);
        window.location.href = `https://rzp.io/rzp/qE5ylHJ?return_url=${returnUrl}`;
    } else {
        // If offline payment, complete registration without payment
        completeRegistration(userData);
    }
});

// Call this function on page load to check for payment redirects
document.addEventListener("DOMContentLoaded", function() {
    // ... your existing code ...
    
    // Add this at the end of your DOMContentLoaded handler
    checkPaymentRedirect();
});
    // Add this new function to handle payment verification and redirect
async function verifyPaymentAndRedirect(paymentId) {
    try {
        // Get the stored registration data from earlier
        if (!registrationData) {
            alert("Registration data not found. Please try again.");
            return;
        }
        
        // Add payment ID to the registration data
        registrationData.payment_id = paymentId;
        
        // Complete the registration with the payment ID
        const response = await fetch("https://infest-2k25-registration-page.onrender.com/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(registrationData)
        });
        
        const result = await response.json();
        
        if (result.status === "success") {
            // Store ticket info in sessionStorage to retrieve after redirect
            sessionStorage.setItem("ticketId", result.ticket_id);
            sessionStorage.setItem("paymentStatus", "paid");
            sessionStorage.setItem("registrationData", JSON.stringify(registrationData));
            
            // Redirect to ticket page or show the ticket section
            showTicket(result.ticket_id, registrationData, "paid");
        } else {
            alert(`Error: ${result.detail || 'Could not process registration.'}`);
        }
    } catch (error) {
        console.error("Payment Verification Error:", error);
        alert("An error occurred. Please try again.");
    }
}

// Function to show the ticket
function showTicket(ticketId, userData, paymentStatus) {
    // Hide form & show confirmation
    registrationForm.classList.add("hidden");
    successContainer.classList.remove("hidden");

    // Display Ticket ID
    registrationIDElement.textContent = ticketId;

    // Generate QR Code
    new QRCode(ticketQRCode, {
        text: ticketId,
        width: 160,
        height: 160
    });

    // Update payment status display
    if (paymentStatus === "paid") {
        ticketPaymentStatus.className = "ticket-status paid";
        ticketPaymentStatus.innerHTML = '<span class="status-icon"></span><span class="status-text">Payment Completed</span>';
        
        // Hide offline payment message if already paid
        const offlineMessage = document.getElementById("offline-message");
        if (offlineMessage) {
            offlineMessage.classList.add("hidden");
        }
    }

    // Update ticket info
    document.getElementById("ticket-name").textContent = userData.name;
    document.getElementById("ticket-email").textContent = userData.email;
    document.getElementById("ticket-events").textContent = userData.events.join(", ");
    
    // Get department full name
    const deptSelect = document.getElementById("department");
    const selectedOption = deptSelect.options[deptSelect.selectedIndex];
    document.getElementById("ticket-department").textContent = selectedOption.textContent;
}


    // ✅ Form Submission
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
        const paymentMode = document.querySelector("input[name='payment-mode']:checked").value;
        const projectLink = document.getElementById("project-link").value;

        // Get selected events
        const events = [];
        document.querySelectorAll("input[name='selected_events[]']:checked").forEach(event => {
            events.push(event.value);
        });

        // Prepare data object
        const userData = {
            name, email, phone, whatsapp, college, year, department,
            events, payment_mode: paymentMode, project_link: projectLink
        };
        
        // Store registration data globally
        registrationData = userData;

        // Handle different payment methods
        if (paymentMode === "online") {
            // Create order ID first
            
            window.location.href = "https://rzp.io/rzp/qE5ylHJ";
         
            // if (orderId) {
            //     // Add Razorpay script dynamically if not already loaded
            //     if (!window.Razorpay) {
            //         const script = document.createElement("script");
            //         script.src = "https://checkout.razorpay.com/v1/checkout.js";
            //         script.onload = function() {
            //             initializeRazorpay(userData, orderId);
            //         };
            //         document.body.appendChild(script);
            //     } else {
            //         initializeRazorpay(userData, orderId);
            //     }
            // }
        } else {
            // If offline payment, complete registration without payment
            completeRegistration(userData);
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
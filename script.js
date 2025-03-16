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

    // Function to initialize Razorpay payment
    function initializeRazorpay(userData, orderId) {
        const options = {
            key: "rzp_test_0DbywO9fUpbt3w", // Replace with your Razorpay key
            amount: 25000, // Amount in paise (250 INR)
            currency: "INR",
            name: "INFEST 2K25",
            description: "Registration Fee",
            image: "infest-2k25 logo.png",
            order_id: orderId,
            handler: function (response) {
                // Payment successful
                paymentId = response.razorpay_payment_id;
                completeRegistration(userData, paymentId);
            },
            prefill: {
                name: userData.name,
                email: userData.email,
                contact: userData.phone
            },
            notes: {
                address: "INFO Institute of Engineering, Coimbatore"
            },
            theme: {
                color: "#3399cc"
            },
            modal: {
                ondismiss: function() {
                    alert("Payment cancelled. Your registration is not complete.");
                }
            }
        };
        
        const rzp = new Razorpay(options);
        rzp.open();
    }

    // Function to create an order on server
    async function createOrder(userData) {
        try {
            const response = await fetch("https://infest-2k25-registration-page.onrender.com/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: 250 })
            });
            
            const result = await response.json();
            if (result.status === "success") {
                return result.order_id;
            } else {
                throw new Error(result.detail || "Could not create order");
            }
        } catch (error) {
            console.error("Order Creation Error:", error);
            alert("Error creating payment order. Please try again.");
            return null;
        }
    }

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

                // Update payment status display
                if (userData.payment_status === "paid") {
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

                alert("Registration Successful! Check your email.");
            } else {
                alert(`Error: ${result.detail || 'Could not process registration.'}`);
            }
        } catch (error) {
            console.error("Registration Error:", error);
            alert("An error occurred. Please try again.");
        }
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
            // Step 1: Register the user
            const registrationResponse = await fetch("https://infest-2k25-registration-page.onrender.com/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });
    
            const registrationResult = await registrationResponse.json();
    
            if (registrationResult.status === "success") {
                // Step 2: Create Razorpay order
                const paymentResponse = await fetch("https://infest-2k25-registration-page.onrender.com/create-payment-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ amount: 100, currency: "INR" })  // Amount in INR
                });
    
                const paymentResult = await paymentResponse.json();
    
                if (paymentResult.status === "success") {
                    // Step 3: Open Razorpay payment modal
                    const options = {
                        key: "rzp_test_0DbywO9fUpbt3w",  // Replace with your Razorpay key ID
                        amount: 250 * 100,  // Amount in paise
                        currency: "INR",
                        order_id: paymentResult.order_id,
                        name: "INFEST 2K25 Registration",
                        description: "Payment for INFEST 2K25 registration",
                        handler: function (response) {
                            alert("Payment successful! Payment ID: " + response.razorpay_payment_id);
                            // Hide form & show confirmation
                            registrationForm.classList.add("hidden");
                            successContainer.classList.remove("hidden");
    
                            // Display Ticket ID
                            registrationIDElement.textContent = registrationResult.ticket_id;
    
                            // Generate QR Code
                            new QRCode(ticketQRCode, {
                                text: registrationResult.ticket_id,
                                width: 160,
                                height: 160
                            });
                        },
                        prefill: {
                            name: name,
                            email: email,
                            contact: phone
                        },
                        theme: {
                            color: "#3399cc"
                        }
                    };
    
                    const rzp = new Razorpay(options);
                    rzp.open();
                } else {
                    alert("Error creating payment order. Please try again.");
                }
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
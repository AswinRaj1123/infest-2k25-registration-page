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
    const categoryBtns = document.querySelectorAll(".category-btn");
    const eventCards = document.querySelectorAll(".event-card");
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

    // ✅ Validate form fields for personal info section
    function validatePersonalInfo() {
        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const whatsapp = document.getElementById("whatsapp").value.trim();
        const college = document.getElementById("college").value.trim();
        const year = document.getElementById("year").value;
        const department = document.getElementById("department").value;

        if (!name) {
            alert("Please enter your full name.");
            return false;
        }
        if (!email || !validateEmail(email)) {
            alert("Please enter a valid email address.");
            return false;
        }
        if (!phone || !validatePhone(phone)) {
            alert("Please enter a valid phone number.");
            return false;
        }
        if (!whatsapp || !validatePhone(whatsapp)) {
            alert("Please enter a valid WhatsApp number.");
            return false;
        }
        if (!college) {
            alert("Please enter your college name.");
            return false;
        }
        if (!year) {
            alert("Please select your year of study.");
            return false;
        }
        if (!department) {
            alert("Please select your department.");
            return false;
        }
        return true;
    }

    // ✅ Validate email format
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // ✅ Validate phone number format
    function validatePhone(phone) {
        const re = /^\d{10}$/;
        return re.test(phone);
    }

    // ✅ Validate event selection
    function validateEventSelection() {
        const selectedEvents = document.querySelectorAll("input[name='selected_events[]']:checked");
        if (selectedEvents.length === 0) {
            alert("Please select at least two event.");
            return false;
        }
        return true;
    }

    // ✅ Validate payment section
    function validatePayment() {
        const paymentMethod = document.querySelector("input[name='payment-mode']:checked");
        if (!paymentMethod) {
            alert("Please select a payment method.");
            return false;
        }
        return true;
    }

    // ✅ Event Listener for Next Step Button
    nextStepBtn.addEventListener("click", function (event) {
        event.preventDefault();
        if (validatePersonalInfo()) {
            if (currentStep < formSections.length - 1) {
                currentStep++;
                updateStep(currentStep);
            }
        }
    });

    // ✅ Event Listener for Next to Payment Button
    nextToPaymentBtn.addEventListener("click", function (event) {
        event.preventDefault();
        if (validateEventSelection()) {
            if (currentStep < formSections.length - 1) {
                currentStep++;
                updateStep(currentStep);
            }
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

    // ✅ Event category filtering
    categoryBtns.forEach(btn => {
        btn.addEventListener("click", function() {
            // Remove active class from all buttons
            categoryBtns.forEach(button => button.classList.remove("active"));
            
            // Add active class to clicked button
            this.classList.add("active");
            
            // Get selected category
            const selectedCategory = this.getAttribute("data-category");
            
            // Show/hide event cards based on category
            eventCards.forEach(card => {
                if (selectedCategory === "all" || card.getAttribute("data-category") === selectedCategory) {
                    card.style.display = "flex";
                } else {
                    card.style.display = "none";
                }
            });
        });
    });

    // ✅ Form Submission - Sends data to backend (MongoDB)
    submitButton.addEventListener("click", async function (event) {
        event.preventDefault();

        if (!validatePayment()) {
            return;
        }

        // Get form values
        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const phone = document.getElementById("phone").value;
        const whatsapp = document.getElementById("whatsapp").value;
        const college = document.getElementById("college").value;
        const year = document.getElementById("year").value;
        const department = document.getElementById("department").value;
        const projectLink = document.getElementById("project-link").value;
        const payment_mode = document.querySelector("input[name='payment-mode']:checked").value;

        // Get selected events
        const selectedEvents = [];
        document.querySelectorAll("input[name='selected_events[]']:checked").forEach(event => {
            selectedEvents.push(event.value);
        });

        // Prepare data object
        const userData = {
            name, 
            email, 
            phone, 
            whatsapp, 
            college, 
            year, 
            department,
            project_link: projectLink,
            events: selectedEvents, 
            payment_mode
        };

        try {
            // For offline payment
            const response = await fetch("/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });
            
            const result = await response.json();
            
            if (result.status === "success") {
                // Hide form & show confirmation
                registrationForm.classList.add("hidden");
                successContainer.classList.remove("hidden");
                
                // Make offline payment message visible
                document.getElementById("offline-message").style.display = "block";
                
                // Display Ticket info
                displayTicketInfo(result.ticket_id, name, email, selectedEvents, department);
                
                alert("Registration Successful! Check your email.");
            } else {
                alert("Error: Could not process registration.");
            }
        } catch (error) {
            console.error("Registration Error:", error);
            alert("An error occurred. Please try again.");
        }
    });

    // ✅ Display ticket information
    function displayTicketInfo(ticketId, name, email, events, department) {
        // Display Ticket ID
        registrationIDElement.textContent = ticketId;
        
        // Update ticket details
        document.getElementById("ticket-name").textContent = name;
        document.getElementById("ticket-email").textContent = email;
        document.getElementById("ticket-events").textContent = events.join(", ");
        document.getElementById("ticket-department").textContent = document.getElementById("department").options[document.getElementById("department").selectedIndex].text;
        
        // Generate QR Code
        new QRCode(ticketQRCode, {
            text: ticketId,
            width: 160,
            height: 160
        });
    }

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

    // ✅ Download ticket functionality
    document.getElementById("download-ticket").addEventListener("click", function() {
        alert("Ticket download feature will be available soon!");
    });

    // ✅ Share ticket functionality
    document.getElementById("share-ticket").addEventListener("click", function() {
        if (navigator.share) {
            navigator.share({
                title: 'My INFEST 2K25 Ticket',
                text: `I've registered for INFEST 2K25! My ticket ID is ${registrationIDElement.textContent}`,
                url: window.location.href,
            })
            .catch((error) => console.log('Error sharing', error));
        } else {
            alert("Sharing is not supported on this browser");
        }
    });

    // ✅ Initialize Step 1
    updateStep(currentStep);
});
document.addEventListener("DOMContentLoaded", function () {
    const submitButton = document.getElementById("submit-registration");
    const successContainer = document.getElementById("success-container");
    const registrationForm = document.getElementById("registration-form");
    const registrationIDElement = document.getElementById("registration-id");
    const ticketQRCode = document.getElementById("qrcode");
    const offlineMessage = document.getElementById("offline-message");

    async function handleRazorpayPayment(userData, ticket_id) {
        try {
            const orderResponse = await fetch("https://infest-2k25-registration-page.onrender.com/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: 25000 }) // ₹500 in paise
            });

            const orderData = await orderResponse.json();
            if (!orderData.order_id) {
                alert("Error creating order. Try again.");
                return;
            }

            const options = {
                key: "rzp_test_0DbywO9fUpbt3w",  // ✅ Replace with your actual Razorpay key
                amount: 25000,
                currency: "INR",
                name: "INFEST 2K25",
                description: "Event Registration Fee",
                order_id: orderData.order_id,
                handler: async function (response) {
                    alert("Payment successful! Payment ID: " + response.razorpay_payment_id);

                    // ✅ Confirm payment with backend
                    const confirmResponse = await fetch("https://infest-2k25-registration-page.onrender.com/confirm-payment", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            ticket_id: ticket_id,
                            payment_id: response.razorpay_payment_id,
                            payment_status: "success"
                        })
                    });

                    const confirmResult = await confirmResponse.json();
                    if (confirmResult.status === "success") {
                        alert("Payment confirmed! Fetching your ticket details...");
                        fetchParticipantDetails(ticket_id);
                    } else {
                        alert("Payment confirmation failed. Contact support.");
                    }
                },
                prefill: {
                    name: userData.name,
                    email: userData.email,
                    contact: userData.phone,
                },
                theme: { color: "#3399cc" },
            };

            const rzp = new Razorpay(options);
            rzp.open();
        } catch (error) {
            console.error("Error in payment:", error);
            alert("Payment failed. Try again.");
        }
    }

    submitButton.addEventListener("click", async function (event) {
        event.preventDefault();
        submitButton.textContent = "Please Wait...";
        submitButton.disabled = true;

        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const phone = document.getElementById("phone").value;
        const whatsapp = document.getElementById("whatsapp").value;
        const college = document.getElementById("college").value;
        const year = document.getElementById("year").value;
        const department = document.getElementById("department").value;
        const payment_mode = document.querySelector("input[name='payment-mode']:checked").value;

        const selectedEvents = [];
        document.querySelectorAll("input[name='selected_events[]']:checked").forEach(event => {
            selectedEvents.push(event.value);
        });

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
                const ticket_id = result.ticket_id;

                if (payment_mode === "offline") {
                    registrationForm.classList.add("hidden");
                    successContainer.classList.remove("hidden");
                    registrationIDElement.textContent = ticket_id;

                    new QRCode(ticketQRCode, {
                        text: ticket_id,
                        width: 160,
                        height: 160
                    });

                    offlineMessage.classList.remove("hidden");
                    alert("Registration Successful! Please pay at the venue.");
                } else if (payment_mode === "online") {
                    handleRazorpayPayment(userData, ticket_id);
                }
            } else {
                alert("Error: Could not process registration.");
            }
        } catch (error) {
            console.error("Registration Error:", error);
            alert("An error occurred. Please try again.");
        } finally {
            submitButton.textContent = "Complete Registration";
            submitButton.disabled = false;
        }
    });

    async function fetchParticipantDetails(ticket_id) {
        try {
            const response = await fetch(`https://infest-2k25-registration-page.onrender.com/participant/${ticket_id}`);
            const data = await response.json();

            if (data.status === "success") {
                const participant = data.participant;
                registrationIDElement.textContent = participant.ticket_id;

                if (participant.payment_status === "paid") {
                    offlineMessage.classList.add("hidden");
                    document.getElementById("payment-status").innerHTML = 
                        '<span class="status-paid"><i class="fas fa-check-circle"></i> Paid</span>';
                } else {
                    document.getElementById("payment-status").innerHTML = 
                        '<span class="status-pending"><i class="fas fa-clock"></i> Payment Pending</span>';
                }

                registrationForm.classList.add("hidden");
                successContainer.classList.remove("hidden");

                new QRCode(ticketQRCode, {
                    text: participant.ticket_id,
                    width: 160,
                    height: 160
                });
            } else {
                alert("Error fetching participant details. Please contact support.");
            }
        } catch (error) {
            console.error("Error fetching participant:", error);
            alert("An error occurred while fetching participant details.");
        }
    }
});
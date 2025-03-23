document.addEventListener("DOMContentLoaded", async function () {
    const ticketId = new URLSearchParams(window.location.search).get("ticketId");

    if (!ticketId) {
        console.error("No ticket ID found in URL");
        return;
    }

    try {
        // 🔹 Call Webhook API (POST) - No output display
        await fetch("/api/webhook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Webhook triggered", ticketId: ticketId }),
        });

        // 🔹 Call Register API (POST) - Show Output
        const response = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticketId: ticketId }),
        });

        const data = await response.json();

        // 🔹 Display Register API Response on UI
        const ticketDetails = document.getElementById("ticket-details");
        ticketDetails.innerHTML = `
            <p><strong>Ticket ID:</strong> ${data.ticket_id}</p>
            <p><strong>Name:</strong> ${data.name}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Events:</strong> ${data.events.join(", ")}</p>
            <p><strong>Payment Status:</strong> ${data.payment_status}</p>
            <img src="${data.qr_code}" alt="QR Code">
        `;

    } catch (error) {
        console.error("Error processing requests:", error);
    }
});

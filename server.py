from fastapi import FastAPI, HTTPException, Form
from pydantic import BaseModel
import qrcode
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from pymongo import MongoClient
import random
import os
import razorpay
from fastapi import FastAPI
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from fastapi import Request
import logging

load_dotenv()
import uvicorn
os.makedirs("qrcodes", exist_ok=True)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (Change to specific origins for security)
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# MongoDB Connection
MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["infest_db"]
collection = db["registrations"]

# Email Configuration
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")

# Initialize Razorpay client - Replace with your actual keys
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# Pydantic Model for Validation
class RegistrationData(BaseModel):
    name: str
    email: str
    phone: str
    whatsapp: str
    college: str
    year: str
    department: str
    events: list
    payment_mode: str
    project_link: str = None
    payment_id: str = None
    payment_status: str = "pending"

class OrderRequest(BaseModel):
    amount: int

class PaymentVerification(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    registration_data: dict

# Function to Generate Ticket ID
def generate_ticket_id():
    return f"INF25-{random.randint(1000, 9999)}"

# Function to Generate QR Code
def generate_qr(ticket_id):
    qr = qrcode.make(ticket_id)
    qr_path = f"qrcodes/{ticket_id}.png"
    os.makedirs(os.path.dirname(qr_path), exist_ok=True)
    qr.save(qr_path)
    return qr_path

# Function to Send Confirmation Email
def send_email(user_email, ticket_id, qr_path, user_data):
    msg = MIMEMultipart()
    msg["From"] = EMAIL_USER
    msg["To"] = user_email
    msg["Subject"] = "INFEST 2K25 - Registration Confirmation"

    # Determine payment status
    payment_status = "Paid" if user_data.get('payment_status') == "paid" else "Payment Pending"
    payment_info = "Payment completed successfully" if payment_status == "Paid" else "Please complete your payment at the venue"

    body = f"""
    <h2>Thank you for registering for INFEST 2K25!</h2>
    <p>Your ticket ID: <b>{ticket_id}</b></p>
    <p>Full Name: {user_data['name']}</p>
    <p>Email: {user_data['email']}</p>
    <p>Phone: {user_data['phone']}</p>
    <p>WhatsApp: {user_data['whatsapp']}</p>
    <p>College: {user_data['college']}</p>
    <p>Year: {user_data['year']}</p>
    <p>Department: {user_data['department']}</p>
    <p>Events: {', '.join(user_data['events'])}</p>
    <p>Payment Mode: {user_data['payment_mode']}</p>
    <p>Show the attached QR code at the event check-in.</p>
    """
    msg.attach(MIMEText(body, "html"))

    with open(qr_path, "rb") as f:
        img = MIMEImage(f.read(), name=f"{ticket_id}.png")
        msg.attach(img)

    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(EMAIL_USER, EMAIL_PASS)
        server.sendmail(EMAIL_USER, user_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print("Email Error:", e)
        return False

@app.post("/create-payment-order")
async def create_payment_order(request: Request):
    data = await request.json()
    amount = data.get("amount")  # Amount in INR (e.g., 100 for ₹100)
    currency = data.get("currency", "INR")

    try:
        # Convert amount to the smallest currency unit (e.g., paise for INR)
        amount_in_paise = amount * 100

        # Create Razorpay order
        order = razorpay_client.order.create({
            "amount": amount_in_paise,
            "currency": currency,
            "payment_capture": 1  # Auto-capture payment
        })

        return {"status": "success", "order_id": order["id"]}
    except Exception as e:
        print("Error creating Razorpay order:", e)
        raise HTTPException(status_code=500, detail="Error creating payment order. Please try again.")

# API to Verify Payment
@app.post("/verify-payment")
async def verify_payment(payment_data: PaymentVerification):
    try:
        # Build the parameters dict to verify signature
        params_dict = {
            'razorpay_order_id': payment_data.razorpay_order_id,
            'razorpay_payment_id': payment_data.razorpay_payment_id,
            'razorpay_signature': payment_data.razorpay_signature
        }

        # Verify signature
        razorpay_client.utility.verify_payment_signature(params_dict)

        # If verification successful, update registration data and save
        registration_data = payment_data.registration_data
        registration_data['payment_id'] = payment_data.razorpay_payment_id
        registration_data['payment_status'] = "paid"
        registration_data['payment_time'] = datetime.now().isoformat()
        registration_data['payment_order_id'] = payment_data.razorpay_order_id

        # Generate ticket ID
        ticket_id = generate_ticket_id()
        registration_data['ticket_id'] = ticket_id

        # Save registration data
        collection.insert_one(registration_data)

        # Generate QR Code
        qr_path = generate_qr(ticket_id)

        # Send email notification
        email_sent = send_email(registration_data['email'], ticket_id, qr_path, registration_data)

        return {
            "status": "success",
            "ticket_id": ticket_id,
            "payment_status": "paid",
            "email_sent": email_sent
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Payment verification failed: {str(e)}")

# API to Handle Registration (for both online and offline payments)
@app.post("/register")
async def register_user(data: RegistrationData):
    # Check if the user is already registered
    existing_registration = collection.find_one({"email": data.email})
    
    if existing_registration:
        return {
            "status": "success",
            "ticket_id": existing_registration["ticket_id"],
            "qr_code": existing_registration["qr_code"],
            "email_sent": False  # No need to send email again
        }
    
    # Generate new ticket ID and QR code
    ticket_id = generate_ticket_id()
    qr_path = generate_qr(ticket_id)

    user_data = data.dict()
    user_data["ticket_id"] = ticket_id
    user_data["qr_code"] = qr_path  # Store QR code path in the database

    try:
        collection.insert_one(user_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

    email_sent = send_email(data.email, ticket_id, qr_path, user_data)

    return {"status": "success", "ticket_id": ticket_id, "qr_code": qr_path, "email_sent": email_sent}

# API endpoint to check payment status (useful for verifying after redirect)
@app.get("/payment-status/{ticket_id}")
async def check_payment_status(ticket_id: str):
    try:
        registration = collection.find_one({"ticket_id": ticket_id})
        if not registration:
            raise HTTPException(status_code=404, detail="Registration not found")

        return {
            "status": "success",
            "ticket_id": ticket_id,
            "payment_status": registration.get("payment_status", "pending")
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error checking payment status: {str(e)}")

# Webhook for Razorpay (for automatic payment verification)
@app.post("/razorpay-webhook")
async def razorpay_webhook(webhook_data: dict):
    try:
        # Verify webhook signature if Razorpay provides one
        # Process payment notification
        if webhook_data.get("event") == "payment.authorized":
            payment_id = webhook_data.get("payload", {}).get("payment", {}).get("entity", {}).get("id")
            order_id = webhook_data.get("payload", {}).get("payment", {}).get("entity", {}).get("order_id")

            if payment_id and order_id:
                # Update registration record with payment info
                collection.update_one(
                    {"payment_order_id": order_id},
                    {"$set": {
                        "payment_id": payment_id,
                        "payment_status": "paid",
                        "payment_webhook_time": datetime.now().isoformat()
                    }}
                )

        return {"status": "success"}
    except Exception as e:
        print(f"Webhook Error: {e}")
        # We return 200 even for errors to acknowledge receipt
        return {"status": "error", "detail": str(e)}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
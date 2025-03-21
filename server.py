from fastapi import FastAPI, HTTPException, Form, Request, Depends, Response
from pydantic import BaseModel
import qrcode
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from pymongo import MongoClient
import random
import os
import json
import hmac
import hashlib
import requests
from typing import Dict, Any, Optional
import time

os.makedirs("qrcodes", exist_ok=True)

app = FastAPI()

# MongoDB Connection
MONGO_URI = "mongodb+srv://infest2k25:infest2k25test@infest-2k25.3mv5l.mongodb.net/?retryWrites=true&w=majority&appName=INFEST-2K25"
client = MongoClient(MONGO_URI)
db = client["infest_db"]
collection = db["registrations"]
payment_collection = db["payments"]

# Email Configuration
EMAIL_USER = "infest2k25@gmail.com"
EMAIL_PASS = "rmac uddi oxbj qaxa"

# Razorpay Configuration
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "info.admin-devops@123")
RAZORPAY_PAYMENT_PAGE_ID = os.environ.get("RAZORPAY_PAYMENT_PAGE_ID", "pl_Q6wwHXE18zDd4E")

# Base URL for Razorpay Payment Page
RAZORPAY_PAYMENT_URL = f"https://rzp.io/rzp/qE5ylHJ"

# Pydantic Models for Validation
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

class PaymentResponse(BaseModel):
    payment_url: str
    registration_id: str

class PendingRegistration(BaseModel):
    user_data: Dict[str, Any]
    timestamp: float
    payment_reference: Optional[str] = None

# Function to Generate Ticket ID
def generate_ticket_id():
    return f"INF25-{random.randint(1000, 9999)}"

# Function to Generate Registration ID
def generate_registration_id():
    return f"REG-{int(time.time())}-{random.randint(1000, 9999)}"

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
    <p>Payment Status: {user_data.get('payment_status', 'Pending')}</p>
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

# Function to verify Razorpay webhook signature
def verify_webhook_signature(request_body, signature, secret):
    generated_signature = hmac.new(
        key=secret.encode(),
        msg=request_body,
        digestmod=hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(generated_signature, signature)

# API to Handle Initial Registration
@app.post("/register", response_model=PaymentResponse)
async def register_user(data: RegistrationData):
    # Generate registration ID for tracking
    registration_id = generate_registration_id()
    
    # Create user data dictionary
    user_data = data.dict()
    user_data["registration_id"] = registration_id
    user_data["created_at"] = time.time()
    user_data["payment_status"] = "pending"
    
    # Store pending registration
    try:
        collection.insert_one(user_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")
    
    # Construct payment URL with custom parameters
    payment_url = f"{RAZORPAY_PAYMENT_URL}?registration_id={registration_id}&email={data.email}&name={data.name}&phone={data.phone}"
    
    return {"payment_url": payment_url, "registration_id": registration_id}

# Webhook endpoint to handle payment notifications
@app.post("/webhook/razorpay")
async def razorpay_webhook(request: Request, response: Response):
    # Get the raw request body
    request_body = await request.body()
    
    # Get the Razorpay signature from headers
    signature = request.headers.get("X-Razorpay-Signature", "")
    
    # Verify webhook signature
    if not verify_webhook_signature(request_body, signature, RAZORPAY_WEBHOOK_SECRET):
        response.status_code = 401
        return {"status": "error", "message": "Invalid signature"}
    
    # Parse payment data
    payload = json.loads(request_body)
    
    # Extract necessary details
    try:
        payment_event = payload.get("event", "")
        payment_data = payload.get("payload", {}).get("payment", {}).get("entity", {})
        payment_id = payment_data.get("id", "")
        payment_status = payment_data.get("status", "")
        payment_amount = payment_data.get("amount", 0) / 100  # Convert from paise to rupees
        notes = payment_data.get("notes", {})
        registration_id = notes.get("registration_id", "")
        
        # Find the corresponding registration
        if not registration_id:
            # Try to extract from other fields if not in notes
            custom_fields = payload.get("payload", {}).get("payment", {}).get("custom_fields", {})
            for field in custom_fields:
                if field.get("name", "").lower() == "registration_id":
                    registration_id = field.get("value", "")
                    break
        
        # Extract from the payment description or other fields if still not found
        if not registration_id:
            description = payment_data.get("description", "")
            if "registration_id=" in description:
                registration_id = description.split("registration_id=")[1].split("&")[0]
        
        # If we still don't have a registration ID, check the payment URL
        if not registration_id:
            payment_url = payment_data.get("short_url", "")
            if "registration_id=" in payment_url:
                registration_id = payment_url.split("registration_id=")[1].split("&")[0]
        
        # Store payment information
        payment_info = {
            "payment_id": payment_id,
            "registration_id": registration_id,
            "status": payment_status,
            "amount": payment_amount,
            "event": payment_event,
            "timestamp": time.time(),
            "raw_data": payload
        }
        
        payment_collection.insert_one(payment_info)
        
        # Update registration status if payment is successful
        if payment_status == "captured" and payment_event == "payment.captured":
            # Find and update the registration
            registration = collection.find_one({"registration_id": registration_id})
            
            if registration:
                # Generate ticket ID
                ticket_id = generate_ticket_id()
                qr_path = generate_qr(ticket_id)
                
                # Update registration with payment and ticket details
                collection.update_one(
                    {"registration_id": registration_id},
                    {"$set": {
                        "payment_status": "completed",
                        "payment_id": payment_id,
                        "ticket_id": ticket_id,
                        "payment_details": payment_info
                    }}
                )
                
                # Get updated user data
                updated_registration = collection.find_one({"registration_id": registration_id})
                
                # Send confirmation email with QR code
                if updated_registration:
                    send_email(
                        updated_registration["email"], 
                        ticket_id, 
                        qr_path, 
                        updated_registration
                    )
        
        return {"status": "success"}
    
    except Exception as e:
        print(f"Webhook Error: {str(e)}")
        # Still return success to Razorpay to prevent retries, but log the error
        return {"status": "success", "internal_error": str(e)}

# API to check registration status
@app.get("/registration/{registration_id}")
async def check_registration(registration_id: str):
    registration = collection.find_one({"registration_id": registration_id})
    
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    # Remove MongoDB _id field for JSON serialization
    registration.pop("_id", None)
    
    return registration

# API to manually complete a registration (for admin use)
@app.post("/admin/complete-registration/{registration_id}")
async def complete_registration(registration_id: str):
    registration = collection.find_one({"registration_id": registration_id})
    
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    # Generate ticket ID
    ticket_id = generate_ticket_id()
    qr_path = generate_qr(ticket_id)
    
    # Update registration with ticket details
    collection.update_one(
        {"registration_id": registration_id},
        {"$set": {
            "payment_status": "completed",
            "ticket_id": ticket_id,
            "payment_mode": "manual",
            "completed_at": time.time()
        }}
    )
    
    # Get updated registration
    updated_registration = collection.find_one({"registration_id": registration_id})
    
    # Send confirmation email
    email_sent = send_email(
        updated_registration["email"],
        ticket_id,
        qr_path,
        updated_registration
    )
    
    return {
        "status": "success",
        "ticket_id": ticket_id,
        "email_sent": email_sent
    }

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://infest.in"],  # Allow all origins (Change to specific origins for security)
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

@app.get("/health")
async def health_check():
    return Response(status_code=200)
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import qrcode
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from pymongo import MongoClient
import random
import os
import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Secure Credentials from .env
MONGO_URI = os.getenv("MONGO_URI")
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

os.makedirs("qrcodes", exist_ok=True)

app = FastAPI()

# MongoDB Connection
try:
    client = MongoClient(MONGO_URI)
    db = client["infest_db"]
    collection = db["registrations"]
    logger.info("Connected to MongoDB Atlas")
except Exception as e:
    logger.error(f"MongoDB Connection Error: {e}")
    raise

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Models
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

class PaymentConfirmation(BaseModel):
    ticket_id: str
    payment_id: str
    payment_status: str

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
def send_email(user_email, subject, body, qr_path=None):
    msg = MIMEMultipart()
    msg["From"] = EMAIL_USER
    msg["To"] = user_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "html"))

    if qr_path:
        with open(qr_path, "rb") as f:
            img = MIMEImage(f.read(), name=os.path.basename(qr_path))
            msg.attach(img)

    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(EMAIL_USER, EMAIL_PASS)
        server.sendmail(EMAIL_USER, user_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        logger.error(f"Email Error: {e}")
        return False

# 🔹 Registration Route (No Email Sent Here)
@app.post("/register")
async def register_user(data: RegistrationData):
    ticket_id = generate_ticket_id()
    qr_path = generate_qr(ticket_id)

    user_data = data.dict()
    user_data["ticket_id"] = ticket_id
    user_data["registration_date"] = datetime.datetime.now()
    user_data["payment_status"] = "pending" if data.payment_mode == "offline" else "paid"
    user_data["attended"] = False

    try:
        collection.insert_one(user_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

    return {"status": "success", "ticket_id": ticket_id, "qr_code": qr_path}

# 🔹 Razorpay Payment Confirmation & Email Sending
@app.post("/confirm-payment")
async def confirm_payment(data: PaymentConfirmation):
    try:
        ticket_id = data.ticket_id
        payment_id = data.payment_id

        # Update MongoDB payment status
        result = collection.update_one(
            {"ticket_id": ticket_id},
            {"$set": {"payment_status": "paid", "payment_id": payment_id}}
        )

        if result.matched_count == 0:
            return {"status": "error", "message": "Ticket not found"}

        # Fetch participant details for email
        participant = collection.find_one({"ticket_id": ticket_id})
        if not participant:
            return {"status": "error", "message": "Participant not found"}

        qr_path = generate_qr(ticket_id)
        email_body = f"""
        <h2>Payment Confirmed for INFEST 2K25!</h2>
        <p>Your ticket ID: <b>{ticket_id}</b></p>
        <p>Full Name: {participant['name']}</p>
        <p>Email: {participant['email']}</p>
        <p>Phone: {participant['phone']}</p>
        <p>College: {participant['college']}</p>
        <p>Year: {participant['year']}</p>
        <p>Department: {participant['department']}</p>
        <p>Events: {', '.join(participant['events'])}</p>
        <p>Payment Status: <b>Paid</b></p>
        <p>Show the attached QR code at the event check-in.</p>
        """

        email_sent = send_email(participant["email"], "INFEST 2K25 - Payment Confirmation", email_body, qr_path)

        return {"status": "success", "message": "Payment confirmed and email sent", "email_sent": email_sent}

    except Exception as e:
        logger.error(f"Payment Confirmation Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to confirm payment.")

# 🔹 Get Participant Details
@app.get("/participant/{ticket_id}")
async def get_participant(ticket_id: str):
    try:
        participant = collection.find_one({"ticket_id": ticket_id})

        if participant:
            participant["_id"] = str(participant["_id"])
            if "registration_date" in participant:
                participant["registration_date"] = participant["registration_date"].strftime("%Y-%m-%d %H:%M:%S")
            return {"status": "success", "participant": participant}

        return {"status": "error", "message": "Participant not found"}
    except Exception as e:
        logger.error(f"Database Error: {e}")
        raise HTTPException(status_code=500, detail="Database Error")

# 🔹 Update Participant Status (Paid or Attended)
@app.post("/update-status")
async def update_status(data: dict):
    try:
        update_data = {"attended": True} if data["status_type"] == "attended" else {"payment_status": "paid"}
        result = collection.update_one({"ticket_id": data["ticket_id"]}, {"$set": update_data})

        if result.matched_count == 0:
            return {"status": "error", "message": "Participant not found"}
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Database Error: {e}")
        raise HTTPException(status_code=500, detail="Database Error")

# 🔹 API Root
@app.get("/")
def read_root():
    return {"message": "Welcome to INFEST 2K25 Scanner API"}
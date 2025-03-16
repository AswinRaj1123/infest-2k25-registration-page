import logging
import os
from dotenv import load_dotenv
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
import datetime
import razorpay

# Load environment variables
load_dotenv()

# Secure Credentials from .env
MONGO_URI = os.getenv("MONGO_URI")
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
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

# Razorpay Client
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust if needed
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

class StatusUpdateData(BaseModel):
    ticket_id: str
    status_type: str  # "paid" or "attended"

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

# 🔹 Registration Route
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

    email_sent = send_email(data.email, ticket_id, qr_path, user_data)

    return {"status": "success", "ticket_id": ticket_id, "qr_code": qr_path, "email_sent": email_sent}

# 🔹 Razorpay Order Creation
@app.post("/create-order")
async def create_order(data: dict):
    try:
        amount = data["amount"]  # Amount in paise
        order = razorpay_client.order.create({
            "amount": amount,
            "currency": "INR",
            "payment_capture": 1  # Auto capture payment
        })
        return {"order_id": order["id"]}
    except Exception as e:
        logger.error(f"Razorpay Order Creation Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create Razorpay order.")

# 🔹 Payment Confirmation Route
@app.post("/confirm-payment")
async def confirm_payment(data: PaymentConfirmation):
    try:
        logger.info(f"Confirming payment for Ticket ID: {data.ticket_id} | Payment ID: {data.payment_id}")

        # Update MongoDB to mark payment as paid
        result = collection.update_one(
            {"ticket_id": data.ticket_id},
            {"$set": {"payment_status": "paid", "payment_id": data.payment_id}}
        )

        # Check if the ticket ID exists in the database
        if result.matched_count == 0:
            logger.warning(f"Ticket ID {data.ticket_id} not found in database!")
            return {"status": "error", "message": "Ticket not found"}

        # ✅ Fetch user details from MongoDB to send email
        participant = collection.find_one({"ticket_id": data.ticket_id})
        if not participant:
            return {"status": "error", "message": "Participant not found"}

        qr_path = generate_qr(data.ticket_id)
        email_sent = send_email(participant["email"], data.ticket_id, qr_path, participant)

        logger.info(f"Payment confirmed and email sent to {participant['email']}")

        return {"status": "success", "message": "Payment confirmed and email sent"}

    except Exception as e:
        logger.error(f"Payment Confirmation Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to confirm payment.")

# 🔹 Get Participant Details
@app.get("/participant/{ticket_id}")
async def get_participant(ticket_id: str):
    try:
        logger.info(f"Fetching details for Ticket ID: {ticket_id}")
        
        participant = collection.find_one({"ticket_id": ticket_id})
        
        if participant:
            participant["_id"] = str(participant["_id"])  # Convert _id to string
            
            # Convert datetime to string for JSON response
            if "registration_date" in participant:
                participant["registration_date"] = participant["registration_date"].strftime("%Y-%m-%d %H:%M:%S")
            
            logger.info(f"Participant found: {participant}")
            return {"status": "success", "participant": participant}
        
        logger.warning(f"Participant with Ticket ID {ticket_id} not found!")
        return {"status": "error", "message": "Participant not found"}
    
    except Exception as e:
        logger.error(f"Database Error: {e}")
        raise HTTPException(status_code=500, detail="Database Error")

# 🔹 Update Participant Status (Paid or Attended)
@app.post("/update-status")
async def update_status(data: StatusUpdateData):
    try:
        update_data = {"attended": True} if data.status_type == "attended" else {"payment_status": "paid"}
        result = collection.update_one({"ticket_id": data.ticket_id}, {"$set": update_data})

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
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

app = FastAPI()

# MongoDB Connection
MONGO_URI = "mongodb+srv://infest2k25testcase:AAuxkvcJcaNhIBsx@infest-2k25userdata.jwvo6.mongodb.net/?retryWrites=true&w=majority&appName=INFEST-2K25UserData"
client = MongoClient(MONGO_URI)
db = client["infest_db"]
collection = db["registrations"]

# Email Configuration
EMAIL_USER = "infest2k25@gmail.com"
EMAIL_PASS = "rmac uddi oxbj qaxa"

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

# Function to Generate Ticket ID
def generate_ticket_id():
    return f"INF25-{random.randint(1000, 9999)}"

# Function to Generate QR Code
def generate_qr(ticket_id):
    qr = qrcode.make(ticket_id)
    qr_path = f"qrcodes/{ticket_id}.png"
    qr.save(qr_path)
    return qr_path

# Function to Send Confirmation Email
def send_email(user_email, ticket_id, qr_path):
    msg = MIMEMultipart()
    msg["From"] = EMAIL_USER
    msg["To"] = user_email
    msg["Subject"] = "INFEST 2K25 - Registration Confirmation"

    body = f"""
    <h2>Thank you for registering for INFEST 2K25!</h2>
    <p>Your ticket ID: <b>{ticket_id}</b></p>
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

# API to Handle Registration
@app.post("/register")
async def register_user(data: RegistrationData):
    ticket_id = generate_ticket_id()
    qr_path = generate_qr(ticket_id)

    user_data = data.dict()
    user_data["ticket_id"] = ticket_id

    collection.insert_one(user_data)

    email_sent = send_email(data.email, ticket_id, qr_path)

    return {"status": "success", "ticket_id": ticket_id, "qr_code": qr_path, "email_sent": email_sent}
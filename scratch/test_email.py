import smtplib
from dotenv import load_dotenv
import os

load_dotenv()

server = os.getenv('MAIL_SERVER')
port = int(os.getenv('MAIL_PORT', 587))
user = os.getenv('MAIL_USERNAME')
password = os.getenv('MAIL_PASSWORD')

print(f"Connecting to {server}:{port}...")
try:
    with smtplib.SMTP(server, port, timeout=10) as smtp:
        print("Starting TLS...")
        smtp.starttls()
        print(f"Logging in as {user}...")
        smtp.login(user, password)
        print("Login successful! ✅")
except Exception as e:
    print(f"Failed! ❌\nError: {e}")

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv
import csv
import io
from datetime import date

load_dotenv()

GMAIL_USER = os.getenv("GMAIL_USER", "your-email@gmail.com")
GMAIL_PASSWORD = os.getenv("GMAIL_PASSWORD", "your-app-password")

def send_leads_email(staff_email: str, staff_name: str, contacts: list):
    """Send leads to staff member via email with CSV attachment"""
    try:
        # Create email message
        msg = MIMEMultipart()
        msg['From'] = GMAIL_USER
        msg['To'] = staff_email
        msg['Subject'] = f"Daily Leads - {date.today().strftime('%B %d, %Y')}"
        
        # Email body
        body = f"""
        Hi {staff_name},
        
        Your daily lead allocation for today is ready!
        
        Attached is a CSV file with {len(contacts)} leads.
        
        **Lead Details:**
        {chr(10).join([f"- {c['phone']} ({c.get('name', 'N/A')})" for c in contacts[:5]])}
        ... and more
        
        Start dialing! 🚀
        
        Best regards,
        Automation System
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Create CSV attachment
        csv_buffer = io.StringIO()
        fieldnames = ['phone', 'name']
        writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(contacts)
        
        csv_content = csv_buffer.getvalue()
        attachment = MIMEText(csv_content)
        attachment.add_header('Content-Disposition', 'attachment', filename=f'leads_{date.today()}.csv')
        msg.attach(attachment)
        
        # Send email
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(GMAIL_USER, GMAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        print(f"✅ Email sent to {staff_email}")
        return True
    
    except Exception as e:
        print(f"❌ Failed to send email to {staff_email}: {str(e)}")
        return False

def send_test_email(recipient_email: str):
    """Send a test email"""
    try:
        msg = MIMEMultipart()
        msg['From'] = GMAIL_USER
        msg['To'] = recipient_email
        msg['Subject'] = "Test Email from Automation Dashboard"
        
        body = "This is a test email from your automation system. If you received this, email setup is working!"
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(GMAIL_USER, GMAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        print(f"✅ Test email sent to {recipient_email}")
        return True
    
    except Exception as e:
        print(f"❌ Failed to send test email: {str(e)}")
        return False
import datetime
import uuid

def generate_invoice_number():
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    return f"INV-{timestamp}-{uuid.uuid4().hex[:6].upper()}"

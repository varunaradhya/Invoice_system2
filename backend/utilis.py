import datetime

def generate_invoice_number():
    return "INV-" + datetime.datetime.now().strftime("%Y%m%d%H%M%S")
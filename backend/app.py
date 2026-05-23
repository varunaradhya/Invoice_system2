from flask import Flask
from routes.customer_routes import customer_bp
from routes.product_routes import product_bp
from routes.invoice_routes import invoice_bp
from routes.payment_routes import payment_bp
from routes.analytics_routes import analytics_bp

app = Flask(__name__)

app.register_blueprint(customer_bp, url_prefix="/customers")
app.register_blueprint(product_bp, url_prefix="/products")
app.register_blueprint(invoice_bp, url_prefix="/invoices")
app.register_blueprint(payment_bp, url_prefix="/payments")
app.register_blueprint(analytics_bp, url_prefix="/analytics")

if __name__ == "__main__":
    app.run(debug=True)
from flask import Flask
from init_db import init_db
from routes.customer_routes import customer_bp
from routes.product_routes import product_bp
from routes.invoice_routes import invoice_bp
from routes.payment_routes import payment_bp
from routes.analytics_routes import analytics_bp
from routes.demo_routes import demo_bp
from routes.quotation_routes import quotation_bp
from routes.settings_routes import settings_bp
from routes.user_routes import user_bp

app = Flask(__name__)
init_db()


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response

app.register_blueprint(customer_bp, url_prefix="/customers")
app.register_blueprint(product_bp, url_prefix="/products")
app.register_blueprint(invoice_bp, url_prefix="/invoices")
app.register_blueprint(payment_bp, url_prefix="/payments")
app.register_blueprint(analytics_bp, url_prefix="/analytics")
app.register_blueprint(demo_bp, url_prefix="/demo")
app.register_blueprint(quotation_bp, url_prefix="/quotations")
app.register_blueprint(settings_bp, url_prefix="/settings")
app.register_blueprint(user_bp, url_prefix="/users")

if __name__ == "__main__":
    app.run(debug=True)

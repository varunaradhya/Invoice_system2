# Invoice System 2

A small Flask and SQLite invoice system with a static HTML/CSS/JavaScript frontend.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python backend\init_db.py
python backend\seed_demo.py
python backend\app.py
```

Open `frontend/index.html` in a browser. The frontend calls the API at `http://127.0.0.1:5000`.

## API

- `GET /customers/`, `POST /customers/`
- `GET /products/`, `POST /products/`
- `GET /invoices/`, `POST /invoices/`
- `POST /payments/`
- `GET /analytics/`
- `POST /demo/seed`

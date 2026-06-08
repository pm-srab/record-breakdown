# Maintenance SRAB - API Gateway & Frontend

This project acts as a secure server-side API proxy and dashboard interface for logging machine breakdowns and managing spare parts.

## Setup Instructions

### 1. Create a Virtual Environment
To keep dependencies isolated, create a virtual environment in the project root:
```bash
python3 -m venv venv
```

### 2. Activate the Virtual Environment
Activate the environment:
* **Linux/macOS**:
  ```bash
  source venv/bin/activate
  ```
* **Windows**:
  ```cmd
  venv\Scripts\activate
  ```

### 3. Install Dependencies
Install all required Python packages listed in `backend/requirements.txt`:
```bash
pip install -r backend/requirements.txt
```

### 4. Configuration
Create a `.env` file inside the `backend/` directory with the following variables:
```env
PORT=8080
PASSWORD=your_secure_password
SCRIPT_URL=https://script.google.com/macros/s/.../exec
SPARE_SCRIPT_URL=https://script.google.com/macros/s/.../exec
```

---

## Running the Application

Once setup is complete, start the FastAPI server:
```bash
python backend/app.py
```
The application will be served locally at: http://127.0.0.1:8080/

import os
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Maintenance SRAB API Gateway")

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize HTTPX Async Client
client = httpx.AsyncClient()

@app.on_event("shutdown")
async def shutdown_event():
    await client.aclose()

@app.get("/api/breakdowns")
async def get_breakdowns(request: Request):
    script_url = os.getenv("SCRIPT_URL")
    if not script_url:
        raise HTTPException(status_code=500, detail="SCRIPT_URL not configured in environment")
    
    # Forward all query parameters
    params = dict(request.query_params)
    try:
        response = await client.get(script_url, params=params, follow_redirects=True, timeout=30.0)
        try:
            return response.json()
        except ValueError:
            return Response(content=response.text, media_type=response.headers.get("content-type"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Proxy error: {str(e)}")

@app.post("/api/breakdowns")
async def post_breakdowns(request: Request):
    script_url = os.getenv("SCRIPT_URL")
    if not script_url:
        raise HTTPException(status_code=500, detail="SCRIPT_URL not configured in environment")
    
    # Read form data and query params
    form_data = await request.form()
    data = dict(form_data)
    params = dict(request.query_params)
    
    action = params.get("action") or data.get("action")
    
    # Secure sensitive actions on server-side
    if action == "delete":
        client_password = request.headers.get("X-Api-Password")
        server_password = os.getenv("PASSWORD", "1234")
        if client_password != server_password:
            raise HTTPException(status_code=401, detail="Unauthorized: Incorrect password")
            
    try:
        # Forward request to Google Apps Script and follow redirects
        response = await client.post(script_url, data=data, params=params, follow_redirects=True, timeout=30.0)
        try:
            return response.json()
        except ValueError:
            return Response(content=response.text, media_type=response.headers.get("content-type"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Proxy error: {str(e)}")

@app.get("/api/spareparts")
async def get_spareparts(request: Request):
    spare_script_url = os.getenv("SPARE_SCRIPT_URL")
    if not spare_script_url:
        raise HTTPException(status_code=500, detail="SPARE_SCRIPT_URL not configured in environment")
        
    params = dict(request.query_params)
    try:
        response = await client.get(spare_script_url, params=params, follow_redirects=True, timeout=30.0)
        try:
            return response.json()
        except ValueError:
            return Response(content=response.text, media_type=response.headers.get("content-type"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Proxy error: {str(e)}")

@app.post("/api/spareparts")
async def post_spareparts(request: Request):
    spare_script_url = os.getenv("SPARE_SCRIPT_URL")
    if not spare_script_url:
        raise HTTPException(status_code=500, detail="SPARE_SCRIPT_URL not configured in environment")
        
    form_data = await request.form()
    data = dict(form_data)
    params = dict(request.query_params)
    
    action = params.get("action") or data.get("action")
    
    # Secure sensitive actions on server-side
    if action in ["updateStock", "useSparePart", "deleteHistory"]:
        client_password = request.headers.get("X-Api-Password")
        server_password = os.getenv("PASSWORD", "1234")
        if client_password != server_password:
            raise HTTPException(status_code=401, detail="Unauthorized: Incorrect password")
            
    try:
        response = await client.post(spare_script_url, data=data, params=params, follow_redirects=True, timeout=30.0)
        try:
            return response.json()
        except ValueError:
            return Response(content=response.text, media_type=response.headers.get("content-type"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Proxy error: {str(e)}")

# Mount frontend directory to serve HTML, JS, CSS, and static assets
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend"))
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    # We run without reload=True when executing directly to avoid import path issues
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)

"""
Main FastAPI Application for KKT Services Expiration Management System

This is the entry point for the backend API server.
It configures FastAPI app, routers, middleware, and CORS.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
import time
import logging
import os

from backend.config import settings
from backend.database import check_db_connection, init_db, SessionLocal

# Import API routers
from backend.api import auth, users, deadlines, dashboard, deadline_types, cash_registers, ofd_providers, database, setup
# Deprecated routers (kept for backward compatibility during migration)
# from backend.api import clients, contacts


# ============================================
# Logging Configuration
# ============================================

logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================
# FastAPI Application Instance
# ============================================

app = FastAPI(
    title="KKT Services Expiration Management API",
    description="""
    Backend API for managing cash register (KKT) service expiration deadlines
    with automated Telegram notifications.
    
    ## Features
    - Client management with INN validation
    - Deadline tracking with status calculation
    - Telegram contact management
    - Dashboard statistics
    - JWT authentication
    
    ## Authentication
    Most endpoints require JWT authentication. Obtain token via `/api/auth/login`.
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)


# ============================================
# CORS Middleware Configuration
# ============================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ============================================
# Request Logging Middleware
# ============================================

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests with timing"""
    start_time = time.time()
    
    # Process request
    response = await call_next(request)
    
    # Calculate processing time
    process_time = time.time() - start_time
    
    # Log request
    logger.info(
        f"{request.method} {request.url.path} "
        f"- Status: {response.status_code} "
        f"- Time: {process_time:.3f}s"
    )
    
    # Add custom header with processing time
    response.headers["X-Process-Time"] = str(process_time)
    
    return response


# ============================================
# Include API Routers
# ============================================

# Authentication
app.include_router(auth.router)

# Users Management (replaces clients and contacts)
app.include_router(users.router)

# Deadlines Management
app.include_router(deadlines.router)

# Dashboard Statistics
app.include_router(dashboard.router)

# Deadline Types
app.include_router(deadline_types.router)
app.include_router(cash_registers.router)
app.include_router(ofd_providers.router)
app.include_router(database.router)
app.include_router(setup.router)

# DEPRECATED: Old routers (uncomment if needed for backward compatibility)
# app.include_router(clients.router)
# app.include_router(contacts.router)


# ============================================
# Static Files
# ============================================

# Путь к статическим файлам
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    logger.info(f"📁 Static files mounted: {STATIC_DIR}")
else:
    logger.warning(f"⚠️ Static directory not found: {STATIC_DIR}")


# ============================================
# Root & Health Check Endpoints
# ============================================

@app.get("/", tags=["System"])
async def root():
    """
    Root endpoint - redirect to login page
    """
    return RedirectResponse(url="/static/login.html")


@app.get("/health", tags=["System"])
async def health_check():
    """
    Health check endpoint - verifies database connection
    
    Returns system health status
    """
    # Check database connection
    db_connected = check_db_connection()
    
    health_status = {
        "status": "healthy" if db_connected else "unhealthy",
        "database": "connected" if db_connected else "disconnected",
        "timestamp": time.time()
    }
    
    # Return 503 if unhealthy
    status_code = 200 if db_connected else 503
    
    return JSONResponse(content=health_status, status_code=status_code)


# ============================================
# Event Handlers
# ============================================

@app.on_event("startup")
async def startup_event():
    """
    Startup event - runs when application starts.
    Auto-creates tables on first run. Admin is created via /setup page.
    """
    logger.info("=" * 60)
    logger.info("KKT SERVICES API STARTING")
    logger.info("=" * 60)
    logger.info(f"API Host: {settings.api_host}:{settings.api_port}")
    logger.info(f"Database: {settings.database_path}")
    logger.info(f"CORS Origins: {settings.cors_origins_list}")
    logger.info(f"Documentation: http://{settings.api_host}:{settings.api_port}/docs")
    
    # Check database connection
    if check_db_connection():
        logger.info("✓ Database connection successful")
        
        # Auto-create tables if they don't exist
        try:
            init_db()
            logger.info("✓ Database tables verified")
        except Exception as e:
            logger.error(f"✗ Database init error: {e}")
        

    else:
        logger.error("✗ Database connection failed")
    
    logger.info("=" * 60)



@app.on_event("shutdown")
async def shutdown_event():
    """
    Shutdown event - runs when application stops
    """
    logger.info("=" * 60)
    logger.info("KKT SERVICES API SHUTTING DOWN")
    logger.info("=" * 60)


# ============================================
# Global Exception Handler
# ============================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler for unhandled errors
    """
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An internal server error occurred",
                "detail": str(exc) if settings.api_reload else "Contact administrator"
            }
        }
    )


# ============================================
# Run Application (for development)
# ============================================

if __name__ == "__main__":
    import uvicorn
    
    print("=" * 60)
    print("STARTING KKT SERVICES API SERVER")
    print("=" * 60)
    print(f"Host: {settings.api_host}")
    print(f"Port: {settings.api_port}")
    print(f"Reload: {settings.api_reload}")
    print(f"Docs: http://localhost:{settings.api_port}/docs")
    print("=" * 60)
    
    uvicorn.run(
        "backend.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload,
        log_level=settings.log_level.lower()
    )

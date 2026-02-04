"""
KKT Deployment Service
Manages local updates and remote deployments via SSH
Master system: full functionality
Client system: only version info and auto-update status
"""

import os
import json
import asyncio
import logging
from datetime import datetime
from typing import Optional
from pathlib import Path

import paramiko
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import httpx
import subprocess

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="KKT Deployment Service", version="1.0.0")

# Configuration
GITHUB_REPO = "zhurbarv-hub/KKT"
GITHUB_API = f"https://api.github.com/repos/{GITHUB_REPO}"
VERSION_FILE = "/app/VERSION"
INSTALL_DIR = os.environ.get("INSTALL_DIR", "/opt/kkt")
IS_MASTER = os.environ.get("IS_MASTER", "false").lower() == "true"

# In-memory storage
deployments = {}
update_status = {"status": "idle", "message": "", "progress": 0}


class SystemInfo(BaseModel):
    version: str
    is_master: bool
    hostname: str
    auto_update: bool


class VersionInfo(BaseModel):
    current: str
    latest: str
    update_available: bool
    changelog: list[str] = []


class UpdateRequest(BaseModel):
    force: bool = False


class DeployRequest(BaseModel):
    host: str
    port: int = 22
    username: str = "root"
    password: Optional[str] = None
    ssh_key: Optional[str] = None
    domain: Optional[str] = None
    bot_token: str
    admin_telegram_id: str
    ssl_email: Optional[str] = None


class DeploymentStatus(BaseModel):
    id: str
    host: str
    status: str
    progress: int
    message: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    logs: list[str] = []


def get_current_version() -> str:
    """Get current installed version"""
    try:
        # First check local VERSION file
        local_version = Path(INSTALL_DIR) / "VERSION"
        if local_version.exists():
            return local_version.read_text().strip()
        if os.path.exists(VERSION_FILE):
            return Path(VERSION_FILE).read_text().strip()
    except Exception as e:
        logger.error(f"Error getting version: {e}")
    return "1.0.0"


async def get_latest_version() -> tuple[str, list[str]]:
    """Get latest version from GitHub"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{GITHUB_API}/releases/latest", timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                version = data.get("tag_name", "v1.0.0").lstrip("v")
                body = data.get("body", "")
                changelog = [line.strip() for line in body.split("\n") if line.strip().startswith("-")]
                return version, changelog
            
            # Fallback: check tags
            resp = await client.get(f"{GITHUB_API}/tags", timeout=10)
            if resp.status_code == 200:
                tags = resp.json()
                if tags:
                    return tags[0].get("name", "v1.0.0").lstrip("v"), []
    except Exception as e:
        logger.error(f"Error fetching latest version: {e}")
    
    return get_current_version(), []


@app.get("/health")
async def health():
    return {"status": "ok", "is_master": IS_MASTER}


@app.get("/info", response_model=SystemInfo)
async def get_system_info():
    """Get system information"""
    import socket
    return SystemInfo(
        version=get_current_version(),
        is_master=IS_MASTER,
        hostname=socket.gethostname(),
        auto_update=not IS_MASTER  # Clients have auto-update via Watchtower
    )


@app.get("/version", response_model=VersionInfo)
async def get_version():
    """Get version information"""
    current = get_current_version()
    latest, changelog = await get_latest_version()
    
    return VersionInfo(
        current=current,
        latest=latest,
        update_available=current != latest,
        changelog=changelog
    )


@app.get("/update/status")
async def get_update_status():
    """Get current update status"""
    return update_status


@app.post("/update")
async def start_update(request: UpdateRequest, background_tasks: BackgroundTasks):
    """Start system update (master only)"""
    if not IS_MASTER:
        raise HTTPException(403, "Updates are automatic on client systems")
    
    global update_status
    
    if update_status["status"] == "running":
        raise HTTPException(400, "Update already in progress")
    
    update_status = {"status": "running", "message": "Starting update...", "progress": 0}
    background_tasks.add_task(run_update)
    
    return {"message": "Update started", "status": "running"}


async def run_update():
    """Run the actual update process"""
    global update_status
    
    try:
        steps = [
            ("Pulling new images...", "docker compose pull"),
            ("Stopping services...", "docker compose stop backend bot frontend"),
            ("Starting services...", "docker compose up -d backend bot frontend"),
            ("Cleaning up...", "docker image prune -f"),
        ]
        
        os.chdir(INSTALL_DIR)
        
        for i, (message, command) in enumerate(steps):
            update_status["message"] = message
            update_status["progress"] = int((i / len(steps)) * 100)
            
            result = subprocess.run(command, shell=True, capture_output=True, text=True)
            if result.returncode != 0:
                raise Exception(f"Command failed: {result.stderr}")
            
            await asyncio.sleep(1)
        
        update_status = {"status": "success", "message": "Обновление завершено!", "progress": 100}
        
    except Exception as e:
        logger.error(f"Update failed: {e}")
        update_status = {"status": "failed", "message": str(e), "progress": 0}


@app.post("/deploy")
async def start_deployment(request: DeployRequest, background_tasks: BackgroundTasks):
    """Start deployment to a new VDS (master only)"""
    if not IS_MASTER:
        raise HTTPException(403, "Deployments can only be initiated from master system")
    
    import uuid
    
    deploy_id = str(uuid.uuid4())[:8]
    
    deployment = DeploymentStatus(
        id=deploy_id,
        host=request.host,
        status="pending",
        progress=0,
        message="В очереди на развёртывание",
        started_at=datetime.utcnow(),
        logs=[]
    )
    deployments[deploy_id] = deployment
    
    background_tasks.add_task(run_deployment, deploy_id, request)
    
    return {"id": deploy_id, "message": "Deployment started"}


@app.get("/deploy/{deploy_id}", response_model=DeploymentStatus)
async def get_deployment_status(deploy_id: str):
    """Get deployment status"""
    if deploy_id not in deployments:
        raise HTTPException(404, "Deployment not found")
    return deployments[deploy_id]


@app.get("/deployments")
async def list_deployments():
    """List all deployments (master only)"""
    if not IS_MASTER:
        return []
    return list(deployments.values())


async def run_deployment(deploy_id: str, request: DeployRequest):
    """Run SSH deployment to remote server"""
    deployment = deployments[deploy_id]
    deployment.status = "running"
    deployment.message = "Подключение к серверу..."
    
    ssh = None
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        connect_kwargs = {
            "hostname": request.host,
            "port": request.port,
            "username": request.username,
        }
        
        if request.ssh_key:
            from io import StringIO
            key = paramiko.RSAKey.from_private_key(StringIO(request.ssh_key))
            connect_kwargs["pkey"] = key
        elif request.password:
            connect_kwargs["password"] = request.password
        else:
            raise Exception("Не указан метод аутентификации")
        
        ssh.connect(**connect_kwargs, timeout=30)
        deployment.logs.append(f"✓ Подключено к {request.host}")
        deployment.progress = 10
        
        # Installation steps
        steps = [
            ("Установка Docker...", "curl -fsSL https://get.docker.com | sh || true"),
            ("Установка Docker Compose...", "apt-get update && apt-get install -y docker-compose-plugin || true"),
            ("Создание директории...", "mkdir -p /opt/kkt && cd /opt/kkt"),
            ("Загрузка конфигурации...", 
             f"cd /opt/kkt && curl -sL https://raw.githubusercontent.com/{GITHUB_REPO}/main/docker-compose.prod.yml -o docker-compose.yml"),
            ("Загрузка nginx конфига...", 
             f"cd /opt/kkt && curl -sL https://raw.githubusercontent.com/{GITHUB_REPO}/main/nginx.prod.conf -o nginx.conf"),
        ]
        
        for i, (message, command) in enumerate(steps):
            deployment.message = message
            deployment.progress = 10 + int((i / len(steps)) * 40)
            
            stdin, stdout, stderr = ssh.exec_command(command, timeout=300)
            exit_code = stdout.channel.recv_exit_status()
            output = stdout.read().decode()
            error = stderr.read().decode()
            
            if exit_code != 0 and "already" not in error.lower():
                deployment.logs.append(f"⚠ {message}: {error[:100]}")
            else:
                deployment.logs.append(f"✓ {message}")
        
        # Create .env file
        deployment.message = "Создание конфигурации..."
        deployment.progress = 60
        
        import secrets
        db_password = secrets.token_urlsafe(24)
        jwt_secret = secrets.token_urlsafe(64)
        domain = request.domain or request.host
        
        env_content = f"""DB_USER=kkt_user
DB_PASSWORD={db_password}
DB_NAME=kkt_production
JWT_SECRET_KEY={jwt_secret}
TELEGRAM_BOT_TOKEN={request.bot_token}
ADMIN_TELEGRAM_IDS={request.admin_telegram_id}
DOMAIN={domain}
IS_MASTER=false
"""
        
        stdin, stdout, stderr = ssh.exec_command(f"cat > /opt/kkt/.env << 'ENVEOF'\n{env_content}ENVEOF")
        stdout.channel.recv_exit_status()
        deployment.logs.append("✓ Конфигурация создана")
        
        # Update nginx with domain
        deployment.message = "Настройка nginx..."
        ssh.exec_command(f"cd /opt/kkt && sed -i 's/DOMAIN/{domain}/g' nginx.conf")
        deployment.logs.append("✓ Nginx настроен")
        deployment.progress = 70
        
        # Pull and start with client profile (includes watchtower)
        deployment.message = "Загрузка Docker образов..."
        stdin, stdout, stderr = ssh.exec_command("cd /opt/kkt && docker compose pull", timeout=600)
        stdout.channel.recv_exit_status()
        deployment.logs.append("✓ Docker образы загружены")
        deployment.progress = 85
        
        deployment.message = "Запуск сервисов..."
        stdin, stdout, stderr = ssh.exec_command("cd /opt/kkt && docker compose --profile client up -d", timeout=300)
        stdout.channel.recv_exit_status()
        deployment.logs.append("✓ Сервисы запущены")
        deployment.logs.append("✓ Watchtower активирован (авто-обновления)")
        deployment.progress = 95
        
        # Install CLI
        ssh.exec_command(f"curl -sL https://raw.githubusercontent.com/{GITHUB_REPO}/main/kkt-cli.sh -o /usr/local/bin/kkt && chmod +x /usr/local/bin/kkt")
        deployment.logs.append("✓ KKT CLI установлен")
        
        deployment.status = "success"
        deployment.message = "Развёртывание завершено!"
        deployment.progress = 100
        deployment.finished_at = datetime.utcnow()
        deployment.logs.append(f"\n🎉 Система доступна: http://{domain}")
        
    except Exception as e:
        logger.error(f"Deployment failed: {e}")
        deployment.status = "failed"
        deployment.message = str(e)
        deployment.finished_at = datetime.utcnow()
        deployment.logs.append(f"✗ Ошибка: {e}")
    
    finally:
        if ssh:
            ssh.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

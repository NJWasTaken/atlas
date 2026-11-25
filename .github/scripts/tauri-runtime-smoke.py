from __future__ import annotations

import json
import os
import secrets
import signal
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

runtime = Path(sys.argv[1]).resolve()
repo_root = Path(__file__).resolve().parents[2]
backend_dir = repo_root / "backend"
api_name = "atlas-api.exe" if os.name == "nt" else "atlas-api"
node_name = "node.exe" if os.name == "nt" else "node"
api = runtime / api_name
node = runtime / node_name
frontend_dir = runtime / "frontend"
server = frontend_dir / "server.js"
build_id = frontend_dir / ".next" / "BUILD_ID"

for required in (api, node, server, build_id):
    if not required.is_file():
        raise SystemExit(f"Missing staged runtime component: {required}")

subprocess.run([str(node), "--version"], check=True, timeout=10)


def healthy(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=1) as response:
            return 200 <= response.status < 400
    except (OSError, urllib.error.URLError):
        return False


def request_json(url: str, payload: dict, token: str | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST"
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def stop_process(process: subprocess.Popen | None) -> None:
    if process is None or process.poll() is not None:
        return
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                timeout=10,
            )
        else:
            os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=8)
    except (OSError, subprocess.TimeoutExpired):
        try:
            if os.name == "nt":
                subprocess.run(
                    ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                    check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    timeout=10,
                )
            else:
                os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=5)
        except (OSError, subprocess.TimeoutExpired):
            pass


def start_api(env: dict[str, str], log, creation_flags: int) -> subprocess.Popen:
    process = subprocess.Popen(
        [str(api)], env=env, stdout=log, stderr=subprocess.STDOUT,
        creationflags=creation_flags, start_new_session=(os.name != "nt"),
    )
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline and not healthy("http://127.0.0.1:43121/health"):
        if process.poll() is not None:
            raise RuntimeError(f"API sidecar exited early with code {process.returncode}")
        time.sleep(0.25)
    if not healthy("http://127.0.0.1:43121/health"):
        raise RuntimeError("API sidecar did not become healthy within 60 seconds")
    return process


with tempfile.TemporaryDirectory(prefix="atlas-tauri-smoke-") as data_dir, tempfile.TemporaryDirectory(prefix="atlas-tauri-logs-") as logs_dir:
    data_path = Path(data_dir)
    database_path = data_path / "atlas.sqlite3"
    env = os.environ.copy()
    secret = secrets.token_hex(48)
    env.update({
        "ATLAS_USER_DATA_DIR": data_dir,
        "ATLAS_API_PORT": "43121",
        "JWT_SECRET": secret,
        "FRONTEND_ORIGIN": "http://127.0.0.1:43122",
        "CORS_ORIGINS": "http://127.0.0.1:43122",
        "ENVIRONMENT": "development",
        "DATABASE_URL": f"sqlite:///{database_path.as_posix()}",
    })
    api_log = open(Path(logs_dir) / "api.log", "ab")
    web_log = open(Path(logs_dir) / "web.log", "ab")
    creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    api_process = None
    web_process = None

    try:
        # Model an existing desktop installation: create its SQLite database
        # at the last schema before filesystem-backed PDF storage, then let the
        # packaged desktop entry point upgrade it to the current Alembic head.
        subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "0008_pdf_annotation_styles"],
            cwd=backend_dir, env=env, check=True, timeout=60,
        )
        with sqlite3.connect(database_path) as connection:
            revision = connection.execute("SELECT version_num FROM alembic_version").fetchone()[0]
        if revision != "0008_pdf_annotation_styles":
            raise RuntimeError(f"Expected legacy schema 0008, found {revision}")

        api_process = start_api(env, api_log, creation_flags)
        with sqlite3.connect(database_path) as connection:
            revision = connection.execute("SELECT version_num FROM alembic_version").fetchone()[0]
        if revision != "0009_explore_local_pdf_storage":
            raise RuntimeError(f"Packaged API did not upgrade the legacy schema: {revision}")

        if not (data_path / "pdfs").is_dir():
            raise RuntimeError("API did not create the managed PDF directory")

        credentials = {
            "email": "runtime-smoke@example.com",
            "password": "runtime-smoke-password",
        }
        token = request_json("http://127.0.0.1:43121/api/v1/auth/register", credentials)["access_token"]
        user = urllib.request.Request(
            "http://127.0.0.1:43121/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        with urllib.request.urlopen(user, timeout=10) as response:
            if json.loads(response.read().decode("utf-8"))["email"] != credentials["email"]:
                raise RuntimeError("Fresh desktop profile did not retain the created account")

        # Restart the API against the same profile and prove that its database,
        # migration state, and user records remain available.
        stop_process(api_process)
        api_process = start_api(env, api_log, creation_flags)
        login = request_json("http://127.0.0.1:43121/api/v1/auth/login", credentials)
        if not login.get("access_token"):
            raise RuntimeError("User data was not available after restarting the API sidecar")

        web_env = env.copy()
        web_env.update({
            "HOSTNAME": "127.0.0.1",
            "PORT": "43122",
            "NODE_ENV": "production",
            "NEXT_PUBLIC_API_URL": "http://127.0.0.1:43121/api/v1",
        })
        web_process = subprocess.Popen(
            [str(node), str(server)], env=web_env, cwd=str(frontend_dir),
            stdout=web_log, stderr=subprocess.STDOUT,
            creationflags=creation_flags, start_new_session=(os.name != "nt"),
        )
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline and not healthy("http://127.0.0.1:43122"):
            if web_process.poll() is not None:
                raise RuntimeError(f"Frontend server exited early with code {web_process.returncode}")
            time.sleep(0.25)
        if not healthy("http://127.0.0.1:43122"):
            raise RuntimeError("Frontend server did not become healthy within 60 seconds")

        print(
            "Tauri runtime smoke test passed: legacy SQLite schema upgraded, "
            "managed PDF directory created, account survived API restart, "
            "and frontend/API services became healthy."
        )
    finally:
        stop_process(web_process)
        stop_process(api_process)
        api_log.close()
        web_log.close()

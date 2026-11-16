from __future__ import annotations

import os
import secrets
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

runtime = Path(sys.argv[1]).resolve()
api_name = "atlas-api.exe" if os.name == "nt" else "atlas-api"
node_name = "node.exe" if os.name == "nt" else "node"
api = runtime / api_name
node = runtime / node_name
server = runtime / "frontend" / "server.js"

for required in (api, node, server):
    if not required.is_file():
        raise SystemExit(f"Missing staged runtime component: {required}")

subprocess.run([str(node), "--version"], check=True, timeout=10)

def healthy(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=1) as response:
            return 200 <= response.status < 400
    except (OSError, urllib.error.URLError):
        return False

with tempfile.TemporaryDirectory(prefix="atlas-tauri-smoke-") as data_dir, tempfile.TemporaryDirectory(prefix="atlas-tauri-logs-") as logs_dir:
    env = os.environ.copy()
    env.update({
        "ATLAS_USER_DATA_DIR": data_dir,
        "ATLAS_API_PORT": "43121",
        "JWT_SECRET": secrets.token_hex(48),
        "FRONTEND_ORIGIN": "http://127.0.0.1:43122",
        "CORS_ORIGINS": "http://127.0.0.1:43122",
        "ENVIRONMENT": "development",
    })
    api_log = open(Path(logs_dir) / "api.log", "wb")
    web_log = open(Path(logs_dir) / "web.log", "wb")
    api_process = subprocess.Popen([str(api)], env=env, stdout=api_log, stderr=subprocess.STDOUT)
    web_env = env.copy()
    web_env.update({
        "HOSTNAME": "127.0.0.1",
        "PORT": "43122",
        "NODE_ENV": "production",
        "NEXT_PUBLIC_API_URL": "http://127.0.0.1:43121/api/v1",
    })
    web_process = None
    try:
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline and not healthy("http://127.0.0.1:43121/health"):
            if api_process.poll() is not None:
                raise RuntimeError(f"API sidecar exited early with code {api_process.returncode}")
            time.sleep(0.25)
        if not healthy("http://127.0.0.1:43121/health"):
            raise RuntimeError("API sidecar did not become healthy within 60 seconds")

        web_process = subprocess.Popen(
            [str(node), str(server)], env=web_env,
            stdout=web_log, stderr=subprocess.STDOUT,
        )
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline and not healthy("http://127.0.0.1:43122"):
            if web_process.poll() is not None:
                raise RuntimeError(f"Frontend server exited early with code {web_process.returncode}")
            time.sleep(0.25)
        if not healthy("http://127.0.0.1:43122"):
            raise RuntimeError("Frontend server did not become healthy within 60 seconds")

        if not (Path(data_dir) / "atlas.sqlite3").exists():
            raise RuntimeError("API did not create its SQLite database in the isolated profile")
        print("Runtime smoke test passed: API healthy, frontend healthy, isolated SQLite profile created.")
    finally:
        for process in (web_process, api_process):
            if process is not None and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
        api_log.close()
        web_log.close()

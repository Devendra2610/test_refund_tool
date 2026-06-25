import subprocess
import time
import re
import sys
import os

APP_JSX_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend", "src", "App.jsx"))

def get_tunnel_url(port):
    print(f"[INFO] Starting localtunnel on port {port}...")
    # Use shell=True to load npx reliably on all OS
    proc = subprocess.Popen(
        f"npx localtunnel --port {port}",
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1
    )
    
    # Read output until we find the url
    url = None
    start_time = time.time()
    while time.time() - start_time < 30:
        line = proc.stdout.readline()
        if not line:
            time.sleep(0.1)
            continue
        print(f"  [lt port {port}] {line.strip()}")
        match = re.search(r"your url is:\s*(https?://\S+)", line)
        if match:
            url = match.group(1)
            break
            
    if not url:
        proc.terminate()
        raise Exception(f"Failed to get tunnel URL for port {port}")
        
    return proc, url

def update_app_jsx(new_url):
    print(f"[INFO] Updating {APP_JSX_PATH} to point to {new_url}...")
    with open(APP_JSX_PATH, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Replace API_BASE line
    pattern = r"const API_BASE = ['\"][^'\"]+['\"];"
    replacement = f"const API_BASE = '{new_url}';"
    
    if not re.search(pattern, content):
        raise Exception("Could not find API_BASE declaration in App.jsx")
        
    modified_content = re.sub(pattern, replacement, content)
    with open(APP_JSX_PATH, "w", encoding="utf-8") as f:
        f.write(modified_content)

def main():
    original_jsx_content = None
    if os.path.exists(APP_JSX_PATH):
        with open(APP_JSX_PATH, "r", encoding="utf-8") as f:
            original_jsx_content = f.read()
            
    backend_server = None
    frontend_server = None
    backend_tunnel = None
    frontend_tunnel = None
    
    try:
        # 1. Start Backend Server
        print("[INFO] Starting Backend Server (Uvicorn)...")
        # Find correct python interpreter in venv
        venv_python = os.path.join("backend", "venv", "Scripts", "python.exe") if os.name == "nt" else os.path.join("backend", "venv", "bin", "python")
        if not os.path.exists(venv_python):
            venv_python = os.path.join("backend", ".venv", "Scripts", "python.exe") if os.name == "nt" else os.path.join("backend", ".venv", "bin", "python")
        if not os.path.exists(venv_python):
            venv_python = "python" # fallback
            
        backend_server = subprocess.Popen(
            [venv_python, "-m", "uvicorn", "app.main:app", "--port", "8000"],
            cwd="backend",
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        time.sleep(2) # wait for backend to initialize
        
        # 2. Start Frontend Server
        print("[INFO] Starting Frontend Server (Vite)...")
        npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
        frontend_server = subprocess.Popen(
            [npm_cmd, "run", "dev"],
            cwd="frontend",
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        time.sleep(2) # wait for frontend to initialize

        # 3. Start backend tunnel
        backend_tunnel, backend_url = get_tunnel_url(8000)
        print(f"[SUCCESS] Backend API tunnel created: {backend_url}")
        print()
        
        # 4. Update frontend config
        update_app_jsx(backend_url)
        print()
        
        # 5. Start frontend tunnel
        frontend_tunnel, frontend_url = get_tunnel_url(5173)
        print()
        print("=========================================================")
        print("   SHAREABLE LINK GENERATED SUCCESSFULLY!   ")
        print("=========================================================")
        print(f"   Share this link with anyone to access your dashboard:")
        print(f"   {frontend_url}")
        print("=========================================================")
        print("Note: Keep this window open. When someone visits the link,")
        print("localtunnel may ask them to enter your public IP address.")
        print("You can find your public IP address by searching 'my ip' on Google.")
        print("=========================================================")
        print("Press Ctrl+C in this terminal to stop the servers and sharing.")
        
        # Keep running
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n[INFO] Shutting down servers and tunnels...")
    finally:
        # Clean up all spawned processes
        for proc in [backend_server, frontend_server, backend_tunnel, frontend_tunnel]:
            if proc:
                try:
                    proc.terminate()
                except Exception:
                    pass
            
        if original_jsx_content:
            print("[INFO] Restoring original App.jsx configuration...")
            with open(APP_JSX_PATH, "w", encoding="utf-8") as f:
                f.write(original_jsx_content)
            print("[SUCCESS] Local settings restored.")

if __name__ == "__main__":
    main()

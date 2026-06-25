import subprocess
import time
import re
import sys
import os

APP_JSX_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend", "src", "App.jsx"))

def get_tunnel_url(port):
    print(f"[INFO] Starting localtunnel on port {port}...")
    # Use shell=True for windows to load npx
    proc = subprocess.Popen(
        f"cmd /c npx localtunnel --port {port}",
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
            
    backend_proc = None
    frontend_proc = None
    
    try:
        # 1. Start backend tunnel
        backend_proc, backend_url = get_tunnel_url(8000)
        print(f"[SUCCESS] Backend API tunnel created: {backend_url}")
        print()
        
        # 2. Update frontend config
        update_app_jsx(backend_url)
        print()
        
        # 3. Start frontend tunnel
        frontend_proc, frontend_url = get_tunnel_url(5173)
        print()
        print("=========================================================")
        print("   SHAREABLE LINK GENERATED SUCCESSFULLY!   ")
        print("=========================================================")
        print(f"   Share this link with anyone to access your dashboard:")
        print(f"   {frontend_url}")
        print("=========================================================")
        print("Note: Keep this script running. When someone visits the link,")
        print("localtunnel may ask them to enter the host's public IP address.")
        print("You can find your public IP address by searching 'my ip' on Google.")
        print("=========================================================")
        print("Press Ctrl+C to stop sharing and restore local settings.")
        
        # Keep running
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n[INFO] Shutting down tunnels...")
    finally:
        if backend_proc:
            backend_proc.terminate()
        if frontend_proc:
            frontend_proc.terminate()
            
        if original_jsx_content:
            print("[INFO] Restoring original App.jsx configuration...")
            with open(APP_JSX_PATH, "w", encoding="utf-8") as f:
                f.write(original_jsx_content)
            print("[SUCCESS] Local settings restored.")

if __name__ == "__main__":
    main()

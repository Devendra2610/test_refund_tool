#!/bin/bash
echo "==================================================="
echo "       GST Refund Tool - Server and Sharing Tunnel"
echo "==================================================="
echo
echo "[INFO] Initializing backend, frontend, and generating shareable link..."
echo

# Run share.py with unbuffered python
python3 -u share.py

echo
echo "[INFO] Stopped sharing."

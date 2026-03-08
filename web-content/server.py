#!/usr/bin/env python3
"""
Simple HTTP server to host the Todo PWA app on local network.
Run this script to serve the app on 0.0.0.0:8080 (accessible from your phone).
"""

import http.server
import socketserver
import os

PORT = 8080
DIRECTORY = "."

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Add PWA caching headers
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def run_server():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"🚀 Server running at http://0.0.0.0:{PORT}")
        print(f"📱 Access from phone: http://YOUR_IP_ADDRESS:{PORT}")
        print(f"   Find your IP: ipconfig (Windows) / ifconfig (Mac/Linux)")
        print(f"\nPress Ctrl+C to stop the server")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 Server stopped")

if __name__ == "__main__":
    run_server()

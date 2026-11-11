"""Server locale senza cache: ogni modifica ai file si vede subito ricaricando la pagina.

Uso:  python3 serve.py [porta]   (default 8125)
"""
import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8125
    root = os.path.dirname(os.path.abspath(__file__))
    handler = functools.partial(NoCacheHandler, directory=root)
    print(f"Tavolo D&D su http://localhost:{port}")
    http.server.ThreadingHTTPServer(("", port), handler).serve_forever()

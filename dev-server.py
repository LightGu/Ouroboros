#!/usr/bin/env python3
"""Servidor de desenvolvimento. Igual ao http.server, mas manda o navegador
não guardar nada em cache — senão editar um .js exige Ctrl+Shift+R toda vez."""
import http.server, socketserver, sys

PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 5599

class SemCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def send_head(self):
        # ignora o If-Modified-Since do navegador: sempre responde 200 com o arquivo
        self.headers.replace_header('If-Modified-Since', '') if 'If-Modified-Since' in self.headers else None
        if 'If-None-Match' in self.headers:
            del self.headers['If-None-Match']
        return super().send_head()

    def log_message(self, *a):
        pass

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORTA), SemCache) as s:
    print(f'servindo sem cache em http://localhost:{PORTA}')
    s.serve_forever()

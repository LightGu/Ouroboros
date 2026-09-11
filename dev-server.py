#!/usr/bin/env python3
"""Servidor de desenvolvimento.

Faz duas coisas além de servir arquivos:

1. Manda `Cache-Control: no-store`, para o navegador não guardar nada novo.

2. Carimba `?v=<data de modificação>` nos <script> e <link> do index.html.
   Só o no-store não basta: um arquivo que o navegador guardou ANTES (quando
   o servidor era o http.server padrão) continua sendo usado sem nem
   perguntar, porque o Chrome o considera fresco pela heurística de
   Last-Modified. Mudando a URL, ele é obrigado a buscar de novo.
"""
import http.server, socketserver, sys, os, re, io

PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 5599
RAIZ = os.path.dirname(os.path.abspath(__file__))
ALVO = re.compile(r'(<(?:script|link)[^>]*?(?:src|href)=")((?:js|css|img)/[^"?]+)(")')


class Dev(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def send_head(self):
        # nunca responder 304: o arquivo em disco é sempre a verdade
        for h in ('If-Modified-Since', 'If-None-Match'):
            if h in self.headers:
                del self.headers[h]

        caminho = self.path.split('?')[0]
        if caminho in ('/', '/index.html'):
            return self._index()
        return super().send_head()

    def _index(self):
        arquivo = os.path.join(RAIZ, 'index.html')
        try:
            html = io.open(arquivo, encoding='utf-8').read()
        except OSError:
            self.send_error(404)
            return None

        def carimba(m):
            alvo = os.path.join(RAIZ, m.group(2))
            v = int(os.path.getmtime(alvo)) if os.path.exists(alvo) else 0
            return f'{m.group(1)}{m.group(2)}?v={v}{m.group(3)}'

        corpo = ALVO.sub(carimba, html).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(corpo)))
        self.end_headers()
        return io.BytesIO(corpo)

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORTA), Dev) as s:
    print(f'servindo sem cache em http://localhost:{PORTA}')
    s.serve_forever()

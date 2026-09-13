/* Utilidades de interface: modal, toast, binding, imagens */

const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- caminhos aninhados: "pv.atual", "ataques.0.dano" ---------- */

function getPath(obj, caminho) {
  return caminho.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function setPath(obj, caminho, valor) {
  const partes = caminho.split('.');
  let alvo = obj;
  for (let i = 0; i < partes.length - 1; i++) {
    const k = partes[i];
    if (alvo[k] == null) alvo[k] = /^\d+$/.test(partes[i + 1]) ? [] : {};
    alvo = alvo[k];
  }
  alvo[partes[partes.length - 1]] = valor;
}

/* ---------- toast ---------- */

let toastTimer;
function toast(msg, tipo = 'ok') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast toast-' + tipo;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

/* ---------- modal ---------- */

const Modal = {
  aoConfirmar: null,

  abrir({ titulo, corpo, confirmar = 'Salvar', cancelar = 'Cancelar', perigo = false, largo = false, onConfirmar }) {
    delete Modal._imagemPendente;
    /* `largo` é do passo a passo de criação: 560px não cabe a grade de perícias.
       Sempre com toggle, pra um modal largo não deixar o próximo largo também. */
    $('#modal .modal').classList.toggle('modal-largo', largo);
    $('#modal-titulo').textContent = titulo;
    $('#modal-body').innerHTML = corpo;
    $('#modal-foot').innerHTML =
      `<button class="btn btn-ghost" data-modal-cancelar>${esc(cancelar)}</button>
       <button class="btn ${perigo ? 'btn-perigo' : 'btn-primary'}" data-modal-ok>${esc(confirmar)}</button>`;
    this.aoConfirmar = onConfirmar;
    $('#modal').hidden = false;
    setTimeout(() => { const f = $('#modal-body input, #modal-body textarea'); if (f) f.focus(); }, 30);
  },

  fechar() {
    $('#modal').hidden = true;
    this.aoConfirmar = null;
  }
};

document.addEventListener('click', e => {
  if (e.target.closest('[data-modal-cancelar]') || e.target.id === 'modal-fechar') Modal.fechar();
  if (e.target.id === 'modal') Modal.fechar();
  if (e.target.closest('[data-modal-ok]')) {
    const fn = Modal.aoConfirmar;
    if (!fn) return Modal.fechar();
    const r = fn();
    /* confirmação assíncrona (grava na nuvem): só fecha se não recusar */
    if (r instanceof Promise) r.then(v => { if (v !== false) Modal.fechar(); });
    else if (r !== false) Modal.fechar();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#modal').hidden) Modal.fechar();
});

/* ---------- imagens: redimensiona para caber no localStorage ---------- */

const IMG_MAX = 460;

function lerImagem(arquivo) {
  return lerImagemMax(arquivo, IMG_MAX, 0.82);
}

function lerImagemMax(arquivo, maximo, qualidade) {
  return new Promise((resolve, reject) => {
    if (!arquivo) return reject('sem arquivo');
    const leitor = new FileReader();
    leitor.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, maximo / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * escala);
        c.height = Math.round(img.height * escala);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#15161a';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', qualidade));
      };
      img.onerror = () => reject('imagem inválida');
      img.src = leitor.result;
    };
    leitor.onerror = () => reject('falha na leitura');
    leitor.readAsDataURL(arquivo);
  });
}

function iniciais(nome) {
  const partes = String(nome || '?').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase();
}

/* cor estável a partir do nome, pro placeholder não ficar tudo igual */
function corDoNome(nome) {
  let h = 0;
  for (const ch of String(nome || 'x')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function num(v, padrao = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : padrao;
}

function d20() { return 1 + Math.floor(Math.random() * 20); }

/* Arrasto por alça, com mouse, caneta ou toque. Só altera a ordem ao soltar. */
function ligarArrasto({ raiz, itens, alca, aoMover }) {
  let ativo = null;
  const limpar = () => {
    if (!ativo) return;
    const { origem, cabo, pointerId } = ativo;
    ativo = null;
    origem.classList.remove('arrastando');
    raiz.querySelectorAll('.destino-arraste').forEach(el => el.classList.remove('destino-arraste'));
    if (cabo.hasPointerCapture(pointerId)) cabo.releasePointerCapture(pointerId);
  };
  raiz.addEventListener('pointerdown', e => {
    const cabo = e.target.closest(alca), origem = cabo?.closest(itens);
    if (!origem || !raiz.contains(origem) || e.button !== 0 || ativo) return;
    e.preventDefault();
    ativo = { origem, cabo, pointerId: e.pointerId, x: e.clientX, y: e.clientY, destino: null, moveu: false };
    cabo.setPointerCapture(e.pointerId);
  });
  raiz.addEventListener('pointermove', e => {
    if (!ativo || e.pointerId !== ativo.pointerId) return;
    if (!ativo.moveu && Math.hypot(e.clientX - ativo.x, e.clientY - ativo.y) < 6) return;
    ativo.moveu = true;
    ativo.origem.classList.add('arrastando');
    ativo.destino?.classList.remove('destino-arraste');
    const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest(itens);
    ativo.destino = alvo && raiz.contains(alvo) && alvo !== ativo.origem ? alvo : null;
    ativo.destino?.classList.add('destino-arraste');
    if (e.clientY < 60) window.scrollBy(0, -20);
    else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 20);
  });
  raiz.addEventListener('pointerup', e => {
    if (!ativo || e.pointerId !== ativo.pointerId) return;
    const { origem, destino, moveu } = ativo;
    limpar();
    if (moveu && destino) aoMover(origem, destino);
  });
  raiz.addEventListener('pointercancel', limpar);
  raiz.addEventListener('lostpointercapture', limpar);
  raiz.addEventListener('dragstart', e => { if (e.target.closest(alca)) e.preventDefault(); });
  raiz.addEventListener('click', e => {
    if (e.target.closest(alca)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
}


function imagemPorVida(p) {
  const inconsciente = (p.condicoes || []).some(c => String(c).trim().toLocaleLowerCase('pt-BR') === 'inconsciente');
  if (inconsciente && p.imagemInconsciente) return p.imagemInconsciente;
  const max = Number(p.pv?.max), atual = Number(p.pv?.atual);
  if (max > 0 && Number.isFinite(atual)) {
    if (atual <= max * 0.2) return p.imagemCritica || p.imagemFerido || p.imagem || '';
    if (atual <= max * 0.8) return p.imagemFerido || p.imagem || '';
  }
  return p.imagem || '';
}

/* =========================================================
   PAINEL DA JESSICA
   1. Confere o login (sem login, volta pra tela de entrar)
   2. Lê as tabelas do banco
   3. Desenha cada aba
   Se faltar uma tabela ou um campo, o painel avisa e segue funcionando.
   ========================================================= */
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const db = window.banco;
const BIB = window.Biblioteca || null;

/* ---------- Listas fixas ---------- */
const NICHOS = [
  { id: "sensorial", nome: "Sensorial/Estético" },
  { id: "fitness", nome: "Fitness" },
  { id: "beleza", nome: "Beleza" },
  { id: "moda", nome: "Moda" },
  { id: "casa", nome: "Casa" },
  { id: "experiencia", nome: "Experiência" }
];
const SITUACOES = [
  { id: "lead", nome: "Lead" },
  { id: "conversando", nome: "Conversando" },
  { id: "cliente", nome: "Cliente" },
  { id: "parada", nome: "Parada" }
];
const TIPOS_CAL = [
  { id: "gravar", nome: "Gravar" },
  { id: "editar", nome: "Editar" },
  { id: "postar", nome: "Postar" }
];
const FUNIL = ["Briefing", "Roteiro", "Aprovação Roteiro", "Gravação", "Edição", "Aprovado", "Entregue"];
const TITULOS = { portfolio: "Portfólio", marcas: "Marcas", calendario: "Calendário", campanhas: "Campanhas", checklist: "Checklist do portfólio" };

const estado = {
  aba: "portfolio",
  videos: [], marcas: [], calendario: [], campanhas: [], visitas: [],
  marcados: new Set(),
  mes: inicioDoMes(new Date()),
  filtroTipo: "todos",
  filtroCampanhas: "todas",
  ordem: { col: "prazo", dir: 1 },
  subaba: "checklist",
  abertos: new Set()
};

/* ---------- Pequenas ajudas ---------- */
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pad = n => String(n).padStart(2, "0");
const dinheiro = v => num(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
function isoLocal(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function hojeISO() { return isoLocal(new Date()); }
function inicioDoMes(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function partes(iso) { const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number); return { a, m, d }; }
function diasAte(iso) { /* positivo = no futuro, negativo = já passou */
  if (!iso) return 0;
  const p = partes(iso), h = partes(hojeISO());
  return Math.round((Date.UTC(p.a, p.m - 1, p.d) - Date.UTC(h.a, h.m - 1, h.d)) / 864e5);
}
function dataBR(iso) { if (!iso) return ""; const p = partes(iso); return `${pad(p.d)}/${pad(p.m)}/${p.a}`; }
const nomeNicho = id => (NICHOS.find(n => n.id === id) || {}).nome || id || "Sem nicho";
const nomeSituacao = id => (SITUACOES.find(s => s.id === id) || {}).nome || id || "";
const pilulaExemplo = r => r && r.exemplo ? `<span class="pilula p-exemplo">exemplo</span>` : "";
function idYoutube(url) { const m = String(url || "").match(/(?:shorts\/|youtu\.be\/|[?&]v=|embed\/)([\w-]{11})/); return m ? m[1] : ""; }
function linkInstagram(v) {
  const h = String(v || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  return h ? { arroba: "@" + h, url: "https://instagram.com/" + encodeURIComponent(h) } : null;
}
function linkWhats(tel) {
  let d = String(tel || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d.length >= 12 ? "https://wa.me/" + d : "";
}

/* ---------- Avisos ---------- */
const avisosAtivos = new Map();
function aviso(chave, texto, tipo) {
  avisosAtivos.set(chave, { texto, tipo });
  desenharAvisos();
}
function tirarAviso(chave) { if (avisosAtivos.delete(chave)) desenharAvisos(); }
function desenharAvisos() {
  const vistos = new Set(); /* o mesmo aviso aparece uma vez só */
  $("#avisos").innerHTML = [...avisosAtivos.values()].filter(a => !vistos.has(a.texto) && vistos.add(a.texto)).map(a =>
    `<div class="aviso ${a.tipo === "erro" ? "erro" : ""}"><span>${a.texto}</span></div>`).join("");
}
let timerRapido = null;
function avisoRapido(texto, erro) {
  const el = $("#avisoRapido");
  el.textContent = texto;
  el.className = "aviso-rapido" + (erro ? " erro" : "");
  el.hidden = false;
  clearTimeout(timerRapido);
  timerRapido = setTimeout(() => { el.hidden = true; }, erro ? 6000 : 2600);
}

/* Traduz o erro do banco para português simples */
function explicarErro(tabela, erro) {
  const cod = String((erro && erro.code) || "");
  const msg = String((erro && (erro.message || erro.details)) || "").toLowerCase();
  if (cod === "PGRST205" || cod === "42P01" || msg.includes("could not find the table") || (msg.includes("relation") && msg.includes("does not exist")))
    return `<strong>A tabela "${esc(tabela)}" não existe no banco.</strong> Rode o arquivo banco.sql no Supabase (SQL Editor) para criar. O resto do painel segue funcionando.`;
  if (cod === "42703" || cod === "PGRST204" || msg.includes("column")) {
    const campo = (String((erro && erro.message) || "").match(/['"]([a-z_]+)['"]/i) || [])[1];
    return `<strong>Falta um campo na tabela "${esc(tabela)}"${campo ? ` (${esc(campo)})` : ""}.</strong> Rode o banco.sql de novo para completar. O resto segue funcionando.`;
  }
  if (cod === "PGRST301" || cod === "PGRST303" || msg.includes("jwt"))
    return `<strong>Sua sessão expirou.</strong> Clique em Sair e entre de novo.`;
  if (cod === "42501" || msg.includes("permission denied") || msg.includes("row-level security"))
    return `<strong>O banco recusou o acesso à tabela "${esc(tabela)}".</strong> Confira se você entrou com o e-mail dono do painel e se rodou o banco.sql inteiro.`;
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("failed to"))
    return `<strong>Não consegui falar com o banco.</strong> Confira a internet e recarregue a página.`;
  return `<strong>Algo deu errado com a tabela "${esc(tabela)}".</strong> ${esc((erro && erro.message) || "")}`;
}
const semTags = html => html.replace(/<[^>]+>/g, "");

/* ---------- Ler e gravar no banco ---------- */
const tabelasFaltando = new Set();
function avisoFaltando() {
  if (!tabelasFaltando.size) { tirarAviso("faltando"); return; }
  const lista = [...tabelasFaltando].map(t => `"${esc(t)}"`).join(", ");
  aviso("faltando", tabelasFaltando.size === 1
    ? `<strong>A tabela ${lista} não existe no banco.</strong> Rode o arquivo banco.sql no Supabase (SQL Editor) para criar. O resto do painel segue funcionando.`
    : `<strong>Faltam estas tabelas no banco: ${lista}.</strong> Rode o arquivo banco.sql no Supabase (SQL Editor) para criar. O resto do painel segue funcionando.`, "aviso");
}
function tabelaNaoExiste(erro) {
  const cod = String((erro && erro.code) || ""), msg = String((erro && erro.message) || "").toLowerCase();
  return cod === "PGRST205" || cod === "42P01" || msg.includes("could not find the table") || (msg.includes("relation") && msg.includes("does not exist"));
}
async function ler(tabela, montar) {
  if (!db) return [];
  try {
    const consulta = montar ? montar(db.from(tabela).select("*")) : db.from(tabela).select("*");
    const { data, error } = await consulta;
    if (error) throw error;
    tirarAviso("tabela-" + tabela);
    if (tabelasFaltando.delete(tabela)) avisoFaltando();
    return Array.isArray(data) ? data : [];
  } catch (erro) {
    if (tabelaNaoExiste(erro)) { tirarAviso("tabela-" + tabela); tabelasFaltando.add(tabela); avisoFaltando(); }
    else aviso("tabela-" + tabela, explicarErro(tabela, erro), "aviso");
    return [];
  }
}
async function gravar(tabela, dados, id) {
  if (!db) { avisoRapido("Sem conexão com o banco.", true); return false; }
  try {
    const q = id == null ? db.from(tabela).insert(dados) : db.from(tabela).update(dados).eq("id", id);
    const { error } = await q;
    if (error) throw error;
    return true;
  } catch (erro) {
    avisoRapido(semTags(explicarErro(tabela, erro)), true);
    return false;
  }
}
async function apagar(tabela, id) {
  try {
    const { error } = await db.from(tabela).delete().eq("id", id);
    if (error) throw error;
    return true;
  } catch (erro) {
    avisoRapido(semTags(explicarErro(tabela, erro)), true);
    return false;
  }
}

async function carregarVideos() { estado.videos = (await ler("videos")).sort((a, b) => num(a.ordem) - num(b.ordem) || num(a.id) - num(b.id)); }
async function carregarMarcas() { estado.marcas = (await ler("marcas")).sort((a, b) => String(b.criado_em || "").localeCompare(String(a.criado_em || ""))); }
async function carregarCalendario() { estado.calendario = await ler("calendario"); }
async function carregarCampanhas() { estado.campanhas = await ler("campanhas"); }
async function carregarMarcados() { estado.marcados = new Set((await ler("marcados")).map(m => m.chave)); }
async function carregarVisitas() {
  const desde = new Date(); desde.setHours(0, 0, 0, 0); desde.setDate(desde.getDate() - 13);
  estado.visitas = await ler("visitas", q => q.gte("data", desde.toISOString()).limit(20000));
}
async function carregarTudo() {
  await Promise.all([carregarVideos(), carregarMarcas(), carregarCalendario(), carregarCampanhas(), carregarMarcados(), carregarVisitas()]);
}

/* Desenha uma parte com rede de proteção: se der erro, avisa e o resto continua */
function seguro(nome, fn) {
  try { fn(); tirarAviso("desenho-" + nome); }
  catch (e) {
    console.error(e);
    aviso("desenho-" + nome, `<strong>Não consegui mostrar a parte "${esc(nome)}".</strong> O resto do painel segue funcionando.`, "erro");
  }
}
function desenharTudo() {
  seguro("Portfólio", desenharPortfolio);
  seguro("Marcas", desenharMarcas);
  seguro("Calendário", desenharCalendario);
  seguro("Campanhas", desenharCampanhas);
  seguro("Checklist", desenharChecklist);
}

/* =========================================================
   JANELA (formulários e confirmações)
   ========================================================= */
const janela = $("#janela");
let aoFecharJanela = null;
function abrirJanela(titulo, html, larga) {
  $("#janelaTitulo").textContent = titulo;
  $("#janelaCorpo").innerHTML = html;
  janela.classList.toggle("larga", !!larga);
  if (!janela.open) janela.showModal();
  return $("#janelaCorpo");
}
function fecharJanela() { if (janela.open) janela.close(); }
$("#janelaFechar").addEventListener("click", fecharJanela);
janela.addEventListener("click", e => { if (e.target === janela) fecharJanela(); });
janela.addEventListener("close", () => { const f = aoFecharJanela; aoFecharJanela = null; if (f) f(); });

function confirmar(texto, rotulo) {
  return new Promise(resolver => {
    const corpo = abrirJanela("Tem certeza?", `<p style="font-size:.86rem">${texto}</p>
      <div class="form-botoes"><button type="button" class="botao contorno" data-nao>Cancelar</button>
      <button type="button" class="botao perigo" data-sim>${esc(rotulo || "Apagar")}</button></div>`);
    let respondeu = false;
    aoFecharJanela = () => { if (!respondeu) resolver(false); };
    $("[data-nao]", corpo).onclick = () => fecharJanela();
    $("[data-sim]", corpo).onclick = () => { respondeu = true; resolver(true); fecharJanela(); };
  });
}

/* Monta um formulário a partir de uma lista de campos */
function campoHTML(c, v) {
  if (c.linha) return `<div class="linha2">${c.linha.map(x => campoHTML(x, v)).join("")}</div>`;
  const val = v[c.nome] == null ? (c.padrao == null ? "" : c.padrao) : v[c.nome];
  if (c.tipo === "checkbox") return `<label class="marcar"><input type="checkbox" name="${c.nome}" ${val ? "checked" : ""}> ${esc(c.rotulo)}</label>`;
  if (c.tipo === "select") return `<label>${esc(c.rotulo)}<select name="${c.nome}">${c.opcoes.map(o =>
    `<option value="${esc(o.id)}" ${String(o.id) === String(val) ? "selected" : ""}>${esc(o.nome)}</option>`).join("")}</select></label>`;
  if (c.tipo === "textarea") return `<label>${esc(c.rotulo)}<textarea name="${c.nome}" placeholder="${esc(c.dica || "")}">${esc(val)}</textarea></label>`;
  return `<label>${esc(c.rotulo)}<input type="${c.tipo || "text"}" name="${c.nome}" value="${esc(val)}" placeholder="${esc(c.dica || "")}" ${c.tipo === "number" ? `step="${c.passo || 1}" min="0"` : ""}></label>`;
}
function todosCampos(campos) { return campos.flatMap(c => c.linha ? c.linha : [c]); }
function formulario({ titulo, campos, valores, aoSalvar, aoApagar }) {
  const v = valores || {};
  const corpo = abrirJanela(titulo, `<form class="form" novalidate>
      ${campos.map(c => campoHTML(c, v)).join("")}
      <p class="erro-form" hidden></p>
      <div class="form-botoes">
        ${aoApagar ? `<button type="button" class="botao contorno esquerda" data-apagar>Apagar</button>` : ""}
        <button type="button" class="botao contorno" data-cancelar>Cancelar</button>
        <button type="submit" class="botao">Salvar</button>
      </div></form>`);
  const form = $("form", corpo);
  $("[data-cancelar]", form).onclick = fecharJanela;
  if (aoApagar) $("[data-apagar]", form).onclick = async () => { if (await confirmar("Isso apaga a linha de vez. Não tem como desfazer.")) await aoApagar(); };
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const dados = {};
    for (const c of todosCampos(campos)) {
      const el = form.elements[c.nome];
      if (c.tipo === "checkbox") dados[c.nome] = el.checked;
      else if (c.tipo === "number") dados[c.nome] = num(el.value);
      else if (c.tipo === "date") dados[c.nome] = el.value || null;
      else dados[c.nome] = el.value.trim();
      if (c.obrigatorio && !dados[c.nome]) {
        const p = $(".erro-form", form); p.textContent = `Preencha: ${c.rotulo}.`; p.hidden = false; el.focus(); return;
      }
    }
    const b = $("[type=submit]", form); b.disabled = true; b.textContent = "Salvando...";
    const ok = await aoSalvar(dados);
    if (ok) fecharJanela(); else { b.disabled = false; b.textContent = "Salvar"; }
  });
  const primeiro = $("input,select,textarea", form);
  if (primeiro) setTimeout(() => primeiro.focus(), 30);
}

/* Baixa uma planilha CSV que abre certinho no Excel (com acento) */
function baixarCSV(nomeArquivo, cabecalho, linhas) {
  const cel = v => { const s = String(v == null ? "" : v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const texto = "﻿" + [cabecalho, ...linhas].map(l => l.map(cel).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${nomeArquivo}-${hojeISO()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const valorCSV = v => num(v).toFixed(2).replace(".", ",");

/* =========================================================
   NAVEGAÇÃO E MENU
   ========================================================= */
function irPara(aba) {
  if (!TITULOS[aba]) aba = "portfolio";
  estado.aba = aba;
  $$(".aba").forEach(s => { s.hidden = s.id !== "aba-" + aba; });
  $$(".menu-item").forEach(b => { b.classList.toggle("ativo", b.dataset.aba === aba); b.setAttribute("aria-current", b.dataset.aba === aba ? "page" : "false"); });
  $("#tituloAba").textContent = TITULOS[aba];
  document.title = `${TITULOS[aba]} | Painel Jessica Passos`;
  if (location.hash !== "#" + aba) history.replaceState(null, "", "#" + aba);
  gaveta(false);
}
function gaveta(abrir) {
  $("#menu").classList.toggle("aberto", abrir);
  $("#menuSombra").hidden = !abrir;
  $("#abrirMenu").setAttribute("aria-expanded", abrir);
}

/* =========================================================
   1. PORTFÓLIO
   ========================================================= */
function desenharPortfolio() {
  const visitas = estado.visitas;
  const hoje = hojeISO();
  const porDia = new Map();
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); porDia.set(isoLocal(d), 0); }
  const porOrigem = new Map();
  for (const v of visitas) {
    const dia = v.data ? isoLocal(new Date(v.data)) : "";
    if (porDia.has(dia)) porDia.set(dia, porDia.get(dia) + 1);
    const o = (v.origem || "Direto").trim() || "Direto";
    porOrigem.set(o, (porOrigem.get(o) || 0) + 1);
  }
  const total14 = [...porDia.values()].reduce((a, b) => a + b, 0);
  const totalHoje = porDia.get(hoje) || 0;
  const noAr = estado.videos.filter(v => v.visivel !== false);
  const porNicho = new Map();
  noAr.forEach(v => { if (v.nicho) porNicho.set(v.nicho, (porNicho.get(v.nicho) || 0) + 1); });
  const nichoForte = [...porNicho.entries()].sort((a, b) => b[1] - a[1])[0];
  const origens = [...porOrigem.entries()].sort((a, b) => b[1] - a[1]);

  $("#numerosPortfolio").innerHTML = [
    ["Visitas em 14 dias", total14, ""],
    ["Visitas hoje", totalHoje, ""],
    ["Vídeos no ar", noAr.length, ""],
    ["Nicho mais forte", nichoForte ? nomeNicho(nichoForte[0]) : "Nenhum ainda", nichoForte ? plural(nichoForte[1], "vídeo", "vídeos") : ""],
    ["De onde mais vêm", origens[0] ? origens[0][0] : "Ninguém ainda", origens[0] ? plural(origens[0][1], "visita", "visitas") : ""]
  ].map(([r, v, s]) => `<div class="numero"><span>${r}</span><strong title="${esc(v)}">${esc(v)}</strong>${s ? `<small>${esc(s)}</small>` : ""}</div>`).join("");

  if (total14 === 0) {
    $("#grafico").innerHTML = `<p class="vazio">Ainda não chegou nenhuma visita. Quando as pessoas começarem a abrir o seu portfólio, aqui aparece uma barra por dia mostrando quantas visitas chegaram em cada um dos últimos 14 dias.</p>`;
  } else {
    const maior = Math.max(1, ...porDia.values());
    $("#grafico").innerHTML = `<div class="grafico">${[...porDia.entries()].map(([dia, n]) => {
      const p = partes(dia);
      return `<div class="barra-dia ${dia === hoje ? "hoje" : ""}" title="${dataBR(dia)}: ${plural(n, "visita", "visitas")}">
        <b>${n || ""}</b><i style="height:${Math.round(n / maior * 100)}%"></i><small>${pad(p.d)}/${pad(p.m)}</small></div>`;
    }).join("")}</div>`;
  }
  $("#origens").innerHTML = origens.length
    ? origens.map(([o, n]) => `<div class="origem"><span>${esc(o)}</span><b>${n}</b><span class="trilho"><i style="width:${Math.round(n / total14 * 100)}%"></i></span></div>`).join("")
    : `<p class="vazio">Aqui vai aparecer por onde as pessoas chegaram ao seu site: Instagram, Google, WhatsApp ou direto pelo link.</p>`;

  desenharTabelaVideos();
}

const ICONE = {
  olho: `<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  olhoFechado: `<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>`,
  lapis: `<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M14 6l4 4"/></svg>`,
  lixo: `<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`,
  alca: `<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>`,
  abrir: `<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
  estrela: `<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/></svg>`,
  mais: `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`
};

function desenharTabelaVideos() {
  const t = $("#tabelaVideos");
  if (!estado.videos.length) {
    t.innerHTML = `<tbody><tr><td><p class="vazio">Nenhum vídeo cadastrado ainda. Clique em "Adicionar vídeo" para colocar o primeiro no site.</p></td></tr></tbody>`;
    return;
  }
  t.innerHTML = `<thead><tr><th></th><th>Título</th><th>Nicho</th><th>Formato</th><th>Marca</th><th>Destaque</th><th>Link</th><th class="acoes">Ações</th></tr></thead>
  <tbody>${estado.videos.map(v => {
    const vis = v.visivel !== false;
    return `<tr data-id="${v.id}" class="${vis ? "" : "escondido"}">
      <td><button type="button" class="botao-icone alca" aria-label="Mudar a ordem de ${esc(v.titulo)} (use as setas do teclado)" title="Arraste para mudar a ordem">${ICONE.alca}</button></td>
      <td>${esc(v.titulo) || '<span class="apagado">Sem título</span>'}</td>
      <td>${esc(nomeNicho(v.nicho))}</td>
      <td>${esc(v.formato)}</td>
      <td>${esc(v.marca)}</td>
      <td>${esc(v.destaque)}</td>
      <td>${v.link ? `<a class="link-tabela" href="${esc(v.link)}" target="_blank" rel="noopener">abrir</a>` : '<span class="apagado">sem link</span>'}</td>
      <td class="acoes">
        <button type="button" class="botao-icone" data-olho aria-label="${vis ? "Esconder do site" : "Mostrar no site"}" title="${vis ? "No site. Clique para esconder" : "Escondido. Clique para mostrar"}">${vis ? ICONE.olho : ICONE.olhoFechado}</button>
        <button type="button" class="botao-icone" data-editar aria-label="Editar" title="Editar">${ICONE.lapis}</button>
        <button type="button" class="botao-icone" data-apagar aria-label="Apagar" title="Apagar">${ICONE.lixo}</button>
      </td></tr>`;
  }).join("")}</tbody>`;
}

const camposVideo = [
  { nome: "titulo", rotulo: "Título", obrigatorio: true, dica: "Ex: Unboxing do kit de verão" },
  { nome: "link", rotulo: "Link do vídeo", dica: "Link do YouTube, Reels, TikTok ou arquivo .mp4" },
  { linha: [
    { nome: "nicho", rotulo: "Nicho", tipo: "select", opcoes: [{ id: "", nome: "Sem nicho" }, ...NICHOS] },
    { nome: "formato", rotulo: "Formato", dica: "Ex: Demonstração" }
  ] },
  { linha: [
    { nome: "marca", rotulo: "Marca" },
    { nome: "destaque", rotulo: "Destaque", dica: "Ex: 2,4M views" }
  ] },
  { nome: "visivel", rotulo: "Mostrar no site", tipo: "checkbox", padrao: true }
];
function formVideo(v) {
  formulario({
    titulo: v ? "Editar vídeo" : "Novo vídeo",
    campos: camposVideo,
    valores: v || { visivel: true },
    aoSalvar: async dados => {
      if (!v) dados.ordem = Math.max(0, ...estado.videos.map(x => num(x.ordem))) + 1;
      const ok = await gravar("videos", dados, v ? v.id : null);
      if (ok) { await carregarVideos(); seguro("Portfólio", desenharPortfolio); avisoRapido("Vídeo salvo. O site já mostra a mudança."); }
      return ok;
    },
    aoApagar: v ? async () => {
      if (await apagar("videos", v.id)) { await carregarVideos(); seguro("Portfólio", desenharPortfolio); avisoRapido("Vídeo apagado."); }
    } : null
  });
}

async function salvarOrdem(ids) {
  const mudou = ids.map((id, i) => ({ id, ordem: i + 1 })).filter(x => {
    const v = estado.videos.find(y => y.id === x.id); return v && num(v.ordem) !== x.ordem;
  });
  if (!mudou.length) return;
  mudou.forEach(x => { const v = estado.videos.find(y => y.id === x.id); v.ordem = x.ordem; });
  estado.videos.sort((a, b) => num(a.ordem) - num(b.ordem));
  const resultados = await Promise.all(mudou.map(x => gravar("videos", { ordem: x.ordem }, x.id)));
  if (resultados.every(Boolean)) avisoRapido("Ordem salva. O site já mostra a nova ordem.");
  await carregarVideos();
  seguro("Portfólio", desenharTabelaVideos);
}

function ligarTabelaVideos() {
  const t = $("#tabelaVideos");
  let arrastada = null;
  t.addEventListener("pointerdown", e => { const a = e.target.closest(".alca"); if (a) a.closest("tr").draggable = true; });
  t.addEventListener("dragstart", e => {
    arrastada = e.target.closest("tr");
    if (!arrastada) return;
    arrastada.classList.add("arrastando");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", arrastada.dataset.id);
  });
  t.addEventListener("dragover", e => {
    if (!arrastada) return;
    e.preventDefault();
    const alvo = e.target.closest("tbody tr");
    if (!alvo || alvo === arrastada) return;
    const r = alvo.getBoundingClientRect();
    alvo.parentNode.insertBefore(arrastada, e.clientY > r.top + r.height / 2 ? alvo.nextSibling : alvo);
  });
  t.addEventListener("drop", e => e.preventDefault());
  t.addEventListener("dragend", () => {
    if (!arrastada) return;
    arrastada.classList.remove("arrastando");
    arrastada.draggable = false;
    arrastada = null;
    salvarOrdem($$("tbody tr[data-id]", t).map(r => Number(r.dataset.id)));
  });
  /* Pelo teclado: foco na alcinha e setas para cima ou para baixo */
  t.addEventListener("keydown", async e => {
    const a = e.target.closest(".alca");
    if (!a || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    const ids = estado.videos.map(v => v.id);
    const id = Number(a.closest("tr").dataset.id), i = ids.indexOf(id), j = e.key === "ArrowUp" ? i - 1 : i + 1;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await salvarOrdem(ids);
    const nova = $(`tr[data-id="${id}"] .alca`, t); if (nova) nova.focus();
  });
  t.addEventListener("click", async e => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    const v = estado.videos.find(x => x.id === Number(tr.dataset.id));
    if (!v) return;
    if (e.target.closest("[data-editar]")) formVideo(v);
    else if (e.target.closest("[data-apagar]")) {
      if (await confirmar(`Apagar o vídeo "${esc(v.titulo)}"? Ele sai do site e não tem como desfazer.`) && await apagar("videos", v.id)) {
        await carregarVideos(); seguro("Portfólio", desenharPortfolio); avisoRapido("Vídeo apagado.");
      }
    } else if (e.target.closest("[data-olho]")) {
      const novo = v.visivel === false;
      if (await gravar("videos", { visivel: novo }, v.id)) {
        v.visivel = novo; seguro("Portfólio", desenharPortfolio);
        avisoRapido(novo ? "Vídeo de volta no site." : "Vídeo escondido do site.");
      }
    }
  });
}

/* =========================================================
   2. MARCAS
   ========================================================= */
function marcasFiltradas() {
  const busca = $("#buscaMarcas").value.trim().toLowerCase().replace(/^@/, "");
  const sit = $("#filtroSituacao").value;
  return estado.marcas.filter(m => {
    if (sit && m.situacao !== sit) return false;
    if (!busca) return true;
    return [m.nome, m.instagram, m.email].some(c => String(c || "").toLowerCase().replace(/^@/, "").includes(busca));
  });
}
function desenharMarcas() {
  const t = $("#tabelaMarcas");
  const lista = marcasFiltradas();
  if (!estado.marcas.length) {
    t.innerHTML = `<tbody><tr><td><p class="vazio">Nenhuma marca na sua base ainda. Clique em "Adicionar marca", ou espere: quem mandar mensagem pelo formulário do site entra aqui sozinho, como Lead.</p></td></tr></tbody>`;
    return;
  }
  if (!lista.length) {
    t.innerHTML = `<tbody><tr><td><p class="vazio">Nenhuma marca encontrada com essa busca.</p></td></tr></tbody>`;
    return;
  }
  t.innerHTML = `<thead><tr><th>Marca</th><th>Instagram</th><th>E-mail</th><th>Telefone</th><th>Situação</th><th>Observação</th><th>Último contato</th></tr></thead>
  <tbody>${lista.map(m => {
    const ig = linkInstagram(m.instagram), wa = linkWhats(m.telefone);
    return `<tr data-id="${m.id}">
      <td><strong>${esc(m.nome) || '<span class="apagado">Sem nome</span>'}</strong>${pilulaExemplo(m)}</td>
      <td>${ig ? `<a class="link-tabela" href="${ig.url}" target="_blank" rel="noopener">${esc(ig.arroba)}</a>` : ""}</td>
      <td>${m.email ? `<a class="link-tabela" href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : ""}</td>
      <td style="white-space:nowrap">${esc(m.telefone)}${wa ? `<a class="whats" href="${wa}" target="_blank" rel="noopener" title="Abrir no WhatsApp">WhatsApp</a>` : ""}</td>
      <td><span class="pilula p-${esc(m.situacao)}">${esc(nomeSituacao(m.situacao))}</span></td>
      <td class="curto" title="${esc(m.obs)}">${esc(m.obs)}</td>
      <td class="apagado" style="white-space:nowrap">${dataBR(m.ultimo_contato)}</td>
    </tr>`;
  }).join("")}</tbody>
  <tfoot><tr><td colspan="7" class="apagado" style="font-size:.76rem">${plural(lista.length, "marca", "marcas")}${lista.length !== estado.marcas.length ? ` de ${estado.marcas.length}` : ""}</td></tr></tfoot>`;
}
const camposMarca = [
  { nome: "nome", rotulo: "Marca", obrigatorio: true },
  { linha: [
    { nome: "instagram", rotulo: "Instagram", dica: "@marca" },
    { nome: "email", rotulo: "E-mail", tipo: "email" }
  ] },
  { linha: [
    { nome: "telefone", rotulo: "Telefone", tipo: "tel", dica: "(16) 99999-9999" },
    { nome: "situacao", rotulo: "Situação", tipo: "select", opcoes: SITUACOES }
  ] },
  { nome: "ultimo_contato", rotulo: "Último contato", tipo: "date" },
  { nome: "obs", rotulo: "Observação", tipo: "textarea" }
];
function formMarca(m) {
  formulario({
    titulo: m ? "Editar marca" : "Nova marca",
    campos: camposMarca,
    valores: m || { situacao: "lead", ultimo_contato: hojeISO() },
    aoSalvar: async dados => {
      const ok = await gravar("marcas", dados, m ? m.id : null);
      if (ok) { await carregarMarcas(); seguro("Marcas", desenharMarcas); avisoRapido("Marca salva."); }
      return ok;
    },
    aoApagar: m ? async () => { if (await apagar("marcas", m.id)) { await carregarMarcas(); seguro("Marcas", desenharMarcas); avisoRapido("Marca apagada."); } } : null
  });
}

/* =========================================================
   3. CALENDÁRIO
   ========================================================= */
function eventos() {
  const lista = estado.calendario.map(c => ({
    id: c.id, origem: "cal", titulo: c.titulo || "Sem título", marca: c.marca || "", tipo: c.tipo || "gravar",
    data: String(c.data || "").slice(0, 10), feito: c.status === "feito", exemplo: c.exemplo
  }));
  estado.campanhas.filter(c => c.prazo).forEach(c => lista.push({
    id: c.id, origem: "camp", titulo: "Prazo: " + (c.campanha || "campanha"), marca: c.cliente || "", tipo: "prazo",
    data: String(c.prazo).slice(0, 10), feito: c.status === "Entregue", exemplo: c.exemplo
  }));
  return lista.filter(e => e.data && (estado.filtroTipo === "todos" || e.tipo === estado.filtroTipo));
}
function itemCal(e) {
  return `<button type="button" class="cal-item t-${e.tipo} ${e.feito ? "feito" : ""}" data-item="${e.origem}:${e.id}" title="${esc(e.titulo)}${e.marca ? " · " + esc(e.marca) : ""}">${esc(e.titulo)}</button>`;
}
function desenharCalendario() {
  $("#filtroTipo").innerHTML = [{ id: "todos", nome: "Todos" }, ...TIPOS_CAL, { id: "prazo", nome: "Prazos" }].map(t =>
    `<button type="button" class="chip" data-tipo="${t.id}" aria-pressed="${estado.filtroTipo === t.id}">${t.nome}</button>`).join("");
  const mes = estado.mes;
  const nomeMes = mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  $("#mesNome").textContent = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
  const porDia = new Map();
  eventos().forEach(e => { if (!porDia.has(e.data)) porDia.set(e.data, []); porDia.get(e.data).push(e); });
  porDia.forEach(l => l.sort((a, b) => a.feito - b.feito));
  const recuo = (mes.getDay() + 6) % 7; /* semana começa na segunda */
  const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const total = Math.ceil((recuo + diasNoMes) / 7) * 7;
  const hoje = hojeISO();
  let html = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => `<div class="cal-semana">${d}</div>`).join("");
  for (let i = 0; i < total; i++) {
    const d = new Date(mes.getFullYear(), mes.getMonth(), 1 - recuo + i);
    const iso = isoLocal(d), itens = porDia.get(iso) || [];
    const fora = d.getMonth() !== mes.getMonth();
    html += `<div class="cal-dia ${fora ? "fora" : ""} ${iso === hoje ? "hoje" : ""}" data-dia="${iso}">
      <span class="cal-num">${d.getDate()}</span>
      <button type="button" class="cal-mais" data-novo="${iso}" aria-label="Adicionar em ${dataBR(iso)}">${ICONE.mais}</button>
      <div class="cal-itens">${itens.slice(0, 3).map(itemCal).join("")}
      ${itens.length > 3 ? `<button type="button" class="cal-ver-mais" data-ver="${iso}">+${itens.length - 3} mais</button>` : ""}</div>
    </div>`;
  }
  $("#calendario").innerHTML = html + `<div class="legenda-cal" style="grid-column:1/-1">
    <span><i class="t-gravar"></i>Gravar</span><span><i class="t-editar"></i>Editar</span><span><i class="t-postar"></i>Postar</span><span><i class="t-prazo"></i>Prazo de campanha</span></div>`;
  desenharAtrasados();
}
function desenharAtrasados() {
  const atrasados = [];
  estado.calendario.forEach(c => { if (c.data && c.status !== "feito" && diasAte(c.data) < 0) atrasados.push({ origem: "cal", id: c.id, titulo: c.titulo, marca: c.marca, tipo: c.tipo, data: c.data, exemplo: c.exemplo }); });
  estado.campanhas.forEach(c => { if (c.prazo && c.status !== "Entregue" && diasAte(c.prazo) < 0) atrasados.push({ origem: "camp", id: c.id, titulo: "Prazo: " + (c.campanha || "campanha"), marca: c.cliente, tipo: "prazo", data: c.prazo, exemplo: c.exemplo }); });
  atrasados.sort((a, b) => String(a.data).localeCompare(String(b.data)));
  $("#atrasados").innerHTML = atrasados.length ? `<div class="lista-simples">${atrasados.map(a => {
    const dias = -diasAte(a.data);
    return `<div class="linha-item">
      <span class="pilula t-${esc(a.tipo)}">${esc(a.tipo === "prazo" ? "Prazo" : (TIPOS_CAL.find(t => t.id === a.tipo) || {}).nome || a.tipo)}</span>
      <span class="cresce"><strong>${esc(a.titulo)}</strong>${a.marca ? ` <small>· ${esc(a.marca)}</small>` : ""}${pilulaExemplo(a)}</span>
      <small>${dataBR(a.data)}, há ${plural(dias, "dia", "dias")}</small>
      ${a.origem === "cal"
        ? `<button type="button" class="botao contorno" data-feito="${a.id}">Marcar feito</button>`
        : `<button type="button" class="botao contorno" data-item="camp:${a.id}">Abrir campanha</button>`}
    </div>`;
  }).join("")}</div>` : `<p class="vazio">Nada ficou pra trás. Tudo em dia.</p>`;
}
const camposItem = [
  { nome: "titulo", rotulo: "O que fazer", obrigatorio: true, dica: "Ex: Gravar unboxing" },
  { nome: "marca", rotulo: "Marca" },
  { linha: [
    { nome: "tipo", rotulo: "Tipo", tipo: "select", opcoes: TIPOS_CAL },
    { nome: "data", rotulo: "Data", tipo: "date", obrigatorio: true }
  ] },
  { nome: "status", rotulo: "Situação", tipo: "select", opcoes: [{ id: "a fazer", nome: "A fazer" }, { id: "feito", nome: "Feito" }] }
];
function formItem(item, dataInicial) {
  formulario({
    titulo: item ? "Editar no calendário" : "Adicionar no calendário",
    campos: camposItem,
    valores: item || { tipo: estado.filtroTipo !== "todos" && estado.filtroTipo !== "prazo" ? estado.filtroTipo : "gravar", data: dataInicial || hojeISO(), status: "a fazer" },
    aoSalvar: async dados => {
      const ok = await gravar("calendario", dados, item ? item.id : null);
      if (ok) { await carregarCalendario(); seguro("Calendário", desenharCalendario); avisoRapido("Salvo no calendário."); }
      return ok;
    },
    aoApagar: item ? async () => { if (await apagar("calendario", item.id)) { await carregarCalendario(); seguro("Calendário", desenharCalendario); avisoRapido("Apagado do calendário."); } } : null
  });
}
function abrirItem(chave) {
  const [origem, id] = chave.split(":");
  if (origem === "cal") { const c = estado.calendario.find(x => String(x.id) === id); if (c) formItem(c); }
  else { const c = estado.campanhas.find(x => String(x.id) === id); if (c) formCampanha(c); }
}
function abrirDia(iso) {
  const itens = eventos().filter(e => e.data === iso);
  const corpo = abrirJanela(new Date(iso + "T12:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }),
    `<div class="lista-simples">${itens.map(e => `<div class="linha-item">
      <span class="pilula t-${esc(e.tipo)}">${e.tipo === "prazo" ? "Prazo" : esc((TIPOS_CAL.find(t => t.id === e.tipo) || {}).nome || e.tipo)}</span>
      <span class="cresce" style="${e.feito ? "text-decoration:line-through;opacity:.6" : ""}">${esc(e.titulo)}${e.marca ? ` <small>· ${esc(e.marca)}</small>` : ""}</span>
      <button type="button" class="botao contorno" data-item="${e.origem}:${e.id}">Abrir</button></div>`).join("")}</div>
    <div class="form-botoes"><button type="button" class="botao" data-novo="${iso}">${ICONE.mais}Adicionar neste dia</button></div>`);
  corpo.onclick = e => {
    const b = e.target.closest("[data-item]"); if (b) { abrirItem(b.dataset.item); return; }
    const n = e.target.closest("[data-novo]"); if (n) formItem(null, n.dataset.novo);
  };
}
function ligarCalendario() {
  $("#calendario").addEventListener("click", e => {
    const item = e.target.closest("[data-item]"); if (item) { abrirItem(item.dataset.item); return; }
    const ver = e.target.closest("[data-ver]"); if (ver) { abrirDia(ver.dataset.ver); return; }
    const novo = e.target.closest("[data-novo]"); if (novo) { formItem(null, novo.dataset.novo); return; }
    const dia = e.target.closest("[data-dia]"); if (dia) formItem(null, dia.dataset.dia);
  });
  $("#atrasados").addEventListener("click", async e => {
    const f = e.target.closest("[data-feito]");
    if (f) { if (await gravar("calendario", { status: "feito" }, Number(f.dataset.feito))) { await carregarCalendario(); seguro("Calendário", desenharCalendario); avisoRapido("Marcado como feito."); } return; }
    const i = e.target.closest("[data-item]"); if (i) abrirItem(i.dataset.item);
  });
  $("#filtroTipo").addEventListener("click", e => { const c = e.target.closest("[data-tipo]"); if (c) { estado.filtroTipo = c.dataset.tipo; seguro("Calendário", desenharCalendario); } });
  $("#mesAnterior").onclick = () => { estado.mes = new Date(estado.mes.getFullYear(), estado.mes.getMonth() - 1, 1); seguro("Calendário", desenharCalendario); };
  $("#mesSeguinte").onclick = () => { estado.mes = new Date(estado.mes.getFullYear(), estado.mes.getMonth() + 1, 1); seguro("Calendário", desenharCalendario); };
  $("#esteMes").onclick = () => { estado.mes = inicioDoMes(new Date()); seguro("Calendário", desenharCalendario); };
  $("#novoItem").onclick = () => formItem(null);
}

/* =========================================================
   4. CAMPANHAS
   ========================================================= */
const COLUNAS = [
  { id: "favorita", rotulo: "", titulo: "Favorita" },
  { id: "campanha", rotulo: "Campanha" },
  { id: "cliente", rotulo: "Cliente" },
  { id: "tipo", rotulo: "Tipo" },
  { id: "status", rotulo: "Status" },
  { id: "qtd", rotulo: "Qtd", num: true },
  { id: "valor", rotulo: "Valor", num: true },
  { id: "prazo", rotulo: "Prazo" },
  { id: "pagamento", rotulo: "Pagamento" }
];
function comparar(col, a, b) {
  if (col === "status") return FUNIL.indexOf(a.status) - FUNIL.indexOf(b.status);
  if (col === "qtd" || col === "valor") return num(a[col]) - num(b[col]);
  if (col === "favorita") return (a.favorita ? 1 : 0) - (b.favorita ? 1 : 0);
  return String(a[col] || "").localeCompare(String(b[col] || ""), "pt-BR", { sensitivity: "base" });
}
function campanhasVisiveis() {
  const busca = $("#buscaCampanhas").value.trim().toLowerCase();
  const { col, dir } = estado.ordem;
  return estado.campanhas
    .filter(c => estado.filtroCampanhas === "todas" || (estado.filtroCampanhas === "ativas" ? c.ativa !== false : c.ativa === false))
    .filter(c => !busca || [c.campanha, c.cliente].some(x => String(x || "").toLowerCase().includes(busca)))
    .sort((a, b) => {
      if (col === "prazo") { /* sem prazo vai sempre pro fim */
        if (!a.prazo && !b.prazo) return 0;
        if (!a.prazo) return 1;
        if (!b.prazo) return -1;
      }
      return comparar(col, a, b) * dir || num(a.id) - num(b.id);
    });
}
function avisoPrazo(c) {
  if (!c.prazo || c.status === "Entregue") return "";
  const d = diasAte(c.prazo);
  if (d < 0) return `<span class="pilula p-atrasado">atrasado ${plural(-d, "dia", "dias")}</span>`;
  if (d <= 3) return `<span class="pilula p-vence">${d === 0 ? "vence hoje" : d === 1 ? "vence amanhã" : `vence em ${d} dias`}</span>`;
  return "";
}
function desenharCampanhas() {
  const reais = estado.campanhas.filter(c => !c.exemplo);
  const valorTotal = reais.reduce((s, c) => s + num(c.valor), 0);
  const qtdTotal = reais.reduce((s, c) => s + num(c.qtd), 0);
  const ticket = qtdTotal > 0 ? valorTotal / qtdTotal : 0;
  const receber = reais.filter(c => c.pagamento !== "pago").reduce((s, c) => s + num(c.valor), 0);
  const recebido = reais.filter(c => c.pagamento === "pago").reduce((s, c) => s + num(c.valor), 0);
  $("#numerosCampanhas").innerHTML = [
    ["Campanhas", reais.length, ""],
    ["Ativas", reais.filter(c => c.ativa !== false).length, ""],
    ["Valor total", dinheiro(valorTotal), qtdTotal > 0 ? `ticket médio ${dinheiro(ticket)} por vídeo` : "ticket médio aparece com o 1º vídeo"],
    ["A receber", dinheiro(receber), `já recebido ${dinheiro(recebido)}`]
  ].map(([r, v, s]) => `<div class="numero"><span>${r}</span><strong>${esc(v)}</strong>${s ? `<small>${esc(s)}</small>` : ""}</div>`).join("");

  $("#filtroCampanhas").innerHTML = [["todas", "Todas"], ["ativas", "Ativas"], ["finalizadas", "Finalizadas"]].map(([id, n]) =>
    `<button type="button" class="chip" data-filtro="${id}" aria-pressed="${estado.filtroCampanhas === id}">${n}</button>`).join("");

  const t = $("#tabelaCampanhas");
  if (!estado.campanhas.length) {
    t.innerHTML = `<tbody><tr><td><p class="vazio">Nenhuma campanha ainda. Clique em "Adicionar campanha" para cadastrar a primeira.</p></td></tr></tbody>`;
    return;
  }
  const lista = campanhasVisiveis();
  const { col, dir } = estado.ordem;
  t.innerHTML = `<thead><tr>${COLUNAS.map(c => {
    const ativa = c.id === col;
    return `<th class="${c.num ? "num" : ""}" aria-sort="${ativa ? (dir > 0 ? "ascending" : "descending") : "none"}">
      <button type="button" class="ordenar ${ativa ? "ativa" : ""}" data-col="${c.id}" title="Ordenar por ${c.titulo || c.rotulo}">${c.id === "favorita" ? ICONE.estrela.replace("<svg", '<svg style="width:13px;height:13px"') : c.rotulo}
      <span class="seta" aria-hidden="true">${ativa ? (dir > 0 ? "▲" : "▼") : "↕"}</span></button></th>`;
  }).join("")}</tr></thead>
  <tbody>${lista.length ? lista.map(c => {
    const iStatus = FUNIL.indexOf(c.status);
    return `<tr data-id="${c.id}" class="${c.favorita ? "favorita" : ""}">
      <td><button type="button" class="estrela ${c.favorita ? "ligada" : ""}" data-estrela aria-label="${c.favorita ? "Tirar destaque" : "Destacar"}" aria-pressed="${!!c.favorita}">${ICONE.estrela}</button></td>
      <td><strong>${esc(c.campanha) || '<span class="apagado">Sem nome</span>'}</strong>${pilulaExemplo(c)}${c.ativa === false ? ' <span class="pilula">finalizada</span>' : ""}</td>
      <td>${esc(c.cliente)}</td>
      <td><span class="pilula ${c.tipo === "Publicidade" ? "p-publicidade" : "p-conteudo"}">${esc(c.tipo)}</span></td>
      <td><span class="pilula s-${iStatus < 0 ? 0 : iStatus}">${esc(c.status)}</span></td>
      <td class="num">${num(c.qtd)}</td>
      <td class="num">${dinheiro(c.valor)}</td>
      <td style="white-space:nowrap">${c.prazo ? dataBR(c.prazo) : '<span class="apagado">sem prazo</span>'}${avisoPrazo(c)}</td>
      <td><span class="pilula ${c.pagamento === "pago" ? "p-pago" : "p-pendente"}">${c.pagamento === "pago" ? "Pago" : "Pendente"}</span></td>
    </tr>`;
  }).join("") : `<tr><td colspan="9"><p class="vazio">Nenhuma campanha com esse filtro.</p></td></tr>`}</tbody>`;
}
const camposCampanha = [
  { nome: "campanha", rotulo: "Campanha", obrigatorio: true },
  { nome: "cliente", rotulo: "Cliente" },
  { linha: [
    { nome: "tipo", rotulo: "Tipo", tipo: "select", opcoes: [{ id: "Conteúdo", nome: "Conteúdo" }, { id: "Publicidade", nome: "Publicidade" }] },
    { nome: "status", rotulo: "Status", tipo: "select", opcoes: FUNIL.map(s => ({ id: s, nome: s })) }
  ] },
  { linha: [
    { nome: "qtd", rotulo: "Quantidade de vídeos", tipo: "number" },
    { nome: "valor", rotulo: "Valor total (R$)", tipo: "number", passo: "0.01" }
  ] },
  { linha: [
    { nome: "prazo", rotulo: "Prazo", tipo: "date" },
    { nome: "pagamento", rotulo: "Pagamento", tipo: "select", opcoes: [{ id: "pendente", nome: "Pendente" }, { id: "pago", nome: "Pago" }] }
  ] },
  { nome: "ativa", rotulo: "Campanha ativa (desmarque quando finalizar)", tipo: "checkbox", padrao: true },
  { nome: "favorita", rotulo: "Destacar com estrela", tipo: "checkbox" }
];
function formCampanha(c) {
  formulario({
    titulo: c ? "Editar campanha" : "Nova campanha",
    campos: camposCampanha,
    valores: c || { tipo: "Conteúdo", status: "Briefing", qtd: 1, valor: 0, pagamento: "pendente", ativa: true, favorita: false },
    aoSalvar: async dados => {
      const ok = await gravar("campanhas", dados, c ? c.id : null);
      if (ok) { await carregarCampanhas(); seguro("Campanhas", desenharCampanhas); seguro("Calendário", desenharCalendario); avisoRapido("Campanha salva."); }
      return ok;
    },
    aoApagar: c ? async () => { if (await apagar("campanhas", c.id)) { await carregarCampanhas(); seguro("Campanhas", desenharCampanhas); seguro("Calendário", desenharCalendario); avisoRapido("Campanha apagada."); } } : null
  });
}
function ligarCampanhas() {
  $("#filtroCampanhas").addEventListener("click", e => { const b = e.target.closest("[data-filtro]"); if (b) { estado.filtroCampanhas = b.dataset.filtro; seguro("Campanhas", desenharCampanhas); } });
  $("#buscaCampanhas").addEventListener("input", () => seguro("Campanhas", desenharCampanhas));
  $("#tabelaCampanhas").addEventListener("click", async e => {
    const o = e.target.closest("[data-col]");
    if (o) {
      const col = o.dataset.col;
      estado.ordem = estado.ordem.col === col ? { col, dir: -estado.ordem.dir } : { col, dir: col === "favorita" ? -1 : 1 };
      seguro("Campanhas", desenharCampanhas);
      return;
    }
    const tr = e.target.closest("tr[data-id]"); if (!tr) return;
    const c = estado.campanhas.find(x => String(x.id) === tr.dataset.id); if (!c) return;
    if (e.target.closest("[data-estrela]")) {
      const novo = !c.favorita;
      if (await gravar("campanhas", { favorita: novo }, c.id)) { c.favorita = novo; seguro("Campanhas", desenharCampanhas); }
      return;
    }
    formCampanha(c);
  });
  $("#novaCampanha").onclick = () => formCampanha(null);
  $("#baixarCampanhas").onclick = () => baixarCSV("campanhas",
    ["Campanha", "Cliente", "Tipo", "Status", "Qtd", "Valor", "Prazo", "Pagamento", "Ativa", "Favorita"],
    campanhasVisiveis().map(c => [c.campanha, c.cliente, c.tipo, c.status, num(c.qtd), valorCSV(c.valor), dataBR(c.prazo),
      c.pagamento === "pago" ? "Pago" : "Pendente", c.ativa === false ? "Não" : "Sim", c.favorita ? "Sim" : "Não"]));
}

/* =========================================================
   5. CHECKLIST DO PORTFÓLIO (conteúdo da js/biblioteca.js)
   ========================================================= */
const SUBABAS = [
  { id: "checklist", nome: "Checklist do portfólio" },
  { id: "referencias", nome: "Referências de vídeo" },
  { id: "roteiros", nome: "Roteiros" },
  { id: "nichos", nome: "Ideias por nicho" },
  { id: "revisar", nome: "Revisar meu roteiro" }
];
function barra(feitos, total) {
  const p = total > 0 ? Math.round(feitos / total * 100) : 0;
  return `<div class="progresso"><span class="trilho"><i style="width:${p}%"></i></span><span>${feitos} de ${total}</span></div>`;
}
function desenharChecklist() {
  $("#subabas").innerHTML = SUBABAS.map(s =>
    `<button type="button" class="subaba" role="tab" data-sub="${s.id}" aria-selected="${estado.subaba === s.id}">${s.nome}</button>`).join("");
  const alvo = $("#conteudoChecklist");
  if (!BIB) {
    alvo.innerHTML = `<p class="vazio">Não consegui carregar o conteúdo do checklist (arquivo js/biblioteca.js). Recarregue a página.</p>`;
    return;
  }
  const quadro = { checklist: subChecklist, referencias: subReferencias, roteiros: subRoteiros, nichos: subNichos, revisar: subRevisar }[estado.subaba];
  alvo.innerHTML = quadro();
  if (estado.subaba === "revisar") {
    const ta = $("#textoRoteiro");
    try { ta.value = localStorage.getItem("jp_roteiro") || ""; } catch (e) {}
    ta.addEventListener("input", () => { try { localStorage.setItem("jp_roteiro", ta.value); } catch (e) {} });
  }
}
function subChecklist() {
  const secoes = BIB.CHECKLIST || [];
  let feitosGeral = 0, totalGeral = 0;
  const html = secoes.map(s => {
    const chaves = s.itens.map((_, i) => `check:${s.id}:${i}`);
    const feitos = chaves.filter(k => estado.marcados.has(k)).length;
    feitosGeral += feitos; totalGeral += chaves.length;
    return `<details class="secao-check" data-secao="${esc(s.id)}" ${estado.abertos.has(s.id) ? "open" : ""}>
      <summary><span class="emoji" aria-hidden="true">${s.emoji}</span><span><strong>${esc(s.nome)}</strong><small>${esc(s.resumo)}</small></span>
        ${barra(feitos, chaves.length)}<svg class="seta" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></summary>
      <div class="corpo"><p class="porque"><strong>Por que:</strong> ${esc(s.porque)}</p>
        ${s.itens.map((it, i) => {
          const k = chaves[i], m = estado.marcados.has(k);
          return `<label class="item-check ${m ? "feito" : ""}"><input type="checkbox" data-chave="${k}" ${m ? "checked" : ""}><span>${esc(it.t)}</span><small>${esc(it.d)}</small></label>`;
        }).join("")}
      </div></details>`;
  }).join("");
  return `<div class="cartao"><div class="cartao-topo"><h2>O seu portfólio está ${totalGeral ? Math.round(feitosGeral / totalGeral * 100) : 0}% pronto</h2></div>${barra(feitosGeral, totalGeral)}</div>
    <div class="aba" style="gap:10px">${html}</div>`;
}
function capaRef(url) {
  const id = idYoutube(url);
  return id ? `<img src="https://i.ytimg.com/vi/${id}/oar2.jpg" alt="" loading="lazy" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${id}/hqdefault.jpg'" onload="if(this.naturalWidth<400&&!/hqdefault/.test(this.src))this.src='https://i.ytimg.com/vi/${id}/hqdefault.jpg'">` : "";
}
function subReferencias() {
  return `<div class="grade-ref">${(BIB.REFERENCIAS || []).map((r, i) => `
    <button type="button" class="ref" data-ref="${i}">
      <span class="ref-capa">${capaRef(r.youtube)}<span class="emoji" aria-hidden="true">${r.emoji}</span><span class="dur">${esc(r.duracao)}</span></span>
      <span class="ref-info"><strong>${esc(r.titulo)}</strong><small>${esc(r.estilo)} · ${esc(r.marca)}</small></span>
    </button>`).join("")}</div>`;
}
function blocos(lista) {
  return `<div class="blocos">${(lista || []).map(b => `<div class="bloco"><span class="tempo">${esc(b.t)}</span><span>${b.o}</span></div>`).join("")}</div>`;
}
function abrirReferencia(i) {
  const r = (BIB.REFERENCIAS || [])[i]; if (!r) return;
  abrirJanela(`${r.emoji} ${r.titulo}`, `<div class="ficha">
    <div class="chips"><span class="pilula">${esc(r.estilo)}</span><span class="pilula">${esc(r.audiencia)}</span><span class="pilula">${esc(r.duracao)}</span><span class="pilula">${esc(r.marca)}</span></div>
    <h3>O gancho</h3><p class="gancho">${esc(r.gancho)}</p>
    <h3>Por que funciona</h3><p>${esc(r.porque)}</p>
    <h3>O diferencial</h3><p>${esc(r.diferencial)}</p>
    <h3>O erro comum</h3><p>${esc(r.erro)}</p>
    <h3>O roteiro</h3>${blocos(r.roteiro)}
    <div class="form-botoes"><a class="botao" href="${esc(r.youtube)}" target="_blank" rel="noopener">${ICONE.abrir}Assistir</a></div>
  </div>`, true);
}
function subRoteiros() {
  return `<div class="aba" style="gap:10px">${(BIB.TIPOS || []).map(t => `
    <details class="secao-check" data-secao="tipo-${esc(t.id)}" ${estado.abertos.has("tipo-" + t.id) ? "open" : ""}>
      <summary style="grid-template-columns:auto 1fr auto"><span class="emoji" aria-hidden="true">${t.emoji}</span><span><strong>${esc(t.nome)}</strong><small>${esc(t.duracao)}</small></span>
        <svg class="seta" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></summary>
      <div class="corpo ficha">
        <p class="porque"><strong>Quando usar:</strong> ${esc(t.porque)}</p>
        <h3>Os blocos de tempo</h3>${blocos(t.beats)}
        ${t.erros && t.erros.length ? `<h3>Erros comuns</h3><ul class="lista-erros">${t.erros.map(e => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
      </div></details>`).join("")}</div>`;
}
function subNichos() {
  const como = BIB.COMO_USAR || [];
  return `${como.length ? `<div class="cartao"><h2>Como usar os ganchos</h2><ul class="lista-erros">${como.map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
    <div class="grade-nichos">${(BIB.NICHOS || []).map(n => `
      <div class="cartao"><h2><span aria-hidden="true">${n.emoji}</span> ${esc(n.nome)}</h2>
        ${n.ideias.map(i => `<div class="ideia"><strong>${esc(i.t)}</strong><small>"${esc(i.gancho)}"</small></div>`).join("")}
      </div>`).join("")}</div>`;
}
function subRevisar() {
  const blocosRev = BIB.REVISAO || [];
  let feitos = 0, total = 0;
  const html = blocosRev.map((b, bi) => {
    const chaves = b.itens.map((_, i) => `revisao:${bi}:${i}`);
    const f = chaves.filter(k => estado.marcados.has(k)).length; feitos += f; total += chaves.length;
    return `<div class="cartao"><div class="cartao-topo"><h2><span aria-hidden="true">${b.emoji}</span> ${esc(b.bloco)}</h2><small class="apagado">${f} de ${chaves.length}</small></div>
      ${b.itens.map((it, i) => { const k = chaves[i], m = estado.marcados.has(k);
        return `<label class="item-check ${m ? "feito" : ""}"><input type="checkbox" data-chave="${k}" ${m ? "checked" : ""}><span>${esc(it.t)}</span><small>${esc(it.d)}</small></label>`; }).join("")}
    </div>`;
  }).join("");
  return `<div class="revisao">
    <div class="cartao"><div class="cartao-topo"><h2>Cole o seu roteiro</h2><button type="button" class="botao contorno" id="limparRevisao">Começar revisão nova</button></div>
      <p class="dica">O texto fica guardado neste navegador enquanto você revisa.</p>
      <textarea id="textoRoteiro" aria-label="Seu roteiro" placeholder="Cole aqui o roteiro que você quer revisar."></textarea></div>
    <div class="aba" style="gap:10px"><div class="cartao">${barra(feitos, total)}</div>${html}</div>
  </div>`;
}
async function marcar(chave, ligado) {
  if (ligado) estado.marcados.add(chave); else estado.marcados.delete(chave);
  seguro("Checklist", desenharChecklist);
  if (!db) return;
  try {
    const q = ligado ? db.from("marcados").upsert({ chave }) : db.from("marcados").delete().eq("chave", chave);
    const { error } = await q;
    if (error) throw error;
  } catch (erro) {
    if (ligado) estado.marcados.delete(chave); else estado.marcados.add(chave);
    seguro("Checklist", desenharChecklist);
    avisoRapido(semTags(explicarErro("marcados", erro)), true);
  }
}
function ligarChecklist() {
  $("#subabas").addEventListener("click", e => { const b = e.target.closest("[data-sub]"); if (b) { estado.subaba = b.dataset.sub; seguro("Checklist", desenharChecklist); } });
  const c = $("#conteudoChecklist");
  c.addEventListener("change", e => { const i = e.target.closest("[data-chave]"); if (i) marcar(i.dataset.chave, i.checked); });
  c.addEventListener("toggle", e => { const d = e.target.closest("details[data-secao]"); if (d) { if (d.open) estado.abertos.add(d.dataset.secao); else estado.abertos.delete(d.dataset.secao); } }, true);
  c.addEventListener("click", async e => {
    const r = e.target.closest("[data-ref]"); if (r) { abrirReferencia(Number(r.dataset.ref)); return; }
    if (e.target.closest("#limparRevisao")) {
      if (!(await confirmar("Desmarcar todos os itens da revisão e apagar o texto colado?", "Começar de novo"))) return;
      const chaves = [...estado.marcados].filter(k => k.startsWith("revisao:"));
      chaves.forEach(k => estado.marcados.delete(k));
      try { localStorage.removeItem("jp_roteiro"); } catch (er) {}
      seguro("Checklist", desenharChecklist);
      if (db && chaves.length) { try { await db.from("marcados").delete().in("chave", chaves); } catch (er) {} }
    }
  });
}

/* =========================================================
   TESTAR A TRANCA: entra como visitante (sem login) e tenta ler tudo
   ========================================================= */
async function testarTranca() {
  const corpo = abrirJanela("Testando a tranca...", `<p class="vazio">Entrando como uma visitante qualquer, sem login, e tentando ler cada tabela...</p>`);
  const visitante = window.bancoVisitante && window.bancoVisitante();
  if (!visitante) { corpo.innerHTML = `<p class="vazio">Não consegui carregar a conexão com o banco.</p>`; return; }
  const tabelas = [["marcas", "Marcas"], ["calendario", "Calendário"], ["campanhas", "Campanhas"], ["marcados", "Checklist"], ["visitas", "Visitas"], ["videos", "Vídeos"]];
  const linhas = [];
  let tudoCerto = true;
  for (const [t, nome] of tabelas) {
    let res;
    try { res = await visitante.from(t).select("*").limit(50); } catch (e) { res = { error: e }; }
    const meus = t === "marcados" ? estado.marcados.size : (estado[t] || []).length;
    let txt, cls;
    if (res.error) {
      const faltou = /PGRST205|42P01/.test(res.error.code || "") || /could not find|does not exist/i.test(res.error.message || "");
      if (faltou) { txt = "a tabela ainda não existe"; cls = "p-pendente"; }
      else { txt = "trancada: visitante não lê nada"; cls = "p-pago"; }
    } else if (t === "videos") {
      const escondidos = (res.data || []).filter(v => v.visivel === false).length;
      if (escondidos) { txt = "PROBLEMA: visitante vê vídeo escondido"; cls = "p-atrasado"; tudoCerto = false; }
      else { txt = `certo: visitante só vê os ${(res.data || []).length} vídeos do site`; cls = "p-pago"; }
    } else if ((res.data || []).length > 0) {
      txt = "ABERTA: visitante consegue ler!"; cls = "p-atrasado"; tudoCerto = false;
    } else if (meus > 0) {
      txt = `trancada: você tem ${meus}, visitante vê 0`; cls = "p-pago";
    } else {
      txt = "sem dados para testar ainda"; cls = "p-pendente";
    }
    linhas.push(`<div class="linha-item"><span class="cresce"><strong>${nome}</strong></span><span class="pilula ${cls}" style="margin:0">${txt}</span></div>`);
  }
  $("#janelaTitulo").textContent = tudoCerto ? "A tranca está funcionando" : "Atenção: tem tabela aberta";
  corpo.innerHTML = `<p class="dica">Este teste entra como alguém que nunca fez login e tenta ler cada tabela.</p><div class="lista-simples">${linhas.join("")}</div>`;
}

/* =========================================================
   LIGAÇÕES DE BOTÕES
   ========================================================= */
function ligarEventos() {
  $$(".menu-item").forEach(b => b.addEventListener("click", () => irPara(b.dataset.aba)));
  $("#abrirMenu").onclick = () => gaveta(!$("#menu").classList.contains("aberto"));
  $("#menuSombra").onclick = () => gaveta(false);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#menu").classList.contains("aberto")) gaveta(false); });
  window.addEventListener("hashchange", () => irPara(location.hash.slice(1)));
  $("#sair").onclick = async () => { try { await db.auth.signOut(); } catch (e) {} location.replace("../login/"); };
  $("#testarTranca").onclick = testarTranca;
  $("#novoVideo").onclick = () => formVideo(null);
  $("#novaMarca").onclick = () => formMarca(null);
  $("#buscaMarcas").addEventListener("input", () => seguro("Marcas", desenharMarcas));
  $("#filtroSituacao").addEventListener("change", () => seguro("Marcas", desenharMarcas));
  $("#tabelaMarcas").addEventListener("click", e => {
    if (e.target.closest("a,button")) return; /* links do Instagram, e-mail e WhatsApp abrem sozinhos */
    const tr = e.target.closest("tr[data-id]"); if (!tr) return;
    const m = estado.marcas.find(x => String(x.id) === tr.dataset.id); if (m) formMarca(m);
  });
  $("#baixarMarcas").onclick = () => baixarCSV("marcas",
    ["Marca", "Instagram", "E-mail", "Telefone", "Situação", "Observação", "Último contato", "Cadastrada em"],
    estado.marcas.map(m => [m.nome, m.instagram, m.email, m.telefone, nomeSituacao(m.situacao), m.obs, dataBR(m.ultimo_contato), m.criado_em ? dataBR(isoLocal(new Date(m.criado_em))) : ""]));
  ligarTabelaVideos();
  ligarCalendario();
  ligarCampanhas();
  ligarChecklist();
}

/* =========================================================
   COMEÇO: a primeira coisa é conferir o login
   ========================================================= */
(async function iniciar() {
  if (!db) {
    document.documentElement.classList.remove("trancado");
    aviso("conexao", "<strong>Não consegui carregar a conexão com o banco.</strong> Confira a internet e recarregue a página.", "erro");
    return;
  }
  let sessao = null;
  try { const r = await db.auth.getSession(); sessao = r && r.data ? r.data.session : null; } catch (e) { sessao = null; }
  if (!sessao) { location.replace("../login/"); return; }

  document.documentElement.classList.remove("trancado");
  try { localStorage.setItem("jp_nao_contar", "1"); } catch (e) {} /* as suas visitas ao site não entram nas métricas */
  $("#meuEmail").textContent = (sessao.user && sessao.user.email) || "";
  db.auth.onAuthStateChange(evento => { if (evento === "SIGNED_OUT") location.replace("../login/"); });

  ligarEventos();
  irPara(location.hash.slice(1) || "portfolio");
  desenharTudo(); /* desenha vazio na hora, sem esperar o banco */
  await carregarTudo();
  desenharTudo();
})();

/* Para recarregar tudo à mão, se precisar */
window.Painel = { recarregar: async () => { await carregarTudo(); desenharTudo(); }, estado };

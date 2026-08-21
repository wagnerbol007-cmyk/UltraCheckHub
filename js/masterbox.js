// js/masterbox.js
import { state, normalizarCodigo } from './state.js';
import { database } from './firebase.js';
import { mudarTela } from './ui.js';

let masterAtual = null;
let modoEdicaoMaster = false;

function gerarCodigoMaster() {
    return `MS${state.lojaAtual}${Date.now().toString().slice(-6)}`;
}

function buscarProduto(codigo) {
    const cod = normalizarCodigo(codigo);
    if (state.dbSap && state.dbSap[cod]) return state.dbSap[cod];

    const encontrado = state.sapCompleto.find(p => {
        const sku = normalizarCodigo(p.Material || p.SKU || "");
        const ean = normalizarCodigo(p.EAN || "");
        return sku === cod || ean === cod;
    });

    return encontrado || null;
}

function getSku(produto, codigo) {
    return normalizarCodigo(produto.Material || produto.SKU || codigo);
}

function getDescricao(produto) {
    return produto["Descrição material"] || produto["Texto breve material"] || "Produto sem descrição";
}

function getTamanho(produto) {
    return produto.Tamanho || produto.TAM || produto.Tam || "";
}

function atualizarTotaisMaster() {
    const itens = Object.values(masterAtual?.itens || {});
    const totalSkus = itens.length;
    const totalItens = itens.reduce((s, i) => s + Number(i.quantidade || 0), 0);

    const elItens = document.getElementById("totalItensMaster");
    const elSkus = document.getElementById("totalSkusMaster");

    if (elItens) elItens.innerText = totalItens;
    if (elSkus) elSkus.innerText = totalSkus;
}

function atualizarBotoesModo() {
    const btnEditar = document.getElementById("btnEditarMaster");
    const btnSalvar = document.getElementById("btnSalvarMaster");

    if (btnEditar) btnEditar.style.display = modoEdicaoMaster ? "none" : "block";
    if (btnSalvar) btnSalvar.style.display = modoEdicaoMaster ? "block" : "none";
}

function renderMaster() {
    if (!masterAtual) return;

    const titulo = document.getElementById("tituloMasterCriar");
    const lista = document.getElementById("listaItensMaster");

    if (titulo) titulo.innerText = `MASTER: ${masterAtual.codigo}`;
    if (!lista) return;

    const itens = Object.values(masterAtual.itens || {});
    atualizarTotaisMaster();
    atualizarBotoesModo();

    lista.innerHTML = "";

    if (itens.length === 0) {
        lista.innerHTML = `<p style="color:#64748b; text-align:center;">Caixa vazia.</p>`;
        return;
    }

    itens.forEach(item => {
        const div = document.createElement("div");
        div.style.cssText = `
            display:flex; gap:12px; align-items:center; background:#f8fafc;
            border:1px solid #e2e8f0; border-radius:14px; padding:10px; margin-bottom:8px;
        `;

        div.innerHTML = `
            <img src="https://imgcentauro-a.akamaihd.net/100x100/${item.sku.substring(0,8)}.jpg"
                style="width:50px;height:50px;border-radius:10px;object-fit:contain;background:white;border:1px solid #cbd5e1;">

            <div style="flex:1;">
                <b style="color:#0f172a; font-size: 0.9em;">${item.sku}</b><br>
                <span style="font-size:0.75em;color:#475569; display:block; line-height:1.2; margin-top:2px;">${item.descricao}</span>
                <span style="font-size:0.75em;color:#2563eb; font-weight:800;">Tam: ${item.tamanho || "--"}</span>
            </div>

            ${
                modoEdicaoMaster
                ? `
                    <div style="text-align:center; display:flex; align-items:center; gap:5px;">
                        <button onclick="app.alterarQtdMaster('${item.sku}', -1)" style="border:none;background:#fee2e2;color:#991b1b;border-radius:6px;width:28px;height:28px; font-weight:bold;">−</button>
                        <div style="font-weight:900; font-size:1.1em; width:20px;">${item.quantidade}</div>
                        <button onclick="app.alterarQtdMaster('${item.sku}', 1)" style="border:none;background:#dcfce7;color:#166534;border-radius:6px;width:28px;height:28px; font-weight:bold;">+</button>
                    </div>
                    <button onclick="app.removerItemMaster('${item.sku}')" style="border:none;background:#ef4444;color:white;border-radius:8px;width:30px;height:30px; margin-left:5px; font-weight:bold;">X</button>
                `
                : `
                    <div style="font-weight:900;color:#2563eb; font-size:1.2em; background:#eff6ff; padding:8px 12px; border-radius:10px;">
                        ${item.quantidade}
                    </div>
                `
            }
        `;
        lista.appendChild(div);
    });
}

export function abrirCriarMasterBox() {
    masterAtual = {
        codigo: gerarCodigoMaster(),
        loja: state.lojaAtual,
        criadoPor: state.operador || "DESCONHECIDO",
        criadoEm: new Date().toLocaleString("pt-BR"),
        atualizadoEm: new Date().toLocaleString("pt-BR"),
        itens: {}
    };
    modoEdicaoMaster = true;
    mudarTela("viewMasterCriar");
    renderMaster();
}

export function abrirConsultarMasterBox() { mudarTela("viewMasterConsultar"); }
export function abrirBuscarItemMasterBox() { mudarTela("viewMasterBuscar"); }

export function editarMasterAtual() {
    if (!masterAtual) return alert("Abra uma Master primeiro.");
    modoEdicaoMaster = true;
    renderMaster();
}

export function biparItemMaster() {
    const input = document.getElementById("inputBipMaster");
    const codigo = input.value.trim();

    if (!masterAtual) return alert("Crie ou consulte uma Master primeiro.");
    if (!modoEdicaoMaster) {
        alert("Clique em EDITAR MASTER antes de alterar esta caixa.");
        input.value = ""; return input.focus();
    }
    if (!codigo) return;

    const produto = buscarProduto(codigo);
    if (!produto) {
        alert("Produto não encontrado no SAP.");
        input.value = ""; return input.focus();
    }

    const sku = getSku(produto, codigo);

    if (!masterAtual.itens[sku]) {
        masterAtual.itens[sku] = {
            sku,
            ean: produto.EAN || "",
            descricao: getDescricao(produto),
            tamanho: getTamanho(produto),
            quantidade: 0
        };
    }

    masterAtual.itens[sku].quantidade += 1;
    masterAtual.atualizadoEm = new Date().toLocaleString("pt-BR");
    input.value = "";
    input.focus();
    renderMaster();
}

export function alterarQtdMaster(sku, delta) {
    if (!modoEdicaoMaster) return alert("Clique em EDITAR MASTER antes de alterar.");
    if (!masterAtual?.itens?.[sku]) return;

    masterAtual.itens[sku].quantidade += delta;
    if (masterAtual.itens[sku].quantidade <= 0) delete masterAtual.itens[sku];

    masterAtual.atualizadoEm = new Date().toLocaleString("pt-BR");
    renderMaster();
}

export function removerItemMaster(sku) {
    if (!modoEdicaoMaster) return alert("Clique em EDITAR MASTER antes de alterar.");
    if (!masterAtual?.itens?.[sku]) return;
    delete masterAtual.itens[sku];
    masterAtual.atualizadoEm = new Date().toLocaleString("pt-BR");
    renderMaster();
}

export async function salvarMasterAtual() {
    if (!masterAtual) return alert("Nenhuma Master aberta.");
    const codigo = masterAtual.codigo;
    const itens = Object.values(masterAtual.itens || {});

    const masterAntiga = await database.ref(`masters/${state.lojaAtual}/${codigo}`).once("value");
    const dadosAntigos = masterAntiga.val();

    if (dadosAntigos?.itens) {
        const updatesLimpar = {};
        Object.values(dadosAntigos.itens).forEach(item => {
            updatesLimpar[`master_index/${state.lojaAtual}/${item.sku}/${codigo}`] = null;
            if (item.ean) updatesLimpar[`master_index/${state.lojaAtual}/${item.ean}/${codigo}`] = null;
        });
        await database.ref().update(updatesLimpar);
    }

    masterAtual.totalSkus = itens.length;
    masterAtual.totalItens = itens.reduce((s, i) => s + Number(i.quantidade || 0), 0);
    masterAtual.atualizadoEm = new Date().toLocaleString("pt-BR");

    await database.ref(`masters/${state.lojaAtual}/${codigo}`).set(masterAtual);
    const updates = {};
    itens.forEach(item => {
        updates[`master_index/${state.lojaAtual}/${item.sku}/${codigo}`] = true;
        if (item.ean) updates[`master_index/${state.lojaAtual}/${item.ean}/${codigo}`] = true;
    });

    await database.ref().update(updates);
    modoEdicaoMaster = false;
    renderMaster();

    if(window.mostrarAviso) window.mostrarAviso(`Master ${codigo} salva!`, "sucesso");
}

export async function consultarMaster() {
    const codigo = document.getElementById("inputMasterConsulta").value.trim().toUpperCase();
    if (!codigo) return alert("Digite ou bipe o código da Master.");

    const snap = await database.ref(`masters/${state.lojaAtual}/${codigo}`).once("value");
    if (!snap.exists()) return alert("Master não encontrada.");

    masterAtual = snap.val();
    modoEdicaoMaster = false;
    mudarTela("viewMasterCriar");
    renderMaster();
}

export async function buscarItemNaMaster() {
    const codigo = document.getElementById("inputBuscaItemMaster").value.trim();
    const box = document.getElementById("resultadoBuscaMaster");

    if (!codigo) return alert("Digite SKU ou EAN.");
    box.innerHTML = "Buscando...";

    const cod = normalizarCodigo(codigo);
    const snap = await database.ref(`master_index/${state.lojaAtual}/${cod}`).once("value");

    if (!snap.exists()) {
        box.innerHTML = `<div style="color:#ef4444;font-weight:900; background:#fef2f2; padding:15px; border-radius:12px;">Item não encontrado em nenhuma Master desta loja.</div>`;
        return;
    }

    const masters = Object.keys(snap.val());
    box.innerHTML = `<h4 style="color:#0f172a; margin-bottom:10px;">Item localizado em:</h4>`;

    masters.forEach(codMaster => {
        box.innerHTML += `
            <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:15px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 5px rgba(0,0,0,0.02);">
                <b style="color:#2563eb; font-size:1.1em;">📦 ${codMaster}</b>
                <button class="btn-main" style="padding:8px 12px; margin:0; width:auto; font-size:12px;" onclick="
                    document.getElementById('inputMasterConsulta').value='${codMaster}';
                    app.consultarMaster();
                ">ABRIR</button>
            </div>
        `;
    });
}

function gerarQrBase64(texto) {
    return new Promise(resolve => {
        const div = document.createElement("div");
        div.style.position = "fixed";
        div.style.left = "-9999px";
        document.body.appendChild(div);
        new QRCode(div, { text: texto, width: 200, height: 200 });
        setTimeout(() => {
            const canvas = div.querySelector("canvas");
            const data = canvas ? canvas.toDataURL("image/png") : null;
            div.remove();
            resolve(data);
        }, 300);
    });
}

// ----------------------------------------------------
// 1. GERAR ETIQUETA PEQUENA PARA A CAIXA
// ----------------------------------------------------
export async function imprimirEtiquetaMaster() {
    if (!masterAtual) return alert("Abra uma Master primeiro.");
    await salvarMasterAtual();

    const { jsPDF } = window.jspdf;
    // Tamanho padrão de etiqueta 100mm x 150mm
    const pdf = new jsPDF("p", "mm", [100, 150]); 
    const codigo = masterAtual.codigo;

    // Cabeçalho
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("STOCKFLOW", 50, 15, { align: "center" });

    pdf.setFontSize(14);
    pdf.text("MASTER BOX", 50, 25, { align: "center" });

    // Código da Caixa gigante
    pdf.setFontSize(28);
    pdf.text(codigo, 50, 42, { align: "center" });

    // QR Code no centro da Etiqueta
    const qr = await gerarQrBase64(codigo);
    if (qr) {
        pdf.addImage(qr, "PNG", 20, 52, 60, 60); 
    }

    // Informações adicionais
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Loja Origem: ${state.lojaAtual}`, 50, 125, { align: "center" });
    pdf.text(`Itens Totais: ${masterAtual.totalItens || 0}`, 50, 132, { align: "center" });
    pdf.text(`Data: ${masterAtual.criadoEm.split(' ')[0]}`, 50, 139, { align: "center" });

    pdf.save(`Etiqueta_${codigo}.pdf`);
}

// ----------------------------------------------------
// 2. EXPORTAR UMA ÚNICA MASTER PARA EXCEL
// ----------------------------------------------------
export async function exportarMasterExcel() {
    if (!masterAtual) return alert("Abra uma Master primeiro.");
    await salvarMasterAtual();

    const itens = Object.values(masterAtual.itens || {});
    if (itens.length === 0) return alert("Esta Master está vazia.");

    let dados = itens.map(i => ({
        "Master Box": masterAtual.codigo,
        "Loja": state.lojaAtual,
        "SKU": i.sku,
        "EAN": i.ean,
        "Descrição": i.descricao,
        "Tamanho": i.tamanho,
        "Qtd Dentro da Caixa": i.quantidade,
        "Criado Por": masterAtual.criadoPor,
        "Data/Hora Criação": masterAtual.criadoEm
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Box");
    XLSX.writeFile(wb, `Master_${masterAtual.codigo}.xlsx`);
}

// ----------------------------------------------------
// 3. EXPORTAR TODAS AS MASTERS PARA EXCEL DE UMA VEZ
// ----------------------------------------------------
export async function exportarTodasMasters() {
    const snap = await database.ref(`masters/${state.lojaAtual}`).once("value");
    if (!snap.exists()) return alert("Nenhuma Master encontrada no banco de dados.");

    const masters = snap.val();
    let dadosCompletos = [];

    Object.values(masters).forEach(master => {
        const itens = Object.values(master.itens || {});
        itens.forEach(i => {
            dadosCompletos.push({
                "Master Box": master.codigo,
                "Loja": state.lojaAtual,
                "SKU": i.sku,
                "EAN": i.ean,
                "Descrição": i.descricao,
                "Tamanho": i.tamanho,
                "Qtd Dentro da Caixa": i.quantidade,
                "Criado Por": master.criadoPor,
                "Data/Hora Criação": master.criadoEm
            });
        });
    });

    if (dadosCompletos.length === 0) return alert("Todas as Masters estão vazias.");

    const ws = XLSX.utils.json_to_sheet(dadosCompletos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Base Geral de Masters");
    XLSX.writeFile(wb, `Base_MasterBox_Loja_${state.lojaAtual}.xlsx`);
}

// ----------------------------------------------------
// PDF ANTIGO (Lista detalhada de produtos)
// ----------------------------------------------------
async function carregarImagemBase64(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.getContext("2d").drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/jpeg", 0.7));
            } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

export async function exportarPDFMaster() {
    if (!masterAtual) return alert("Abra uma Master primeiro.");
    await salvarMasterAtual();

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const codigo = masterAtual.codigo;
    const itens = Object.values(masterAtual.itens || {});

    let y = 15;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("STOCKFLOW", 15, y);

    y += 8;
    pdf.setFontSize(12);
    pdf.text(`MASTER BOX: ${codigo}`, 15, y);

    y += 7;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`Loja: ${state.lojaAtual}`, 15, y);

    y += 5;
    pdf.text(`Criado por: ${masterAtual.criadoPor}`, 15, y);
    y += 5;
    pdf.text(`Criado em: ${masterAtual.criadoEm}`, 15, y);

    const qr = await gerarQrBase64(codigo);
    if (qr) pdf.addImage(qr, "PNG", 160, 12, 35, 35);

    y = 55;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("FOTO", 15, y);
    pdf.text("SKU", 38, y);
    pdf.text("DESCRIÇÃO", 75, y);
    pdf.text("TAM", 160, y);
    pdf.text("QTD", 185, y);

    y += 5;
    pdf.line(15, y, 195, y);
    y += 5;

    for (const item of itens) {
        if (y > 270) { pdf.addPage(); y = 20; }

        const img = await carregarImagemBase64(`https://imgcentauro-a.akamaihd.net/100x100/${item.sku.substring(0,8)}.jpg`);
        if (img) pdf.addImage(img, "JPEG", 15, y - 4, 16, 16);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(String(item.sku), 38, y + 5);

        const desc = pdf.splitTextToSize(item.descricao || "", 78);
        pdf.text(desc.slice(0, 2), 75, y + 3);

        pdf.text(String(item.tamanho || "--"), 160, y + 5);
        pdf.text(String(item.quantidade || 0), 187, y + 5);

        y += 20;
        pdf.line(15, y - 3, 195, y - 3);
    }

    y += 5;
    pdf.setFont("helvetica", "bold");
    pdf.text(`Total SKUs: ${itens.length}`, 15, y);
    pdf.text(`Total Itens: ${itens.reduce((s, i) => s + Number(i.quantidade || 0), 0)}`, 70, y);

    pdf.save(`${codigo}_LISTA.pdf`);
}

export async function listarHistoricoMasters() {
    const box = document.getElementById("historicoMasters");
    if (!box) return;

    box.innerHTML = `<div style="text-align:center; padding:20px; color:#64748b;">Carregando histórico...</div>`;

    const snap = await database.ref(`masters/${state.lojaAtual}`).once("value");

    if (!snap.exists()) {
        box.innerHTML = `<div style="color:#64748b; font-weight:800; text-align:center;">Nenhuma Master criada nesta loja.</div>`;
        return;
    }

    const dados = snap.val();
    const lista = Object.values(dados).sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));

    box.innerHTML = `<h4 style="color:#0f172a; margin-bottom:12px;">📋 Últimas Masters Criadas</h4>`;

    lista.forEach(master => {
        box.innerHTML += `
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:15px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 5px rgba(0,0,0,0.02);">
                <div>
                    <b style="color:#2563eb; font-size:1.1em; display:flex; align-items:center; gap:6px;">📦 ${master.codigo}</b>
                    <div style="font-size:0.75em; color:#475569; margin-top:4px;">
                        <b>${master.totalItens || 0} Itens</b> • ${master.criadoEm || "--"}
                    </div>
                </div>
                <button class="btn-main" style="padding:10px 14px; margin:0; width:auto; font-size:12px; background:#f1f5f9; color:#0f172a; border:1px solid #e2e8f0;" onclick="
                    document.getElementById('inputMasterConsulta').value='${master.codigo}';
                    app.consultarMaster();
                ">
                    ABRIR
                </button>
            </div>
        `;
    });
}
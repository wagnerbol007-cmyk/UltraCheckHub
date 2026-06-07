// js/masterbox.js
// StockFlow v2.3.1

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

    if (state.dbSap[cod]) return state.dbSap[cod];

    const encontrado = Object.values(state.dbSap || {}).find(p => {
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

    if (btnEditar) {
        btnEditar.style.display = modoEdicaoMaster ? "none" : "block";
    }

    if (btnSalvar) {
        btnSalvar.style.display = modoEdicaoMaster ? "block" : "none";
    }
}

function renderMaster() {
    if (!masterAtual) return;

    const titulo = document.getElementById("tituloMasterCriar");
    const lista = document.getElementById("listaItensMaster");

    if (titulo) {
        titulo.innerText = `MASTER: ${masterAtual.codigo}`;
    }

    if (!lista) return;

    const itens = Object.values(masterAtual.itens || {});

    atualizarTotaisMaster();
    atualizarBotoesModo();

    lista.innerHTML = "";

    if (itens.length === 0) {
        lista.innerHTML = `<p style="color:#64748b;">Nenhum item adicionado.</p>`;
        return;
    }

    itens.forEach(item => {
        const div = document.createElement("div");

        div.style.cssText = `
            display:flex;
            gap:12px;
            align-items:center;
            background:#fff;
            border:1px solid #eadcff;
            border-radius:18px;
            padding:12px;
            margin-bottom:10px;
        `;

        div.innerHTML = `
            <img src="https://imgcentauro-a.akamaihd.net/100x100/${item.sku.substring(0,8)}.jpg"
                style="width:55px;height:55px;border-radius:10px;object-fit:contain;background:white;border:1px solid #eee;">

            <div style="flex:1;">
                <b>${item.sku}</b><br>
                <span style="font-size:0.8em;color:#64748b;">${item.descricao}</span><br>
                <span style="font-size:0.75em;color:#7c3aed;">Tam: ${item.tamanho || "--"}</span>
            </div>

            ${
                modoEdicaoMaster
                ? `
                    <div style="text-align:center;">
                        <button onclick="app.alterarQtdMaster('${item.sku}', -1)"
                            style="border:none;background:#fee2e2;color:#991b1b;border-radius:8px;padding:6px;">
                            −
                        </button>

                        <div style="font-weight:900;margin:4px;">${item.quantidade}</div>

                        <button onclick="app.alterarQtdMaster('${item.sku}', 1)"
                            style="border:none;background:#dcfce7;color:#166534;border-radius:8px;padding:6px;">
                            +
                        </button>
                    </div>

                    <button onclick="app.removerItemMaster('${item.sku}')"
                        style="border:none;background:#ef4444;color:white;border-radius:10px;padding:8px;">
                        X
                    </button>
                `
                : `
                    <div style="font-weight:900;color:#6200ee;">
                        QTD: ${item.quantidade}
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

export function abrirConsultarMasterBox() {
    mudarTela("viewMasterConsultar");
}

export function abrirBuscarItemMasterBox() {
    mudarTela("viewMasterBuscar");
}

export function editarMasterAtual() {
    if (!masterAtual) {
        alert("Abra uma Master primeiro.");
        return;
    }

    modoEdicaoMaster = true;
    renderMaster();
}

export function biparItemMaster() {
    const input = document.getElementById("inputBipMaster");
    const codigo = input.value.trim();

    if (!masterAtual) {
        alert("Crie ou consulte uma Master primeiro.");
        return;
    }

    if (!modoEdicaoMaster) {
        alert("Clique em EDITAR MASTER antes de alterar esta caixa.");
        input.value = "";
        input.focus();
        return;
    }

    if (!codigo) return;

    const produto = buscarProduto(codigo);

    if (!produto) {
        alert("Produto não encontrado no SAP.");
        input.value = "";
        input.focus();
        return;
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
    if (!modoEdicaoMaster) {
        alert("Clique em EDITAR MASTER antes de alterar esta caixa.");
        return;
    }

    if (!masterAtual?.itens?.[sku]) return;

    masterAtual.itens[sku].quantidade += delta;

    if (masterAtual.itens[sku].quantidade <= 0) {
        delete masterAtual.itens[sku];
    }

    masterAtual.atualizadoEm = new Date().toLocaleString("pt-BR");
    renderMaster();
}

export function removerItemMaster(sku) {
    if (!modoEdicaoMaster) {
        alert("Clique em EDITAR MASTER antes de alterar esta caixa.");
        return;
    }

    if (!masterAtual?.itens?.[sku]) return;

    delete masterAtual.itens[sku];

    masterAtual.atualizadoEm = new Date().toLocaleString("pt-BR");
    renderMaster();
}

export async function salvarMasterAtual() {
    if (!masterAtual) {
        alert("Nenhuma Master aberta.");
        return;
    }

    const codigo = masterAtual.codigo;
    const itens = Object.values(masterAtual.itens || {});

    const masterAntiga = await database
        .ref(`masters/${state.lojaAtual}/${codigo}`)
        .once("value");

    const dadosAntigos = masterAntiga.val();

    if (dadosAntigos?.itens) {
        const updatesLimpar = {};

        Object.values(dadosAntigos.itens).forEach(item => {
            updatesLimpar[`master_index/${state.lojaAtual}/${item.sku}/${codigo}`] = null;

            if (item.ean) {
                updatesLimpar[`master_index/${state.lojaAtual}/${item.ean}/${codigo}`] = null;
            }
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

        if (item.ean) {
            updates[`master_index/${state.lojaAtual}/${item.ean}/${codigo}`] = true;
        }
    });

    await database.ref().update(updates);

    modoEdicaoMaster = false;
    renderMaster();

    alert(`Master ${codigo} salva com sucesso!`);
}

export async function consultarMaster() {
    const codigo = document.getElementById("inputMasterConsulta").value.trim();

    if (!codigo) {
        alert("Digite ou bipe o código da Master.");
        return;
    }

    const snap = await database
        .ref(`masters/${state.lojaAtual}/${codigo}`)
        .once("value");

    if (!snap.exists()) {
        alert("Master não encontrada.");
        return;
    }

    masterAtual = snap.val();
    modoEdicaoMaster = false;

    mudarTela("viewMasterCriar");
    renderMaster();
}

export async function buscarItemNaMaster() {
    const codigo = document.getElementById("inputBuscaItemMaster").value.trim();
    const box = document.getElementById("resultadoBuscaMaster");

    if (!codigo) {
        alert("Digite SKU ou EAN.");
        return;
    }

    box.innerHTML = "Buscando...";

    const cod = normalizarCodigo(codigo);
    const snap = await database
        .ref(`master_index/${state.lojaAtual}/${cod}`)
        .once("value");

    if (!snap.exists()) {
        box.innerHTML = `
            <div style="color:#991b1b;font-weight:900;">
                Item não encontrado em nenhuma Master.
            </div>
        `;
        return;
    }

    const masters = Object.keys(snap.val());

    box.innerHTML = `<h4>Item encontrado em:</h4>`;

    masters.forEach(codMaster => {
        box.innerHTML += `
            <div style="background:white;border:1px solid #eadcff;border-radius:16px;padding:12px;margin-top:8px;">
                📦 <b>${codMaster}</b>

                <button class="btn-main" style="padding:8px;margin-top:8px;" onclick="
                    document.getElementById('inputMasterConsulta').value='${codMaster}';
                    app.consultarMaster();
                ">
                    CONSULTAR MASTER
                </button>
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

        new QRCode(div, {
            text: texto,
            width: 180,
            height: 180
        });

        setTimeout(() => {
            const canvas = div.querySelector("canvas");
            const data = canvas ? canvas.toDataURL("image/png") : null;
            div.remove();
            resolve(data);
        }, 300);
    });
}

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
            } catch {
                resolve(null);
            }
        };

        img.onerror = () => resolve(null);
        img.src = url;
    });
}

export async function exportarPDFMaster() {
    if (!masterAtual) {
        alert("Abra uma Master primeiro.");
        return;
    }

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

    if (qr) {
        pdf.addImage(qr, "PNG", 160, 12, 35, 35);
    }

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
        if (y > 270) {
            pdf.addPage();
            y = 20;
        }

        const img = await carregarImagemBase64(
            `https://imgcentauro-a.akamaihd.net/100x100/${item.sku.substring(0,8)}.jpg`
        );

        if (img) {
            pdf.addImage(img, "JPEG", 15, y - 4, 16, 16);
        }

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
    pdf.text(
        `Total Itens: ${itens.reduce((s, i) => s + Number(i.quantidade || 0), 0)}`,
        70,
        y
    );

    pdf.save(`${codigo}.pdf`);
}

export async function listarHistoricoMasters() {
    const box = document.getElementById("historicoMasters");

    if (!box) return;

    box.innerHTML = "Carregando histórico...";

    const snap = await database
        .ref(`masters/${state.lojaAtual}`)
        .once("value");

    if (!snap.exists()) {
        box.innerHTML = `
            <div style="color:#64748b;font-weight:800;">
                Nenhuma Master criada nesta loja.
            </div>
        `;
        return;
    }

    const dados = snap.val();

    const lista = Object.values(dados).sort((a, b) => {
        return String(b.criadoEm || "").localeCompare(String(a.criadoEm || ""));
    });

    box.innerHTML = `<h4 style="color:#25105f;">📋 Histórico de Masters</h4>`;

    lista.forEach(master => {
        box.innerHTML += `
            <div style="
                background:white;
                border:1px solid #eadcff;
                border-radius:18px;
                padding:14px;
                margin-top:10px;
                box-shadow:0 6px 18px rgba(91,22,200,0.06);
            ">
                <b style="color:#5b16c8;">📦 ${master.codigo}</b>

                <div style="font-size:0.8em;color:#64748b;margin-top:6px;">
                    SKUs: <b>${master.totalSkus || Object.keys(master.itens || {}).length}</b> |
                    Itens: <b>${master.totalItens || 0}</b>
                </div>

                <div style="font-size:0.75em;color:#64748b;margin-top:6px;">
                    Criado por: ${master.criadoPor || "--"}<br>
                    Criado em: ${master.criadoEm || "--"}
                </div>

                <button class="btn-main" style="padding:9px;margin-top:10px;" onclick="
                    document.getElementById('inputMasterConsulta').value='${master.codigo}';
                    app.consultarMaster();
                ">
                    CONSULTAR MASTER
                </button>
            </div>
        `;
    });
}
// js/reman.js
import { state, normalizarCodigo, getHoraCerta } from './state.js';
import { database } from './firebase.js';

// Função auxiliar para extrair tamanho 
function extrairInfoSAP(item) {
    let saldo = 0, tam = "---";
    for(let key in item) {
        let k = key.toLowerCase();
        if(k.includes("utiliza") || k.includes("estoque")) saldo = parseInt(item[key] || 0);
        if(k.includes("tamanho") || k.includes("tam")) tam = String(item[key]);
    }
    return { saldo, tam };
}

export function biparReman(bip) {
    const bipLimpo = normalizarCodigo(bip);
    const cardTop = document.getElementById('cardBipResultadoTop');
    const tagTop = document.getElementById('tagFeedbackTop');
    const corpoTop = document.getElementById('corpoFeedbackTop');

    document.getElementById('inputBipReman').value = "";

    const itemNoSap = state.sapCompleto.find(i => normalizarCodigo(i.EAN) === bipLimpo || normalizarCodigo(i.Material || i.SKU) === bipLimpo);

    if (!itemNoSap) {
        cardTop.style.display = "block";
        cardTop.style.borderLeftColor = "var(--danger)";
        tagTop.style.background = "var(--danger)";
        tagTop.classList.remove("reman-laranja");
        tagTop.innerText = "❌ PRODUTO DESCONHECIDO NO SAP!";
        corpoTop.innerHTML = `<div style="font-size:0.85em; font-weight:700; color:var(--dark-blue);">O código ${bip} não foi localizado na última extração do SAP.</div>`;
        return;
    }

    const sku13Sap = normalizarCodigo(itemNoSap.Material || itemNoSap.SKU);
    const base8 = sku13Sap.substring(0, 8);
    const descricaoItem = itemNoSap["Descrição material"] || itemNoSap["Texto breve material"];

    const pertenceAoReman = state.dadosReman.filter(i => {
        let skuPlanilha = normalizarCodigo(i.SKU || i.Material);
        return skuPlanilha.substring(0, 8) === base8;
    });

    cardTop.style.display = "block";

    if (pertenceAoReman.length > 0) {
        cardTop.style.borderLeftColor = "#f97316";

tagTop.style.background = "linear-gradient(135deg, #f97316, #c2410c)";
tagTop.style.color = "#ffffff";
tagTop.style.boxShadow = "0 10px 24px rgba(249,115,22,0.35)";
tagTop.style.border = "none";
tagTop.classList.add("reman-laranja");

tagTop.innerText = "🚨 ITEM DE REMAN! SEPARAR";

        let linesTopHtml = "";
        
        pertenceAoReman.forEach(itemPlan => {
            let skuReman13 = normalizarCodigo(itemPlan.SKU || itemPlan.Material);
            const correspondenteGradeSap = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU) === skuReman13);
            const textoTamanho = correspondenteGradeSap ? extrairInfoSAP(correspondenteGradeSap).tam : "UN";

            let classeLinha = "reman-grade-linha";
            let classeBotao = "btn-reman-action btn-reman-check";
            let textoBotao = "📦 COLETAR";

            database.ref(`status_reman_loja/${state.lojaAtual}/${skuReman13}`).once('value', sn => {
                if (sn.val() === "separado") {
                    classeLinha = "reman-grade-linha marcado-separado";
                    classeBotao = "btn-reman-action btn-reman-check check-ok";
                    textoBotao = "✅ OK";
                }
            });

            linesTopHtml += `
                <div class="${classeLinha}" id="linha-reman-top-${skuReman13}">
                    <div>TAM: <b>${textoTamanho}</b> <span style="font-size:0.8em; color:gray; font-weight:normal;">(${skuReman13})</span></div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-reman-action" style="background:#e2e8f0; color:var(--dark-blue);" onclick="app.gerarQRReman('${textoTamanho}', '${skuReman13}')">🔍 QR</button>
                        <button class="${classeBotao}" id="btn-check-reman-top-${skuReman13}" onclick="app.alternarStatusReman('${base8}', '${skuReman13}')">${textoBotao}</button>
                    </div>
                </div>
            `;
        });

        corpoTop.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <img src="https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg" class="thumb" style="width:55px; height:55px;" onclick="app.zoomFoto(this.src)">
                <div style="flex:1; font-size:0.75em; line-height:1.2;">
                    <b>${descricaoItem}</b><br>
                    <span style="color:#7c3aed; font-weight:800;">REF: ${base8}</span>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; margin-top:5px;">
                ${linesTopHtml}
            </div>
        `;

    } else {
        cardTop.style.borderLeftColor = "var(--success)";
        tagTop.style.background = "var(--success)";
        tagTop.classList.remove("reman-laranja");
        tagTop.innerText = "✅ NÃO PERTENCE À LISTA DE REMANEJAMENTO";

        corpoTop.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <img src="https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg" class="thumb" style="width:55px; height:55px;" onclick="app.zoomFoto(this.src)">
                <div style="flex:1; font-size:0.75em; line-height:1.2;">
                    <b>${descricaoItem}</b><br>
                    <span style="color:var(--success); font-weight:800;">PERTENCE À LISTA DE PLANEJAMENTO</span>
                </div>
            </div>
        `;
    }
}

export function renderizarListaCompletaReman() {
    const container = document.getElementById('remanListaSincronizada');
    if (!container) return;
    container.innerHTML = "";

    if (state.dadosReman.length === 0) {
        container.innerHTML = "<p style='color:gray; font-size:0.85em; text-align:center;'>Nenhuma planilha de Reman carregada no sistema.</p>";
        return;
    }

    let agrupadoPorModelo = {};
    state.dadosReman.forEach(item => {
        let skuLimpo = normalizarCodigo(item.SKU || item.Material);
        if (!skuLimpo) return;
        let base8 = skuLimpo.substring(0, 8);
        if (!agrupadoPorModelo[base8]) agrupadoPorModelo[base8] = [];
        agrupadoPorModelo[base8].push(skuLimpo);
    });

    Object.entries(agrupadoPorModelo).forEach(([base8, listaSkus13]) => {
        const correspondenteSap = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU).startsWith(base8));
        const descricaoItem = correspondenteSap ? (correspondenteSap["Descrição material"] || correspondenteSap["Texto breve material"]) : "Produto Reman";

        const card = document.createElement('div');
        card.className = "reman-card-item";
        card.id = `card-modelo-reman-${base8}`;

        let linhasGradeHtml = "";

        listaSkus13.forEach(sku13 => {
            const detalheItemSap = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU) === sku13);
            const tamanhoTexto = detalheItemSap ? extrairInfoSAP(detalheItemSap).tam : "UN";
            
            // Verifica no banco se já foi coletado
            database.ref(`status_reman_loja/${state.lojaAtual}/${sku13}`).once('value', snapshot => {
                const jaColetado = snapshot.val() === "separado";
                if (jaColetado) {
                    document.getElementById(`linha-reman-${sku13}`)?.classList.add('marcado-separado');
                    const btn = document.getElementById(`btn-check-reman-${sku13}`);
                    if(btn) { 
                        btn.className = "btn-reman-action btn-reman-check check-ok"; 
                        btn.innerText = "✅ OK"; 
                    }
                    recalcularProgressoCard(base8);
                }
            });

            linhasGradeHtml += `
                <div class="reman-grade-linha" id="linha-reman-${sku13}">
                    <div>TAM: <b>${tamanhoTexto}</b> <span style="font-size:0.85em; color:gray; font-weight:normal; margin-left:5px;">(${sku13})</span></div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-reman-action" style="background:#e2e8f0; color:var(--dark-blue);" onclick="app.gerarQRReman('${tamanhoTexto}', '${sku13}')">🔍 QR</button>
                        <button class="btn-reman-action btn-reman-check" id="btn-check-reman-${sku13}" onclick="app.alternarStatusReman('${base8}', '${sku13}')">📦 COLETAR</button>
                    </div>
                </div>
            `;
        });

        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <img src="https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg" class="thumb" style="width:55px; height:55px;" onclick="app.zoomFoto(this.src)">
                <div style="flex:1; font-size:0.75em; line-height:1.2;">
                    <b>${descricaoItem}</b><br>
                    <span style="color:#7c3aed; font-weight:800; font-size:0.9em;">REF: ${base8}</span>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; margin-top:5px;">
                ${linhasGradeHtml}
            </div>
        `;
        container.appendChild(card);
    });
}

export function alternarStatusReman(base8, sku13) {
    const linha = document.getElementById(`linha-reman-${sku13}`);
    const btn = document.getElementById(`btn-check-reman-${sku13}`);
    const linhaTop = document.getElementById(`linha-reman-top-${sku13}`);
    const btnTop = document.getElementById(`btn-check-reman-top-${sku13}`);

    const estaSeparado = linha ? linha.classList.contains('marcado-separado') : (linhaTop ? linhaTop.classList.contains('marcado-separado') : false);

    if (!estaSeparado) {
        database.ref(`status_reman_loja/${state.lojaAtual}/${sku13}`).set("separado");
        if(linha) { linha.classList.add('marcado-separado'); btn.className = "btn-reman-action btn-reman-check check-ok"; btn.innerText = "✅ OK"; }
        if(linhaTop) { linhaTop.classList.add('marcado-separado'); btnTop.className = "btn-reman-action btn-reman-check check-ok"; btnTop.innerText = "✅ OK"; }
    } else {
        database.ref(`status_reman_loja/${state.lojaAtual}/${sku13}`).remove();
        if(linha) { linha.classList.remove('marcado-separado'); btn.className = "btn-reman-action btn-reman-check"; btn.innerText = "📦 COLETAR"; }
        if(linhaTop) { linhaTop.classList.remove('marcado-separado'); btnTop.className = "btn-reman-action btn-reman-check"; btnTop.innerText = "📦 COLETAR"; }
    }
    recalcularProgressoCard(base8);
}

function recalcularProgressoCard(base8) {
    const card = document.getElementById(`card-modelo-reman-${base8}`);
    if (!card) return;
    const totalLinhas = card.querySelectorAll('.reman-grade-linha').length;
    const totalMarcados = card.querySelectorAll('.reman-grade-linha.marcado-separado').length;
    
    if (totalLinhas === totalMarcados && totalLinhas > 0) {
        card.classList.add('item-separado-completo');
    } else {
        card.classList.remove('item-separado-completo');
    }
}

export function exportarRemanExcel() {
    // Busca no Firebase tudo que foi marcado como separado na loja atual
    database.ref(`status_reman_loja/${state.lojaAtual}`).once('value', snapshot => {
        const status = snapshot.val() || {};
        const coletados = Object.keys(status).filter(sku => status[sku] === "separado");

        if (coletados.length === 0) {
            return alert("Nenhum item foi separado ainda para exportar.");
        }

        let dadosExportacao = [];
        
        coletados.forEach(sku13 => {
            const itemSap = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU) === sku13);
            const base8 = sku13.substring(0, 8);
            const descricao = itemSap ? (itemSap["Descrição material"] || itemSap["Texto breve material"]) : "Produto Reman";
            let tam = "UN";
            
            // Busca o tamanho na grade do SAP
            if(itemSap) {
                for(let key in itemSap) {
                    if(key.toLowerCase().includes("tamanho") || key.toLowerCase().includes("tam")) tam = String(itemSap[key]);
                }
            }

            // Monta as linhas da planilha
            dadosExportacao.push({
                "SKU 13": sku13,
                "REF (8)": base8,
                "Descrição": descricao,
                "Tamanho": tam,
                "Status": "Separado",
                "Data/Hora": getHoraCerta()
            });
        });

        // Utiliza a biblioteca XLSX (já importada no HTML) para gerar o download
        const ws = XLSX.utils.json_to_sheet(dadosExportacao);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reman Separados");
        XLSX.writeFile(wb, `Reman_Separados_Loja_${state.lojaAtual}.xlsx`);
    });
}
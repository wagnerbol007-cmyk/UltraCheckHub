// js/inventario_relatorio.js
// StockFlow v3.0.1
import { state, normalizarCodigo, getHoraCerta } from './state.js';
import { database } from './firebase.js';

function getCaminhoColetaPorTipo(tipo) {
    if (tipo === 'padrao') {
        return `sinc_rfid_primeira/${state.lojaAtual}`;
    }
    return `sinc_rfid_segunda/${state.lojaAtual}`;
}

function obterQuantidadeResposta(resposta) {
    if (resposta && typeof resposta === "object") {
        return resposta.quantidade || "";
    }
    return resposta || "";
}

function obterOperadorResposta(resposta) {
    if (resposta && typeof resposta === "object") {
        return resposta.operador || "";
    }
    return "";
}

function obterDataHoraResposta(resposta) {
    if (resposta && typeof resposta === "object") {
        return resposta.dataHora || "";
    }
    return "";
}

// Descobre a cor dinamicamente nas colunas do SAP
function extrairCorSAP(info) {
    for (let key in info) {
        let k = key.toLowerCase();
        if (k === 'cor' || k.includes('color') || k === 'm') {
            if (info[key]) return String(info[key]);
        }
    }
    return info.Cor || info.COLOR || info.CorPrincipal || "";
}

export function gerarHistAuditoria(tipo) {
    document.getElementById('overlay').style.display = 'flex';

    const btn1 = document.getElementById('btnAuditoriaBusca1');
    const btn2 = document.getElementById('btnAuditoriaBusca2');
    if(btn1) btn1.style.background = tipo === 'padrao' ? '#2563eb' : '#475569';
    if(btn2) btn2.style.background = tipo === 'analista' ? '#2563eb' : '#475569';

    const caminho = getCaminhoColetaPorTipo(tipo);

    database.ref(caminho).once('value', s_sinc => {
        state.respostasInventarioNuvem = s_sinc.val() || {};

        database.ref('arquivos_lojas/' + state.lojaAtual).once('value', s => {
            const d = s.val() || {};
            let list = [];

            if (tipo === 'padrao') {
                Papa.parse(d.mogix || "", {
                    header: true,
                    complete: r => {
                        list = r.data
                            .map(i => ({ Material: normalizarCodigo(i.SKU) }))
                            .filter(i => i.Material);

                        finalizarRel(list, tipo);
                    }
                });
            } else {
                list = JSON.parse(d.busca || "[]")
                    .map(r => ({
                        Material: normalizarCodigo(
                            r.Material ||
                            r.SKU ||
                            Object.values(r)[0]
                        )
                    }))
                    .filter(i => i.Material);

                finalizarRel(list, tipo);
            }
        });
    });
}

function finalizarRel(lista, tipo) {
    state.modoInventario = tipo;

    const tbody = document.getElementById('histRelatorioInvTabela');
    if (!tbody) {
        document.getElementById('overlay').style.display = 'none';
        return;
    }
    
    tbody.innerHTML = "";
    
    let totalAuditados = 0;

    lista.forEach((it) => {
        const sku = it.Material;
        const resposta = state.respostasInventarioNuvem[sku];

        const val = obterQuantidadeResposta(resposta);
        const operador = obterOperadorResposta(resposta);
        const dataHora = obterDataHoraResposta(resposta);

        const info = state.dbSap[sku] || {};
        const moj = state.dbMojixGlobal[sku] || {};

        const nomeExibicao =
            info["Descrição material"] ||
            info["Texto breve material"] ||
            moj["SKU Description"] ||
            "Item s/ Nome";

        let tam = "--";
        for (let key in info) {
            if (key.toLowerCase().includes("tam")) tam = info[key];
        }
        if (info.Tamanho) tam = info.Tamanho;

        const corProduto = extrairCorSAP(info);
        const esperado = Number(moj.Expected || 0);
        const lido = Number(moj.Counted || 0);
        const mao = val !== "" ? Number(val) : ""; 
        const base8 = sku.substring(0, 8); 

        let classRow = "row-pendente"; 
        let statusHtml = `<span style="color:#94a3b8; font-size:12px; font-weight:bold;">Pendente</span>`;
        let bgColor = "";

        if (mao !== "") {
            totalAuditados++;
            
            if (mao === 0 && esperado > 0) {
                classRow = "row-nao-localizado";
                bgColor = "background-color: #fef2f2;";
                statusHtml = `<span style="background:#fee2e2; color:#b91c1c; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:bold; display:inline-flex; align-items:center; gap:6px;"><span style="background:#ef4444; color:white; border-radius:50%; width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; font-size:10px;">!</span> Não Localizado</span>`;
            } else if (mao > esperado) {
                // REGRA DE SOBRAS: Achado a mão é maior que o esperado
                classRow = "row-sobras";
                bgColor = "background-color: #eff6ff;";
                statusHtml = `<span style="background:#dbeafe; color:#1e40af; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:bold; display:inline-flex; align-items:center; gap:6px;">📦 Sobra</span>`;
            } else if (mao !== esperado) {
                classRow = "row-divergente";
                bgColor = "background-color: #fffbeb;";
                statusHtml = `<span style="background:#fef3c7; color:#b45309; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:bold; display:inline-flex; align-items:center; gap:6px;"><span style="background:#f59e0b; color:white; border-radius:50%; width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; font-size:10px;">!</span> Divergente</span>`;
            } else {
                classRow = "row-ok";
                bgColor = "background-color: #f0fdf4;";
                statusHtml = `<span style="background:#dcfce7; color:#15803d; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:bold;">✅ Ok</span>`;
            }
        }

        const tr = document.createElement('tr');
        tr.className = `audit-item-row ${classRow}`;
        tr.style = bgColor;
        
        tr.setAttribute('data-sku', sku);
        tr.setAttribute('data-nome', nomeExibicao.toLowerCase());
        tr.setAttribute('data-ean', info.EAN || '');
        tr.setAttribute('data-tam', tam);
        tr.setAttribute('data-cor', corProduto);
        tr.setAttribute('data-exp', esperado);
        tr.setAttribute('data-lido', lido);
        tr.setAttribute('data-mao', mao);

        tr.onclick = () => app.abrirModalAuditoria(tr);

        tr.innerHTML = `
            <td>
                <img src="https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg" style="width:45px; height:45px; object-fit:contain; border-radius:8px; border:1px solid #cbd5e1; background:white;">
            </td>
            <td>
                <b style="color:#0f172a; font-size:13px;">${info.EAN || '---'} /</b><br>
                <span style="color:#64748b; font-size:12px; font-weight:600;">${sku}</span>
            </td>
            <td style="color:#0f172a; font-weight:800; font-size:12px;">
                ${nomeExibicao} ${corProduto ? `<span style="color:#64748b; font-weight:normal; font-size:11px;">(${corProduto})</span>` : ''}
            </td>
            <td style="text-align:center;">
                <div style="display:flex; justify-content:center; gap:20px; font-size:14px; font-weight:900; color:#0f172a;">
                    <span>${esperado}</span>
                    <span>${lido}</span>
                    <span style="${mao !== '' ? 'color:#2563eb; background:#eff6ff; padding:2px 8px; border-radius:6px;' : 'color:#94a3b8; font-weight:normal; font-size:12px;'}">${mao !== "" ? mao : "Vazio"}</span>
                </div>
            </td>
            <td style="font-size:12px; color:#475569; line-height:1.4;">
                ${operador ? `<b>${operador}</b><br>${dataHora}` : '--'}
            </td>
            <td>
                ${statusHtml}
            </td>
        `;

        tbody.appendChild(tr);
    });

    const lbl = document.getElementById('auditTotalItens');
    if (lbl) lbl.innerText = totalAuditados;

    document.getElementById('overlay').style.display = 'none';
}

export function baixarCSVInventario() {
    const tipo = state.modoInventario || 'padrao';
    let csv = "\ufeffSKU;EAN;TAMANHO;COR;NOME;ESPERADO;LIDO;ACHADO_LOCALIZADO;OPERADOR;DATA_HORA\n";

    const linhas = document.querySelectorAll('.audit-item-row');
    
    linhas.forEach(linha => {
        const sku = linha.getAttribute('data-sku');
        const info = state.dbSap[sku] || {};
        const moj = state.dbMojixGlobal[sku] || {};
        const resposta = state.respostasInventarioNuvem[sku];

        const qtd = obterQuantidadeResposta(resposta);
        const operador = obterOperadorResposta(resposta);
        const dataHora = obterDataHoraResposta(resposta);
        const nome = (linha.getAttribute('data-nome') || "").replace(/;/g, " ");
        const tam = linha.getAttribute('data-tam') || "";
        const cor = linha.getAttribute('data-cor') || "";

        csv += `${sku};${info.EAN || ''};${tam};${cor};${nome};${moj.Expected || 0};${moj.Counted || 0};${qtd};${operador};${dataHora}\n`;
    });

    const nomeArquivo = tipo === 'padrao'
        ? `Auditoria_1_Busca_Lj${state.lojaAtual}.csv`
        : `Auditoria_2_Busca_Lj${state.lojaAtual}.csv`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = nomeArquivo;
    link.click();
}

export function limparColetaInventario(tipo = null) {
    const tipoFinal = tipo || state.modoInventario || 'padrao';
    const nomeBusca = tipoFinal === 'padrao' ? "1ª Busca" : "2ª Busca";

    if (!confirm(`Deseja apagar somente a coleta da ${nomeBusca}?`)) {
        return;
    }

    const caminho = getCaminhoColetaPorTipo(tipoFinal);

    database.ref(caminho).remove().then(() => {
        window.mostrarAviso(`Coleta da ${nomeBusca} apagada!`, "sucesso");
        state.respostasInventarioNuvem = {};
        gerarHistAuditoria(tipoFinal);
    });
}

export function abrirModalAuditoria(trElement) {
    const sku = trElement.getAttribute('data-sku');
    const base8 = sku.substring(0, 8);
    const nome = trElement.getAttribute('data-nome').toUpperCase();
    const ean = trElement.getAttribute('data-ean');
    const tam = trElement.getAttribute('data-tam');
    const cor = trElement.getAttribute('data-cor');
    const exp = trElement.getAttribute('data-exp');
    const lido = trElement.getAttribute('data-lido');
    const mao = trElement.getAttribute('data-mao');

    document.getElementById('modalEditImg').src = `https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg`;
    document.getElementById('modalEditNome').innerText = nome;
    document.getElementById('modalEditSku').innerText = sku;
    
    let infoTxt = `TAM: ${tam}`;
    if (cor) infoTxt += ` | COR: ${cor}`;
    if (ean) infoTxt += ` | EAN: ${ean}`;
    document.getElementById('modalEditTamEan').innerText = infoTxt; 

    document.getElementById('modalEditExp').innerText = exp;
    document.getElementById('modalEditLido').innerText = lido;
    
    const inputQtd = document.getElementById('modalEditNovaQtd');
    inputQtd.value = mao !== "" ? mao : "";
    inputQtd.setAttribute('data-edit-sku', sku); 

    document.getElementById('modalEdicaoAuditoria').style.display = 'flex';
    inputQtd.focus();
}

export function fecharModalAuditoria() {
    document.getElementById('modalEdicaoAuditoria').style.display = 'none';
}

export function salvarEdicaoAuditoria() {
    const input = document.getElementById('modalEditNovaQtd');
    const novaQtdStr = input.value.trim();
    
    if (novaQtdStr === "") {
        window.mostrarAviso("Digite uma quantidade.", "erro");
        return;
    }

    const novaQtd = Number(novaQtdStr);
    const sku = input.getAttribute('data-edit-sku');
    const tipo = state.modoInventario || 'padrao';
    const caminho = getCaminhoColetaPorTipo(tipo);

    database.ref(`${caminho}/${sku}`).set({
        quantidade: novaQtd,
        operador: state.operador,
        dataHora: getHoraCerta()
    }).then(() => {
        window.mostrarAviso("Quantidade atualizada!", "sucesso");
        fecharModalAuditoria();
        gerarHistAuditoria(tipo); 
    });
}

export function filtrarTabelaAuditoria() {
    const inputBusca = document.getElementById('inputBuscaAuditoria').value.toLowerCase();
    const filtroStatus = document.getElementById('filtroStatusAudit').value;
    
    const linhas = document.querySelectorAll('.audit-item-row');

    linhas.forEach(linha => {
        const sku = (linha.getAttribute('data-sku') || "").toLowerCase();
        const nome = (linha.getAttribute('data-nome') || "").toLowerCase();
        
        let passaBusca = true;
        if (inputBusca !== "") {
            passaBusca = sku.includes(inputBusca) || nome.includes(inputBusca);
        }

        let passaStatus = true;
        if (filtroStatus !== "TODOS") {
            if (filtroStatus === "OK" && !linha.classList.contains("row-ok")) passaStatus = false;
            if (filtroStatus === "DIVERGENTE" && !linha.classList.contains("row-divergente")) passaStatus = false;
            if (filtroStatus === "SOBRAS" && !linha.classList.contains("row-sobras")) passaStatus = false;
            if (filtroStatus === "NAO_LOCALIZADO" && !linha.classList.contains("row-nao-localizado")) passaStatus = false;
            if (filtroStatus === "PENDENTE" && !linha.classList.contains("row-pendente")) passaStatus = false;
        }

        if (passaBusca && passaStatus) {
            linha.style.display = "";
        } else {
            linha.style.display = "none";
        }
    });
}
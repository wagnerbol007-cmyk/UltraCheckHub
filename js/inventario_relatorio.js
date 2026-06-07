// js/inventario_relatorio.js
// StockFlow v2.3.1
// Relatórios separados:
// 1ª Busca  -> sinc_rfid_primeira/{loja}
// 2ª Busca  -> sinc_rfid_segunda/{loja}

import { state, normalizarCodigo } from './state.js';
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

export function gerarHistAuditoria(tipo) {
    document.getElementById('overlay').style.display = 'flex';

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

    const container = document.getElementById('histRelatorioInv');
    container.innerHTML = "";

    lista.forEach((it) => {
        const resposta = state.respostasInventarioNuvem[it.Material];

        const val = obterQuantidadeResposta(resposta);
        const operador = obterOperadorResposta(resposta);
        const dataHora = obterDataHoraResposta(resposta);

        const info = state.dbSap[it.Material] || {};
        const moj = state.dbMojixGlobal[it.Material] || {};

        const d = document.createElement('div');

        d.style = `
            padding: 15px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 0.85em;
            ${val ? 'background: #f0fdf4; border-left: 8px solid #22c55e;' : ''}
        `;

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

        d.innerHTML = `
            <span style="font-size:0.7em;">
                EAN: ${info.EAN || '---'} | TAM: ${tam}
            </span><br>

            <b>${it.Material}</b> -
            <span style="font-size:0.85em; color:#6200ee;">
                ${nomeExibicao}
            </span>

            <div style="display:flex; justify-content:space-between; margin-top:5px; font-weight:800; color:#64748b; background:rgba(0,0,0,0.03); padding:8px; border-radius:10px; font-size:0.75em;">
                <span>EXP: ${moj.Expected || 0}</span>
                <span>LIDO: ${moj.Counted || 0}</span>
                <span>MÃO: ${val || "Vazio"}</span>
            </div>

            ${operador ? `
                <div style="margin-top:8px; font-size:0.72em; color:#64748b; font-weight:700;">
                    👤 Operador: ${operador}${dataHora ? ` • ${dataHora}` : ""}
                </div>
            ` : ""}
        `;

        container.appendChild(d);
    });

    document.getElementById('overlay').style.display = 'none';
}

export function baixarCSVInventario() {
    const tipo = state.modoInventario || 'padrao';

    let csv = "\ufeffSKU;EAN;TAMANHO;NOME;ESPERADO;LIDO;ACHADO_MAO;OPERADOR;DATA_HORA\n";

    document.getElementById('histRelatorioInv').querySelectorAll('b').forEach(node => {
        const sku = node.innerText;

        const info = state.dbSap[sku] || {};
        const moj = state.dbMojixGlobal[sku] || {};

        const resposta = state.respostasInventarioNuvem[sku];

        const qtd = obterQuantidadeResposta(resposta);
        const operador = obterOperadorResposta(resposta);
        const dataHora = obterDataHoraResposta(resposta);

        const nome = (
            info["Descrição material"] ||
            info["Texto breve material"] ||
            moj["SKU Description"] ||
            "Sem Nome"
        ).replace(/;/g, " ");

        let tam = "";

        for (let key in info) {
            if (key.toLowerCase().includes("tam")) tam = info[key];
        }

        if (info.Tamanho) tam = info.Tamanho;

        csv += `${sku};${info.EAN || ''};${tam};${nome};${moj.Expected || 0};${moj.Counted || 0};${qtd};${operador};${dataHora}\n`;
    });

    const nomeArquivo =
        tipo === 'padrao'
            ? `Auditoria_1_Busca_Lj${state.lojaAtual}.csv`
            : `Auditoria_2_Busca_Lj${state.lojaAtual}.csv`;

    const blob = new Blob([csv], {
        type: 'text/csv;charset=utf-8;'
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = nomeArquivo;
    link.click();
}

export function limparColetaInventario(tipo = null) {
    const tipoFinal = tipo || state.modoInventario || 'padrao';

    const nomeBusca =
        tipoFinal === 'padrao'
            ? "1ª Busca"
            : "2ª Busca";

    if (!confirm(`Deseja apagar somente a coleta da ${nomeBusca}?`)) {
        return;
    }

    const caminho = getCaminhoColetaPorTipo(tipoFinal);

    database.ref(caminho).remove().then(() => {
        alert(`Coleta da ${nomeBusca} apagada com sucesso!`);

        state.respostasInventarioNuvem = {};

        const container = document.getElementById('histRelatorioInv');
        if (container) container.innerHTML = "";
    });
}
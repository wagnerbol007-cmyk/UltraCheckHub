// js/inventario_core.js
// StockFlow v3.0.2
// Coletas separadas:
// 1ª Busca  -> sinc_rfid_primeira/{loja}
// 2ª Busca  -> sinc_rfid_segunda/{loja}

import { state, normalizarCodigo } from './state.js';
import { database } from './firebase.js';
import { mudarTela } from './ui.js';

function getCaminhoColetaInventario() {
    if (state.modoInventario === 'padrao') {
        return `sinc_rfid_primeira/${state.lojaAtual}`;
    }
    return `sinc_rfid_segunda/${state.lojaAtual}`;
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

export function abrirModoInventario(modo, label) {
    document.getElementById('overlay').style.display = 'flex';

    state.modoInventario = modo;
    state.indiceInventario = 0;
    state.listaInventarioOriginal = [];

    database.ref('arquivos_lojas/' + state.lojaAtual).once('value', snapshot => {
        const d = snapshot.val() || {};

        if (modo === 'padrao') {
            state.listaInventarioOriginal = Object.keys(state.dbMojixGlobal)
                // CORREÇÃO AQUI: !== 0 garante que puxa tudo com divergência (Faltas e Sobras)
                .filter(k => parseInt(state.dbMojixGlobal[k].Remaining) !== 0)
                .map(k => ({ Material: k }));
        } else {
            state.listaInventarioOriginal = JSON.parse(d.busca || "[]")
                .map(r => ({
                    Material: normalizarCodigo(
                        r.Material ||
                        r.SKU ||
                        Object.values(r)[0]
                    )
                }))
                .filter(x => x.Material && x.Material !== "undefined");
        }

        state.listaInventarioFiltrada = [...state.listaInventarioOriginal];

        document.getElementById('labelBuscaNome').innerText = label;
        
        const selectCat = document.getElementById('filtroCategoria');
        if (selectCat) selectCat.value = "TODAS";
        
        const selectDiv = document.getElementById('filtroDivergencia');
        if (selectDiv) selectDiv.value = "TODOS";

        let cats = new Set();
        Object.values(state.dbMojixGlobal).forEach(m => {
            if (m['Dept Name']) cats.add(m['Dept Name']);
        });

        if (selectCat) {
            selectCat.innerHTML = '<option value="TODAS">TODAS AS CATEGORIAS</option>';
            Array.from(cats).sort().forEach(c => {
                selectCat.innerHTML += `<option value="${c}">${c}</option>`;
            });
            selectCat.innerHTML += '<option value="MANUAL">📦 ITENS MANUAIS</option>';
        }

        if (selectDiv) {
            selectDiv.innerHTML = `
                <option value="TODOS">📦 TODOS OS ITENS</option>
                <option value="SOBRAS">📈 APENAS SOBRAS (Lido > Esperado)</option>
                <option value="FALTAS">📉 APENAS FALTAS (Lido < Esperado)</option>
            `;
        }

        iniciarAppInventario();
    });
}

function iniciarAppInventario() {
    const caminho = getCaminhoColetaInventario();

    database.ref(caminho).on('value', s => {
        state.respostasInventarioNuvem = s.val() || {};

        renderInventario();
        atualizarChecklistInv(
            document.getElementById('listaProgresso'),
            state.listaInventarioFiltrada
        );
        atualizarBarraProgressoInv();

        document.getElementById('overlay').style.display = 'none';
        mudarTela('viewInventarioApp');
    });
}

export function aplicarFiltrosInventario() {
    const cat = document.getElementById('filtroCategoria') ? document.getElementById('filtroCategoria').value : "TODAS";
    const divTipo = document.getElementById('filtroDivergencia') ? document.getElementById('filtroDivergencia').value : "TODOS";

    // 1. Filtro por Categoria
    let listaTemp = [];
    if (cat === "TODAS") {
        listaTemp = [...state.listaInventarioOriginal];
    } else if (cat === "MANUAL") {
        listaTemp = state.listaInventarioOriginal.filter(it => !state.dbMojixGlobal[it.Material]);
    } else {
        listaTemp = state.listaInventarioOriginal.filter(it =>
            state.dbMojixGlobal[it.Material] &&
            state.dbMojixGlobal[it.Material]['Dept Name'] === cat
        );
    }

    // 2. Filtro por Sobras ou Faltas
    if (divTipo === "SOBRAS") {
        listaTemp = listaTemp.filter(it => {
            const moj = state.dbMojixGlobal[it.Material] || {};
            const exp = Number(moj.Expected || 0);
            const lido = Number(moj.Counted || 0);
            return lido > exp;
        });
    } else if (divTipo === "FALTAS") {
        listaTemp = listaTemp.filter(it => {
            const moj = state.dbMojixGlobal[it.Material] || {};
            const exp = Number(moj.Expected || 0);
            const lido = Number(moj.Counted || 0);
            return lido < exp;
        });
    }

    state.listaInventarioFiltrada = listaTemp;
    state.indiceInventario = 0;
    renderInventario();
    atualizarChecklistInv(
        document.getElementById('listaProgresso'),
        state.listaInventarioFiltrada
    );
    atualizarBarraProgressoInv();
}

// Mantém compatibilidade com chamadas antigas
export const aplicarFiltroCategoriaInv = aplicarFiltrosInventario;

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

function atualizarBarraProgressoInv() {
    const total = state.listaInventarioFiltrada.length;
    const respondidos = state.listaInventarioFiltrada.filter(it => {
        const resposta = state.respostasInventarioNuvem[it.Material];
        return obterQuantidadeResposta(resposta);
    }).length;

    const porc = total > 0 ? Math.round((respondidos / total) * 100) : 0;

    document.getElementById('progressBarInv').style.width = porc + "%";
    document.getElementById('labelProgressoPercent').innerText =
        `Progresso: ${porc}% (${respondidos}/${total})`;
}

export function renderInventario() {
    if (!state.listaInventarioFiltrada[state.indiceInventario]) return;

    const sku = state.listaInventarioFiltrada[state.indiceInventario].Material;
    const info = state.dbSap[sku] || {};
    const moj = state.dbMojixGlobal[sku] || {};
    const resposta = state.respostasInventarioNuvem[sku];
    const corProduto = extrairCorSAP(info);

    // Imagem
    document.getElementById('viewImgInv').src = `https://imgcentauro-a.akamaihd.net/768x768/${sku.substring(0, 8)}.jpg`;

    // Nome e Cor separados
    document.getElementById('viewNomeInv').innerText = info["Descrição material"] || info["Texto breve material"] || moj["SKU Description"] || "NÃO CADASTRADO NO SAP";
    document.getElementById('viewCorInv').innerText = corProduto || "SEM COR REGISTRADA";
    
    // Dados
    document.getElementById('viewSKUInv').innerText = sku;
    document.getElementById('viewEANInv').innerText = info.EAN || "---";

    let tam = "--";
    for (let key in info) {
        if (key.toLowerCase().includes("tam")) tam = info[key];
    }
    if (info.Tamanho) tam = info.Tamanho;
    document.getElementById('viewTamanhoInv').innerText = tam;

    // Estatísticas (Apenas na 1ª Busca)
    document.getElementById('statsAreaInv').style.display = (state.modoInventario === 'padrao' ? 'grid' : 'none');

    if (state.modoInventario === 'padrao') {
        const exp = Number(moj.Expected || 0);
        const lido = Number(moj.Counted || 0);
        const dif = lido - exp; // Cálculo da diferença (Lido - Esperado)

        document.getElementById('viewExpInv').innerText = exp;
        document.getElementById('viewCountInv').innerText = lido;
        
        const boxDif = document.getElementById('boxDifInv');
        const labelDif = document.getElementById('labelDifInv');
        const viewDif = document.getElementById('viewDifInv');

        boxDif.className = 'inv-stat-box'; // Reseta as classes de cor

        if (dif < 0) {
            boxDif.classList.add('dif-negativa'); // Fica Vermelho
            labelDif.innerText = "⚠️ DIF";
            viewDif.innerText = dif;
        } else if (dif > 0) {
            boxDif.classList.add('dif-positiva'); // Fica Azul
            labelDif.innerText = "📈 DIF";
            viewDif.innerText = "+" + dif;
        } else {
            labelDif.innerText = "✅ DIF";
            viewDif.innerText = "0";
        }
    }

    document.getElementById('contadorInv').innerText =
        (state.indiceInventario + 1).toString().padStart(2, '0') + " / " + state.listaInventarioFiltrada.length;

    document.getElementById('inputAchadoInv').value = obterQuantidadeResposta(resposta);

    // ==========================================
    // CONTROLO DO BOTÃO ESPIAR (FORÇA A REGRA)
    // ==========================================
    const btnEspiar = document.getElementById('btnEspiarInv');
    if (btnEspiar) {
        if (state.modoInventario === 'padrao') {
            // 1ª BUSCA: Oculta o botão (já tem as caixas grandes)
            btnEspiar.style.setProperty('display', 'none', 'important');
        } else {
            // 2ª BUSCA: Mostra o botão
            btnEspiar.style.setProperty('display', 'flex', 'important');
        }
    }
}

// NOVA FUNÇÃO: Botões de + e -
export function alterarQtdInv(valorAjuste) {
    const inputQtd = document.getElementById('inputAchadoInv');
    let atual = parseInt(inputQtd.value) || 0;
    atual += valorAjuste;
    
    if (atual < 0) atual = 0; // Não deixa ficar negativo
    
    inputQtd.value = atual;
    salvarContagemRemota(); // Salva no Firebase imediatamente
}

export function navegarInventario(p) {
    state.indiceInventario += p;
    if (state.indiceInventario < 0) state.indiceInventario = 0;
    if (state.indiceInventario >= state.listaInventarioFiltrada.length) {
        state.indiceInventario = state.listaInventarioFiltrada.length - 1;
    }
    renderInventario();
}

export function salvarContagemRemota() {
    const itemAtual = state.listaInventarioFiltrada[state.indiceInventario];
    if (!itemAtual) return;

    const sku = itemAtual.Material;
    const qtd = document.getElementById('inputAchadoInv').value;
    const caminho = getCaminhoColetaInventario();

    if (!qtd) {
        database.ref(`${caminho}/${sku}`).remove();
        return;
    }

    database.ref(`${caminho}/${sku}`).set({
        quantidade: qtd,
        operador: state.operador || "DESCONHECIDO",
        dataHora: new Date().toLocaleString("pt-BR")
    });
}

export function espiarMojix() {
    const m = state.dbMojixGlobal[state.listaInventarioFiltrada[state.indiceInventario].Material];
    alert(m ? `ESP: ${m.Expected} | LIDO: ${m.Counted}` : "Sem dados de RFID para este item.");
}

function atualizarChecklistInv(container, lista) {
    if (!container) return;
    container.innerHTML = "";

    lista.forEach((it, i) => {
        const resposta = state.respostasInventarioNuvem[it.Material];
        const val = obterQuantidadeResposta(resposta);
        const operador = obterOperadorResposta(resposta);
        const dataHora = obterDataHoraResposta(resposta);

        const info = state.dbSap[it.Material] || {};
        const moj = state.dbMojixGlobal[it.Material] || {};
        const base8 = it.Material.substring(0, 8);
        const corProduto = extrairCorSAP(info);

        const d = document.createElement('div');
        d.className = `check-item ${val ? 'concluido' : ''}`;
        d.style.background = "#fff";
        d.style.padding = "15px";
        d.style.borderBottom = "1px solid #f1f5f9";
        d.style.borderRadius = "15px";
        d.style.marginBottom = "10px";
        d.style.fontSize = "0.85em";
        d.style.textAlign = "left";
        d.style.cursor = "pointer";
        d.style.boxShadow = "0 4px 10px rgba(0,0,0,0.03)";

        if (val) {
            d.style.background = "#f0fdf4";
            d.style.borderLeft = "8px solid #22c55e";
        }

        let nomeExibicao = info["Descrição material"] || info["Texto breve material"] || moj["SKU Description"] || "Item s/ Nome";
        if (corProduto) nomeExibicao += ` <span style="color:#64748b; font-weight:normal;">(${corProduto})</span>`;

        let tam = "--";
        for (let key in info) {
            if (key.toLowerCase().includes("tam")) tam = info[key];
        }
        if (info.Tamanho) tam = info.Tamanho;

        d.onclick = () => {
            state.indiceInventario = i;
            renderInventario();
            if (container.id !== 'listaProgresso') mudarTela('viewInventarioApp');
            window.scrollTo(0, 0);
        };

        d.innerHTML = `
            <div style="display: flex; gap: 15px; align-items: center;">
                <img src="https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg"
                    style="width: 60px; height: 60px; border-radius: 10px; border: 1px solid #eee; object-fit: contain; background: white;">

                <div style="flex: 1;">
                    <span style="font-size:0.7em;">EAN: ${info.EAN || '---'} | TAM: ${tam}</span><br>
                    <b>${it.Material}</b> -
                    <span style="font-size:0.85em; color:#6200ee;">${nomeExibicao}</span>
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; margin-top:12px; font-weight:800; color:#64748b; background:rgba(0,0,0,0.03); padding:8px 12px; border-radius:10px; font-size:0.75em;">
                <span>EXP: ${moj.Expected || 0}</span>
                <span>LIDO: ${moj.Counted || 0}</span>
                <span>MÃO: ${val || "Vazio"}</span>
            </div>

            ${operador ? `
                <div style="margin-top:8px; font-size:0.72em; color:#64748b; font-weight:700;">
                    👤 Última contagem: ${operador}${dataHora ? ` • ${dataHora}` : ""}
                </div>
            ` : ""}
        `;

        container.appendChild(d);
    });
}

/* =========================================
   SWIPE INVENTÁRIO
========================================= */

let startXInv = 0;
let endXInv = 0;

setTimeout(() => {
    const area = document.getElementById('gestureZoneInv');

    if (area) {
        area.addEventListener('touchstart', (e) => {
            startXInv = e.changedTouches[0].screenX;
        }, { passive: true });

        area.addEventListener('touchend', (e) => {
            endXInv = e.changedTouches[0].screenX;

            const diff = endXInv - startXInv;

            if (diff < -60) navegarInventario(1);
            if (diff > 60) navegarInventario(-1);
        }, { passive: true });
    }
}, 1000);
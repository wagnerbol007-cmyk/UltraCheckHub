// js/reman.js
import { state, normalizarCodigo, getHoraCerta } from './state.js';
import { database } from './firebase.js';

const SVG_BOX = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
const SVG_CHECK = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const SVG_SEARCH = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>`;

function extrairInfoSAP(item) {
    let saldo = 0, tam = "---";
    for(let key in item) {
        let k = key.toLowerCase();
        if(k.includes("utiliza") || k.includes("estoque") || k.includes("saldo")) saldo = parseInt(item[key] || 0);
        if(k.includes("tamanho") || k.includes("tam") || k.includes("caracter")) tam = String(item[key]);
    }
    return { saldo, tam };
}

function criarDicionariosSap() {
    const dictSKU = {};
    const dictEAN = {};
    const gradePorBase8 = {};

    if (state.sapCompleto) {
        state.sapCompleto.forEach(sapItem => {
            let sku = normalizarCodigo(sapItem.Material || sapItem.SKU);
            let ean = normalizarCodigo(sapItem.EAN);
            
            if (sku) {
                dictSKU[sku] = sapItem;
                let base8 = sku.substring(0, 8);
                if (!gradePorBase8[base8]) gradePorBase8[base8] = [];
                gradePorBase8[base8].push(sku);
            }
            if (ean) dictEAN[ean] = sapItem;
        });
    }
    return { dictSKU, dictEAN, gradePorBase8 };
}

function traduzirParaSKU13(item, dicionarios) {
    let cod = normalizarCodigo(item.SKU || item.Material || item.EAN);
    if (!cod) return null;
    if (dicionarios.dictSKU[cod]) return normalizarCodigo(dicionarios.dictSKU[cod].Material || dicionarios.dictSKU[cod].SKU);
    if (dicionarios.dictEAN[cod]) return normalizarCodigo(dicionarios.dictEAN[cod].Material || dicionarios.dictEAN[cod].SKU);
    return cod;
}

export async function biparReman(bip) {
    const dicionarios = criarDicionariosSap();
    
    window.app.salvarColetaParcial = function(base8) {
        const itensNaTela = Array.from(document.querySelectorAll(`[id^="qtd-reman-${base8}"]`));
        let pacotaoDeAtualizacoes = {};

        itensNaTela.forEach(spanNumero => {
            let sku13 = spanNumero.id.replace('qtd-reman-', '');
            let qtdLocal = Number(spanNumero.innerText) || 0;
            
            let itemSap = dicionarios.dictSKU[sku13];
            let info = extrairInfoSAP(itemSap || {});
            
            pacotaoDeAtualizacoes[`status_reman_loja/${state.lojaAtual}/${sku13}`] = {
                qtd: qtdLocal,
                quem: state.operador,
                hora: getHoraCerta(),
                saldo_sap: info.saldo
            };
        });

        document.getElementById('cardBipResultadoTop').style.display = "none";
        document.body.style.overflow = ""; 
        
        const modalCamera = document.getElementById('modalScannerReman');
        if (modalCamera) modalCamera.style.display = "none";
        
        const inputBip = document.getElementById('inputBipReman');
        if (inputBip) inputBip.value = "";
        
        window.mostrarAviso("Salvando coleta...", "sucesso");

        Promise.resolve().then(() => {
            database.ref().update(pacotaoDeAtualizacoes).then(() => {
                console.log("Coleta salva.");
            }).catch(erro => {
                window.mostrarAviso("Erro ao salvar: " + erro.message, "erro");
            });
        });
    };

    const bipLimpo = normalizarCodigo(bip);
    const cardTop = document.getElementById('cardBipResultadoTop');
    const tagTop = document.getElementById('tagFeedbackTop');
    const corpoTop = document.getElementById('corpoFeedbackTop');

    document.getElementById('inputBipReman').value = "";

    const modalCamera = document.getElementById('modalScannerReman');
    if (modalCamera) modalCamera.style.display = "none";

    document.body.style.overflow = "hidden";

    if (cardTop) {
        cardTop.style.position = "fixed";
        cardTop.style.top = "50%";
        cardTop.style.left = "50%";
        cardTop.style.transform = "translate(-50%, -50%)"; 
        cardTop.style.width = "92%";
        cardTop.style.maxWidth = "420px";
        cardTop.style.maxHeight = "92vh"; 
        cardTop.style.zIndex = "9999";
        cardTop.style.boxShadow = "0 20px 50px rgba(0,0,0,0.6)";
        cardTop.style.backgroundColor = "#ffffff";
        cardTop.style.display = "flex"; 
        cardTop.style.flexDirection = "column"; 
        cardTop.style.borderRadius = "16px";
        cardTop.style.overflow = "hidden"; 
    }

    if (corpoTop) {
        corpoTop.style.display = "flex";
        corpoTop.style.flexDirection = "column";
        corpoTop.style.flexGrow = "1";
        corpoTop.style.overflow = "hidden";
    }

    const itemNoSap = dicionarios.dictSKU[bipLimpo] || dicionarios.dictEAN[bipLimpo];
    
    let sku13Sap = bipLimpo;
    let base8 = bipLimpo.substring(0, 8);
    let descricaoItem = "Produto Desconhecido";

    if (itemNoSap) {
        sku13Sap = normalizarCodigo(itemNoSap.Material || itemNoSap.SKU);
        base8 = sku13Sap.substring(0, 8);
        descricaoItem = itemNoSap["Descrição material"] || itemNoSap["Texto breve material"] || "Produto Reman";
    } else {
        const itemNoReman = state.dadosReman.find(i => normalizarCodigo(i.SKU || i.Material || i.EAN) === bipLimpo);
        if (itemNoReman) {
            sku13Sap = traduzirParaSKU13(itemNoReman, dicionarios) || bipLimpo;
            base8 = sku13Sap.substring(0, 8);
            descricaoItem = itemNoReman["Descrição material"] || itemNoReman["Texto breve material"] || "Produto Reman";
        } else {
            const temNoReman = state.dadosReman.some(i => (traduzirParaSKU13(i, dicionarios) || "").startsWith(base8));
            if (!temNoReman) {
                tocarSomScanner('erro');
                if (cardTop) cardTop.style.borderLeftColor = "var(--danger)";
                if (tagTop) {
                    tagTop.style.background = "var(--danger)";
                    tagTop.classList.remove("reman-laranja");
                    tagTop.innerText = "PRODUTO NÃO LOCALIZADO";
                }
                if (corpoTop) {
                    corpoTop.innerHTML = `
                        <div style="font-size:0.9em; font-weight:700; color:#0f172a; margin-bottom:15px; padding:10px 0;">O código ${bip} não foi localizado na base do SAP e nem na lista de Remanejamento.</div>
                        <div style="margin-top:auto;">
                            <button class="btn-main" style="width:100%; background:#ef4444; border:none; padding:14px; border-radius:10px; color:white; font-weight:bold; cursor:pointer;" onclick="document.getElementById('cardBipResultadoTop').style.display='none'; document.body.style.overflow='';">FECHAR</button>
                        </div>
                    `;
                }
                return;
            }
        }
    }

    const pertenceAoReman = state.dadosReman.some(i => {
        let skuPlanilha = traduzirParaSKU13(i, dicionarios);
        return skuPlanilha && skuPlanilha.substring(0, 8) === base8;
    });

    if (pertenceAoReman) {
        tocarSomScanner('reman');
        if (cardTop) cardTop.style.borderLeftColor = "#f97316";
        if (tagTop) {
            tagTop.style.background = "linear-gradient(135deg, #f97316, #c2410c)";
            tagTop.style.color = "#ffffff";
            tagTop.style.boxShadow = "0 10px 24px rgba(249,115,22,0.35)";
            tagTop.style.border = "none";
            tagTop.classList.add("reman-laranja");
            tagTop.innerText = "SEPARAR PARA REMANEJAMENTO";
        }

        const gradeCompletaSap = dicionarios.gradePorBase8[base8] || [];
        
        const promessas = gradeCompletaSap.map(async (skuReman13) => {
            const itemSap = dicionarios.dictSKU[skuReman13];
            const info = extrairInfoSAP(itemSap || {});

            const snap = await database.ref(`status_reman_loja/${state.lojaAtual}/${skuReman13}`).once("value");
            let valDb = snap.val() || {};
            let qtd = Number(valDb.qtd || 0);
            const saldo = Number(info.saldo || 0);

            if (qtd > 0 && valDb.saldo_sap !== undefined && saldo < valDb.saldo_sap) {
                let diferenca = valDb.saldo_sap - saldo;
                qtd = qtd - diferenca;
                if (qtd < 0) qtd = 0;
                database.ref(`status_reman_loja/${state.lojaAtual}/${skuReman13}`).update({ qtd: qtd, saldo_sap: saldo });
            }

            let bgCor = '#ffffff'; 
            let bordaCor = '#e2e8f0'; 

            if (qtd > 0) {
                if (saldo === 0 || qtd >= saldo) {
                    bgCor = '#dcfce7'; 
                    bordaCor = '#22c55e';
                } else {
                    bgCor = '#fff7ed'; 
                    bordaCor = '#fb923c';
                }
            }
            
            return `
            <div id="linha-reman-top-${skuReman13}" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:10px; border:1px solid ${bordaCor}; border-radius:12px; background:${bgCor}; transition: 0.3s ease;">
                <div>
                    <b style="font-size: 1.05em; color:#0f172a;">TAM ${info.tam}</b><br>
                    <span style="font-size:11px; color:#64748b;">Estoque SAP: <b style="color:#0f172a;">${saldo}</b></span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <button style="padding:6px 12px; font-weight:bold; border:1px solid #cbd5e1; border-radius:6px; background:#fff; color:#0f172a; cursor:pointer;" onclick="app.diminuirReman('${skuReman13}', ${saldo})">−</button>
                    <span id="qtd-reman-${skuReman13}" style="font-size:18px; font-weight:bold; min-width:30px; text-align:center; color:#2563eb;">
                        ${qtd}
                    </span>
                    <button style="padding:6px 12px; font-weight:bold; border:1px solid #cbd5e1; border-radius:6px; background:#fff; color:#0f172a; cursor:pointer;" onclick="app.aumentarReman('${skuReman13}',${saldo})">+</button>
                </div>
            </div>
            `;
        });

        const linhasResolvidas = await Promise.all(promessas);
        const linesTopHtml = linhasResolvidas.join('');

        if (corpoTop) {
            corpoTop.innerHTML = `
                <div style="display:flex;align-items:center;gap:12px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0;">
                    <img src="https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg" style="width:60px;height:60px;cursor:pointer; border-radius:8px; object-fit:contain;" onclick="app.zoomFoto(this.src)">
                    <div style="flex:1;">
                        <b style="color:#0f172a; font-size:13px; line-height:1.2; display:block;">${descricaoItem}</b>
                        <span style="color:#64748b; font-size:12px;">REF: ${base8}</span>
                    </div>
                </div>
                <div style="overflow-y: auto; overscroll-behavior: contain; max-height: 48vh; padding-right: 5px; margin-top: 12px; margin-bottom: 12px; flex-grow: 1;">
                    ${linesTopHtml}
                </div>
                <div style="flex-shrink: 0; display:flex; flex-direction:column; gap:8px;">
                    <button class="btn-main" style="width:100%; background:#22c55e; border:none; padding:14px; border-radius:10px; color:white; font-weight:bold; cursor:pointer;" onclick="app.salvarColetaParcial('${base8}')">
                        SALVAR QUANTIDADES
                    </button>
                    <button class="btn-main" style="width:100%; background:#ef4444; border:none; padding:14px; border-radius:10px; color:white; font-weight:bold; cursor:pointer;" onclick="document.getElementById('cardBipResultadoTop').style.display='none'; document.body.style.overflow='';">
                        FECHAR
                    </button>
                </div>
            `;
        }
    } else {
        tocarSomScanner('erro');
        if (cardTop) cardTop.style.borderLeftColor = "var(--success)";
        if (tagTop) {
            tagTop.style.background = "var(--success)";
            tagTop.classList.remove("reman-laranja");
            tagTop.innerText = "NÃO PERTENCE AO REMANEJAMENTO";
        }
        if (corpoTop) {
            corpoTop.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #f1f5f9;">
                    <img src="https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg" style="width:60px; height:60px; cursor:pointer; border-radius:8px; object-fit:contain;" onclick="app.zoomFoto(this.src)">
                    <div style="flex:1; line-height:1.2;">
                        <b style="color:#0f172a; font-size:13px;">${descricaoItem}</b><br>
                        <span style="color:var(--success); font-weight:800; font-size:11px;">MANTENHA NO ESTOQUE NORMAL</span>
                    </div>
                </div>
                <div style="margin-top:auto;">
                    <button class="btn-main" style="width:100%; background:#64748b; border:none; padding:14px; border-radius:10px; color:white; font-weight:bold; cursor:pointer;" onclick="document.getElementById('cardBipResultadoTop').style.display='none'; document.body.style.overflow='';">FECHAR</button>
                </div>
            `;
        }
    }
}

export function aumentarReman(sku13, saldoTotal) {
    const saldo = Number(saldoTotal);
    const spanNumero = document.getElementById(`qtd-reman-${sku13}`);
    if (spanNumero) {
        let qtdLocal = Number(spanNumero.innerText) || 0;
        if (saldo === 0 || qtdLocal < saldo) {
            qtdLocal++;
            spanNumero.innerText = qtdLocal; 
            const linha = document.getElementById(`linha-reman-top-${sku13}`);
            if (linha) {
                linha.style.background = (saldo > 0 && qtdLocal < saldo) ? '#fff7ed' : '#dcfce7';
                linha.style.borderColor = (saldo > 0 && qtdLocal < saldo) ? '#fb923c' : '#22c55e';
            }
        }
    }
}

export function diminuirReman(sku13, saldoTotal) {
    const saldo = Number(saldoTotal);
    const spanNumero = document.getElementById(`qtd-reman-${sku13}`);
    if (spanNumero) {
        let qtdLocal = Number(spanNumero.innerText) || 0;
        if (qtdLocal > 0) {
            qtdLocal--;
            spanNumero.innerText = qtdLocal;
            const linha = document.getElementById(`linha-reman-top-${sku13}`);
            if (linha) {
                linha.style.background = qtdLocal === 0 ? '#ffffff' : ((saldo > 0 && qtdLocal < saldo) ? '#fff7ed' : '#dcfce7');
                linha.style.borderColor = qtdLocal === 0 ? '#e2e8f0' : ((saldo > 0 && qtdLocal < saldo) ? '#fb923c' : '#22c55e');
            }
        }
    }
}

export function renderizarListaCompletaReman() {
    const container = document.getElementById('remanListaSincronizada');
    if (!container) return;

    const dicionarios = criarDicionariosSap();
    database.ref(`status_reman_loja/${state.lojaAtual}`).off('value');
    database.ref(`status_reman_loja/${state.lojaAtual}`).on('value', snapshot => {
        const statusDb = snapshot.val() || {};
        const listaJaRenderizada = document.getElementById('reman-cards-container');
        let pacotaoAutoHealing = {};

        if (listaJaRenderizada) {
            let totalColetado = 0;
            const totalEsperado = Number(container.getAttribute('data-total-esperado') || 0);

            const spans = document.querySelectorAll('[id^="qtd-reman-lista-"]');
            spans.forEach(spanNumero => {
                let sku = spanNumero.id.replace('qtd-reman-lista-', '');
                const itemSap = dicionarios.dictSKU[sku];
                const info = extrairInfoSAP(itemSap || {});
                let registro = statusDb[sku] || { qtd: 0 };
                let ticado = Number(registro.qtd || 0);

                if (ticado > 0 && registro.saldo_sap !== undefined && info.saldo < registro.saldo_sap) {
                    let diferenca = registro.saldo_sap - info.saldo;
                    ticado = ticado - diferenca;
                    if (ticado < 0) ticado = 0;
                    pacotaoAutoHealing[sku] = { qtd: ticado, saldo_sap: info.saldo };
                }

                totalColetado += ticado;
                spanNumero.innerText = ticado;

                const linha = document.getElementById(`linha-reman-lista-${sku}`);
                const btnStatus = document.getElementById(`btn-status-lista-${sku}`);
                const textQtd = document.getElementById(`texto-qtd-lista-${sku}`);

                if (linha) {
                    linha.style.background = ticado === 0 ? '#ffffff' : ((info.saldo > 0 && ticado < info.saldo) ? '#fffbeb' : '#f0fdf4');
                    linha.style.borderColor = ticado === 0 ? '#e5e7eb' : ((info.saldo > 0 && ticado < info.saldo) ? '#fde68a' : '#bbf7d0');
                }
                if (textQtd) {
                    textQtd.style.color = ticado === 0 ? '#64748b' : ((info.saldo > 0 && ticado < info.saldo) ? '#d97706' : '#15803d');
                }
                if (btnStatus) {
                    btnStatus.style.background = ticado > 0 ? '#10b981' : '#f97316';
                    btnStatus.innerHTML = ticado > 0 ? SVG_CHECK : SVG_BOX;
                }
            });

            if (Object.keys(pacotaoAutoHealing).length > 0) {
                database.ref(`status_reman_loja/${state.lojaAtual}`).update(pacotaoAutoHealing);
            }

            let percent = totalEsperado > 0 ? Math.floor((totalColetado / totalEsperado) * 100) : 0;
            if (percent > 100) percent = 100;
            let corBarra = percent === 100 ? '#10b981' : '#3b82f6';

            const barFill = document.getElementById('remanBarFill');
            const barTxt = document.getElementById('remanBarTxt');
            if (barFill) {
                barFill.style.width = percent + '%';
                barFill.style.background = corBarra;
            }
            if (barTxt) {
                barTxt.innerText = `PROGRESSO DA LOJA: ${totalColetado} / ${totalEsperado} (${percent}%)`;
            }
            return; 
        }

        container.innerHTML = "";
        let agrupado = {};
        let totalEsperado = 0;
        let totalColetado = 0;

        state.dadosReman.forEach(item => {
            let sku = traduzirParaSKU13(item, dicionarios);
            if(!sku) return;
            let base8 = sku.substring(0, 8);
            if (!agrupado[base8]) {
                agrupado[base8] = [];
                if (dicionarios.gradePorBase8[base8]) {
                    dicionarios.gradePorBase8[base8].forEach(sSku => {
                        if (!agrupado[base8].includes(sSku)) agrupado[base8].push(sSku);
                    });
                }
            }
            if(!agrupado[base8].includes(sku)) {
                agrupado[base8].push(sku);
            }
        });

        let gruposComEstoque = [];
        let gruposSemEstoque = [];

        Object.entries(agrupado).forEach(([base8, lista]) => {
            let saldoGrupo = 0;
            lista.forEach(sku13 => {
                const itemSap = dicionarios.dictSKU[sku13];
                const info = extrairInfoSAP(itemSap || {});
                saldoGrupo += info.saldo; 
                totalEsperado += info.saldo; 
                
                let registro = statusDb[sku13] || { qtd: 0 };
                let ticado = Number(registro.qtd || 0);

                if (ticado > 0 && registro.saldo_sap !== undefined && info.saldo < registro.saldo_sap) {
                    let diferenca = registro.saldo_sap - info.saldo;
                    ticado = ticado - diferenca;
                    if (ticado < 0) ticado = 0;
                    pacotaoAutoHealing[sku13] = { qtd: ticado, saldo_sap: info.saldo };
                }
                totalColetado += ticado; 
            });

            if (saldoGrupo === 0) gruposSemEstoque.push({ base8, lista });
            else gruposComEstoque.push({ base8, lista });
        });

        if (Object.keys(pacotaoAutoHealing).length > 0) {
            database.ref(`status_reman_loja/${state.lojaAtual}`).update(pacotaoAutoHealing);
        }

        container.setAttribute('data-total-esperado', totalEsperado);
        let percent = totalEsperado > 0 ? Math.floor((totalColetado / totalEsperado) * 100) : 0;
        if (percent > 100) percent = 100;
        let corBarra = percent === 100 ? '#10b981' : '#3b82f6';
        
        const divProgresso = document.createElement('div');
        divProgresso.style.position = 'fixed';
        divProgresso.style.bottom = '0';
        divProgresso.style.left = '0';
        divProgresso.style.width = '100%';
        divProgresso.style.backgroundColor = '#ffffff';
        divProgresso.style.padding = '12px 20px';
        divProgresso.style.boxShadow = '0 -4px 15px rgba(0,0,0,0.08)';
        divProgresso.style.zIndex = '9997'; 
        divProgresso.style.boxSizing = 'border-box';
        divProgresso.innerHTML = `
            <div style="background:#f1f5f9; border-radius:12px; height:22px; width:100%; position:relative; overflow:hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">
                <div id="remanBarFill" style="height:100%; background:${corBarra}; width:${percent}%; transition: width 0.4s ease;"></div>
                <div id="remanBarTxt" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:0.75em; font-weight:800; color:#0f172a; text-shadow: 0px 0px 2px rgba(255,255,255,0.9);">
                    PROGRESSO DA LOJA: ${totalColetado} / ${totalEsperado} (${percent}%)
                </div>
            </div>
        `;
        container.appendChild(divProgresso);

        const containerCards = document.createElement('div');
        containerCards.id = 'reman-cards-container'; 
        const spacer = document.createElement('div');
        spacer.style.paddingBottom = '70px'; 

        const todosGrupos = [...gruposComEstoque, ...gruposSemEstoque];

        todosGrupos.forEach(grupo => {
            const base8 = grupo.base8;
            const lista = grupo.lista;
            const itemRefSap = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU).startsWith(base8));
            const desc = itemRefSap ? (itemRefSap["Descrição material"] || itemRefSap["Texto breve material"]) : "Produto Reman";
            const card = document.createElement('div');
            
            const isSemEstoque = gruposSemEstoque.includes(grupo);
            const opacityStyle = isSemEstoque ? "opacity: 0.55; filter: grayscale(0.8);" : "";
            const badgeSemEstoque = isSemEstoque ? `<span style="background:#ef4444; color:white; font-size:10px; padding:2px 6px; border-radius:4px; font-weight:bold; margin-left:8px; border: 1px solid #b91c1c;">ZERADO NO SAP</span>` : "";

            let gradeHtml = "";
            lista.forEach(sku13 => {
                const itemSap = dicionarios.dictSKU[sku13];
                const info = itemSap ? extrairInfoSAP(itemSap) : { saldo: 0, tam: "UN" };
                const registro = statusDb[sku13] || { qtd: 0 };
                let ticado = Number(registro.qtd || 0);

                if (ticado > 0 && registro.saldo_sap !== undefined && info.saldo < registro.saldo_sap) {
                    let diferenca = registro.saldo_sap - info.saldo;
                    ticado = ticado - diferenca;
                    if (ticado < 0) ticado = 0;
                }

                let bgCor = ticado === 0 ? '#ffffff' : ((info.saldo > 0 && ticado < info.saldo) ? '#fffbeb' : '#f0fdf4');
                let bordaCor = ticado === 0 ? '#e5e7eb' : ((info.saldo > 0 && ticado < info.saldo) ? '#fde68a' : '#bbf7d0');
                let corTexto = ticado === 0 ? '#64748b' : ((info.saldo > 0 && ticado < info.saldo) ? '#d97706' : '#15803d');
                let statusBtnBg = ticado > 0 ? '#10b981' : '#f97316';
                let statusBtnIcon = ticado > 0 ? SVG_CHECK : SVG_BOX;

                gradeHtml += `
                    <div id="linha-reman-lista-${sku13}" style="background:${bgCor}; border:1px solid ${bordaCor}; padding:12px; margin-bottom:8px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; transition: 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <span style="font-weight:800; font-size:13px; color:#1e293b;">TAM: ${info.tam}</span>
                            <span id="texto-qtd-lista-${sku13}" style="font-size:12px; font-weight:700; color:${corTexto}; display:flex; align-items:center;">
                                <span style="background:rgba(0,0,0,0.04); padding:2px 8px; border-radius:6px; font-variant-numeric: tabular-nums;">
                                    <span id="qtd-reman-lista-${sku13}">${ticado}</span> / ${info.saldo}
                                </span>
                            </span>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button style="display:flex; align-items:center; justify-content:center; width:38px; height:38px; border-radius:10px; border:1px solid #e2e8f0; background:#f8fafc; color:#475569; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.05); transition:0.2s;" onclick="app.gerarQRReman('${info.tam}', '${sku13}')">
                                ${SVG_SEARCH}
                            </button>
                            <button style="display:flex; align-items:center; justify-content:center; height:38px; min-width:44px; padding:0 12px; border-radius:10px; border:1px solid #bfdbfe; background:#eff6ff; color:#2563eb; font-weight:900; font-size:14px; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.05); transition:0.2s;" onclick="app.ticarContadorReman('${sku13}', ${info.saldo})">
                                +1
                            </button>
                            <button id="btn-status-lista-${sku13}" style="display:flex; align-items:center; justify-content:center; height:38px; min-width:44px; padding:0 12px; border-radius:10px; border:none; cursor:pointer; background:${statusBtnBg}; color:white; font-weight:900; font-size:16px; box-shadow:0 2px 4px rgba(0,0,0,0.1); transition:0.2s;" onclick="app.alternarStatusReman('${base8}', '${sku13}')">
                                ${statusBtnIcon}
                            </button>
                        </div>
                    </div>
                `;
            });

            card.innerHTML = `
                <div style="background:#ffffff; border-radius:16px; border:1px solid #e2e8f0; margin-bottom:20px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04); overflow:hidden; ${opacityStyle}">
                    <div style="padding:16px; display:flex; gap:14px; align-items:center; background:#f8fafc; border-bottom:1px solid #f1f5f9;">
                        <div style="width:65px; height:65px; flex-shrink:0; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="app.zoomFoto('https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg')">
                            <img src="https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg" style="max-width:100%; max-height:100%; object-fit:contain;">
                        </div>
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <b style="font-size:13px; color:#0f172a; line-height:1.3; text-transform:uppercase; font-weight:800;">${desc}</b>
                            <span style="font-size:12px; color:#64748b; font-weight:600; display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                                <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#cbd5e1;"></span> REF: ${base8} ${badgeSemEstoque}
                            </span>
                        </div>
                    </div>
                    <div style="padding:16px; background:#ffffff;">
                        ${gradeHtml}
                    </div>
                </div>
            `;
            containerCards.appendChild(card);
        });
        container.appendChild(containerCards);
        container.appendChild(spacer); 
    });
}

export function ticarContadorReman(sku13, saldoTotal) {
    const spanNumero = document.getElementById(`qtd-reman-lista-${sku13}`);
    if (!spanNumero) return;
    let atual = Number(spanNumero.innerText) || 0;
    const saldo = Number(saldoTotal);
    if (saldo === 0) atual++; 
    else atual = (atual < saldo) ? atual + 1 : 0;
    
    spanNumero.innerText = atual;
    const linha = document.getElementById(`linha-reman-lista-${sku13}`);
    const btnStatus = document.getElementById(`btn-status-lista-${sku13}`);
    const textQtd = document.getElementById(`texto-qtd-lista-${sku13}`); 

    if (linha) {
        linha.style.background = atual === 0 ? '#ffffff' : ((saldo > 0 && atual < saldo) ? '#fffbeb' : '#f0fdf4');
        linha.style.borderColor = atual === 0 ? '#e5e7eb' : ((saldo > 0 && atual < saldo) ? '#fde68a' : '#bbf7d0');
    }
    if (textQtd) {
        textQtd.style.color = atual === 0 ? '#64748b' : ((saldo > 0 && atual < saldo) ? '#d97706' : '#15803d');
    }
    if (btnStatus) {
        btnStatus.style.background = atual > 0 ? '#10b981' : '#f97316';
        btnStatus.innerHTML = atual > 0 ? SVG_CHECK : SVG_BOX;
    }
}

export function alternarStatusReman(base8, sku13) {
    const spanNumero = document.getElementById(`qtd-reman-lista-${sku13}`);
    if (!spanNumero) return;
    const qtdLocal = Number(spanNumero.innerText) || 0;
    const ref = database.ref(`status_reman_loja/${state.lojaAtual}/${sku13}`);
    const dicionarios = criarDicionariosSap();
    const itemSap = dicionarios.dictSKU[sku13];
    const info = extrairInfoSAP(itemSap || {});

    window.mostrarAviso("Salvando no sistema...", "sucesso");
    setTimeout(() => {
        ref.update({
            qtd: qtdLocal,
            quem: state.operador,
            hora: getHoraCerta(),
            saldo_sap: info.saldo 
        }).then(() => {
            console.log("Coleta salva.");
        }).catch(erro => {
            window.mostrarAviso("Erro ao salvar: " + erro.message, "erro");
        });
    }, 100);
}

export function exportarRemanExcel() {
    const dicionarios = criarDicionariosSap();
    database.ref(`status_reman_loja/${state.lojaAtual}`).once('value', snapshot => {
        const status = snapshot.val() || {};
        const listaSkus = Object.keys(status);
        if (listaSkus.length === 0) return window.mostrarAviso("Nenhum item separado.", "erro");

        let dadosExportacao = [];
        listaSkus.forEach(sku13 => {
            const registro = status[sku13]; 
            const itemSap = dicionarios.dictSKU[sku13];
            const base8 = sku13.substring(0, 8);
            const descricao = itemSap ? (itemSap["Descrição material"] || itemSap["Texto breve material"]) : "Produto Reman";
            const info = extrairInfoSAP(itemSap || {});

            dadosExportacao.push({
                "SKU 13": sku13,
                "REF (8)": base8,
                "Descrição": descricao,
                "Tamanho": info.tam,
                "Estoque (SAP)": info.saldo,
                "Qtd Separada": registro.qtd || 1, 
                "Quem Separou": registro.quem || "Desconhecido", 
                "Hora": registro.hora || "--:--", 
                "Data/Hora Export": getHoraCerta()
            });
        });
        const ws = XLSX.utils.json_to_sheet(dadosExportacao);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reman Separados");
        XLSX.writeFile(wb, `Reman_Separados_Loja_${state.lojaAtual}.xlsx`);
    });
}
export const exportarReman = exportarRemanExcel;

// =========================================================================
// MÓDULO: HUB DO REMANEJAMENTO E SUGESTÕES (POSSÍVEL REMAN)
// =========================================================================

export function abrirSubTelaReman(tela) {
    const hub = document.getElementById('remanMenuPrincipal');
    const telaConferir = document.getElementById('remanTelaConferir');
    const telaPossivelBipar = document.getElementById('remanTelaPossivelBipar');
    const telaPossivelLista = document.getElementById('remanTelaPossivelLista');

    hub.style.display = 'none';
    telaConferir.style.display = 'none';
    telaPossivelBipar.style.display = 'none';
    telaPossivelLista.style.display = 'none';

    if (tela === 'hub') {
        hub.style.display = 'block';
    } else if (tela === 'conferir') {
        telaConferir.style.display = 'block';
    } else if (tela === 'bipar_possivel') {
        telaPossivelBipar.style.display = 'block';
        document.getElementById('resultadoPossivelReman').innerHTML = '';
        atualizarDashboardPossivelReman();
    } else if (tela === 'lista_possivel') {
        telaPossivelLista.style.display = 'block';
        renderizarListaPossivelReman();
    }
}

function atualizarDashboardPossivelReman() {
    database.ref(`possivel_reman_loja/${state.lojaAtual}`).once("value", snap => {
        let dados = snap.val() || {};
        let totalModelos = Object.keys(dados).length;
        let totalPecas = 0;

        Object.values(dados).forEach(produto => {
            if(produto.tamanhos) {
                Object.values(produto.tamanhos).forEach(tam => {
                    totalPecas += Number(tam.saldo || 0);
                });
            }
        });

        const elSkus = document.getElementById('lblTotalSkusPossivel');
        const elItens = document.getElementById('lblTotalItensPossivel');
        if(elSkus) elSkus.innerText = totalModelos;
        if(elItens) elItens.innerText = totalPecas;
    });
}

// ----------------------------------------------------
// VERIFICAÇÃO INTELIGENTE DE GRADE (Com Tradutor SAP Centauro)
// ----------------------------------------------------
function verificarGradeMinima(itensGrade) {
    let qtds = { P: 0, M: 0, G: 0, GG: 0 };
    let tamanhosDistintos = 0;
    let totalPecas = 0;

    itensGrade.forEach(item => {
        let info = extrairInfoSAP(item);
        let tam = String(info.tam).toUpperCase();
        let saldo = Number(info.saldo);

        if (saldo > 0) {
            tamanhosDistintos++;
            totalPecas += saldo;
        }

        // Identificação com nomes da base SAP Centauro
        if (tam === 'P' || tam === 'S' || tam.includes('PEQUENO')) {
            qtds.P += saldo;
        } else if (tam === 'M' || tam.includes('MEDIO') || tam.includes('MÉDIO')) {
            qtds.M += saldo;
        } else if (tam === 'GG' || tam === 'XL' || tam === 'XG' || tam.includes('GRANDE GRA') || tam.includes('X-GRANDE')) {
            qtds.GG += saldo;
        } else if (tam === 'G' || tam === 'L' || tam.includes('GRANDE')) {
            qtds.G += saldo;
        }
    });

    // 1. Regra para Roupas (1-P, 2-M, 2-G, 1-GG)
    if (qtds.P >= 1 && qtds.M >= 2 && qtds.G >= 2 && qtds.GG >= 1) {
        return true; 
    }

    // 2. Regra Geral / Calçados (Pelo menos 4 tamanhos diferentes e 6 peças totais)
    if (tamanhosDistintos >= 4 && totalPecas >= 6) {
        return true; 
    }

    return false; // Grade está de fato quebrada
}

export async function biparPossivelReman(bip) {
    const input = document.getElementById('inputBipPossivelReman');
    const modal = document.getElementById('modalScannerReman');
    const boxResult = document.getElementById('resultadoPossivelReman');
    const chk = document.getElementById('chkRemanAuto');
    const modoAuto = chk ? chk.checked : false;

    if (input) input.value = '';
    if (modal) modal.style.display = 'none';
    boxResult.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;">Analisando SAP...</div>';

    const codigoLimpo = normalizarCodigo(bip);
    const dicionarios = criarDicionariosSap();
    const itemEncontrado = dicionarios.dictSKU[codigoLimpo] || dicionarios.dictEAN[codigoLimpo];

    if (!itemEncontrado) {
        tocarSomScanner('erro');
        boxResult.innerHTML = `
            <div style="background:#fef2f2; border:1px solid #f87171; border-radius:16px; padding:20px; text-align:center;">
                <b style="color:#991b1b; font-size:1.1em;">Produto Não Localizado!</b><br>
                <span style="color:#ef4444; font-size:0.9em;">O código ${codigoLimpo} não consta na base do SAP.</span>
            </div>`;
        return;
    }

    const sku13 = normalizarCodigo(itemEncontrado.Material || itemEncontrado.SKU);
    const base8 = sku13.substring(0, 8);
    const descricao = itemEncontrado["Descrição material"] || itemEncontrado["Texto breve material"] || "Produto";
    
    const gradeCompletaSAP = (dicionarios.gradePorBase8[base8] || [])
        .map(sku => dicionarios.dictSKU[sku])
        .filter(item => extrairInfoSAP(item).saldo > 0);

    if (gradeCompletaSAP.length === 0) {
        tocarSomScanner('erro');
        boxResult.innerHTML = `
            <div style="background:#fffbeb; border:1px solid #fbbf24; border-radius:16px; padding:20px; text-align:center;">
                <b style="color:#b45309; font-size:1.1em;">Estoque Zerado</b><br>
                <span style="color:#d97706; font-size:0.9em;">Não há saldo físico no SAP para este produto.</span>
            </div>`;
        return;
    }

    const snap = await database.ref(`possivel_reman_loja/${state.lojaAtual}/${base8}`).once("value");
    const jaEstaNaLista = snap.exists();
    const temGrade = verificarGradeMinima(gradeCompletaSAP);

    if (modoAuto && !jaEstaNaLista) {
        if (!temGrade) {
            tocarSomScanner('reman'); 
            salvarPossivelRemanNoBanco(base8, gradeCompletaSAP, descricao);
            window.mostrarAviso("Adicionado! Grade Quebrada.", "sucesso");
            boxResult.innerHTML = ''; 
            atualizarDashboardPossivelReman();
            if(input) input.focus();
            return;
        } else {
            tocarSomScanner('erro'); 
        }
    } else {
        tocarSomScanner('padrao'); 
    }
    
    let htmlGrade = gradeCompletaSAP.map(item => {
        let info = extrairInfoSAP(item);
        return `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; padding:10px 12px; border-radius:10px; margin-bottom:6px;">
            <b style="color:#0f172a; font-size:1em;">TAM ${info.tam}</b>
            <span style="background:#eff6ff; color:#2563eb; padding:4px 10px; border-radius:8px; font-weight:900; font-size:1.1em;">${info.saldo}</span>
        </div>`;
    }).join('');

    let alertaGrade = "";
    if (!jaEstaNaLista && temGrade) {
        alertaGrade = `
        <div style="background:#fffbeb; border:1px solid #fde68a; color:#b45309; padding:12px; border-radius:12px; margin-bottom:15px; font-size:0.85em; line-height:1.4; text-align:center;">
            ⚠️ <b>ATENÇÃO: GRADE COMPLETA!</b><br>
            Este produto possui grade mínima para venda. Deseja realmente sugeri-lo para remanejamento?
        </div>`;
    }

    let botoesAcao = jaEstaNaLista 
        ? `<button class="btn-main" style="background:#ef4444; width:100%; border-radius:12px; font-weight:800;" onclick="app.removerPossivelReman('${base8}')">🗑️ REMOVER DA LISTA</button>`
        : `<button class="btn-main" style="background:#7c3aed; width:100%; border-radius:12px; font-weight:800;" onclick="app.adicionarPossivelReman('${base8}')">➕ ADICIONAR À LISTA</button>`;

    boxResult.innerHTML = `
        <div style="background:${jaEstaNaLista ? "#f0fdf4" : "#ffffff"}; border:2px solid ${jaEstaNaLista ? "#22c55e" : "#e2e8f0"}; border-radius:18px; padding:18px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align:left;">
            ${jaEstaNaLista ? `<div style="background:#22c55e; color:white; font-size:11px; font-weight:900; padding:4px 10px; border-radius:6px; display:inline-block; margin-bottom:12px;">✅ JÁ ADICIONADO</div>` : ''}
            <div style="display:flex; gap:15px; align-items:center; margin-bottom:15px; border-bottom:1px solid #e2e8f0; padding-bottom:15px;">
                <img src="https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg" style="width:70px; height:70px; border-radius:12px; object-fit:contain; border:1px solid #e2e8f0;" onclick="app.zoomFoto(this.src)">
                <div>
                    <b style="color:#0f172a; font-size:14px; line-height:1.2; display:block;">${descricao}</b>
                    <span style="color:#64748b; font-size:12px; margin-top:4px; display:block;">REF: ${base8}</span>
                </div>
            </div>
            ${alertaGrade}
            <div style="margin-bottom:15px;">
                <h5 style="color:#475569; margin:0 0 10px 0; font-size:11px; text-transform:uppercase;">Grade Disponível na Loja</h5>
                ${htmlGrade}
            </div>
            ${botoesAcao}
        </div>
    `;

    window.__produtoTempPossivelReman = { base8: base8, descricao: descricao, itensGrade: gradeCompletaSAP };
}

function salvarPossivelRemanNoBanco(base8, itensGradeSAP, descricao) {
    let dadosSalvar = {
        descricao: descricao,
        adicionadoEm: getHoraCerta(),
        quem: state.operador,
        tamanhos: {}
    };
    itensGradeSAP.forEach(item => {
        let sku13 = normalizarCodigo(item.Material || item.SKU);
        let info = extrairInfoSAP(item);
        dadosSalvar.tamanhos[sku13] = { tam: info.tam, saldo: info.saldo };
    });
    database.ref(`possivel_reman_loja/${state.lojaAtual}/${base8}`).set(dadosSalvar);
}

export function adicionarPossivelReman(base8) {
    const temp = window.__produtoTempPossivelReman;
    if (temp && temp.base8 === base8) {
        salvarPossivelRemanNoBanco(temp.base8, temp.itensGrade, temp.descricao);
        window.mostrarAviso("Produto adicionado à lista!", "sucesso");
        atualizarDashboardPossivelReman();
        biparPossivelReman(base8); 
    }
}

export function removerPossivelReman(base8) {
    database.ref(`possivel_reman_loja/${state.lojaAtual}/${base8}`).remove().then(() => {
        window.mostrarAviso("Removido da lista.", "sucesso");
        atualizarDashboardPossivelReman();
        biparPossivelReman(base8); 
    });
}

export function renderizarListaPossivelReman() {
    const container = document.getElementById('listaCompletaPossivelReman');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;">Carregando lista...</div>';

    database.ref(`possivel_reman_loja/${state.lojaAtual}`).once("value", snap => {
        const dados = snap.val() || {};
        const chaves = Object.keys(dados);

        if (chaves.length === 0) {
            container.innerHTML = `<div style="color:#64748b; font-weight:800; text-align:center;">Nenhum produto adicionado na lista de sugestões.</div>`;
            return;
        }

        let html = '';
        chaves.forEach(base8 => {
            const produto = dados[base8];
            let gradeTags = [];
            let totalPecas = 0;

            Object.values(produto.tamanhos || {}).forEach(t => {
                totalPecas += Number(t.saldo);
                gradeTags.push(`<span style="background:#f1f5f9; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:800; color:#475569;">${t.tam}: ${t.saldo}</span>`);
            });

            html += `
            <div style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:15px; margin-bottom:12px; box-shadow:0 2px 5px rgba(0,0,0,0.02); text-align:left;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="display:flex; gap:12px; flex:1;">
                        <img src="https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg" style="width:50px; height:50px; border-radius:10px; object-fit:contain; border:1px solid #e2e8f0;" onclick="app.zoomFoto(this.src)">
                        <div>
                            <b style="color:#0f172a; font-size:13px; line-height:1.2; display:block;">${produto.descricao}</b>
                            <span style="color:#64748b; font-size:11px; margin-top:4px; display:block;">REF: ${base8} | Peças: ${totalPecas}</span>
                        </div>
                    </div>
                    <button onclick="app.removerPossivelRemanLista('${base8}')" style="background:#fef2f2; color:#ef4444; border:1px solid #fecaca; border-radius:8px; width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
                <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:6px;">
                    ${gradeTags.join('')}
                </div>
            </div>`;
        });
        container.innerHTML = html;
    });
}

export function removerPossivelRemanLista(base8) {
    if (confirm("Remover este produto das solicitações de remanejamento?")) {
        database.ref(`possivel_reman_loja/${state.lojaAtual}/${base8}`).remove().then(() => {
            window.mostrarAviso("Produto excluído da lista.", "sucesso");
            renderizarListaPossivelReman(); 
        });
    }
}

export async function exportarPossivelReman() {
    const snap = await database.ref(`possivel_reman_loja/${state.lojaAtual}`).once("value");
    const dados = snap.val() || {};

    const chaves = Object.keys(dados);
    if (chaves.length === 0) return window.mostrarAviso("A lista está vazia.", "erro");

    let dadosExportacao = [];
    chaves.forEach(base8 => {
        const produto = dados[base8];
        Object.keys(produto.tamanhos).forEach(sku13 => {
            const tamInfo = produto.tamanhos[sku13];
            dadosExportacao.push({
                "REF (8)": base8,
                "SKU 13": sku13,
                "Descrição": produto.descricao,
                "Tamanho": tamInfo.tam,
                "Estoque Loja (SAP)": tamInfo.saldo,
                "Sugerido Por": produto.quem,
                "Data/Hora": produto.adicionadoEm
            });
        });
    });

    const ws = XLSX.utils.json_to_sheet(dadosExportacao);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sugestões de Reman");
    XLSX.writeFile(wb, `Sugestoes_Reman_Loja_${state.lojaAtual}.xlsx`);
}

let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function tocarSomScanner(tipo) {
    initAudio();
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        if (tipo === 'reman') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(900, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.15);
        } else {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(250, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.4);
        }
    } catch (e) {}
}
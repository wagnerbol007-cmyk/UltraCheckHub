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
        if(k.includes("utiliza") || k.includes("estoque")) saldo = parseInt(item[key] || 0);
        if(k.includes("tamanho") || k.includes("tam")) tam = String(item[key]);
    }
    return { saldo, tam };
}

export async function biparReman(bip) {
    
    window.app.salvarColetaParcial = function(base8) {
        const pertence = state.dadosReman.filter(i => normalizarCodigo(i.SKU || i.Material).startsWith(base8));
        
        let pacotaoDeAtualizacoes = {};

        pertence.forEach(item => {
            let sku13 = normalizarCodigo(item.SKU || item.Material);
            let spanNumero = document.getElementById(`qtd-reman-${sku13}`);
            
            if (spanNumero) {
                let qtdLocal = Number(spanNumero.innerText) || 0;
                
                pacotaoDeAtualizacoes[`status_reman_loja/${state.lojaAtual}/${sku13}`] = {
                    qtd: qtdLocal,
                    quem: state.operador,
                    hora: getHoraCerta()
                };
            }
        });

        document.getElementById('cardBipResultadoTop').style.display = "none";
        document.body.style.overflow = ""; 
        
        const modalCamera = document.getElementById('modalScannerReman');
        if (modalCamera) modalCamera.style.display = "none";
        
        const inputBip = document.getElementById('inputBipReman');
        if (inputBip) {
            inputBip.value = "";
        }
        
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

    // ====================================================
    // BUSCA DUPLA: SAP + PLANILHA DE REMAN
    // ====================================================
    const itemNoSap = state.sapCompleto.find(i => normalizarCodigo(i.EAN) === bipLimpo || normalizarCodigo(i.Material || i.SKU) === bipLimpo);
    
    let sku13Sap = bipLimpo;
    let base8 = bipLimpo.substring(0, 8);
    let descricaoItem = "Produto Desconhecido";

    if (itemNoSap) {
        sku13Sap = normalizarCodigo(itemNoSap.Material || itemNoSap.SKU);
        base8 = sku13Sap.substring(0, 8);
        descricaoItem = itemNoSap["Descrição material"] || itemNoSap["Texto breve material"] || "Produto Reman";
    } else {
        // Se não achou no SAP, procura na planilha de Reman para forçar o reconhecimento
        const itemNoReman = state.dadosReman.find(i => normalizarCodigo(i.SKU || i.Material) === bipLimpo);
        if (itemNoReman) {
            sku13Sap = normalizarCodigo(itemNoReman.SKU || itemNoReman.Material);
            base8 = sku13Sap.substring(0, 8);
            descricaoItem = itemNoReman["Descrição material"] || itemNoReman["Texto breve material"] || "Produto Reman";
        } else {
            const temNoReman = state.dadosReman.some(i => normalizarCodigo(i.SKU || i.Material).startsWith(base8));
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

    const pertenceAoReman = state.dadosReman.filter(i => {
        let skuPlanilha = normalizarCodigo(i.SKU || i.Material);
        return skuPlanilha.substring(0, 8) === base8;
    });

    if (pertenceAoReman.length > 0) {
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

        const promessas = pertenceAoReman.map(async (itemPlan) => {
            const skuReman13 = normalizarCodigo(itemPlan.SKU || itemPlan.Material);
            const itemSap = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU) === skuReman13);
            const info = itemSap ? extrairInfoSAP(itemSap) : { saldo: 0, tam: itemPlan.Tamanho || itemPlan.Tam || "UN" };

            const snap = await database.ref(`status_reman_loja/${state.lojaAtual}/${skuReman13}`).once("value");
            
            const qtd = Number(snap.val()?.qtd || 0);
            const saldo = Number(info.saldo || 0);

            let bgCor = '#ffffff'; 
            let bordaCor = '#e2e8f0'; 

            if (qtd > 0) {
                // Se não tem saldo mas tem quantidade, também fica verde indicando separação feita
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
        
        // ==========================================================
        // TRAVA LIBERADA PARA ZERADOS
        // Se o saldo for 0 (no SAP), permite somar livremente
        // ==========================================================
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

    database.ref(`status_reman_loja/${state.lojaAtual}`).off('value');

    database.ref(`status_reman_loja/${state.lojaAtual}`).on('value', snapshot => {
        const statusDb = snapshot.val() || {};

        const listaJaRenderizada = document.getElementById('reman-cards-container');

        if (listaJaRenderizada) {
            let totalColetado = 0;
            const totalEsperado = Number(container.getAttribute('data-total-esperado') || 0);

            state.dadosReman.forEach(item => {
                let sku = normalizarCodigo(item.SKU || item.Material);
                if(!sku) return;

                const itemSap = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU) === sku);
                const info = extrairInfoSAP(itemSap || {});
                const ticado = statusDb[sku]?.qtd || 0;
                totalColetado += ticado;

                const spanNumero = document.getElementById(`qtd-reman-lista-${sku}`);
                if (spanNumero) {
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
                }
            });

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
            let sku = normalizarCodigo(item.SKU || item.Material);
            if(!sku) return;
            let base8 = sku.substring(0, 8);
            
            if (!agrupado[base8]) agrupado[base8] = [];
            if(!agrupado[base8].includes(sku)) {
                agrupado[base8].push(sku);
            }
        });

        let gruposComEstoque = [];
        let gruposSemEstoque = [];

        Object.entries(agrupado).forEach(([base8, lista]) => {
            let saldoGrupo = 0;
            
            lista.forEach(sku13 => {
                const itemSap = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU) === sku13);
                const info = extrairInfoSAP(itemSap || {});
                saldoGrupo += info.saldo; 
                totalEsperado += info.saldo; 
                const ticado = statusDb[sku13]?.qtd || 0;
                totalColetado += ticado; 
            });

            if (saldoGrupo === 0) {
                gruposSemEstoque.push({ base8, lista });
            } else {
                gruposComEstoque.push({ base8, lista });
            }
        });

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
            
            const desc = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU).startsWith(base8))?.["Descrição material"] || "Produto Reman";
            const card = document.createElement('div');
            
            const isSemEstoque = gruposSemEstoque.includes(grupo);
            const opacityStyle = isSemEstoque ? "opacity: 0.55; filter: grayscale(0.8);" : "";
            const badgeSemEstoque = isSemEstoque ? `<span style="background:#ef4444; color:white; font-size:10px; padding:2px 6px; border-radius:4px; font-weight:bold; margin-left:8px; border: 1px solid #b91c1c;">ZERADO NO SAP</span>` : "";

            let gradeHtml = "";
            lista.forEach(sku13 => {
                const itemSap = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU) === sku13);
                const info = extrairInfoSAP(itemSap || {});
                const registro = statusDb[sku13] || { qtd: 0 };
                const ticado = registro.qtd;

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

    // ==========================================================
    // TRAVA LIBERADA PARA ZERADOS (Lista principal)
    // ==========================================================
    if (saldo === 0) {
        atual++; 
    } else {
        atual = (atual < saldo) ? atual + 1 : 0;
    }
    
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

    window.mostrarAviso("Salvando no sistema...", "sucesso");

    setTimeout(() => {
        ref.update({
            qtd: qtdLocal,
            quem: state.operador,
            hora: getHoraCerta()
        }).then(() => {
            console.log("Coleta individual salva no Firebase.");
        }).catch(erro => {
            window.mostrarAviso("Erro ao salvar: " + erro.message, "erro");
        });
    }, 100);
}

export function exportarRemanExcel() {
    database.ref(`status_reman_loja/${state.lojaAtual}`).once('value', snapshot => {
        const status = snapshot.val() || {};
        const listaSkus = Object.keys(status);

        if (listaSkus.length === 0) {
            return window.mostrarAviso("Nenhum item foi separado ainda para exportar.", "erro");
        }

        let dadosExportacao = [];
        
        listaSkus.forEach(sku13 => {
            const registro = status[sku13]; 
            const itemSap = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU) === sku13);
            
            const base8 = sku13.substring(0, 8);
            const descricao = itemSap ? (itemSap["Descrição material"] || itemSap["Texto breve material"]) : "Produto Reman";
            let tam = "UN";
            let saldoEstoque = 0;
            
            if (itemSap) {
                for (let key in itemSap) {
                    if (key.toLowerCase().includes("tamanho") || key.toLowerCase().includes("tam")) tam = String(itemSap[key]);
                    if (key.toLowerCase().includes("utiliza") || key.toLowerCase().includes("estoque")) saldoEstoque = parseInt(itemSap[key] || 0);
                }
            }

            dadosExportacao.push({
                "SKU 13": sku13,
                "REF (8)": base8,
                "Descrição": descricao,
                "Tamanho": tam,
                "Estoque (SAP)": saldoEstoque,
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

let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                audioCtx = new AudioContext();
            }
        } catch (e) {
            console.log("Áudio bloqueado pelo navegador.", e);
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
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
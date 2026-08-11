// js/reman.js
import { state, normalizarCodigo, getHoraCerta } from './state.js';
import { database } from './firebase.js';

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

        // 🔄 INÍCIO DO EFEITO DE CARREGAMENTO
        const btnSalvar = document.getElementById(`btn-salvar-top-${base8}`);
        if(btnSalvar) {
            btnSalvar.innerHTML = "⏳ SALVANDO...";
            btnSalvar.style.opacity = "0.7";
            btnSalvar.disabled = true; // Bloqueia duplo clique
        }

        database.ref().update(pacotaoDeAtualizacoes).then(() => {
            document.getElementById('cardBipResultadoTop').style.display = "none";
            window.mostrarAviso("✅ Salvo! Quantidades atualizadas com sucesso.", "sucesso");
            
            // Restaura o botão caso ele seja aberto de novo
            if(btnSalvar) {
                btnSalvar.innerHTML = "✅ SALVAR O QUE ENCONTREI";
                btnSalvar.style.opacity = "1";
                btnSalvar.disabled = false;
            }
        }).catch(erro => {
            window.mostrarAviso("Erro ao salvar: " + erro.message, "erro");
            if(btnSalvar) {
                btnSalvar.innerHTML = "✅ SALVAR O QUE ENCONTREI";
                btnSalvar.style.opacity = "1";
                btnSalvar.disabled = false;
            }
        });
    };

    const bipLimpo = normalizarCodigo(bip);
    const cardTop = document.getElementById('cardBipResultadoTop');
    const tagTop = document.getElementById('tagFeedbackTop');
    const corpoTop = document.getElementById('corpoFeedbackTop');

    document.getElementById('inputBipReman').value = "";

    const modalCamera = document.getElementById('modalScannerReman');
    if (modalCamera) modalCamera.style.display = "none";

    cardTop.style.position = "fixed";
    cardTop.style.top = "20px";
    cardTop.style.left = "5%";
    cardTop.style.width = "90%";
    cardTop.style.zIndex = "9999";
    cardTop.style.boxShadow = "0 15px 35px rgba(0,0,0,0.4)";
    cardTop.style.backgroundColor = "#ffffff";
    cardTop.style.display = "block";
    corpoTop.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;">
                <img src="https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg" class="thumb" style="width:55px;height:55px;cursor:pointer;" onclick="app.zoomFoto(this.src)">
                <div style="flex:1;">
                    <b>${descricaoItem}</b><br>
                    REF: ${base8}
                </div>
            </div>
            ${linesTopHtml}
            
            <!-- AQUI FOI ADICIONADA A ID 'btn-salvar-top-${base8}' NO BOTÃO -->
            <button id="btn-salvar-top-${base8}" class="btn-main" style="margin-top:15px;background:#22c55e; transition:0.2s;" onclick="app.salvarColetaParcial('${base8}')">
                ✅ SALVAR O QUE ENCONTREI
            </button>
            
            <button class="btn-main" style="margin-top:8px;background:#ef4444;" onclick="document.getElementById('cardBipResultadoTop').style.display='none'">
                FECHAR
            </button>
        `;

    const itemNoSap = state.sapCompleto.find(i => normalizarCodigo(i.EAN) === bipLimpo || normalizarCodigo(i.Material || i.SKU) === bipLimpo);

    if (!itemNoSap) {
        tocarSomScanner('erro');
        cardTop.style.borderLeftColor = "var(--danger)";
        tagTop.style.background = "var(--danger)";
        tagTop.classList.remove("reman-laranja");
        tagTop.innerText = "❌ PRODUTO DESCONHECIDO NO SAP!";
        corpoTop.innerHTML = `
            <div style="font-size:0.85em; font-weight:700; color:var(--dark-blue);">O código ${bip} não foi localizado na última extração do SAP.</div>
            <button class="btn-main" style="margin-top:15px;background:#64748b;" onclick="document.getElementById('cardBipResultadoTop').style.display='none'">FECHAR</button>
        `;
        return;
    }

    const sku13Sap = normalizarCodigo(itemNoSap.Material || itemNoSap.SKU);
    const base8 = sku13Sap.substring(0, 8);
    const descricaoItem = itemNoSap["Descrição material"] || itemNoSap["Texto breve material"];

    const pertenceAoReman = state.dadosReman.filter(i => {
        let skuPlanilha = normalizarCodigo(i.SKU || i.Material);
        return skuPlanilha.substring(0, 8) === base8;
    });

    if (pertenceAoReman.length > 0) {
        tocarSomScanner('reman');
        cardTop.style.borderLeftColor = "#f97316";
        tagTop.style.background = "linear-gradient(135deg, #f97316, #c2410c)";
        tagTop.style.color = "#ffffff";
        tagTop.style.boxShadow = "0 10px 24px rgba(249,115,22,0.35)";
        tagTop.style.border = "none";
        tagTop.classList.add("reman-laranja");
        tagTop.innerText = "🚨 ITEM DE REMAN! SEPARAR";

        const promessas = pertenceAoReman.map(async (itemPlan) => {
            const skuReman13 = normalizarCodigo(itemPlan.SKU || itemPlan.Material);
            const itemSap = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU) === skuReman13);
            const info = itemSap ? extrairInfoSAP(itemSap) : { saldo: 0, tam: "UN" };

            const snap = await database.ref(`status_reman_loja/${state.lojaAtual}/${skuReman13}`).once("value");
            
            const qtd = Number(snap.val()?.qtd || 0);
            const saldo = Number(info.saldo || 0);

            let bgCor = '#ffffff'; 
            let bordaCor = '#e2e8f0'; 

            if (qtd > 0) {
                if (qtd >= saldo) {
                    bgCor = '#dcfce7'; 
                    bordaCor = '#22c55e';
                } else {
                    bgCor = '#fff7ed'; 
                    bordaCor = '#fb923c';
                }
            }
            
            return `
            <div id="linha-reman-top-${skuReman13}" style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding:10px; border:1px solid ${bordaCor}; border-radius:12px; background:${bgCor}; transition: 0.3s ease;">
                <div>
                    <b style="font-size: 1.1em;">TAM ${info.tam}</b><br>
                    <span style="font-size:12px; color:#64748b;">Estoque SAP: <b style="color:#0f172a;">${saldo}</b></span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <button style="padding:6px 12px; font-weight:bold; border:1px solid #ccc; border-radius:6px; background:#fff; cursor:pointer;" onclick="app.diminuirReman('${skuReman13}', ${saldo})">−</button>
                    
                    <span id="qtd-reman-${skuReman13}" style="font-size:18px; font-weight:bold; min-width:30px; text-align:center; color:#2563eb;">
                        ${qtd}
                    </span>
                    
                    <button style="padding:6px 12px; font-weight:bold; border:1px solid #ccc; border-radius:6px; background:#fff; cursor:pointer;" onclick="app.aumentarReman('${skuReman13}',${saldo})">+</button>
                </div>
            </div>
            `;
        });

        const linhasResolvidas = await Promise.all(promessas);
        const linesTopHtml = linhasResolvidas.join('');

        corpoTop.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;">
                <img src="https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg" class="thumb" style="width:55px;height:55px;cursor:pointer;" onclick="app.zoomFoto(this.src)">
                <div style="flex:1;">
                    <b>${descricaoItem}</b><br>
                    REF: ${base8}
                </div>
            </div>
            ${linesTopHtml}
            <button class="btn-main" style="margin-top:15px;background:#22c55e;" onclick="app.salvarColetaParcial('${base8}')">
                ✅ SALVAR O QUE ENCONTREI
            </button>
            <button class="btn-main" style="margin-top:8px;background:#ef4444;" onclick="document.getElementById('cardBipResultadoTop').style.display='none'">
                FECHAR
            </button>
        `;
    } else {
        tocarSomScanner('erro');
        cardTop.style.borderLeftColor = "var(--success)";
        tagTop.style.background = "var(--success)";
        tagTop.classList.remove("reman-laranja");
        tagTop.innerText = "✅ NÃO PERTENCE À LISTA DE REMANEJAMENTO";
        corpoTop.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <img src="https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg" class="thumb" style="width:55px; height:55px; cursor:pointer;" onclick="app.zoomFoto(this.src)">
                <div style="flex:1; font-size:0.75em; line-height:1.2;">
                    <b>${descricaoItem}</b><br>
                    <span style="color:var(--success); font-weight:800;">PERTENCE À LISTA DE PLANEJAMENTO</span>
                </div>
            </div>
            <button class="btn-main" style="margin-top:15px;background:#64748b;" onclick="document.getElementById('cardBipResultadoTop').style.display='none'">FECHAR</button>
        `;
    }
}

export function aumentarReman(sku13, saldoTotal) {
    const saldo = Number(saldoTotal);
    const spanNumero = document.getElementById(`qtd-reman-${sku13}`);
    
    if (spanNumero) {
        let qtdLocal = Number(spanNumero.innerText) || 0;
        if (qtdLocal < saldo) {
            qtdLocal++;
            spanNumero.innerText = qtdLocal; 
            
            const linha = document.getElementById(`linha-reman-top-${sku13}`);
            if (linha) {
                linha.style.background = qtdLocal < saldo ? '#fff7ed' : '#dcfce7';
                linha.style.borderColor = qtdLocal < saldo ? '#fb923c' : '#22c55e';
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
                linha.style.background = qtdLocal === 0 ? '#ffffff' : (qtdLocal < saldo ? '#fff7ed' : '#dcfce7');
                linha.style.borderColor = qtdLocal === 0 ? '#e2e8f0' : (qtdLocal < saldo ? '#fb923c' : '#22c55e');
            }
        }
    }
}

export function renderizarListaCompletaReman() {
    const container = document.getElementById('remanListaSincronizada');
    if (!container) return;

    database.ref(`status_reman_loja/${state.lojaAtual}`).on('value', snapshot => {
        const statusDb = snapshot.val() || {};
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

        Object.entries(agrupado).forEach(([base8, lista]) => {
            lista.forEach(sku13 => {
                const itemSap = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU) === sku13);
                const info = extrairInfoSAP(itemSap || {});
                totalEsperado += info.saldo; 
                const ticado = statusDb[sku13]?.qtd || 0;
                totalColetado += ticado; 
            });
        });

        let percent = totalEsperado > 0 ? Math.floor((totalColetado / totalEsperado) * 100) : 0;
        if (percent > 100) percent = 100;
        let corBarra = percent === 100 ? '#10b981' : '#3b82f6';
        
        container.innerHTML = `
            <div style="background:#f1f5f9; border-radius:12px; height:22px; width:100%; position:relative; overflow:hidden; margin-bottom:20px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">
                <div style="height:100%; background:${corBarra}; width:${percent}%; transition: width 0.4s ease;"></div>
                <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:0.75em; font-weight:800; color:#0f172a; text-shadow: 0px 0px 2px rgba(255,255,255,0.9);">
                    PROGRESSO DA LOJA: ${totalColetado} / ${totalEsperado} (${percent}%)
                </div>
            </div>
        `;

        Object.entries(agrupado).forEach(([base8, lista]) => {
            const desc = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU).startsWith(base8))?.["Descrição material"] || "Produto Reman";
            const card = document.createElement('div');
            
            let gradeHtml = "";
            lista.forEach(sku13 => {
                const itemSap = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU) === sku13);
                const info = extrairInfoSAP(itemSap || {});
                const registro = statusDb[sku13] || { qtd: 0 };
                const ticado = registro.qtd;

                let bgCor = ticado === 0 ? '#ffffff' : (ticado < info.saldo ? '#fffbeb' : '#f0fdf4');
                let bordaCor = ticado === 0 ? '#e5e7eb' : (ticado < info.saldo ? '#fde68a' : '#bbf7d0');
                let corTexto = ticado === 0 ? '#64748b' : (ticado < info.saldo ? '#d97706' : '#15803d');
                let statusBtnBg = ticado > 0 ? '#10b981' : '#f97316';
                let statusBtnIcon = ticado > 0 ? '✓' : '✓';

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
                            <button style="display:flex; align-items:center; justify-content:center; width:38px; height:38px; border-radius:10px; border:1px solid #e2e8f0; background:#f8fafc; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.05); transition:0.2s;" onclick="app.gerarQRReman('${info.tam}', '${sku13}')">
                                <svg width="18" height="18" fill="none" stroke="#475569" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
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
                <div style="background:#ffffff; border-radius:16px; border:1px solid #e2e8f0; margin-bottom:20px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04); overflow:hidden;">
                    <div style="padding:16px; display:flex; gap:14px; align-items:center; background:#f8fafc; border-bottom:1px solid #f1f5f9;">
                        <div style="width:65px; height:65px; flex-shrink:0; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="app.zoomFoto('https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg')">
                            <img src="https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg" style="max-width:100%; max-height:100%; object-fit:contain;">
                        </div>
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <b style="font-size:13px; color:#0f172a; line-height:1.3; text-transform:uppercase; font-weight:800;">${desc}</b>
                            <span style="font-size:12px; color:#64748b; font-weight:600; display:flex; align-items:center; gap:6px;">
                                <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#cbd5e1;"></span> REF: ${base8}
                            </span>
                        </div>
                    </div>
                    <div style="padding:16px; background:#ffffff;">
                        ${gradeHtml}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

export function ticarContadorReman(sku13, saldoTotal) {
    const spanNumero = document.getElementById(`qtd-reman-lista-${sku13}`);
    if (!spanNumero) return;

    let atual = Number(spanNumero.innerText) || 0;
    const saldo = Number(saldoTotal);

    atual = (atual < saldo) ? atual + 1 : 0;
    spanNumero.innerText = atual;

    const linha = document.getElementById(`linha-reman-lista-${sku13}`);
    const btnStatus = document.getElementById(`btn-status-lista-${sku13}`);
    const textQtd = document.getElementById(`texto-qtd-lista-${sku13}`); 

    if (linha) {
        linha.style.background = atual === 0 ? '#ffffff' : (atual < saldo ? '#fffbeb' : '#f0fdf4');
        linha.style.borderColor = atual === 0 ? '#e5e7eb' : (atual < saldo ? '#fde68a' : '#bbf7d0');
    }
    if (textQtd) {
        textQtd.style.color = atual === 0 ? '#64748b' : (atual < saldo ? '#d97706' : '#15803d');
    }
    if (btnStatus) {
        btnStatus.style.background = atual > 0 ? '#10b981' : '#f97316';
        btnStatus.innerHTML = atual > 0 ? '✓' : '✓';
    }
}

export function alternarStatusReman(base8, sku13) {
    const spanNumero = document.getElementById(`qtd-reman-lista-${sku13}`);
    if (!spanNumero) return;

    const qtdLocal = Number(spanNumero.innerText) || 0;
    const ref = database.ref(`status_reman_loja/${state.lojaAtual}/${sku13}`);

    // 🔄 INÍCIO DO EFEITO DE CARREGAMENTO
    const btnStatus = document.getElementById(`btn-status-lista-${sku13}`);
    let htmlOriginal = "";
    if (btnStatus) {
        htmlOriginal = btnStatus.innerHTML; // Salva se era ✓ ou ✓
        btnStatus.innerHTML = "⏳";
        btnStatus.style.opacity = "0.7";
        btnStatus.disabled = true; // Bloqueia duplo clique
    }

    ref.update({
        qtd: qtdLocal,
        quem: state.operador,
        hora: getHoraCerta()
    }).then(() => {
        if (qtdLocal === 0) {
            window.mostrarAviso("🗑️ Coleta zerada com sucesso!", "sucesso");
        } else {
            window.mostrarAviso("✅ Coleta salva para o tamanho selecionado!", "sucesso");
        }
        
        // A lista se atualiza sozinha por causa do Firebase, mas por garantia:
        if (btnStatus) {
            btnStatus.style.opacity = "1";
            btnStatus.disabled = false;
        }
    }).catch(erro => {
        window.mostrarAviso("Erro ao salvar: " + erro.message, "erro");
        // Se der erro de internet, devolve o botão ao normal
        if (btnStatus) {
            btnStatus.innerHTML = htmlOriginal;
            btnStatus.style.opacity = "1";
            btnStatus.disabled = false;
        }
    });
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
            
            if(itemSap) {
                for(let key in itemSap) {
                    if(key.toLowerCase().includes("tamanho") || key.toLowerCase().includes("tam")) tam = String(itemSap[key]);
                    if(key.toLowerCase().includes("utiliza") || key.toLowerCase().includes("estoque")) saldoEstoque = parseInt(itemSap[key] || 0);
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

// ==========================================
// MÓDULO DE ÁUDIO (Bipes do Scanner)
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function tocarSomScanner(tipo) {
    if (!audioCtx) return;
    
    if (audioCtx.state === 'suspended') audioCtx.resume();

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
}
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

        database.ref().update(pacotaoDeAtualizacoes).then(() => {
            document.getElementById('cardBipResultadoTop').style.display = "none";
            // document.getElementById('inputBipReman').focus(); // <-- REMOVIDO PARA A TELA NÃO PULAR
            window.mostrarAviso("✅ Salvo! Quantidades atualizadas com sucesso.", "sucesso");
        }).catch(erro => {
            window.mostrarAviso("Erro ao salvar: " + erro.message, "erro");
        });
    };

    const bipLimpo = normalizarCodigo(bip);
    const cardTop = document.getElementById('cardBipResultadoTop');
    const tagTop = document.getElementById('tagFeedbackTop');
    const corpoTop = document.getElementById('corpoFeedbackTop');

    document.getElementById('inputBipReman').value = "";

    // Esconde o Pop-up da câmera assim que o produto for bipado
    const modalCamera = document.getElementById('modalScannerReman');
    if (modalCamera) modalCamera.style.display = "none";
    
    // TRANSFORMA O CARD EM UM POP-UP FLUTUANTE
    cardTop.style.position = "fixed";
    cardTop.style.top = "20px";
    cardTop.style.left = "5%";
    cardTop.style.width = "90%";
    cardTop.style.zIndex = "9999";
    cardTop.style.boxShadow = "0 15px 35px rgba(0,0,0,0.4)";
    cardTop.style.backgroundColor = "#ffffff";
    cardTop.style.display = "block";

    const itemNoSap = state.sapCompleto.find(i => normalizarCodigo(i.EAN) === bipLimpo || normalizarCodigo(i.Material || i.SKU) === bipLimpo);

    if (!itemNoSap) {
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
        let corBarra = percent === 100 ? '#22c55e' : '#3b82f6';
        
        container.innerHTML = `
            <div style="background:#e2e8f0; border-radius:10px; height:24px; width:100%; position:relative; overflow:hidden; margin-bottom:15px; border: 1px solid #cbd5e1; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                <div style="height:100%; background:${corBarra}; width:${percent}%; transition: width 0.4s ease;"></div>
                <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:0.8em; font-weight:900; color:#1e293b; text-shadow: 0px 0px 3px rgba(255,255,255,0.8);">
                    PROGRESSO DA LOJA: ${totalColetado} / ${totalEsperado} (${percent}%)
                </div>
            </div>
        `;

        Object.entries(agrupado).forEach(([base8, lista]) => {
            const desc = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU).startsWith(base8))?.["Descrição material"] || "Produto Reman";
            const card = document.createElement('div');
            card.className = "reman-card-item";
            
            let gradeHtml = "";
            lista.forEach(sku13 => {
                const itemSap = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU) === sku13);
                const info = extrairInfoSAP(itemSap || {});
                const registro = statusDb[sku13] || { qtd: 0 };
                const ticado = registro.qtd;

                let bgCor = ticado === 0 ? '#ffffff' : (ticado < info.saldo ? '#fff7ed' : '#dcfce7');
                let bordaCor = ticado === 0 ? '#e2e8f0' : (ticado < info.saldo ? '#fb923c' : '#22c55e');

                gradeHtml += `
                    <div id="linha-reman-lista-${sku13}" style="background:${bgCor}; border:1px solid ${bordaCor}; padding:10px; margin:5px 0; border-radius:8px; display:flex; justify-content:space-between; align-items:center; transition: 0.2s ease;">
                        <div style="font-weight:bold;">
                            TAM: ${info.tam} (<span id="qtd-reman-lista-${sku13}">${ticado}</span>/${info.saldo})
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button style="padding:6px 10px; border-radius:6px; border:1px solid #ccc;" onclick="app.gerarQRReman('${info.tam}', '${sku13}')">🔍</button>
                            <button style="padding:6px 10px; border-radius:6px; border:1px solid #ccc; font-weight:bold; background:#fff; cursor:pointer;" onclick="app.ticarContadorReman('${sku13}', ${info.saldo})">++</button>
                            <button id="btn-status-lista-${sku13}" style="padding:6px 10px; border-radius:6px; border:none; cursor:pointer; background:${ticado > 0 ? '#22c55e' : '#f97316'}; color:white;" onclick="app.alternarStatusReman('${base8}', '${sku13}')">
                                ${ticado > 0 ? '✅' : '📦'}
                            </button>
                        </div>
                    </div>
                `;
            });

            card.innerHTML = `
                <div style="padding:10px; display:flex; gap:10px; align-items:center; border-bottom:1px solid #eee;">
                    <img src="https://imgcentauro-a.akamaihd.net/100x100/${base8}.jpg" style="width:50px; height:50px; border-radius:8px; cursor:pointer;" onclick="app.zoomFoto(this.src)">
                    <div><b>${desc}</b><br><small>REF: ${base8}</small></div>
                </div>
                <div style="padding:10px;">${gradeHtml}</div>
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

    if (linha) {
        linha.style.background = atual === 0 ? '#ffffff' : (atual < saldo ? '#fff7ed' : '#dcfce7');
        linha.style.borderColor = atual === 0 ? '#e2e8f0' : (atual < saldo ? '#fb923c' : '#22c55e');
    }
    if (btnStatus) {
        btnStatus.style.background = atual > 0 ? '#22c55e' : '#f97316';
        btnStatus.innerHTML = atual > 0 ? '✅' : '📦';
    }
}

export function alternarStatusReman(base8, sku13) {
    const spanNumero = document.getElementById(`qtd-reman-lista-${sku13}`);
    if (!spanNumero) return;

    const qtdLocal = Number(spanNumero.innerText) || 0;
    const ref = database.ref(`status_reman_loja/${state.lojaAtual}/${sku13}`);

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
    }).catch(erro => {
        window.mostrarAviso("Erro ao salvar: " + erro.message, "erro");
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
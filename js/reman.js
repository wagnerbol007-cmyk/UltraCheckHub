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

// Transformamos em async para esperar o Firebase sem travar a tela
// Transformamos em async para esperar o Firebase sem travar a tela
export async function biparReman(bip) {
    
    // MÁGICA: Injeta a função de salvar parcial sem você precisar tocar no main.js
    if (window.app && !window.app.salvarColetaParcial) {
        window.app.salvarColetaParcial = function(base8) {
            const pertence = state.dadosReman.filter(i => normalizarCodigo(i.SKU || i.Material).startsWith(base8));
            
            pertence.forEach(item => {
                let sku13 = normalizarCodigo(item.SKU || item.Material);
                database.ref(`status_reman_loja/${state.lojaAtual}/${sku13}`).once("value").then(snap => {
                    let reg = snap.val();
                    // Só salva no histórico (quem separou) o que for MAIOR que ZERO.
                    if (reg && reg.qtd > 0) {
                        database.ref(`status_reman_loja/${state.lojaAtual}/${sku13}`).update({
                            quem: state.operador,
                            hora: getHoraCerta()
                        });
                    }
                });
            });

            document.getElementById('cardBipResultadoTop').style.display = "none";
            document.getElementById('inputBipReman').focus();
            window.mostrarAviso("✅ Salvo! Apenas os tamanhos marcados foram registrados.", "sucesso");
        };
    }

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

        // Espera todos os dados carregarem perfeitamente do banco
        const promessas = pertenceAoReman.map(async (itemPlan) => {
            const skuReman13 = normalizarCodigo(itemPlan.SKU || itemPlan.Material);
            const itemSap = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU) === skuReman13);
            const info = itemSap ? extrairInfoSAP(itemSap) : { saldo: 0, tam: "UN" };

            const snap = await database.ref(`status_reman_loja/${state.lojaAtual}/${skuReman13}`).once("value");
            const qtd = snap.val()?.qtd || 0;

            // AQUI ESTÁ A MUDANÇA: Adicionei o Estoque SAP visualmente no card
            return `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding:10px; border:1px solid #ddd; border-radius:12px; background:white;">
                <div>
                    <b style="font-size: 1.1em;">TAM ${info.tam}</b><br>
                    <span style="font-size:12px; color:#64748b;">Estoque SAP: <b style="color:#0f172a;">${info.saldo}</b></span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <button style="padding:6px 12px; font-weight:bold; border:1px solid #ccc; border-radius:6px; background:#fff; cursor:pointer;" onclick="app.diminuirReman('${skuReman13}')">−</button>
                    
                    <span id="qtd-reman-${skuReman13}" style="font-size:18px; font-weight:bold; min-width:30px; text-align:center; color:#2563eb;">
                        ${qtd}
                    </span>
                    
                    <button style="padding:6px 12px; font-weight:bold; border:1px solid #ccc; border-radius:6px; background:#fff; cursor:pointer;" onclick="app.aumentarReman('${skuReman13}',${info.saldo})">+</button>
                </div>
            </div>
            `;
        });

        // Junta tudo no HTML
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
        `;
    }
}

export function aumentarReman(sku13, saldoTotal) {
    const ref = database.ref(`status_reman_loja/${state.lojaAtual}/${sku13}/qtd`);
    
    // Pega o número que já está na tela e aumenta na hora (visual instantâneo)
    const spanNumero = document.getElementById(`qtd-reman-${sku13}`);
    let qtdLocal = 0;
    if (spanNumero) {
        qtdLocal = parseInt(spanNumero.innerText) || 0;
        if (qtdLocal < saldoTotal) {
            qtdLocal++;
            spanNumero.innerText = qtdLocal; // Atualiza a tela imediatamente!
        }
    }

    // Envia para o banco de dados em segundo plano
    ref.transaction((qtdAtual) => {
        let atual = qtdAtual || 0;
        return (atual < saldoTotal) ? atual + 1 : atual;
    });
}

export function diminuirReman(sku13) {
    const ref = database.ref(`status_reman_loja/${state.lojaAtual}/${sku13}/qtd`);
    
    // Pega o número que já está na tela e diminui na hora (visual instantâneo)
    const spanNumero = document.getElementById(`qtd-reman-${sku13}`);
    let qtdLocal = 0;
    if (spanNumero) {
        qtdLocal = parseInt(spanNumero.innerText) || 0;
        if (qtdLocal > 0) {
            qtdLocal--;
            spanNumero.innerText = qtdLocal; // Atualiza a tela imediatamente!
        }
    }

    // Envia para o banco de dados em segundo plano
    ref.transaction((qtdAtual) => {
        let atual = qtdAtual || 0;
        return (atual > 0) ? atual - 1 : 0;
    });
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

        // Limpa e agrupa os itens, aproveitando para calcular o Progresso!
        state.dadosReman.forEach(item => {
            let sku = normalizarCodigo(item.SKU || item.Material);
            if(!sku) return;
            let base8 = sku.substring(0, 8);
            if (!agrupado[base8]) agrupado[base8] = [];
            
            if(!agrupado[base8].includes(sku)) {
                agrupado[base8].push(sku);
            }
        });

        // Contabilidade geral para a barra de progresso
        Object.entries(agrupado).forEach(([base8, lista]) => {
            lista.forEach(sku13 => {
                const itemSap = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU) === sku13);
                const info = extrairInfoSAP(itemSap || {});
                totalEsperado += info.saldo; // Soma o estoque que precisa ser achado
                const ticado = statusDb[sku13]?.qtd || 0;
                totalColetado += ticado; // Soma o que a galera já achou
            });
        });

        // Desenha a Barra de Progresso no topo da lista
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

        // Renderiza a lista de Cards
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
                    <div style="background:${bgCor}; border:1px solid ${bordaCor}; padding:10px; margin:5px 0; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-weight:bold;">TAM: ${info.tam} (${ticado}/${info.saldo})</div>
                        <div style="display:flex; gap:6px;">
                            <button style="padding:6px 10px; border-radius:6px; border:1px solid #ccc;" onclick="app.gerarQRReman('${info.tam}', '${sku13}')">🔍</button>
                            <button style="padding:6px 10px; border-radius:6px; border:1px solid #ccc; font-weight:bold; background:#fff; cursor:pointer;" onclick="app.ticarContadorReman('${sku13}', ${info.saldo})">++</button>
                            <button style="padding:6px 10px; border-radius:6px; border:none; cursor:pointer; background:${ticado > 0 ? '#22c55e' : '#f97316'}; color:white;" onclick="app.alternarStatusReman('${base8}', '${sku13}')">
                                ${ticado > 0 ? '✅' : '📦'}
                            </button>
                        </div>
                    </div>
                `;
            });

            // ATENÇÃO AQUI: Adicionado onclick="app.zoomFoto(this.src)" e cursor:pointer na imagem
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
    const ref = database.ref(`status_reman_loja/${state.lojaAtual}/${sku13}/qtd`);
    
    // 🔥 VELOCIDADE: Usamos transaction para atualizar direto no servidor sem precisar ler antes!
    ref.transaction((qtdAtual) => {
        let atual = qtdAtual || 0;
        return (atual < saldoTotal) ? atual + 1 : 0;
    });
}

export function alternarStatusReman(base8, sku13) {
    const ref = database.ref(`status_reman_loja/${state.lojaAtual}/${sku13}`);
    
    ref.once('value', snapshot => {
        const registro = snapshot.val();
        
        if (registro && registro.qtd > 0) {
            ref.update({
                quem: state.operador,
                hora: getHoraCerta()
            }).then(() => {
                window.mostrarAviso("✅ Coleta confirmada para: " + sku13, "sucesso");
            });
        } else {
            window.mostrarAviso("⚠️ Selecione a quantidade no contador (+) antes de coletar!", "erro");
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
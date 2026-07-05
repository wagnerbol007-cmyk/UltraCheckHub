// js/estoque.js
import { database } from './firebase.js';
import { state, getHoraCerta } from './state.js';

let sX = 0; 
let sY = 0;
let itensOcultosSwipe = []; 
let tamanhosOcultosSwipe = {}; 
let swipeParcial = {}; 

export function ouvirEstoque() {
    database.ref(`reposicao_ativa/${state.lojaAtual}`).on('value', s => {
        const container = document.getElementById('listaPedidos'); 
        if(!container) return;
        container.innerHTML = "";
        
        if(!s.exists()) { 
            document.getElementById('progressoEstoque').style.display='none'; 
            return; 
        }
        
        let tG = 0, tC = 0;
        let dados = s.val();
        
        Object.entries(dados).forEach(([id, item]) => {
            Object.entries(item.pedidos).forEach(([t, d]) => {
                tG += Number(d.qtd) || 0; 
                let p = Number(state.coletaEstoqueLocal[id+t]) || 0; 
                tC += p;
            });
        });

        Object.entries(dados).forEach(([id, item]) => {
            if (itensOcultosSwipe.includes(id)) return; 

            const wrap = document.createElement('div'); wrap.className = 'swipe-container';
            
            const actDir = document.createElement('div'); actDir.className = 'swipe-action-dir'; actDir.innerHTML = "ACHEI<br>✅";
            const actEsq = document.createElement('div'); actEsq.className = 'swipe-action-esq'; actEsq.innerHTML = "NÃO<br>ACHEI";
            
            const card = document.createElement('div'); card.className = 'swipe-content';
            
            card.addEventListener('touchstart', e => { sX = e.touches[0].clientX; sY = e.touches[0].clientY; }, {passive: true});
            card.addEventListener('touchmove', e => {
                let dx = e.touches[0].clientX - sX; 
                let dy = e.touches[0].clientY - sY;
                if(Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 15) {
                    card.style.transform = `translateX(${Math.max(-100, Math.min(dx, 100))}px)`;
                }
            }, {passive: true});
            
            card.addEventListener('touchend', e => { 
                let dx = parseInt(card.style.transform.replace(/[^-0-9]/g, '') || 0); 
                if(dx <= -60) {
                    card.style.transform = `translateX(-100px)`; 
                    setTimeout(() => moverParaAnalise(id, item), 200);
                } else if(dx >= 60) {
                    card.style.transform = `translateX(100px)`; 
                    setTimeout(() => confirmarItemAchei(id, item, wrap), 200);
                } else {
                    card.style.transform = `translateX(0)`; 
                }
            });
            
            let grade = "";
            let temTamanhoVisivel = false;

            Object.entries(item.pedidos).forEach(([t, d]) => {
                let p = Number(state.coletaEstoqueLocal[id+t]) || 0; 
                let meta = Number(d.qtd) || 0;
                
                let foiOcultado = tamanhosOcultosSwipe[id] && tamanhosOcultosSwipe[id].includes(t);
                let styleDisplay = foiOcultado ? 'style="display:none;"' : '';
                
                if (!foiOcultado) temTamanhoVisivel = true;

                // Feedback para o operador se ele já arrastou parte do pedido
                let infoParcial = Number(swipeParcial[id+t]) || 0;
                let avisoParcial = (infoParcial > 0 && p < meta) ? ' <span style="color:#22c55e; font-size:0.85em; font-weight:900;">(Salvo)</span>' : '';

                grade += `<div class="tam-row ${p>=meta?'coletado':''}" ${styleDisplay}><div class="tam-btn-est" onclick="app.ticarContador('${id}','${t}',${meta})">${t}: ${p}/${meta}${avisoParcial}</div><button class="btn-qr-direct" onclick="app.gerarQR('${t}','${d.fullSku}')">QR</button></div>`;
            });

            if (!temTamanhoVisivel) {
                if (!itensOcultosSwipe.includes(id)) itensOcultosSwipe.push(id);
                return; 
            }
            
            card.innerHTML = `
                <div style="font-size:0.65em; color:gray; font-weight:bold;">${item.operador} • ${item.hora}</div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="https://imgcentauro-a.akamaihd.net/100x100/${item.skuBase8}.jpg" class="thumb" onclick="app.zoomFoto(this.src)" style="width:55px; height:55px;">
                    <div style="flex:1; font-size:0.75em;">
                        <b>${item.desc}</b><br>
                        <span class="cor-tag">${item.cor || ''}</span>
                        ${item.preco ? `<span class="preco-tag" style="font-size:0.85em; padding:2px 6px; border-radius:6px; margin-left:6px; display:inline-block;">${item.preco}</span>` : ''}
                    </div>
                </div>
                <div class="grade-grid">${grade}</div>`;
                
            wrap.appendChild(actDir); wrap.appendChild(actEsq); wrap.appendChild(card); container.appendChild(wrap);
        });
        
        document.getElementById('progressoEstoque').style.display='block';
        const pc = tG === 0 ? 0 : (tC/tG)*100; 
        document.getElementById('barFill').style.width=pc+"%"; 
        document.getElementById('barTxt').innerText=`PROGRESSO: ${tC} / ${tG}`;
    });
}

function moverParaAnalise(id, item) { 
    if(confirm("Mover para análise de falta física?")) { 
        database.ref(`produtos_nao_encontrados/${state.lojaAtual}/${id}`).set(item); 
        database.ref(`reposicao_ativa/${state.lojaAtual}/${id}`).remove(); 
    } 
}

export function ouvirAnalise() {
    database.ref(`produtos_nao_encontrados/${state.lojaAtual}`).on('value', s => {
        const container = document.getElementById('listaAnalise'); 
        if(!container) return;
        container.innerHTML = "";
        
        if(!s.exists()) return container.innerHTML = "<p style='color:gray; font-weight:800; text-align:center;'>Auditoria Vazia.</p>";
        
        Object.entries(s.val()).forEach(([id, item]) => {
            const card = document.createElement('div'); card.className = 'swipe-container'; card.style.background = 'transparent';
            const content = document.createElement('div'); content.className = 'swipe-content'; content.style.borderLeftColor = 'var(--warning)';
            
            let grade = ""; 
            Object.entries(item.pedidos).forEach(([t, d]) => { 
                grade += `<div class="tam-row"><div class="tam-btn-est" style="background:#fff7ed; border-color:#fed7aa">${t}: ${d.qtd}</div><button class="btn-qr-direct" style="background:#fb923c" onclick="app.gerarQR('${t}','${d.fullSku}')">QR</button></div>`; 
            });
            
            content.innerHTML = `
                <div style="font-size:0.6em; color:gray;">${item.operador} • ${item.hora}</div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="https://imgcentauro-a.akamaihd.net/100x100/${item.skuBase8}.jpg" class="thumb" onclick="app.zoomFoto(this.src)" style="width:50px; height:50px;">
                    <div style="flex:1; font-size:0.7em;">
                        <b>${item.desc}</b><br>
                        <span class="cor-tag">${item.cor || ''}</span>
                    </div>
                </div>
                <div class="grade-grid">${grade}</div>`;
                
            card.appendChild(content);
            container.appendChild(card);
        });
    });
}

export function limparAnalise() {
    if(confirm("Apagar toda a auditoria de falta física? Esta ação não tem volta.")) {
        database.ref(`produtos_nao_encontrados/${state.lojaAtual}`).remove();
    }
}

export function finalizarColetaGeral() {
    if (!confirm("Sincronizar itens ticados e enviar para o histórico?")) return;

    database.ref(`reposicao_ativa/${state.lojaAtual}`).once('value', snapshot => {
        if (!snapshot.exists()) {
            return alert("Não existe lista para sincronizar.");
        }

        const lista = snapshot.val();
        const updates = {};
        const historicoItens = [];
        let totalColetado = 0;

        Object.entries(lista).forEach(([id, item]) => {
            let aindaTemPendente = false;

            // 1. Coleta os dados para o histórico e verifica se faltou algum tamanho
            Object.entries(item.pedidos).forEach(([tamanho, dados]) => {
                const coletado = Number(state.coletaEstoqueLocal[id + tamanho]) || 0;
                const meta = Number(dados.qtd) || 0;
                
                if (coletado > 0) {
                    totalColetado += coletado;
                    historicoItens.push({
                        produto: item.desc || "Produto sem descrição",
                        cor: item.cor || "",
                        skuBase8: item.skuBase8 || id,
                        tamanho: tamanho,
                        sku: dados.fullSku || "",
                        quantidadeSeparada: coletado,
                        quantidadeOriginal: meta,
                        operadorPedido: item.operador || "",
                        horaPedido: item.hora || ""
                    });
                }

                if (coletado < meta) {
                    aindaTemPendente = true; // Se não pegou 100% desse tamanho, marca que tem pendência
                }
            });

            // 2. Prepara as atualizações de forma inteligente (SEM SOBREPOR OS CAMINHOS NO FIREBASE)
            if (!aindaTemPendente) {
                // Se pegou TUDO do produto, apaga a caixa inteira de uma vez e ignora os filhos
                updates[`reposicao_ativa/${state.lojaAtual}/${id}`] = null;
            } else {
                // Se ainda tem tamanho pendente, atualiza/apaga apenas os tamanhos individualmente
                Object.entries(item.pedidos).forEach(([tamanho, dados]) => {
                    const coletado = Number(state.coletaEstoqueLocal[id + tamanho]) || 0;
                    const meta = Number(dados.qtd) || 0;
                    if (coletado > 0) {
                        if (coletado >= meta) {
                            updates[`reposicao_ativa/${state.lojaAtual}/${id}/pedidos/${tamanho}`] = null;
                        } else {
                            updates[`reposicao_ativa/${state.lojaAtual}/${id}/pedidos/${tamanho}/qtd`] = meta - coletado;
                        }
                    }
                });
            }
        });

        if (totalColetado === 0) {
            return alert("Nenhum item foi ticado para sincronizar.");
        }

        // 3. Salva no Histórico Geral
        const historicoRef = database.ref(`historico_reposicao/${state.lojaAtual}`).push();
        updates[`historico_reposicao/${state.lojaAtual}/${historicoRef.key}`] = {
            hora: getHoraCerta(),
            quem: state.operador,
            total: totalColetado,
            itens: historicoItens,
            desc: historicoItens.map(i =>
                `${i.produto} | TAM: ${i.tamanho} | QTD: ${i.quantidadeSeparada}/${i.quantidadeOriginal}`
            ).join("<br>")
        };

        // 4. Envia tudo para o banco de dados
        database.ref().update(updates).then(() => {
            state.coletaEstoqueLocal = {};
            
            // LIMPEZA DA TELA APÓS A SINCRONIZAÇÃO
            itensOcultosSwipe = [];
            tamanhosOcultosSwipe = {};
            swipeParcial = {};
            
            const listaHist = document.getElementById('listaHistLocal');
            const contHist = document.getElementById('histLocalRep');
            if(listaHist) listaHist.innerHTML = ''; 
            if(contHist) contHist.style.display = 'none'; 
            
            ouvirEstoque(); // Recarrega a tela limpa
            if (window.mostrarAviso) window.mostrarAviso("Coleta sincronizada e enviada para o histórico!", "sucesso");
            else alert("Coleta sincronizada e enviada para o histórico!");
        }).catch(error => {
            console.error("Erro no Firebase: ", error);
            alert("Erro ao sincronizar coleta.");
        });
    });
}

export function ouvirHistorico() {
    const container = document.getElementById('contHist');
    if (!container) return;

    container.innerHTML = "<p style='color:gray; font-weight:800; text-align:center;'>Carregando histórico...</p>";

    database.ref(`historico_reposicao`).once('value', snapshot => {
        container.innerHTML = "";

        if (!snapshot.exists()) {
            container.innerHTML = "<p style='color:gray; font-weight:800; text-align:center;'>Nenhum histórico encontrado.</p>";
            return;
        }

        const dados = snapshot.val();
        let historicos = [];

        Object.entries(dados).forEach(([grupo, registros]) => {
            if (!registros || typeof registros !== "object") return;

            Object.entries(registros).forEach(([id, h]) => {
                historicos.push({ id, grupo, ...h });
            });
        });

        historicos.reverse();

        if (historicos.length === 0) {
            container.innerHTML = "<p style='color:gray; font-weight:800; text-align:center;'>Nenhum histórico encontrado.</p>";
            return;
        }

        historicos.forEach(h => {
            container.innerHTML += `
                <div style="padding:15px; background:white; margin-bottom:12px; border-radius:18px; box-shadow:0 4px 10px rgba(0,0,0,0.05); text-align:left;">
                    <div style="font-size:0.75em; color:#64748b; font-weight:800;">
                        🕒 ${h.hora || "--"} | 👤 ${h.quem || "--"} | Total: ${h.total || 0}
                    </div>
                    <div style="font-size:0.8em; margin-top:8px;">
                        ${h.desc || "Sem descrição"}
                    </div>
                </div>
            `;
        });
    });
}

function confirmarItemAchei(id, item, wrap) {
    if (!wrap) return;

    let totalSeparado = 0;
    let qtdSeparadaTexto = [];
    let algumaAcaoValida = false;

    if (!tamanhosOcultosSwipe[id]) tamanhosOcultosSwipe[id] = [];

    const tamRows = wrap.querySelectorAll('.tam-row');

    Object.entries(item.pedidos).forEach(([tamanho, dados], index) => {
        const coletadoTotal = Number(state.coletaEstoqueLocal[id + tamanho]) || 0;
        const jaSwipado = Number(swipeParcial[id + tamanho]) || 0;
        const meta = Number(dados.qtd) || 0;
        
        const novoColetado = coletadoTotal - jaSwipado; 
        const linha = tamRows[index];

        if (novoColetado > 0 && !tamanhosOcultosSwipe[id].includes(tamanho)) {
            algumaAcaoValida = true;
            totalSeparado += novoColetado;
            qtdSeparadaTexto.push(`${novoColetado}x Tam ${tamanho}`);
            
            swipeParcial[id + tamanho] = coletadoTotal;

            if (coletadoTotal >= meta) {
                if (linha) linha.style.display = 'none'; // Some APENAS se bater a meta
                tamanhosOcultosSwipe[id].push(tamanho);
            } else {
                // SE FOI PARCIAL (Achou 1 de 2), deixa a linha com feedback!
                if (linha) {
                    const btn = linha.querySelector('.tam-btn-est');
                    if (btn) btn.innerHTML = `${tamanho}: ${coletadoTotal}/${meta} <span style="color:#22c55e; font-size:0.85em; font-weight:900;">(Salvo)</span>`;
                    linha.style.borderColor = "#22c55e"; 
                }
            }
        }
    });

    wrap.querySelector('.swipe-content').style.transform = 'translateX(0px)';

    if (!algumaAcaoValida) {
        alert("⚠️ Selecione a quantidade antes de arrastar para confirmar!");
        return;
    }

    const histContainer = document.getElementById('histLocalRep');
    const histLista = document.getElementById('listaHistLocal');
    if (histContainer && histLista) {
        histContainer.style.display = 'block';
        const li = document.createElement('div');
        li.className = 'hist-local-item';
        li.innerHTML = `<b>${getHoraCerta()}</b> - <span style="color:var(--uh-primary); font-weight:800;">${item.desc}</span><br><small>✅ Separado: ${qtdSeparadaTexto.join(" | ")}</small>`;
        histLista.prepend(li);
    }

    const linhasVisiveis = Array.from(tamRows).some(row => row.style.display !== 'none');
    if (!linhasVisiveis) {
        itensOcultosSwipe.push(id);
        setTimeout(() => wrap.remove(), 200);
    }
}
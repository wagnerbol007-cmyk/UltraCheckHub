// js/estoque.js
import { database } from './firebase.js';
import { state, getHoraCerta } from './state.js';

let sX = 0; 
let sY = 0;
let itensOcultosSwipe = [];
let tamanhosOcultosSwipe = {};

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

        // 1. Calcula o progresso total, contando inclusive com o que já sumiu da tela
        Object.entries(dados).forEach(([id, item]) => {
            Object.entries(item.pedidos).forEach(([t, d]) => {
                tG += d.qtd; 
                let p = state.coletaEstoqueLocal[id+t] || 0; 
                tC += p;
            });
        });

        // 2. Desenha apenas os itens pendentes
        Object.entries(dados).forEach(([id, item]) => {
            // Se o item já foi arrastado e está oculto, pula a renderização dele!
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
                    // PASSAMOS O ENVELOPE (WRAP) PARA SER DELETADO NA HORA!
                    setTimeout(() => confirmarItemAchei(id, item, wrap), 200);
                } else {
                    card.style.transform = `translateX(0)`; 
                }
            });
            
let grade = "";
            let temTamanhoVisivel = false;

            Object.entries(item.pedidos).forEach(([t, d]) => {
                tG += d.qtd; // Mantenha o cálculo do progresso geral
                let p = state.coletaEstoqueLocal[id+t] || 0; 
                tC += p;
                
                // Verifica se ESSE tamanho específico já foi arrastado e ocultado
                let foiOcultado = tamanhosOcultosSwipe[id] && tamanhosOcultosSwipe[id].includes(t);
                let styleDisplay = foiOcultado ? 'style="display:none;"' : '';
                
                if (!foiOcultado) temTamanhoVisivel = true;

                grade += `<div class="tam-row ${p>=d.qtd?'coletado':''}" ${styleDisplay}><div class="tam-btn-est" onclick="app.ticarContador('${id}','${t}',${d.qtd})">${t}: ${p}/${d.qtd}</div><button class="btn-qr-direct" onclick="app.gerarQR('${t}','${d.fullSku}')">QR</button></div>`;
            });

            // Se todos os tamanhos dessa grade já foram ocultados, cancela a renderização desse card
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
            Object.entries(item.pedidos).forEach(([tamanho, dados]) => {
                const chaveLocal = id + tamanho;
                const coletado = state.coletaEstoqueLocal[chaveLocal] || 0;

                if (coletado > 0) {
                    totalColetado += coletado;

                    historicoItens.push({
                        produto: item.desc || "Produto sem descrição",
                        cor: item.cor || "",
                        skuBase8: item.skuBase8 || id,
                        tamanho: tamanho,
                        sku: dados.fullSku || "",
                        quantidadeSeparada: coletado,
                        quantidadeOriginal: dados.qtd,
                        operadorPedido: item.operador || "",
                        horaPedido: item.hora || ""
                    });

                    if (coletado >= dados.qtd) {
                        updates[`reposicao_ativa/${state.lojaAtual}/${id}/pedidos/${tamanho}`] = null;
                    } else {
                        updates[`reposicao_ativa/${state.lojaAtual}/${id}/pedidos/${tamanho}/qtd`] = dados.qtd - coletado;
                    }
                }
            });
        });

        if (totalColetado === 0) {
            return alert("Nenhum item foi ticado para sincronizar.");
        }

        Object.entries(lista).forEach(([id, item]) => {
            const pedidos = item.pedidos || {};
            let aindaTemPendente = false;

            Object.entries(pedidos).forEach(([tamanho, dados]) => {
                const coletado = state.coletaEstoqueLocal[id + tamanho] || 0;
                if (coletado < dados.qtd) aindaTemPendente = true;
            });

            if (!aindaTemPendente) {
                updates[`reposicao_ativa/${state.lojaAtual}/${id}`] = null;
            }
        });

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

database.ref().update(updates).then(() => {
            state.coletaEstoqueLocal = {};
            
            // LIMPEZA DA TELA APÓS A SINCRONIZAÇÃO
            itensOcultosSwipe = []; // Zera os produtos ocultos
            tamanhosOcultosSwipe = {};
            
            document.getElementById('listaHistLocal').innerHTML = ''; // Limpa os separados agora
            document.getElementById('histLocalRep').style.display = 'none'; // Esconde a caixinha de baixo
            
            ouvirEstoque();
            if (window.mostrarAviso) window.mostrarAviso("Coleta sincronizada e enviada para o histórico!", "sucesso");
        }).catch(error => {
            console.error(error);
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
    let algumaLinhaOcultadaAgora = false;

    if (!tamanhosOcultosSwipe[id]) tamanhosOcultosSwipe[id] = [];

    const tamRows = wrap.querySelectorAll('.tam-row');

    Object.entries(item.pedidos).forEach(([tamanho, dados], index) => {
        const coletado = state.coletaEstoqueLocal[id + tamanho] || 0;
        const linha = tamRows[index];

        // Esconde e registra APENAS o tamanho que foi selecionado (> 0) e que não estava oculto
        if (coletado > 0 && !tamanhosOcultosSwipe[id].includes(tamanho)) {
            if (linha && linha.style.display !== 'none') {
                linha.style.display = 'none'; // Some só a numeração!
                tamanhosOcultosSwipe[id].push(tamanho);
                algumaLinhaOcultadaAgora = true;
                totalSeparado += coletado;
                qtdSeparadaTexto.push(`${coletado}x Tam ${tamanho}`);
            }
        }
    });

    // 1º Passo: O card volta para o centro depois de arrastar
    wrap.querySelector('.swipe-content').style.transform = 'translateX(0px)';

    if (!algumaLinhaOcultadaAgora) {
        alert("⚠️ Selecione a quantidade de um tamanho antes de arrastar para confirmar!");
        return;
    }

    // 2º Passo: Joga no histórico verde ali embaixo
    const histContainer = document.getElementById('histLocalRep');
    const histLista = document.getElementById('listaHistLocal');
    if (histContainer && histLista) {
        histContainer.style.display = 'block';
        const li = document.createElement('div');
        li.className = 'hist-local-item';
        li.innerHTML = `<b>${getHoraCerta()}</b> - <span style="color:var(--uh-primary); font-weight:800;">${item.desc}</span><br><small>✅ Separado: ${qtdSeparadaTexto.join(" | ")}</small>`;
        histLista.prepend(li);
    }

    // 3º Passo: Confere se ainda tem numeração sobrando no card. Se apagou todas, tira o card da tela.
    const linhasVisiveis = Array.from(tamRows).some(row => row.style.display !== 'none');
    if (!linhasVisiveis) {
        itensOcultosSwipe.push(id);
        setTimeout(() => wrap.remove(), 200);
    }
}
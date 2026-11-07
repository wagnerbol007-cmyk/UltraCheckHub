// js/ia.js
// Módulo de IA e Resgate de Etiquetas (Busca por Família) - StockFlow v2.4.1

import { state, normalizarCodigo } from './state.js';
import { mudarTela } from './ui.js';
import { iniciarCamera } from './scanner.js'; 

// ==========================================
// INJEÇÃO DO GERADOR DE CÓDIGO DE BARRAS 128
// ==========================================
function injetarDependencias() {
    if (!window.JsBarcode) {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js";
        document.head.appendChild(script);
    }
}

// ==========================================
// FUNÇÃO DE EXPORTAÇÃO PRINCIPAL
// ==========================================
export function abrirIA() {
    mudarTela("viewIA");
    injetarDependencias();
    
    if (!window.app) window.app = {};
    window.app.gerarEtiqueta128 = abrirModalEtiqueta;
    
    window.app.toggleTamanhosIA = (idCorpo, elBotao) => {
        const corpo = document.getElementById(idCorpo);
        if (corpo.style.display === "none") {
            corpo.style.display = "block";
            elBotao.innerText = "FECHAR TAMANHOS 🔼";
            elBotao.style.background = "#e2e8f0";
        } else {
            corpo.style.display = "none";
            elBotao.innerText = "VER TAMANHOS 🔽";
            elBotao.style.background = "#f1f5f9";
        }
    };

    window.app.abrirScannerIA = () => {
        const modal = document.getElementById('modalScannerIA');
        modal.style.display = 'flex';
        
        iniciarCamera('leitorCameraIA', (codigoLido) => {
            modal.style.display = 'none';
            document.getElementById("iaInputBusca").value = codigoLido;
            if(window.mostrarAviso) window.mostrarAviso("Código lido! Buscando família do produto...", "sucesso");
            realizarBuscaAgrupada(codigoLido);
        });
    };

    window.app.fecharScannerIA = () => {
        document.getElementById('modalScannerIA').style.display = 'none';
        document.getElementById('leitorCameraIA').innerHTML = ""; 
    };

    renderizarInterfaceIA();
}

// ==========================================
// RENDERIZAÇÃO DA INTERFACE PRINCIPAL
// ==========================================
function renderizarInterfaceIA() {
    const container = document.getElementById("iaConteudo");
    if (!container) return;

    container.innerHTML = `
        <div style="background: white; padding: 15px; border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 20px;">
            <!-- align-items: stretch força o botão e o input a terem a mesma altura perfeitamente -->
            <div style="display: flex; gap: 10px; align-items: stretch;">
                <input type="text" id="iaInputBusca" placeholder="Digite o nome, EAN ou bipe o produto..."
                    style="flex: 1; padding: 14px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 1em; font-weight: bold; outline: none; transition: 0.3s; box-sizing: border-box;"
                    onfocus="this.style.borderColor='#6200ee'" onblur="this.style.borderColor='#e2e8f0'">
                
                <button onclick="app.abrirScannerIA()" style="background: #6200ee; border: none; border-radius: 12px; min-width: 55px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.3s; box-shadow: 0 4px 10px rgba(98, 0, 238, 0.2); padding: 0;">
                    <!-- O filter: brightness(0) invert(1) transforma o ícone SVG em branco -->
                    <img src="img/icons/camera.svg" style="width: 24px; height: 24px; filter: brightness(0) invert(1);">
                </button>
            </div>
        </div>

        <div id="iaResultados" style="display: flex; flex-direction: column; gap: 15px; padding-bottom: 30px;">
            <div style="text-align:center; padding: 40px 20px; color: #64748b;">
                <div style="font-size: 3em; margin-bottom: 10px;">🏷️</div>
                <h3 style="margin:0; color:#0f172a;">Recuperação de Produtos</h3>
                <p style="font-size: 0.85em; margin-top: 5px;">Bipe qualquer tamanho de um produto ou pesquise pelo nome para visualizar a família inteira, todas as cores e gerar novas etiquetas.</p>
            </div>
        </div>

        <!-- Modal da Câmera ao Vivo -->
        <div id="modalScannerIA" style="position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:9998; display:none; flex-direction:column; justify-content:center; align-items:center;">
            <div style="background:white; padding:15px; border-radius:20px; width:90%; max-width:400px; text-align:center;">
                <h3 style="margin-top:0; color:#25105f; text-transform:uppercase;">📸 Leitor IA</h3>
                <div id="leitorCameraIA" style="width: 100%; min-height: 250px; background: #000; border-radius: 12px; overflow: hidden; margin-bottom:15px;"></div>
                <button style="background:#ef4444; color:white; width:100%; padding:14px; border:none; border-radius:12px; font-weight:900; cursor:pointer;" onclick="app.fecharScannerIA()">FECHAR CÂMERA</button>
            </div>
        </div>

        <!-- Modal para Código de Barras 128 -->
        <div id="modalBarcodeIA" onclick="this.style.display='none'" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:9999; display:none; justify-content:center; align-items:center; padding:20px;">
            <div class="card-internal" onclick="event.stopPropagation()" style="background: white; padding:25px; text-align:center; max-width:340px; border-radius: 20px; width: 100%; box-sizing: border-box;">
                <h3 id="barcodeTitulo" style="margin-top:0; font-size: 0.9em; color:#1e293b; text-transform: uppercase;"></h3>
                <div style="background: white; padding: 10px; border-radius: 10px; margin: 15px 0; width: 100%; box-sizing: border-box; overflow: hidden; display: flex; justify-content: center;">
                    <svg id="svgBarcode" style="max-width: 100%; height: auto;"></svg>
                </div>
                <p id="barcodeSku" style="font-weight: 900; font-size: 1.1em; margin-bottom: 20px; color: #6200ee; letter-spacing: 2px;"></p>
                <button style="background: #6200ee; color: white; width: 100%; padding: 14px; border: none; border-radius: 12px; font-weight: 900; cursor: pointer;" onclick="document.getElementById('modalBarcodeIA').style.display='none'">FECHAR</button>
            </div>
        </div>
    `;

    const input = document.getElementById("iaInputBusca");
    let timeoutBusca = null;
    
    input.addEventListener("input", (e) => {
        clearTimeout(timeoutBusca);
        timeoutBusca = setTimeout(() => realizarBuscaAgrupada(e.target.value), 350);
    });
}

// ==========================================
// LÓGICA DE BUSCA E AGRUPAMENTO (Busca por Família)
// ==========================================
function extrairDetalhes(item) {
    let saldo = 0, tam = "UN", cor = "";
    for(let key in item) {
        let k = key.toLowerCase();
        if(k.includes("utiliza") || k.includes("estoque") || k.includes("saldo")) saldo = parseInt(item[key] || 0);
        if(k.includes("tamanho") || k.includes("tam") || k.includes("caracter")) tam = String(item[key]);
        if(key === "M" || k.includes("cor") || k.includes("color")) cor = String(item[key]);
    }
    return { saldo, tam, cor };
}

function realizarBuscaAgrupada(termo) {
    termo = termo.trim().toLowerCase();
    const container = document.getElementById("iaResultados");
    
    if (!termo) {
        container.innerHTML = "";
        return;
    }

    if (!state.sapCompleto || state.sapCompleto.length === 0) {
        container.innerHTML = `<div style="text-align:center; color: #ef4444; font-weight:bold;">Base SAP vazia.</div>`;
        return;
    }

    let resultadosBrutos = [];
    const termoNormalizado = normalizarCodigo(termo);

    const itemExato = state.sapCompleto.find(item => {
        const sku = normalizarCodigo(item["Material"] || item["SKU"] || "").toLowerCase();
        const ean = normalizarCodigo(item["EAN"] || "").toLowerCase();
        return (sku === termoNormalizado && sku.length > 7) || (ean === termoNormalizado && ean.length > 5);
    });

    if (itemExato) {
        const skuBase = normalizarCodigo(itemExato["Material"] || itemExato["SKU"] || "");
        const raiz6 = skuBase.substring(0, 6);
        
        resultadosBrutos = state.sapCompleto.filter(item => {
            const sku = normalizarCodigo(item["Material"] || item["SKU"] || "");
            return sku.startsWith(raiz6);
        });
    } else {
        resultadosBrutos = state.sapCompleto.filter(item => {
            const bloco = `
                ${item["Material"] || item["SKU"] || ""} 
                ${item["EAN"] || ""} 
                ${item["Descrição material"] || item["Texto breve material"] || ""}
            `.toLowerCase();
            
            return termo.split(/\s+/).every(t => bloco.includes(t));
        });
    }

    if (resultadosBrutos.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 30px; font-weight:bold; color: #64748b;">Nenhum produto encontrado.</div>`;
        return;
    }

    const familiasAgrupadas = {};

    resultadosBrutos.forEach(item => {
        const skuCompleto = normalizarCodigo(item["Material"] || item["SKU"] || "");
        const raiz8 = skuCompleto.substring(0, 8); 

        const info = extrairDetalhes(item);

        if (!familiasAgrupadas[raiz8]) {
            familiasAgrupadas[raiz8] = {
                descricao: item["Descrição material"] || item["Texto breve material"] || "Sem Nome",
                raiz8: raiz8,
                corPrincipal: info.cor, // Salva a cor logo de cara para o card principal
                skus: []
            };
        }

        if (!familiasAgrupadas[raiz8].skus.find(s => s.sku13 === skuCompleto)) {
            familiasAgrupadas[raiz8].skus.push({
                sku13: skuCompleto,
                tamanho: info.tam,
                estoque: info.saldo,
                cor: info.cor
            });
        }
    });

    renderizarCardsFamilia(familiasAgrupadas);
}

// ==========================================
// RENDERIZAÇÃO DA TELA (Com Efeito Sanfona, Cor e Zoom)
// ==========================================
function renderizarCardsFamilia(familiasAgrupadas) {
    const container = document.getElementById("iaResultados");
    let html = "";

    Object.entries(familiasAgrupadas).forEach(([raiz8, familia]) => {
        
        familia.skus.sort((a, b) => b.estoque - a.estoque || a.tamanho.localeCompare(b.tamanho));

        let gradeHtml = "";
        familia.skus.forEach(item => {
            const bg = item.estoque > 0 ? "#f0fdf4" : "#f8fafc";
            const border = item.estoque > 0 ? "#22c55e" : "#e2e8f0";
            const color = item.estoque > 0 ? "#166534" : "#64748b";
            
            gradeHtml += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: ${bg}; border: 1px solid ${border}; padding: 10px 12px; border-radius: 12px; margin-top: 8px;">
                    <div>
                        <div style="font-weight: 900; color: #0f172a; display:flex; align-items:center;">TAM: ${item.tamanho}</div>
                        <div style="font-size: 0.8em; color: ${color}; font-weight: bold; margin-top: 2px;">Estoque: ${item.estoque}</div>
                    </div>
                    
                    <button onclick="app.gerarEtiqueta128('${item.sku13}', '${item.tamanho}')" 
                            style="background: #2563eb; color: white; border: none; padding: 10px 15px; border-radius: 10px; font-weight: 900; cursor: pointer; display: flex; gap: 6px; align-items: center; box-shadow: 0 4px 6px rgba(37,99,235,0.2);">
                        🖨️ CODE 128
                    </button>
                </div>
            `;
        });

        // Adiciona a TAG de COR no Card Principal (se o SAP enviou a cor)
        const badgeCor = familia.corPrincipal ? `<div style="background:#e2e8f0; color:#334155; padding:4px 10px; border-radius:8px; font-size:0.75em; font-weight:800; display:inline-block; margin-top:8px;">🎨 COR: ${familia.corPrincipal}</div>` : '';

        html += `
            <div style="background: white; border-radius: 20px; padding: 18px; box-shadow: 0 4px 15px rgba(0,0,0,0.04); border: 1px solid #f1f5f9;">
                <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 15px;">
                    <!-- IMAGEM CLICÁVEL: Chama a função nativa com resolução ampliada para ver os detalhes! -->
                    <img src="https://imgcentauro-a.akamaihd.net/100x100/${familia.raiz8}.jpg" 
                         onclick="if(window.app.zoomFoto) window.app.zoomFoto(this.src.replace('100x100', '900x900'));"
                         style="width: 70px; height: 70px; border-radius: 12px; object-fit: contain; border: 1px solid #e2e8f0; background: white; cursor: pointer; transition: 0.2s;"
                         onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect width=%22100%22 height=%22100%22 fill=%22%23f1f5f9%22/></svg>'">
                    
                    <div style="flex: 1;">
                        <div style="font-size: 0.75em; color: #6200ee; font-weight: 900; letter-spacing: 1px;">REF: ${raiz8}</div>
                        <div style="font-weight: 900; color: #0f172a; font-size: 0.95em; line-height: 1.2; margin-top: 4px;">
                            ${familia.descricao}
                        </div>
                        ${badgeCor}
                    </div>
                </div>
                
                <button onclick="app.toggleTamanhosIA('tamanhos-${raiz8}', this)"
                        style="width: 100%; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; padding: 10px; border-radius: 10px; font-weight: 900; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: 0.2s;">
                    VER TAMANHOS 🔽
                </button>
                
                <div id="tamanhos-${raiz8}" style="display: none; margin-top: 10px; border-top: 2px dashed #e2e8f0; padding-top: 10px;">
                    <div style="font-size: 0.75em; color: #64748b; font-weight: 900; text-transform: uppercase; margin-bottom: 5px;">Tamanhos Disponíveis:</div>
                    ${gradeHtml}
                </div>
            </div>
        `;
    });

    document.getElementById("iaResultados").innerHTML = html;
}

// ==========================================
// ABERTURA DO MODAL DA ETIQUETA (Code 128)
// ==========================================
function abrirModalEtiqueta(sku13, tamanho) {
    if (!window.JsBarcode) {
        alert("A biblioteca de código de barras ainda está carregando. Tente novamente em 2 segundos.");
        return;
    }

    document.getElementById("barcodeTitulo").innerText = `TAMANHO ${tamanho}`;
    document.getElementById("barcodeSku").innerText = sku13;
    
    // Diminuímos a largura nativa das barras (width: 2) para caber melhor códigos compridos
    JsBarcode("#svgBarcode", sku13, {
        format: "CODE128",
        width: 2,
        height: 80,
        displayValue: false, 
        background: "#ffffff",
        lineColor: "#000000",
        margin: 0
    });

    document.getElementById("modalBarcodeIA").style.display = "flex";
}
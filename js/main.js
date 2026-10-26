// js/main.js
import { state } from './state.js';
import { mudarTela, voltarTela, mostrarLoading } from './ui.js';
import { fazerLogin, fazerLogout, confirmarLoja } from './auth.js';
import { iniciarCamera } from './scanner.js';
import { analisarDisponibilidade, enviarPedidoFaltantes } from './reposicao.js';
import { ouvirEstoque, ouvirAnalise, limparAnalise, finalizarColetaGeral, ouvirHistorico } from './estoque.js';
import { processarSAP, processarReman, processarUploadApp2 } from './upload.js';
import { abrirIA } from "./ia.js";

// Nas importações do Reman no início do main.js:
import {
    biparReman,
    alternarStatusReman,
    renderizarListaCompletaReman,
    exportarRemanExcel,
    ticarContadorReman,
    aumentarReman,
    diminuirReman,
    abrirSubTelaReman,
    biparPossivelReman,
    adicionarPossivelReman,
    removerPossivelReman,
    exportarPossivelReman,
    renderizarListaPossivelReman,
    removerPossivelRemanLista    // <--- ADICIONAR AQUI
} from './reman.js';

import {
    abrirModoInventario,
    aplicarFiltroCategoriaInv,
    navegarInventario,
    salvarContagemRemota,
    espiarMojix
} from './inventario_core.js';

import {
    gerarHistAuditoria,
    baixarCSVInventario,
    limparColetaInventario
} from './inventario_relatorio.js';

import {
    abrirCriarMasterBox,
    abrirConsultarMasterBox,
    abrirBuscarItemMasterBox,
    biparItemMaster,
    alterarQtdMaster,
    removerItemMaster,
    salvarMasterAtual,
    consultarMaster,
    buscarItemNaMaster,
    exportarPDFMaster,
    listarHistoricoMasters,
    editarMasterAtual,
    exportarMasterExcel,
    exportarTodasMasters,
    imprimirEtiquetaMaster
} from './masterbox.js';

// Criando a "lista de presença" (window.app)
window.app = {
    voltarMenu: () => voltarTela(),

    abrirPainel: async (painelId) => {
        mostrarLoading(true);

        setTimeout(() => {
            mudarTela(painelId);

            setTimeout(() => {
                if (painelId === 'viewEstoque') ouvirEstoque();
                if (painelId === 'viewAnalise') ouvirAnalise();
                if (painelId === 'viewRelatorio') ouvirHistorico();
                if (painelId === 'viewReman') {
                    // Quando abre o painel Reman, sempre joga pro Hub Inicial
                    window.app.abrirSubTelaReman('hub'); 
                    renderizarListaCompletaReman();
                }

                setTimeout(() => {
                    mostrarLoading(false);
                }, 500);

            }, 150);

        }, 80);
    },

    zoomFoto: (url) => {
        document.getElementById('imgGrande').src = url.replace('100x100', '768x768');
        document.getElementById('modalFoto').style.display = 'flex';
    },

    fazerLogin,
    confirmarLoja,
    fazerLogout,

    iniciarCamera: (containerId, contexto) => {
        iniciarCamera(containerId, (codigoLido) => {
            if (contexto === 'reposicao') {
                document.getElementById('inputBip').value = codigoLido;
                analisarDisponibilidade(codigoLido);
            }
            else if (contexto === 'reman') {
                document.getElementById('inputBipReman').value = codigoLido;
                window.app.biparReman(codigoLido);
            }
            else if (contexto === 'possivel_reman') {
                document.getElementById('inputBipPossivelReman').value = codigoLido;
                window.app.biparPossivelReman(codigoLido);
            }
            else if (contexto === 'master') {
                const agora = Date.now();
                if (window.__ultimoBipMasterCodigo === codigoLido && agora - window.__ultimoBipMasterTempo < 1200) {
                    return;
                }
                window.__ultimoBipMasterCodigo = codigoLido;
                window.__ultimoBipMasterTempo = agora;
                document.getElementById('inputBipMaster').value = codigoLido;
                window.app.biparItemMaster();
            }
            else if (contexto === 'masterConsulta') {
                document.getElementById('inputMasterConsulta').value = codigoLido;
                window.app.consultarMaster();
            }
            else if (contexto === 'masterBusca') {
                document.getElementById('inputBuscaItemMaster').value = codigoLido;
                window.app.buscarItemNaMaster();
            }
        });
    },

    biparReposicao: analisarDisponibilidade,
    enviarPedidoFaltantes,

    // Funções do Reman (Antigas e Novas)
    biparReman: biparReman,
    alternarStatusReman: alternarStatusReman,
    ticarContadorReman: ticarContadorReman,
    renderizarListaCompletaReman: renderizarListaCompletaReman,
    exportarReman: exportarRemanExcel,
    aumentarReman: aumentarReman,
    diminuirReman: diminuirReman,
    
    abrirSubTelaReman: abrirSubTelaReman,          // <--- NOME CORRETO
    biparPossivelReman: biparPossivelReman,
    adicionarPossivelReman: adicionarPossivelReman,
    removerPossivelReman: removerPossivelReman,
    exportarPossivelReman: exportarPossivelReman,
    renderizarListaPossivelReman: renderizarListaPossivelReman, // <--- NOME CORRETO
    removerPossivelRemanLista: removerPossivelRemanLista,       // <--- ADICIONAR AQUI

    gerarQRReman: (tamanho, sku) => {
        event.stopPropagation();
        document.getElementById('qrTitle').innerText = "PROCURAR TAMANHO: " + tamanho;
        document.getElementById('qrSku').innerText = sku;
        document.getElementById('qrcode').innerHTML = "";

        new QRCode(document.getElementById('qrcode'), {
            text: sku,
            width: 180,
            height: 180
        });

        document.getElementById('modalQR').style.display = 'flex';
    },

    ticarContador: (idPedido, tamanho, qtdTotal) => {
        let atual = state.coletaEstoqueLocal[idPedido + tamanho] || 0;
        if (atual < qtdTotal) {
            state.coletaEstoqueLocal[idPedido + tamanho] = atual + 1;
            ouvirEstoque();
        }
    },

    gerarQR: (tamanho, sku) => {
        window.app.gerarQRReman(tamanho, sku);
    },

    limparAnalise,
    finalizarColetaGeral,

    abrirModoInventario,
    aplicarFiltroCategoriaInv,
    navegarInventario,
    salvarContagemRemota,
    espiarMojix,

    gerarQRInv: () => {
        window.app.gerarQRReman(
            document.getElementById('viewTamanhoInv').innerText,
            document.getElementById('viewSKUInv').innerText
        );
    },

    gerarHistAuditoria,
    baixarCSVInventario,
    limparColetaInventario,

    processarSAP,
    processarReman,
    processarUploadApp2,

    abrirCriarMasterBox,
    abrirConsultarMasterBox,
    abrirBuscarItemMasterBox,
    biparItemMaster,
    alterarQtdMaster,
    removerItemMaster,
    salvarMasterAtual,
    consultarMaster,
    buscarItemNaMaster,
    exportarPDFMaster,
    listarHistoricoMasters,
    editarMasterAtual,
    
    // Funções de Exportação da Master Box
    exportarMasterExcel: exportarMasterExcel,
    exportarTodasMasters: exportarTodasMasters,
    imprimirEtiquetaMaster: imprimirEtiquetaMaster,
    
    abrirIA: abrirIA
}; 

document.addEventListener("DOMContentLoaded", () => {
    mudarTela('viewLogin');
});
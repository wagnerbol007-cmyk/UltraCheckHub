// js/main.js
import { state } from './state.js';
import { mudarTela, voltarTela, mostrarLoading } from './ui.js';
import { fazerLogin, fazerLogout, confirmarLoja } from './auth.js';
import { iniciarCamera } from './scanner.js';
import { analisarDisponibilidade, enviarPedidoFaltantes } from './reposicao.js';
import { ouvirEstoque, ouvirAnalise, limparAnalise, finalizarColetaGeral, ouvirHistorico } from './estoque.js';
import { biparReman, alternarStatusReman, renderizarListaCompletaReman, exportarRemanExcel } from './reman.js';
import { processarSAP, processarReman, processarUploadApp2 } from './upload.js';

// IMPORTAÇÕES DO INVENTÁRIO (APP 2)
import {
    abrirModoInventario,
    aplicarFiltroCategoriaInv,
    renderInventario,
    navegarInventario,
    salvarContagemRemota,
    espiarMojix
} from './inventario_core.js';

import {
    gerarHistAuditoria,
    baixarCSVInventario,
    limparColetaInventario
} from './inventario_relatorio.js';

window.app = {

    // UI e Navegação
  voltarMenu: () => voltarTela(),

abrirPainel: async (painelId) => {
    mostrarLoading(true);

    setTimeout(() => {
        mudarTela(painelId);

        setTimeout(() => {
            if (painelId === 'viewEstoque') ouvirEstoque();
            if (painelId === 'viewAnalise') ouvirAnalise();
            if (painelId === 'viewRelatorio') ouvirHistorico();
            if (painelId === 'viewReman') renderizarListaCompletaReman();

            setTimeout(() => {
                mostrarLoading(false);
            }, 500);

        }, 150);

    }, 80);
},

    zoomFoto: (url) => {
        document.getElementById('imgGrande').src =
            url.replace('100x100', '768x768');

        document.getElementById('modalFoto').style.display = 'flex';
    },

    // LOGIN / AUTH
    fazerLogin: fazerLogin,
    confirmarLoja: confirmarLoja,
    fazerLogout: fazerLogout,

    // CÂMERA
    iniciarCamera: (containerId, contexto) => {

        iniciarCamera(containerId, (codigoLido) => {

            if (contexto === 'reposicao') {

                document.getElementById('inputBip').value = codigoLido;

                analisarDisponibilidade(codigoLido);

            } else if (contexto === 'reman') {

                document.getElementById('inputBipReman').value = codigoLido;

                biparReman(codigoLido);
            }

        });

    },

    // REPOSIÇÃO
    biparReposicao: analisarDisponibilidade,
    enviarPedidoFaltantes: enviarPedidoFaltantes,

    // REMAN
    biparReman: biparReman,
    alternarStatusReman: alternarStatusReman,
    exportarReman: exportarRemanExcel,

    gerarQRReman: (tamanho, sku) => {

        event.stopPropagation();

        document.getElementById('qrTitle').innerText =
            "PROCURAR TAMANHO: " + tamanho;

        document.getElementById('qrSku').innerText = sku;

        document.getElementById('qrcode').innerHTML = "";

        new QRCode(document.getElementById('qrcode'), {
            text: sku,
            width: 180,
            height: 180
        });

        document.getElementById('modalQR').style.display = 'flex';
    },

    // ESTOQUE
    ticarContador: (idPedido, tamanho, qtdTotal) => {

        let atual =
            state.coletaEstoqueLocal[idPedido + tamanho] || 0;

        if (atual < qtdTotal) {

            state.coletaEstoqueLocal[idPedido + tamanho] =
                atual + 1;

            ouvirEstoque();
        }
    },

    gerarQR: (tamanho, sku) => {
        window.app.gerarQRReman(tamanho, sku);
    },

    limparAnalise: limparAnalise,

    finalizarColetaGeral: finalizarColetaGeral,

    // INVENTÁRIO
    abrirModoInventario: abrirModoInventario,

    aplicarFiltroCategoriaInv: aplicarFiltroCategoriaInv,

    navegarInventario: navegarInventario,

    salvarContagemRemota: salvarContagemRemota,

    espiarMojix: espiarMojix,

    gerarQRInv: () => {

        window.app.gerarQRReman(
            document.getElementById('viewTamanhoInv').innerText,
            document.getElementById('viewSKUInv').innerText
        );

    },

    gerarHistAuditoria: gerarHistAuditoria,

    baixarCSVInventario: baixarCSVInventario,

    limparColetaInventario: limparColetaInventario,

    // UPLOADS
    processarSAP: processarSAP,

    processarReman: processarReman,

    processarUploadApp2: processarUploadApp2
};

document.addEventListener("DOMContentLoaded", () => {

    mudarTela('viewLogin');

});
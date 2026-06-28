// js/auth.js
import { state, normalizarCodigo } from './state.js';
import { mudarTela, mostrarLoading } from './ui.js';
import { database, auth } from './firebase.js';
import { renderizarListaCompletaReman } from './reman.js';

const TEMPO_INATIVIDADE = 15 * 60 * 1000; // 15 minutos

let timerInatividade = null;

let refSAPAtual = null;
let refRemanAtual = null;
let refMojixAtual = null;

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

document.addEventListener("DOMContentLoaded", () => {
    iniciarControleInatividade();

    auth.onAuthStateChanged(user => {
        if (user) {
            const usuario = user.email.split("@")[0];

            state.operador = usuario.toUpperCase();

            const inputUsuario = document.getElementById('inputUsuario');
            if (inputUsuario) inputUsuario.value = usuario;

            document.getElementById('labelOperador').innerText = state.operador;

            const ultimaLoja = localStorage.getItem("ultimaLojaUltraCheck");

            if (ultimaLoja) {
                const inputLoja = document.getElementById('inputLoja');
                if (inputLoja) inputLoja.value = ultimaLoja;
                confirmarLoja(true);
            } else {
                mudarTela('viewSelecionarLoja');
            }
        } else {
            mudarTela('viewLogin');
        }
    });
});

export function fazerLogin() {
    const usuario = document.getElementById('inputUsuario').value.trim().toLowerCase();
    const senha = document.getElementById('inputSenha').value.trim();

    if (!usuario || !senha) {
        return alert("Preencha usuário e senha!");
    }

    const emailLogin = `${usuario}@ultracheck.local`;

    mostrarLoading(true);

    auth.signInWithEmailAndPassword(emailLogin, senha)
        .then(() => {
            state.operador = usuario.toUpperCase();

            document.getElementById('labelOperador').innerText = state.operador;
            document.getElementById('inputSenha').value = "";

            mostrarLoading(false);
            mudarTela('viewSelecionarLoja');
        })
        .catch(() => {
            mostrarLoading(false);
            alert("Acesso negado! Verifique usuário e senha.");
        });
}

export function confirmarLoja(auto = false) {
    const loja = document.getElementById('inputLoja').value.trim();

    if (!loja) {
        return alert("Informe o número da loja!");
    }

    state.lojaAtual = loja;

    localStorage.setItem("ultimaLojaUltraCheck", loja);

    document.getElementById('displayLoja').innerText = state.lojaAtual;
    document.getElementById('labelLojaAtiva').innerText = state.lojaAtual;
    document.getElementById('labelOperador').innerText = state.operador;

    mostrarLoading(true);

// Primeiro abre o menu
mudarTela('viewMenu');

setTimeout(() => {
    mostrarLoading(false);

    // Depois começa a carregar tudo em segundo plano
    setTimeout(() => {
        carregarBancosDaLoja();
    }, 100);

}, auto ? 300 : 500);
}

function carregarBancosDaLoja() {
    if (refSAPAtual) refSAPAtual.off();
    if (refRemanAtual) refRemanAtual.off();
    if (refMojixAtual) refMojixAtual.off();

    const lojaCarregada = state.lojaAtual;

    refSAPAtual = database.ref('arquivos_reposicao/' + lojaCarregada);
    refRemanAtual = database.ref('arquivos_reman/' + lojaCarregada);
    refMojixAtual = database.ref('arquivos_lojas/' + lojaCarregada);

refSAPAtual.once('value')
.then(s => {
        if (state.lojaAtual !== lojaCarregada) return;

        if (s.exists()) {
            const data = s.val();

            state.sapCompleto = JSON.parse(data.sap);
            state.dbSap = {};

            state.sapCompleto.forEach(i => {
                state.dbSap[String(i.Material || i.SKU).trim()] = i;

                if (i.EAN) {
                    state.dbSap[String(i.EAN).trim()] = i;
                }
            });

            state.sapCarregado = true;

            console.log("SAP Carregado da loja:", lojaCarregada);

            verificarDataSAP(data.timestamp);

            try {
                renderizarListaCompletaReman();
            } catch (e) {}
        } else {
            limparStatusSAP();
        }
    });

refRemanAtual.once('value')
.then(s => {
        if (state.lojaAtual !== lojaCarregada) return;

        if (s.exists()) {
            state.dadosReman = JSON.parse(s.val().reman);
            state.dbReman8 = {};

            state.dadosReman.forEach(i => {
                let sku = String(i.SKU || i.Material || "").trim();

                if (sku.length >= 8) {
                    state.dbReman8[sku.substring(0, 8)] = true;
                }
            });

            console.log("Reman Carregado da loja:", lojaCarregada);

            try {
                renderizarListaCompletaReman();
            } catch (e) {}
        }
    });

    refMojixAtual.once('value')
.then(snapshot => {
        if (state.lojaAtual !== lojaCarregada) return;

        const d = snapshot.val();

        if (d && d.mogix) {
            Papa.parse(d.mogix, {
                header: true,
                complete: res => {
                    if (state.lojaAtual !== lojaCarregada) return;

                    state.dbMojixGlobal = {};

                    res.data.forEach(m => {
                        const sku = normalizarCodigo(m.SKU);

                        if (sku) {
                            state.dbMojixGlobal[sku] = m;
                        }
                    });

                    console.log("Mojix Carregado da loja:", lojaCarregada);
                }
            });
        }
    });
}

function verificarDataSAP(timestamp) {
    if (!timestamp) return;

    const diffHoras = Math.floor((new Date().getTime() - timestamp) / (1000 * 60 * 60));
    const diffMins = Math.floor(((new Date().getTime() - timestamp) / (1000 * 60)) % 60);

    let barMenu = document.getElementById('sapStatusMenu');

    if (!barMenu) {
        barMenu = document.createElement('div');
        barMenu.id = 'sapStatusMenu';

        const menuGrid = document.querySelector('.home-grid');

        if (menuGrid) {
            menuGrid.parentNode.insertBefore(barMenu, menuGrid);
        }
    }

    let txt = "";
    let bg = "";
    let color = "";
    let border = "";

    if (diffHoras < 4) {
        txt = `✅ SAP ATUALIZADO HÁ ${diffHoras}h ${diffMins}m`;
        bg = '#dcfce7';
        color = '#166534';
        border = '1px solid #bbf7d0';
    } else {
        txt = `⚠️ SAP DESATUALIZADO HÁ ${diffHoras} HORAS!`;
        bg = '#fee2e2';
        color = '#991b1b';
        border = '1px solid #fecaca';
    }

    barMenu.innerText = txt;
    barMenu.style.cssText = `
        width: 100%;
        max-width: 450px;
        padding: 10px;
        border-radius: 10px;
        margin-bottom: 15px;
        font-size: 0.75em;
        font-weight: 900;
        text-align: center;
        text-transform: uppercase;
        background: ${bg};
        color: ${color};
        border: ${border};
    `;
}

function limparStatusSAP() {
    const barMenu = document.getElementById('sapStatusMenu');

    if (barMenu) {
        barMenu.innerText = "⚠️ SAP NÃO ENCONTRADO PARA ESTA LOJA";
        barMenu.style.cssText = `
            width: 100%;
            max-width: 450px;
            padding: 10px;
            border-radius: 10px;
            margin-bottom: 15px;
            font-size: 0.75em;
            font-weight: 900;
            text-align: center;
            text-transform: uppercase;
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #fecaca;
        `;
    }
}

function iniciarControleInatividade() {
    const eventos = ['click', 'touchstart', 'keydown', 'mousemove'];

    eventos.forEach(evento => {
        document.addEventListener(evento, resetarTimerInatividade, true);
    });

    resetarTimerInatividade();
}

function resetarTimerInatividade() {
    clearTimeout(timerInatividade);

    timerInatividade = setTimeout(() => {
        auth.signOut().then(() => {
            localStorage.removeItem("ultimaLojaUltraCheck");
            alert("Sessão encerrada por inatividade.");
            location.reload();
        });
    }, TEMPO_INATIVIDADE);
}

export function fazerLogout() {
    if (confirm("Sair do sistema?")) {
        if (refSAPAtual) refSAPAtual.off();
        if (refRemanAtual) refRemanAtual.off();
        if (refMojixAtual) refMojixAtual.off();

        auth.signOut().then(() => {
            localStorage.removeItem("ultimaLojaUltraCheck");
            location.reload();
        });
    }
}
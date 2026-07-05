// js/ui.js
// StockFlow v2.4.1

let historicoTelas = [];
let telaAtual = null;
let ignorarHistorico = false;

export function mudarTela(idView, registrar = true) {
    if (registrar && telaAtual && telaAtual !== idView) {
        historicoTelas.push(telaAtual);
    }

    telaAtual = idView;

    document.querySelectorAll('.view-container').forEach(v => {
        v.classList.remove('active-view');
        v.style.display = 'none';
    });

    const viewAtiva = document.getElementById(idView);

    if (viewAtiva) {
        viewAtiva.classList.add('active-view');
        viewAtiva.style.display = 'flex';
    }

    const btnVoltar = document.getElementById('btnVoltarHome');
    const infoHeader = document.getElementById('infoHeader');

    if (btnVoltar) {
        btnVoltar.style.display =
            (idView === 'viewLogin' || idView === 'viewMenu')
                ? 'none'
                : 'block';
    }

    if (infoHeader) {
        infoHeader.style.display =
            idView === 'viewLogin'
                ? 'none'
                : 'block';
    }

    if (!ignorarHistorico && idView !== 'viewLogin') {
        history.pushState({ tela: idView }, "", "");
    }
}

export function voltarTela() {
    if (historicoTelas.length > 0) {
        const telaAnterior = historicoTelas.pop();
        mudarTela(telaAnterior, false);
        return;
    }

    if (telaAtual && telaAtual !== 'viewMenu' && telaAtual !== 'viewLogin') {
        mudarTela('viewMenu', false);
    }
}

window.addEventListener('popstate', () => {
    ignorarHistorico = true;
    voltarTela();
    setTimeout(() => {
        ignorarHistorico = false;
    }, 100);
});

export function mostrarLoading(mostrar) {
    const overlay = document.getElementById('overlay');

    if (mostrar) {
        overlay.classList.remove('overlay-hidden');
        overlay.style.display = 'flex';
    } else {
        overlay.classList.add('overlay-hidden');
        overlay.style.display = 'none';
    }
}
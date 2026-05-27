// js/ui.js

export function mudarTela(idView) {
    // Esconde todas as views
    document.querySelectorAll('.view-container').forEach(v => {
        v.classList.remove('active-view');
        v.style.display = 'none';
    });
    
    // Mostra a selecionada
    const viewAtiva = document.getElementById(idView);
    if (viewAtiva) {
        viewAtiva.classList.add('active-view');
        viewAtiva.style.display = 'flex';
    }

    // Controle do botão Voltar (Menu)
    const btnVoltar = document.getElementById('btnVoltarHome');
    const infoHeader = document.getElementById('infoHeader');
    
    if (idView === 'viewLogin' || idView === 'viewMenu') {
        btnVoltar.style.display = 'none';
    } else {
        btnVoltar.style.display = 'block';
    }

    if(idView !== 'viewLogin') {
        infoHeader.style.display = 'block';
    }
}

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
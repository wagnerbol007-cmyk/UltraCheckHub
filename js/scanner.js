// js/scanner.js

let scannerAtual = null;

export function iniciarCamera(containerId, callbackSucesso) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.style.display = 'block';
    
    // Se já existe um scanner rodando, tenta parar antes
    if (scannerAtual) {
        scannerAtual.stop().catch(e => console.log(e));
    }

    scannerAtual = new Html5Qrcode(containerId);
    
    scannerAtual.start(
        { facingMode: "environment" }, 
        { fps: 20, qrbox: 280 }, 
        (decodedText) => {
            // Sucesso!
            callbackSucesso(decodedText);
            pararCamera(containerId);
        },
        (errorMessage) => {
            // Ignora os frames sem código
        }
    ).catch(err => {
        alert("Erro ao acessar câmera. Verifique as permissões.");
        container.style.display = 'none';
    });
}

export function pararCamera(containerId) {
    if (scannerAtual) {
        scannerAtual.stop().then(() => {
            document.getElementById(containerId).style.display = 'none';
            scannerAtual = null;
        }).catch(err => console.error(err));
    } else {
        document.getElementById(containerId).style.display = 'none';
    }
}
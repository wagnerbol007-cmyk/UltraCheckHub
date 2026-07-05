// js/upload.js
// StockFlow v2.4.0
// Ao subir nova Busca Analista, pergunta se deseja apagar a coleta da 2ª Busca

import { state } from './state.js';
import { database } from './firebase.js';

export async function processarSAP() {
    const f = document.getElementById('fileSAP').files[0];

    if (!f) {
        return alert("Selecione um arquivo SAP primeiro!");
    }

    document.getElementById('overlay').style.display = 'flex';

    const r = new FileReader();

    r.onload = async e => {
        try {
            const workbook = XLSX.read(
                new Uint8Array(e.target.result),
                { type: 'array' }
            );

            const sheet = workbook.Sheets[workbook.SheetNames[0]];

            const j = XLSX.utils.sheet_to_json(sheet);

            let sapTratado = [];

            for (let i = 0; i < j.length; i++) {
                sapTratado.push(j[i]);
            }

            await database
                .ref(`arquivos_reposicao/${state.lojaAtual}`)
                .set({
                    sap: JSON.stringify(sapTratado),
                    timestamp: new Date().getTime()
                });

            document.getElementById('overlay').style.display = 'none';

            alert("Upload do SAP Concluído com Sucesso!");

            location.reload();

        } catch (err) {
            document.getElementById('overlay').style.display = 'none';
            alert("Erro ao processar planilha SAP!");
        }
    };

    r.readAsArrayBuffer(f);
}

export async function processarReman() {
    const f = document.getElementById('fileReman').files[0];

    if (!f) {
        return alert("Selecione um arquivo de Reman!");
    }

    document.getElementById('overlay').style.display = 'flex';

    const r = new FileReader();

    r.onload = async e => {
        try {
            const workbook = XLSX.read(
                new Uint8Array(e.target.result),
                { type: 'array' }
            );

            const sheet = workbook.Sheets[workbook.SheetNames[0]];

            const j = XLSX.utils.sheet_to_json(sheet);

            await database
                .ref(`arquivos_reman/${state.lojaAtual}`)
                .set({
                    reman: JSON.stringify(j),
                    timestamp: new Date().getTime()
                });

            document.getElementById('overlay').style.display = 'none';

            alert("Planilha Reman Sincronizada!");

            location.reload();

        } catch (err) {
            document.getElementById('overlay').style.display = 'none';
            alert("Erro ao processar planilha Reman!");
        }
    };

    r.readAsArrayBuffer(f);
}

export async function processarUploadApp2() {
    const fM = document.getElementById('inMogix').files[0];
    const fB = document.getElementById('inBusca').files[0];

    if (!fM && !fB) {
        return alert("Selecione o arquivo do Mojix ou da Busca Analista!");
    }

    document.getElementById('overlay').style.display = 'flex';

    let d = {};

    try {
        if (fB) {
            document.getElementById('overlay').style.display = 'none';

            const apagar = confirm(
                "Nova Busca Analista detectada.\n\n" +
                "Deseja apagar a coleta atual da 2ª Busca antes de subir a nova base?\n\n" +
                "Recomendado: SIM, para evitar que respostas antigas apareçam na nova busca."
            );

            document.getElementById('overlay').style.display = 'flex';

            if (apagar) {
                await database
                    .ref(`sinc_rfid_segunda/${state.lojaAtual}`)
                    .remove();
            }
        }

        if (fM) {
            d.mogix = await fM.text();

            const apagarPrimeira = confirm(
                "Novo Report Mojix detectado.\n\n" +
                "Deseja apagar a coleta atual da 1ª Busca?\n\n" +
                "Recomendado: SIM quando o relatório for de um novo inventário."
            );

            if (apagarPrimeira) {
                await database
                    .ref(`sinc_rfid_primeira/${state.lojaAtual}`)
                    .remove();
            }
        }

        if (fB) {
            const workbook = XLSX.read(
                await fB.arrayBuffer(),
                { type: 'array' }
            );

            const sheet = workbook.Sheets[workbook.SheetNames[0]];

            const buscaTratada = XLSX.utils
                .sheet_to_json(sheet)
                .map(row => {
                    const primeiraColuna = Object.values(row)[0];

                    return {
                        Material: String(primeiraColuna || "").trim()
                    };
                })
                .filter(item => item.Material);

            d.busca = JSON.stringify(buscaTratada);
        }

        await database
            .ref('arquivos_lojas/' + state.lojaAtual)
            .update(d);

        document.getElementById('overlay').style.display = 'none';

        alert("Bases de Inventário Sincronizadas!");

        location.reload();

    } catch (e) {
        document.getElementById('overlay').style.display = 'none';

        alert(
            "Erro ao subir bases!\n\n" +
            (e.message || e)
        );
    }
}
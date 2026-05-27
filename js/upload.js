// js/upload.js
import { state } from './state.js';
import { database } from './firebase.js';

export async function processarSAP() {
    const f = document.getElementById('fileSAP').files[0]; 
    if(!f) return alert("Selecione um arquivo SAP primeiro!");
    
    document.getElementById('overlay').style.display = 'flex'; 
    const r = new FileReader();
    
    r.onload = async e => {
        try {
            const j = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result),{type:'array'}).Sheets[XLSX.read(new Uint8Array(e.target.result),{type:'array'}).SheetNames[0]]);
            const total = j.length; 
            let sapTratado = [];
            
            for (let i = 0; i < total; i++) {
                sapTratado.push(j[i]);
            }
            
            await database.ref(`arquivos_reposicao/${state.lojaAtual}`).set({ sap: JSON.stringify(sapTratado), timestamp: new Date().getTime() });
            document.getElementById('overlay').style.display = 'none'; 
            alert("Upload do SAP Concluído com Sucesso!"); 
            location.reload();
        } catch(err) { 
            document.getElementById('overlay').style.display = 'none'; 
            alert("Erro ao processar planilha SAP!"); 
        }
    };
    r.readAsArrayBuffer(f);
}

export async function processarReman() {
    const f = document.getElementById('fileReman').files[0]; 
    if(!f) return alert("Selecione um arquivo de Reman!");
    
    document.getElementById('overlay').style.display = 'flex';
    const r = new FileReader();
    
    r.onload = async e => {
        try {
            const j = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result),{type:'array'}).Sheets[XLSX.read(new Uint8Array(e.target.result),{type:'array'}).SheetNames[0]]);
            await database.ref(`arquivos_reman/${state.lojaAtual}`).set({ reman: JSON.stringify(j) });
            document.getElementById('overlay').style.display = 'none';
            alert("Planilha Reman Sincronizada!"); 
            location.reload();
        } catch(err) { 
            document.getElementById('overlay').style.display = 'none';
            alert("Erro ao processar planilha Reman!"); 
        }
    };
    r.readAsArrayBuffer(f);
}

export async function processarUploadApp2() {
    const fM = document.getElementById('inMogix').files[0];
    const fB = document.getElementById('inBusca').files[0];
    
    if(!fM && !fB) return alert("Selecione o arquivo do Mojix ou da Busca Analista!");
    
    document.getElementById('overlay').style.display = 'flex';
    let d = {}; 
    
    try {
        if(fM) d.mogix = await fM.text();
        if(fB) d.busca = JSON.stringify(XLSX.utils.sheet_to_json(XLSX.read(await fB.arrayBuffer(),{type:'array'}).Sheets[XLSX.read(await fB.arrayBuffer(),{type:'array'}).SheetNames[0]]));
        
        database.ref('arquivos_lojas/' + state.lojaAtual).update(d).then(() => {
            alert("Bases de Inventário Sincronizadas!");
            location.reload();
        });
    } catch (e) { 
        alert("Erro ao subir bases!"); 
        document.getElementById('overlay').style.display = 'none'; 
    }
}
// js/reposicao.js
import { state, normalizarCodigo, getHoraCerta } from './state.js';
import { database } from './firebase.js';

let prodAtual = null; 
let pedidoLoja = {};

function extrairInfo(item) {
    let saldo = 0, tam = "---", preco = "R$ 0,00", cor = "";
    for(let key in item) {
        let k = key.toLowerCase();
        if(k.includes("utiliza") || k.includes("estoque") || k.includes("saldo")) saldo = parseInt(item[key] || 0);
        if(k.includes("tamanho") || k.includes("tam") || k.includes("caracter")) tam = String(item[key]);
        if(key === "M" || k.includes("cor") || k.includes("color")) cor = String(item[key]);
    }
    const vB = item[Object.keys(item)[Object.keys(item).length - 1]];
    if(vB) preco = isNaN(parseFloat(vB)) ? vB : parseFloat(vB).toLocaleString('pt-br',{style:'currency',currency:'BRL'});
    return { saldo, tam, preco, cor };
}

export function analisarDisponibilidade(bip) {
    const bipLimpo = normalizarCodigo(bip);
    let item = state.sapCompleto.find(i => {
        return normalizarCodigo(i.EAN) === bipLimpo || normalizarCodigo(i.Material || i.SKU) === bipLimpo;
    });

    if(!item) return alert("Não encontrado no SAP!");
    
    prodAtual = item; 
    pedidoLoja = {};
    const p8 = normalizarCodigo(item.Material || item.SKU).substring(0,8);
    const info = extrairInfo(item);
    const grade = state.sapCompleto.filter(i => normalizarCodigo(i.Material || i.SKU).startsWith(p8) && extrairInfo(i).saldo > 0);
    
    document.getElementById('prodImg').src = `https://imgcentauro-a.akamaihd.net/768x768/${p8}.jpg`;
    document.getElementById('prodNome').innerText = item["Descrição material"] || item["Texto breve material"];
    document.getElementById('prodCor').innerText = info.cor ? "COR: " + info.cor : "";
    document.getElementById('prodPreco').innerText = info.preco;
    document.getElementById('detalhesProduto').style.display = 'block';
    
    const grid = document.getElementById('gradeGridLoja'); 
    grid.innerHTML = "";
    
    grade.forEach(i => {
        const inf = extrairInfo(i);
        const btn = document.createElement('div');
        btn.style = "background:#f8fafc; border:2px solid #e2e8f0; padding:12px 5px; border-radius:15px; font-weight:800; text-align:center; position:relative; font-size:0.75em; cursor:pointer;";
        btn.innerHTML = `<b>${inf.tam}</b><br><span class="saldo-txt">EST: ${inf.saldo}</span><span style="position:absolute; top:-8px; right:-8px; background:var(--centauro-red); color:white; width:22px; height:22px; border-radius:50%; font-size:11px; display:none; align-items:center; justify-content:center; border:2px solid white;" id="p-${inf.tam}">0</span>`;
        
        btn.onclick = () => { 
            let q = (pedidoLoja[inf.tam] || 0); 
            if(q < inf.saldo) { 
                pedidoLoja[inf.tam] = q + 1; 
                let s = document.getElementById('p-'+inf.tam); 
                s.innerText = q + 1; 
                s.style.display = 'flex'; 
                btn.style.borderColor = "var(--centauro-red)"; 
            } 
        };
        grid.appendChild(btn);
    });
}

export function enviarPedidoFaltantes() {
    if(Object.keys(pedidoLoja).length === 0) return alert("Selecione um tamanho!");
    
    const p8 = normalizarCodigo(prodAtual.Material || prodAtual.SKU).substring(0,8);
    const info = extrairInfo(prodAtual);
    let formatado = {};
    
    Object.entries(pedidoLoja).forEach(([tam, qtd]) => {
        const original = state.sapCompleto.find(i => normalizarCodigo(i.Material || i.SKU).startsWith(p8) && extrairInfo(i).tam === tam);
        formatado[tam] = { qtd: qtd, fullSku: normalizarCodigo(original.Material || original.SKU) };
    });
    
    database.ref(`reposicao_ativa/${state.lojaAtual}/${p8}`).set({ 
        desc: prodAtual["Descrição material"] || prodAtual["Texto breve material"], 
        cor: info.cor, 
        pedidos: formatado, 
        skuBase8: p8, 
        operador: state.operador, 
        hora: getHoraCerta() 
    }).then(() => {
        document.getElementById('detalhesProduto').style.display = 'none'; 
        document.getElementById('inputBip').value = ""; 
        alert("Enviado com Sucesso!");
    }).catch(e => alert("Erro ao enviar: " + e));
}
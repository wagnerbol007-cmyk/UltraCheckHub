// js/state.js

export const state = {
    lojaAtual: "",
    operador: "",
    sapCompleto: [],
    sapCarregado: false,
    dbSap: {},
    dadosReman: [],
    dbReman8: {},
    coletaEstoqueLocal: {},
    
    // NOVAS VARIÁVEIS (App 2 - Inventários)
    dbMojixGlobal: {},
    listaInventarioOriginal: [],
    listaInventarioFiltrada: [],
    indiceInventario: 0,
    respostasInventarioNuvem: {},
    modoInventario: "" // 'padrao' ou 'analista'
};

export function normalizarCodigo(cod) {
    if (!cod) return "";
    let str = String(cod).trim();
    if (str.toLowerCase().includes('e+')) {
        str = Number(str).toLocaleString('fullwide', {useGrouping:false});
    }
    let semDecimal = str.split('.')[0].trim();
    return semDecimal.replace(/^0+/, '');
}

export function getHoraCerta() { 
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()); 
}
// js/firebase.js

// O objeto global 'firebase' já está disponível graças aos scripts na index.html
const firebaseConfig = { 
    apiKey: "AIzaSyBnyiKNfjW6Y4t15OnGRdKaKw6Fm8srx2k", 
    databaseURL: "https://rfid-sincronizado-default-rtdb.firebaseio.com" 
};

// Evita inicializar duplicado
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

export const database = firebase.database();
export const auth = firebase.auth();
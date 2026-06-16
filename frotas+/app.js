// 1. IMPORTAÇÃO DE MÓDULOS
// O navegador executará estes arquivos nesta ordem.
import './firebase-env.js';
import './globals.js';
import './auth.js';
import './dados.js';
import './cadastros.js';
import './contratos-helpers.js';
import './auditoria-mapas.js';
import './abastecimento.js';
import './rdv.js';

// 2. IMPORTAÇÕES ESPECÍFICAS
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth } from './firebase-env.js';

// 3. INICIALIZAÇÃO DO DOM
document.addEventListener("DOMContentLoaded", function () {
    console.log("Sistema Inicializando...");

    // Lista de IDs dos seus modais para inicialização segura (Blindagem)
    const modalIds = [
        'modalFrentista', 'modalLancaAdm', 'modalPrintVeic', 
        'modalAutorizarGestor', 'modalAditivoContrato', 'modalLiquidarContrato', 'modalExtrato'
    ];

    // Inicialização protegida
    modalIds.forEach(id => {
        let el = document.getElementById(id);
        if (el) {
            // Cria um identificador global (ex: window.modalFrentistaObj)
            let varName = `modal${id.replace('modal', '')}Obj`;
            window[varName] = new bootstrap.Modal(el);
        }
    });
    
    // Configura a data padrão se a função existir
    if (window.setarDataDeHoje) window.setarDataDeHoje();

    // Verificação de autenticação
    onAuthStateChanged(auth, (userAuth) => {
        const cracha = localStorage.getItem("caatinga_user");
        
        let appView = document.getElementById('app');
        let loginView = document.getElementById('viewLogin');
        
        if(userAuth && cracha) {
            try {
                window.USUARIO = JSON.parse(cracha);
                // Inicializa o app apenas se o módulo estiver carregado
                if (window.iniciarApp) {
                    window.iniciarApp();
                } else {
                    console.error("Função iniciarApp não encontrada. Verifique se o módulo foi carregado.");
                }
            } catch(e) {
                console.error("Erro ao processar sessão local:", e);
                if (appView) appView.classList.add('hidden');
                if (loginView) loginView.classList.remove('hidden');
            }
        } else {
            if (appView) appView.classList.add('hidden');
            if (loginView) loginView.classList.remove('hidden');
        }
    });
});
// 1. IMPORTAÇÃO DE MÓDULOS
import './firebase-env.js';
import './globals.js';
import './auth.js';
import './dados.js';
import './cadastros.js';
import './contratos-helpers.js';
import './auditoria-mapas.js';
import './abastecimento.js';
import './rdv.js';
import './manutencao-os.js';
import './manutencao-catalogo.js'; 
import './manutencao-contratos.js';
import './manutencao-veiculos.js';
import './manutencao-dash.js';


// 2. IMPORTAÇÕES ESPECÍFICAS
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth } from './firebase-env.js';

// =========================================================
// CONFIGURAÇÕES GOVERNAMENTAIS E LOGOMARCA
// =========================================================
window.ProcessarLogoPrefeituraFixa = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Image = e.target.result;
            // Atualiza a imagem na tela (preview)
            let preview = document.getElementById("preview-logo-prefeitura") || document.querySelector("img[id*='logo']");
            if (preview) preview.src = base64Image;
            
            // Guarda na memória do navegador para o PDF usar depois
            localStorage.setItem("caatinga_logo_gov", base64Image);
            console.log("Logo processada e guardada com sucesso!");
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.SalvarConfiguracoesGovernamentais = function() {
    let nomePrefeitura = document.getElementById("nome-prefeitura")?.value || "";
    let cnpjPrefeitura = document.getElementById("cnpj-prefeitura")?.value || "";
    
    if (nomePrefeitura) localStorage.setItem("caatinga_nome_gov", nomePrefeitura.toUpperCase());
    if (cnpjPrefeitura) localStorage.setItem("caatinga_cnpj_gov", cnpjPrefeitura);

    alert("Configurações Governamentais salvas com sucesso! A logomarca e os dados já estão disponíveis para os Relatórios e Mapas.");
};
// =========================================================

// 3. INICIALIZAÇÃO DO DOM
document.addEventListener("DOMContentLoaded", function () {
    console.log("Sistema Frota+ Inicializando...");

    // Lista de IDs dos seus modais para inicialização segura
    const modalIds = [
        'modalFrentista', 'modalLancaAdm', 'modalPrintVeic', 
        'modalAutorizarGestor', 'modalAditivoContrato', 'modalLiquidarContrato', 'modalExtrato', 'modalMembroEquipe'
    ];

    modalIds.forEach(id => {
        let el = document.getElementById(id);
        if (el) {
            let varName = `modal${id.replace('modal', '')}Obj`;
            window[varName] = new bootstrap.Modal(el);
        }
    });
    
    if (window.setarDataDeHoje) window.setarDataDeHoje();

    // Verificação de autenticação
    onAuthStateChanged(auth, (userAuth) => {
        const cracha = localStorage.getItem("caatinga_user");
        let appView = document.getElementById('app');
        let loginView = document.getElementById('viewLogin');
        
        if(userAuth && cracha) {
            try {
                window.USUARIO = JSON.parse(cracha);
                if (window.iniciarApp) window.iniciarApp();
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
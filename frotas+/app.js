// 1. IMPORTAÇÃO GERAL DOS MÓDULOS (Apenas Frota & Abastecimento)
import './firebase-env.js';
import './globals.js';
import './auth.js';
import './dados.js';
import './cadastros.js';
import './contratos-helpers.js';
import './auditoria-mapas.js';
import './abastecimento.js';
import './rdv.js';

// =========================================================
// INICIALIZAÇÃO DO DOM E BOOTSTRAP
// =========================================================
document.addEventListener("DOMContentLoaded", function () {
    console.log("Sistema Frota+ Inicializando Módulos...");

    const modalIds = [
        'modalFrentista', 'modalLancaAdm', 'modalPrintVeic', 
        'modalAutorizarGestor', 'modalAditivoContrato', 'modalLiquidarContrato', 
        'modalExtrato', 'modalMembroEquipe', 'modalRelatorioMotorista', 'modalContrato'
    ];

    modalIds.forEach(id => {
        let el = document.getElementById(id);
        if (el && typeof bootstrap !== 'undefined') {
            let varName = `modal${id.replace('modal', '')}Obj`;
            window[varName] = new bootstrap.Modal(el);
        }
    });
    
    if (window.setarDataDeHoje) window.setarDataDeHoje();
});

// Configurações Governamentais Globais
window.ProcessarLogoPrefeituraFixa = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Image = e.target.result;
            let preview = document.getElementById("preview-logo-prefeitura") || document.querySelector("img[id*='logo']");
            if (preview) preview.src = base64Image;
            localStorage.setItem("caatinga_logo_gov", base64Image);
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.SalvarConfiguracoesGovernamentais = function() {
    let nomePrefeitura = document.getElementById("nome-prefeitura")?.value || "";
    let cnpjPrefeitura = document.getElementById("cnpj-prefeitura")?.value || "";
    if (nomePrefeitura) localStorage.setItem("caatinga_nome_gov", nomePrefeitura.toUpperCase());
    if (cnpjPrefeitura) localStorage.setItem("caatinga_cnpj_gov", cnpjPrefeitura);
    alert("Configurações Governamentais salvas com sucesso!");
};
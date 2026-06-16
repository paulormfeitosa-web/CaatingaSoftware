// --- VARIÁVEIS DE ESTADO GLOBAIS ---
window.USUARIO = null;
window.tenant = "";
window.DADOS_VEICULOS = [];
window.DADOS_ABASTECIMENTOS = [];
window.DADOS_VIAGENS = [];
window.DADOS_MOTORISTAS = [];
window.DADOS_POSTOS = [];
window.DADOS_CONTRATOS = [];
window.DADOS_DESTINACOES = new Set();
window.tempDestinacoes = [];

window.ColecaoEquipe = [];
window.ColecaoFrota = [];
window.ColecaoRDVs = [];

window.BUFFER_IMAGENS = { odo_inicial: "", odo_final: "", servicos: [], vales: [] };
window.LOGO_PREFEITURA_FIXA = "";
window.MOTORISTAS_SELECIONADOS_RDV = [];

window.PATHS = {
    veiculos: `caatinga_admin_veiculos`, // Será atualizado com o tenant dinâmico
    abastecimentos: `caatinga_admin_abastecimentos`,
    manutencoes: `caatinga_admin_os`,
    equipe: `caatinga_admin_equipe`,
    config: `caatinga_admin_config`,
    rdvs: `caatinga_admin_rdv`
};

// CORREÇÃO: Adicionado 'd-none d-print-block' para ocultar da tela e exibir só na impressão
window.BLOCO_ASSINATURA = `
<div class="d-none d-print-block" style="margin-top: 60px; text-align: center; width: 100%; page-break-inside: avoid;">
    <div style="display: inline-block; width: 45%; margin-right: 2%;">
        <hr style="border: 1px solid #000; width: 80%; margin: 0 auto 5px auto;">
        <p style="font-size: 12px; margin: 0; font-weight: bold;">Assinatura do Gestor Responsável</p>
    </div>
    <div style="display: inline-block; width: 45%;">
        <hr style="border: 1px solid #000; width: 80%; margin: 0 auto 5px auto;">
        <p style="font-size: 12px; margin: 0; font-weight: bold;">Assinatura do Operador / Conferente</p>
    </div>
</div>`;

// Objetos de Modais
window.modalFrentistaObj = null; 
window.modalLancaAdmObj = null; 
window.modalPrintVeicObj = null; 
window.modalAutorizarGestorObj = null; 
window.modalAditivoObj = null; 
window.modalLiquidarObj = null; 
window.modalExtratoObj = null;

// --- FUNÇÕES AUXILIARES GLOBAIS ---
window.normalizar = function(str) {
    if (!str) return "";
    return String(str).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
};

window.loading = function(mostrar, msg="Carregando...") { 
    let lblMsg = document.getElementById('loading-msg');
    if(lblMsg) lblMsg.innerText = msg;
    
    let overlay = document.getElementById('loaderOverlay');
    if(overlay) {
        if(mostrar) overlay.classList.remove('hidden');
        else overlay.classList.add('hidden');
    }
};

window.toggleButtonLoading = function(btn, isProcessing, customText = "Processando...") {
    if(!btn) return;
    if(isProcessing) {
        btn.disabled = true;
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${customText}`;
    } else {
        btn.disabled = false;
        if(btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
    }
};

window.maskMoeda = function(e) {
    if (!e || !e.target) return;
    let input = e.target;
    let val = input.value.replace(/\D/g, '');
    if (val === '') { input.value = ''; return; }
    val = (parseInt(val, 10) / 100).toFixed(2) + '';
    val = val.replace(".", ",");
    val = val.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    input.value = val;
};

window.maskLitros = function(e) {
    if (!e || !e.target) return;
    let input = e.target;
    let val = input.value.replace(/\D/g, ''); 
    if (val === '') { input.value = ''; return; }
    while (val.length < 4) { val = '0' + val; } 
    let intPart = parseInt(val.slice(0, -3), 10).toString(); 
    let decPart = val.slice(-3);
    intPart = intPart.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    input.value = intPart + ',' + decPart;
};

window.formatarNumeroInput = function(val, decimais) {
    if(!val && val !== 0) return '';
    let str = parseFloat(val).toLocaleString('pt-BR', {minimumFractionDigits: decimais, maximumFractionDigits: decimais});
    return str;
};

window.safeCurrency = function(val) {
    if (val === null || val === undefined || val === '') return 0;
    let s = String(val).replace(/[R$\s]/g, '').trim();
    if (s.includes(',')) {
        s = s.replace(/\./g, ''); 
        s = s.replace(',', '.');  
    } 
    let n = parseFloat(s);
    return isNaN(n) ? 0 : n;
};

window.setarDataDeHoje = function() {
    let d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    let hoje = d.toISOString().slice(0, 10);
    
    ['filtroDataNotasFrentista', 'filtroDataNotasGestor', 'aditData', 'cadPostoVigencia'].forEach(id => {
        let el = document.getElementById(id);
        if(el) el.value = hoje;
    });
    
    let elLiq = document.getElementById('liqMesAno');
    if(elLiq) elLiq.value = hoje.slice(0,7);
};

window.alternarModulo = function(idModulo) {
    document.querySelectorAll(".aba-conteudo").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".nav-link").forEach(el => el.classList.remove("active"));
    
    const viewEl = document.getElementById(`view-${idModulo}`);
    const navEl = document.getElementById(`nav-${idModulo}`);
    
    if(viewEl) viewEl.classList.remove("hidden");
    if(navEl) navEl.classList.add("active");
};
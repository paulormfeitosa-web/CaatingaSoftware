import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// --- UTILITÁRIOS MONETÁRIOS E DE FORMATAÇÃO ---
const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
window.formatarMoeda = function(valor) { 
    return formatadorMoeda.format(Number(valor || 0)); 
};

window.aplicarMascaraMonetaria = function(elemento) {
    let valor = elemento.value.replace(/\D/g, ""); 
    if (valor === "") { 
        elemento.value = ""; 
        return; 
    }
    valor = (parseInt(valor, 10) / 100).toFixed(2); 
    elemento.value = valor.replace(".", ",").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1."); 
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

// --- IMPRESSÃO UNIVERSAL ---
window.imprimirDocumento = function(htmlConteudo, titulo) {
    let win = window.open('', '_blank');
    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${titulo}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { padding: 30px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #fff; color: #000; }
                table { page-break-inside: auto; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                thead { display: table-header-group; }
                tfoot { display: table-footer-group; }
                .card-azul { background: #2980b9 !important; color: white !important; }
                .card-laranja { background: #e67e22 !important; color: white !important; }
                .card-verde { background: #27ae60 !important; color: white !important; }
                .progress-bar-fundo { width: 100%; background: #e9ecef; border-radius: 6px; overflow: hidden; margin-top: 5px; height: 18px; }
                .progress-bar-preenchimento { height: 100%; color: white; text-align: center; font-size: 11px; line-height: 18px; font-weight: bold; }
                @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            </style>
        </head>
        <body>
            ${htmlConteudo}
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        window.close();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    win.document.close();
    win.focus();
};

// ================= MOTOR CENTRAL DE ODÔMETRO (NOVA ESTRUTURA UNIFICADA) =================
// Utilizado por: Abastecimento, RDV e Manutenção
// Regra Base: O KM só avança se for MAIOR que o cadastrado no banco. Sem recálculos futuros.
window.sincronizarOdometroCentral = async function(placa, novoKm) {
    if(!placa || !novoKm || !window.tenant) return;
    
    let kmInformado = parseInt(novoKm) || 0;
    if(kmInformado <= 0) return;

    try {
        const veicRef = doc(window.db, `${window.tenant}_veiculos`, placa);
        const veicSnap = await getDoc(veicRef);
        
        if(veicSnap.exists()) {
            let v = veicSnap.data();
            let kmBanco = parseInt(v.km_atual) || parseInt(v.odometro) || parseInt(v.horimetro) || 0;
            
            // Regra de Ouro: O KM da ficha só avança, nunca recua automaticamente.
            if(kmInformado > kmBanco) {
                await setDoc(veicRef, {
                    km_atual: kmInformado,
                    odometro: kmInformado,
                    horimetro: kmInformado
                }, { merge: true });
                
                // Atualiza a variável global localmente para não precisar recarregar o banco à toa
                let vLocal = window.DADOS_VEICULOS.find(x => x.id === placa);
                if(vLocal) {
                    vLocal.km_atual = kmInformado;
                    vLocal.odometro = kmInformado;
                    vLocal.horimetro = kmInformado;
                }
            }
        }
    } catch(e) {
        console.error("Falha ao sincronizar o odômetro central:", e);
    }
};
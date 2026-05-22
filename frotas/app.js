import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = { 
    apiKey: "AIzaSyBOEgd1WCElKtngAcQ-ygnx0_2lpHLUAyM", 
    authDomain: "caatingasoftware.firebaseapp.com", 
    projectId: "caatingasoftware", 
    storageBucket: "caatingasoftware.firebasestorage.app", 
    messagingSenderId: "357801806903", 
    appId: "1:357801806903:web:7b03d8f9f0189bf32943b2", 
    measurementId: "G-ZVSVPMDHP0" 
};
 
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); 

let currentUser = null; 
let listenerUsuario = null; 
let tenant = "";
 
const mod = "frota"; 
 
let chartSec = null, chartTipo = null, chartVeic = null;
 
let veiculosList = []; 
let ordensGlobal = []; 
let contratosList = []; 
let catalogoList = [];  
 
let itensOSAtual = [];
let itensContratoAtual = [];
let lotesContratoAtual = []; 

// ================= UTILITÁRIOS E IMPRESSÃO (NOVA ARQUITETURA) =================

// Formatação segura usando o motor nativo do navegador
const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
window.formatarMoeda = function(valor) { 
    return formatadorMoeda.format(Number(valor || 0)); 
}
 
window.aplicarMascaraMonetaria = function(elemento) {
    let valor = elemento.value.replace(/\D/g, ""); 
    if (valor === "") { 
        elemento.value = ""; 
        return; 
    }
    valor = (parseInt(valor, 10) / 100).toFixed(2); 
    elemento.value = valor.replace(".", ",").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1."); 
}

// A SOLUÇÃO DEFINITIVA PARA IMPRESSÃO EM BRANCO
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
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            ${htmlConteudo}
            
            <script>
                // Mágica: Só imprime quando o navegador desenhar toda a tela
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
}

window.pesquisarAbaOS = function() {
    let dIni = document.getElementById('f-os-ini').value;
    let dFim = document.getElementById('f-os-fim').value;
    
    document.getElementById('r-data-ini').value = dIni;
    document.getElementById('r-data-fim').value = dFim;
    
    window.carregarDadosGerais(dIni, dFim);
}

window.getSecretariasInteligentes = function() {
    let secSet = new Set(['SAÚDE', 'EDUCAÇÃO', 'OBRAS', 'AGRICULTURA', 'ASSISTÊNCIA SOCIAL', 'ADMINISTRAÇÃO', 'FINANÇAS', 'MEIO AMBIENTE', 'ESPORTES', 'CULTURA', 'TURISMO', 'SEGURANÇA', 'TRANSPORTE', 'GABINETE', 'EMPREENDEDORISMO']);
    veiculosList.forEach(v => {
        if(v.secretaria) secSet.add(v.secretaria.toUpperCase().trim());
        if(v.sec) secSet.add(v.sec.toUpperCase().trim());
    });
    contratosList.forEach(c => {
        if(c.secretaria && !c.secretaria.includes('GERAL')) secSet.add(c.secretaria.toUpperCase().trim());
    });
    ordensGlobal.forEach(os => {
        if(os.secretaria_veiculo) secSet.add(os.secretaria_veiculo.toUpperCase().trim());
    });
    return [...secSet].filter(s => s !== '').sort();
}

// ================= SCRIPT DE NORMALIZAÇÃO DE BASE =================
window.normalizarBaseVeiculos = async function() {
    if(!confirm("Isso vai padronizar todos os veículos da coleção para o formato Híbrido (Abastecimento + Frotas). Continuar?")) return;
    
    document.getElementById('loading').classList.remove('hidden');
    try {
        const snap = await getDocs(collection(db, `${tenant}_veiculos`));
        let count = 0;

        for (const docSnap of snap.docs) {
            let v = docSnap.data();
            
            let kmReal = parseInt(v.km_atual) || parseInt(v.odometro) || parseInt(v.horimetro) || 0;
            let tipoReal = v.tipo_veiculo || v.tipo;
            if (!tipoReal) {
                tipoReal = (v.maquina === true || v.maquina === "sim") ? "Máquina" : "Veículo";
            }
            
            let modReal = v.modelo || v.veiculo || 'NÃO INFORMADO';
            let secReal = v.secretaria || v.sec || '';

            let atualizacao = {
                km_atual: kmReal,
                odometro: kmReal, 
                horimetro: kmReal,
                tipo_veiculo: tipoReal,
                maquina: tipoReal === "Máquina",
                status_operacional: v.status_operacional || 'Disponível',
                modelo: modReal,
                veiculo: modReal,
                sec: secReal,
                km_proxima_troca_oleo: parseInt(v.km_proxima_troca_oleo) || 0,
                km_proxima_revisao: parseInt(v.km_proxima_revisao) || 0
            };

            await setDoc(doc(db, `${tenant}_veiculos`, docSnap.id), atualizacao, { merge: true });
            count++;
        }
        
        alert(`✅ SUCESSO! ${count} veículos foram padronizados.`);
        window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value);
        
    } catch(e) {
        console.error(e);
        alert("Erro ao normalizar: " + e.message);
    }
    document.getElementById('loading').classList.add('hidden');
}

window.limparBancoFrotas = async function() {
    if (currentUser.cpf !== "01305663306") return alert("Ação restrita ao Administrador Master.");
    
    let confirmacao = prompt(`ATENÇÃO! Esta ação apagará permanentemente TODAS as Ordens de Serviço, Contratos e Itens de Catálogo do tenant atual (${tenant.toUpperCase()}).\nPara continuar, digite APAGAR TUDO:`);
    
    if (confirmacao !== "APAGAR TUDO") return alert("Operação cancelada.");
    
    document.getElementById('loading').classList.remove('hidden');
    try {
        const colecoesParaLimpar = [
            `${mod}_${tenant}_ordens_servico`,
            `${mod}_${tenant}_contratos`,
            `${mod}_${tenant}_catalogo`
        ];
        
        let totalApagados = 0;
        for (let col of colecoesParaLimpar) {
            const snap = await getDocs(collection(db, col));
            for (let docSnap of snap.docs) {
                await deleteDoc(doc(db, col, docSnap.id));
                totalApagados++;
            }
        }
        alert(`Base de dados limpa com sucesso! ${totalApagados} registos foram removidos.`);
        window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value);
    } catch(e) {
        alert("Erro ao limpar dados: " + e.message);
    }
    document.getElementById('loading').classList.add('hidden');
}

// ================= AUTENTICAÇÃO E STARTUP =================

window.onload = function() {
    onAuthStateChanged(auth, async (userAuth) => {
        const cracha = localStorage.getItem("caatinga_user");
        if (userAuth && cracha) {
            currentUser = JSON.parse(cracha);
            if (currentUser.cpf !== "01305663306") {
                try { 
                    const docVerifica = await getDoc(doc(db, "usuarios", currentUser.cpf)); 
                    if (!docVerifica.exists() || docVerifica.data().ativo === false) { 
                        window.sairSistema(true); 
                        return; 
                    } 
                } catch(e) { console.error("Erro na verificação", e) }
            }
            iniciarSistemaFrota();
        } else { 
            document.getElementById('login-panel').classList.remove('hidden'); 
            document.getElementById('loader-sso').classList.add('hidden'); 
        }
    });
};

window.sairSistema = function(silencioso = false) { 
    localStorage.removeItem("caatinga_user"); 
    if(listenerUsuario) { 
        listenerUsuario(); 
        listenerUsuario = null; 
    } 
    signOut(auth).then(() => {
        if(!silencioso) {
            window.location.href = "/"; 
        } else {
            document.getElementById('app-content').classList.add('hidden'); 
            document.getElementById('loader-sso').classList.add('hidden');
            document.getElementById('login-panel').classList.remove('hidden'); 
            document.getElementById('login-error').innerText = "Acesso revogado."; 
            document.getElementById('login-error').classList.remove('hidden');
        }
    });
};

window.tentarLoginManual = async function() {
    const cpf = document.getElementById('login-cpf').value.replace(/\D/g, ''); 
    const senha = document.getElementById('login-pass').value;
    const btn = document.getElementById('btn-login'); 
    btn.innerText = "Verificando..."; 
    const erro = document.getElementById('login-error'); 
    erro.classList.add('hidden');
    
    try {
        const emailFicticio = cpf + "@feitosa.app";
        if (cpf === "01305663306" && senha === "pr10mf86") {
            let qualTenant = prompt("Acesso Master! Qual a base de dados (tenant) você quer acessar? (Ex: aiuaba)", "aiuaba");
            if (!qualTenant) { btn.innerText = "ENTRAR"; return; }
            try { 
                await signInWithEmailAndPassword(auth, emailFicticio, senha); 
            } catch(e) { 
                await createUserWithEmailAndPassword(auth, emailFicticio, senha); 
            }
            currentUser = { cpf: "01305663306", nome: "Administrador Master", empresa_id: qualTenant.trim().toLowerCase(), nivel_acesso: "SUPER_ADM", secretarias: ["TODAS"] };
            localStorage.setItem("caatinga_user", JSON.stringify(currentUser)); 
            iniciarSistemaFrota(); 
            return;
        }
        
        await signInWithEmailAndPassword(auth, emailFicticio, senha);
        const userSnap = await getDoc(doc(db, "usuarios", cpf));
        
        if (userSnap.exists()) {
            let u = userSnap.data(); 
            if (u.ativo === false) throw new Error("Usuário inativo ou bloqueado.");
            
            const sistemas = u.sistemas_autorizados || []; 
            if (!sistemas.includes("TODOS") && !sistemas.includes("gest_o_de_frota") && !sistemas.includes("frotas")) {
                throw new Error("Sem permissão de acesso à Frota.");
            }
            
            currentUser = { cpf: cpf, nome: u.nome, empresa_id: u.empresa_id, nivel_acesso: u.nivel_acesso, secretarias: u.secretarias || [] };
            localStorage.setItem("caatinga_user", JSON.stringify(currentUser)); 
            iniciarSistemaFrota();
        } else { 
            throw new Error("Usuário não encontrado."); 
        }
    } catch(e) { 
        erro.innerText = "Credenciais inválidas."; 
        erro.classList.remove('hidden'); 
    } finally { 
        btn.innerText = "ENTRAR"; 
    }
};

function iniciarSistemaFrota() {
    document.getElementById('login-panel').classList.add('hidden'); 
    document.getElementById('loader-sso').classList.add('hidden'); 
    document.getElementById('app-content').classList.remove('hidden');
    
    tenant = String(currentUser.empresa_id || "global").toLowerCase().trim(); 
    document.getElementById('lbl-empresa').innerText = tenant.toUpperCase(); 
    
    if (!listenerUsuario && currentUser.cpf !== "01305663306") { 
        listenerUsuario = onSnapshot(doc(db, "usuarios", currentUser.cpf), (docSnap) => { 
            if (!docSnap.exists() || docSnap.data().ativo === false) { 
                alert("⚠️ Acesso suspenso pelo Administrador."); 
                window.sairSistema(true); 
            } 
        }); 
    }
    
    const p = String(currentUser.nivel_acesso || currentUser.perfil || '').toUpperCase();
    if(!p.includes('ADM') && !p.includes('MASTER') && p !== 'GESTOR') { 
        document.querySelectorAll('.adm-only').forEach(el => el.classList.add('hidden')); 
    } else { 
        document.querySelectorAll('.adm-only').forEach(el => el.classList.remove('hidden')); 
    }
    
    if(currentUser.cpf !== "01305663306") { 
        document.querySelectorAll('.master-only').forEach(el => el.classList.add('hidden')); 
    }
    
    window.showView('dashboard'); 
    window.carregarDadosGerais();
}

window.showView = function(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden')); 
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    
    const tela = document.getElementById('view-' + viewId); 
    if (tela) tela.classList.remove('hidden');
    
    if (typeof event !== 'undefined' && event && event.target && event.target.classList) { 
        if(event.target.tagName === 'A') event.target.classList.add('active'); 
    } else { 
        const link = document.querySelector(`[onclick*="'${viewId}'"]`); 
        if (link) link.classList.add('active'); 
    }
}

// ================= CARREGAMENTO DE DADOS =================

async function puxarVeiculosDoFirebase() { 
    const snap = await getDocs(collection(db, `${tenant}_veiculos`)); 
    let v = []; 
    snap.forEach(d => { let x = d.data(); x.id = d.id; x.placa = d.id; v.push(x); }); 
    return v; 
}
 
async function puxarContratosDoFirebase() { 
    const snap = await getDocs(collection(db, `${mod}_${tenant}_contratos`)); 
    let c = []; 
    snap.forEach(d => { let x = d.data(); x.id = d.id; c.push(x); }); 
    return c; 
}
 
async function puxarCatalogoDoFirebase() { 
    const snap = await getDocs(collection(db, `${mod}_${tenant}_catalogo`)); 
    let c = []; 
    snap.forEach(d => { let x = d.data(); x.id = d.id; c.push(x); }); 
    return c; 
}
 
async function puxarTodasOSDoFirebase() {
    const snap = await getDocs(collection(db, `${mod}_${tenant}_ordens_servico`));
    let o = [];
    snap.forEach(d => { let x = d.data(); x.idOS = d.id; o.push(x); });
    return o;
}

window.carregarDadosGerais = async function(buscarDataIni = null, buscarDataFim = null) {
    document.getElementById('loading').classList.remove('hidden');
    try {
        let dataIni = buscarDataIni;
        let dataFim = buscarDataFim;
        
        if(!dataIni || !dataFim) {
            const hj = new Date(); 
            const m = String(hj.getMonth() + 1).padStart(2, '0'); 
            const u = new Date(hj.getFullYear(), hj.getMonth() + 1, 0).getDate();
            dataIni = `${hj.getFullYear()}-${m}-01`; 
            dataFim = `${hj.getFullYear()}-${m}-${u}`;
        }
        
        document.getElementById('r-data-ini').value = dataIni; 
        document.getElementById('r-data-fim').value = dataFim;
        document.getElementById('f-os-ini').value = dataIni; 
        document.getElementById('f-os-fim').value = dataFim;

        veiculosList = await puxarVeiculosDoFirebase(); 
        contratosList = await puxarContratosDoFirebase(); 
        catalogoList = await puxarCatalogoDoFirebase();
        ordensGlobal = await puxarTodasOSDoFirebase(); 

        contratosList.forEach(c => {
            c.saldo_consumido_real = 0;
            c.saldo_consumido_pecas = 0;
            c.saldo_consumido_servicos = 0;
            if(c.lotes_contrato) {
                c.lotes_contrato.forEach(l => {
                    l.consumido_pecas = 0;
                    l.consumido_servicos = 0;
                });
            }
        });
        
        ordensGlobal.forEach(os => {
            if(os.id_contrato && os.status === 'Paga') {
                let cTarget = contratosList.find(c => c.id === os.id_contrato); 
                if(cTarget) {
                    cTarget.saldo_consumido_real += (parseFloat(os.valor) || 0);
                    
                    let loteTarget = null;
                    if(os.lote_contrato && cTarget.lotes_contrato) {
                        loteTarget = cTarget.lotes_contrato.find(l => l.descricao.trim() === os.lote_contrato.trim());
                    }
                    
                    if(os.itens) {
                        os.itens.forEach(it => {
                            if(it.categoria === 'Peças' || it.categoria === 'Pneus' || it.categoria === 'Bateria') {
                                cTarget.saldo_consumido_pecas += (parseFloat(it.valor_total) || 0);
                                if(loteTarget) loteTarget.consumido_pecas += (parseFloat(it.valor_total) || 0);
                            } else if(it.categoria === 'Mão de obra' || it.categoria === 'Serviço') {
                                cTarget.saldo_consumido_servicos += (parseFloat(it.valor_total) || 0);
                                if(loteTarget) loteTarget.consumido_servicos += (parseFloat(it.valor_total) || 0);
                            }
                        });
                    }
                }
            }
        });
        
        window.renderizarTabelaVeiculos(veiculosList); 
        renderizarTabelaContratos(contratosList); 
        renderizarTabelaCatalogo(catalogoList);
        
        await window.carregarDashFiltro(true); 
        await window.carregarTabelaOSComFiltro(true); 
    } catch(e) { 
        console.error(e); 
    }
    document.getElementById('loading').classList.add('hidden');
}

// ================= VEÍCULOS =================

window.renderizarTabelaVeiculos = function(vs) {
    const tb = document.querySelector('#table-veiculos tbody');
    tb.innerHTML = '';
    if(vs.length === 0) { tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhum veículo cadastrado.</td></tr>'; return; }
    
    vs.forEach(v => {
        let k = parseInt(v.km_atual) || parseInt(v.odometro) || parseInt(v.horimetro) || 0;
        let stBadge = v.status_operacional === 'Disponível' ? 'bg-success' : (v.status_operacional === 'Em Oficina' ? 'bg-warning text-dark' : (v.status_operacional === 'Inservível' ? 'bg-danger' : 'bg-primary'));
        
        tb.innerHTML += `<tr>
            <td><strong>${v.placa}</strong></td>
            <td>${v.tipo_veiculo || v.tipo || 'Veículo'}<br><small class="text-muted">${v.modelo || v.veiculo || ''}</small></td>
            <td>${v.dotacao || '-'}<br><small class="text-muted">${v.secretaria || v.sec || ''}</small></td>
            <td><span class="badge ${stBadge}">${v.status_operacional || 'Disponível'}</span></td>
            <td>KM/H: ${k}</td>
            <td class="adm-only"><button class="btn btn-sm btn-light text-primary" onclick='window.editarVeiculo(${JSON.stringify(v)})'><i class="fas fa-edit"></i></button></td>
        </tr>`;
    });
}

window.mudarLabelsOdometro = function() {
    let t = document.getElementById('v-tipo').value;
    let l1 = 'KM Atual', l2 = 'Aviso: Troca Óleo (KM)', l3 = 'Aviso: Revisão (KM)';
    if(t === 'Máquina'){ l1 = 'Horímetro Atual'; l2 = 'Aviso: Troca Óleo (H)'; l3 = 'Aviso: Revisão (H)'; }
    document.getElementById('lbl-km-atual').innerText = l1;
    document.getElementById('lbl-km-oleo').innerText = l2;
    document.getElementById('lbl-km-rev').innerText = l3;
}

window.abrirModalVeiculo = function() {
    document.getElementById('formVeiculo').reset();
    document.getElementById('v-id').value = '';
    document.getElementById('btn-del-veiculo').classList.add('hidden');
    window.mudarLabelsOdometro();
    new bootstrap.Modal(document.getElementById('modalVeiculo')).show();
}

window.editarVeiculo = function(v) {
    document.getElementById('v-id').value = v.placa;
    document.getElementById('v-placa').value = v.placa;
    document.getElementById('v-tipo').value = v.tipo_veiculo || v.tipo || 'Veículo';
    document.getElementById('v-modelo').value = v.modelo || v.veiculo || '';
    document.getElementById('v-combustivel').value = v.combustivel || 'Diesel';
    document.getElementById('v-secretaria').value = v.secretaria || v.sec || '';
    document.getElementById('v-destinacao').value = v.destinacao || '';
    document.getElementById('v-dotacao').value = v.dotacao || '';
    document.getElementById('v-renavam').value = v.renavam || '';
    document.getElementById('v-tombamento').value = v.tombamento || '';
    document.getElementById('v-ano').value = v.ano || '';
    document.getElementById('v-vinculo').value = v.vinculo || 'Próprio';
    document.getElementById('v-status-op').value = v.status_operacional || 'Disponível';
    
    document.getElementById('v-km-atual').value = parseInt(v.km_atual) || parseInt(v.odometro) || parseInt(v.horimetro) || 0;
    document.getElementById('v-km-oleo').value = v.km_proxima_troca_oleo || '';
    document.getElementById('v-km-revisao').value = v.km_proxima_revisao || '';
    document.getElementById('v-data-oleo').value = v.data_proxima_troca_oleo || '';
    document.getElementById('v-data-revisao').value = v.data_proxima_revisao || '';

    window.mudarLabelsOdometro();
    document.getElementById('btn-del-veiculo').classList.remove('hidden');
    new bootstrap.Modal(document.getElementById('modalVeiculo')).show();
}

window.salvarVeiculo = async function() {
    const p = document.getElementById('v-placa').value.toUpperCase().trim();
    if(!p) return alert("A placa é obrigatória!");
    let k = parseInt(document.getElementById('v-km-atual').value) || 0;
    let t = document.getElementById('v-tipo').value;

    const d = {
        placa: p,
        tipo_veiculo: t,
        maquina: t === 'Máquina',
        modelo: document.getElementById('v-modelo').value.toUpperCase(),
        veiculo: document.getElementById('v-modelo').value.toUpperCase(),
        combustivel: document.getElementById('v-combustivel').value,
        secretaria: document.getElementById('v-secretaria').value.toUpperCase(),
        sec: document.getElementById('v-secretaria').value.toUpperCase(),
        destinacao: document.getElementById('v-destinacao').value.toUpperCase(),
        dotacao: document.getElementById('v-dotacao').value.toUpperCase(),
        renavam: document.getElementById('v-renavam').value,
        tombamento: document.getElementById('v-tombamento').value,
        ano: document.getElementById('v-ano').value,
        vinculo: document.getElementById('v-vinculo').value,
        status_operacional: document.getElementById('v-status-op').value,
        km_atual: k, 
        odometro: k, 
        horimetro: k,
        km_proxima_troca_oleo: parseInt(document.getElementById('v-km-oleo').value) || 0,
        km_proxima_revisao: parseInt(document.getElementById('v-km-revisao').value) || 0,
        data_proxima_troca_oleo: document.getElementById('v-data-oleo').value,
        data_proxima_revisao: document.getElementById('v-data-revisao').value
    };

    await setDoc(doc(db, `${tenant}_veiculos`, p), d, {merge: true});
    bootstrap.Modal.getInstance(document.getElementById('modalVeiculo')).hide();
    alert("Veículo salvo com sucesso!");
    window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value);
}

window.deletarVeiculo = async function() {
    if(confirm("Deseja excluir este Veículo da lista? Isso não apagará as OS vinculadas a ele.")) {
        await deleteDoc(doc(db, `${tenant}_veiculos`, document.getElementById('v-id').value));
        bootstrap.Modal.getInstance(document.getElementById('modalVeiculo')).hide();
        window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value);
    }
}

// ================= LÓGICA DO CARRINHO (ITENS DA OS COM DESCONTO) =================

window.renderTabelaItensOS = function() {
    let tb = document.querySelector('#table-os-itens tbody');
    tb.innerHTML = '';
    let totalOS = 0;
    
    itensOSAtual.forEach((it, idx) => {
        totalOS += it.valor_total;
        
        let pctBadge = '';
        if(it.desconto_pct && it.desconto_pct > 0) {
            pctBadge = `<span class="badge bg-success ms-1">-${it.desconto_pct}%</span>`;
        }

        let catBadgeColor = 'bg-secondary';
        if(it.categoria === 'Peças') catBadgeColor = 'bg-info text-dark';
        if(it.categoria === 'Serviço' || it.categoria === 'Mão de obra') catBadgeColor = 'bg-warning text-dark';
        if(it.categoria === 'Pneus') catBadgeColor = 'bg-dark';
        if(it.categoria === 'Bateria') catBadgeColor = 'bg-danger';

        tb.innerHTML += `
        <tr>
            <td>
               <strong>${it.descricao}</strong> 
               ${it.id_catalogo ? '<i class="fas fa-link text-primary ms-1" title="Vinculado ao Catálogo"></i>' : '<i class="fas fa-star text-warning ms-1" title="Novo Item/Será Salvo no Catálogo"></i>'}
            </td>
            <td class="text-center"><span class="badge ${catBadgeColor}">${it.categoria}</span></td>
            <td class="text-center">${it.qtd}</td>
            <td class="text-end">${window.formatarMoeda(it.valor_unit)}</td>
            <td class="text-center text-success fw-bold">${it.desconto_pct ? it.desconto_pct + '%' : '-'}</td>
            <td class="text-end fw-bold text-primary">${window.formatarMoeda(it.valor_total)}</td>
            <td class="text-center">
               <button type="button" class="btn btn-sm btn-light text-danger py-0" onclick="window.removerItemOS(${idx})">
                  <i class="fas fa-trash"></i>
               </button>
            </td>
        </tr>`;
    });
    
    if(itensOSAtual.length === 0) {
        tb.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Nenhum item adicionado ao orçamento ainda.</td></tr>';
    }
    document.getElementById('lbl-os-total').innerText = window.formatarMoeda(totalOS);
}

window.removerItemOS = function(index) {
    itensOSAtual.splice(index, 1);
    window.renderTabelaItensOS();
}

window.abrirModalBuscaItem = function() {
    document.getElementById('m-item-desc').value = '';
    document.getElementById('m-item-qtd').value = '1';
    document.getElementById('m-item-valor').value = '';
    document.getElementById('m-item-desconto').value = '';
    document.getElementById('lbl-previa-item').innerText = 'R$ 0,00';
    
    window.atualizarListaCatalogoOS();
    
    new bootstrap.Modal(document.getElementById('modalBuscaItem')).show();
}

window.atualizarListaCatalogoOS = function() {
    let vSelect = document.getElementById('os-veiculo');
    let modVeiculo = '';
    if(vSelect && vSelect.selectedIndex > -1) {
        let optVeiculo = vSelect.options[vSelect.selectedIndex];
        if(optVeiculo.value) {
            modVeiculo = (optVeiculo.getAttribute('data-modelo') || '').toUpperCase().trim();
        }
    }
    
    let sel = document.getElementById('m-item-catalogo');
    sel.innerHTML = '<option value="">+++ NOVO ITEM (Digitar Manualmente) +++</option>';
    
    let idContratoSelecionado = document.getElementById('os-contrato').value;
    let contratoFiltrado = contratosList.find(c => c.id === idContratoSelecionado);

    let usarFiltro = document.getElementById('toggle-filtro-compativel').checked;

    const isCompativel = (catInfo) => {
        if(!usarFiltro) return true; 
        
        if(!catInfo.aplicacao_modelos || catInfo.aplicacao_modelos.trim() === '') return true; 
        if(!modVeiculo) return true; 
        
        let aplicacoes = catInfo.aplicacao_modelos.split(',').map(m => m.trim().toUpperCase());
        return aplicacoes.some(app => modVeiculo.includes(app) || app.includes(modVeiculo));
    };

    let htmlCompativel = '';
    let htmlIncompativel = '';
    
    if(contratoFiltrado && contratoFiltrado.categoria === 'Itens' && contratoFiltrado.itens_contrato) {
        contratoFiltrado.itens_contrato.forEach(ic => {
            let infoCat = catalogoList.find(x => x.id === ic.id_catalogo);
            if(infoCat) {
               let optHTML = `<option value="${infoCat.id}" data-desc="${infoCat.descricao}" data-val="${ic.valor_unitario}" data-cat="${infoCat.categoria}">[${infoCat.categoria}] ${infoCat.descricao} (Max Licitado: ${window.formatarMoeda(ic.valor_unitario)})</option>`;
               if(isCompativel(infoCat)) htmlCompativel += optHTML; else htmlIncompativel += optHTML;
            }
        });
    } else {
        catalogoList.forEach(c => {
            let optHTML = `<option value="${c.id}" data-desc="${c.descricao}" data-val="${c.valor_referencia}" data-cat="${c.categoria}">[${c.categoria}] ${c.descricao} - Ref: ${window.formatarMoeda(c.valor_referencia)}</option>`;
            if(isCompativel(c)) htmlCompativel += optHTML; else htmlIncompativel += optHTML;
        });
    }

    if(htmlCompativel) sel.innerHTML += `<optgroup label="✅ Peças ${usarFiltro ? 'Compatíveis/Universais' : 'do Catálogo'}">${htmlCompativel}</optgroup>`;
    if(htmlIncompativel) sel.innerHTML += `<optgroup label="⚠️ Outros Modelos / Não compatíveis">${htmlIncompativel}</optgroup>`;
}

window.selecionarItemModal = function() {
    let sel = document.getElementById('m-item-catalogo');
    if(sel.value) {
       let opt = sel.options[sel.selectedIndex];
       document.getElementById('m-item-desc').value = opt.getAttribute('data-desc');
       document.getElementById('m-item-categoria').value = opt.getAttribute('data-cat');
       
       let v = parseFloat(opt.getAttribute('data-val')).toFixed(2).replace('.', '');
       let inputVal = document.getElementById('m-item-valor');
       inputVal.value = v;
       window.aplicarMascaraMonetaria(inputVal);
    } else {
       document.getElementById('m-item-desc').value = '';
       document.getElementById('m-item-valor').value = '';
    }
    window.calcularPreviaItem();
}

window.calcularPreviaItem = function() {
    let qtd = parseInt(document.getElementById('m-item-qtd').value) || 1;
    let valStr = document.getElementById('m-item-valor').value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    let vlrUnit = parseFloat(valStr) || 0;
    let descPct = parseFloat(document.getElementById('m-item-desconto').value) || 0;
    
    if(descPct < 0) descPct = 0;
    if(descPct > 100) descPct = 100;

    let vlrBruto = qtd * vlrUnit;
    let vlrDesconto = vlrBruto * (descPct / 100);
    let vlrFinal = vlrBruto - vlrDesconto;

    document.getElementById('lbl-previa-item').innerText = window.formatarMoeda(vlrFinal);
}

window.confirmarItemModal = async function() {
    let idCat = document.getElementById('m-item-catalogo').value;
    let desc = document.getElementById('m-item-desc').value.toUpperCase().trim();
    let categoria = document.getElementById('m-item-categoria').value;
    let qtd = parseInt(document.getElementById('m-item-qtd').value) || 1;
    
    let valStr = document.getElementById('m-item-valor').value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    let vlrUnit = parseFloat(valStr) || 0;
    let descPct = parseFloat(document.getElementById('m-item-desconto').value) || 0;
    
    if(!desc || vlrUnit <= 0) return alert("Preencha a descrição e defina um valor unitário maior que zero.");

    let idContratoSelecionado = document.getElementById('os-contrato').value;
    if(idContratoSelecionado) {
        let cTarget = contratosList.find(c => c.id === idContratoSelecionado);
        if(cTarget && cTarget.categoria === 'Itens') {
            if(!idCat) return alert("Atenção! Este contrato (Pneus/Baterias) exige que o item seja selecionado no CATÁLOGO DO CONTRATO.");
            
            let licitado = cTarget.itens_contrato.find(i => i.id_catalogo === idCat);
            if(licitado) {
                if(vlrUnit > licitado.valor_unitario) {
                    if(!confirm(`⚠️ AVISO DE PREÇO: O valor inserido (${window.formatarMoeda(vlrUnit)}) ultrapassa o valor unitário licitado na Ata (${window.formatarMoeda(licitado.valor_unitario)}).\n\nDeseja forçar a inclusão deste item com o valor excedido?`)) {
                        return;
                    }
                }
            }
        }
    }
    
    let vlrBruto = qtd * vlrUnit;
    let vlrDesconto = vlrBruto * (descPct / 100);
    let vlrFinalLiquido = vlrBruto - vlrDesconto;
    
    let vSelect = document.getElementById('os-veiculo');
    let modVeiculo = '';
    if(vSelect && vSelect.selectedIndex > -1) {
        let optVeiculo = vSelect.options[vSelect.selectedIndex];
        if(optVeiculo.value) modVeiculo = (optVeiculo.getAttribute('data-modelo') || '').toUpperCase().trim();
    }
    
    if(idCat) {
        let itemCatInfo = catalogoList.find(c => c.id === idCat);
        if(itemCatInfo) {
            
            let aplicacoesStr = itemCatInfo.aplicacao_modelos || '';
            let aplicacoes = aplicacoesStr.split(',').map(m => m.trim().toUpperCase()).filter(m => m !== '');
            let isUniversal = aplicacoes.length === 0;
            let isCompativel = isUniversal || (modVeiculo && aplicacoes.some(app => modVeiculo.includes(app) || app.includes(modVeiculo)));

            if(!isCompativel && modVeiculo) {
                if(confirm(`A peça/serviço "${itemCatInfo.descricao}" não está atualmente associada ao modelo "${modVeiculo}".\n\nDeseja vincular este modelo à peça para que ela apareça como compatível nas próximas vezes?`)) {
                    aplicacoes.push(modVeiculo);
                    let novaAplicacao = aplicacoes.join(', ');
                    itemCatInfo.aplicacao_modelos = novaAplicacao; 
                    
                    setDoc(doc(db, `${mod}_${tenant}_catalogo`, idCat), { aplicacao_modelos: novaAplicacao }, {merge: true})
                        .catch(e => console.error("Erro ao vincular modelo", e));
                }
            }

            if(itemCatInfo.garantia_meses > 0 && vSelect.value) {
                let idAtual = document.getElementById('os-id').value;
                let osAnteriores = ordensGlobal.filter(o => o.placa === vSelect.value && o.idOS !== idAtual);
                let ultimaData = null;
                
                for(let o of osAnteriores) {
                    if(o.itens) {
                       let achou = o.itens.find(i => i.id_catalogo === idCat);
                       if(achou) {
                          if(!ultimaData || new Date(o.data_registro) > new Date(ultimaData)) ultimaData = o.data_registro;
                       }
                    }
                }
                
                if(ultimaData) {
                    let diffMeses = (new Date() - new Date(ultimaData)) / (1000 * 60 * 60 * 24 * 30);
                    if(diffMeses < itemCatInfo.garantia_meses) {
                        if(!confirm(`⚠️ ALERTA DE GARANTIA!\nEste item (${itemCatInfo.descricao}) foi trocado neste veículo há ${diffMeses.toFixed(1)} meses.\nA garantia cadastrada é de ${itemCatInfo.garantia_meses} meses.\n\nDeseja adicionar mesmo assim?`)) {
                            return;
                        }
                    }
                }
            }
        }
    }
    
    itensOSAtual.push({
        id_catalogo: idCat || null,
        categoria: categoria,
        descricao: desc,
        qtd: qtd,
        valor_unit: vlrUnit,
        desconto_pct: descPct,
        valor_total: vlrFinalLiquido
    });
    
    window.renderTabelaItensOS();
    bootstrap.Modal.getInstance(document.getElementById('modalBuscaItem')).hide();
}

// ================= ORDEM DE SERVIÇO (OS) =================

window.toggleModoNF = function() {
    const isNF = document.getElementById('toggle-os-nf').checked;
    if(isNF) {
        document.getElementById('area-os-nf').classList.remove('hidden');
        document.getElementById('area-os-itens').classList.add('hidden');
        document.getElementById('btn-add-item-os').classList.add('hidden');
    } else {
        document.getElementById('area-os-nf').classList.add('hidden');
        document.getElementById('area-os-itens').classList.remove('hidden');
        document.getElementById('btn-add-item-os').classList.remove('hidden');
    }
}

window.selecionarTodasOS = function(chk) {
    document.querySelectorAll('.chk-os-item').forEach(el => el.checked = chk.checked);
}

window.atualizarLotesOS = function() {
    const idContrato = document.getElementById('os-contrato').value;
    const selectLote = document.getElementById('os-contrato-lote');
    const divLote = document.getElementById('div-os-lote');
    
    selectLote.innerHTML = '<option value="">Selecione o Lote / Categoria...</option>';
    divLote.classList.add('hidden');
    
    if(idContrato) {
        let c = contratosList.find(x => x.id === idContrato);
        if(c && c.categoria === 'Global' && c.lotes_contrato) {
            c.lotes_contrato.forEach(l => {
                let saldoPecas = (l.teto_pecas || 0) - (l.consumido_pecas || 0);
                let saldoServicos = (l.teto_servicos || 0) - (l.consumido_servicos || 0);
                selectLote.innerHTML += `<option value="${l.descricao}">${l.descricao} (Saldo Pç: ${window.formatarMoeda(saldoPecas)} | MO: ${window.formatarMoeda(saldoServicos)})</option>`;
            });
            divLote.classList.remove('hidden');
        }
    }
}

window.abrirModalOS = function() {
    document.getElementById('formOS').reset(); 
    document.getElementById('os-id').value = ''; 
    document.getElementById('os-data').valueAsDate = new Date();
    
    document.getElementById('toggle-os-nf').checked = false;
    window.toggleModoNF();
    document.getElementById('os-nf-num').value = '';
    document.getElementById('os-nf-valor').value = '';
    document.getElementById('os-nf-tipo').value = 'Serviço';

    document.getElementById('os-contrato-lote').innerHTML = '';
    document.getElementById('div-os-lote').classList.add('hidden');

    itensOSAtual = []; 
    window.renderTabelaItensOS();

    const select = document.getElementById('os-veiculo'); 
    select.innerHTML = '<option value="">Selecione o Veículo...</option>';
    veiculosList.forEach(v => {
        if(v.status_operacional !== 'Inservível') {
            let indicativo = v.status_operacional === 'Em Oficina' ? ' (⚠️ EM OFICINA)' : '';
            let modeloReal = v.modelo || v.veiculo || 'N/A';
            let secReal = v.secretaria || v.sec || '';
            let kmReal = parseInt(v.km_atual) || parseInt(v.odometro) || parseInt(v.horimetro) || 0;
            
            select.innerHTML += `<option value="${v.placa}" data-modelo="${modeloReal}" data-sec="${secReal}" data-dest="${v.destinacao || ''}" data-km="${kmReal}">${v.placa} - ${modeloReal}${indicativo}</option>`;
        }
    });
    
    window.filtrarContratosPorSec();

    const p = String(currentUser.nivel_acesso || '').toUpperCase();
    if(!p.includes('ADM') && !p.includes('MASTER') && p !== 'GESTOR') { 
        document.getElementById('os-status').value = "Pendente"; 
        document.getElementById('os-status').parentElement.classList.add('hidden'); 
    } else { 
        document.getElementById('os-status').parentElement.classList.remove('hidden'); 
    }

    new bootstrap.Modal(document.getElementById('modalOS')).show();
}

window.filtrarContratosPorSec = function() {
    const vSelect = document.getElementById('os-veiculo');
    const opt = vSelect.options[vSelect.selectedIndex];
    const kmVeic = opt ? opt.getAttribute('data-km') : '';
    
    if(kmVeic) document.getElementById('os-km').value = kmVeic;
    else document.getElementById('os-km').value = '';
    
    const selectCont = document.getElementById('os-contrato'); 
    selectCont.innerHTML = '<option value="">Avulso / Despesa Direta (Sem Contrato)</option>';
    
    contratosList.forEach(c => {
        let secExibicao = c.secretaria || 'GERAL / TODAS';
        
        if(c.categoria === 'Itens') {
            let saldo = (c.valor_total || 0) - (c.saldo_consumido_real || 0);
            selectCont.innerHTML += `<option value="${c.id}">[Ata] Nº ${c.numero} - ${c.fornecedor} | Sec: ${secExibicao} | Saldo: ${window.formatarMoeda(saldo)}</option>`;
        } else {
            let saldoPecas = (c.valor_teto_pecas || 0) - (c.saldo_consumido_pecas || 0);
            let saldoServicos = (c.valor_teto_servicos || 0) - (c.saldo_consumido_servicos || 0);
            selectCont.innerHTML += `<option value="${c.id}">[Global] Nº ${c.numero} - ${c.fornecedor} | Sec: ${secExibicao} | Saldo Peças: ${window.formatarMoeda(saldoPecas)} | M.O: ${window.formatarMoeda(saldoServicos)}</option>`;
        }
    });
    window.atualizarLotesOS();
}

window.salvarOS = async function() {
    const vSelect = document.getElementById('os-veiculo'); 
    if(!vSelect.value) return alert("Selecione um veículo."); 
    
    let valorFinalOS = 0;
    const isNF = document.getElementById('toggle-os-nf').checked;

    if(isNF) {
        let numNF = document.getElementById('os-nf-num').value.trim();
        let vlrStr = document.getElementById('os-nf-valor').value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
        let valorNF = parseFloat(vlrStr) || 0;
        let tipoNF = document.getElementById('os-nf-tipo').value;
        
        if(!numNF || valorNF <= 0) return alert("Para lançamento rápido, informe o Número da NF e o Valor Total da Nota.");
        
        itensOSAtual = [{
            id_catalogo: null,
            categoria: tipoNF, 
            descricao: `LANÇAMENTO RETROATIVO - REF. NF Nº ${numNF}`,
            qtd: 1,
            valor_unit: valorNF,
            desconto_pct: 0,
            valor_total: valorNF
        }];
        valorFinalOS = valorNF;
    } else {
        if(itensOSAtual.length === 0) return alert("A Ordem de Serviço precisa ter pelo menos um item adicionado.");
        for(let i = 0; i < itensOSAtual.length; i++) {
            valorFinalOS += itensOSAtual[i].valor_total; 
        }
    }

    let idContratoSelecionado = document.getElementById('os-contrato').value;
    let nomeLote = document.getElementById('os-contrato-lote').value;

    if(idContratoSelecionado) {
        let cTarget = contratosList.find(c => c.id === idContratoSelecionado);
        if(cTarget) {
            let totalOS_Pecas = 0; 
            let totalOS_Servicos = 0;
            
            itensOSAtual.forEach(it => {
               if(it.categoria === 'Peças' || it.categoria === 'Pneus' || it.categoria === 'Bateria') totalOS_Pecas += it.valor_total;
               else totalOS_Servicos += it.valor_total;
            });
            
            let saldoRestantePecas = 0, saldoRestanteServicos = 0;
            let msgAviso = ""; 
            let vaiEstourar = false;

            if(cTarget.categoria === 'Itens') {
                let saldoTotal = (cTarget.valor_total || 0) - (cTarget.saldo_consumido_real || 0);
                if(valorFinalOS > saldoTotal) { 
                    vaiEstourar = true; 
                    msgAviso = `O valor da OS (${window.formatarMoeda(valorFinalOS)}) ultrapassa o saldo do contrato (${window.formatarMoeda(saldoTotal)}).`; 
                }
            } else {
                if(nomeLote && cTarget.lotes_contrato) {
                    let lTarget = cTarget.lotes_contrato.find(l => l.descricao === nomeLote);
                    if(lTarget) {
                        saldoRestantePecas = (lTarget.teto_pecas || 0) - (lTarget.consumido_pecas || 0);
                        saldoRestanteServicos = (lTarget.teto_servicos || 0) - (lTarget.consumido_servicos || 0);
                        if(totalOS_Pecas > saldoRestantePecas) { vaiEstourar = true; msgAviso += `\n- Gasto com Peças excede o saldo do lote (${window.formatarMoeda(saldoRestantePecas)}).`; }
                        if(totalOS_Servicos > saldoRestanteServicos) { vaiEstourar = true; msgAviso += `\n- Gasto com Serviços excede o saldo do lote (${window.formatarMoeda(saldoRestanteServicos)}).`; }
                    }
                } else {
                    saldoRestantePecas = (cTarget.valor_teto_pecas || 0) - (cTarget.saldo_consumido_pecas || 0);
                    saldoRestanteServicos = (cTarget.valor_teto_servicos || 0) - (cTarget.saldo_consumido_servicos || 0);
                    if(totalOS_Pecas > saldoRestantePecas) { vaiEstourar = true; msgAviso += `\n- Gasto com Peças excede o saldo global (${window.formatarMoeda(saldoRestantePecas)}).`; }
                    if(totalOS_Servicos > saldoRestanteServicos) { vaiEstourar = true; msgAviso += `\n- Gasto com Serviços excede o saldo global (${window.formatarMoeda(saldoRestanteServicos)}).`; }
                }
            }
            
            if (vaiEstourar) {
                let msgConfirm = `⚠️ AVISO DE SALDO EXCEDIDO!\n${msgAviso}\n\nDeseja lançar e salvar esta OS mesmo assim?`;
                if(!confirm(msgConfirm)) return; 
            }
        }
    }

    const opt = vSelect.options[vSelect.selectedIndex];
    document.getElementById('loading').classList.remove('hidden');

    let tipoOS = document.getElementById('os-tipo').value;

    if(!isNF) {
        for(let i = 0; i < itensOSAtual.length; i++) {
            let it = itensOSAtual[i];
            if(it.id_catalogo) {
                let catExistente = catalogoList.find(c => c.id === it.id_catalogo);
                if(catExistente) {
                    if(catExistente.descricao !== it.descricao || catExistente.valor_referencia !== it.valor_unit || catExistente.categoria !== it.categoria) {
                        await setDoc(doc(db, `${mod}_${tenant}_catalogo`, it.id_catalogo), {
                            categoria: it.categoria,
                            descricao: it.descricao, 
                            valor_referencia: it.valor_unit 
                        }, {merge: true});
                    }
                }
            } else {
                let novoIdCat = `ITEM-${Date.now()}-${Math.floor(Math.random()*1000)}`;
                await setDoc(doc(db, `${mod}_${tenant}_catalogo`, novoIdCat), {
                    categoria: it.categoria, 
                    descricao: it.descricao, 
                    aplicacao_modelos: opt.getAttribute('data-modelo') ? opt.getAttribute('data-modelo').toUpperCase() : '',
                    valor_referencia: it.valor_unit, 
                    garantia_meses: 0, 
                    garantia_km: 0
                });
                itensOSAtual[i].id_catalogo = novoIdCat; 
            }
        }
    }

    const dataISO = document.getElementById('os-data').value ? new Date(document.getElementById('os-data').value + "T12:00:00").toISOString() : new Date().toISOString();
    
    let statusFinal = document.getElementById('os-status').value;
    const p = String(currentUser.nivel_acesso || '').toUpperCase();
    if(!p.includes('ADM') && !p.includes('MASTER') && p !== 'GESTOR') { 
        statusFinal = "Pendente"; 
    }

    let kmDeclarado = parseInt(document.getElementById('os-km').value) || 0;

    const dados = { 
        data_registro: dataISO, 
        placa: vSelect.value, 
        modelo_veiculo: opt.getAttribute('data-modelo'), 
        secretaria_veiculo: opt.getAttribute('data-sec'), 
        destinacao_veiculo: opt.getAttribute('data-dest'),
        tipoServico: tipoOS, 
        status: statusFinal, 
        fornecedor: document.getElementById('os-fornecedor').value, 
        responsavel: document.getElementById('os-responsavel').value, 
        id_contrato: document.getElementById('os-contrato').value,
        lote_contrato: nomeLote || null,
        congelado: false,
        itens: itensOSAtual, 
        valor: valorFinalOS,
        km_registro: kmDeclarado
    };
    
    let idParaSalvar = document.getElementById('os-id').value || 'OS-' + Date.now();
    await setDoc(doc(db, `${mod}_${tenant}_ordens_servico`, idParaSalvar), dados, {merge: true});
    
    if (kmDeclarado > 0) {
       let veicAtual = veiculosList.find(v => v.placa === vSelect.value);
       let kmLidoBanco = parseInt(veicAtual.km_atual) || parseInt(veicAtual.odometro) || parseInt(veicAtual.horimetro) || 0;
       
       if(veicAtual && kmLidoBanco < kmDeclarado) {
           await setDoc(doc(db, `${tenant}_veiculos`, vSelect.value), {
               km_atual: kmDeclarado,
               odometro: kmDeclarado,
               horimetro: kmDeclarado
           }, {merge: true});
       }
    }

    if(statusFinal === 'Pendente' || statusFinal === 'Aprovada') { 
        await setDoc(doc(db, `${tenant}_veiculos`, vSelect.value), {status_operacional: 'Em Oficina'}, {merge: true}); 
    } else if (statusFinal === 'Paga') { 
        await setDoc(doc(db, `${tenant}_veiculos`, vSelect.value), {status_operacional: 'Disponível'}, {merge: true}); 
    }

    document.getElementById('loading').classList.add('hidden');
    bootstrap.Modal.getInstance(document.getElementById('modalOS')).hide(); 
    alert("Registro salvo com Sucesso!"); 

    let dtOS = document.getElementById('os-data').value;
    let dtIniAtual = document.getElementById('r-data-ini').value;
    let dtFimAtual = document.getElementById('r-data-fim').value;

    if (dtOS && dtOS < dtIniAtual) dtIniAtual = dtOS;
    if (dtOS && dtOS > dtFimAtual) dtFimAtual = dtOS;

    window.carregarDadosGerais(dtIniAtual, dtFimAtual);
}

window.editarOS = function(os) {
    if(os.congelado) return alert("Registro bloqueado por fechamento de período.");
    
    window.abrirModalOS(); 

    document.getElementById('os-id').value = os.idOS; 
    document.getElementById('os-veiculo').value = os.placa; 
    window.filtrarContratosPorSec();
    
    if(os.data_registro) { 
        document.getElementById('os-data').value = os.data_registro.split('T')[0]; 
    }
    
    document.getElementById('os-tipo').value = os.tipoServico || 'Manutenção Geral'; 
    document.getElementById('os-status').value = os.status || 'Pendente'; 
    document.getElementById('os-fornecedor').value = os.fornecedor || ''; 
    document.getElementById('os-responsavel').value = os.responsavel || '';
    document.getElementById('os-km').value = os.km_registro || '';
    
    if(os.id_contrato) {
        document.getElementById('os-contrato').value = os.id_contrato;
        window.atualizarLotesOS();
        if(os.lote_contrato) { 
            document.getElementById('os-contrato-lote').value = os.lote_contrato; 
        }
    }
    
    itensOSAtual = [];
    let isNFMode = false;

    if (os.itens && os.itens.length === 1 && os.itens[0].descricao && os.itens[0].descricao.includes("REF. NF Nº")) {
        isNFMode = true;
        document.getElementById('toggle-os-nf').checked = true;
        window.toggleModoNF();

        let nfStr = os.itens[0].descricao.split("Nº ");
        document.getElementById('os-nf-num').value = nfStr.length > 1 ? nfStr[1] : '';
        document.getElementById('os-nf-tipo').value = os.itens[0].categoria || 'Serviço';

        let elValor = document.getElementById('os-nf-valor');
        elValor.value = (os.itens[0].valor_total || 0).toFixed(2).replace(".", "");
        window.aplicarMascaraMonetaria(elValor);
    } else {
        document.getElementById('toggle-os-nf').checked = false;
        window.toggleModoNF();
    }

    if(os.itens && os.itens.length > 0) {
        itensOSAtual = [...os.itens];
    } else if (!isNFMode) {
        itensOSAtual.push({
            id_catalogo: os.id_catalogo || null,
            categoria: 'Serviço',
            descricao: os.descricao || 'Item Antigo Migrado',
            qtd: 1,
            valor_unit: parseFloat(os.valor) || 0,
            desconto_pct: 0,
            valor_total: parseFloat(os.valor) || 0
        });
    }
    window.renderTabelaItensOS();
}

window.deletarOS = async function(id) { 
    if(confirm("Deseja realmente excluir esta Ordem de Serviço?")) { 
        await deleteDoc(doc(db, `${mod}_${tenant}_ordens_servico`, id)); 
        window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value); 
    } 
}
 
window.aplicarStatusLote = async function() {
    const novoStatus = document.getElementById('lote-status').value; 
    if(!novoStatus) return alert("Selecione o status.");
    
    const selecionados = Array.from(document.querySelectorAll('.chk-os-item:checked')).map(cb => cb.value); 
    if(selecionados.length === 0) return alert("Marque pelo menos uma OS.");
    
    if(confirm(`Mudar o status de ${selecionados.length} ordens para '${novoStatus}'?`)) {
        document.getElementById('loading').classList.remove('hidden');
        for(let id of selecionados) { 
            await setDoc(doc(db, `${mod}_${tenant}_ordens_servico`, id), {status: novoStatus}, {merge: true}); 
        }
        alert("Operação concluída!"); 
        window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value);
    }
}

// ================= IMPRESSÃO FÍSICA DA OS =================
window.imprimirOS = function(idOS) {
    const os = ordensGlobal.find(o => o.idOS === idOS);
    if(!os) return alert("OS não encontrada.");

    let itensHtml = '';
    if(os.itens) {
        os.itens.forEach(it => {
            itensHtml += `
            <tr class="border-bottom">
               <td class="py-2">${it.qtd}</td>
               <td class="py-2">${it.descricao} <small class="text-muted">(${it.categoria})</small></td>
               <td class="py-2 text-end">${window.formatarMoeda(it.valor_unit)}</td>
               <td class="py-2 text-end fw-bold">${window.formatarMoeda(it.valor_total)}</td>
            </tr>`;
        });
    }

    let veic = veiculosList.find(v => v.placa === os.placa) || {};
    let secReal = os.secretaria_veiculo || veic.secretaria || veic.sec || '';
    let modeloReal = os.modelo_veiculo || veic.modelo || veic.veiculo || '';
    let kmReal = os.km_registro || veic.km_atual || veic.odometro || veic.horimetro || 'Não inf.';

    let html = `
    <div class="text-center mb-4">
      <h3 class="fw-bold m-0">TICKET DE ORDEM DE SERVIÇO</h3>
      <p class="text-muted m-0">${tenant.toUpperCase()} - MÓDULO FROTAS E OFICINA</p>
    </div>
    
    <div class="row mb-4 border p-3 rounded bg-light">
       <div class="col-6">
          <strong>Ordem ID:</strong> ${os.idOS}<br>
          <strong>Data:</strong> ${os.data_registro ? new Date(os.data_registro).toLocaleDateString('pt-BR') : '-'}<br>
          <strong>Status Sistema:</strong> ${os.status}
       </div>
       <div class="col-6">
          <strong>Placa:</strong> ${os.placa}<br>
          <strong>Modelo/Secretaria:</strong> ${modeloReal} - ${secReal}<br>
          <strong>KM Atual:</strong> ${kmReal}
       </div>
    </div>
    
    <div class="mb-4">
       <strong>Fornecedor/Oficina:</strong> ${os.fornecedor || 'Despesa Direta'}<br>
       <strong>Classificação:</strong> ${os.tipoServico}<br>
       <strong>Autorizado por:</strong> ${os.responsavel || '-'}
    </div>

    <table class="table table-sm">
      <thead class="table-dark">
         <tr><th>Qtd</th><th>Descrição do Serviço / Peça</th><th class="text-end">Vlr. Unit</th><th class="text-end">Vlr. Total</th></tr>
      </thead>
      <tbody>
         ${itensHtml}
      </tbody>
    </table>
    
    <div class="text-end mt-3 mb-5">
       <h4 class="fw-bold">TOTAL: ${window.formatarMoeda(os.valor)}</h4>
    </div>

    <div class="row mt-5 pt-5 text-center" style="page-break-inside: avoid;">
       <div class="col-4">
          <div class="border-top border-dark mx-3 pt-2">
             <strong>Oficina / Fornecedor</strong><br><small>Assinatura</small>
          </div>
       </div>
       <div class="col-4">
          <div class="border-top border-dark mx-3 pt-2">
             <strong>Motorista</strong><br><small>Assinatura</small>
          </div>
       </div>
       <div class="col-4">
          <div class="border-top border-dark mx-3 pt-2">
             <strong>Gestor da Frota</strong><br><small>Visto e Aprovação</small>
          </div>
       </div>
    </div>
    <div class="text-center mt-5 text-muted small">Gerado por: Feitosa Softwares</div>
    `;

    // Utiliza a nova função universal à prova de tela branca
    window.imprimirDocumento(html, 'OS_' + os.idOS);
}

// ================= DASHBOARDS E RELATÓRIOS =================

window.gerarAuditoriaConsumo = function(ordensConsideradas) {
    const hoje = new Date(); 
    const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate(); 
    const diasCorridos = hoje.getDate() || 1; 
    
    let agrupamento = {};
    ordensConsideradas.forEach(os => {
        let veic = veiculosList.find(v => v.placa === os.placa); 
        let sec = os.secretaria_veiculo || 'Indefinida'; 
        let dotacao = veic && veic.dotacao ? veic.dotacao : 'Não Informada';
        let chave = sec + "|" + dotacao;
        
        if(!agrupamento[chave]) agrupamento[chave] = { sec: sec, dotacao: dotacao, gasto: 0 };
        agrupamento[chave].gasto += (parseFloat(os.valor_filtrado) || 0);
    });
    
    const tb = document.querySelector('#table-auditoria tbody'); 
    tb.innerHTML = '';
    
    if(Object.keys(agrupamento).length === 0) { 
        tb.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Sem dados neste período.</td></tr>'; 
        return; 
    }
    
    Object.values(agrupamento).forEach(item => {
        if(item.gasto <= 0) return;
        let projecao = (item.gasto / diasCorridos) * diasNoMes; 
        let badgeRisco = projecao > 20000 ? '<span class="badge bg-danger pulse-anim">Alto Risco</span>' : '<span class="badge bg-success">Controlado</span>';
        tb.innerHTML += `<tr><td><strong>${item.sec}</strong></td><td>${item.dotacao}</td><td class="text-primary fw-bold">${window.formatarMoeda(item.gasto)}</td><td class="text-danger fw-bold">${window.formatarMoeda(projecao)}</td><td>${badgeRisco}</td></tr>`;
    });
}

window.carregarDashFiltro = async function(aplicarFiltrosFront = true) {
    let dtIni = document.getElementById('r-data-ini').value;
    let dtFim = document.getElementById('r-data-fim').value;

    let ordens = ordensGlobal.filter(os => {
        if(!os.data_registro) return true;
        let d = os.data_registro.split('T')[0];
        return d >= dtIni && d <= dtFim;
    });
    
    if(aplicarFiltrosFront) {
        const fPlaca = document.getElementById('r-placa').value; 
        const fForn = document.getElementById('r-forn').value; 
        const fStatus = document.getElementById('r-status').value;
        const fSec = document.getElementById('r-sec').value;
        const fDest = document.getElementById('r-dest').value;
        const fClassOS = document.getElementById('r-class-os').value;
        const fCatItem = document.getElementById('r-cat-item').value;
        
        if (fPlaca) ordens = ordens.filter(os => os.placa && os.placa.toUpperCase().includes(fPlaca.toUpperCase()));
        if (fForn) ordens = ordens.filter(os => os.fornecedor && os.fornecedor.toUpperCase().includes(fForn.toUpperCase()));
        if (fStatus) ordens = ordens.filter(os => os.status === fStatus);
        if (fSec) ordens = ordens.filter(os => os.secretaria_veiculo && os.secretaria_veiculo.toUpperCase().includes(fSec.toUpperCase()));
        if (fDest) ordens = ordens.filter(os => os.destinacao_veiculo && os.destinacao_veiculo.toUpperCase().includes(fDest.toUpperCase()));
        if (fClassOS) ordens = ordens.filter(os => os.tipoServico === fClassOS);
        
        ordens.forEach(os => {
            if (fCatItem && os.itens) {
                let somaCat = 0;
                os.itens.forEach(it => { if(it.categoria === fCatItem) somaCat += (parseFloat(it.valor_total) || 0); });
                os.valor_filtrado = somaCat;
            } else {
                os.valor_filtrado = parseFloat(os.valor) || 0;
            }
        });
        
        if(fCatItem) {
            ordens = ordens.filter(os => os.valor_filtrado > 0);
            document.getElementById('lbl-dash-total').innerText = `Gasto Apenas com: ${fCatItem}`;
        } else {
            document.getElementById('lbl-dash-total').innerText = `Gasto Total Consolidado (Período)`;
        }
    }
    
    let totSec = {}, totTipo = {}, totVeic = {}, valorTotalGeral = 0;
    let fornecedoresUnicos = new Set(), responsaveisUnicos = new Set(), destinacoesUnicas = new Set();
    
    veiculosList.forEach(v => { 
        v.gasto_total = 0; 
        if(v.destinacao) destinacoesUnicas.add(v.destinacao);
    });
    
    let ordensParaGraficos = ordens.filter(os => os.status !== 'Cancelada');

    ordensParaGraficos.forEach(os => {
        let valor = parseFloat(os.valor_filtrado) || 0; 
        let sec = os.secretaria_veiculo || 'Indefinida'; 
        let tipo = os.tipoServico || 'Outros'; 
        let veicLabel = os.placa + " (" + (os.modelo_veiculo || "") + ")";
        
        totSec[sec] = (totSec[sec] || 0) + valor; 
        totTipo[tipo] = (totTipo[tipo] || 0) + valor; 
        totVeic[veicLabel] = (totVeic[veicLabel] || 0) + valor; 
        valorTotalGeral += valor;
        
        if(os.fornecedor) fornecedoresUnicos.add(os.fornecedor); 
        if(os.responsavel) responsaveisUnicos.add(os.responsavel);
        
        let vTarget = veiculosList.find(v => v.id === os.placa); 
        if(vTarget) vTarget.gasto_total += valor;
    });
    
    document.getElementById('dash-total-destaque').innerText = window.formatarMoeda(valorTotalGeral);
    
    const dlForn = document.getElementById('lista-fornecedores'); dlForn.innerHTML = ''; [...fornecedoresUnicos].sort().forEach(f => dlForn.innerHTML += `<option value="${f}">`); 
    const dlResp = document.getElementById('lista-responsaveis'); dlResp.innerHTML = ''; [...responsaveisUnicos].sort().forEach(r => dlResp.innerHTML += `<option value="${r}">`); 
    const dlDest = document.getElementById('lista-destinacoes'); dlDest.innerHTML = ''; [...destinacoesUnicas].sort().forEach(d => dlDest.innerHTML += `<option value="${d}">`); 
    
    const dlSec = document.getElementById('lista-secretarias'); dlSec.innerHTML = ''; 
    window.getSecretariasInteligentes().forEach(s => dlSec.innerHTML += `<option value="${s}">`); 
    
    if(chartSec) chartSec.destroy(); 
    chartSec = new Chart(document.getElementById('chartSecretaria'), { type: 'pie', data: { labels: Object.keys(totSec), datasets: [{ data: Object.values(totSec), backgroundColor: ['#0d6efd','#198754','#dc3545','#ffc107','#0dcaf0','#6610f2'] }] } });
    
    if(chartTipo) chartTipo.destroy(); 
    chartTipo = new Chart(document.getElementById('chartTipo'), { type: 'doughnut', data: { labels: Object.keys(totTipo), datasets: [{ data: Object.values(totTipo), backgroundColor: ['#fd7e14','#20c997','#e83e8c','#6f42c1','#343a40'] }] } });
    
    const topVeiculos = Object.entries(totVeic).sort((a,b) => b[1] - a[1]).slice(0,5);
    if(chartVeic) chartVeic.destroy(); 
    chartVeic = new Chart(document.getElementById('chartVeiculo'), { type: 'bar', data: { labels: topVeiculos.map(x=>x[0]), datasets: [{ label: 'R$ Gasto', data: topVeiculos.map(x=>x[1]), backgroundColor: '#0d6efd' }] } });
    
    const tbody = document.querySelector('#table-resumo-veiculos tbody'); 
    tbody.innerHTML = '';
    let veiculosOrdenados = [...veiculosList].sort((a,b) => (b.gasto_total||0) - (a.gasto_total||0));
    veiculosOrdenados.forEach(v => { 
        if(v.gasto_total > 0) {
            let modeloReal = v.modelo || v.veiculo || '';
            let secReal = v.secretaria || v.sec || '';
            tbody.innerHTML += `<tr><td><strong>${v.placa}</strong></td><td>${modeloReal}</td><td>${secReal}<br><small class="text-info">${v.destinacao || ''}</small></td><td>${v.dotacao || '-'}</td><td>${v.vinculo || '-'}</td><td class="text-danger fw-bold text-end pe-4">${window.formatarMoeda(v.gasto_total)}</td></tr>`; 
        }
    });
    
    window.gerarAuditoriaConsumo(ordensParaGraficos);
}

window.carregarTabelaOSComFiltro = async function(temFiltro = true) {
    let dtIni = document.getElementById('r-data-ini').value;
    let dtFim = document.getElementById('r-data-fim').value;

    let ordens = ordensGlobal.filter(os => {
        if(!os.data_registro) return true;
        let d = os.data_registro.split('T')[0];
        return d >= dtIni && d <= dtFim;
    });
    
    if(temFiltro) {
        const fPlaca = document.getElementById('f-os-placa').value; 
        const fForn = document.getElementById('f-os-forn').value; 
        const fStatus = document.getElementById('f-os-status').value;
        
        if (fPlaca) ordens = ordens.filter(os => os.placa && os.placa.toUpperCase().includes(fPlaca.toUpperCase()));
        if (fForn) ordens = ordens.filter(os => os.fornecedor && os.fornecedor.toUpperCase().includes(fForn.toUpperCase()));
        if (fStatus) ordens = ordens.filter(os => os.status === fStatus);
    }
    
    ordens.sort((a,b) => new Date(b.data_registro) - new Date(a.data_registro));
    
    const tb = document.querySelector('#table-os tbody'); 
    tb.innerHTML = '';
    
    if(ordens.length === 0) { 
        tb.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Nenhuma ordem encontrada no período ou filtro selecionado.</td></tr>'; 
        return; 
    }
    
    const isAdm = String(currentUser.nivel_acesso || '').toUpperCase().includes('ADM') || String(currentUser.nivel_acesso || '').toUpperCase() === 'GESTOR';
    
    ordens.forEach(os => {
        let dataVisual = os.data_registro ? new Date(os.data_registro).toLocaleDateString('pt-BR') : '-';
        let statusExibir = os.status || 'Pendente'; 
        let statusBadge = statusExibir === 'Paga' ? 'bg-success' : (statusExibir === 'Aprovada' ? 'bg-primary' : (statusExibir === 'Cancelada' ? 'bg-danger' : 'bg-warning text-dark'));
        let isCongelado = os.congelado === true; 
        let cadeadoIco = isCongelado ? '<i class="fas fa-lock text-warning"></i> ' : ''; 
        let linhaClass = isCongelado ? 'tr-congelada' : '';
        let qtItens = os.itens ? os.itens.length : 1; 
        
        let valorExibidoOS = parseFloat(os.valor) || 0;
        
        let html = `<tr class="${linhaClass}">`;
        
        if(isAdm && !isCongelado) {
            html += `<td class="adm-only"><input type="checkbox" class="chk-os-item form-check-input" value="${os.idOS}"></td>`;
        } else if (isAdm && isCongelado) {
            html += `<td class="adm-only text-center"><i class="fas fa-lock text-muted small"></i></td>`;
        } else {
            html += `<td class="adm-only hidden"></td>`;
        }
        
        html += `
            <td>${cadeadoIco}${dataVisual}</td>
            <td>${os.fornecedor || '-'}</td>
            <td><strong>${os.placa}</strong><br><small class="text-muted">${os.destinacao_veiculo || os.modelo_veiculo || ''}</small></td>
            <td>${os.tipoServico}<br><small class="text-muted">${qtItens} item(ns)</small></td>
            <td><span class="badge ${statusBadge}">${statusExibir}</span></td>
            <td class="fw-bold text-primary text-end pe-3">${window.formatarMoeda(valorExibidoOS)}</td>`;
        
        let acoes = `<button class="btn btn-sm btn-dark me-1" onclick='window.imprimirOS("${os.idOS}")' title="Imprimir Ticket"><i class="fas fa-print"></i></button>`;
        
        if(isAdm && !isCongelado) { 
            html += `<td class="adm-only text-nowrap">
                        ${acoes}
                        <button class="btn btn-sm btn-light text-primary" onclick='window.editarOS(${JSON.stringify(os)})'><i class="fas fa-edit"></i></button> 
                        <button class="btn btn-sm btn-light text-danger" onclick='window.deletarOS("${os.idOS}")'><i class="fas fa-trash"></i></button>
                    </td></tr>`; 
        } else if (isAdm && isCongelado) { 
            html += `<td class="adm-only text-nowrap">${acoes} <span class="badge bg-light text-muted border">Fechado</span></td></tr>`; 
        } else { 
            html += `<td class="adm-only hidden"></td></tr>`; 
        }
        tb.innerHTML += html;
    });
}

// ================= CONTRATOS E ATAS DE REGISTRO =================

function renderizarTabelaContratos(contratos) {
    const tb = document.querySelector('#table-contratos tbody'); 
    tb.innerHTML = '';
    
    if(contratos.length === 0) { 
        tb.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Nenhum contrato cadastrado.</td></tr>'; 
        return; 
    }
    
    contratos.forEach(c => {
        let tipoBadge = c.categoria === 'Itens' ? '<span class="badge bg-dark mt-1">Restrito a Catálogo</span>' : '<span class="badge bg-secondary mt-1">Global (Peças e M.O)</span>';
        let HTMLSaldo = '';

        if(c.categoria === 'Itens') {
            let teto = c.valor_total || 0;
            let gasto = c.saldo_consumido_real || 0;
            let saldo = teto - gasto;
            let pct = teto > 0 ? (gasto / teto) * 100 : 0;
            let colorClass = pct > 90 ? 'bg-danger' : (pct > 70 ? 'bg-warning text-dark' : 'bg-success');

            HTMLSaldo = `
              <div class="d-flex justify-content-between small fw-bold mb-1">
                 <span class="text-secondary" title="Total Licitado na Ata">Licitado: ${window.formatarMoeda(teto)}</span>
                 <span class="${saldo < 0 ? 'text-danger' : 'text-success'}" title="Saldo Restante para Consumo">Saldo: ${window.formatarMoeda(saldo)}</span>
              </div>
              <div class="progress-bar-fundo shadow-sm" style="height: 16px;">
                 <div class="progress-bar-preenchimento ${colorClass}" style="width: ${Math.min(pct, 100)}%; font-size: 10px; line-height: 16px;">${pct.toFixed(1)}% Consumido</div>
              </div>
            `;
        } 
        else if(c.categoria === 'Global' && c.lotes_contrato && c.lotes_contrato.length > 0) {
            HTMLSaldo = `<div class="d-flex flex-column gap-2" style="max-height: 220px; overflow-y: auto; padding-right: 5px;">`;
            
            c.lotes_contrato.forEach(l => {
                let tetoP = l.teto_pecas || 0;
                let gastoP = l.consumido_pecas || 0;
                let saldoP = tetoP - gastoP;
                let pctP = tetoP > 0 ? (gastoP / tetoP) * 100 : 0;
                let colP = pctP > 90 ? 'bg-danger' : (pctP > 70 ? 'bg-warning text-dark' : 'bg-success');

                let tetoS = l.teto_servicos || 0;
                let gastoS = l.consumido_servicos || 0;
                let saldoS = tetoS - gastoS;
                let pctS = tetoS > 0 ? (gastoS / tetoS) * 100 : 0;
                let colS = pctS > 90 ? 'bg-danger' : (pctS > 70 ? 'bg-warning text-dark' : 'bg-success');

                HTMLSaldo += `
                <div class="border rounded p-1 bg-white shadow-sm">
                    <div class="text-center small fw-bold text-dark border-bottom border-light mb-1 bg-light pb-1">${l.descricao}</div>
                    <div class="row g-1 px-1">
                       <div class="col-6 border-end">
                          <div class="d-flex justify-content-between" style="font-size: 10px;">
                              <span class="text-secondary"><i class="fas fa-cogs"></i> Pçs</span>
                              <span class="${saldoP < 0 ? 'text-danger' : 'text-primary'} fw-bold">${window.formatarMoeda(saldoP)}</span>
                          </div>
                          <div class="progress-bar-fundo" style="height: 10px; margin-top: 1px;" title="${pctP.toFixed(1)}% consumido">
                             <div class="progress-bar-preenchimento ${colP}" style="width: ${Math.min(pctP, 100)}%;"></div>
                          </div>
                       </div>
                       <div class="col-6">
                          <div class="d-flex justify-content-between" style="font-size: 10px;">
                              <span class="text-secondary"><i class="fas fa-tools"></i> M.O.</span>
                              <span class="${saldoS < 0 ? 'text-danger' : 'text-warning text-dark'} fw-bold">${window.formatarMoeda(saldoS)}</span>
                          </div>
                          <div class="progress-bar-fundo" style="height: 10px; margin-top: 1px;" title="${pctS.toFixed(1)}% consumido">
                             <div class="progress-bar-preenchimento ${colS}" style="width: ${Math.min(pctS, 100)}%;"></div>
                          </div>
                       </div>
                    </div>
                </div>
                `;
            });
            HTMLSaldo += `</div>`;
        } 
        else {
            let tetoPecas = c.valor_teto_pecas || 0;
            let gastoPecas = c.saldo_consumido_pecas || 0;
            let saldoPecas = tetoPecas - gastoPecas;
            let pctPecas = tetoPecas > 0 ? (gastoPecas / tetoPecas) * 100 : 0;
            let colorPecas = pctPecas > 90 ? 'bg-danger' : (pctPecas > 70 ? 'bg-warning text-dark' : 'bg-success');

            let tetoServicos = c.valor_teto_servicos || 0;
            let gastoServicos = c.saldo_consumido_servicos || 0;
            let saldoServicos = tetoServicos - gastoServicos;
            let pctServ = tetoServicos > 0 ? (gastoServicos / tetoServicos) * 100 : 0;
            let colorServ = pctServ > 90 ? 'bg-danger' : (pctServ > 70 ? 'bg-warning text-dark' : 'bg-success');

            HTMLSaldo = `
              <div class="row g-2 align-items-center">
                 <div class="col-12 col-md-6 border-end">
                    <div class="d-flex justify-content-between small fw-bold">
                        <span class="text-secondary"><i class="fas fa-cogs"></i> Peças</span>
                        <span class="${saldoPecas < 0 ? 'text-danger' : 'text-primary'}">${window.formatarMoeda(saldoPecas)}</span>
                    </div>
                    <div class="progress-bar-fundo shadow-sm" style="height: 12px; margin-top: 2px;" title="${pctPecas.toFixed(1)}% consumido">
                       <div class="progress-bar-preenchimento ${colorPecas}" style="width: ${Math.min(pctPecas, 100)}%;"></div>
                    </div>
                 </div>
                 <div class="col-12 col-md-6">
                    <div class="d-flex justify-content-between small fw-bold">
                        <span class="text-secondary"><i class="fas fa-tools"></i> M.O.</span>
                        <span class="${saldoServicos < 0 ? 'text-danger' : 'text-warning'}">${window.formatarMoeda(saldoServicos)}</span>
                    </div>
                    <div class="progress-bar-fundo shadow-sm" style="height: 12px; margin-top: 2px;" title="${pctServ.toFixed(1)}% consumido">
                       <div class="progress-bar-preenchimento ${colorServ}" style="width: ${Math.min(pctServ, 100)}%;"></div>
                    </div>
                 </div>
              </div>
            `;
        }
        
        tb.innerHTML += `
        <tr>
           <td><strong class="text-primary fs-6">${c.numero}</strong><br>${tipoBadge}</td>
           <td><span class="fw-bold">${c.fornecedor}</span></td>
           <td><span class="badge bg-light text-dark border">${c.secretaria || 'GERAL / TODAS'}</span></td>
           <td class="small text-muted text-nowrap">${c.data_inicio ? new Date(c.data_inicio).toLocaleDateString('pt-BR') : '-'} a<br>${c.data_fim ? new Date(c.data_fim).toLocaleDateString('pt-BR') : '-'}</td>
           <td colspan="3" class="align-middle p-2" style="min-width: 280px; vertical-align: top !important;">${HTMLSaldo}</td>
           <td class="adm-only text-nowrap text-end align-middle">
              <button class="btn btn-sm btn-info text-white me-1 fw-bold shadow-sm" onclick='window.abrirEncarteContrato("${c.id}")' title="Ver Detalhamento Completo"><i class="fas fa-search-plus"></i> Detalhes</button>
              <button class="btn btn-sm btn-light text-primary border shadow-sm" onclick='window.editarContrato(${JSON.stringify(c)})'><i class="fas fa-edit"></i></button>
           </td>
        </tr>`;
    });
}

// LÓGICA DO ENCARTE VISUAL E IMPRESSÃO (CORRIGIDA)
window.abrirEncarteContrato = function(idContrato) {
    let c = contratosList.find(x => x.id === idContrato);
    if(!c) return alert("Contrato não encontrado.");

    let totalContratado = 0; let totalGasto = 0; let detalhamentoHtml = '';

    if (c.categoria === 'Itens') {
        totalContratado = c.valor_total || 0;
        totalGasto = c.saldo_consumido_real || 0;
        if (c.itens_contrato && c.itens_contrato.length > 0) {
            detalhamentoHtml += `<div class="table-responsive"><table class="table table-sm table-bordered">
                <thead class="table-light"><tr><th>Item Licitado</th><th class="text-center">Qtd Licitada</th><th class="text-end">Vlr Unitário</th><th class="text-end">Total Previsto</th></tr></thead><tbody>`;
            c.itens_contrato.forEach(it => {
                let valTotalLicitado = (it.qtd_licitada || 0) * (it.valor_unitario || 0);
                detalhamentoHtml += `<tr><td>${it.descricao}</td><td class="text-center">${it.qtd_licitada}</td><td class="text-end">${window.formatarMoeda(it.valor_unitario)}</td><td class="text-end fw-bold">${window.formatarMoeda(valTotalLicitado)}</td></tr>`;
            });
            detalhamentoHtml += `</tbody></table></div>`;
        } else { detalhamentoHtml = '<p class="text-muted">Sem itens detalhados.</p>'; }
    } else {
        let tetoPecas = c.valor_teto_pecas || 0; let tetoServicos = c.valor_teto_servicos || 0;
        let gastoPecas = c.saldo_consumido_pecas || 0; let gastoServicos = c.saldo_consumido_servicos || 0;
        totalContratado = tetoPecas + tetoServicos; totalGasto = gastoPecas + gastoServicos;

        if (c.lotes_contrato && c.lotes_contrato.length > 0) {
            c.lotes_contrato.forEach(l => {
                let lTetoTotal = (l.teto_pecas || 0) + (l.teto_servicos || 0);
                let lGastoTotal = (l.consumido_pecas || 0) + (l.consumido_servicos || 0);
                let lSaldo = lTetoTotal - lGastoTotal;
                let pct = lTetoTotal > 0 ? (lGastoTotal / lTetoTotal) * 100 : 0;
                let colorClass = pct > 90 ? 'bg-danger' : (pct > 70 ? 'bg-warning text-dark' : 'bg-success');

                detalhamentoHtml += `
                <div class="border p-3 rounded mb-3 bg-white shadow-sm lote-item">
                    <h6 class="fw-bold text-dark border-bottom pb-2">${l.descricao}</h6>
                    <div class="row small mb-2">
                        <div class="col-4"><strong>Contratado:</strong> ${window.formatarMoeda(lTetoTotal)}</div>
                        <div class="col-4 text-danger"><strong>Gasto:</strong> ${window.formatarMoeda(lGastoTotal)}</div>
                        <div class="col-4 text-success"><strong>Saldo Restante:</strong> ${window.formatarMoeda(lSaldo)}</div>
                    </div>
                    <div class="progress-bar-fundo border">
                        <div class="progress-bar-preenchimento ${colorClass}" style="width: ${Math.min(pct, 100)}%;">${pct.toFixed(1)}%</div>
                    </div>
                </div>`;
            });
        } else { detalhamentoHtml = '<p class="text-muted">Sem lotes criados para este contrato.</p>'; }
    }

    let saldoGeral = totalContratado - totalGasto;
    let htmlCompleto = `
        <div class="text-center mb-4 encarte-header">
            <h3 class="fw-bold m-0 text-primary">ENCARTE DE EXECUÇÃO DE CONTRATO</h3>
            <p class="text-muted m-0">Contrato: ${c.numero} | Fornecedor: ${c.fornecedor}</p>
        </div>
        <div class="row mb-4 text-center">
            <div class="col-md-4 mb-2">
                <div class="card card-azul h-100 shadow border-0 py-2">
                    <div class="card-body py-1">
                        <h6 class="fw-bold opacity-75">Total Contratado</h6>
                        <h4 class="fw-bold m-0">${window.formatarMoeda(totalContratado)}</h4>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-2">
                <div class="card card-laranja h-100 shadow border-0 py-2">
                    <div class="card-body py-1">
                        <h6 class="fw-bold opacity-75">Total Executado</h6>
                        <h4 class="fw-bold m-0">${window.formatarMoeda(totalGasto)}</h4>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-2">
                <div class="card card-verde h-100 shadow border-0 py-2">
                    <div class="card-body py-1">
                        <h6 class="fw-bold opacity-75">Saldo Disponível</h6>
                        <h4 class="fw-bold m-0">${window.formatarMoeda(saldoGeral)}</h4>
                    </div>
                </div>
            </div>
        </div>
        <h5 class="fw-bold mb-3 border-bottom pb-2">Detalhamento por Lotes/Categorias</h5>
        ${detalhamentoHtml}
    `;

    document.getElementById('content-encarte-modal').innerHTML = htmlCompleto;
    new bootstrap.Modal(document.getElementById('modalEncarte')).show();
};

window.imprimirEncarteAtual = function() {
    const htmlEncarte = document.getElementById('content-encarte-modal').innerHTML;
    window.imprimirDocumento(htmlEncarte, 'Encarte_Contrato');
};
// --------------------------------------------------------

function popularSecretariasContrato() {
    let select = document.getElementById('c-secretaria');
    select.innerHTML = '<option value="GERAL / TODAS AS SECRETARIAS">GERAL / TODAS AS SECRETARIAS</option>';
    window.getSecretariasInteligentes().forEach(s => { 
        select.innerHTML += `<option value="${s}">${s}</option>`; 
    });
}

function popularSelectCatalogoContrato() {
    let sel = document.getElementById('c-item-catalogo');
    sel.innerHTML = '<option value="">Selecione um item do Catálogo...</option>';
    sel.innerHTML += '<option value="NOVO" class="fw-bold text-primary">+++ NOVO ITEM (Digitar Manualmente) +++</option>';
    catalogoList.forEach(c => {
        sel.innerHTML += `<option value="${c.id}" data-desc="${c.descricao}" data-cat="${c.categoria}">[${c.categoria}] ${c.descricao} (Ref: ${window.formatarMoeda(c.valor_referencia)})</option>`;
    });
}

window.mudarTipoContrato = function() {
    let tipo = document.getElementById('c-categoria').value;
    if(tipo === 'Itens') {
        document.querySelectorAll('.div-global').forEach(e => e.classList.add('hidden'));
        document.querySelectorAll('.div-itens').forEach(e => e.classList.remove('hidden'));
        window.renderItensContrato();
    } else {
        document.querySelectorAll('.div-global').forEach(e => e.classList.remove('hidden'));
        document.querySelectorAll('.div-itens').forEach(e => e.classList.add('hidden'));
        window.renderLotesContrato();
    }
}

window.verificarNovoItemContrato = function() {
    let sel = document.getElementById('c-item-catalogo');
    let divNovo = document.getElementById('div-c-novo-item');
    if(sel && sel.value === 'NOVO') { divNovo.classList.remove('hidden'); } else { if(divNovo) divNovo.classList.add('hidden'); }
}

window.adicionarLoteContrato = function() {
    let desc = document.getElementById('c-lote-desc').value.toUpperCase().trim();
    if(!desc) return alert("Descreva a Categoria (ex: Médio Porte Gasolina).");

    let vlrPecasStr = document.getElementById('c-lote-pecas').value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    let vlrPecas = parseFloat(vlrPecasStr) || 0;
    
    let vlrMoStr = document.getElementById('c-lote-mo').value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    let vlrMo = parseFloat(vlrMoStr) || 0;

    if(vlrPecas === 0 && vlrMo === 0) return alert("Defina pelo menos um valor para Peças ou Mão de Obra.");

    lotesContratoAtual.push({ descricao: desc, teto_pecas: vlrPecas, teto_servicos: vlrMo });

    document.getElementById('c-lote-desc').value = ''; document.getElementById('c-lote-pecas').value = ''; document.getElementById('c-lote-mo').value = '';
    window.renderLotesContrato();
}

window.removerLoteContrato = function(idx) {
    lotesContratoAtual.splice(idx, 1);
    window.renderLotesContrato();
}

window.renderLotesContrato = function() {
    let tb = document.querySelector('#table-contrato-lotes tbody');
    tb.innerHTML = '';
    let sumPecas = 0, sumMo = 0;
    
    lotesContratoAtual.forEach((lote, idx) => {
        sumPecas += lote.teto_pecas; sumMo += lote.teto_servicos;
        let totalLote = lote.teto_pecas + lote.teto_servicos;
        tb.innerHTML += `
        <tr>
           <td><strong>${lote.descricao}</strong></td>
           <td class="text-end text-primary">${window.formatarMoeda(lote.teto_pecas)}</td>
           <td class="text-end text-warning">${window.formatarMoeda(lote.teto_servicos)}</td>
           <td class="text-end fw-bold">${window.formatarMoeda(totalLote)}</td>
           <td class="text-center"><button type="button" class="btn btn-sm btn-light text-danger py-0" onclick="window.removerLoteContrato(${idx})"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });
    
    if(lotesContratoAtual.length === 0) tb.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma categoria adicionada. O contrato ficará zerado.</td></tr>';
    
    document.getElementById('c-tot-pecas').innerText = window.formatarMoeda(sumPecas);
    document.getElementById('c-tot-mo').innerText = window.formatarMoeda(sumMo);
    document.getElementById('c-tot-geral').innerText = window.formatarMoeda(sumPecas + sumMo);
}

window.adicionarItemContrato = function() {
    let sel = document.getElementById('c-item-catalogo');
    let isNovo = (sel.value === 'NOVO');
    if(!sel.value) return alert("Selecione um item do catálogo ou crie um novo.");
    
    let qtd = parseInt(document.getElementById('c-item-qtd').value) || 0;
    if(qtd <= 0) return alert("A quantidade licitada deve ser maior que zero.");
    
    let valStr = document.getElementById('c-item-vlr').value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    let vlrUnit = parseFloat(valStr) || 0;
    if(vlrUnit <= 0) return alert("Defina o valor unitário licitado.");

    let idParaAdicionar = sel.value, descParaAdicionar = '', catParaAdicionar = '';

    if(isNovo) {
        descParaAdicionar = document.getElementById('c-item-desc-novo').value.toUpperCase().trim();
        catParaAdicionar = document.getElementById('c-item-cat-novo').value;
        if(!descParaAdicionar) return alert("Digite a descrição do novo item.");
        idParaAdicionar = null; 
    } else {
        let opt = sel.options[sel.selectedIndex];
        descParaAdicionar = opt.getAttribute('data-desc');
        catParaAdicionar = opt.getAttribute('data-cat') || 'Peças';

        let jaExiste = itensContratoAtual.find(i => i.id_catalogo === sel.value);
        if(jaExiste) {
            jaExiste.qtd_licitada += qtd;
            jaExiste.valor_unitario = vlrUnit; 
            window.renderItensContrato();
            return;
        }
    }
    
    itensContratoAtual.push({ 
        id_catalogo: idParaAdicionar, 
        descricao: descParaAdicionar, 
        categoria: catParaAdicionar, 
        qtd_licitada: qtd, 
        valor_unitario: vlrUnit, 
        qtd_consumida: 0 
    });
    
    document.getElementById('c-item-qtd').value = '1'; 
    document.getElementById('c-item-vlr').value = ''; 
    if(document.getElementById('c-item-desc-novo')) document.getElementById('c-item-desc-novo').value = '';
    sel.value = '';
    window.verificarNovoItemContrato();
    window.renderItensContrato();
}

window.removerItemContrato = function(idx) {
    itensContratoAtual.splice(idx, 1);
    window.renderItensContrato();
}

window.renderItensContrato = function() {
    let tb = document.querySelector('#table-contrato-itens tbody');
    tb.innerHTML = '';
    let somaTotal = 0;
    
    itensContratoAtual.forEach((it, idx) => {
        let vlrTotalItem = it.qtd_licitada * it.valor_unitario;
        somaTotal += vlrTotalItem;
        let indNovo = !it.id_catalogo ? ' <span class="badge bg-warning text-dark ml-1">Novo</span>' : '';
        
        tb.innerHTML += `
        <tr>
           <td>${it.descricao}${indNovo}</td>
           <td class="text-center">${it.qtd_licitada}</td>
           <td class="text-end">${window.formatarMoeda(it.valor_unitario)}</td>
           <td class="text-end fw-bold text-primary">${window.formatarMoeda(vlrTotalItem)}</td>
           <td class="text-center"><button type="button" class="btn btn-sm btn-light text-danger py-0" onclick="window.removerItemContrato(${idx})"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });
    
    if(itensContratoAtual.length === 0) tb.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum item adicionado à ata.</td></tr>';
    
    let elValor = document.getElementById('c-valor-total');
    elValor.value = somaTotal.toFixed(2).replace(".", "");
    window.aplicarMascaraMonetaria(elValor);
}

window.abrirModalContrato = function() { 
    document.getElementById('formContrato').reset(); 
    document.getElementById('c-id').value = ''; 
    
    itensContratoAtual = [];
    lotesContratoAtual = [];
    
    popularSecretariasContrato();
    popularSelectCatalogoContrato();
    
    window.verificarNovoItemContrato();
    window.mudarTipoContrato(); 
    
    document.getElementById('btn-del-contrato').classList.add('hidden'); 
    new bootstrap.Modal(document.getElementById('modalContrato')).show(); 
}
 
window.editarContrato = function(c) { 
    document.getElementById('c-id').value = c.id; 
    document.getElementById('c-numero').value = c.numero; 
    document.getElementById('c-categoria').value = c.categoria || 'Global';
    document.getElementById('c-fornecedor').value = c.fornecedor; 
    document.getElementById('c-objeto').value = c.objeto || ''; 
    document.getElementById('c-ini').value = c.data_inicio || ''; 
    document.getElementById('c-fim').value = c.data_fim || ''; 
    
    popularSecretariasContrato();
    document.getElementById('c-secretaria').value = c.secretaria || 'GERAL / TODAS AS SECRETARIAS'; 
    
    popularSelectCatalogoContrato();
    
    itensContratoAtual = c.itens_contrato ? [...c.itens_contrato] : [];
    lotesContratoAtual = c.lotes_contrato ? [...c.lotes_contrato] : [];
    
    if((c.categoria === 'Global' || !c.categoria) && lotesContratoAtual.length === 0 && (c.valor_teto_pecas > 0 || c.valor_teto_servicos > 0)) {
        lotesContratoAtual.push({ descricao: "FROTA GERAL (MIGRADO)", teto_pecas: c.valor_teto_pecas || 0, teto_servicos: c.valor_teto_servicos || 0 });
    }

    window.verificarNovoItemContrato();
    window.mudarTipoContrato(); 
    
    let elValorTot = document.getElementById('c-valor-total');
    elValorTot.value = (parseFloat(c.valor_total) || 0).toFixed(2).replace(".", "");
    window.aplicarMascaraMonetaria(elValorTot);
    
    document.getElementById('btn-del-contrato').classList.remove('hidden'); 
    new bootstrap.Modal(document.getElementById('modalContrato')).show(); 
}
 
window.salvarContrato = async function() { 
    const numero = document.getElementById('c-numero').value.trim(); 
    if(!numero) return alert("Informe o número do contrato."); 
    
    let cat = document.getElementById('c-categoria').value;
    if(cat === 'Itens' && itensContratoAtual.length === 0) return alert("Adicione pelo menos um item licitado à ata.");
    if(cat === 'Global' && lotesContratoAtual.length === 0) return alert("Adicione pelo menos uma categoria de frota (Lote) ao contrato.");

    document.getElementById('loading').classList.remove('hidden');

    let valTetoPecas = 0, valTetoServicos = 0, valTotalItens = 0;

    if(cat === 'Global') {
        lotesContratoAtual.forEach(lote => { valTetoPecas += lote.teto_pecas; valTetoServicos += lote.teto_servicos; });
    }

    if(cat === 'Itens') {
        for(let i = 0; i < itensContratoAtual.length; i++) {
            let it = itensContratoAtual[i];
            valTotalItens += (it.qtd_licitada * it.valor_unitario);
            if(!it.id_catalogo) {
                let novoIdCat = `ITEM-${Date.now()}-${Math.floor(Math.random()*1000)}`;
                await setDoc(doc(db, `${mod}_${tenant}_catalogo`, novoIdCat), {
                    categoria: it.categoria || 'Peças', 
                    descricao: it.descricao, 
                    aplicacao_modelos: '', 
                    valor_referencia: it.valor_unitario, 
                    garantia_meses: 0, 
                    garantia_km: 0
                });
                itensContratoAtual[i].id_catalogo = novoIdCat;
            }
        }
    }
    
    const dados = { 
        numero: numero, 
        categoria: cat, 
        fornecedor: document.getElementById('c-fornecedor').value, 
        secretaria: document.getElementById('c-secretaria').value.toUpperCase(),
        objeto: document.getElementById('c-objeto').value, 
        data_inicio: document.getElementById('c-ini').value, 
        data_fim: document.getElementById('c-fim').value, 
        
        valor_total: cat === 'Itens' ? valTotalItens : (valTetoPecas + valTetoServicos), 
        valor_teto_pecas: valTetoPecas, 
        valor_teto_servicos: valTetoServicos,
        
        itens_contrato: cat === 'Itens' ? itensContratoAtual : null, 
        lotes_contrato: cat === 'Global' ? lotesContratoAtual : null, 
        ativo: true 
    }; 
    
    let id = document.getElementById('c-id').value || `CONT-${Date.now()}`; 
    await setDoc(doc(db, `${mod}_${tenant}_contratos`, id), dados, {merge: true}); 
    
    document.getElementById('loading').classList.add('hidden');
    bootstrap.Modal.getInstance(document.getElementById('modalContrato')).hide(); 
    alert("Contrato salvo com sucesso!"); 
    window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value); 
}
 
window.deletarContrato = async function() { 
    if(confirm("Tem certeza que deseja excluir este contrato?")) { 
        await deleteDoc(doc(db, `${mod}_${tenant}_contratos`, document.getElementById('c-id').value)); 
        bootstrap.Modal.getInstance(document.getElementById('modalContrato')).hide(); 
        window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value); 
    } 
}

// ================= CATÁLOGO =================

function renderizarTabelaCatalogo(itens) {
    const tb = document.querySelector('#table-catalogo tbody'); 
    tb.innerHTML = '';
    
    if(itens.length === 0) { 
        tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhum item no catálogo.</td></tr>'; 
        return; 
    }
    
    itens.forEach(cat => {
        let badgeCat = 'bg-secondary';
        if(cat.categoria === 'Peças') badgeCat = 'bg-info text-dark';
        if(cat.categoria === 'Mão de obra' || cat.categoria === 'Serviço') badgeCat = 'bg-warning text-dark';
        if(cat.categoria === 'Pneus') badgeCat = 'bg-dark';
        if(cat.categoria === 'Bateria') badgeCat = 'bg-danger';
        
        tb.innerHTML += `
        <tr>
           <td><span class="badge ${badgeCat}">${cat.categoria}</span></td>
           <td><strong>${cat.descricao}</strong></td>
           <td>${cat.marca || '-'}</td>
           <td>${cat.garantia_meses ? cat.garantia_meses + ' meses' : '-'} / ${cat.garantia_km ? cat.garantia_km + ' km' : '-'}</td>
           <td class="fw-bold text-danger text-end">${window.formatarMoeda(cat.valor_referencia)}</td>
           <td class="adm-only"><button class="btn btn-sm btn-light text-primary" onclick='window.editarItemCatalogo(${JSON.stringify(cat)})'><i class="fas fa-edit"></i></button></td>
        </tr>`;
    });
}

window.abrirModalCatalogo = function() { 
    document.getElementById('formCatalogo').reset(); 
    document.getElementById('cat-id').value = ''; 
    document.getElementById('btn-del-catalogo').classList.add('hidden'); 
    new bootstrap.Modal(document.getElementById('modalCatalogo')).show(); 
}
 
window.editarItemCatalogo = function(cat) { 
    document.getElementById('cat-id').value = cat.id; 
    document.getElementById('cat-categoria').value = cat.categoria; 
    document.getElementById('cat-descricao').value = cat.descricao; 
    document.getElementById('cat-aplicacao').value = cat.aplicacao_modelos || ''; 
    document.getElementById('cat-marca').value = cat.marca || ''; 
    document.getElementById('cat-garantia-meses').value = cat.garantia_meses || ''; 
    document.getElementById('cat-garantia-km').value = cat.garantia_km || ''; 
    
    let elValor = document.getElementById('cat-valor-ref'); 
    elValor.value = (parseFloat(cat.valor_referencia) || 0).toFixed(2).replace(".", ""); 
    window.aplicarMascaraMonetaria(elValor); 
    
    document.getElementById('btn-del-catalogo').classList.remove('hidden'); 
    new bootstrap.Modal(document.getElementById('modalCatalogo')).show(); 
}
 
window.salvarItemCatalogo = async function() { 
    const descricao = document.getElementById('cat-descricao').value.toUpperCase().trim(); 
    if(!descricao) return alert("A descrição é obrigatória."); 
    
    let valorStr = document.getElementById('cat-valor-ref').value.replace(/[R$\s]/g, ''); 
    if (valorStr.includes(',')) valorStr = valorStr.replace(/\./g, '').replace(',', '.'); 
    
    const dados = { 
        categoria: document.getElementById('cat-categoria').value, 
        descricao: descricao, 
        aplicacao_modelos: document.getElementById('cat-aplicacao').value.toUpperCase().trim(),
        marca: document.getElementById('cat-marca').value, 
        garantia_meses: parseInt(document.getElementById('cat-garantia-meses').value) || 0, 
        garantia_km: parseInt(document.getElementById('cat-garantia-km').value) || 0, 
        valor_referencia: parseFloat(valorStr) || 0 
    }; 
    
    let id = document.getElementById('cat-id').value || `ITEM-${Date.now()}`; 
    
    await setDoc(doc(db, `${mod}_${tenant}_catalogo`, id), dados, {merge: true}); 
    bootstrap.Modal.getInstance(document.getElementById('modalCatalogo')).hide(); 
    alert("Item salvo no catálogo!"); 
    window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value); 
}
 
window.deletarItemCatalogo = async function() { 
    if(confirm("Tem certeza que deseja excluir este item do catálogo?")) { 
        await deleteDoc(doc(db, `${mod}_${tenant}_catalogo`, document.getElementById('cat-id').value)); 
        bootstrap.Modal.getInstance(document.getElementById('modalCatalogo')).hide(); 
        window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value); 
    } 
}
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBOEgd1WCElKtngAcQ-ygnx0_2lpHLUAyM",
    authDomain: "caatingasoftware.firebaseapp.com",
    projectId: "caatingasoftware",
    storageBucket: "caatingasoftware.firebasestorage.app",
    messagingSenderId: "357801806903",
    appId: "1:357801806903:web:7b03d8f9f0189bf32943b2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- BLOCO PADRÃO DE ASSINATURA FÍSICA ---
const BLOCO_ASSINATURA = `
<div style="margin-top: 60px; text-align: center; width: 100%; page-break-inside: avoid;">
    <div style="display: inline-block; width: 45%; margin-right: 2%;">
        <hr style="border: 1px solid #000; width: 80%; margin: 0 auto 5px auto;">
        <p style="font-size: 12px; margin: 0; font-weight: bold;">Assinatura do Gestor Responsável</p>
    </div>
    <div style="display: inline-block; width: 45%;">
        <hr style="border: 1px solid #000; width: 80%; margin: 0 auto 5px auto;">
        <p style="font-size: 12px; margin: 0; font-weight: bold;">Assinatura do Operador / Conferente</p>
    </div>
</div>`;

let USUARIO = null;
let tenant = "";
let DADOS_VEICULOS = [];
let DADOS_ABASTECIMENTOS = [];
let DADOS_VIAGENS = [];
let DADOS_MOTORISTAS = [];
let DADOS_POSTOS = [];
let DADOS_CONTRATOS = [];
let DADOS_DESTINACOES = new Set();

window.tempDestinacoes = [];

let modalFrentistaObj, modalLancaAdmObj, modalPrintVeicObj, modalAutorizarGestorObj, modalAditivoObj, modalLiquidarObj, modalExtratoObj;

function loading(mostrar, msg="Carregando...") { 
    document.getElementById('loading-msg').innerText = msg;
    if(mostrar) document.getElementById('loaderOverlay').classList.remove('hidden');
    else document.getElementById('loaderOverlay').classList.add('hidden');
}

window.maskMoeda = function(e) {
    let input = e.target;
    let val = input.value.replace(/\D/g, '');
    if (val === '') { input.value = ''; return; }
    val = (parseInt(val, 10) / 100).toFixed(2) + '';
    val = val.replace(".", ",");
    val = val.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    input.value = val;
}

window.maskLitros = function(e) {
    let input = e.target;
    let val = input.value.replace(/\D/g, ''); 
    if (val === '') { input.value = ''; return; }
    while (val.length < 4) { val = '0' + val; } 
    let intPart = parseInt(val.slice(0, -3), 10).toString(); 
    let decPart = val.slice(-3);
    intPart = intPart.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    input.value = intPart + ',' + decPart;
}

function formatarNumeroInput(val, decimais) {
    if(!val && val !== 0) return '';
    let str = parseFloat(val).toLocaleString('pt-BR', {minimumFractionDigits: decimais, maximumFractionDigits: decimais});
    return str;
}

function safeCurrency(val) {
    if (val === null || val === undefined || val === '') return 0;
    let s = String(val).replace(/[R$\s]/g, '').trim();
    if (s.includes(',')) {
        s = s.replace(/\./g, ''); 
        s = s.replace(',', '.');  
    } 
    let n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

function setarDataDeHoje() {
    let d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    let hoje = d.toISOString().slice(0, 10);
    if(document.getElementById('filtroDataNotasFrentista')) document.getElementById('filtroDataNotasFrentista').value = hoje;
    if(document.getElementById('filtroDataNotasGestor')) document.getElementById('filtroDataNotasGestor').value = hoje;
    if(document.getElementById('aditData')) document.getElementById('aditData').value = hoje;
    if(document.getElementById('liqMesAno')) document.getElementById('liqMesAno').value = hoje.slice(0,7);
    if(document.getElementById('cadPostoVigencia')) document.getElementById('cadPostoVigencia').value = hoje;
}

window.onload = function() {
    modalFrentistaObj = new bootstrap.Modal(document.getElementById('modalFrentista'));
    modalLancaAdmObj = new bootstrap.Modal(document.getElementById('modalLancaAdm'));
    modalPrintVeicObj = new bootstrap.Modal(document.getElementById('modalPrintVeic'));
    modalAutorizarGestorObj = new bootstrap.Modal(document.getElementById('modalAutorizarGestor'));
    modalAditivoObj = new bootstrap.Modal(document.getElementById('modalAditivoContrato'));
    modalLiquidarObj = new bootstrap.Modal(document.getElementById('modalLiquidarContrato'));
    modalExtratoObj = new bootstrap.Modal(document.getElementById('modalExtratoContrato'));
    
    setarDataDeHoje();
    
    onAuthStateChanged(auth, (userAuth) => {
        const cracha = localStorage.getItem("caatinga_user");
        if(userAuth && cracha) {
            USUARIO = JSON.parse(cracha);
            iniciarApp();
        } else {
            document.getElementById('app').classList.add('hidden');
            document.getElementById('viewLogin').classList.remove('hidden');
        }
    });
};

window.logout = function() { 
    localStorage.removeItem("caatinga_user"); 
    signOut(auth).then(() => { location.reload(); });
};

window.fazerLogin = async function() {
    const c = document.getElementById('userCpf').value.replace(/\D/g, '');
    const p = document.getElementById('userPass').value;
    const erro = document.getElementById('msgLogin'); erro.classList.add('hidden');
    
    if(!c || !p) return;
    loading(true, "Autenticando...");

    try {
        const emailFicticio = c + "@feitosa.app";
        await signInWithEmailAndPassword(auth, emailFicticio, p);
        const userSnap = await getDoc(doc(db, "usuarios", c));
        if (userSnap.exists() && userSnap.data().ativo !== false) {
            let u = userSnap.data(); u.cpf = c;
            USUARIO = u; localStorage.setItem("caatinga_user", JSON.stringify(USUARIO)); iniciarApp();
        } else { throw new Error("Usuário inativo."); }
    } catch(e) { erro.innerText = "Acesso negado: " + e.message; erro.classList.remove('hidden'); }
    loading(false);
};

function iniciarApp() {
    tenant = String(USUARIO.empresa_id || "global").toLowerCase().trim();
    let n = String(USUARIO.nivel_acesso || '').toUpperCase();
    let s = String(USUARIO.setor || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    let moduloRole = "Motorista"; 
    if(n === 'SUPER_ADM' || n === 'ADM') moduloRole = "ADM";
    else if(s.includes('GERENTE') && s.includes('POSTO')) moduloRole = "GerentePosto"; 
    else if(s.includes('POSTO') || s.includes('FRENTISTA')) moduloRole = "Frentista";
    else if(s.includes('TRANSPORTE')) moduloRole = "GestorTransporte";
    else if(s.includes('ABASTECIMENTO')) moduloRole = "GestorAbastecimento";
    else if(s.includes('RETROATIVO')) moduloRole = "LancadorRetroativo";

    USUARIO.moduloRole = moduloRole; 

    document.getElementById('viewLogin').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('txtUser').innerHTML = `<i class="fas fa-user-circle"></i> ${USUARIO.nome}`;
    document.getElementById('txtNivel').innerText = moduloRole;
    document.getElementById('txtTenant').innerText = tenant.toUpperCase();

    window.buscarTudo();
}

function rotearTelas() {
    ['viewADM','viewFrentista','viewGestorTransp','viewGestorAbast', 'viewRetroativo'].forEach(i=>document.getElementById(i).classList.add('hidden')); 
    document.getElementById('btnExtraPosto').classList.add('hidden');
    document.getElementById('navAbaFrentEmitidas').classList.add('hidden');
    document.getElementById('navAbaFrentExtras').classList.add('hidden');

    const r = USUARIO.moduloRole;
    if(r === 'ADM') { 
        document.getElementById('viewADM').classList.remove('hidden'); window.filtrarRelatorio(); 
    }
    else if(r === 'Frentista') { 
        document.getElementById('viewFrentista').classList.remove('hidden'); renderFilaPosto(); renderGestaoNotas();
    }
    else if(r === 'GerentePosto') { 
        document.getElementById('viewFrentista').classList.remove('hidden'); document.getElementById('btnExtraPosto').classList.remove('hidden');
        document.getElementById('navAbaFrentEmitidas').classList.remove('hidden'); document.getElementById('navAbaFrentExtras').classList.remove('hidden');
        renderFilaPosto(); renderGestaoNotas(); renderRelatorioExtrasPosto();
    }
    else if(r === 'GestorTransporte') { 
        document.getElementById('viewGestorTransp').classList.remove('hidden'); renderPainelTransporte(); 
    }
    else if(r === 'GestorAbastecimento') { 
        document.getElementById('viewGestorAbast').classList.remove('hidden'); renderPainelAbastecimento(); renderGestaoNotas();
    }
    else if(r === 'LancadorRetroativo') {
        document.getElementById('viewRetroativo').classList.remove('hidden'); window.renderPainelRetroativo();
    }
}

window.obterPrecoVigente = function(nomePosto, dataIsoBase) {
    let p = DADOS_POSTOS.find(x => x.nome === nomePosto);
    if(!p) return { Gasolina: 0, Diesel: 0, Etanol: 0 };
    let dBusca = dataIsoBase.slice(0, 10); 
    if(p.vigencias && p.vigencias.length > 0) {
        let vigs = [...p.vigencias].sort((a,b) => (a.data > b.data) ? -1 : 1);
        for(let v of vigs) {
            if(dBusca >= v.data) {
                return { Gasolina: safeCurrency(v.Gasolina), Diesel: safeCurrency(v.Diesel), Etanol: safeCurrency(v.Etanol) };
            }
        }
        let vOld = vigs[vigs.length-1];
        return { Gasolina: safeCurrency(vOld.Gasolina), Diesel: safeCurrency(vOld.Diesel), Etanol: safeCurrency(vOld.Etanol) };
    }
    return { Gasolina: safeCurrency(p.Gasolina), Diesel: safeCurrency(p.Etanol), Etanol: safeCurrency(p.Etanol) };
}

window.renderPainelRetroativo = function() {
    let meusLancamentos = DADOS_ABASTECIMENTOS.filter(a => a.lancamentoManual === true && a.frentistaCpf === USUARIO.cpf);
    meusLancamentos.sort((a,b) => new Date(b.dataAbastecimento) - new Date(a.dataAbastecimento));

    let h = '';
    meusLancamentos.forEach(a => {
        let dFmt = new Date(a.dataAbastecimento).toLocaleString('pt-BR').slice(0, 16);
        h += `<tr>
            <td>${dFmt}</td>
            <td class="fw-bold text-dark">${a.placa}</td>
            <td>${a.tipoCombustivel}</td>
            <td class="text-primary fw-bold">${safeCurrency(a.quantidade).toLocaleString('pt-BR', {minimumFractionDigits: 3})} L</td>
            <td>${a.nomePosto || '-'}</td>
        </tr>`;
    });
    if(document.getElementById('tbMeusRetroativos')) {
        document.getElementById('tbMeusRetroativos').innerHTML = h || '<tr><td colspan="5" class="text-muted py-4">Nenhum lançamento retroativo realizado por você.</td></tr>';
    }
}

window.buscarTudo = async function() {
    loading(true, "Lendo Banco de Dados...");
    try {
        const snapV = await getDocs(collection(db, `${tenant}_veiculos`));
        DADOS_VEICULOS = []; snapV.forEach(d => DADOS_VEICULOS.push({ id: d.id, ...d.data() }));

        const snapA = await getDocs(collection(db, `${tenant}_abastecimentos`));
        DADOS_ABASTECIMENTOS = []; snapA.forEach(d => DADOS_ABASTECIMENTOS.push({ id: d.id, ...d.data() }));

        const snapVi = await getDocs(collection(db, `${tenant}_viagens`));
        DADOS_VIAGENS = []; snapVi.forEach(d => DADOS_VIAGENS.push({ id: d.id, ...d.data() }));

        const snapMot = await getDocs(collection(db, `${tenant}_motoristas`));
        DADOS_MOTORISTAS = []; snapMot.forEach(d => DADOS_MOTORISTAS.push({ id: d.id, ...d.data() }));

        const snapPos = await getDocs(collection(db, `${tenant}_postos`));
        DADOS_POSTOS = []; snapPos.forEach(d => DADOS_POSTOS.push({ id: d.id, ...d.data() }));

        const snapCont = await getDocs(collection(db, `${tenant}_contratos`));
        DADOS_CONTRATOS = []; snapCont.forEach(d => DADOS_CONTRATOS.push({ id: d.id, ...d.data() }));

        let secs = new Set(), rotas = new Set(), postosHistorico = new Set();
        DADOS_DESTINACOES.clear();

        DADOS_VEICULOS.forEach(v => { 
            if(v.secretaria) secs.add(v.secretaria.toUpperCase()); 
            if(v.destinacao) DADOS_DESTINACOES.add(v.destinacao.toUpperCase());
        });
        DADOS_VIAGENS.forEach(v => { if(v.percurso) rotas.add(v.percurso.toUpperCase()); });
        DADOS_ABASTECIMENTOS.forEach(a => { if(a.nomePosto) postosHistorico.add(a.nomePosto.toUpperCase()); });
        DADOS_POSTOS.forEach(p => { if(p.nome) postosHistorico.add(p.nome.toUpperCase()); });
        DADOS_CONTRATOS.forEach(c => { 
            if(c.secretaria) secs.add(c.secretaria.toUpperCase()); 
            if(c.destinacao) DADOS_DESTINACOES.add(c.destinacao.toUpperCase());
        });
        
        let secHTML = '<option value="">TODAS AS SECRETARIAS</option>';
        [...secs].sort().forEach(s => secHTML += `<option value="${s}">${s}</option>`);
        if(document.getElementById('fSec')) document.getElementById('fSec').innerHTML = secHTML;
        if(document.getElementById('listaSecretarias')) document.getElementById('listaSecretarias').innerHTML = [...secs].map(s=>`<option value="${s}">`).join('');
        
        let destHTML = '<option value="">TODAS AS DESTINAÇÕES</option>';
        [...DADOS_DESTINACOES].sort().forEach(d => destHTML += `<option value="${d}">${d}</option>`);
        if(document.getElementById('fDest')) document.getElementById('fDest').innerHTML = destHTML;
        if(document.getElementById('listaDestinacoesGerais')) document.getElementById('listaDestinacoesGerais').innerHTML = [...DADOS_DESTINACOES].map(d=>`<option value="${d}">`).join('');
        
        if(document.getElementById('listaRotas')) document.getElementById('listaRotas').innerHTML = [...rotas].map(r=>`<option value="${r}">`).join('');
        if(document.getElementById('fPosto')) document.getElementById('fPosto').innerHTML = '<option value="">Todos</option>' + [...postosHistorico].sort().map(p=>`<option value="${p}">${p}</option>`).join('');

        let optPostosUnicos = '<option value="">-- Selecione o Posto --</option>';
        let optPostosComboContrato = '<option value="TODOS">Todos os Postos</option>';
        
        DADOS_POSTOS.forEach(p => { 
            optPostosUnicos += `<option value="${p.nome}">${p.nome}</option>`; 
            optPostosComboContrato += `<option value="${p.nome}">${p.nome}</option>`;
        });
        
        if(document.getElementById('inpPostoFrentista')) document.getElementById('inpPostoFrentista').innerHTML = optPostosUnicos;
        if(document.getElementById('admPostoNome')) document.getElementById('admPostoNome').innerHTML = optPostosUnicos;
        if(document.getElementById('cadContratoPosto')) document.getElementById('cadContratoPosto').innerHTML = optPostosComboContrato;
        if(document.getElementById('selPostoAvulso')) document.getElementById('selPostoAvulso').innerHTML = optPostosUnicos;
        if(document.getElementById('authGestorPosto')) document.getElementById('authGestorPosto').innerHTML = optPostosUnicos;

        let listMots = '';
        DADOS_MOTORISTAS.forEach(m => listMots += `<option value="${m.nome}">`);
        if(document.getElementById('listaNomesMotoristas')) document.getElementById('listaNomesMotoristas').innerHTML = listMots;

        let optVAvulso = '<option value="">-- Escolha o Carro Oficial --</option>';
        DADOS_VEICULOS.forEach(v => {
            if(v.status === 'Em Oficina' || v.status === 'Inservível') return;
            optVAvulso += `<option value="${v.id}">${v.id} - ${v.modelo}</option>`;
        });
        if(document.getElementById('selVeiculoRealAvulso')) document.getElementById('selVeiculoRealAvulso').innerHTML = optVAvulso;

        if(document.getElementById('filtroContratoSec')) {
            document.getElementById('filtroContratoSec').innerHTML = secHTML;
            window.atualizarFiltroDestContrato();
        }
        if(document.getElementById('filtroContratoPosto')) document.getElementById('filtroContratoPosto').innerHTML = '<option value="">TODOS OS POSTOS</option>' + [...postosHistorico].sort().map(p=>`<option value="${p}">${p}</option>`).join('');

        renderTabVeiculos();
        renderAnaliseFrota();
        renderAuditoria();
        renderMotoristas();
        renderPostos();
        renderContratos();
        rotearTelas();
    } catch(e) { console.error(e); alert("Erro ao carregar dados. Verifique a conexão com o banco."); }
    loading(false);
}

window.validarContratoRigido = function(sec, dest, comb, posto) {
    if(!sec) return null; 
    let d = dest || 'GERAL';
    
    let contratos = DADOS_CONTRATOS.filter(c => c.secretaria.toUpperCase() === sec.toUpperCase() && (c.destinacao || 'GERAL').toUpperCase() === d.toUpperCase());
    if(contratos.length === 0) return `BLOQUEADO: A Secretaria ${sec} (${d}) não possui nenhum contrato/centro de custo cadastrado.`;

    let dHoje = new Date().toISOString().slice(0, 10);
    let temValido = false;

    for(let c of contratos) {
        let isVigente = c.validade && c.validade >= dHoje;
        let isPosto = !c.posto || c.posto === "TODOS" || String(c.posto).toUpperCase() === String(posto).toUpperCase();

        let isComb = false;
        if (comb === 'Gasolina' && c.gasolina && c.gasolina.litros > 0) isComb = true;
        if (comb === 'Diesel' && c.diesel && c.diesel.litros > 0) isComb = true;
        if (comb === 'Etanol' && c.etanol && c.etanol.litros > 0) isComb = true;

        if(isVigente && isPosto && isComb) {
            temValido = true; break;
        }
    }

    if(!temValido) return `BLOQUEADO: A Secretaria ${sec} (${d}) está com o contrato VENCIDO ou não possui licitação ativa para ${comb} no posto ${posto}.`;
    return null;
}

// --- ABA DE CONTRATOS ---
window.atualizarFiltroDestContrato = function() {
    let sec = document.getElementById('filtroContratoSec').value.toUpperCase();
    let dests = DADOS_CONTRATOS.filter(c => !sec || c.secretaria.toUpperCase() === sec).map(c => c.destinacao || 'GERAL');
    
    let unicos = [...new Set(dests)].sort();
    let html = '<option value="">TODAS AS DESTINAÇÕES</option>';
    unicos.forEach(d => html += `<option value="${d}">${d}</option>`);
    document.getElementById('filtroContratoDest').innerHTML = html;
}

window.adicionarDestinacaoTemp = function() {
    let dest = document.getElementById('cadContratoDest').value.toUpperCase().trim() || 'GERAL';
    let gL = safeCurrency(document.getElementById('cadGasL').value);
    let gV = safeCurrency(document.getElementById('cadGasV').value);
    let dL = safeCurrency(document.getElementById('cadDieL').value);
    let dV = safeCurrency(document.getElementById('cadDieV').value);
    let eL = safeCurrency(document.getElementById('cadEtaL').value);
    let eV = safeCurrency(document.getElementById('cadEtaV').value);

    let subtotal = (gL * gV) + (dL * dV) + (eL * eV);

    if(subtotal === 0) return alert("A divisão precisa ter pelo menos um combustível com quantidade e preço.");

    let idx = window.tempDestinacoes.findIndex(x => x.destinacao === dest);
    if(idx >= 0) return alert(`A divisão "${dest}" já está na lista. Remova-a antes de adicionar novamente se quiser alterar os valores.`);

    window.tempDestinacoes.push({
        idDoc: "CONT-" + Date.now() + Math.floor(Math.random()*100000),
        destinacao: dest,
        gasolina: { litros: gL, precoLicitado: gV },
        diesel: { litros: dL, precoLicitado: dV },
        etanol: { litros: eL, precoLicitado: eV },
        valorInicial: subtotal
    });

    document.getElementById('cadContratoDest').value = '';
    document.getElementById('cadGasL').value = ''; document.getElementById('cadGasV').value = '';
    document.getElementById('cadDieL').value = ''; document.getElementById('cadDieV').value = '';
    document.getElementById('cadEtaL').value = ''; document.getElementById('cadEtaV').value = '';

    window.renderTempDest();
}

window.removerDestTemp = function(index) {
    window.tempDestinacoes.splice(index, 1);
    window.renderTempDest();
}

window.renderTempDest = function() {
    let h = '';
    let totalGeral = 0;
    if(window.tempDestinacoes.length === 0) {
        h = '<tr><td colspan="6" class="text-muted small py-3">Nenhuma divisão adicionada. Preencha os dados acima e clique em "INSERIR NA LISTA".</td></tr>';
    } else {
        window.tempDestinacoes.forEach((item, idx) => {
            totalGeral += item.valorInicial;
            let txtG = item.gasolina.litros > 0 ? `${item.gasolina.litros} L (R$ ${item.gasolina.precoLicitado})` : '-';
            let txtD = item.diesel.litros > 0 ? `${item.diesel.litros} L (R$ ${item.diesel.precoLicitado})` : '-';
            let txtE = item.etanol.litros > 0 ? `${item.etanol.litros} L (R$ ${item.etanol.precoLicitado})` : '-';

            h += `<tr>
                <td class="fw-bold text-primary">${item.destinacao}</td>
                <td class="small text-danger">${txtG}</td>
                <td class="small text-dark">${txtD}</td>
                <td class="small text-success">${txtE}</td>
                <td class="fw-bold text-dark">R$ ${item.valorInicial.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td><button class="btn btn-sm text-danger" title="Remover da lista" onclick="window.removerDestTemp(${idx})"><i class="fas fa-times"></i></button></td>
            </tr>`;
        });
    }
    document.getElementById('tbTempDestinacoes').innerHTML = h;
    document.getElementById('lblTotalCont').innerText = "R$ " + totalGeral.toLocaleString('pt-BR', {minimumFractionDigits:2});
}

window.salvarContratoLote = async function() {
    const sec = document.getElementById('cadContratoSec').value.toUpperCase().trim();
    const num = document.getElementById('cadContratoNum').value.trim();
    const posto = document.getElementById('cadContratoPosto').value;
    const validade = document.getElementById('cadContratoValidade').value;
    const editId = document.getElementById('hdnIdContrato').value; 

    if(!sec) return alert("A Secretaria Macro é obrigatória no cabeçalho.");
    if(!validade) return alert("A Data de Validade é obrigatória.");

    loading(true, "Gravando Banco...");
    try {
        if(editId) {
            let dest = document.getElementById('cadContratoDest').value.toUpperCase().trim() || 'GERAL';
            let gL = safeCurrency(document.getElementById('cadGasL').value); let gV = safeCurrency(document.getElementById('cadGasV').value);
            let dL = safeCurrency(document.getElementById('cadDieL').value); let dV = safeCurrency(document.getElementById('cadDieV').value);
            let eL = safeCurrency(document.getElementById('cadEtaL').value); let eV = safeCurrency(document.getElementById('cadEtaV').value);
            let subtotal = (gL * gV) + (dL * dV) + (eL * eV);

            let payload = {
                secretaria: sec, destinacao: dest, numero: num, posto: posto, validade: validade,
                gasolina: { litros: gL, precoLicitado: gV }, diesel: { litros: dL, precoLicitado: dV }, etanol: { litros: eL, precoLicitado: eV },
                valorInicial: subtotal
            };
            await setDoc(doc(db, `${tenant}_contratos`, editId), payload, {merge: true});
        } else {
            if(window.tempDestinacoes.length === 0) { loading(false); return alert("Adicione pelo menos uma Divisão/Destinação na lista antes de salvar."); }
            
            for (let item of window.tempDestinacoes) {
                let payload = {
                    secretaria: sec, destinacao: item.destinacao, numero: num, posto: posto, validade: validade,
                    gasolina: item.gasolina, diesel: item.diesel, etanol: item.etanol,
                    valorInicial: item.valorInicial, aditivos: [], liquidados: []
                };
                await setDoc(doc(db, `${tenant}_contratos`, item.idDoc), payload, {merge: true});
            }
        }

        window.cancelarEdicaoContrato();
        await window.buscarTudo();
    } catch(e) { console.error(e); alert("Erro: " + e.message); loading(false); }
}

window.cancelarEdicaoContrato = function() {
    document.getElementById('cadContratoSec').value = ''; 
    document.getElementById('cadContratoNum').value = '';
    document.getElementById('cadContratoPosto').value = 'TODOS'; 
    document.getElementById('cadContratoValidade').value = '';
    document.getElementById('hdnIdContrato').value = '';
    
    document.getElementById('cadContratoDest').value = '';
    document.getElementById('cadGasL').value = ''; document.getElementById('cadGasV').value = '';
    document.getElementById('cadDieL').value = ''; document.getElementById('cadDieV').value = '';
    document.getElementById('cadEtaL').value = ''; document.getElementById('cadEtaV').value = '';
    
    document.getElementById('boxAddListaContrato').classList.remove('hidden');
    document.getElementById('boxTabelaContratoTemp').classList.remove('hidden');

    window.tempDestinacoes = [];
    window.renderTempDest();

    document.getElementById('btnSaveContrato').innerHTML = '<i class="fas fa-save"></i> SALVAR CONTRATO COMPLETO';
    document.getElementById('btnCancelContrato').classList.add('hidden');
}

window.editarContrato = function(id) {
    let c = DADOS_CONTRATOS.find(x => x.id === id);
    if(!c) return;

    document.getElementById('cadContratoSec').value = c.secretaria || '';
    document.getElementById('cadContratoNum').value = c.numero || '';
    document.getElementById('cadContratoPosto').value = c.posto || 'TODOS';
    document.getElementById('cadContratoValidade').value = c.validade || '';
    document.getElementById('hdnIdContrato').value = c.id;

    document.getElementById('cadContratoDest').value = c.destinacao || 'GERAL';
    document.getElementById('cadGasL').value = formatarNumeroInput(c.gasolina?.litros, 3);
    document.getElementById('cadGasV').value = formatarNumeroInput(c.gasolina?.precoLicitado, 2);
    document.getElementById('cadDieL').value = formatarNumeroInput(c.diesel?.litros, 3);
    document.getElementById('cadDieV').value = formatarNumeroInput(c.diesel?.precoLicitado, 2);
    document.getElementById('cadEtaL').value = formatarNumeroInput(c.etanol?.litros, 3);
    document.getElementById('cadEtaV').value = formatarNumeroInput(c.etanol?.precoLicitado, 2);

    document.getElementById('boxAddListaContrato').classList.add('hidden');
    document.getElementById('boxTabelaContratoTemp').classList.add('hidden');

    document.getElementById('btnSaveContrato').innerHTML = '<i class="fas fa-save"></i> SALVAR ALTERAÇÃO DO LOTE';
    document.getElementById('btnCancelContrato').classList.remove('hidden');
    window.scrollTo(0, 0);
}

window.abrirModalAditivo = function(id) {
    let c = DADOS_CONTRATOS.find(x => x.id === id);
    if(!c) return;
    document.getElementById('aditContratoId').value = id;
    document.getElementById('lblSecAditivo').innerText = c.secretaria + " / " + (c.destinacao || 'GERAL');
    document.getElementById('aditTipo').value = 'Aditivo Padrão (Volume/Prazo)';
    document.getElementById('aditComb').value = 'Gasolina';
    document.getElementById('aditLitros').value = '';
    document.getElementById('aditValor').value = '';
    document.getElementById('aditObs').value = '';
    modalAditivoObj.show();
}

window.salvarAditivo = async function() {
    const id = document.getElementById('aditContratoId').value;
    const tipo = document.getElementById('aditTipo').value;
    const comb = document.getElementById('aditComb').value;
    const dt = document.getElementById('aditData').value;
    const litros = safeCurrency(document.getElementById('aditLitros').value);
    const valor = safeCurrency(document.getElementById('aditValor').value);
    const obs = document.getElementById('aditObs').value.trim();
    
    if(!id || (litros === 0 && valor === 0)) return alert("Preencha litros ou valor para a operação.");
    loading(true, "Registrando Operação...");
    try {
        let c = DADOS_CONTRATOS.find(x => x.id === id);
        let ads = c.aditivos || [];
        ads.push({ id: Date.now().toString(), data: dt, tipo: tipo, combustivel: comb, litros: litros, valor: valor, justificativa: obs });
        await setDoc(doc(db, `${tenant}_contratos`, id), { aditivos: ads }, {merge:true});
        modalAditivoObj.hide(); await window.buscarTudo();
    } catch(e) { console.error(e); alert("Erro: " + e.message); loading(false); }
}

window.abrirModalLiquidar = function(id) {
    let c = DADOS_CONTRATOS.find(x => x.id === id);
    if(!c) return;
    document.getElementById('liqContratoId').value = id;
    document.getElementById('lblSecLiq').innerText = c.secretaria + " / " + (c.destinacao || 'GERAL');
    document.getElementById('liqValor').value = '';
    modalLiquidarObj.show();
}

window.salvarLiquidacao = async function() {
    const id = document.getElementById('liqContratoId').value;
    const mes = document.getElementById('liqMesAno').value;
    const valor = safeCurrency(document.getElementById('liqValor').value);
    
    if(!id || !mes || valor <= 0) return alert("Preencha o Mês e o Valor pago corretamente.");
    loading(true, "Registrando Pagamento...");
    try {
        let c = DADOS_CONTRATOS.find(x => x.id === id);
        let liqs = c.liquidados || [];
        liqs.push({ id: Date.now().toString(), mes: mes, valor: valor });
        await setDoc(doc(db, `${tenant}_contratos`, id), { liquidados: liqs }, {merge:true});
        modalLiquidarObj.hide(); await window.buscarTudo();
    } catch(e) { console.error(e); alert("Erro: " + e.message); loading(false); }
}

window.abrirModalExtrato = function(id) {
    let c = DADOS_CONTRATOS.find(x => x.id === id);
    if(!c) return;
    document.getElementById('lblSecExtrato').innerText = "Sec: " + c.secretaria + " | Dest.: " + (c.destinacao || 'GERAL');
    
    let hAdit = '';
    if(c.aditivos && c.aditivos.length > 0) {
        c.aditivos.forEach(ad => {
            let dFmt = ad.data ? ad.data.split('-').reverse().join('/') : '-';
            hAdit += `<tr>
                <td>${dFmt}</td>
                <td><small class="fw-bold">${ad.tipo || 'Aditivo'}</small></td>
                <td><span class="badge bg-secondary">${ad.combustivel || 'Geral'}</span></td>
                <td><small class="text-muted">${ad.justificativa || '-'}</small></td>
                <td class="text-primary fw-bold">+${safeCurrency(ad.litros).toFixed(3)} L</td>
                <td class="text-success fw-bold">+R$ ${safeCurrency(ad.valor).toFixed(2)}</td>
            </tr>`;
        });
    } else {
        hAdit = '<tr><td colspan="6" class="text-muted">Nenhum aditivo ou realinhamento registrado.</td></tr>';
    }
    document.getElementById('tbExtratoAditivos').innerHTML = hAdit;

    let hLiq = '';
    if(c.liquidados && c.liquidados.length > 0) {
        let liqsSort = c.liquidados.sort((a,b) => (a.mes > b.mes) ? 1 : -1);
        liqsSort.forEach(l => {
            let mFmt = l.mes ? l.mes.split('-').reverse().join('/') : '-';
            hLiq += `<tr>
                <td class="fw-bold">${mFmt}</td>
                <td class="text-success fw-bold">R$ ${safeCurrency(l.valor).toFixed(2)}</td>
            </tr>`;
        });
    } else {
        hLiq = '<tr><td colspan="2" class="text-muted">Nenhum pagamento registrado.</td></tr>';
    }
    document.getElementById('tbExtratoPagamentos').innerHTML = hLiq;
    
    modalExtratoObj.show();
}

window.imprimirExtrato = function() {
    let titulo = document.getElementById('lblSecExtrato').innerText;
    let tabAditivos = document.getElementById('tbExtratoAditivos').parentElement.outerHTML;
    let tabPagamentos = document.getElementById('tbExtratoPagamentos').parentElement.outerHTML;

    let html = `
        <h3 style="text-align:center; margin-bottom: 20px;">EXTRATO DE MOVIMENTAÇÕES</h3>
        <h4 style="text-align:center; color:#555; margin-bottom: 30px;">${titulo}</h4>
        
        <h5 style="margin-top:20px; color:#0d6efd; font-family: sans-serif;">Aditivos e Realinhamentos de Preço</h5>
        ${tabAditivos}
        
        <h5 style="margin-top:30px; color:#198754; font-family: sans-serif;">Histórico de Pagamentos (Liquidados)</h5>
        ${tabPagamentos}
    `;

    let win = window.open('', '_blank', 'width=900,height=600');
    win.document.write(`
        <html><head><title>Imprimir Extrato</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; text-align: center; }
            th, td { border: 1px solid #ddd; padding: 8px; }
            th { background-color: #f8f9fa; color: #000; }
            .text-success { color: green; }
            .text-primary { color: blue; }
            .text-muted { color: gray; }
            .badge { border: 1px solid #ccc; padding: 3px 6px; border-radius: 4px; font-size: 11px; }
        </style>
        </head><body>${html} ${BLOCO_ASSINATURA}
        <script>setTimeout(() => { window.print(); window.close(); }, 500);<\/script>
        </body></html>
    `);
    win.document.close();
}

window.excluirContrato = async function(id) {
    if(!confirm("Excluir este centro de custo permanentemente? (Isso NÃO apaga os abastecimentos, apenas o controle do teto).")) return;
    loading(true);
    try { await deleteDoc(doc(db, `${tenant}_contratos`, id)); await window.buscarTudo(); } 
    catch(e) { console.error(e); alert("Erro: " + e.message); loading(false); }
}

window.calcularTotaisContrato = function(c) {
    let litrosGasTotal = c.gasolina ? safeCurrency(c.gasolina.litros) : 0;
    let litrosDieTotal = c.diesel ? safeCurrency(c.diesel.litros) : 0;
    let litrosEtaTotal = c.etanol ? safeCurrency(c.etanol.litros) : 0;
    let totalValorContrato = safeCurrency(c.valorInicial);

    if(c.aditivos) {
        c.aditivos.forEach(ad => { 
            if(ad.combustivel === 'Gasolina') litrosGasTotal += safeCurrency(ad.litros);
            if(ad.combustivel === 'Diesel') litrosDieTotal += safeCurrency(ad.litros);
            if(ad.combustivel === 'Etanol') litrosEtaTotal += safeCurrency(ad.litros);
            totalValorContrato += safeCurrency(ad.valor); 
        });
    }

    let litrosGasGasto = 0; let litrosDieGasto = 0; let litrosEtaGasto = 0;
    let valorGasto = 0;
    
    DADOS_ABASTECIMENTOS.forEach(a => {
        if(a.status !== 'Concluído') return;
        
        let aSec = a.secretaria; 
        let aDest = a.destinacao || 'GERAL';
        
        if(!aSec) {
            let v = DADOS_VEICULOS.find(x => x.id === a.placa);
            aSec = v ? v.secretaria : null;
            if(!a.destinacao && v) aDest = v.destinacao || 'GERAL';
        }
        
        let checkSec = aSec && aSec.toUpperCase() === c.secretaria.toUpperCase();
        let checkDest = aDest.toUpperCase() === (c.destinacao || 'GERAL').toUpperCase();
        let checkPosto = (!c.posto || c.posto === "TODOS" || String(a.nomePosto).toUpperCase() === String(c.posto).toUpperCase());
        
        if(checkSec && checkDest && checkPosto) {
            if(a.tipoCombustivel === 'Gasolina' && litrosGasTotal > 0) { litrosGasGasto += safeCurrency(a.quantidade); valorGasto += safeCurrency(a.valorTotal); }
            if(a.tipoCombustivel === 'Diesel' && litrosDieTotal > 0) { litrosDieGasto += safeCurrency(a.quantidade); valorGasto += safeCurrency(a.valorTotal); }
            if(a.tipoCombustivel === 'Etanol' && litrosEtaTotal > 0) { litrosEtaGasto += safeCurrency(a.quantidade); valorGasto += safeCurrency(a.valorTotal); }
        }
    });

    let valorLiquidado = 0;
    if(c.liquidados) { c.liquidados.forEach(l => { valorLiquidado += safeCurrency(l.valor); }); }

    let saldoValor = totalValorContrato - valorGasto;
    let saldoPendentePgto = valorGasto - valorLiquidado;

    return {
        litrosGasTotal, litrosDieTotal, litrosEtaTotal, totalValorContrato,
        litrosGasGasto, litrosDieGasto, litrosEtaGasto, valorGasto,
        valorLiquidado, saldoValor, saldoPendentePgto
    };
}

function renderContratos() {
    let fSec = document.getElementById('filtroContratoSec') ? document.getElementById('filtroContratoSec').value.toUpperCase() : '';
    let fDest = document.getElementById('filtroContratoDest') ? document.getElementById('filtroContratoDest').value.toUpperCase() : '';
    let fPosto = document.getElementById('filtroContratoPosto') ? document.getElementById('filtroContratoPosto').value.toUpperCase() : '';

    let contratosOrdenados = [...DADOS_CONTRATOS].sort((a,b) => {
        let sA = a.secretaria.toUpperCase(); let sB = b.secretaria.toUpperCase();
        if(sA < sB) return -1; if(sA > sB) return 1;
        let dA = (a.destinacao || 'GERAL').toUpperCase(); let dB = (b.destinacao || 'GERAL').toUpperCase();
        if(dA < dB) return -1; if(dA > dB) return 1;
        return 0;
    });

    let h = '';
    let dHoje = new Date().toISOString().slice(0, 10);

    contratosOrdenados.forEach(c => {
        if(fSec && c.secretaria.toUpperCase() !== fSec) return;
        if(fDest && (c.destinacao || 'GERAL').toUpperCase() !== fDest) return;
        if(fPosto && c.posto && c.posto !== "TODOS" && c.posto.toUpperCase() !== fPosto) return;

        let totais = window.calcularTotaisContrato(c);

        let corSaldoV = totais.saldoValor < 0 ? 'text-danger' : 'text-success';
        
        let statusValidade = (c.validade && c.validade < dHoje)
            ? `<span class="badge bg-danger shadow-sm"><i class="fas fa-exclamation-triangle"></i> VENCIDO</span>`
            : `<span class="badge bg-success shadow-sm"><i class="fas fa-calendar-check"></i> Até ${c.validade ? c.validade.split('-').reverse().join('/') : '-'}</span>`;

        let badgePosto = c.posto && c.posto !== "TODOS" ? `<span class="badge bg-dark me-1 mb-1"><i class="fas fa-gas-pump"></i> ${c.posto}</span>` : `<span class="badge bg-secondary me-1 mb-1">Todos Postos</span>`;

        let htmlCombustiveis = '';
        
        const formataLitro = (valor) => valor.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3});
        const formataMoeda = (valor) => valor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        if(totais.litrosGasTotal > 0) {
            let saldoG = totais.litrosGasTotal - totais.litrosGasGasto;
            let cG = saldoG < 0 ? 'text-danger' : 'text-primary';
            htmlCombustiveis += `<div class="linha-comb d-flex justify-content-between"><span><i class="fas fa-tint text-danger"></i> Gasolina</span> <b><span class="${cG}">${formataLitro(saldoG)} L</span> <small class="text-muted">/ ${formataLitro(totais.litrosGasTotal)} L</small></b></div>`;
        }
        if(totais.litrosDieTotal > 0) {
            let saldoD = totais.litrosDieTotal - totais.litrosDieGasto;
            let cD = saldoD < 0 ? 'text-danger' : 'text-dark';
            htmlCombustiveis += `<div class="linha-comb d-flex justify-content-between"><span><i class="fas fa-tint text-dark"></i> Diesel</span> <b><span class="${cD}">${formataLitro(saldoD)} L</span> <small class="text-muted">/ ${formataLitro(totais.litrosDieTotal)} L</small></b></div>`;
        }
        if(totais.litrosEtaTotal > 0) {
            let saldoE = totais.litrosEtaTotal - totais.litrosEtaGasto;
            let cE = saldoE < 0 ? 'text-danger' : 'text-success';
            htmlCombustiveis += `<div class="linha-comb d-flex justify-content-between"><span><i class="fas fa-tint text-success"></i> Etanol</span> <b><span class="${cE}">${formataLitro(saldoE)} L</span> <small class="text-muted">/ ${formataLitro(totais.litrosEtaTotal)} L</small></b></div>`;
        }

        h += `
        <div class="col-md-6 col-lg-4">
            <div class="card p-3 shadow-sm contract-box h-100 position-relative">
                <button class="btn btn-sm text-danger position-absolute top-0 end-0 m-2" onclick="window.excluirContrato('${c.id}')" title="Excluir Contrato"><i class="fas fa-trash"></i></button>
                
                <h5 class="fw-bold mb-0 text-dark">${c.secretaria}</h5>
                <div class="fw-bold text-primary mb-1"><i class="fas fa-bullseye"></i> ${c.destinacao || 'GERAL'}</div>
                <small class="text-muted d-block mb-2">Contrato Nº ${c.numero || "S/N"} | ${statusValidade}</small>
                <div class="mb-2">${badgePosto}</div>
                
                <div class="bg-light p-2 rounded border mb-2">
                    <div class="small text-muted fw-bold mb-1">SALDO DE VOLUME (LITROS):</div>
                    ${htmlCombustiveis}
                </div>

                <div class="bg-white p-2 rounded border mb-2">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="small fw-bold text-muted">Teto Financeiro (R$):</span>
                        <span class="small fw-bold text-dark">R$ ${formataMoeda(totais.totalValorContrato)}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-1">
                        <span class="small fw-bold text-muted">Total Consumido (R$):</span>
                        <span class="small fw-bold text-danger">R$ ${formataMoeda(totais.valorGasto)}</span>
                    </div>
                    <hr class="my-1">
                    <div class="d-flex justify-content-between">
                        <span class="small fw-bold text-muted">SALDO RESTANTE (R$):</span>
                        <span class="small fw-bold ${corSaldoV}">R$ ${formataMoeda(totais.saldoValor)}</span>
                    </div>
                </div>

                <div class="p-2 border rounded border-success mb-3 bg-white">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="small fw-bold text-success">Pago (Liquidado):</span>
                        <span class="small fw-bold text-success">R$ ${formataMoeda(totais.valorLiquidado)}</span>
                    </div>
                    <div class="d-flex justify-content-between">
                        <span class="small fw-bold text-danger">Saldo Devedor:</span>
                        <span class="small fw-bold text-danger">R$ ${formataMoeda(totais.saldoPendentePgto)}</span>
                    </div>
                </div>
                
                <div class="d-flex gap-1 mt-auto flex-wrap">
                    <button onclick="window.editarContrato('${c.id}')" class="btn btn-outline-dark btn-sm flex-fill fw-bold px-1" title="Editar Limites do Lote"><i class="fas fa-edit"></i> Editar</button>
                    <button onclick="window.abrirModalAditivo('${c.id}')" class="btn btn-outline-primary btn-sm flex-fill fw-bold px-1" title="Aditivo ou Realinhamento"><i class="fas fa-plus"></i> Op</button>
                    <button onclick="window.abrirModalLiquidar('${c.id}')" class="btn btn-outline-success btn-sm flex-fill fw-bold px-1" title="Informar Pagamento"><i class="fas fa-check"></i> Pago</button>
                    <button onclick="window.abrirModalExtrato('${c.id}')" class="btn btn-secondary btn-sm flex-fill fw-bold px-1" title="Ver Histórico"><i class="fas fa-list"></i> Extrato</button>
                </div>
            </div>
        </div>`;
    });
    document.getElementById('listaContratosCards').innerHTML = h || '<div class="col-12"><div class="alert alert-light border text-center text-muted py-4">Nenhum contrato cadastrado ou encontrado no filtro.</div></div>';
}

window.imprimirRelatorioContratos = function() {
    let fSec = document.getElementById('filtroContratoSec') ? document.getElementById('filtroContratoSec').value.toUpperCase() : '';
    let fDest = document.getElementById('filtroContratoDest') ? document.getElementById('filtroContratoDest').value.toUpperCase() : '';
    let fPosto = document.getElementById('filtroContratoPosto') ? document.getElementById('filtroContratoPosto').value.toUpperCase() : '';

    let txtSec = fSec ? fSec : "TODAS AS SECRETARIAS";
    let txtDest = fDest ? fDest : "TODAS AS DESTINAÇÕES";
    let txtPosto = fPosto ? fPosto : "TODOS OS POSTOS";

    let htmlTable = `<table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 12px; margin-top: 15px;" border="1">
        <thead style="background-color: #f2f2f2;">
            <tr>
                <th style="padding: 8px;">Secretaria / Destinação</th>
                <th style="padding: 8px;">Posto Vencedor</th>
                <th style="padding: 8px;">Teto Fincanceiro</th>
                <th style="padding: 8px;">Consumido (R$)</th>
                <th style="padding: 8px;">Saldo Restante</th>
                <th style="padding: 8px;">Pago / Liquidado</th>
                <th style="padding: 8px;">Saldo Devedor</th>
            </tr>
        </thead><tbody>`;

    let totalTeto = 0, totalConsumo = 0, totalSaldo = 0, totalPago = 0, totalDevedor = 0;
    let temContrato = false;

    DADOS_CONTRATOS.forEach(c => {
        if(fSec && c.secretaria.toUpperCase() !== fSec) return;
        if(fDest && (c.destinacao || 'GERAL').toUpperCase() !== fDest) return;
        if(fPosto && c.posto && c.posto !== "TODOS" && c.posto.toUpperCase() !== fPosto) return;

        temContrato = true;
        let totais = window.calcularTotaisContrato(c);

        totalTeto += totais.totalValorContrato;
        totalConsumo += totais.valorGasto;
        totalSaldo += totais.saldoValor;
        totalPago += totais.valorLiquidado;
        totalDevedor += totais.saldoPendentePgto;

        htmlTable += `<tr>
            <td style="padding: 8px; text-align:left;"><b>${c.secretaria}</b><br><span style="color:#0d6efd; font-size:10px;">${c.destinacao || 'GERAL'}</span></td>
            <td style="padding: 8px;">${c.posto || 'Todos'}</td>
            <td style="padding: 8px; color: blue;">R$ ${totais.totalValorContrato.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="padding: 8px; color: red;">R$ ${totais.valorGasto.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="padding: 8px; font-weight:bold;">R$ ${totais.saldoValor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="padding: 8px; color: green;">R$ ${totais.valorLiquidado.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="padding: 8px; color: darkred; font-weight:bold;">R$ ${totais.saldoPendentePgto.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        </tr>`;
    });

    if(!temContrato) {
        htmlTable += `<tr><td colspan="7" style="padding:15px; color:#666;">Nenhum contrato encontrado com os filtros atuais.</td></tr>`;
    } else {
        htmlTable += `<tr style="background-color: #ddd; font-weight: bold; font-size: 13px;">
            <td colspan="2" style="padding: 10px; text-align: right;">TOTAIS GERAIS:</td>
            <td style="padding: 10px; color: blue;">R$ ${totalTeto.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="padding: 10px; color: red;">R$ ${totalConsumo.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="padding: 10px;">R$ ${totalSaldo.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="padding: 10px; color: green;">R$ ${totalPago.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="padding: 10px; color: darkred;">R$ ${totalDevedor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        </tr>`;
    }

    htmlTable += `</tbody></table>`;

    let win = window.open('', '_blank', 'width=1000,height=600');
    win.document.write(`
        <html><head><title>Relatório de Contratos e Saldos</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 25px; }
            h3 { text-align: center; text-transform: uppercase; margin-bottom: 5px; color: #333; }
            .filtros { text-align: center; font-size: 12px; color: #666; margin-bottom: 20px; }
        </style>
        </head><body>
            <h3>RELATÓRIO GERENCIAL DE CONTRATOS E SALDOS</h3>
            <div class="filtros"><b>Filtros Aplicados</b> &mdash; Sec: ${txtSec} | Dest: ${txtDest} | Posto: ${txtPosto}</div>
            ${htmlTable}
            ${BLOCO_ASSINATURA}
            <script>setTimeout(() => { window.print(); window.close(); }, 500);<\/script>
        </body></html>
    `);
    win.document.close();
}

// --- VEÍCULOS ---
window.atualizarDestinacoesVeiculo = function(valorAtual = '') {
    let secEscolhida = document.getElementById('vSec').value.toUpperCase();
    let destsDaSec = DADOS_CONTRATOS.filter(c => c.secretaria.toUpperCase() === secEscolhida).map(c => c.destinacao || 'GERAL');
    
    let unicos = [...new Set(destsDaSec)];
    
    let html = '<option value="">-- Selecione a Divisão --</option>';
    if(unicos.length === 0) {
        html += '<option value="GERAL">GERAL</option>';
    } else {
        unicos.forEach(d => html += `<option value="${d}">${d}</option>`);
    }
    
    let sel = document.getElementById('vDest');
    sel.innerHTML = html;
    if(valorAtual && unicos.includes(valorAtual)) {
        sel.value = valorAtual;
    } else if (unicos.length === 1) {
        sel.value = unicos[0];
    }
}

function renderTabVeiculos() {
  let h = '';
  let fBusca = document.getElementById('fBuscaVeic') ? document.getElementById('fBuscaVeic').value.toUpperCase() : '';

  DADOS_VEICULOS.forEach(v => {
     let textoBusca = `${v.id} ${v.modelo || ''} ${v.secretaria || ''} ${v.destinacao || ''}`.toUpperCase();
     if (fBusca && !textoBusca.includes(fBusca)) return; 
     
     let jV = encodeURIComponent(JSON.stringify(v));
     let tipoStr = v.tipoFrota === 'Máquina' ? '<i class="fas fa-tractor text-warning"></i> Máquina' : '<i class="fas fa-car text-primary"></i> Veículo';
     let origemStr = v.origem || 'Próprio';
     let badgeOrigem = origemStr === 'Locado' ? '<span class="badge bg-info text-dark"><i class="fas fa-handshake"></i> Locado</span>' : '<span class="badge bg-secondary">Próprio</span>';

     let destStr = v.destinacao ? ` / ${v.destinacao}` : '';

     h += `<tr>
        <td class="fw-bold text-uppercase">${v.id}</td>
        <td>${badgeOrigem}</td>
        <td>${tipoStr}<br><small class="text-muted">${v.modelo}</small></td>
        <td><span class="fw-bold">${v.secretaria}</span><br><small class="text-primary fw-bold">${destStr}</small></td>
        <td class="fw-bold text-success">${v.odometro ? v.odometro.toFixed(1) : 0}</td>
        <td class="text-end text-nowrap">
            <button class="btn btn-sm btn-outline-primary" onclick="window.prepararEdicaoVeic('${jV}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-outline-danger ms-1" onclick="window.excluirVeic('${v.id}')"><i class="fas fa-trash"></i></button>
        </td>
     </tr>`;
  });
  if(document.getElementById('listaVeic')) document.getElementById('listaVeic').innerHTML = h || '<tr><td colspan="6" class="text-muted py-4 text-center">Nenhum equipamento encontrado.</td></tr>';
}

window.prepararEdicaoVeic = function(str) {
  const v = JSON.parse(decodeURIComponent(str)); 
  document.getElementById('hdnOldPlaca').value = v.id; 
  document.getElementById('vTipo').value = v.tipoFrota || 'Veículo';
  document.getElementById('vOrigem').value = v.origem || 'Próprio';
  document.getElementById('vPlaca').value = v.id; 
  document.getElementById('vPlaca').readOnly = true;
  document.getElementById('vModelo').value = v.modelo || ''; 
  document.getElementById('vSec').value = v.secretaria || '';
  
  window.atualizarDestinacoesVeiculo(v.destinacao || 'GERAL');

  document.getElementById('vComb').value = v.combustivel || 'Gasolina';
  document.getElementById('vMedia').value = formatarNumeroInput(v.media, 2);
  
  document.getElementById('vOdoInicial').value = v.odometroInicial !== undefined ? formatarNumeroInput(v.odometroInicial, 1) : '';
  document.getElementById('vOdoAtual').value = v.odometro ? v.odometro.toFixed(1) : 0;
  
  document.getElementById('btnSaveVeic').innerHTML = '<i class="fas fa-save"></i> SALVAR ALTERAÇÃO';
  document.getElementById('btnCancelVeic').classList.remove('hidden'); 
  window.scrollTo(0, 0);
}

window.cancelarEdicaoVeic = function() {
  document.getElementById('hdnOldPlaca').value = ''; 
  document.getElementById('vTipo').value = 'Veículo'; 
  document.getElementById('vOrigem').value = 'Próprio';
  document.getElementById('vPlaca').value = ''; 
  document.getElementById('vPlaca').readOnly = false;
  document.getElementById('vModelo').value = ''; 
  document.getElementById('vSec').value = '';
  
  document.getElementById('vDest').innerHTML = '<option value="GERAL">GERAL</option>';
  document.getElementById('vDest').value = 'GERAL';

  document.getElementById('vComb').value = 'Gasolina';
  document.getElementById('vMedia').value = ''; 
  
  document.getElementById('vOdoInicial').value = '';
  document.getElementById('vOdoAtual').value = '';
  
  document.getElementById('btnSaveVeic').innerHTML = '<i class="fas fa-save"></i> GRAVAR';
  document.getElementById('btnCancelVeic').classList.add('hidden');
}

window.salvarVeic = async function() {
  const placa = document.getElementById('vPlaca').value.toUpperCase().trim();
  const dest = document.getElementById('vDest').value;
  const odoIniStr = document.getElementById('vOdoInicial').value;

  if(!placa) return alert("Placa/ID é obrigatório.");
  if(!dest) return alert("Por favor, selecione uma Destinação (Centro de Custo).");

  loading(true, "Salvando...");
  try {
    const dados = { 
        tipoFrota: document.getElementById('vTipo').value, 
        origem: document.getElementById('vOrigem').value,
        modelo: document.getElementById('vModelo').value.trim(), 
        secretaria: document.getElementById('vSec').value.toUpperCase().trim(), 
        destinacao: dest,
        combustivel: document.getElementById('vComb').value, 
        media: safeCurrency(document.getElementById('vMedia').value)
    };
    
    if(odoIniStr !== '') {
        dados.odometroInicial = safeCurrency(odoIniStr);
    }

    if(!document.getElementById('hdnOldPlaca').value) { 
        dados.status = 'Disponível'; 
        dados.odometro = dados.odometroInicial || 0; 
    }
    
    await setDoc(doc(db, `${tenant}_veiculos`, placa), dados, {merge:true});
    
    window.cancelarEdicaoVeic(); 
    await window.buscarTudo();
  } catch(e) { console.error(e); alert("Erro: " + e.message); loading(false); }
}

window.excluirVeic = async function(placa) {
  if(!confirm(`Excluir ${placa}?`)) return;
  loading(true); 
  try { 
      await deleteDoc(doc(db, `${tenant}_veiculos`, placa)); 
      await window.buscarTudo(); 
  } catch(e) { console.error(e); alert("Erro: " + e.message); loading(false); }
}

// --- NOVA AUDITORIA CIRÚRGICA (Foco em Alto Consumo) ---
window.renderAnaliseFrota = function() {
    let mesAtual = new Date().toISOString().slice(0, 7);

    let analise = DADOS_VEICULOS.map(v => {
        let concluidosMes = DADOS_ABASTECIMENTOS.filter(a => a.placa === v.id && a.status === 'Concluído' && a.dataAbastecimento.startsWith(mesAtual));
        concluidosMes.sort((a,b) => new Date(b.dataAbastecimento) - new Date(a.dataAbastecimento));

        let ultimo = concluidosMes[0];
        let saldoUltimo = ultimo ? safeCurrency(ultimo.saldoOdometro) : 0;
        
        let desviosNegativos = concluidosMes.filter(a => safeCurrency(a.saldoOdometro) < -20).length;

        return {
            placa: v.id, modelo: v.modelo, secretaria: v.secretaria, destinacao: v.destinacao || 'GERAL',
            odometro: v.odometro || 0, tipoFrota: v.tipoFrota,
            saldoUltimo: saldoUltimo, 
            qtdAbastecimentosMes: concluidosMes.length,
            alertasDesvio: desviosNegativos
        };
    });

    analise.sort((a,b) => b.qtdAbastecimentosMes - a.qtdAbastecimentosMes);

    let h = '';
    let hAlertaFrequencia = '';
    let hAlertaConsumo = '';

    analise.forEach(v => {
        let isCritico = v.alertasDesvio > 1 || v.qtdAbastecimentosMes > 8; 
        let classeLinha = isCritico ? 'linha-critica' : '';
        let corSaldo = v.saldoUltimo < -20 ? 'text-danger' : (v.saldoUltimo > 20 ? 'text-warning' : 'text-success');

        h += `<tr class="${classeLinha} tr-auditoria">
            <td class="fw-bold placa-busca text-start">${v.placa}<br><small class="text-muted fw-normal">${v.modelo}</small></td>
            <td>${v.secretaria}<br><small class="text-primary">${v.destinacao}</small></td>
            <td class="text-dark fw-bold">${v.odometro.toFixed(1)} <small class="text-muted">${v.tipoFrota === 'Máquina' ? 'h' : 'km'}</small></td>
            <td><span class="badge bg-dark">${v.qtdAbastecimentosMes} no mês</span></td>
            <td class="fw-bold ${corSaldo} fs-6 bg-light border-start">${v.saldoUltimo > 0 ? '+'+v.saldoUltimo.toFixed(1) : v.saldoUltimo.toFixed(1)}</td>
        </tr>`;

        if(v.qtdAbastecimentosMes > 8) {
            hAlertaFrequencia += `<div class="mb-1 border-bottom pb-1"><b class="text-danger">${v.placa}</b>: Alta frequência (<b>${v.qtdAbastecimentosMes} idas ao posto</b> no mês).</div>`;
        }
        if(v.alertasDesvio > 1) {
            hAlertaConsumo += `<div class="mb-1 border-bottom pb-1"><b class="text-danger">${v.placa}</b>: <b>Alto consumo detectado</b> (Múltiplos desvios negativos de km).</div>`;
        }
    });

    if(document.getElementById('tbAnaliseBody')) document.getElementById('tbAnaliseBody').innerHTML = h;
    
    if(document.getElementById('listaAltaFrequencia')) {
        document.getElementById('listaAltaFrequencia').innerHTML = hAlertaFrequencia || '<div class="text-success fw-bold mt-2"><i class="fas fa-check-circle"></i> Frequência de abastecimentos normalizada.</div>';
    }
    if(document.getElementById('listaMaiorConsumo')) {
        document.getElementById('listaMaiorConsumo').innerHTML = hAlertaConsumo || '<div class="text-success fw-bold mt-2"><i class="fas fa-check-circle"></i> Sem anomalias de consumo detectadas.</div>';
    }
}

window.renderAuditoria = function() {
    let mesFiltro = document.getElementById('fMesAuditoria') ? document.getElementById('fMesAuditoria').value : '';
    if(!mesFiltro) {
        let d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        mesFiltro = d.toISOString().slice(0, 7);
        if(document.getElementById('fMesAuditoria')) document.getElementById('fMesAuditoria').value = mesFiltro;
    }

    let hAuditoria = '';
    let abastecimentosAgrupados = {};

    DADOS_ABASTECIMENTOS.filter(a => a.status === 'Concluído').forEach(a => {
        if(!abastecimentosAgrupados[a.placa]) abastecimentosAgrupados[a.placa] = [];
        abastecimentosAgrupados[a.placa].push(a);
    });

    let listaAuditoria = [];

    for(let placa in abastecimentosAgrupados) {
        let abasts = abastecimentosAgrupados[placa];
        abasts.sort((a,b) => new Date(a.dataAbastecimento) - new Date(b.dataAbastecimento));

        for(let i = 0; i < abasts.length; i++) {
            let a = abasts[i];
            if(!a.dataAbastecimento.startsWith(mesFiltro)) continue;

            let tempoUltimo = '-';
            let alertaTempo = false;
            
            if(i > 0) {
                let dataAtual = new Date(a.dataAbastecimento);
                let dataAnt = new Date(abasts[i-1].dataAbastecimento);
                let diffMs = dataAtual - dataAnt;
                let diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
                let diffMin = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                
                tempoUltimo = `${diffHoras}h ${diffMin}m`;
                if(diffHoras < 3) alertaTempo = true; 
            }

            let odoSist = safeCurrency(a.odometroSistemaAnterior !== undefined ? a.odometroSistemaAnterior : a.odometroSistema);
            let odoPainel = safeCurrency(a.odometroPainel);
            let saldo = safeCurrency(a.saldoOdometro);
            
            let alertaKm = false;
            if(odoPainel > 0 && (saldo < -10 || saldo > 200)) alertaKm = true; 

            listaAuditoria.push({
                a: a, tempoUltimo, alertaTempo, odoSist, odoPainel, saldo, alertaKm, dataObj: new Date(a.dataAbastecimento)
            });
        }
    }

    listaAuditoria.sort((a,b) => b.dataObj - a.dataObj);

    listaAuditoria.forEach(item => {
        let a = item.a;
        let v = DADOS_VEICULOS.find(x => x.id === a.placa);
        let dFmt = item.dataObj.toLocaleString('pt-BR').slice(0, 16);
        
        let txtPainel = item.odoPainel > 0 ? item.odoPainel.toFixed(1) : '<span class="text-muted">-</span>';
        let txtSaldo = item.odoPainel === 0 ? '<span class="text-muted">-</span>' : (item.saldo > 0 ? '+'+item.saldo.toFixed(1) : item.saldo.toFixed(1));
        
        let corTempo = item.alertaTempo ? 'text-danger fw-bold' : 'text-dark';
        let iconeTempo = item.alertaTempo ? '<i class="fas fa-exclamation-triangle" title="Menos de 3h entre abastecimentos"></i> ' : '';
        let corSaldo = item.saldo >= 0 ? (item.alertaKm ? 'text-warning text-dark fw-bold' : 'text-success') : 'text-danger fw-bold';
        
        let statusClasse = (item.alertaTempo || item.alertaKm) ? 'linha-atencao' : 'linha-ok';

        let badgeStatus = '';
        if(item.a.statusConsumo === 'Acima do esperado (Gastão)') badgeStatus = `<span class="badge bg-danger" title="Média Real: ${item.a.mediaRealCalculada?.toFixed(2)} (Base: ${v?.media})"><i class="fas fa-arrow-down"></i> Gastão</span>`;
        else if(item.a.statusConsumo === 'Abaixo do esperado (Econômico)') badgeStatus = `<span class="badge bg-success" title="Média Real: ${item.a.mediaRealCalculada?.toFixed(2)} (Base: ${v?.media})"><i class="fas fa-arrow-up"></i> Econômico</span>`;
        else if(item.a.statusConsumo === 'Na média') badgeStatus = `<span class="badge bg-info text-dark" title="Média Real: ${item.a.mediaRealCalculada?.toFixed(2)} (Base: ${v?.media})"><i class="fas fa-check"></i> Na média</span>`;
        else badgeStatus = `<span class="badge bg-secondary">-</span>`;
        
        hAuditoria += `<tr class="${statusClasse} tr-auditoria">
            <td>${dFmt}</td>
            <td class="fw-bold text-dark placa-busca">${a.placa}<br><small class="text-muted fw-normal">${v ? v.modelo : '-'}</small></td>
            <td><small>${a.nomePosto || '-'}</small></td>
            <td class="${corTempo}">${iconeTempo}${item.tempoUltimo}</td>
            <td class="text-primary">${item.odoSist.toFixed(1)}</td>
            <td class="fw-bold border-start">${txtPainel}</td>
            <td>${badgeStatus}</td>
            <td class="${corSaldo} border-end">${txtSaldo}</td>
        </tr>`;
    });
    document.getElementById('tbAuditoriaBody').innerHTML = hAuditoria || '<tr><td colspan="8" class="text-muted py-4">Nenhum registro no mês selecionado.</td></tr>';
}

window.filtrarAuditoriaVisual = function() {
    let placaStr = document.getElementById('fAuditoriaPlaca') ? document.getElementById('fAuditoriaPlaca').value.toUpperCase() : '';
    let statusSel = document.getElementById('fAuditoriaStatus') ? document.getElementById('fAuditoriaStatus').value : 'todos';

    let linhas = document.querySelectorAll('.tr-auditoria');
    linhas.forEach(linha => {
        let textoPlaca = linha.querySelector('.placa-busca') ? linha.querySelector('.placa-busca').innerText.toUpperCase() : '';
        let isAlerta = linha.classList.contains('linha-critica') || linha.classList.contains('linha-atencao');

        let mostraPlaca = textoPlaca.includes(placaStr);
        let mostraStatus = true;
        if (statusSel === 'alerta' && !isAlerta) mostraStatus = false;
        if (statusSel === 'ok' && isAlerta) mostraStatus = false;

        linha.style.display = (mostraPlaca && mostraStatus) ? '' : 'none';
    });
}

window.imprimirAuditoria = function() {
    let hOciosidade = document.getElementById('tabelaOciosidade').outerHTML;
    let hDesvios = document.getElementById('tabelaAuditoriaSaldos').outerHTML;
    let mes = document.getElementById('fMesAuditoria').value.split('-').reverse().join('/');

    let win = window.open('', '_blank', 'width=1000,height=600');
    win.document.write(`
        <html><head><title>Relatório de Auditoria de Frota</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 25px; }
            h3 { text-align: center; text-transform: uppercase; margin-bottom: 20px; color: #333; border-bottom: 2px solid #000; padding-bottom: 10px; }
            h4 { margin-top: 30px; color: #555; font-size: 16px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; text-align: center; font-size: 12px; margin-bottom: 20px; border: 1px solid #ccc; }
            th, td { border: 1px solid #ccc; padding: 8px; }
            th { background-color: #f2f2f2; }
            .text-danger { color: red; }
            .text-success { color: green; }
            .text-primary { color: blue; }
            .text-warning { color: darkgoldenrod; }
            .text-muted { color: gray; }
            .fw-bold { font-weight: bold; }
            .badge { border: 1px solid #000; padding: 3px 5px; font-size: 10px; border-radius: 4px; }
            .bg-danger { background-color: #f8d7da !important; color: #721c24 !important; }
            .bg-warning { background-color: #fff3cd !important; color: #856404 !important; }
            .linha-critica { background-color: #ffeeee !important; font-weight: bold; }
            .linha-atencao { background-color: #fffdf2 !important; }
        </style>
        </head><body>
            <h3>RELATÓRIO DE AUDITORIA DE FROTA - MÊS: ${mes}</h3>
            <h4><i class="fas fa-parking"></i> STATUS ATUAL DA FROTA</h4>
            ${hOciosidade}
            <h4><i class="fas fa-shield-alt"></i> HISTÓRICO DE DESVIOS E ABASTECIMENTOS DO MÊS</h4>
            ${hDesvios}
            ${BLOCO_ASSINATURA}
            <script>setTimeout(() => { window.print(); window.close(); }, 500);<\/script>
        </body></html>
    `);
    win.document.close();
}

// --- RELATÓRIOS E TABELAS ADM ---
window.filtrarRelatorio = function() {
    const fIni = document.getElementById('fIni') ? document.getElementById('fIni').value : '';
    const fFim = document.getElementById('fFim') ? document.getElementById('fFim').value : '';
    const fSec = document.getElementById('fSec') ? document.getElementById('fSec').value.toUpperCase() : '';
    const fDest = document.getElementById('fDest') ? document.getElementById('fDest').value.toUpperCase() : '';
    const fComb = document.getElementById('fComb') ? document.getElementById('fComb').value : '';
    const fPosto = document.getElementById('fPosto') ? document.getElementById('fPosto').value.toUpperCase() : '';
    const fTxt = document.getElementById('fTexto') ? document.getElementById('fTexto').value.toUpperCase() : '';
    const fOrigem = document.getElementById('fOrigem') ? document.getElementById('fOrigem').value : '';
    const fOrigemLanc = document.getElementById('fOrigemLanc') ? document.getElementById('fOrigemLanc').value : ''; 

    let tituloImp = "MAPA OFICIAL DE ABASTECIMENTO";
    if (fIni && fFim && fIni === fFim) { tituloImp = "MAPA DIÁRIO DE ABASTECIMENTO - " + fIni.split('-').reverse().join('/'); } 
    else if (fIni && fFim) { tituloImp = "MAPA DE ABASTECIMENTO (" + fIni.split('-').reverse().join('/') + " A " + fFim.split('-').reverse().join('/') + ")"; }
    if(document.getElementById('tituloMapaPrint')) document.getElementById('tituloMapaPrint').innerText = tituloImp;

    let concluidos = DADOS_ABASTECIMENTOS.filter(a => String(a.status).toLowerCase() === 'concluído');
    const userSecs = USUARIO.secretarias || []; 
    const podeVerTudo = userSecs.includes('TODAS');

    let filtrados = concluidos.filter(a => {
        let v = DADOS_VEICULOS.find(x => x.id === a.placa);
        a.modelo = v ? v.modelo : '-'; 
        a.secretariaReal = a.secretaria || (v ? v.secretaria : '-');
        a.destinacaoReal = a.destinacao || (v ? v.destinacao : 'GERAL') || 'GERAL';
        
        let origemReal = v ? (v.origem || 'Próprio') : 'Avulso';

        if(!podeVerTudo && !userSecs.includes(a.secretariaReal)) return false;
        if(fIni && a.dataAbastecimento < fIni) return false; 
        if(fFim && a.dataAbastecimento > fFim + "T23:59") return false;
        if(fSec && a.secretariaReal !== fSec) return false; 
        if(fDest && a.destinacaoReal !== fDest) return false;
        if(fComb && a.tipoCombustivel !== fComb) return false;
        if(fPosto && String(a.nomePosto || '').toUpperCase() !== fPosto) return false;
        if(fOrigem && origemReal !== fOrigem) return false;
        
        if(fOrigemLanc === 'App' && a.lancamentoManual === true) return false;
        if(fOrigemLanc === 'Manual' && !a.lancamentoManual) return false;
        if(fOrigemLanc === 'ExtraPosto' && (!a.lancamentoManual || !String(a.nomeFrentista).includes('(Posto Extra)'))) return false;
        if(fOrigemLanc === 'ExtraADM' && (!a.lancamentoManual || !String(a.nomeFrentista).includes('(ADM)'))) return false;

        if(fTxt) { 
            let sTxt = `${a.placa} ${a.placaExibicao||''} ${a.modelo} ${a.motorista} ${a.nomePosto}`.toUpperCase(); 
            if(!sTxt.includes(fTxt)) return false; 
        }
        return true;
    });

    let tValor = 0, tLitros = 0;
    filtrados.forEach(a => { 
        tValor += safeCurrency(a.valorTotal); 
        tLitros += safeCurrency(a.quantidade); 
    });
    if(document.getElementById('kpiValor')) {
        document.getElementById('kpiValor').innerText = tValor.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        document.getElementById('kpiLitros').innerText = tLitros.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        document.getElementById('kpiQtd').innerText = filtrados.length;
    }
    filtrados.sort((a,b) => new Date(b.dataAbastecimento) - new Date(a.dataAbastecimento)); 
    
    let html = '';
    filtrados.forEach(a => {
        let dFmt = new Date(a.dataAbastecimento).toLocaleString('pt-BR').slice(0, 16);
        let litros = safeCurrency(a.quantidade);
        
        let odoSist = safeCurrency(a.odometroSistema).toFixed(1);
        
        let v = DADOS_VEICULOS.find(x => x.id === a.placa);
        let origemInd = (v && v.origem === 'Locado') ? ' <span class="badge bg-info text-dark" title="Locado">L</span>' : '';
        let placaShow = a.placaExibicao ? `<span class="text-danger" title="Placa na Bomba: ${a.placaExibicao}">${a.placa}*</span>` : a.placa;
        let textSec = a.secretariaReal;
        if(a.destinacaoReal && a.destinacaoReal !== 'GERAL') textSec += `<br><small class="text-primary fw-bold">${a.destinacaoReal}</small>`;

        let badgeStatus = '';
        if(a.statusConsumo === 'Acima do esperado (Gastão)') badgeStatus = `<span class="badge bg-danger">Gastão</span>`;
        else if(a.statusConsumo === 'Abaixo do esperado (Econômico)') badgeStatus = `<span class="badge bg-success">Econômico</span>`;
        else if(a.statusConsumo === 'Na média') badgeStatus = `<span class="badge bg-info text-dark">Na média</span>`;
        else badgeStatus = `<span class="badge bg-secondary">-</span>`;

        html += `<tr>
        <td class="text-nowrap">${dFmt}</td>
        <td class="fw-bold text-nowrap">${placaShow}${origemInd}</td>
        <td class="text-nowrap">${textSec}</td>
        <td><small class="text-muted fw-bold">${a.nomePosto || '-'}</small></td>
        <td><small class="text-secondary fw-bold">${a.tipoCombustivel || '-'}</small></td>
        <td><small class="text-dark fw-bold">R$ ${safeCurrency(a.precoUnitario).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</small></td>
        <td class="text-primary fw-bold">${litros.toLocaleString('pt-BR', {minimumFractionDigits: 3})}</td>
        <td class="text-success fw-bold">${safeCurrency(a.valorTotal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
        <td class="text-dark fw-bold bg-light">${odoSist}</td>
        <td>${badgeStatus}</td>
        <td class="d-print-none text-nowrap">
            <button onclick="window.abrirModalLancamentoAdm('${a.id}')" class="btn btn-sm btn-outline-dark" title="Editar"><i class="fas fa-edit"></i></button>
            <button onclick="window.excluirAbastecimento('${a.id}', '${a.placa}')" class="btn btn-sm btn-outline-danger ms-1" title="Excluir"><i class="fas fa-trash"></i></button>
        </td>
        </tr>`;
    });
    if(document.getElementById('tbRelatBody')) document.getElementById('tbRelatBody').innerHTML = html;
}

window.imprimirDiario = function() {
    let d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    let hojePadrao = d.toISOString().slice(0, 10).split('-').reverse().join('/');
    
    let dataEscolhida = prompt("Informe a data para gerar o Mapa Diário (Formato: DD/MM/AAAA):", hojePadrao);
    if(!dataEscolhida) return; 
    
    let dataLimpa = dataEscolhida.replace(/\D/g, '');
    if(dataLimpa.length !== 8) return alert("Por favor, digite a data no formato correto: Dia, Mês e Ano (Ex: 10/04/2026)");
    
    let dia = dataLimpa.substring(0, 2);
    let mes = dataLimpa.substring(2, 4);
    let ano = dataLimpa.substring(4, 8);
    let dataIso = `${ano}-${mes}-${dia}`;

    document.getElementById('fIni').value = dataIso; 
    document.getElementById('fFim').value = dataIso;
    document.getElementById('fSec').value = ""; 
    document.getElementById('fDest').value = ""; 
    document.getElementById('fComb').value = "";
    if(document.getElementById('fPosto')) document.getElementById('fPosto').value = ""; 
    document.getElementById('fTexto').value = "";
    document.getElementById('fOrigem').value = ""; 
    document.getElementById('fOrigemLanc').value = "";
    
    window.filtrarRelatorio(); 
    setTimeout(() => { 
        let printDiv = document.getElementById('areaImpressao').outerHTML;
        let win = window.open('', '_blank', 'width=1000,height=600');
        win.document.write(`
            <html><head><title>Mapa Diário</title>
            <link href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 25px; }
                table { font-size: 11px; }
                th { background-color: #eee !important; color: #000 !important; }
            </style>
            </head><body>
                ${printDiv}
                ${BLOCO_ASSINATURA}
                <script>setTimeout(() => { window.print(); window.close(); }, 500);<\/script>
            </body></html>
        `);
        win.document.close();
    }, 500); 
}

window.excluirAbastecimento = async function(idAbast, placa) {
    if(!confirm(`Tem certeza que deseja EXCLUIR este abastecimento da placa ${placa}?`)) return;
    
    loading(true, "Excluindo...");
    try {
        await deleteDoc(doc(db, `${tenant}_abastecimentos`, idAbast));
        await window.buscarTudo(); 
    } catch(e) { console.error(e); alert("Erro ao excluir: " + e.message); loading(false); }
}

window.prepararEdicaoMot = function(id) {
    const m = DADOS_MOTORISTAS.find(x => x.id === id);
    if(!m) return;
    document.getElementById('hdnIdMotorista').value = m.id;
    document.getElementById('cadMotNome').value = m.nome || '';
    document.getElementById('cadMotCPF').value = m.cpf || '';
    document.getElementById('cadMotCNH').value = m.cnh || '';
    document.getElementById('cadMotCat').value = m.categoria || '';
    document.getElementById('btnSaveMot').innerHTML = '<i class="fas fa-save"></i> ATUALIZAR';
    document.getElementById('btnCancelMot').classList.remove('hidden');
}

window.cancelarEdicaoMot = function() {
    document.getElementById('hdnIdMotorista').value = '';
    document.getElementById('cadMotNome').value = '';
    document.getElementById('cadMotCPF').value = '';
    document.getElementById('cadMotCNH').value = '';
    document.getElementById('cadMotCat').value = '';
    document.getElementById('btnSaveMot').innerHTML = '<i class="fas fa-save"></i> SALVAR';
    document.getElementById('btnCancelMot').classList.add('hidden');
}

window.salvarMotorista = async function() {
    const nome = document.getElementById('cadMotNome').value.toUpperCase().trim();
    const cpf = document.getElementById('cadMotCPF').value.trim();
    const cnh = document.getElementById('cadMotCNH').value.trim();
    const cat = document.getElementById('cadMotCat').value.toUpperCase().trim();
    const editId = document.getElementById('hdnIdMotorista').value;

    if(!nome) return alert("O nome do motorista é obrigatório.");
    loading(true, "Salvando Motorista...");
    try {
        let id = editId || "MOT-" + Date.now();
        await setDoc(doc(db, `${tenant}_motoristas`, id), { nome: nome, cpf: cpf, cnh: cnh, categoria: cat }, {merge: true});
        window.cancelarEdicaoMot();
        await window.buscarTudo();
    } catch(e) { console.error(e); alert("Erro: " + e.message); loading(false); }
}

window.excluirMotorista = async function(id) {
    if(!confirm("Tem certeza que deseja excluir este motorista?")) return;
    loading(true);
    try { await deleteDoc(doc(db, `${tenant}_motoristas`, id)); await window.buscarTudo(); } 
    catch(e) { console.error(e); alert("Erro: " + e.message); loading(false); }
}

function renderMotoristas() {
    let h = '';
    DADOS_MOTORISTAS.forEach(m => {
        h += `<tr>
            <td class="fw-bold">${m.nome}</td>
            <td>${m.cpf || '-'}</td>
            <td>${m.cnh || '-'}</td>
            <td><span class="badge bg-secondary">${m.categoria || '-'}</span></td>
            <td class="text-end text-nowrap">
                <button class="btn btn-sm btn-outline-primary" onclick="window.prepararEdicaoMot('${m.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-danger ms-1" onclick="window.excluirMotorista('${m.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    if(document.getElementById('listaMotoristasTabela')) {
        document.getElementById('listaMotoristasTabela').innerHTML = h || '<tr><td colspan="5" class="text-muted py-3">Nenhum motorista cadastrado.</td></tr>';
    }
}

window.imprimirLista = function(idElemento, titulo) {
    let conteudo = document.getElementById(idElemento).outerHTML;
    let win = window.open('', '_blank', 'width=900,height=600');
    win.document.write(`
        <html>
            <head>
                <title>${titulo}</title>
                <link href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    body { padding: 30px; font-family: 'Segoe UI', sans-serif; background: #fff; }
                    h3 { font-weight: bold; text-align: center; margin-bottom: 20px; color: #000; text-transform: uppercase; }
                    th:last-child, td:last-child { display: none !important; }
                    .table { font-size: 0.9rem; }
                    .badge { border: 1px solid #000; color: #000 !important; background: transparent !important; font-weight: bold; }
                </style>
            </head>
            <body>
                <h3>${titulo}</h3>
                ${conteudo}
                ${BLOCO_ASSINATURA}
                <script>
                    window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 500); }
                <\/script>
            </body>
        </html>
    `);
    win.document.close();
}

window.prepararEdicaoPosto = function(id) {
    let p = DADOS_POSTOS.find(x => x.id === id);
    if(!p) return;
    document.getElementById('hdnIdPosto').value = p.id;
    document.getElementById('cadPostoNome').value = p.nome || '';
    document.getElementById('cadPostoCodigo').value = p.codigoVinculo || '';
    
    let dHoje = new Date().toISOString().slice(0, 10);
    document.getElementById('cadPostoVigencia').value = dHoje;

    let precosAtuais = window.obterPrecoVigente(p.nome, dHoje);

    document.getElementById('cadPostoGas').value = precosAtuais.Gasolina ? precosAtuais.Gasolina.toFixed(2).replace('.',',') : '';
    document.getElementById('cadPostoDie').value = precosAtuais.Diesel ? precosAtuais.Diesel.toFixed(2).replace('.',',') : '';
    document.getElementById('cadPostoEta').value = precosAtuais.Etanol ? precosAtuais.Etanol.toFixed(2).replace('.',',') : '';
    
    window.renderHistoricoPrecos(p);

    document.getElementById('btnSavePosto').innerHTML = '<i class="fas fa-save"></i> SALVAR NOVO PREÇO';
    document.getElementById('btnCancelPosto').classList.remove('hidden');
    window.scrollTo(0, 0);
}

window.renderHistoricoPrecos = function(p) {
    let box = document.getElementById('boxHistoricoPrecos');
    let tb = document.getElementById('tbHistoricoPrecos');
    box.classList.remove('hidden');

    if(!p.vigencias || p.vigencias.length === 0) {
        tb.innerHTML = '<tr><td colspan="5" class="text-muted">Nenhum histórico registrado ainda. Os preços editados aparecerão aqui.</td></tr>';
        return;
    }

    let h = '';
    p.vigencias.forEach((v) => {
        let dFmt = v.data.split('-').reverse().join('/');
        h += `<tr>
            <td class="fw-bold">${dFmt}</td>
            <td class="text-danger fw-bold">R$ ${v.Gasolina.toFixed(2).replace('.',',')}</td>
            <td class="text-dark fw-bold">R$ ${v.Diesel.toFixed(2).replace('.',',')}</td>
            <td class="text-success fw-bold">R$ ${v.Etanol.toFixed(2).replace('.',',')}</td>
            <td><button type="button" class="btn btn-sm text-danger" title="Excluir Vigência" onclick="window.excluirVigenciaPosto('${p.id}', '${v.data}')"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });
    tb.innerHTML = h;
}

window.excluirVigenciaPosto = async function(idPosto, dataVig) {
    if(!confirm(`Remover os preços do dia ${dataVig.split('-').reverse().join('/')}?`)) return;
    loading(true, "Apagando vigência...");
    try {
        let p = DADOS_POSTOS.find(x => x.id === idPosto);
        let novasVig = p.vigencias.filter(v => v.data !== dataVig);
        
        let gas = 0, die = 0, eta = 0;
        if(novasVig.length > 0) {
            gas = novasVig[0].Gasolina; die = novasVig[0].Diesel; eta = novasVig[0].Etanol;
        }

        await setDoc(doc(db, `${tenant}_postos`, idPosto), { 
            vigencias: novasVig,
            Gasolina: gas, Diesel: die, Etanol: eta
        }, {merge: true});
        
        await window.buscarTudo();
        window.prepararEdicaoPosto(idPosto);
        loading(false);
    } catch(e) { console.error(e); alert("Erro: " + e.message); loading(false); }
}

window.cancelarEdicaoPosto = function() {
    document.getElementById('hdnIdPosto').value = '';
    document.getElementById('cadPostoNome').value = '';
    document.getElementById('cadPostoCodigo').value = '';
    document.getElementById('cadPostoVigencia').value = new Date().toISOString().slice(0, 10);
    document.getElementById('cadPostoGas').value = '';
    document.getElementById('cadPostoDie').value = '';
    document.getElementById('cadPostoEta').value = '';
    
    document.getElementById('boxHistoricoPrecos').classList.add('hidden');

    document.getElementById('btnSavePosto').innerHTML = '<i class="fas fa-save"></i> SALVAR POSTO';
    document.getElementById('btnCancelPosto').classList.add('hidden');
}

window.salvarPosto = async function() {
    const idEdicao = document.getElementById('hdnIdPosto').value;
    const nome = document.getElementById('cadPostoNome').value.toUpperCase().trim();
    const cod = document.getElementById('cadPostoCodigo').value.toUpperCase().trim();
    const vigData = document.getElementById('cadPostoVigencia').value;
    const gas = safeCurrency(document.getElementById('cadPostoGas').value);
    const die = safeCurrency(document.getElementById('cadPostoDie').value);
    const eta = safeCurrency(document.getElementById('cadPostoEta').value);

    if(!nome || !cod) return alert("O Nome do Posto e o Cód. Identificador são obrigatórios.");
    if(!vigData) return alert("A Data de Início de Vigência é obrigatória.");
    
    loading(true, "Salvando Posto e Vigência...");
    try {
        let id = idEdicao ? idEdicao : "POS-" + Date.now();
        
        let pExistente = DADOS_POSTOS.find(x => x.id === id);
        let vigs = (pExistente && pExistente.vigencias) ? [...pExistente.vigencias] : [];
        
        vigs = vigs.filter(v => v.data !== vigData);
        vigs.push({ data: vigData, Gasolina: gas, Diesel: die, Etanol: eta });
        vigs.sort((a,b) => (a.data > b.data) ? -1 : 1); 

        await setDoc(doc(db, `${tenant}_postos`, id), { 
            nome: nome, 
            codigoVinculo: cod, 
            Gasolina: gas, 
            Diesel: die, 
            Etanol: eta,
            vigencias: vigs 
        }, {merge: true});
        
        window.cancelarEdicaoPosto();
        await window.buscarTudo();
    } catch(e) { console.error(e); alert("Erro: " + e.message); loading(false); }
}

window.excluirPosto = async function(id) {
    if(!confirm("Excluir este posto e os preços dele?")) return;
    loading(true);
    try { await deleteDoc(doc(db, `${tenant}_postos`, id)); await window.buscarTudo(); } 
    catch(e) { console.error(e); alert("Erro: " + e.message); loading(false); }
}

function renderPostos() {
    let h = '';
    let dHoje = new Date().toISOString().slice(0, 10);

    DADOS_POSTOS.forEach(p => {
        let badgeCod = p.codigoVinculo ? `<span class="badge bg-primary px-2">${p.codigoVinculo}</span>` : '<span class="text-muted">-</span>';
        
        let precosAtuais = window.obterPrecoVigente(p.nome, dHoje);

        h += `<tr>
            <td class="fw-bold">${badgeCod}</td>
            <td class="fw-bold text-dark">${p.nome}</td>
            <td class="text-danger fw-bold">${precosAtuais.Gasolina ? precosAtuais.Gasolina.toFixed(2) : '0.00'}</td>
            <td class="text-dark fw-bold">${precosAtuais.Diesel ? precosAtuais.Diesel.toFixed(2) : '0.00'}</td>
            <td class="text-success fw-bold">${precosAtuais.Etanol ? precosAtuais.Etanol.toFixed(2) : '0.00'}</td>
            <td class="text-end text-nowrap">
                <button class="btn btn-sm btn-outline-primary" onclick="window.prepararEdicaoPosto('${p.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-danger ms-1" onclick="window.excluirPosto('${p.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    if(document.getElementById('listaPostosTabela')) {
        document.getElementById('listaPostosTabela').innerHTML = h || '<tr><td colspan="6" class="text-muted py-3">Nenhum posto cadastrado.</td></tr>';
    }
}

// --- GESTORES DE ROTAS ---
function renderPainelTransporte() {
  const userSecs = USUARIO.secretarias || []; 
  const podeVerTudo = userSecs.includes('TODAS');
  
  let viagensAtivas = DADOS_VIAGENS.filter(v => v.status === 'Em Andamento');
  let motoristasOcupados = viagensAtivas.map(v => v.nomeMotorista);
  let placasOcupadas = viagensAtivas.map(v => v.placa);
  
  let vDisp = DADOS_VEICULOS.filter(v => 
      v.status !== 'Em Uso' && 
      v.status !== 'Em Oficina' && 
      v.status !== 'Inservível' && 
      !placasOcupadas.includes(v.id)
  );
  if(!podeVerTudo) vDisp = vDisp.filter(v => userSecs.includes(v.secretaria));
  
  let optV = '<option value="">-- Selecione o Equipamento --</option>';
  vDisp.forEach(v => optV += `<option value="${v.id}">${v.id} - ${v.modelo} (Odo/Hor: ${v.odometro?v.odometro.toFixed(1):0})</option>`);
  if(document.getElementById('selVeiculoTransp')) document.getElementById('selVeiculoTransp').innerHTML = optV;
  
  let mDisp = DADOS_MOTORISTAS.filter(m => !motoristasOcupados.includes(m.nome));
  let optM = '<option value="">-- Plantão / Sem Motorista --</option>';
  mDisp.forEach(u => { optM += `<option value="${u.nome}">${u.nome}</option>`; });
  if(document.getElementById('selMotTransp')) document.getElementById('selMotTransp').innerHTML = optM;
  
  let atv = '';
  viagensAtivas.forEach(via => {
     let veic = DADOS_VEICULOS.find(x => x.id === via.placa);
     if(veic && (!podeVerTudo && !userSecs.includes(veic.secretaria))) return; 
     
     let dIni = via.dataInicio ? new Date(via.dataInicio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
     atv += `<tr>
       <td><b class="text-primary">${via.placa}</b><br><small class="text-muted">${veic?veic.modelo:''}</small></td>
       <td>${via.nomeMotorista}</td>
       <td>${via.percurso}</td>
       <td>${dIni}</td>
       <td class="text-end">
           <button class="btn btn-sm btn-danger shadow-sm" onclick="window.encerrarViagem('${via.id}','${via.placa}')"><i class="fas fa-stop-circle"></i></button>
       </td>
     </tr>`;
  });
  if(document.getElementById('listaAtivosTransp')) document.getElementById('listaAtivosTransp').innerHTML = atv || '<tr><td colspan="5" class="text-center text-muted">Nenhum equipamento em uso.</td></tr>';
}

window.criarViagem = async function() {
  const p = document.getElementById('selVeiculoTransp').value;
  if(!p) return alert("Selecione um equipamento");
  loading(true, "Despachando...");
  try {
    let vId = "V-" + Date.now();
    await setDoc(doc(db, `${tenant}_viagens`, vId), { 
        placa: p, 
        nomeMotorista: document.getElementById('selMotTransp').value || "PLANTÃO", 
        percurso: document.getElementById('txtPercurso').value, 
        status: 'Em Andamento', 
        dataInicio: new Date().toISOString(), 
        gestor: USUARIO.nome 
    });
    await setDoc(doc(db, `${tenant}_veiculos`, p), {status: 'Em Uso'}, {merge:true});
    document.getElementById('txtPercurso').value = '';
    await window.buscarTudo();
  } catch(e) { console.error(e); alert("Erro: " + e.message); loading(false); }
}

window.encerrarViagem = async function(idViagem, placa) {
  if(!confirm("Encerrar uso do equipamento?")) return;
  loading(true);
  try {
      await setDoc(doc(db, `${tenant}_viagens`, idViagem), {status: 'Finalizada', dataFim: new Date().toISOString()}, {merge:true});
      await setDoc(doc(db, `${tenant}_veiculos`, placa), {status: 'Disponível'}, {merge:true});
      await window.buscarTudo();
  } catch(e) { console.error(e); alert("Erro: " + e.message); loading(false); }
}

function renderPainelAbastecimento() {
  const userSecs = USUARIO.secretarias || []; 
  const podeVerTudo = userSecs.includes('TODAS');
  
  let valesAutorizados = DADOS_ABASTECIMENTOS.filter(a => a.status === 'Autorizado');
  let placasAutorizadas = valesAutorizados.map(a => a.placa);

  let hLiberar = '';
  DADOS_VIAGENS.filter(v => v.status === 'Em Andamento').forEach(via => {
     if(placasAutorizadas.includes(via.placa)) return; 
     let veic = DADOS_VEICULOS.find(x => x.id === via.placa);
     if(veic && (!podeVerTudo && !userSecs.includes(veic.secretaria))) return;
     
     hLiberar += `
     <div class="col-md-4">
       <div class="card p-3 border-start border-primary border-4 shadow-sm h-100">
         <h4 class="fw-bold mb-0">${via.placa}</h4>
         <small class="text-muted d-block mb-2">${veic?veic.modelo:''}</small>
         <button class="btn btn-success btn-sm w-100 mt-auto fw-bold" onclick="window.abrirModalAutorizarGestor('${via.id}')"><i class="fas fa-check"></i> Autorizar Bomba</button>
       </div>
     </div>`;
  });
  if(document.getElementById('listaAbast')) document.getElementById('listaAbast').innerHTML = hLiberar || '<p class="text-muted">Nenhum equipamento da frota rodando no momento.</p>';

  let hPista = '';
  valesAutorizados.forEach(a => {
     let veic = DADOS_VEICULOS.find(x => x.id === a.placa);
     if(!a.placaExibicao && veic && (!podeVerTudo && !userSecs.includes(veic.secretaria))) return;
     
     let isAvulso = !!a.placaExibicao;
     let placaShow = isAvulso ? a.placaExibicao : a.placa;
     let txtModelo = isAvulso ? `<span class="text-danger fw-bold"><i class="fas fa-link"></i> Vinculado à Frota: ${a.placa}</span>` : (veic ? veic.modelo : '');
     let lblPosto = a.postoAutorizado ? `<div class="mt-2 small fw-bold text-dark"><i class="fas fa-store"></i> ${a.postoAutorizado}</div>` : '';

     hPista += `
     <div class="col-md-4">
       <div class="card p-3 border-start border-warning border-4 shadow-sm h-100 bg-light">
         <div class="d-flex justify-content-between"><h4 class="fw-bold m-0 text-dark">${placaShow}</h4></div>
         <small class="text-muted d-block mb-2">${txtModelo}</small>
         ${lblPosto}
         <button class="btn btn-outline-danger btn-sm mt-auto mt-3" onclick="window.cancelarVale('${a.id}')"><i class="fas fa-times"></i> Retirar da Fila</button>
       </div>
     </div>`;
  });
  if(document.getElementById('listaAguardandoPista')) document.getElementById('listaAguardandoPista').innerHTML = hPista || '<p class="text-muted">Fila vazia.</p>';
  
  let qtdP = valesAutorizados.length; 
  let badge = document.getElementById('badgePista');
  if(badge) {
      badge.innerText = qtdP;
      if(qtdP > 0) badge.classList.remove('hidden'); else badge.classList.add('hidden');
  }
}

window.toggleAvulso = function() { document.getElementById('painelAvulso').classList.toggle('hidden'); }

window.autorizarPlacaAvulsa = async function() {
    const placaBomba = document.getElementById('txtPlacaAvulsa').value.toUpperCase().trim();
    const veiculoRealId = document.getElementById('selVeiculoRealAvulso').value;
    const motorista = document.getElementById('txtMotoristaAvulso').value;
    const observacao = document.getElementById('txtObsAvulso').value;
    const postoSelecionado = document.getElementById('selPostoAvulso').value;

    if(!placaBomba) return alert("Digite a Placa que vai aparecer para o frentista.");
    if(!veiculoRealId) return alert("Você precisa escolher qual carro oficial vai receber este gasto na nota!");
    if(!postoSelecionado) return alert("Selecione para qual Posto você está enviando esta liberação!");

    let veic = DADOS_VEICULOS.find(x => x.id === veiculoRealId);
    let dest = veic.destinacao || 'GERAL';
    let erroC = window.validarContratoRigido(veic.secretaria, dest, veic.combustivel, postoSelecionado);
    if(erroC) return alert(erroC);

    if(!confirm(`Liberar abastecimento para ${placaBomba} no posto ${postoSelecionado}?`)) return;
    
    loading(true, "Enviando para a fila do posto...");
    try {
        await setDoc(doc(db, `${tenant}_abastecimentos`, "ABAST-" + Date.now()), { 
            placa: veiculoRealId,                
            placaExibicao: placaBomba,        
            motorista: motorista || "PLANTÃO", 
            observacao: observacao,
            postoAutorizado: postoSelecionado,
            gestorAutorizou: USUARIO.nome, 
            status: 'Autorizado',                
            dataAutorizacao: new Date().toISOString() 
        });
        document.getElementById('txtPlacaAvulsa').value = ''; 
        document.getElementById('selVeiculoRealAvulso').value = '';
        document.getElementById('selPostoAvulso').value = '';
        document.getElementById('txtMotoristaAvulso').value = ''; 
        document.getElementById('txtObsAvulso').value = '';
        document.getElementById('painelAvulso').classList.add('hidden');
        await window.buscarTudo();
    } catch(e) { console.error(e); alert("Erro: " + e.message); loading(false); }
}

window.abrirModalAutorizarGestor = function(viagemId) {
    let via = DADOS_VIAGENS.find(v => v.id === viagemId);
    if(!via) return;
    document.getElementById('authGestorIdViagem').value = viagemId;
    document.getElementById('authGestorPlaca').value = via.placa;
    document.getElementById('authGestorPlacaLabel').innerText = via.placa;
    document.getElementById('authGestorPosto').value = '';
    
    let motAtual = via.nomeMotorista;
    if(motAtual === "PLANTÃO" || motAtual === "N/I") motAtual = "";
    
    document.getElementById('authGestorMotorista').value = motAtual;
    document.getElementById('authGestorObs').value = '';
    modalAutorizarGestorObj.show();
}

window.confirmarAutorizacao = async function() {
  const placa = document.getElementById('authGestorPlaca').value;
  const motorista = document.getElementById('authGestorMotorista').value;
  const obs = document.getElementById('authGestorObs').value;
  const postoSelecionado = document.getElementById('authGestorPosto').value;
  
  if(!postoSelecionado) return alert("Por favor, selecione para qual Posto você deseja liberar o abastecimento.");

  let veic = DADOS_VEICULOS.find(x => x.id === placa);
  let dest = veic.destinacao || 'GERAL';
  
  let erroC = window.validarContratoRigido(veic.secretaria, dest, veic.combustivel, postoSelecionado);
  if(erroC) return alert(erroC);

  loading(true, "Enviando para o Posto...");
  try {
      await setDoc(doc(db, `${tenant}_abastecimentos`, "ABAST-" + Date.now()), { 
          placa: placa, 
          motorista: motorista || "PLANTÃO", 
          observacao: obs, 
          postoAutorizado: postoSelecionado,
          gestorAutorizou: USUARIO.nome, 
          status: 'Autorizado', 
          dataAutorizacao: new Date().toISOString() 
      });
      modalAutorizarGestorObj.hide();
      await window.buscarTudo();
  } catch(e) { console.error(e); alert("Erro: " + e.message); loading(false); }
}

window.cancelarVale = async function(id) {
  if(!confirm("Remover da fila?")) return;
  loading(true); 
  try { 
      await setDoc(doc(db, `${tenant}_abastecimentos`, id), {status:'Cancelado'}, {merge:true}); 
      await window.buscarTudo(); 
  } catch(e) { console.error(e); alert("Erro: " + e.message); loading(false); }
}

// --- CÁLCULO DIRETO E HODÔMETRO (SALVAMENTO) ---
window.abrirModalLancamentoAdm = function(id = null) {
    document.getElementById('admIdAbast').value = id || '';
    let optV = '<option value="">-- Selecione a Frota --</option>';
    DADOS_VEICULOS.forEach(v => {
        if(v.status === 'Em Oficina' || v.status === 'Inservível') return;
        optV += `<option value="${v.id}">${v.id} - ${v.modelo}</option>`;
    });
    document.getElementById('admPlaca').innerHTML = optV;
    
    if (id) {
        let a = DADOS_ABASTECIMENTOS.find(x => x.id === id);
        document.getElementById('admPlaca').value = a.placa; 
        document.getElementById('admPlaca').disabled = true; 
        let d = new Date(a.dataAbastecimento); 
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        document.getElementById('admData').value = d.toISOString().slice(0,16);
        document.getElementById('admOdo').value = a.odometroPainel || a.odometroSistema || ''; 
        
        let lStr = parseFloat(a.quantidade).toFixed(3).replace('.', ',');
        let intPart = lStr.split(',')[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
        let decPart = lStr.split(',')[1];
        document.getElementById('admLitros').value = intPart + ',' + decPart;
        
        document.getElementById('admMotorista').value = a.motorista || ''; 
        document.getElementById('admPostoNome').value = a.nomePosto || '';
    } else {
        document.getElementById('admPlaca').disabled = false; 
        document.getElementById('admData').value = ''; 
        document.getElementById('admOdo').value = '';
        document.getElementById('admLitros').value = ''; 
        document.getElementById('admMotorista').value = ''; 
        document.getElementById('admPostoNome').value = '';
    }
    modalLancaAdmObj.show();
}

window.salvarLancamentoAdm = async function() {
    const id = document.getElementById('admIdAbast').value || "ADM-" + Date.now();
    const placa = document.getElementById('admPlaca').value; 
    const dt = document.getElementById('admData').value;
    let odoInformado = safeCurrency(document.getElementById('admOdo').value); 
    const litros = safeCurrency(document.getElementById('admLitros').value);
    const motorista = document.getElementById('admMotorista').value; 
    const postoSelecionado = document.getElementById('admPostoNome').value;

    if(!placa || !dt || !litros) return alert("Preencha Placa/ID, Data e Litros.");
    if(!postoSelecionado) return alert("Selecione em qual posto está abastecendo.");
    
    let veic = DADOS_VEICULOS.find(x => x.id === placa);
    let sec = veic ? veic.secretaria : '';
    let dest = veic ? (veic.destinacao || 'GERAL') : 'GERAL';
    let combFixo = veic ? veic.combustivel : 'Gasolina';
    
    let erroC = window.validarContratoRigido(sec, dest, combFixo, postoSelecionado);
    if(erroC) return alert(erroC);

    loading(true, "Gravando Lançamento...");
    
    let dtIso = new Date(dt).toISOString();
    let precosNaData = window.obterPrecoVigente(postoSelecionado, dtIso);
    let precoLitro = precosNaData[combFixo] || 0;
    let totalReais = litros * precoLitro;
    
    let tagLancador = "";
    if (USUARIO.moduloRole === 'GerentePosto') tagLancador = " (Posto Extra)";
    else if (USUARIO.moduloRole === 'LancadorRetroativo') tagLancador = " (Colab. Retroativo)";
    else tagLancador = " (ADM)";

    // CÁLCULO DIRETO E GATILHO (Sem reprocessamento global)
    let odoAnterior = veic.odometro || veic.odometroInicial || 0;
    let mediaBase = safeCurrency(veic.media) > 0 ? safeCurrency(veic.media) : 1;
    let avancoTeorico = (veic.tipoFrota === 'Máquina') ? (litros / mediaBase) : (litros * mediaBase);
    let odoProjetado = odoAnterior + avancoTeorico;

    if(odoInformado <= 0) odoInformado = odoProjetado;

    let saldoOdometro = (odoInformado - odoAnterior) - avancoTeorico;

    try {
        await setDoc(doc(db, `${tenant}_abastecimentos`, id), {
            status: 'Concluído', 
            dataAbastecimento: dtIso, 
            tipoCombustivel: combFixo, 
            placa: placa,
            secretaria: sec,
            destinacao: dest,
            odometroPainel: odoInformado, 
            odometroSistemaAnterior: odoAnterior,
            odometroSistema: odoProjetado,
            saldoOdometro: saldoOdometro,
            quantidade: litros, 
            precoUnitario: precoLitro, 
            valorTotal: totalReais, 
            motorista: motorista,
            frentistaCpf: USUARIO.cpf, 
            nomeFrentista: USUARIO.nome + tagLancador, 
            nomePosto: postoSelecionado,
            lancamentoManual: true
        }, {merge:true});
        
        // Gatilho: Atualiza quilometragem e banco do veículo
        await setDoc(doc(db, `${tenant}_veiculos`, veic.id), {
            odometro: odoInformado
        }, {merge: true});
        
        modalLancaAdmObj.hide(); 
        await window.buscarTudo(); 
        alert("Salvo com sucesso!");
    } catch(e) { console.error(e); alert("Erro ao salvar: " + e.message); loading(false); }
}

window.salvarAbastecimento = async function() {
  const id = document.getElementById('hdnIdAbast').value;
  let odoInformado = safeCurrency(document.getElementById('inpOdoFrentista').value);
  const litros = safeCurrency(document.getElementById('inpLitrosFrentista').value);
  const combFixo = document.getElementById('inpCombFrentista').value;
  const postoSelecionado = document.getElementById('inpPostoFrentista').value;

  if(litros <= 0) return alert("Preencha a quantidade de Litros!");
  if(!postoSelecionado) return alert("Selecione em qual posto está abastecendo!");
  
  let a = DADOS_ABASTECIMENTOS.find(x => x.id === id);
  let veic = DADOS_VEICULOS.find(x => x.id === a.placa);
  
  let sec = veic ? veic.secretaria : ''; 
  let dest = veic ? (veic.destinacao || 'GERAL') : 'GERAL';

  let erroC = window.validarContratoRigido(sec, dest, combFixo, postoSelecionado);
  if(erroC) return alert(erroC);

  loading(true, "Gravando Abastecimento...");
  
  let dtIso = new Date().toISOString();
  let precoLitro = window.obterPrecoVigente(postoSelecionado, dtIso)[combFixo] || 0;
  let totalReais = litros * precoLitro;

  // CÁLCULO DIRETO E GATILHO (Sem reprocessamento global)
  let odoAnterior = veic.odometro || veic.odometroInicial || 0;
  let mediaBase = safeCurrency(veic.media) > 0 ? safeCurrency(veic.media) : 1;
  let avancoTeorico = (veic.tipoFrota === 'Máquina') ? (litros / mediaBase) : (litros * mediaBase);
  let odoProjetado = odoAnterior + avancoTeorico;

  if(odoInformado <= 0) odoInformado = odoProjetado;

  let saldoOdometro = (odoInformado - odoAnterior) - avancoTeorico;

  try {
    await setDoc(doc(db, `${tenant}_abastecimentos`, id), {
        status: 'Concluído',
        dataAbastecimento: dtIso,
        tipoCombustivel: combFixo,
        secretaria: sec, 
        destinacao: dest,
        odometroPainel: odoInformado, 
        odometroSistemaAnterior: odoAnterior,
        odometroSistema: odoProjetado,
        saldoOdometro: saldoOdometro,
        quantidade: litros, 
        precoUnitario: precoLitro, 
        valorTotal: totalReais,
        frentistaCpf: USUARIO.cpf, 
        nomeFrentista: USUARIO.nome,
        nomePosto: postoSelecionado
    }, {merge:true});

    if(veic) {
        await setDoc(doc(db, `${tenant}_veiculos`, veic.id), {
            odometro: odoInformado
        }, {merge: true});
    }

    modalFrentistaObj.hide(); 
    await window.buscarTudo();
    alert("Salvo com Sucesso!");
  } catch(e) { console.error(e); alert("Erro ao salvar: " + e.message); loading(false); }
}

// --- IMPRESSÃO PARA VEÍCULOS ---
window.abrirModalPrintVeic = function() {
    document.getElementById('pSec').innerHTML = document.getElementById('fSec').innerHTML;
    document.getElementById('pTipo').value = '';
    document.getElementById('pOrigem').value = '';
    modalPrintVeicObj.show();
}

window.gerarImpressaoVeic = function() {
    let t = document.getElementById('pTipo').value;
    let o = document.getElementById('pOrigem').value;
    let s = document.getElementById('pSec').value.toUpperCase();
    let buscaTxt = document.getElementById('fBuscaVeic') ? document.getElementById('fBuscaVeic').value.toUpperCase() : '';

    let filtrados = DADOS_VEICULOS.filter(v => {
        let origemReal = v.origem || 'Próprio';
        if(t && v.tipoFrota !== t) return false;
        if(o && origemReal !== o) return false;
        if(s && v.secretaria !== s) return false;

        if(buscaTxt) {
            let tV = `${v.id} ${v.modelo || ''} ${v.secretaria || ''} ${v.destinacao || ''}`.toUpperCase();
            if(!tV.includes(buscaTxt)) return false;
        }
        return true;
    });

    let htmlTable = `<table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 12px; margin-top: 15px;" border="1">
        <thead style="background-color: #f2f2f2;">
            <tr>
                <th style="padding: 8px;">Identificação</th>
                <th style="padding: 8px;">Origem</th>
                <th style="padding: 8px;">Tipo</th>
                <th style="padding: 8px;">Modelo</th>
                <th style="padding: 8px;">Sec / Destinação</th>
                <th style="padding: 8px;">Média Base</th>
                <th style="padding: 8px;">Odo/Hor Atual</th>
            </tr>
        </thead>
        <tbody>`;

    if(filtrados.length === 0) {
        htmlTable += `<tr><td colspan="7" style="padding: 15px; color: #666;">Nenhum veículo encontrado.</td></tr>`;
    } else {
        filtrados.forEach(v => {
            let undMedia = v.tipoFrota === 'Máquina' ? 'L/h' : 'Km/L';
            let odoAtual = v.odometro ? v.odometro.toFixed(1) : 0;
            let origemTexto = v.origem || 'Próprio';
            let secCompleta = v.secretaria;
            if(v.destinacao && v.destinacao !== 'GERAL') secCompleta += " / " + v.destinacao;
            
            htmlTable += `<tr>
                <td style="padding: 8px; font-weight: bold;">${v.id}</td>
                <td style="padding: 8px;">${origemTexto}</td>
                <td style="padding: 8px;">${v.tipoFrota || 'Veículo'}</td>
                <td style="padding: 8px;">${v.modelo || '-'}</td>
                <td style="padding: 8px;">${secCompleta}</td>
                <td style="padding: 8px;">${v.media || 0} ${undMedia}</td>
                <td style="padding: 8px; font-weight: bold;">${odoAtual}</td>
            </tr>`;
        });
    }
    htmlTable += `</tbody></table>`;

    let txtTipo = t ? t : 'Todos'; let txtOrigem = o ? o : 'Todas'; let txtSec = s ? s : 'Todas';

    let win = window.open('', '_blank', 'width=900,height=600');
    win.document.write(`
        <html>
            <head>
                <title>Relatório de Frota</title>
                <style>
                    body { padding: 30px; font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #000; }
                    h3 { font-weight: bold; text-align: center; margin-bottom: 5px; text-transform: uppercase; }
                    .info-filtros { text-align: right; font-size: 11px; color: #555; margin-bottom: 10px; }
                </style>
            </head>
            <body>
                <h3>RELAÇÃO DE FROTA E MÁQUINAS</h3>
                <div class="info-filtros">
                    <b>Filtros aplicados:</b> Tipo: ${txtTipo} | Origem: ${txtOrigem} | Secretaria: ${txtSec} <br>
                    <b>Busca Rápida:</b> ${buscaTxt ? buscaTxt : 'Nenhuma'}<br>
                    <b>Total Listado:</b> ${filtrados.length} equipamento(s)
                </div>
                ${htmlTable}
                ${BLOCO_ASSINATURA}
                <script>
                    window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 500); }
                <\/script>
            </body>
        </html>
    `);
    win.document.close();
    modalPrintVeicObj.hide();
}

// --- RENDERIZADORES FRENTISTA ---
function renderFilaPosto() {
  let setorUser = String(USUARIO.setor || '').toUpperCase();
  let postoDoFrentista = null;
  
  DADOS_POSTOS.forEach(p => {
      let codPosto = String(p.codigoVinculo || '').toUpperCase().trim();
      if(codPosto) {
          let regex = new RegExp(`\\b${codPosto}\\b`, 'i');
          if(regex.test(setorUser)) {
              postoDoFrentista = p.nome;
          }
      }
  });

  let lblPainel = document.getElementById('lblNomePostoFrentista');
  if(lblPainel) {
      if(postoDoFrentista) {
          lblPainel.innerHTML = `<i class="fas fa-store"></i> ${postoDoFrentista}`;
          lblPainel.className = "text-dark mb-4 fw-bold text-center border p-2 bg-light rounded border-success shadow-sm";
      } else {
          lblPainel.innerHTML = `<i class="fas fa-exclamation-triangle text-danger"></i> Seu usuário não possui o código de nenhum posto no campo Setor. Exibindo toda a fila.`;
          lblPainel.className = "text-danger mb-4 fw-bold text-center border p-2 bg-warning rounded border-danger shadow-sm";
      }
  }

  let valesAutorizados = DADOS_ABASTECIMENTOS.filter(a => {
      if(a.status !== 'Autorizado') return false;
      if(postoDoFrentista && a.postoAutorizado && a.postoAutorizado !== postoDoFrentista) return false;
      return true;
  });

  let h = '';
  valesAutorizados.forEach(a => {
     let placaParaFrentista = a.placaExibicao || a.placa;
     let isAvulso = !!a.placaExibicao;
     let v = DADOS_VEICULOS.find(x => x.id === a.placa);
     
     let icone = (v && v.tipoFrota === 'Máquina') ? '<i class="fas fa-tractor"></i>' : '<i class="fas fa-car"></i>';
     let descModelo = isAvulso ? 'Veículo em Rota' : (v?v.modelo:'');
     let badgeObs = a.observacao ? `<div class="bg-warning text-dark fw-bold rounded px-2 py-1 mt-2 small shadow-sm"><i class="fas fa-bell"></i> ${a.observacao}</div>` : '';

     h += `
     <div class="col-md-4 col-sm-6">
       <div class="card p-3 border-success shadow-sm text-center h-100">
         <h3 class="fw-bold text-success mb-0">${placaParaFrentista}</h3>
         <h6 class="text-muted mt-1">${icone} ${descModelo}</h6>
         ${badgeObs}
         <button onclick="window.abrirModalFrentista('${a.id}')" class="btn btn-success w-100 fw-bold mt-auto py-2 mt-3"><i class="fas fa-gas-pump"></i> PREENCHER BOMBA</button>
       </div>
     </div>`;
  });
  if(document.getElementById('listaPosto')) document.getElementById('listaPosto').innerHTML = h || '<div class="alert alert-light border">Nenhum equipamento na fila deste posto.</div>';
}

window.renderGestaoNotas = function() {
    let pendentes = DADOS_ABASTECIMENTOS.filter(a => a.status === 'Concluído' && !a.notaEmitida);
    pendentes.sort((a,b) => new Date(a.dataAbastecimento) - new Date(b.dataAbastecimento));

    let hPend = '';
    pendentes.forEach(a => {
        let dFmt = new Date(a.dataAbastecimento).toLocaleString('pt-BR').slice(0, 16);
        let litros = safeCurrency(a.quantidade).toLocaleString('pt-BR', {minimumFractionDigits: 3});
        
        let odo = safeCurrency(a.odometroPainel > 0 ? a.odometroPainel : (a.odometroSistemaAnterior !== undefined ? a.odometroSistemaAnterior : a.odometroSistema)).toFixed(1);
        
        hPend += `<tr>
            <td>${dFmt}</td>
            <td class="text-muted fw-bold">${a.nomePosto || '-'}</td>
            <td class="fw-bold text-dark">${a.placa}</td>
            <td class="text-primary fw-bold">${litros} L</td>
            <td class="text-danger fw-bold">${odo}</td>
            <td><button onclick="window.marcarNotaEmitida('${a.id}')" class="btn btn-sm btn-info fw-bold shadow-sm text-white"><i class="fas fa-file-invoice"></i> Gerar NF-e</button></td>
        </tr>`;
    });
    
    let msgVaziaPend = '<tr><td colspan="6" class="text-muted py-4">Nenhuma NF-e pendente.</td></tr>';
    if(document.getElementById('tbGestorPendentes')) document.getElementById('tbGestorPendentes').innerHTML = hPend || msgVaziaPend;
    if(document.getElementById('tbFrentPendentes')) document.getElementById('tbFrentPendentes').innerHTML = hPend || msgVaziaPend;

    let filtroDataFrent = document.getElementById('filtroDataNotasFrentista') ? document.getElementById('filtroDataNotasFrentista').value : '';
    let filtroDataGest = document.getElementById('filtroDataNotasGestor') ? document.getElementById('filtroDataNotasGestor').value : '';
    
    let emitidas = DADOS_ABASTECIMENTOS.filter(a => a.status === 'Concluído' && a.notaEmitida === true);
    
    if(document.getElementById('tbFrentEmitidas')) {
        let filtradasF = emitidas.filter(a => a.dataAbastecimento.startsWith(filtroDataFrent) || (a.dataEmissaoNota && a.dataEmissaoNota.startsWith(filtroDataFrent)));
        filtradasF.sort((a,b) => new Date(b.dataEmissaoNota) - new Date(a.dataEmissaoNota));
        let hF = '';
        filtradasF.forEach(a => {
            let dAb = new Date(a.dataAbastecimento).toLocaleString('pt-BR').slice(0, 16);
            let dEm = a.dataEmissaoNota ? new Date(a.dataEmissaoNota).toLocaleString('pt-BR').slice(0, 16) : '-';
            hF += `<tr><td>${dAb}</td><td class="text-success fw-bold">${dEm}</td><td>${a.nomePosto || '-'}</td><td class="fw-bold">${a.placa}</td><td>${safeCurrency(a.quantidade).toLocaleString('pt-BR', {minimumFractionDigits: 3})} L</td><td><small class="text-muted">${a.usuarioEmitiuNota}</small></td></tr>`;
        });
        document.getElementById('tbFrentEmitidas').innerHTML = hF || '<tr><td colspan="6" class="text-muted py-4">Nenhuma NF-e emitida nesta data.</td></tr>';
    }

    if(document.getElementById('tbGestorEmitidas')) {
        let filtradasG = emitidas.filter(a => a.dataAbastecimento.startsWith(filtroDataGest) || (a.dataEmissaoNota && a.dataEmissaoNota.startsWith(filtroDataGest)));
        filtradasG.sort((a,b) => new Date(b.dataEmissaoNota) - new Date(a.dataEmissaoNota));
        let hG = '';
        filtradasG.forEach(a => {
            let dAb = new Date(a.dataAbastecimento).toLocaleString('pt-BR').slice(0, 16);
            let dEm = a.dataEmissaoNota ? new Date(a.dataEmissaoNota).toLocaleString('pt-BR').slice(0, 16) : '-';
            hG += `<tr><td>${dAb}</td><td class="text-success fw-bold">${dEm}</td><td>${a.nomePosto || '-'}</td><td class="fw-bold">${a.placa}</td><td>${safeCurrency(a.quantidade).toLocaleString('pt-BR', {minimumFractionDigits: 3})} L</td><td><small class="text-muted">${a.usuarioEmitiuNota}</small></td></tr>`;
        });
        document.getElementById('tbGestorEmitidas').innerHTML = hG || '<tr><td colspan="6" class="text-muted py-4">Nenhuma NF-e emitida nesta data.</td></tr>';
    }
}

window.marcarNotaEmitida = async function(id) {
  if(!confirm("Confirma emissão da NF-e Simplificada?")) return;
  loading(true, "Registrando emissão...");
  try {
      await setDoc(doc(db, `${tenant}_abastecimentos`, id), { notaEmitida: true, dataEmissaoNota: new Date().toISOString(), usuarioEmitiuNota: USUARIO.nome }, {merge: true});
      await window.buscarTudo(); 
  } catch(e) { console.error(e); alert("Erro ao emitir nota: " + e.message); loading(false); }
}

window.renderRelatorioExtrasPosto = function() {
    if(!document.getElementById('tbFrentExtrasLista')) return;
    
    let extrasCpf = DADOS_ABASTECIMENTOS.filter(a => a.lancamentoManual === true && a.frentistaCpf === USUARIO.cpf);
    extrasCpf.sort((a,b) => new Date(b.dataAbastecimento) - new Date(a.dataAbastecimento));

    let hE = '';
    extrasCpf.forEach(a => {
        let dFmt = new Date(a.dataAbastecimento).toLocaleString('pt-BR').slice(0, 16);
        hE += `<tr>
            <td>${dFmt}</td>
            <td class="fw-bold">${a.placa}</td>
            <td>${a.tipoCombustivel}</td>
            <td class="fw-bold text-primary">${safeCurrency(a.quantidade).toLocaleString('pt-BR', {minimumFractionDigits: 3})} L</td>
            <td>${a.motorista || '-'}</td>
        </tr>`;
    });
    document.getElementById('tbFrentExtrasLista').innerHTML = hE || '<tr><td colspan="5" class="text-muted py-4">Nenhum lançamento extra realizado.</td></tr>';
}

window.abrirModalFrentista = function(id) {
    let a = DADOS_ABASTECIMENTOS.find(x => x.id === id);
    if(!a) return;
    
    document.getElementById('hdnIdAbast').value = a.id;
    let v = DADOS_VEICULOS.find(x => x.id === a.placa);

    let placaParaFrentista = a.placaExibicao || a.placa;
    document.getElementById('lblPlacaFrentista').innerText = placaParaFrentista;
    
    if(a.placaExibicao) {
        document.getElementById('lblModeloFrentista').innerHTML = `<span class="text-danger"><i class="fas fa-link"></i> Oficial: ${a.placa}</span>`;
    } else {
        document.getElementById('lblModeloFrentista').innerText = v ? v.modelo : '---';
    }
    
    document.getElementById('badgeTipoFrota').innerText = v ? v.tipoFrota : 'Veículo';
    
    if(a.observacao) {
        document.getElementById('boxObsFrentista').innerHTML = `<i class="fas fa-exclamation-circle"></i> OBS: ${a.observacao}`;
        document.getElementById('boxObsFrentista').classList.remove('hidden');
    } else {
        document.getElementById('boxObsFrentista').classList.add('hidden');
    }

    if(v && v.combustivel) document.getElementById('inpCombFrentista').value = v.combustivel;
    if(a.postoAutorizado) document.getElementById('inpPostoFrentista').value = a.postoAutorizado;
    
    document.getElementById('inpOdoFrentista').value = '';
    document.getElementById('inpLitrosFrentista').value = '';

    modalFrentistaObj.show();
}
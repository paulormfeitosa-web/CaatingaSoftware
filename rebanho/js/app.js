import { collection, query, where, getDocs, doc, setDoc, addDoc, deleteDoc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { db, auth, storage } from "./firebase-config.js";

let usuarioAtual = null;
let listenerUsuario = null; 
let tenant = ""; 
let modalInstancia = null;
let modalPastoInstancia = null;

window.BD_ANIMAIS = []; window.BD_PESOS = []; window.BD_VACINAS = []; 
window.BD_FINANCEIRO = []; window.BD_ESTOQUE = []; window.BD_REPRODUCAO = []; window.BD_PASTOS = [];

let chartP, chartR, chartM, chartS, chartW;
window.selecionados = [];
let pastoSelecionadoAtual = null;

function loading(show, msg="A Carregar...") { 
  document.getElementById('loading-msg').innerText = msg;
  if(show) document.getElementById('loadingOverlay').classList.remove('oculto');
  else document.getElementById('loadingOverlay').classList.add('oculto');
}

window.showToast = function(msg) { 
  document.getElementById('toastMsg').innerText = msg; 
  new bootstrap.Toast(document.getElementById('liveToast')).show(); 
};

window.mascaraMoeda = function(i) {
  let v = i.value.replace(/\D/g,'');
  if(v === "") { i.value = ""; return; }
  v = (v/100).toFixed(2) + ''; v = v.replace(".", ","); v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  i.value = v;
}
function unmaskMoeda(v) { if(!v) return 0; return Number(String(v).replace(/\./g, '').replace(',', '.')); }
function formatDateLocal(isoString) {
  if(!isoString) return "";
  const d = new Date(isoString); const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
}

window.onload = function() {
  modalInstancia = new bootstrap.Modal(document.getElementById('modalAnimal'));
  modalPastoInstancia = new bootstrap.Modal(document.getElementById('modalCadastroPasto'));
  
  onAuthStateChanged(auth, async (userAuth) => {
      const cracha = localStorage.getItem("caatinga_user");
      if (userAuth && cracha) { 
          usuarioAtual = JSON.parse(cracha); 
          if (usuarioAtual.cpf !== "01305663306") {
              try {
                  const docVerifica = await getDoc(doc(db, "usuarios", usuarioAtual.cpf));
                  if (!docVerifica.exists() || docVerifica.data().ativo === false) { window.sairSistema(true); return; }
              } catch(e) {}
          }
          iniciarSistema(); 
      } else { 
          document.getElementById('sistemaPrincipal').classList.add('oculto');
          document.getElementById('telaLogin').classList.remove('oculto'); 
      }
  });
};

window.sairSistema = function(silencioso = false) { 
    localStorage.removeItem("caatinga_user"); 
    if(listenerUsuario) { listenerUsuario(); listenerUsuario = null; } 
    signOut(auth).then(() => {
        if(!silencioso) window.location.reload(); 
        else { document.getElementById('sistemaPrincipal').classList.add('oculto'); document.getElementById('telaLogin').classList.remove('oculto'); document.getElementById('msgLogin').innerText = "Acesso revogado."; document.getElementById('msgLogin').classList.remove('oculto'); }
    });
};

window.logar = async function() {
  const cpf = document.getElementById('loginCpf').value.replace(/\D/g, ''); const senha = document.getElementById('loginSenha').value;
  document.getElementById('msgLogin').classList.add('oculto');
  loading(true, "A Autenticar...");
  try {
    const emailFicticio = cpf + "@feitosa.app";
    if (cpf === "01305663306" && senha === "pr10mf86") {
       try { await signInWithEmailAndPassword(auth, emailFicticio, senha); } catch(e) { await createUserWithEmailAndPassword(auth, emailFicticio, senha); }
       usuarioAtual = { nome: "Master", nivel_acesso: "SUPER_ADM", empresa_id: "pref_aiuaba", cpf: cpf }; localStorage.setItem("caatinga_user", JSON.stringify(usuarioAtual)); iniciarSistema(); return;
    }
    await signInWithEmailAndPassword(auth, emailFicticio, senha);
    const uSnap = await getDoc(doc(db, "usuarios", cpf));
    if (uSnap.exists() && uSnap.data().ativo !== false) { usuarioAtual = uSnap.data(); usuarioAtual.cpf = cpf; localStorage.setItem("caatinga_user", JSON.stringify(usuarioAtual)); iniciarSistema();
    } else { throw new Error("Acesso negado."); }
  } catch(e) { document.getElementById('msgLogin').innerText = "Credenciais inválidas."; document.getElementById('msgLogin').classList.remove('oculto'); } finally { loading(false); }
};

function iniciarSistema() {
  document.getElementById('telaLogin').classList.add('oculto'); document.getElementById('sistemaPrincipal').classList.remove('oculto');
  tenant = String(usuarioAtual.empresa_id || "pref_aiuaba").toLowerCase().trim(); if(tenant === "undefined" || tenant === "global") tenant = "pref_aiuaba";
  document.getElementById('lbl-empresa').innerText = tenant.toUpperCase(); document.getElementById('usuarioLogado').innerText = `👤 ${usuarioAtual.nome}`;
  if (!listenerUsuario && usuarioAtual.cpf !== "01305663306") {
      listenerUsuario = onSnapshot(doc(db, "usuarios", usuarioAtual.cpf), (docSnap) => { if (!docSnap.exists() || docSnap.data().ativo === false) { alert("⚠️ Acesso suspenso."); window.sairSistema(true); } });
  }
  window.sincronizarBancoDeDados();
}

window.sincronizarBancoDeDados = async function(manterVistaPasto = false) {
  loading(true, "A sincronizar dados...");
  try {
    const [snapAnimais, snapPesos, snapVac, snapFin, snapEst, snapRep, snapPastos] = await Promise.all([
       getDocs(query(collection(db, "animais"), where("empresa_id", "==", tenant))),
       getDocs(query(collection(db, "pesagens"), where("empresa_id", "==", tenant))),
       getDocs(query(collection(db, "vacinas"), where("empresa_id", "==", tenant))),
       getDocs(query(collection(db, "financeiro"), where("empresa_id", "==", tenant))),
       getDocs(query(collection(db, "estoque"), where("empresa_id", "==", tenant))),
       getDocs(query(collection(db, "reproducao"), where("empresa_id", "==", tenant))),
       getDocs(query(collection(db, "pastos"), where("empresa_id", "==", tenant)))
    ]);
    
    window.BD_ANIMAIS = snapAnimais.docs.map(d => ({id: d.id, ...d.data()}));
    window.BD_PESOS = snapPesos.docs.map(d => d.data());
    window.BD_VACINAS = snapVac.docs.map(d => d.data());
    window.BD_FINANCEIRO = snapFin.docs.map(d => d.data());
    window.BD_ESTOQUE = snapEst.docs.map(d => ({id: d.id, ...d.data()}));
    window.BD_REPRODUCAO = snapRep.docs.map(d => d.data());
    window.BD_PASTOS = snapPastos.docs.map(d => ({id: d.id, ...d.data()}));

    processarDados();
    
    if(manterVistaPasto && pastoSelecionadoAtual) {
       window.abrirDetalhePasto(pastoSelecionadoAtual);
    } else {
       let abaAtiva = document.querySelector('.nav-link.active');
       if(abaAtiva) abaAtiva.click(); else window.navegar('viewPastos', document.querySelectorAll('.nav-link')[1]);
    }

  } catch (e) { console.error(e); alert("Erro ao conectar ao servidor Firebase."); }
  loading(false);
}

function calcularCategoria(nascIso, sexo) {
  if(!nascIso) return "Desconhecido";
  const meses = (new Date() - new Date(nascIso)) / (1000 * 60 * 60 * 24 * 30.44);
  if (sexo === "Fêmea") { if (meses < 10) return "Bezerra"; if (meses < 24) return "Garrota"; if (meses < 36) return "Novilha"; return "Vaca"; } 
  else { if (meses < 10) return "Bezerro"; if (meses < 30) return "Garrote"; return "Touro/Boi"; }
}

function getUAPorCategoria(cat) {
    if(cat.includes("Bezerr")) return 0.3;
    if(cat.includes("Garrot")) return 0.6;
    if(cat.includes("Novilh")) return 0.8;
    if(cat.includes("Touro")) return 1.5;
    return 1.0; 
}

function processarDados() {
  let racas = new Set(), pais = new Set(), maes = new Set(), cats = new Set();
  window.BD_ANIMAIS.forEach(a => {
    a.cat = calcularCategoria(a.nasc, a.sexo);
    a.idadeMeses = a.nasc ? Math.floor((new Date() - new Date(a.nasc)) / (1000 * 60 * 60 * 24 * 30.44)) : 0;
    a.uaAnimal = getUAPorCategoria(a.cat);
    if(a.raca) racas.add(a.raca);
    cats.add(a.cat);
    if(a.sexo === "Macho") pais.add(a.brinco); if(a.sexo === "Fêmea") maes.add(a.brinco);
    if(a.pai) pais.add(a.pai); if(a.mae) maes.add(a.mae);
  });

  const selPastos = document.getElementById('m-pasto');
  selPastos.innerHTML = '<option value="">Sem Pasto Vinculado</option>';
  window.BD_PASTOS.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(p => {
      selPastos.add(new Option(`${p.nome} (${p.sistema||'Pasto'})`, p.nome));
  });
  
  let arrPastos = window.BD_PASTOS.map(p => p.nome).sort();
  updateSelect('f-pasto', arrPastos); updateSelect('d-pasto', arrPastos);
  updateDatalist('l-cat', [...cats].sort()); updateSelect('f-cat', [...cats].sort()); updateSelect('d-cat', [...cats].sort());
  updateDatalist('l-raca', [...racas].sort()); updateDatalist('l-pai', [...pais].sort()); updateDatalist('l-mae', [...maes].sort());
  updateSelect('f-sexo', ["Macho", "Fêmea"]);
}

window.navegar = function(viewId, elAtivo) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.add('oculto'));
  document.getElementById(viewId).classList.remove('oculto');
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  if(elAtivo) elAtivo.classList.add('active');
  pastoSelecionadoAtual = null; 
  
  if(viewId === 'viewDash') window.carregarDash();
  if(viewId === 'viewSimulador') window.carregarSimulador();
  if(viewId === 'viewRebanho') window.renderizarLista(); 
  if(viewId === 'viewCaixa') window.carregarFin();
  if(viewId === 'viewEstoque') window.renderizarEstoque();
  if(viewId === 'viewPastos') window.renderizarPastos();
}

// --- MÓDULO GESTÃO DE PASTOS ---
function getCapacidadePorHa(tipo, sistema) {
    if(sistema && sistema.includes("Confinamento")) return 100.0; 
    if(tipo.includes("Caatinga")) return 0.2;
    if(tipo.includes("Buffel") || tipo.includes("Braquiaria") || tipo.includes("Massai")) return 1.2;
    if(tipo.includes("Mombaca") || tipo.includes("Paredao")) return 2.5;
    if(tipo.includes("Capiacu") || tipo.includes("Palma")) return 5.0;
    return 1.0;
}

window.prepararFormPasto = function() {
    document.getElementById('modalPastoTitulo').innerHTML = '<i class="bi bi-geo-alt"></i> Cadastrar Área / Curral';
    document.getElementById('pst-id').value = "";
    document.getElementById('pst-nome').value = ""; document.getElementById('pst-tam').value = "";
    document.getElementById('pst-sistema').value = "Pasto"; window.togglePastoSistema();
    modalPastoInstancia.show();
}

window.editarPastoSelecionado = function() {
    const p = window.BD_PASTOS.find(x => x.nome === pastoSelecionadoAtual);
    if(!p) return;
    
    document.getElementById('modalPastoTitulo').innerHTML = '<i class="bi bi-pencil"></i> Editar Área / Curral';
    document.getElementById('pst-id').value = p.id;
    document.getElementById('pst-nome').value = p.nome;
    document.getElementById('pst-tam').value = p.tam;
    document.getElementById('pst-medida').value = "Hectares"; 
    document.getElementById('pst-sistema').value = p.sistema || "Pasto";
    window.togglePastoSistema();
    document.getElementById('pst-tipo').value = p.tipo || "Caatinga Nativa";
    
    if(p.sistema && p.sistema.includes("Confinamento")) {
        document.getElementById('pst-racao').value = p.racaoVinculada || "";
        document.getElementById('pst-consumo').value = p.consumoCabeca || "";
    }
    modalPastoInstancia.show();
}

window.excluirPastoSelecionado = async function() {
    const p = window.BD_PASTOS.find(x => x.nome === pastoSelecionadoAtual);
    if(!p) return;

    const ativos = window.BD_ANIMAIS.filter(a => a.status === "Ativo" && a.pasto === pastoSelecionadoAtual);
    if(ativos.length > 0) {
        alert(`Bloqueio de Segurança: Existem ${ativos.length} animais nesta área.\nVocê precisa transferir todo o lote para outro local antes de excluir este pasto.`);
        return;
    }

    if(!confirm(`Tem certeza absoluta que deseja EXCLUIR permanentemente a área: ${p.nome}?`)) return;

    loading(true, "Excluindo área...");
    try {
        await deleteDoc(doc(db, "pastos", p.id));
        pastoSelecionadoAtual = null; 
        showToast("Área Excluída com Sucesso!");
        await window.sincronizarBancoDeDados();
        window.navegar('viewPastos', document.querySelectorAll('.nav-link')[1]);
    } catch(e) { alert("Erro ao excluir pasto."); }
    loading(false);
}

window.togglePastoSistema = function() {
    let sis = document.getElementById('pst-sistema').value;
    if(sis.includes("Confinamento")) {
        document.getElementById('div-pasto-racao').classList.remove('oculto');
        document.getElementById('pst-tipo').value = "Terra Nua";
        const selRacao = document.getElementById('pst-racao');
        selRacao.innerHTML = '<option value="">Sem Ração Vinculada</option>';
        window.BD_ESTOQUE.filter(e => e.tipo === 'Ração' || e.tipo === 'Sal Proteinado').forEach(e => {
            selRacao.add(new Option(`${e.nome} (${e.qtd} ${e.un})`, e.id));
        });
    } else {
        document.getElementById('div-pasto-racao').classList.add('oculto');
    }
}

window.salvarPasto = async function() {
    loading(true, "Salvando Área...");
    try {
       let idEdicao = document.getElementById('pst-id').value;
       let tamBruto = Number(document.getElementById('pst-tam').value);
       let medida = document.getElementById('pst-medida').value;
       if(medida === "Tarefas") tamBruto = tamBruto * 0.3; 

       let nomeLimpo = document.getElementById('pst-nome').value.trim().toUpperCase();

       const obj = { 
           empresa_id: tenant, 
           nome: nomeLimpo, 
           tam: tamBruto, 
           sistema: document.getElementById('pst-sistema').value,
           tipo: document.getElementById('pst-tipo').value 
       };

       if(obj.sistema.includes("Confinamento")) {
           obj.racaoVinculada = document.getElementById('pst-racao').value;
           obj.consumoCabeca = Number(document.getElementById('pst-consumo').value);
       } else {
           obj.racaoVinculada = null;
           obj.consumoCabeca = null;
       }

       if(idEdicao) {
           const pastoAntigo = window.BD_PASTOS.find(p => p.id === idEdicao);
           await setDoc(doc(db, "pastos", idEdicao), obj, {merge:true});
           
           if(pastoAntigo && pastoAntigo.nome !== nomeLimpo) {
               const animaisParaAtualizar = window.BD_ANIMAIS.filter(a => a.pasto === pastoAntigo.nome);
               for(let a of animaisParaAtualizar) {
                   await setDoc(doc(db, "animais", a.id), {pasto: nomeLimpo}, {merge:true});
               }
               if(pastoSelecionadoAtual === pastoAntigo.nome) {
                   pastoSelecionadoAtual = nomeLimpo; 
               }
           }
       } else {
           await addDoc(collection(db, "pastos"), obj);
       }

       modalPastoInstancia.hide();
       showToast("Área Salva!"); 
       await window.sincronizarBancoDeDados(!!pastoSelecionadoAtual);
    } catch(e) { alert("Erro ao salvar área."); }
    loading(false);
}

window.renderizarPastos = function() {
    let html = "";
    const ativos = window.BD_ANIMAIS.filter(a => a.status === "Ativo");
    const hoje = new Date();
    
    window.BD_PASTOS.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(p => {
        let capacidadeSuporteUA = p.tam * getCapacidadePorHa(p.tipo, p.sistema);
        let lotacaoAtualUA = 0; let cabecasNoPasto = 0;
        let sumGmd = 0; let countGmd = 0;

        ativos.forEach(a => { 
            if(a.pasto === p.nome) { 
                lotacaoAtualUA += a.uaAnimal; cabecasNoPasto++; 
                let pesosA = window.BD_PESOS.filter(pw => pw.brinco === a.brinco).sort((x,y) => new Date(x.data) - new Date(y.data));
                if(pesosA.length >= 2) {
                    let p1 = pesosA[pesosA.length-2]; let p2 = pesosA[pesosA.length-1];
                    let dias = (new Date(p2.data) - new Date(p1.data)) / 864e5;
                    if(dias > 0) { sumGmd += (p2.valor - p1.valor) / dias; countGmd++; }
                }
            } 
        });

        let avgGmd = countGmd > 0 ? (sumGmd / countGmd).toFixed(3) + " kg/dia" : "--";
        let percOcupacao = capacidadeSuporteUA > 0 ? (lotacaoAtualUA / capacidadeSuporteUA) * 100 : 0;
        
        let corBarra = "bg-success"; let textStatus = "Lotação Ideal";
        if(percOcupacao > 85) { corBarra = "bg-warning"; textStatus = "Atenção: Limite"; }
        if(percOcupacao > 100) { corBarra = "bg-danger"; textStatus = "Superlotação!"; }

        let infoRodape = "";
        if(cabecasNoPasto > 0 && !p.sistema.includes("Confinamento")) {
            let diasEstimados = Math.floor((capacidadeSuporteUA / lotacaoAtualUA) * 180);
            infoRodape = `<span class="text-dark small fw-bold"><i class="bi bi-clock-history"></i> ~${diasEstimados} dias previstos de pastejo</span>`;
        } else if (cabecasNoPasto === 0) {
            let diasDescanso = p.dataUltimaSaida ? Math.floor((hoje - new Date(p.dataUltimaSaida)) / 864e5) : 0;
            infoRodape = `<span class="text-success small fw-bold"><i class="bi bi-tree"></i> Descansando há ${diasDescanso} dias</span>`;
        } else {
            infoRodape = `<span class="text-primary small fw-bold"><i class="bi bi-bucket"></i> Confinamento Ativo</span>`;
        }

        html += `
        <div class="col-12 col-md-6 col-lg-4">
           <div class="card card-pasto h-100" onclick="window.abrirDetalhePasto('${p.nome}')">
              <div class="card-body">
                 <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                       <h5 class="fw-bold text-dark m-0">${p.nome}</h5>
                       <span class="badge bg-light border text-secondary">${p.sistema || 'Pasto'} • ${p.tam} ha</span>
                    </div>
                    <div class="text-end">
                       <h4 class="fw-bold m-0 text-dark">${cabecasNoPasto}</h4><small class="text-muted" style="font-size:0.7rem;">CABEÇAS</small>
                    </div>
                 </div>
                 
                 <div class="mt-3">
                    <div class="d-flex justify-content-between small fw-bold mb-1">
                       <span class="text-muted">Ocupação (UA)</span>
                       <span class="text-dark">${lotacaoAtualUA.toFixed(1)} / ${capacidadeSuporteUA.toFixed(1)}</span>
                    </div>
                    <div class="progress progress-lota bg-light border"><div class="progress-bar ${corBarra}" style="width: ${Math.min(percOcupacao, 100)}%"></div></div>
                 </div>

                 <div class="d-flex justify-content-between mt-3 pt-2 border-top">
                    ${infoRodape}
                    <span class="text-success small fw-bold"><i class="bi bi-graph-up-arrow"></i> ${avgGmd}</span>
                 </div>
              </div>
           </div>
        </div>`;
    });
    document.getElementById('grid-pastos').innerHTML = html || "<div class='col-12 text-muted text-center py-5'>Nenhuma área cadastrada.</div>";
}

window.abrirDetalhePasto = function(nomePasto) {
    pastoSelecionadoAtual = nomePasto;
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('oculto'));
    document.getElementById('viewPastoDetalhes').classList.remove('oculto');

    const pastoObj = window.BD_PASTOS.find(p => p.nome === nomePasto);
    if(!pastoObj) return;

    document.getElementById('det-pasto-nome').innerText = pastoObj.nome;
    document.getElementById('det-pasto-info').innerText = `${pastoObj.sistema || 'Pasto'} • ${pastoObj.tipo} • ${pastoObj.tam} ha`;

    const ativos = window.BD_ANIMAIS.filter(a => a.status === "Ativo" && a.pasto === nomePasto);
    
    let lotacaoAtualUA = 0; let sumGmd = 0; let countGmd = 0;
    ativos.forEach(a => { 
        lotacaoAtualUA += a.uaAnimal; 
        let pesosA = window.BD_PESOS.filter(pw => pw.brinco === a.brinco).sort((x,y) => new Date(x.data) - new Date(y.data));
        if(pesosA.length >= 2) {
            let p1 = pesosA[pesosA.length-2]; let p2 = pesosA[pesosA.length-1];
            let dias = (new Date(p2.data) - new Date(p1.data)) / 864e5;
            if(dias > 0) { sumGmd += (p2.valor - p1.valor) / dias; countGmd++; }
        }
    });

    let capacidadeSuporteUA = pastoObj.tam * getCapacidadePorHa(pastoObj.tipo, pastoObj.sistema);

    document.getElementById('det-pasto-cabecas').innerText = ativos.length;
    document.getElementById('det-pasto-ua').innerText = `${lotacaoAtualUA.toFixed(1)} / ${capacidadeSuporteUA.toFixed(1)}`;
    document.getElementById('det-pasto-gmd').innerText = countGmd > 0 ? (sumGmd / countGmd).toFixed(3) + " kg/d" : "--";

    if(pastoObj.sistema && pastoObj.sistema.includes("Confinamento") && pastoObj.racaoVinculada && ativos.length > 0) {
        document.getElementById('btn-trato-lote').classList.remove('oculto');
    } else {
        document.getElementById('btn-trato-lote').classList.add('oculto');
    }

    const pesosRecentes = {}; window.BD_PESOS.sort((a,b) => new Date(a.data) - new Date(b.data)).forEach(p => pesosRecentes[p.brinco] = p.valor);
    document.getElementById('det-pasto-animais').innerHTML = ativos.map(a => {
       let pesoMostrado = pesosRecentes[a.brinco] ? `<span class="badge bg-light text-dark border ms-1">${pesosRecentes[a.brinco]}kg</span>` : `<span class="badge bg-light text-danger border ms-1">Peso Desc.</span>`;
       return `
        <div class="col-12 col-md-6 col-lg-4">
          <div class="animal-card ${window.selecionados.includes(a.id)?'selected':''}" onclick="window.cliqueAnimal('${a.id}')">
            <input type="checkbox" class="form-check-input border-secondary" ${window.selecionados.includes(a.id)?'checked':''} onclick="event.stopPropagation(); window.toggleSel('${a.id}')" style="width:20px; height:20px;">
            <div class="badge-id">${a.brinco}</div>
            <div class="flex-grow-1"><div class="fw-bold text-dark lh-1 mb-1">${a.cat} <small class="text-muted">(${a.idadeMeses}m)</small></div>${pesoMostrado}<br><small class="text-secondary" style="font-size:0.7em;">${a.grauSangue||'-'} ${a.raca||''} • ${a.nutricao||'Pasto'}</small></div>
          </div>
        </div>`
    }).join('') || "<div class='text-muted p-3'>Pasto vazio.</div>";
}

window.abrirModalAnimalLote = function() {
    window.abrirModalAnimal();
    document.getElementById('m-pasto').value = pastoSelecionadoAtual;
}

window.transferirLoteCompleto = async function() {
    const pastoObj = window.BD_PASTOS.find(p => p.nome === pastoSelecionadoAtual);
    const ativos = window.BD_ANIMAIS.filter(a => a.status === "Ativo" && a.pasto === pastoSelecionadoAtual);
    if(ativos.length === 0) return alert("Pasto já está vazio.");

    let pastosStr = window.BD_PASTOS.filter(p => p.nome !== pastoSelecionadoAtual).map(p=>p.nome).join('\n- ');
    let destino = prompt(`Para qual pasto/curral deseja mover todas as ${ativos.length} cabeças?\nOpções:\n- ${pastosStr}`);
    if(!destino) return;
    destino = destino.trim().toUpperCase();

    loading(true, "Movimentando Lote...");
    try {
        for(let a of ativos) { await setDoc(doc(db, `animais`, a.id), { pasto: destino, empresa_id: tenant }, {merge:true}); }
        await setDoc(doc(db, `pastos`, pastoObj.id), { dataUltimaSaida: new Date().toISOString() }, {merge:true});
        showToast("Lote transferido com sucesso!"); 
        await window.sincronizarBancoDeDados(false); 
    } catch(e) { alert("Erro ao transferir"); }
    loading(false);
}

window.darTratoLote = async function() {
    const pastoObj = window.BD_PASTOS.find(p => p.nome === pastoSelecionadoAtual);
    const ativos = window.BD_ANIMAIS.filter(a => a.status === "Ativo" && a.pasto === pastoSelecionadoAtual);
    
    if(!pastoObj.racaoVinculada || !pastoObj.consumoCabeca) return alert("Ração não configurada.");
    
    let qtdNecessaria = ativos.length * pastoObj.consumoCabeca;
    if(!confirm(`Fornecer ${qtdNecessaria} kg de ração para as ${ativos.length} cabeças hoje?`)) return;

    const itemEstoque = window.BD_ESTOQUE.find(e => e.id === pastoObj.racaoVinculada);
    if(!itemEstoque) return alert("Ração não encontrada no estoque geral.");
    if(itemEstoque.qtd < qtdNecessaria) return alert(`Estoque insuficiente! Você tem ${itemEstoque.qtd}kg e precisa de ${qtdNecessaria}kg.`);

    loading(true, "Dando baixa na ração...");
    try {
        let novoSaldo = itemEstoque.qtd - qtdNecessaria;
        await setDoc(doc(db, `estoque`, itemEstoque.id), {qtd: novoSaldo}, {merge:true});
        showToast("Trato do Lote Registrado e Estoque atualizado!");
        await window.sincronizarBancoDeDados(true);
    } catch(e) { alert("Erro ao baixar estoque."); }
    loading(false);
}

window.carregarDash = function() {
  const ativos = window.BD_ANIMAIS.filter(a => a.status === "Ativo");
  const mortos = window.BD_ANIMAIS.filter(a => a.status === "Morto").length;
  const totalHistorico = ativos.length + mortos; const taxaMortalidade = totalHistorico > 0 ? ((mortos / totalHistorico) * 100).toFixed(1) : 0;
  let saldo = 0; window.BD_FINANCEIRO.forEach(f => { if(f.tipo === "Receita") saldo += Number(f.valor); else saldo -= Number(f.valor); });

  let lotacaoUA = {}, pesoAcumpasto = {}, contPasto = {};
  const pesosRecentes = {}; window.BD_PESOS.sort((a,b) => new Date(a.data) - new Date(b.data)).forEach(p => pesosRecentes[p.brinco] = p.valor);

  let totalUA = 0;
  ativos.forEach(a => {
    let p = a.pasto || "Sem Pasto";
    let uasAnimal = a.uaAnimal;
    lotacaoUA[p] = (lotacaoUA[p] || 0) + uasAnimal;
    totalUA += uasAnimal;
    if(pesosRecentes[a.brinco]) { pesoAcumpasto[p] = (pesoAcumpasto[p] || 0) + Number(pesosRecentes[a.brinco]); contPasto[p] = (contPasto[p] || 0) + 1; }
  });
  
  let mediaPasto = {}; Object.keys(pesoAcumpasto).forEach(p => mediaPasto[p] = Math.floor(pesoAcumpasto[p] / contPasto[p]));

  let projecao = []; let totalCab = ativos.length; 
  let matrizes = ativos.filter(a => a.sexo === "Fêmea" && (a.cat.includes("Vaca") || a.cat.includes("Novilha"))).length;
  for(let ano=1; ano<=5; ano++){
    let nascimentos = Math.floor(matrizes * 0.75); let vendasExtraidas = Math.floor(totalCab * 0.20); let perdas = Math.floor(totalCab * 0.03);
    totalCab = totalCab + nascimentos - vendasExtraidas - perdas; matrizes += Math.floor(nascimentos * 0.4); projecao.push(totalCab);
  }

  document.getElementById('d-total').innerText = ativos.length; document.getElementById('d-ua-total').innerText = totalUA.toFixed(1) + " UA Totais";
  document.getElementById('d-mortalidade').innerText = taxaMortalidade + "%"; document.getElementById('d-mortos-qtd').innerText = mortos + " baixas";
  document.getElementById('d-saldo').innerText = saldo.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  
  const corPrimaria = '#E06C3F'; const corSecundaria = '#1A374D';
  if(chartP) chartP.destroy(); chartP = new Chart(document.getElementById('chartProj'), { type: 'line', data: { labels: ['Hoje','1 Ano','2 Anos','3 Anos','4 Anos','5 Anos'], datasets: [{label:'Cabeças Estimadas', data: [ativos.length, ...projecao], borderColor: corPrimaria, backgroundColor:'rgba(224, 108, 63, 0.1)', fill:true, tension:0.3}] }, options: {maintainAspectRatio:false, plugins:{legend:{display:false}}} });
  if(chartR) chartR.destroy(); chartR = new Chart(document.getElementById('chartPasto'), { type: 'bar', data: { labels: Object.keys(lotacaoUA), datasets: [{label:'UA por Pasto', data: Object.values(lotacaoUA).map(v => v.toFixed(2)), backgroundColor: corSecundaria}] }, options: {maintainAspectRatio:false, indexAxis:'y', plugins:{legend:{display:false}}} });
  if(chartM) chartM.destroy(); chartM = new Chart(document.getElementById('chartPesoPasto'), { type: 'bar', data: { labels: Object.keys(mediaPasto), datasets: [{label:'Média kg', data: Object.values(mediaPasto), backgroundColor: '#d97706'}] }, options: {maintainAspectRatio:false, plugins:{legend:{display:false}}} });
}

window.carregarSimulador = function() {
  const preco = unmaskMoeda(document.getElementById('sim-arroba').value); const gmd = parseFloat(document.getElementById('sim-gmd').value);
  const precoRacao = unmaskMoeda(document.getElementById('sim-preco-racao').value); const consumoRacao = parseFloat(document.getElementById('sim-consumo-racao').value); const custoProteinado = unmaskMoeda(document.getElementById('sim-custo-proteinado').value);

  const ativos = window.BD_ANIMAIS.filter(a => a.status === "Ativo");
  const pesosRecentes = {}; window.BD_PESOS.sort((a,b) => new Date(a.data) - new Date(b.data)).forEach(p => pesosRecentes[p.brinco] = {peso: p.valor, data: p.data});
  
  let animaisVenda = []; let valorTotBruto = 0; let projReceita = [0,0,0,0,0,0]; let projLucroLiquido = [0,0,0,0,0,0];
  const hoje = new Date(); let qtdAnimaisAvaliados = 0;

  ativos.forEach(a => {
    let pesoAtual = null; let dias = 0;
    if(pesosRecentes[a.brinco]) {
      dias = Math.floor((hoje - new Date(pesosRecentes[a.brinco].data)) / 864e5);
      pesoAtual = Number(pesosRecentes[a.brinco].peso) + (dias * gmd);
      qtdAnimaisAvaliados++;
    }
    
    if(pesoAtual !== null) {
        valorTotBruto += (pesoAtual / 30) * preco; 
        let custoDiario = 0;
        if(a.nutricao === "Semi-Confinamento" || a.nutricao === "Confinamento Total") custoDiario = precoRacao * consumoRacao;
        else if (a.nutricao === "Proteinado") custoDiario = custoProteinado;

        for(let i=0; i<6; i++) {
          let pesoFuturo = pesoAtual + ((i * 30) * gmd); let receitaFutura = (pesoFuturo / 30) * preco; let custoAcumulado = (i * 30) * custoDiario;
          projReceita[i] += receitaFutura; projLucroLiquido[i] += (receitaFutura - custoAcumulado);
        }

        if(pesoAtual >= 350) animaisVenda.push({brinco: a.brinco, cat: a.cat, pesoKg: Math.floor(pesoAtual), valor: (pesoAtual / 30) * preco, dias: dias, nutricao: a.nutricao});
    }
  });

  animaisVenda.sort((a,b) => b.pesoKg - a.pesoKg);
  document.getElementById('s-total-valor').innerText = valorTotBruto.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits:0});
  document.getElementById('s-total-qtd').innerText = `${qtdAnimaisAvaliados} animais com peso conhecido`;
  document.getElementById('lista-venda').innerHTML = animaisVenda.map(a => `<div class="d-flex justify-content-between border-bottom py-2"><div><b class="text-dark">${a.brinco}</b><br><small class="text-muted">${a.cat} • ${a.pesoKg}kg</small><br><small class="text-secondary" style="font-size:0.7em;">${a.nutricao||'Pasto Exclusivo'}</small></div><div class="text-end"><b class="text-success">${a.valor.toLocaleString('pt-BR',{style:'currency', currency:'BRL', maximumFractionDigits:0})}</b><br><small style="color:${a.dias>60?'red':'green'}">${a.dias}d sem pesar</small></div></div>`).join('') || "<small class='text-muted'>Nenhum animal pesando mais que 350kg.</small>";
  
  if(chartS) chartS.destroy(); chartS = new Chart(document.getElementById('chartSim'), { type: 'line', data: { labels: ['Hoje','+1 Mês','+2 Meses','+3 Meses','+4 Meses','+5 Meses'], datasets: [{label:'Receita Bruta Projetada (R$)', data: projReceita, borderColor:'#198754', backgroundColor:'rgba(25, 135, 84, 0.1)', fill:true, tension:0.3}, {label:'Lucro Líquido (Descontando Nutrição)', data: projLucroLiquido, borderColor:'#E06C3F', backgroundColor:'transparent', borderDash: [5, 5], fill:false, tension:0.3}] }, options: {maintainAspectRatio:false} });
}

window.filtrarRecriaPronta = function() {
  document.getElementById('f-status').value = "Ativo"; document.getElementById('f-sexo').value = "Macho"; document.getElementById('f-cat').value = "Garrote"; window.renderizarLista(true); 
}

window.renderizarLista = function(apenasRecria = false) {
  const fsat = document.getElementById('f-status').value; const fp = document.getElementById('f-pasto').value; const fc = document.getElementById('f-cat').value; const fs = document.getElementById('f-sexo').value;
  const filtrados = window.BD_ANIMAIS.filter(a => {
    let passa = (!fsat || a.status === fsat) && (!fp || a.pasto === fp) && (!fs || a.sexo === fs) && (!fc || a.cat === fc);
    if(apenasRecria) passa = passa && a.idadeMeses >= 18 && a.idadeMeses <= 24 && a.sexo === "Macho" && a.status === "Ativo";
    return passa;
  });
  
  const pesosRecentes = {}; window.BD_PESOS.sort((a,b) => new Date(a.data) - new Date(b.data)).forEach(p => pesosRecentes[p.brinco] = p.valor);

  document.getElementById('lista-render').innerHTML = filtrados.sort((a,b)=> (a.pasto||"").localeCompare(b.pasto||"")).map(a => {
    let extraClass = a.status === 'Morto' ? 'morto' : (a.status === 'Vendido' ? 'vendido' : '');
    let badgeStatus = ''; if(a.status === 'Morto') badgeStatus = '<span class="badge bg-dark ms-1">Morto</span>'; if(a.status === 'Vendido') badgeStatus = '<span class="badge bg-success ms-1">Vendido</span>';
    let pesoMostrado = pesosRecentes[a.brinco] ? `<span class="badge bg-light text-dark border ms-1">${pesosRecentes[a.brinco]}kg</span>` : `<span class="badge bg-light text-danger border ms-1">Peso Desc.</span>`;

    return `
    <div class="col-12 col-md-6 col-lg-4">
      <div class="animal-card ${extraClass} ${window.selecionados.includes(a.id)?'selected':''}" onclick="window.cliqueAnimal('${a.id}')">
        <input type="checkbox" class="form-check-input border-secondary" ${window.selecionados.includes(a.id)?'checked':''} onclick="event.stopPropagation(); window.toggleSel('${a.id}')" style="width:20px; height:20px;">
        <div class="badge-id">${a.brinco}</div>
        <div class="flex-grow-1"><div class="fw-bold text-dark lh-1 mb-1">${a.cat} <small class="text-muted">(${a.idadeMeses}m)</small>${badgeStatus}</div><span class="badge bg-light text-dark border"><i class="bi bi-geo-alt"></i> ${a.pasto||'S/ Pasto'}</span>${pesoMostrado}<br><small class="text-secondary" style="font-size:0.7em;">${a.grauSangue||'-'} ${a.raca||''} • ${a.nutricao||'Pasto'}</small></div>
        <div class="text-end small text-muted lh-1"><span class="badge ${a.sexo==='Macho'?'bg-primary':'bg-danger'} mt-1">${a.sexo.charAt(0)}</span></div>
      </div>
    </div>`
  }).join('') || `<div class="col-12 text-center text-muted mt-5">Nenhum animal encontrado.</div>`;
}

window.cliqueAnimal = function(id) { if(window.selecionados.length) window.toggleSel(id); else window.abrirEdicao(id); }
window.toggleSel = function(id) { const i = window.selecionados.indexOf(id); if(i>-1) window.selecionados.splice(i,1); else window.selecionados.push(id); document.getElementById('mass-bar').style.display=window.selecionados.length?'flex':'none'; document.getElementById('count-sel').innerText=window.selecionados.length+' selecionados'; window.renderizarLista(); if(pastoSelecionadoAtual) window.abrirDetalhePasto(pastoSelecionadoAtual); }
window.cancelarSel = function() { window.selecionados=[]; document.getElementById('mass-bar').style.display='none'; window.renderizarLista(); if(pastoSelecionadoAtual) window.abrirDetalhePasto(pastoSelecionadoAtual); }

window.salvarAnimal = async function() {
  const btnSalvar = document.getElementById('btn-salvar-ficha'); btnSalvar.disabled = true; btnSalvar.innerText = "Aguarde...";
  const isAno = document.getElementById('cb-ano').checked;
  let dtNasc = null;
  if(isAno && document.getElementById('m-nasc-ano').value) dtNasc = new Date(document.getElementById('m-nasc-ano').value, 0, 1).toISOString();
  else if(document.getElementById('m-nasc').value) dtNasc = new Date(document.getElementById('m-nasc').value + "T12:00:00").toISOString();
  
  const valCompraNum = unmaskMoeda(document.getElementById('m-valor-compra').value);
  const lancarNoCaixa = document.getElementById('m-lancar-caixa').checked;
  const oldId = document.getElementById('m-id').value;
  const oldAnimal = oldId ? window.BD_ANIMAIS.find(a => a.id === oldId) : null;
  const newPasto = document.getElementById('m-pasto').value;

  const obj = {
    empresa_id: tenant, brinco: document.getElementById('m-brinco').value, nasc: dtNasc, sexo: document.getElementById('m-sexo').value, pasto: newPasto,
    raca: document.getElementById('m-raca').value, grauSangue: document.getElementById('m-grau-sangue').value, nutricao: document.getElementById('m-nutricao').value,
    status: document.getElementById('m-status').value, pai: document.getElementById('m-pai').value, mae: document.getElementById('m-mae').value,
    origem: document.getElementById('m-origem').value, valorCompra: valCompraNum
  };

  if(!obj.brinco) { alert("O número do Brinco é obrigatório!"); btnSalvar.disabled = false; btnSalvar.innerText = "Guardar Ficha"; return; }
  const docId = oldId || "AN-" + Date.now();
  
  loading(true, "A Guardar Ficha...");
  try {
    const arquivoInput = document.getElementById('m-arquivo');
    if (arquivoInput.files.length > 0) {
        const file = arquivoInput.files[0];
        try {
           const storageRef = ref(storage, `${tenant}_registros/${docId}_${file.name}`);
           await uploadBytes(storageRef, file);
           obj.urlRegistro = await getDownloadURL(storageRef);
        } catch(errFile) { alert("Não foi possível salvar o arquivo PDF/Foto."); }
    }

    await setDoc(doc(db, `animais`, docId), obj, {merge: true});
    
    if(obj.origem === "Compra" && valCompraNum > 0 && lancarNoCaixa) {
      await addDoc(collection(db, `financeiro`), { empresa_id: tenant, data: new Date().toISOString(), tipo: "Despesa", cat: "Compra Gado", desc: `Aquisição animal: ${obj.brinco}`, valor: valCompraNum });
    }

    if(oldAnimal && oldAnimal.pasto && oldAnimal.pasto !== newPasto) {
        const remanescentes = window.BD_ANIMAIS.filter(a => a.status === "Ativo" && a.pasto === oldAnimal.pasto && a.id !== docId).length;
        if(remanescentes === 0) {
            const pVelho = window.BD_PASTOS.find(p => p.nome === oldAnimal.pasto);
            if(pVelho) await setDoc(doc(db, `pastos`, pVelho.id), { dataUltimaSaida: new Date().toISOString() }, {merge:true});
        }
    }
    
    modalInstancia.hide(); showToast("Ficha gravada com sucesso!"); 
    await window.sincronizarBancoDeDados(!!pastoSelecionadoAtual);
  } catch(e) { alert("Erro ao guardar: " + e.message); }
  btnSalvar.disabled = false; btnSalvar.innerText = "Guardar Ficha";
  loading(false);
}

window.acaoMassa = async function(acao) {
  if(acao === 'Morto' && !confirm(`Deseja registar o ÓBITO de ${window.selecionados.length} animais?`)) return;
  let val = null;
  if(acao === 'Vender') val = prompt("Valor Total recebido pelo Lote (Ex: 15000.50):");
  if(acao === 'Mover') {
     let pastosStr = window.BD_PASTOS.map(p=>p.nome).join('\n- ');
     val = prompt(`Digite o Nome do Novo Pasto:\nOpções:\n- ${pastosStr}`);
     if(val) val = val.trim().toUpperCase();
  }
  if(acao === 'Vacinar') val = prompt("Nome da Vacina ou Medicamento a aplicar no lote:");
  if((acao === 'Vender' || acao === 'Mover' || acao === 'Vacinar') && !val) return;
  
  loading(true, "A Processar Lote...");
  try {
    if(acao === 'Vacinar') {
        for(let id of window.selecionados) {
           let an = window.BD_ANIMAIS.find(a => a.id === id);
           if(an) await addDoc(collection(db, "vacinas"), { empresa_id: tenant, brinco: an.brinco, data: new Date().toISOString(), nome: val });
        }
    } else {
        for(let id of window.selecionados) {
          let update = { empresa_id: tenant };
          if(acao === 'Vender') update.status = "Vendido";
          if(acao === 'Mover') update.pasto = val; 
          if(acao === 'Morto') { update.status = "Morto"; update.dataMorte = new Date().toISOString(); }
          await setDoc(doc(db, `animais`, id), update, {merge:true});
        }
        if(acao === 'Vender' && Number(val.replace(',','.')) > 0) {
          let brincosSel = window.BD_ANIMAIS.filter(a => window.selecionados.includes(a.id)).map(a=>a.brinco).join(', ');
          await addDoc(collection(db, `financeiro`), { empresa_id: tenant, data: new Date().toISOString(), tipo: "Receita", cat: "Venda Animal", desc: `Lote de ${window.selecionados.length} cab. (${brincosSel})`, valor: Number(val.replace(',','.')) });
        }
    }
    window.cancelarSel(); showToast("Operação em Lote efetuada!"); 
    await window.sincronizarBancoDeDados(!!pastoSelecionadoAtual);
  } catch(e) { alert("Erro na operação em massa."); }
  loading(false);
}

window.vendaIndividual = async function() {
  const id = document.getElementById('m-id').value; const brinco = document.getElementById('m-brinco').value;
  const v = prompt("Qual o valor da venda deste animal (Ex: 3500.00)?"); if(!v) return;
  loading(true, "A Registar Venda...");
  try {
    await setDoc(doc(db, `animais`, id), {status: "Vendido"}, {merge: true});
    await addDoc(collection(db, `financeiro`), { empresa_id: tenant, data: new Date().toISOString(), tipo: "Receita", cat: "Venda Animal", desc: `Venda unitária: ${brinco}`, valor: Number(v.replace(',','.')) });
    modalInstancia.hide(); showToast("Venda Registada no Caixa!"); await window.sincronizarBancoDeDados(!!pastoSelecionadoAtual);
  } catch(e) { alert("Erro de rede."); }
  loading(false);
}

window.morteIndividual = async function() {
  const id = document.getElementById('m-id').value; const motivo = prompt("Qual foi a causa da morte? (Opcional)"); if(motivo === null) return; 
  loading(true, "A Registar Óbito...");
  try {
    await setDoc(doc(db, `animais`, id), {status: "Morto", causaMorte: motivo, dataMorte: new Date().toISOString()}, {merge: true});
    modalInstancia.hide(); showToast("Baixa registada com sucesso!"); await window.sincronizarBancoDeDados(!!pastoSelecionadoAtual);
  } catch(e) { alert("Erro ao registar baixa."); }
  loading(false);
}

window.addHist = async function(tipo) {
  const brinco = document.getElementById('m-brinco').value;
  const v = prompt(tipo === 'Pesagens' ? "Digite o Peso atual lido na Balança (kg):" : "Nome da Vacina aplicada:"); if(!v) return;

  loading(true, "A Lançar...");
  try {
    const col = tipo === 'Pesagens' ? `pesagens` : `vacinas`;
    await addDoc(collection(db, col), { empresa_id: tenant, brinco: brinco, data: new Date().toISOString(), valor: v, nome: v });
    if(tipo === 'Pesagens') window.BD_PESOS.push({brinco: brinco, data: new Date().toISOString(), valor: v});
    else window.BD_VACINAS.push({brinco: brinco, data: new Date().toISOString(), nome: v});
    const an = window.BD_ANIMAIS.find(a => a.brinco === brinco);
    window.refreshHist(brinco, an ? an.nasc : null); showToast("Registo salvo!");
  } catch(e) { alert("Erro ao gravar histórico."); }
  loading(false);
}

function calcCDPM(pesoObj, nascIso) {
  let pesoNum = Number(pesoObj.valor);
  if(!nascIso) return pesoNum + "kg";
  let dias = Math.floor((new Date(pesoObj.data) - new Date(nascIso)) / 864e5);
  if(dias <= 0) return pesoNum + "kg";
  let gmd = (pesoNum - 30) / dias; 
  if(dias >= 90 && dias <= 150) return `<b>${Math.round(30 + (gmd * 120))}kg</b> (P120)`;
  if(dias >= 180 && dias <= 240) return `<b>${Math.round(30 + (gmd * 210))}kg</b> (P210)`;
  if(dias >= 335 && dias <= 395) return `<b>${Math.round(30 + (gmd * 365))}kg</b> (P365)`;
  if(dias >= 420 && dias <= 480) return `<b>${Math.round(30 + (gmd * 450))}kg</b> (P450)`;
  return pesoNum + "kg";
}

window.refreshHist = function(b, nascIso) {
  const pesos = window.BD_PESOS.filter(p => p.brinco === b).sort((x,y) => new Date(x.data) - new Date(y.data)).map(p => ({data: p.data, valor: p.valor}));
  const vacs = window.BD_VACINAS.filter(v => v.brinco === b).sort((x,y) => new Date(y.data) - new Date(x.data)).map(v => ({data: new Date(v.data).toLocaleDateString('pt-BR'), nome: v.nome}));
  
  document.getElementById('render-pesos').innerHTML = pesos.slice().reverse().map(p=>`<div class="d-flex justify-content-between border-bottom py-1"><span>${new Date(p.data).toLocaleDateString('pt-BR')}</span><span class="text-dark">${calcCDPM(p, nascIso)} <small class="text-muted">| ${p.valor}kg real</small></span></div>`).join('');
  document.getElementById('render-vacinas').innerHTML = vacs.map(v=>`<div class="d-flex justify-content-between border-bottom py-1"><span>${v.data}</span><b class="text-primary">${v.nome}</b></div>`).join('');
  if(chartW) chartW.destroy(); chartW = new Chart(document.getElementById('chartPesoInd'), { type:'line', data:{labels:pesos.map(p=>new Date(p.data).toLocaleDateString('pt-BR')), datasets:[{label:'Evolução (kg)', data:pesos.map(p=>p.valor), borderColor:'#E06C3F', backgroundColor:'rgba(224, 108, 63, 0.1)', fill:true, tension: 0.2}]}, options:{maintainAspectRatio:false, plugins:{legend:{display:false}}} });
}

window.salvarRepro = async function() {
    const b = document.getElementById('m-brinco').value; const tipo = document.getElementById('rep-tipo').value; const touro = document.getElementById('rep-touro').value; const dataR = document.getElementById('rep-data').value;
    if(!b || !dataR) return alert("Informe a data do procedimento.");
    const dataBase = new Date(dataR + "T12:00:00"); const prevParto = new Date(dataBase.getTime() + (290 * 864e5)).toISOString();

    loading(true, "Registrando Reprodução...");
    try {
       const obj = { empresa_id: tenant, brinco: b, tipo: tipo, touro: touro, data: dataBase.toISOString(), prevParto: prevParto };
       await addDoc(collection(db, "reproducao"), obj); window.BD_REPRODUCAO.push(obj); window.refreshRepro(b);
       document.getElementById('rep-touro').value = ""; document.getElementById('rep-data').value = ""; showToast("Biotecnologia Salva!");
    } catch(e) { alert("Erro ao salvar."); }
    loading(false);
}

window.refreshRepro = function(b) {
    const hist = window.BD_REPRODUCAO.filter(r => r.brinco === b).sort((x,y) => new Date(y.data) - new Date(x.data));
    document.getElementById('render-repro').innerHTML = hist.map(r => `<div class="border-bottom py-1"><div class="d-flex justify-content-between"><b class="text-dark">${r.tipo}</b> <span class="badge bg-secondary">${new Date(r.data).toLocaleDateString('pt-BR')}</span></div><div class="text-muted small">Touro/Sêmen: ${r.touro||'Não informado'}</div><div class="text-primary small fw-bold mt-1">⏳ Prev. Parto: ${new Date(r.prevParto).toLocaleDateString('pt-BR')}</div></div>`).join('') || "<div class='text-muted p-2'>Nenhum procedimento registrado.</div>";
}

window.salvarEstoque = async function() {
    loading(true, "Adicionando ao Estoque...");
    try {
       const obj = { empresa_id: tenant, tipo: document.getElementById('est-tipo').value, nome: document.getElementById('est-nome').value, qtd: Number(document.getElementById('est-qtd').value), un: document.getElementById('est-un').value, data: new Date().toISOString() };
       await addDoc(collection(db, "estoque"), obj);
       document.getElementById('est-nome').value = ""; document.getElementById('est-qtd').value = "";
       showToast("Item Adicionado!"); await window.sincronizarBancoDeDados();
    } catch(e) { alert("Erro no estoque."); }
    loading(false);
}

window.darBaixaEstoque = async function(idObj, nome, un) {
    const qtdBaixa = prompt(`Quantos(as) ${un} de ${nome} você utilizou/saiu agora?`);
    if(!qtdBaixa || isNaN(qtdBaixa)) return;
    
    const itemDB = window.BD_ESTOQUE.find(e => e.id === idObj);
    if(!itemDB) return;
    let novoSaldo = itemDB.qtd - Number(qtdBaixa);
    if(novoSaldo < 0) novoSaldo = 0; 

    loading(true, "Dando baixa...");
    try {
       await setDoc(doc(db, `estoque`, idObj), {qtd: novoSaldo}, {merge:true});
       showToast("Baixa realizada com sucesso!"); await window.sincronizarBancoDeDados();
    } catch(e) { alert("Erro ao dar baixa."); }
    loading(false);
}

window.renderizarEstoque = function() {
    let html = "";
    window.BD_ESTOQUE.sort((a,b) => new Date(b.data) - new Date(a.data)).forEach(e => {
        html += `
        <div class="d-flex justify-content-between align-items-center border-bottom py-3 px-3">
           <div><b class="text-dark">${e.nome}</b><br><span class="badge bg-light text-secondary border">${e.tipo}</span></div>
           <div class="text-end">
               <div class="fw-bold text-primary fs-5">${e.qtd} <small class="text-muted fs-6">${e.un}</small></div>
               <button class="btn btn-sm btn-outline-danger mt-1 fw-bold" onclick="window.darBaixaEstoque('${e.id}', '${e.nome}', '${e.un}')"><i class="bi bi-box-arrow-right"></i> Dar Baixa (Uso Manual)</button>
           </div>
        </div>`;
    });
    document.getElementById('est-lista').innerHTML = html || "<div class='p-3 text-muted text-center'>Estoque vazio. Adicione insumos primeiro.</div>";
}

window.refreshArvore = function(bAlvo) {
  const map = {}; window.BD_ANIMAIS.forEach(a => map[a.brinco] = a);
  function getNode(brinco, nivel) { if(nivel>5 || !brinco || !map[brinco]) return null; const d = map[brinco]; return { name: brinco, raca: d.raca||"?", pai: getNode(d.pai, nivel+1), mae: getNode(d.mae, nivel+1) }; }
  
  const raiz = getNode(bAlvo, 1);
  function build(n) { if(!n) return ''; let h=`<li><div class="tree-box"><b class="text-dark">${n.name}</b><br><span class="text-muted">${n.raca}</span></div>`; if(n.pai||n.mae) h+=`<ul>${n.pai?build(n.pai):'<li><div class="tree-box text-muted">?</div></li>'}${n.mae?build(n.mae):'<li><div class="tree-box text-muted">?</div></li>'}</ul>`; return h+'</li>'; }
  document.getElementById('render-tree').innerHTML = raiz ? `<ul>${build(raiz)}</ul>` : "<div class='text-center p-3 text-muted'>Sem árvore genealógica registada.</div>";
}

window.salvarFin = async function() {
  loading(true, "A Lançar no Caixa...");
  try {
    await addDoc(collection(db, `financeiro`), { empresa_id: tenant, data: new Date().toISOString(), tipo: document.getElementById('fin-tipo').value, cat: document.getElementById('fin-cat').value, desc: document.getElementById('fin-desc').value, valor: unmaskMoeda(document.getElementById('fin-valor').value) });
    document.getElementById('fin-valor').value = ""; document.getElementById('fin-desc').value = "";
    showToast("Lançamento Efetuado!"); await window.sincronizarBancoDeDados();
  } catch(e) { alert("Erro ao aceder ao Caixa."); }
  loading(false);
}

window.carregarFin = function() {
  let entradas = 0; let saidas = 0;
  const div = document.getElementById('fin-extrato');
  div.innerHTML = window.BD_FINANCEIRO.sort((a,b) => new Date(b.data) - new Date(a.data)).map(r => {
    if(r.tipo === 'Receita') entradas += Number(r.valor); else saidas += Number(r.valor);
    return `
    <div class="d-flex justify-content-between align-items-center border-bottom py-2 px-3">
      <div><b class="text-dark">${r.cat}</b><br><small class="text-muted">${r.desc||'-'}</small></div>
      <div class="fw-bold ${r.tipo==='Receita'?'text-success':'text-danger'} fs-6">${r.tipo==='Receita'?'+':'-'} ${Number(r.valor).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</div>
    </div>`;
  }).join('');

  document.getElementById('cx-entradas').innerText = entradas.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  document.getElementById('cx-saidas').innerText = saidas.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  document.getElementById('cx-saldo').innerText = (entradas - saidas).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
}

function updateSelect(id, arr) { const s = document.getElementById(id); if(!s) return; const v = s.value; while(s.options.length>1) s.remove(1); arr.forEach(i => s.add(new Option(i,i))); if(v) s.value=v; }
function updateDatalist(id, arr) { const dl = document.getElementById(id); if(!dl) return; dl.innerHTML=''; arr.forEach(i => { let o = document.createElement('option'); o.value=i; dl.appendChild(o); }); }
 
window.toggleRepro = function() {
    const sexo = document.getElementById('m-sexo').value; const navRepro = document.getElementById('nav-repro');
    if(sexo === 'Fêmea') navRepro.classList.remove('oculto'); else navRepro.classList.add('oculto');
}

window.abrirEdicao = function(id) {
  const a = window.BD_ANIMAIS.find(i => i.id === id);
  document.getElementById('m-id').value = a.id; document.getElementById('m-brinco').value = a.brinco; document.getElementById('m-brinco').readOnly = true;
  document.getElementById('cb-ano').checked = false; window.toggleNasc(); document.getElementById('m-nasc').value = formatDateLocal(a.nasc);
  document.getElementById('m-sexo').value = a.sexo; document.getElementById('m-pasto').value = a.pasto||''; document.getElementById('display-cat').innerText = a.cat;
  
  document.getElementById('m-raca').value = a.raca||''; document.getElementById('m-grau-sangue').value = a.grauSangue||'Indefinido';
  document.getElementById('m-nutricao').value = a.nutricao||'Pasto Exclusivo';
  document.getElementById('m-status').value = a.status||'Ativo'; document.getElementById('m-pai').value = a.pai||""; document.getElementById('m-mae').value = a.mae||"";
  document.getElementById('m-origem').value = a.origem||"Nascimento"; window.toggleOrigem();
  document.getElementById('m-lancar-caixa').checked = false; 
  
  let ipCompra = document.getElementById('m-valor-compra');
  ipCompra.value = a.valorCompra ? a.valorCompra.toFixed(2).replace('.', ',') : ""; window.mascaraMoeda(ipCompra);

  const divLink = document.getElementById('m-link-arquivo');
  const inputArq = document.getElementById('m-arquivo');
  inputArq.value = ""; 
  if(a.urlRegistro) {
      divLink.classList.remove('oculto');
      divLink.innerHTML = `<a href="${a.urlRegistro}" target="_blank" class="badge bg-primary text-decoration-none p-2"><i class="bi bi-file-earmark-pdf"></i> Visualizar Documento</a>`;
  } else { divLink.classList.add('oculto'); }

  const isAtivo = a.status === 'Ativo';
  document.getElementById('btn-vender-indiv').classList.toggle('oculto', !isAtivo); document.getElementById('btn-morte-indiv').classList.toggle('oculto', !isAtivo);
  
  window.toggleRepro(); window.refreshHist(a.brinco, a.nasc); window.refreshArvore(a.brinco); window.refreshRepro(a.brinco);
  document.querySelector('#tab-ficha').classList.add('show', 'active'); document.querySelector('#tab-peso').classList.remove('show', 'active'); document.querySelector('#tab-arvore').classList.remove('show', 'active'); document.querySelector('#tab-repro').classList.remove('show', 'active');
  document.querySelectorAll('.nav-pills .nav-link').forEach((el, idx) => { if(idx===0) el.classList.add('active'); else el.classList.remove('active'); });
  modalInstancia.show();
}

window.abrirModalAnimal = function() { 
  document.querySelectorAll('#modalAnimal input').forEach(i=> { if(i.type !== 'checkbox') i.value="" }); 
  document.getElementById('m-brinco').readOnly=false; document.getElementById('display-cat').innerText="Calculado auto."; 
  document.getElementById('m-origem').value = "Nascimento"; window.toggleOrigem(); 
  document.getElementById('m-lancar-caixa').checked = true; 
  document.getElementById('m-grau-sangue').value = "Indefinido"; document.getElementById('m-nutricao').value = "Pasto Exclusivo";
  document.getElementById('m-pasto').value = ""; document.getElementById('m-link-arquivo').classList.add('oculto');
  document.getElementById('btn-vender-indiv').classList.add('oculto'); document.getElementById('btn-morte-indiv').classList.add('oculto');
  document.getElementById('cb-ano').checked=false; window.toggleNasc(); document.getElementById('m-status').value = "Ativo";
  
  window.toggleRepro();
  document.querySelector('#tab-ficha').classList.add('show', 'active'); document.querySelector('#tab-peso').classList.remove('show', 'active'); document.querySelector('#tab-arvore').classList.remove('show', 'active'); document.querySelector('#tab-repro').classList.remove('show', 'active');
  document.querySelectorAll('.nav-pills .nav-link').forEach((el, idx) => { if(idx===0) el.classList.add('active'); else el.classList.remove('active'); });
  modalInstancia.show(); 
}

window.toggleOrigem = function() { const o = document.getElementById('m-origem').value; if(o === 'Compra') document.getElementById('div-valor-compra').classList.remove('oculto'); else document.getElementById('div-valor-compra').classList.add('oculto'); }
window.toggleNasc = function() { const c = document.getElementById('cb-ano').checked; if(c) { document.getElementById('m-nasc').classList.add('oculto'); document.getElementById('m-nasc-ano').classList.remove('oculto'); } else { document.getElementById('m-nasc').classList.remove('oculto'); document.getElementById('m-nasc-ano').classList.add('oculto'); } }
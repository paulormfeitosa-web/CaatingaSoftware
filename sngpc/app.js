import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDoc, getDocs, doc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = { apiKey: "AIzaSyBOEgd1WCElKtngAcQ-ygnx0_2lpHLUAyM", authDomain: "caatingasoftware.firebaseapp.com", projectId: "caatingasoftware", storageBucket: "caatingasoftware.firebasestorage.app", appId: "1:357801806903:web:7b03d8f9f0189bf32943b2" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); 

let usuarioAtual = null; let tenant = ""; 

window.BD_ESTOQUE = []; window.BD_RECEITAS = []; window.BD_ENTRADAS = []; window.BD_MEDICOS = []; window.BD_PACIENTES = [];
window.carrinhoVenda = []; window.carrinhoNF = [];

let mEstoque, mMed, mPac;
let tsNfProd, tsRecProd, tsRecMed, tsRecPac;

function loading(show, msg="Carregando...") { document.getElementById('loading-msg').innerText = msg; document.getElementById('loadingOverlay').classList.toggle('oculto', !show); }
window.showToast = function(msg) { document.getElementById('toastMsg').innerText = msg; new bootstrap.Toast(document.getElementById('liveToast')).show(); };
window.navegar = function(id, el) { document.querySelectorAll('.view-section').forEach(v=>v.classList.add('oculto')); document.getElementById(id).classList.remove('oculto'); document.querySelectorAll('.nav-link').forEach(n=>n.classList.remove('active')); if(el) el.classList.add('active'); }

window.maskMS = (v) => { let n = v.replace(/\D/g, ""); return n.replace(/^(\d{1})(\d)/, "$1.$2").replace(/^(\d{1}\.\d{4})(\d)/, "$1.$2").replace(/^(\d{1}\.\d{4}\.\d{4})(\d)/, "$1.$2").replace(/^(\d{1}\.\d{4}\.\d{4}\.\d{3})(\d)/, "$1-$2"); };
window.maskCPF = (v) => { let n = v.replace(/\D/g, ""); return n.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3}\.\d{3})(\d)/, "$1.$2").replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, "$1-$2"); };
window.maskCNPJ = (v) => { let n = v.replace(/\D/g, ""); return n.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2}\.\d{3})(\d)/, "$1.$2").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2"); };

const fCPF = (v) => { let n = v.replace(/\D/g,""); return n.length===11 ? window.maskCPF(v) : v; };
const fMS = (v) => window.maskMS(v);

window.onload = function() {
  mEstoque = new bootstrap.Modal(document.getElementById('modalEstoque'));
  mMed = new bootstrap.Modal(document.getElementById('modalMedico'));
  mPac = new bootstrap.Modal(document.getElementById('modalPaciente'));
  
  document.getElementById('recData').valueAsDate = new Date();
  document.getElementById('nfData').valueAsDate = new Date();
  
  let ontem = new Date(); ontem.setDate(ontem.getDate() - 1); document.getElementById('xmlDataFim').valueAsDate = ontem;
  let inicio = new Date(); inicio.setDate(inicio.getDate() - 8); document.getElementById('xmlDataInicio').valueAsDate = inicio;

  onAuthStateChanged(auth, async (userAuth) => {
      const cracha = localStorage.getItem("caatinga_user");
      if(userAuth && cracha) { usuarioAtual = JSON.parse(cracha); iniciarSistema(); } 
      else { document.getElementById('telaLogin').classList.remove('oculto'); document.getElementById('sistemaPrincipal').classList.add('oculto'); }
  });
};

window.logar = async function() {
  const cpf = document.getElementById('loginCpf').value.replace(/\D/g, '');
  const senha = document.getElementById('loginSenha').value;
  const err = document.getElementById('msgLogin'); err.classList.add('oculto');
  if(cpf === "01305663306" && senha === "pr10mf86") { 
      try {
          await signInWithEmailAndPassword(auth, cpf + "@feitosa.app", senha);
          usuarioAtual = { nome: "Farmacêutico RT", crf: "CRF-CE 1234", empresa_id: "farma_teste", cpf: cpf };
          localStorage.setItem("caatinga_user", JSON.stringify(usuarioAtual)); 
      } catch(e) { err.innerText = "Erro ao autenticar administrador."; err.classList.remove('oculto'); }
      return;
  } 
};

window.sairSistema = function() { localStorage.removeItem("caatinga_user"); signOut(auth).then(() => { location.reload(); }); }

function iniciarSistema() {
  document.getElementById('telaLogin').classList.add('oculto'); document.getElementById('sistemaPrincipal').classList.remove('oculto');
  tenant = String(usuarioAtual.empresa_id || "farma_teste").toLowerCase().trim();
  document.getElementById('usuarioLogado').innerText = usuarioAtual.nome;
  const creds = localStorage.getItem("caatinga_sngpc_creds"); if(creds) document.getElementById('sngpcCNPJ').value = JSON.parse(creds).cnpj || "";
  window.sincronizarBD();
}

window.salvarCredenciaisSNGPC = function() { localStorage.setItem("caatinga_sngpc_creds", JSON.stringify({cnpj: document.getElementById('sngpcCNPJ').value})); window.showToast("CNPJ salvo com sucesso!"); }

window.gerarXMLSNGPC = function(tipo, dInicio = null, dFim = null) {
    const dataAtual = new Date().toISOString().split('T')[0];
    const cnpjLimpo = (document.getElementById('sngpcCNPJ').value || "").replace(/\D/g, '');
    if (!cnpjLimpo || cnpjLimpo.length !== 14) return alert("Erro: Informe um CNPJ válido com 14 dígitos.");
    const cpfTransmissorLimpo = (usuarioAtual.cpf || '00000000000').replace(/\D/g, '');

    let xml = `<?xml version="1.0" encoding="ISO-8859-1"?>\n`;

    if (tipo === 'INVENTARIO') {
        xml += `<mensagemSNGPCInventario xmlns="urn:sngpc-schema">\n  <cabecalho>\n    <cnpjEmissor>${cnpjLimpo}</cnpjEmissor>\n    <cpfTransmissor>${cpfTransmissorLimpo}</cpfTransmissor>\n    <data>${dataAtual}</data>\n  </cabecalho>\n  <corpo>\n    <medicamentos>\n`;
        window.BD_ESTOQUE.forEach(med => {
            (med.lotes || []).forEach(l => {
                if (l.qtd > 0) {
                    xml += `      <entradaMedicamentos>\n        <medicamentoEntrada>\n          <classeTerapeutica>1</classeTerapeutica>\n          <registroMSMedicamento>${med.ms.replace(/\D/g, '')}</registroMSMedicamento>\n          <numeroLoteMedicamento>${l.numero}</numeroLoteMedicamento>\n          <quantidadeMedicamento>${l.qtd}</quantidadeMedicamento>\n          <unidadeMedidaMedicamento>1</unidadeMedidaMedicamento>\n        </medicamentoEntrada>\n      </entradaMedicamentos>\n`; 
                }
            });
        });
        xml += `    </medicamentos>\n    <insumos></insumos>\n  </corpo>\n</mensagemSNGPCInventario>`;
    } 
    else if (tipo === 'MOVIMENTACAO') {
        const entradasPends = window.BD_ENTRADAS.filter(x => x.statusTx === 'Pendente' && x.data >= dInicio && x.data <= dFim);
        const receitasPends = window.BD_RECEITAS.filter(x => x.statusTx === 'Pendente' && x.dataVenda >= dInicio && x.dataVenda <= dFim);
        
        if(entradasPends.length === 0 && receitasPends.length === 0) return null; 
        
        xml += `<mensagemSNGPC xmlns="urn:sngpc-schema">\n  <cabecalho>\n    <cnpjEmissor>${cnpjLimpo}</cnpjEmissor>\n    <cpfTransmissor>${cpfTransmissorLimpo}</cpfTransmissor>\n    <dataInicio>${dInicio}</dataInicio>\n    <dataFim>${dFim}</dataFim>\n  </cabecalho>\n  <corpo>\n    <medicamentos>\n`;
        
        if(entradasPends.length > 0) {
            entradasPends.forEach(nf => {
                xml += `      <entradaMedicamentos>\n`;
                xml += `        <notaFiscalEntradaMedicamento>\n`;
                xml += `          <numeroNotaFiscal>${nf.numero}</numeroNotaFiscal>\n`;
                xml += `          <tipoOperacaoNotaFiscal>1</tipoOperacaoNotaFiscal>\n`; 
                xml += `          <dataNotaFiscal>${nf.data}</dataNotaFiscal>\n`;
                xml += `          <cnpjOrigem>${nf.cnpjOrigem.replace(/\D/g, '')}</cnpjOrigem>\n`;
                xml += `          <cnpjDestino>${cnpjLimpo}</cnpjDestino>\n`; 
                xml += `        </notaFiscalEntradaMedicamento>\n`;
                
                (nf.itens || []).forEach(item => {
                    xml += `        <medicamentoEntrada>\n`;
                    xml += `          <classeTerapeutica>1</classeTerapeutica>\n`;
                    xml += `          <registroMSMedicamento>${item.ms.replace(/\D/g, '')}</registroMSMedicamento>\n`;
                    xml += `          <numeroLoteMedicamento>${item.numLote}</numeroLoteMedicamento>\n`;
                    xml += `          <quantidadeMedicamento>${item.qtd}</quantidadeMedicamento>\n`;
                    xml += `          <unidadeMedidaMedicamento>1</unidadeMedidaMedicamento>\n`;
                    xml += `        </medicamentoEntrada>\n`;
                });
                
                xml += `        <dataRecebimentoMedicamento>${nf.data}</dataRecebimentoMedicamento>\n`;
                xml += `      </entradaMedicamentos>\n`;
            });
        }
        receitasPends.forEach(rec => {
            xml += `      <saidaMedicamentoVendaAoConsumidor>\n`;
            xml += `        <tipoReceituarioMedicamento>${rec.tipoReceita}</tipoReceituarioMedicamento>\n`;
            
            let numNotifLimpo = (rec.numNotificacao || '').substring(0, 10).trim();
            xml += `        <numeroNotificacaoMedicamento>${numNotifLimpo}</numeroNotificacaoMedicamento>\n`;
            
            xml += `        <dataPrescricaoMedicamento>${rec.dataPrescricao}</dataPrescricaoMedicamento>\n`;
            
            let ufConselhoFinal = (rec.uf && rec.uf.trim() !== '') ? rec.uf.toUpperCase() : 'CE';
            xml += `        <prescritorMedicamento>\n          <nomePrescritor>${rec.prescritorNome}</nomePrescritor>\n          <numeroRegistroProfissional>${rec.crm}</numeroRegistroProfissional>\n          <conselhoProfissional>CRM</conselhoProfissional>\n          <UFConselho>${ufConselhoFinal}</UFConselho>\n        </prescritorMedicamento>\n`;
            
            xml += `        <usoMedicamento>1</usoMedicamento>\n`;
            
            let docLimpo = rec.doc.replace(/\D/g, '');
            
            xml += `        <compradorMedicamento>\n`;
            xml += `          <nomeComprador>${rec.paciente}</nomeComprador>\n`;
            xml += `          <tipoDocumento>1</tipoDocumento>\n`;
            xml += `          <numeroDocumento>${docLimpo}</numeroDocumento>\n`;
            
            let orgaoFinal = (rec.orgao && rec.orgao.trim() !== '') ? rec.orgao.toUpperCase() : 'SSP';
            if(orgaoFinal === 'SSSP' || orgaoFinal === 'SSPSSP' || orgaoFinal.includes('SSP')) {
                orgaoFinal = 'SSP';
            }
            const orgaosValidos = ['SSP','PM','PC','CNH','DIC','CTPS','FGTS','IFP','IPF','IML','MTE','MMA','OAB','CREA','CRM','CRA','COREN','CBM','DPF','EST','SJS','SJTC','CRF','CRO'];
            if(!orgaosValidos.includes(orgaoFinal)) { orgaoFinal = 'SSP'; }
            
            let ufFinal = (rec.ufEmissor && rec.ufEmissor.trim() !== '') ? rec.ufEmissor.toUpperCase() : 'CE';
            xml += `          <orgaoExpedidor>${orgaoFinal}</orgaoExpedidor>\n`;
            xml += `          <UFEmissaoDocumento>${ufFinal}</UFEmissaoDocumento>\n`;
            
            xml += `        </compradorMedicamento>\n`;
            
            (rec.itens || []).forEach(item => {
                xml += `        <medicamentoVenda>\n`;
                xml += `          <usoProlongado>N</usoProlongado>\n`;
                xml += `          <registroMSMedicamento>${item.ms.replace(/\D/g, '')}</registroMSMedicamento>\n`;
                xml += `          <numeroLoteMedicamento>${item.numLote}</numeroLoteMedicamento>\n`;
                xml += `          <quantidadeMedicamento>${item.qtd}</quantidadeMedicamento>\n`;
                xml += `          <unidadeMedidaMedicamento>1</unidadeMedidaMedicamento>\n`;
                xml += `        </medicamentoVenda>\n`;
            });
            
            xml += `        <dataVendaMedicamento>${rec.dataVenda}</dataVendaMedicamento>\n      </saidaMedicamentoVendaAoConsumidor>\n`;
        });
        xml += `    </medicamentos>\n    <insumos></insumos>\n  </corpo>\n</mensagemSNGPC>`;
    }
    return xml;
};

window.descarregarXML = async function(tipo) {
    let dInicio = null; let dFim = null;
    if(tipo === 'MOVIMENTACAO') {
        dInicio = document.getElementById('xmlDataInicio').value;
        dFim = document.getElementById('xmlDataFim').value;
        if(!dInicio || !dFim) return alert("Preencha as datas de início e fim da transmissão.");
        let diffDias = Math.ceil((new Date(dFim) - new Date(dInicio)) / (1000 * 60 * 60 * 24));
        if(diffDias < 0) return alert("A data inicial não pode ser maior que a data final.");
        if(diffDias > 7) return alert("Erro SNGPC: O intervalo de transmissão não pode ser superior a 7 dias.");
    }
    const xml = window.gerarXMLSNGPC(tipo, dInicio, dFim); 
    if (!xml) return alert("Nenhuma movimentação PENDENTE encontrada dentro deste período selecionado."); 
    const zip = new JSZip(); const fileName = `SNGPC_${tipo}_${new Date().getTime()}`;
    zip.file(`${fileName}.xml`, xml);
    const content = await zip.generateAsync({type: "blob"});
    const url = URL.createObjectURL(content); const a = document.createElement('a'); a.href = url; a.download = `${fileName}.zip`; 
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); 
    if(tipo === 'MOVIMENTACAO') {
        let idLote = 'LT-' + new Date().getTime().toString().slice(-6);
        loading(true, "Gerando Lote...");
        const entradasPends = window.BD_ENTRADAS.filter(x => x.statusTx === 'Pendente' && x.data >= dInicio && x.data <= dFim);
        const receitasPends = window.BD_RECEITAS.filter(x => x.statusTx === 'Pendente' && x.dataVenda >= dInicio && x.dataVenda <= dFim);
        for(let r of receitasPends) await updateDoc(doc(db, `${tenant}_sngpc_receitas`, r.id), { statusTx: 'Transmitido', loteId: idLote });
        for(let n of entradasPends) await updateDoc(doc(db, `${tenant}_sngpc_entradas_nf`, n.id), { statusTx: 'Transmitido', loteId: idLote });
        window.sincronizarBD();
    } else { window.showToast(`Arquivo ZIP ${tipo} descarregado com sucesso!`); }
};

window.limparFiltros = () => { document.getElementById('filtroStatus').value = 'ativos'; document.getElementById('filtroTipo').value = 'todos'; document.getElementById('filtroDataI').value = ''; document.getElementById('filtroDataF').value = ''; window.renderizarListas(); }

window.calcularValidade = function(valString) {
    if(!valString) return { badge: 'bg-secondary', texto: 'Sem Data', alertar: false };
    const [ano, mes] = valString.split('-'); const dataVal = new Date(ano, mes, 0); 
    const diffDias = Math.ceil((dataVal - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
    if(diffDias < 0) return { badge: 'bg-danger', texto: 'VENCIDO', alertar: true };
    if(diffDias <= 90) return { badge: 'bg-warning text-dark', texto: `Vence em ${diffDias} dias`, alertar: true };
    return { badge: 'bg-success', texto: 'Na validade', alertar: false };
}

window.sincronizarBD = async function() {
  loading(true);
  try {
      const [e, r, nf, m, p] = await Promise.all([ 
          getDocs(collection(db, `${tenant}_sngpc_medicamentos`)), getDocs(collection(db, `${tenant}_sngpc_receitas`)),
          getDocs(collection(db, `${tenant}_sngpc_entradas_nf`)), getDocs(collection(db, `${tenant}_sngpc_medicos`)), getDocs(collection(db, `${tenant}_sngpc_pacientes`))
      ]);
      window.BD_ESTOQUE = e.docs.map(d=>({id:d.id, ...d.data()})); window.BD_RECEITAS = r.docs.map(d=>({id:d.id, ...d.data()}));
      window.BD_ENTRADAS = nf.docs.map(d=>({id:d.id, ...d.data()})); window.BD_MEDICOS = m.docs.map(d=>({id:d.id, ...d.data()})); window.BD_PACIENTES = p.docs.map(d=>({id:d.id, ...d.data()}));
      window.renderizarListas();
      if(tsNfProd) tsNfProd.destroy(); if(tsRecProd) tsRecProd.destroy(); if(tsRecMed) tsRecMed.destroy(); if(tsRecPac) tsRecPac.destroy();
      
      let nfProdOpts = '<option value="">Buscar produto base...</option>';
      window.BD_ESTOQUE.sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(med => { let ex = med.espec ? ` - ${med.espec}` : ''; nfProdOpts += `<option value="${med.id}">${med.nome}${ex} (MS: ${fMS(med.ms)})</option>`; });
      document.getElementById('nfProdutoSelect').innerHTML = nfProdOpts;
      let recOpts = '<option value="">Buscar por medicamento ou lote...</option>';
      window.BD_ESTOQUE.sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(med => { (med.lotes || []).forEach(l => { if(l.qtd > 0) { const statusVal = window.calcularValidade(l.validade); recOpts += `<option value="${med.id}|${l.numero}">${med.nome} (Lote: ${l.numero}) - Disp: ${l.qtd} cx - [${statusVal.texto}]</option>`; } }); });
      document.getElementById('recProduto').innerHTML = recOpts;
      document.getElementById('recPrescritorSelect').innerHTML = '<option value="">Buscar CRM ou Médico...</option>' + window.BD_MEDICOS.map(x=>`<option value="${x.crm}|${x.uf}">${x.nome} (CRM ${x.crm}-${x.uf})</option>`).join('');
      document.getElementById('recPacienteSelect').innerHTML = '<option value="">Buscar CPF/RG ou Paciente...</option>' + window.BD_PACIENTES.map(x=>`<option value="${x.cpf}">${x.nome} (${fCPF(x.cpf)})</option>`).join('');

      tsNfProd = new TomSelect("#nfProdutoSelect", { create: false, sortField: { field: "text", direction: "asc" } });
      tsRecProd = new TomSelect("#recProduto", { create: false, sortField: { field: "text", direction: "asc" } });
      tsRecMed = new TomSelect("#recPrescritorSelect", { create: false }); tsRecPac = new TomSelect("#recPacienteSelect", { create: false });

      // === ATRIBUIÇÃO DOS EVENTOS DIRETOS PELA API DO TOMSELECT ===
      tsRecMed.on('change', function(val) {
          if(val) {
              const [crm, uf] = val.split('|');
              document.getElementById('recCRM').value = crm;
              document.getElementById('recUF').value = uf;
              const m = window.BD_MEDICOS.find(x => x.crm === crm && x.uf === uf);
              if(m) document.getElementById('recMedNome').value = m.nome;
          } else {
              document.getElementById('recCRM').value = ""; document.getElementById('recUF').value = ""; document.getElementById('recMedNome').value = "";
          }
      });

      tsRecPac.on('change', function(val) {
          if(val) {
              const p = window.BD_PACIENTES.find(x => x.cpf === val);
              if(p) {
                  document.getElementById('recDoc').value = p.cpf;
                  document.getElementById('recPacienteNome').value = p.nome;
                  document.getElementById('recOrgao').value = p.orgao || 'SSP';
                  document.getElementById('recUfDoc').value = p.uf || 'CE';
              }
          } else {
              document.getElementById('recDoc').value = ""; document.getElementById('recPacienteNome').value = ""; document.getElementById('recOrgao').value = ""; document.getElementById('recUfDoc').value = "";
          }
      });

      document.getElementById('kpi-vendas').innerText = window.BD_RECEITAS.length; document.getElementById('kpi-pendentes').innerText = window.BD_RECEITAS.filter(x=>x.statusTx === 'Pendente').length + window.BD_ENTRADAS.filter(x=>x.statusTx === 'Pendente').length;
      let t = 0; window.BD_ESTOQUE.forEach(m => { (m.lotes || []).forEach(l => { if(l.qtd > 0) t += l.qtd; }) }); document.getElementById('kpi-itens').innerText = t;
  } catch(err) { console.error(err); }
  loading(false);
}

window.renderizarListas = function() {
    document.getElementById('tbMedicos').innerHTML = window.BD_MEDICOS.map(x=>`<tr><td class="ps-3 fw-bold">${x.crm}-${x.uf}</td><td>${x.nome}</td><td class="text-center"><button class="btn btn-sm text-primary" onclick="window.editarMedico('${x.id}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm text-danger" onclick="window.excluirMedico('${x.id}')"><i class="bi bi-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="3" class="text-center text-muted">Vazio</td></tr>';
    document.getElementById('tbPacientes').innerHTML = window.BD_PACIENTES.map(x=>`<tr><td class="ps-3 fw-bold">${fCPF(x.cpf)}</td><td>${x.nome}</td><td class="text-center"><button class="btn btn-sm text-primary" onclick="window.editarPaciente('${x.id}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm text-danger" onclick="window.excluirPaciente('${x.id}')"><i class="bi bi-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="3" class="text-center text-muted">Vazio</td></tr>';

    let temAlertaGlobal = false; let termoBusca = (document.getElementById('buscaEstoque') ? document.getElementById('buscaEstoque').value.toLowerCase() : "");
    let estoqueFiltrado = window.BD_ESTOQUE.filter(m => m.nome.toLowerCase().includes(termoBusca) || m.ms.includes(termoBusca) || (m.substancia && m.substancia.toLowerCase().includes(termoBusca)));
    estoqueFiltrado.sort((a, b) => a.nome.localeCompare(b.nome));

    document.getElementById('tbEstoque').innerHTML = estoqueFiltrado.length ? estoqueFiltrado.map(med => {
        let listaLotes = (med.lotes || []).map(l => { const val = window.calcularValidade(l.validade); if(val.alertar && l.qtd > 0) temAlertaGlobal = true; return `<div class="d-flex justify-content-between align-items-center mb-1 pb-1 border-bottom"><span class="small">Lote: <b>${l.numero}</b> (${l.qtd} Cx)</span><span class="badge ${val.badge} ms-2" style="font-size: 0.65rem;">${val.texto}</span></div>`; }).join('');
        let infoExtra = []; if(med.lab) infoExtra.push(`Lab: ${med.lab}`); if(med.espec) infoExtra.push(med.espec); let strExtra = infoExtra.length > 0 ? `<br><small class="text-primary fw-bold">${infoExtra.join(' | ')}</small>` : '';
        return `<tr><td class="ps-4"><b>${med.nome}</b><br><small class="text-muted">MS: ${fMS(med.ms)}</small>${strExtra}</td><td>${listaLotes}</td><td class="text-center"><button class="btn btn-sm btn-outline-primary me-1" onclick="window.editarMed('${med.id}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger" onclick="window.excluirMed('${med.id}')"><i class="bi bi-trash"></i></button></td></tr>`;
    }).join('') : '<tr><td colspan="3" class="text-center py-4 text-muted">Nenhum medicamento encontrado.</td></tr>';
    document.getElementById('alertaValidadeGlobal').classList.toggle('oculto', !temAlertaGlobal);

    const fStatus = document.getElementById('filtroStatus') ? document.getElementById('filtroStatus').value : 'ativos';
    const fTipo = document.getElementById('filtroTipo') ? document.getElementById('filtroTipo').value : 'todos';
    const fDataI = document.getElementById('filtroDataI') ? document.getElementById('filtroDataI').value : '';
    const fDataF = document.getElementById('filtroDataF') ? document.getElementById('filtroDataF').value : '';

    let todasTransacoes = [...window.BD_RECEITAS.map(r=>({...r, txTipo: 'Saída (Receita)'})), ...window.BD_ENTRADAS.map(e=>({...e, txTipo: 'Entrada (NF)'}))];
    todasTransacoes = todasTransacoes.filter(x => {
        let dtRef = x.txTipo === 'Entrada (NF)' ? x.data : x.dataVenda; let pStat = true;
        if(fStatus === 'ativos') pStat = ['Pendente', 'Transmitido', 'Rejeitado'].includes(x.statusTx); else if(fStatus === 'aceitos') pStat = (x.statusTx === 'Aceito');
        let pTipo = true; if(fTipo === 'entrada') pTipo = (x.txTipo === 'Entrada (NF)'); else if(fTipo === 'saida') pTipo = (x.txTipo === 'Saída (Receita)');
        let pData = true; if(fDataI && dtRef < fDataI) pData = false; if(fDataF && dtRef > fDataF) pData = false; return pStat && pTipo && pData;
    });
    todasTransacoes.sort((a,b)=>new Date(b.dataCriacao)-new Date(a.dataCriacao));
    
    document.getElementById('tbTransmissao').innerHTML = todasTransacoes.length ? todasTransacoes.map(x => {
        let bClass = x.statusTx === 'Aceito' ? 'text-success border-success' : (x.statusTx === 'Rejeitado' ? 'text-danger border-danger' : (x.statusTx === 'Transmitido' ? 'text-info border-info' : 'text-warning border-warning text-dark'));
        let iStr = (x.itens || []).map(i => `${i.medNome} (Lote: ${i.numLote} - ${i.qtd} Cx)`).join('<br>');
        let ref = x.txTipo === 'Entrada (NF)' ? `NF: ${x.numero}` : `Pac: ${x.paciente}`; let loteBadge = x.loteId ? `<span class="badge bg-secondary ms-2">${x.loteId}</span>` : '';
        let dtRef = x.txTipo === 'Entrada (NF)' ? x.data : x.dataVenda;
        
        let selectHTML = `<div class="d-flex align-items-center justify-content-center"><select class="form-select form-select-sm fw-bold select-status-tx ${bClass}" style="width: 130px;" onchange="window.mudarStatusTx('${x.txTipo}', '${x.id}', this.value)"><option class="text-warning" value="Pendente" ${x.statusTx==='Pendente'?'selected':''}>Fila / Pendente</option><option class="text-info" value="Transmitido" ${x.statusTx==='Transmitido'?'selected':''}>Transmitido</option><option class="text-success" value="Aceito" ${x.statusTx==='Aceito'?'selected':''}>Aceito</option><option class="text-danger" value="Rejeitado" ${x.statusTx==='Rejeitado'?'selected':''}>Rejeitado</option></select></div>`;
        
        return `<tr class="tr-clicavel" onclick="if(!['SELECT','OPTION','BUTTON','I'].includes(event.target.tagName)) window.abrirDetalhesTx('${x.txTipo}', '${x.id}')">
            <td class="ps-4 fw-bold text-${x.txTipo==='Entrada (NF)'?'success':'primary'}">${x.txTipo}</td>
            <td>${dtRef.split('-').reverse().join('/')}</td><td><b>${ref}</b> ${loteBadge}<br><small class="text-muted">${iStr}</small></td><td class="pe-3">${selectHTML}</td>
        </tr>`;
    }).join('') : '<tr><td colspan="4" class="text-center py-4 text-muted">Nenhuma movimentação para os filtros selecionados.</td></tr>';
}

window.abrirDetalhesTx = function(tipo, id) {
    let rec = tipo === 'Entrada (NF)' ? window.BD_ENTRADAS.find(x=>x.id === id) : window.BD_RECEITAS.find(x=>x.id === id);
    if(!rec) return;

    document.getElementById('detTxId').value = id;
    document.getElementById('detTxTipo').value = tipo;

    let bClass = rec.statusTx === 'Aceito' ? 'bg-success' : (rec.statusTx === 'Rejeitado' ? 'bg-danger' : (rec.statusTx === 'Transmitido' ? 'bg-info' : 'bg-warning text-dark'));
    document.getElementById('detTxStatus').innerHTML = `<span class="badge ${bClass} fs-6 px-3 py-2 shadow-sm">${rec.statusTx}</span>`;

    let htmlCampos = '';
    if(tipo === 'Entrada (NF)') {
        let cnpjFormatado = window.maskCNPJ(rec.cnpjOrigem || '');
        htmlCampos = `
            <div class="row g-3">
                <div class="col-md-4"><label class="small text-muted fw-bold">Nº Nota Fiscal</label><input type="text" id="editNfNum" class="form-control fw-bold" value="${rec.numero}" disabled></div>
                <div class="col-md-4"><label class="small text-muted fw-bold">Data Emissão</label><input type="date" id="editNfData" class="form-control fw-bold" value="${rec.data}" disabled></div>
                <div class="col-md-4"><label class="small text-muted fw-bold">CNPJ Origem</label><input type="text" id="editNfCnpj" class="form-control fw-bold" value="${cnpjFormatado}" maxlength="18" oninput="this.value = window.maskCNPJ(this.value)" disabled></div>
            </div>`;
    } else {
        htmlCampos = `
            <div class="row g-3 mb-3">
                <div class="col-md-3"><label class="small text-muted fw-bold">Tipo Receita</label><select id="editRecTipo" class="form-select fw-bold" disabled><option value="1" ${rec.tipoReceita=='1'?'selected':''}>1-Branca</option><option value="2" ${rec.tipoReceita=='2'?'selected':''}>2-Not. A</option><option value="3" ${rec.tipoReceita=='3'?'selected':''}>3-Not. B1</option><option value="4" ${rec.tipoReceita=='4'?'selected':''}>4-Not. B2</option><option value="5" ${rec.tipoReceita=='5'?'selected':''}>5-Especial</option></select></div>
                <div class="col-md-3"><label class="small text-muted fw-bold">Nº Notificação</label><input type="text" id="editRecNot" class="form-control fw-bold text-uppercase" value="${rec.numNotificacao||''}" maxlength="10" disabled></div>
                <div class="col-md-3"><label class="small text-muted fw-bold">Data Prescrição</label><input type="date" id="editRecDataP" class="form-control fw-bold" value="${rec.dataPrescricao}" disabled></div>
                <div class="col-md-3"><label class="small text-muted fw-bold">Data Venda</label><input type="date" id="editRecDataV" class="form-control fw-bold" value="${rec.dataVenda}" disabled></div>
            </div>
            <div class="row g-3">
                <div class="col-md-8"><label class="small text-muted fw-bold">Paciente e Documento</label><input type="text" class="form-control" value="${rec.paciente} (${rec.doc})" disabled></div>
                <div class="col-md-4"><label class="small text-muted fw-bold">Prescritor (CRM)</label><input type="text" class="form-control" value="${rec.prescritorNome} (${rec.crm}-${rec.uf})" disabled></div>
            </div>
            <p class="small text-muted mt-3 mb-0"><i class="bi bi-info-circle"></i> Apenas dados de capa podem ser editados por aqui. Para alterar os medicamentos listados abaixo, o paciente ou o médico, você deve <b>excluir</b> este lançamento e fazer um novo.</p>
        `;
    }
    document.getElementById('detTxCampos').innerHTML = htmlCampos;

    let htmlItens = `<table class="table table-sm text-dark align-middle"><thead><tr class="table-light"><th class="ps-2">Produto</th><th>Registro MS</th><th>Lote</th><th class="text-center">Qtd Cx</th></tr></thead><tbody>`;
    rec.itens.forEach(i => { htmlItens += `<tr><td class="ps-2 fw-bold text-primary">${i.medNome}</td><td>${fMS(i.ms)}</td><td><span class="badge bg-secondary">${i.numLote}</span></td><td class="text-center fw-bold">${i.qtd}</td></tr>`; });
    htmlItens += `</tbody></table>`;
    document.getElementById('detTxItens').innerHTML = htmlItens;

    let htmlAcoes = '';
    if(rec.statusTx === 'Pendente' || rec.statusTx === 'Rejeitado') {
        htmlAcoes += `<button type="button" class="btn btn-outline-danger me-auto fw-bold shadow-sm" onclick="window.excluirTransacaoInterno()"><i class="bi bi-trash"></i> Excluir e Reverter Estoque</button>`;
        htmlAcoes += `<button type="button" class="btn btn-outline-primary fw-bold shadow-sm px-4" id="btnHabilitarEdicao" onclick="window.habilitarEdicaoTx()"><i class="bi bi-pencil"></i> Editar Dados</button>`;
        htmlAcoes += `<button type="submit" class="btn btn-success fw-bold shadow-sm px-4 d-none" id="btnSalvarEdicao"><i class="bi bi-save"></i> Salvar e Voltar para Pendente</button>`;
    } else {
        htmlAcoes += `<button type="button" class="btn btn-secondary fw-bold px-4" data-bs-dismiss="modal">Fechar</button>`;
    }
    document.getElementById('detTxAcoes').innerHTML = htmlAcoes;

    new bootstrap.Modal(document.getElementById('modalDetalhesTx')).show();
}

window.habilitarEdicaoTx = function() {
    document.querySelectorAll('#detTxCampos input, #detTxCampos select').forEach(el => el.removeAttribute('disabled'));
    document.getElementById('btnHabilitarEdicao').classList.add('d-none');
    document.getElementById('btnSalvarEdicao').classList.remove('d-none');
}

window.salvarEdicaoTx = async function() {
    let id = document.getElementById('detTxId').value; let tipo = document.getElementById('detTxTipo').value;
    let col = tipo === 'Entrada (NF)' ? `${tenant}_sngpc_entradas_nf` : `${tenant}_sngpc_receitas`;
    
    let rec = tipo === 'Entrada (NF)' ? window.BD_ENTRADAS.find(x=>x.id===id) : window.BD_RECEITAS.find(x=>x.id===id);
    let novoStatus = rec.statusTx === 'Rejeitado' ? 'Pendente' : rec.statusTx;
    let payload = { statusTx: novoStatus };

    if(tipo === 'Entrada (NF)') {
        let cnpjL = document.getElementById('editNfCnpj').value.replace(/\D/g,'');
        if(cnpjL.length !== 14) return alert("Erro: O CNPJ do Fornecedor precisa ter exatamente 14 números.");
        payload.numero = document.getElementById('editNfNum').value; payload.data = document.getElementById('editNfData').value; payload.cnpjOrigem = cnpjL;
    } else {
        payload.tipoReceita = document.getElementById('editRecTipo').value; payload.numNotificacao = document.getElementById('editRecNot').value.toUpperCase(); payload.dataPrescricao = document.getElementById('editRecDataP').value; payload.dataVenda = document.getElementById('editRecDataV').value;
    }

    loading(true, "Salvando edição..."); await updateDoc(doc(db, col, id), payload);
    let m = bootstrap.Modal.getInstance(document.getElementById('modalDetalhesTx')); if(m) m.hide();
    window.sincronizarBD(); window.showToast("Lançamento corrigido e updated!");
}

window.excluirTransacaoInterno = async function() {
    let id = document.getElementById('detTxId').value; let tipo = document.getElementById('detTxTipo').value;
    let m = bootstrap.Modal.getInstance(document.getElementById('modalDetalhesTx')); if(m) m.hide();
    await window.excluirTransacao(tipo, id);
}

window.mudarStatusTx = async function(tipo, id, novoStatus) {
    let col = tipo === 'Entrada (NF)' ? `${tenant}_sngpc_entradas_nf` : `${tenant}_sngpc_receitas`;
    await updateDoc(doc(db, col, id), { statusTx: novoStatus }); window.sincronizarBD();
}

window.excluirTransacao = async function(tipo, id) {
    if(!confirm("Tem certeza que deseja EXCLUIR permanentemente este lançamento?\nO estoque será revertido automaticamente para a farmácia.")) return;
    loading(true, "Revertendo estoque e excluindo...");
    try {
        let estNovo = JSON.parse(JSON.stringify(window.BD_ESTOQUE));
        if (tipo === 'Saída (Receita)') {
            let rec = window.BD_RECEITAS.find(r => r.id === id);
            if(rec) { for(let i of rec.itens) { let med = estNovo.find(m => m.id === i.idMed); if(med) { let lote = med.lotes.find(l => l.numero === i.numLote); if(lote) lote.qtd += i.qtd; await updateDoc(doc(db, `${tenant}_sngpc_medicamentos`, i.idMed), { lotes: med.lotes }); } } await deleteDoc(doc(db, `${tenant}_sngpc_receitas`, id)); }
        } else {
            let nf = window.BD_ENTRADAS.find(n => n.id === id);
            if(nf) { for(let i of nf.itens) { let med = estNovo.find(m => m.id === i.idMed); if(med) { let lote = med.lotes.find(l => l.numero === i.numLote); if(lote) { lote.qtd -= i.qtd; if(lote.qtd < 0) lote.qtd = 0; } await updateDoc(doc(db, `${tenant}_sngpc_medicamentos`, i.idMed), { lotes: med.lotes }); } } await deleteDoc(doc(db, `${tenant}_sngpc_entradas_nf`, id)); }
        }
        window.sincronizarBD(); window.showToast("Lançamento excluído e estoque revertido!");
    } catch(e) { alert("Erro ao excluir: " + e.message); loading(false); }
}

window.mudarStatusMassa = async function(novoStatus) {
    const rTx = window.BD_RECEITAS.filter(x => x.statusTx === 'Transmitido'); const nTx = window.BD_ENTRADAS.filter(x => x.statusTx === 'Transmitido');
    if(rTx.length === 0 && nTx.length === 0) return alert("Não há itens com status 'Transmitido' aguardando retorno da ANVISA.");
    if(!confirm(`Deseja marcar os ${rTx.length + nTx.length} itens aguardando como ${novoStatus}?`)) return;
    loading(true, "Atualizando lote...");
    for(let r of rTx) await updateDoc(doc(db, `${tenant}_sngpc_receitas`, r.id), { statusTx: novoStatus }); for(let n of nTx) await updateDoc(doc(db, `${tenant}_sngpc_entradas_nf`, n.id), { statusTx: novoStatus });
    window.sincronizarBD(); window.showToast(`Itens marcados como ${novoStatus}!`);
}

window.abrirModalMedico = () => { document.getElementById('medId').value=""; document.getElementById('medNome').value=""; document.getElementById('medCRM').value=""; mMed.show(); }
window.editarMedico = (id) => { const m = window.BD_MEDICOS.find(x=>x.id===id); if(m){ document.getElementById('medId').value=m.id; document.getElementById('medCRM').value=m.crm; document.getElementById('medUF').value=m.uf; document.getElementById('medNome').value=m.nome; mMed.show(); } }
window.excluirMedico = async (id) => { if(confirm("Remover Médico da sua visão local?")) { await deleteDoc(doc(db, `${tenant}_sngpc_medicos`, id)); window.sincronizarBD(); } }
window.salvarMedico = async () => { 
    loading(true); const crm = document.getElementById('medCRM').value.replace(/\D/g, ''); const nome = document.getElementById('medNome').value.toUpperCase(); const uf = document.getElementById('medUF').value; 
    const payload = {nome, crm, uf}; 
    const idParaSalvar = "M_" + crm + "_" + uf; 
    await setDoc(doc(db, `global_sngpc_medicos`, crm), payload, { merge: true }); 
    await setDoc(doc(db,`${tenant}_sngpc_medicos`, idParaSalvar), payload); 
    mMed.hide(); window.sincronizarBD(); 
}

window.abrirModalPaciente = () => { document.getElementById('pacId').value=""; document.getElementById('pacNome').value=""; document.getElementById('pacDocInput').value=""; document.getElementById('pacOrgao').value=""; mPac.show(); }
window.editarPaciente = (id) => { const p = window.BD_PACIENTES.find(x=>x.id===id); if(p){ document.getElementById('pacId').value=p.id; document.getElementById('pacDocInput').value=p.cpf; document.getElementById('pacNome').value=p.nome; document.getElementById('pacOrgao').value=p.orgao; document.getElementById('pacUf').value=p.uf; mPac.show(); } }
window.excluirPaciente = async (id) => { if(confirm("Remover Paciente da sua visão local?")) { await deleteDoc(doc(db, `${tenant}_sngpc_pacientes`, id)); window.sincronizarBD(); } }
window.salvarPaciente = async () => { 
    loading(true); 
    const cpfOrRg = document.getElementById('pacDocInput').value.replace(/\D/g, ''); 
    const nome = document.getElementById('pacNome').value.toUpperCase(); 
    const orgao = document.getElementById('pacOrgao').value.toUpperCase(); 
    const uf = document.getElementById('pacUf').value; 
    const payload = {nome, cpf: cpfOrRg, orgao, uf}; 
    const idParaSalvar = document.getElementById('pacId').value || "P_" + cpfOrRg;
    await setDoc(doc(db, `global_sngpc_pacientes`, cpfOrRg), payload, { merge: true }); 
    await setDoc(doc(db,`${tenant}_sngpc_pacientes`, idParaSalvar), payload); 
    mPac.hide(); window.sincronizarBD(); 
}

window.excluirMed = async (id) => { if(confirm("Remover Medicamento e Lotes da farmácia?")) { await deleteDoc(doc(db, `${tenant}_sngpc_medicamentos`, id)); window.sincronizarBD(); } }

window.buscarGlobal = async function(tipo, valor) {
    const limpo = valor.replace(/\D/g, ''); if(!limpo) return;
    try {
        if(tipo === 'paciente') { const snap = await getDoc(doc(db, "global_sngpc_pacientes", limpo)); if(snap.exists()) { document.getElementById('pacNome').value = snap.data().nome; document.getElementById('pacOrgao').value = snap.data().orgao || ""; document.getElementById('pacUf').value = snap.data().uf || "CE"; window.showToast("Localizado na Base Global!"); } } 
        else if(tipo === 'medico') { const snap = await getDoc(doc(db, "global_sngpc_medicos", limpo)); if(snap.exists()) { document.getElementById('medNome').value = snap.data().nome; document.getElementById('medUF').value = snap.data().uf || "CE"; window.showToast("Localizado na Base Global!"); } } 
        else if(tipo === 'medicamento') { const snap = await getDoc(doc(db, "global_sngpc_medicamentos", limpo)); if(snap.exists()) { document.getElementById('estNome').value = snap.data().nome; document.getElementById('estSubstancia').value = snap.data().substancia || ""; document.getElementById('estLab').value = snap.data().lab || ""; document.getElementById('estEspec').value = snap.data().espec || ""; window.showToast("Localizado na Base Global!"); } }
    } catch(e) { console.log("Buscando na global..."); }
}

window.renderCarrinhoNF = function() {
    const tb = document.getElementById('tbCarrinhoNF'); if(window.carrinhoNF.length === 0) { tb.innerHTML = '<tr><td colspan="5" class="text-center text-muted small py-3">Nenhum lote adicionado.</td></tr>'; return; }
    tb.innerHTML = window.carrinhoNF.map((i, idx) => `<tr><td class="fw-bold text-success">${i.medNome}</td><td>${i.numLote}</td><td>${i.validade}</td><td class="text-center fw-bold">${i.qtd}</td><td class="text-end"><button type="button" class="btn btn-sm btn-outline-danger" onclick="window.removerDoCarrinhoNF(${idx})"><i class="bi bi-x-circle"></i></button></td></tr>`).join('');
}
window.addAoCarrinhoNF = function() {
    const idMed = document.getElementById('nfProdutoSelect').value; const numLote = document.getElementById('nfLote').value.toUpperCase(); const val = document.getElementById('nfValidade').value; const qtd = parseInt(document.getElementById('nfQtd').value);
    if(!idMed || !numLote || !val || qtd <= 0) return alert("Preencha Produto, Lote, Validade e Qtd corretamente.");
    const medObj = window.BD_ESTOQUE.find(x=>x.id === idMed); window.carrinhoNF.push({ idMed, ms: medObj.ms, medNome: medObj.nome, numLote, validade: val, qtd });
    document.getElementById('nfLote').value = ""; document.getElementById('nfValidade').value = ""; document.getElementById('nfQtd').value = 1; window.renderCarrinhoNF();
}
window.removerDoCarrinhoNF = function(idx) { window.carrinhoNF.splice(idx, 1); window.renderCarrinhoNF(); }

window.salvarEntradaNF = async function() {
    if(window.carrinhoNF.length === 0) return alert("Adicione os lotes da NF."); 
    const cnpjOriginal = document.getElementById('nfCnpjOrigem').value.replace(/\D/g,'');
    if(cnpjOriginal.length !== 14) return alert("Erro: O CNPJ do Fornecedor precisa ter exatamente 14 números.");
    
    loading(true, "Processando NF e Estoque...");
    try {
        let estoqueNovo = JSON.parse(JSON.stringify(window.BD_ESTOQUE));
        for(let item of window.carrinhoNF) { const med = estoqueNovo.find(x => x.id === item.idMed); let loteExistente = med.lotes.find(l => l.numero === item.numLote); if(loteExistente) loteExistente.qtd += item.qtd; else med.lotes.push({ numero: item.numLote, validade: item.validade, qtd: item.qtd }); await updateDoc(doc(db, `${tenant}_sngpc_medicamentos`, item.idMed), { lotes: med.lotes }); }
        await setDoc(doc(db, `${tenant}_sngpc_entradas_nf`, `NF_${Date.now()}`), { numero: document.getElementById('nfNumero').value, data: document.getElementById('nfData').value, cnpjOrigem: cnpjOriginal, itens: window.carrinhoNF, statusTx: 'Pendente', dataCriacao: new Date().toISOString() });
        window.carrinhoNF = []; window.renderCarrinhoNF(); document.getElementById('formEntradaNF').reset(); document.getElementById('nfData').valueAsDate = new Date(); if(tsNfProd) tsNfProd.clear(); window.showToast("Nota Fiscal processada!"); window.sincronizarBD();
    } catch(e) { alert("Erro: " + e.message); loading(false); }
}

window.renderCarrinho = function() {
    const tb = document.getElementById('tbCarrinho'); if(window.carrinhoVenda.length === 0) { tb.innerHTML = '<tr><td colspan="4" class="text-center text-muted small py-3">Nenhum lote adicionado.</td></tr>'; return; }
    tb.innerHTML = window.carrinhoVenda.map((i, idx) => `<tr><td class="fw-bold text-primary">${i.medNome}</td><td>${i.numLote}</td><td class="text-center fw-bold">${i.qtd}</td><td class="text-end"><button type="button" class="btn btn-sm btn-outline-danger" onclick="window.removerDoCarrinho(${idx})"><i class="bi bi-x-circle"></i></button></td></tr>`).join('');
}
window.addAoCarrinho = function() {
    const valProd = document.getElementById('recProduto').value; const inputQtd = parseInt(document.getElementById('recQtd').value);
    if(!valProd || inputQtd <= 0) return alert("Selecione produto e qtd.");
    const [idMed, numLote] = valProd.split('|'); const medObj = window.BD_ESTOQUE.find(x=>x.id === idMed); const loteObj = medObj.lotes.find(l=>l.numero === numLote);
    const itemEx = window.carrinhoVenda.find(i => i.idMed === idMed && i.numLote === numLote); const qAtual = itemEx ? itemEx.qtd : 0;
    if((qAtual + inputQtd) > loteObj.qtd) return alert(`Estoque insuficiente! Temos ${loteObj.qtd} cx.`);
    if(itemEx) itemEx.qtd += inputQtd; else window.carrinhoVenda.push({ idMed, ms: medObj.ms, medNome: medObj.nome, numLote, qtd: inputQtd });
    document.getElementById('recQtd').value = 1; window.renderCarrinho();
}
window.removerDoCarrinho = function(idx) { window.carrinhoVenda.splice(idx, 1); window.renderCarrinho(); }
window.salvarReceita = async function() {
    if(window.carrinhoVenda.length === 0) return alert("Receita vazia."); loading(true, "Baixando Estoque...");
    try {
        let estNovo = JSON.parse(JSON.stringify(window.BD_ESTOQUE));
        for(let i of window.carrinhoVenda) { const med = estNovo.find(x => x.id === i.idMed); const lote = med.lotes.find(l => l.numero === i.numLote); lote.qtd -= i.qtd; await updateDoc(doc(db, `${tenant}_sngpc_medicamentos`, i.idMed), { lotes: med.lotes }); }
        await setDoc(doc(db, `${tenant}_sngpc_receitas`, `REC_${Date.now()}`), { paciente: document.getElementById('recPacienteNome').value, doc: document.getElementById('recDoc').value.replace(/\D/g,''), orgao: document.getElementById('recOrgao').value, ufEmissor: document.getElementById('recUfDoc').value, crm: document.getElementById('recCRM').value.replace(/\D/g,''), uf: document.getElementById('recUF').value, prescritorNome: document.getElementById('recMedNome').value, tipoReceita: document.getElementById('recTipo').value, numNotificacao: document.getElementById('recNotificacao').value, dataPrescricao: document.getElementById('recData').value, dataVenda: new Date().toISOString().split('T')[0], itens: window.carrinhoVenda, statusTx: 'Pendente', dataCriacao: new Date().toISOString() });
        window.carrinhoVenda = []; window.renderCarrinho(); document.getElementById('formReceita').reset(); document.getElementById('recData').valueAsDate = new Date(); if(tsRecMed) tsRecMed.clear(); if(tsRecPac) tsRecPac.clear(); if(tsRecProd) tsRecProd.clear(); window.showToast("Receita processada!"); window.sincronizarBD();
    } catch(e) { alert("Erro: " + e.message); loading(false); }
}

window.addLinhaLote = function(num="", val="", qtd="") {
    const c = document.getElementById('containerLotes'); const d = document.createElement('div'); d.className = "lote-row row g-2 align-items-end shadow-sm";
    d.innerHTML = `<div class="col-4"><label class="small fw-bold text-muted">Lote</label><input type="text" class="form-control in-lote-num" value="${num}" required></div><div class="col-4"><label class="small fw-bold text-muted">Validade</label><input type="month" class="form-control in-lote-val" value="${val}" required></div><div class="col-3"><label class="small fw-bold text-muted">Qtd</label><input type="number" class="form-control in-lote-qtd" value="${qtd}" min="0" required></div><div class="col-1 text-end"><button type="button" class="btn btn-danger w-100" onclick="this.parentElement.parentElement.remove()"><i class="bi bi-trash"></i></button></div>`;
    c.appendChild(d);
}
window.abrirModalEstoque = () => { document.getElementById('estId').value=""; document.getElementById('estNome').value=""; document.getElementById('estMS').value=""; document.getElementById('estSubstancia').value=""; document.getElementById('estLab').value=""; document.getElementById('estEspec').value=""; document.getElementById('containerLotes').innerHTML=""; window.addLinhaLote(); mEstoque.show(); }
window.editarMed = (id) => { const m = window.BD_ESTOQUE.find(x=>x.id===id); if(!m) return; document.getElementById('estId').value=m.id; document.getElementById('estNome').value=m.nome; document.getElementById('estMS').value=window.maskMS(m.ms); document.getElementById('estSubstancia').value=m.substancia || ""; document.getElementById('estLab').value=m.lab || ""; document.getElementById('estEspec').value=m.espec || ""; document.getElementById('containerLotes').innerHTML=""; if((m.lotes||[]).length===0) window.addLinhaLote(); else m.lotes.forEach(l=>window.addLinhaLote(l.numero,l.validade,l.qtd)); mEstoque.show(); }
window.salvarEstoque = async () => { 
    const id = document.getElementById('estId').value; const nome = document.getElementById('estNome').value.toUpperCase(); const ms = document.getElementById('estMS').value.replace(/\D/g, ''); const substancia = document.getElementById('estSubstancia').value.toUpperCase(); const lab = document.getElementById('estLab').value.toUpperCase(); const espec = document.getElementById('estEspec').value; 
    if(ms.length !== 13) return alert("Erro: O Registro MS (" + ms + ") está incompleto. Ele precisa ter exatamente 13 dígitos.");
    const lotes = []; document.querySelectorAll('.lote-row').forEach(r=>{ lotes.push({ numero: r.querySelector('.in-lote-num').value.toUpperCase(), validade: r.querySelector('.in-lote-val').value, qtd: parseInt(r.querySelector('.in-lote-qtd').value) }); }); 
    loading(true); const payload = { nome, ms, substancia, lab, espec };
    await setDoc(doc(db, `global_sngpc_medicamentos`, ms), payload, { merge: true }); await setDoc(doc(db, `${tenant}_sngpc_medicamentos`, id || "MED_"+Date.now()), { ...payload, lotes }); mEstoque.hide(); window.sincronizarBD(); 
}
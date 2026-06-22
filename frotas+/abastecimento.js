import { db } from './firebase-env.js';
import { doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// =========================================================================
// 1. LANÇAMENTOS DIRETOS (ADM, FRENTISTA E RETROATIVO)
// =========================================================================
window.abrirModalLancamentoAdm = function(id = null) {
    let elId = document.getElementById('admIdAbast');
    let elPlaca = document.getElementById('admPlaca');
    if (elId) elId.value = id || '';
    
    let optV = '<option value="">-- Selecione a Frota --</option>';
    window.DADOS_VEICULOS.forEach(v => {
        if(v.status_operacional !== 'Em Oficina' && v.status_operacional !== 'Inservível') 
            optV += `<option value="${v.id}">${v.id} - ${v.modelo || v.veiculo}</option>`;
    });
    if (elPlaca) elPlaca.innerHTML = optV;
    
    if (id) {
        let a = window.DADOS_ABASTECIMENTOS.find(x => x.id === id);
        if (elPlaca) { elPlaca.value = a.placa; elPlaca.disabled = true; }
        let d = new Date(a.dataAbastecimento); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        if(document.getElementById('admData')) document.getElementById('admData').value = d.toISOString().slice(0,16);
        if(document.getElementById('admOdo')) document.getElementById('admOdo').value = (a.odometroPainel === 0 && a.odometroCalculado === false) ? '' : (a.odometroPainel || ''); 
        
        let lStr = parseFloat(a.quantidade).toFixed(3).replace('.', ',');
        let parts = lStr.split(',');
        if(document.getElementById('admLitros')) document.getElementById('admLitros').value = parts[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.") + ',' + parts[1];
        if(document.getElementById('admMotorista')) document.getElementById('admMotorista').value = a.motorista || ''; 
        if(document.getElementById('admPostoNome')) document.getElementById('admPostoNome').value = a.nomePosto || '';
    } else {
        if (elPlaca) { elPlaca.disabled = false; elPlaca.value = ''; }
        if(document.getElementById('admData')) document.getElementById('admData').value = '';
        if(document.getElementById('admOdo')) document.getElementById('admOdo').value = '';
        if(document.getElementById('admLitros')) document.getElementById('admLitros').value = '';
        if(document.getElementById('admMotorista')) document.getElementById('admMotorista').value = ''; 
        if(document.getElementById('admPostoNome')) document.getElementById('admPostoNome').value = '';
    }
    if (window.modalLancaAdmObj) window.modalLancaAdmObj.show();
};

window.salvarLancamentoAdm = async function() {
    let elId = document.getElementById('admIdAbast');
    const id = (elId && elId.value) ? elId.value : "ADM-" + Date.now();
    const placa = document.getElementById('admPlaca')?.value; 
    const dt = document.getElementById('admData')?.value;
    let odoRaw = document.getElementById('admOdo')?.value.trim(); 
    const litros = window.safeCurrency(document.getElementById('admLitros')?.value);
    const motorista = document.getElementById('admMotorista')?.value; 
    const postoSelecionado = document.getElementById('admPostoNome')?.value;
    let btnSalvar = document.querySelector('#modalLancaAdm .btn-dark');

    if(!placa || !dt || !litros) return alert("Preencha Placa/ID, Data e Litros.");
    if(!postoSelecionado) return alert("Selecione em qual posto está abastecendo.");
    
    let dtIso = new Date(dt).toISOString();
    
    if (window.isMesTrancado && await window.isMesTrancado(dtIso)) {
        return alert(`⛔ AÇÃO BLOQUEADA: A data informada pertence a um mês fechado. Para evitar distorções de auditoria, você não pode lançar nada retroativamente nesse mês.`);
    }

    let veic = window.DADOS_VEICULOS.find(x => x.id === placa);
    let sec = veic ? (veic.secretaria || veic.sec) : 'GERAL'; 
    let dest = veic ? (veic.destinacao || 'GERAL') : 'GERAL';
    let combFixo = veic ? veic.combustivel : 'Gasolina';
    
    if(window.validarContratoRigido) {
        let erroC = window.validarContratoRigido(sec, dest, combFixo, postoSelecionado);
        if(erroC) return alert(erroC);
    }

    window.toggleButtonLoading(btnSalvar, true); window.loading(true, "Gravando Informações...");
    
    let precoLitro = 0;
    if(window.obterPrecoVigente) {
        precoLitro = window.obterPrecoVigente(postoSelecionado, dtIso)[combFixo] || 0;
    }
    let totalReais = litros * precoLitro;
    
    let tagLancador = window.USUARIO.moduloRole === 'GerentePosto' ? " (Posto Extra)" : (window.USUARIO.moduloRole === 'LancadorRetroativo' ? " (Retroativo)" : " (ADM)");
    
    let isAuto = (odoRaw === "");
    let odoInformado = isAuto ? null : window.safeCurrency(odoRaw);

    try {
        await setDoc(doc(db, `${window.tenant}_abastecimentos`, id), {
            status: 'Concluído', dataAbastecimento: dtIso, tipoCombustivel: combFixo, placa: placa, secretaria: sec, destinacao: dest,
            odometroPainel: odoInformado, odometroCalculado: isAuto, 
            quantidade: litros, precoUnitario: precoLitro, valorTotal: totalReais, motorista: motorista,
            frentistaCpf: window.USUARIO.cpf, nomeFrentista: window.USUARIO.nome + tagLancador, nomePosto: postoSelecionado, lancamentoManual: true
        }, {merge:true});
        
        if (odoInformado > 0 && window.sincronizarOdometroCentral) {
            await window.sincronizarOdometroCentral(placa, odoInformado);
        }

        if(window.modalLancaAdmObj) window.modalLancaAdmObj.hide(); 
        if(window.buscarTudo) await window.buscarTudo(); 
        alert("Lançamento salvo com sucesso!");
    } catch(e) { console.error(e); alert("Erro ao salvar: " + e.message); } finally { window.toggleButtonLoading(btnSalvar, false); window.loading(false); }
};

window.salvarAbastecimento = async function() {
  const id = document.getElementById('hdnIdAbast')?.value;
  let odoRaw = document.getElementById('inpOdoFrentista')?.value.trim();
  const litros = window.safeCurrency(document.getElementById('inpLitrosFrentista')?.value);
  const combFixo = document.getElementById('inpCombFrentista')?.value;
  const postoSelecionado = document.getElementById('inpPostoFrentista')?.value;
  let btnSalvar = document.querySelector('#modalFrentista .btn-success');

  if(litros <= 0 || !postoSelecionado) return alert("Preencha a quantidade de Litros e selecione o Posto!");
  
  let a = window.DADOS_ABASTECIMENTOS.find(x => x.id === id);
  let veic = window.DADOS_VEICULOS.find(x => x.id === a.placa);
  let sec = veic ? (veic.secretaria || veic.sec) : 'GERAL'; let dest = veic ? (veic.destinacao || 'GERAL') : 'GERAL';
  
  if(window.validarContratoRigido) {
      let erroC = window.validarContratoRigido(sec, dest, combFixo, postoSelecionado);
      if(erroC) return alert(erroC);
  }

  let dtIso = new Date().toISOString();
  if (window.isMesTrancado && await window.isMesTrancado(dtIso)) return alert(`⛔ AÇÃO BLOQUEADA: Mês da operação protegido.`);

  window.toggleButtonLoading(btnSalvar, true); window.loading(true, "Gravando Informações...");
  
  let precoLitro = 0;
  if(window.obterPrecoVigente) {
      precoLitro = window.obterPrecoVigente(postoSelecionado, dtIso)[combFixo] || 0;
  }
  let totalReais = litros * precoLitro;

  let isAuto = (odoRaw === "");
  let odoInformado = isAuto ? null : window.safeCurrency(odoRaw);

  try {
    await setDoc(doc(db, `${window.tenant}_abastecimentos`, id), {
        status: 'Concluído', dataAbastecimento: dtIso, tipoCombustivel: combFixo, secretaria: sec, destinacao: dest,
        odometroPainel: odoInformado, odometroCalculado: isAuto, 
        quantidade: litros, precoUnitario: precoLitro, valorTotal: totalReais, frentistaCpf: window.USUARIO.cpf, nomeFrentista: window.USUARIO.nome, nomePosto: postoSelecionado
    }, {merge:true});

    if (odoInformado > 0 && window.sincronizarOdometroCentral) {
        await window.sincronizarOdometroCentral(a.placa, odoInformado);
    }

    if(window.modalFrentistaObj) window.modalFrentistaObj.hide(); 
    if(window.buscarTudo) await window.buscarTudo(); 
    alert("Salvo com Sucesso!");
  } catch(e) { console.error(e); alert("Erro ao salvar: " + e.message); } finally { window.toggleButtonLoading(btnSalvar, false); window.loading(false); }
};

window.excluirAbastecimento = async function(idAbast, placa) {
    if(!confirm(`Tem certeza que deseja EXCLUIR permanentemente este abastecimento do veículo ${placa}?`)) return;
    window.loading(true, "Excluindo registro...");
    try {
        await deleteDoc(doc(db, `${window.tenant}_abastecimentos`, idAbast));
        if(window.buscarTudo) await window.buscarTudo(); 
    } catch(e) { console.error(e); alert("Erro ao excluir: " + e.message); window.loading(false); }
};

// =========================================================================
// 2. GESTORES DE ROTAS E PAINEL TRANSPORTE
// =========================================================================
window.renderPainelTransporte = function() {
  const userSecs = window.USUARIO.secretarias || []; 
  const podeVerTudo = userSecs.includes('TODAS');
  
  let viagensAtivas = window.DADOS_VIAGENS.filter(v => v.status === 'Em Andamento');
  let motoristasOcupados = viagensAtivas.map(v => v.nomeMotorista);
  let placasOcupadas = viagensAtivas.map(v => v.placa);
  
  let vDisp = window.DADOS_VEICULOS.filter(v => v.status_operacional !== 'Em Uso' && v.status_operacional !== 'Em Oficina' && v.status_operacional !== 'Inservível' && !placasOcupadas.includes(v.id));
  if(!podeVerTudo) vDisp = vDisp.filter(v => userSecs.includes(v.secretaria || v.sec));
  
  let optV = '<option value="">-- Selecione o Equipamento --</option>';
  vDisp.forEach(v => {
      let odoTxt = v.odometro || v.km_atual || 0;
      optV += `<option value="${v.id}">${v.id} - ${v.modelo || v.veiculo} (Odo/Hor: ${odoTxt.toFixed(1)})</option>`;
  });
  if(document.getElementById('selVeiculoTransp')) document.getElementById('selVeiculoTransp').innerHTML = optV;
  
  let mDisp = window.DADOS_MOTORISTAS.filter(m => !motoristasOcupados.includes(m.nome));
  let optM = '<option value="">-- Plantão / Sem Motorista --</option>';
  mDisp.forEach(u => { optM += `<option value="${u.nome}">${u.nome}</option>`; });
  if(document.getElementById('selMotTransp')) document.getElementById('selMotTransp').innerHTML = optM;
  
  let atv = '';
  viagensAtivas.forEach(via => {
     let veic = window.DADOS_VEICULOS.find(x => x.id === via.placa);
     if(veic && (!podeVerTudo && !userSecs.includes(veic.secretaria || veic.sec))) return; 
     
     let dIni = via.dataInicio ? new Date(via.dataInicio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
     atv += `<tr>
       <td><b class="text-primary">${via.placa}</b><br><small class="text-muted">${veic? (veic.modelo||veic.veiculo) :''}</small></td>
       <td>${via.nomeMotorista}</td>
       <td>${via.percurso}</td>
       <td>${dIni}</td>
       <td class="text-end">
           <button class="btn btn-sm btn-danger shadow-sm" onclick="window.encerrarViagem('${via.id}','${via.placa}')"><i class="fas fa-stop-circle"></i></button>
       </td>
     </tr>`;
  });
  if(document.getElementById('listaAtivosTransp')) document.getElementById('listaAtivosTransp').innerHTML = atv || '<tr><td colspan="5" class="text-center text-muted">Nenhum equipamento em uso.</td></tr>';
};

window.criarViagem = async function() {
  let elVeic = document.getElementById('selVeiculoTransp');
  let elMot = document.getElementById('selMotTransp');
  let elPerc = document.getElementById('txtPercurso');
  if(!elVeic || !elPerc) return;

  const p = elVeic.value;
  if(!p) return alert("Selecione um equipamento");
  
  let btn = document.querySelector('#viewGestorTransp .btn-primary');
  window.toggleButtonLoading(btn, true); window.loading(true, "Despachando...");
  try {
    let vId = "V-" + Date.now();
    await setDoc(doc(db, `${window.tenant}_viagens`, vId), { 
        placa: p, nomeMotorista: (elMot && elMot.value) ? elMot.value : "PLANTÃO", 
        percurso: elPerc.value, status: 'Em Andamento', 
        dataInicio: new Date().toISOString(), gestor: window.USUARIO.nome 
    });
    await setDoc(doc(db, `${window.tenant}_veiculos`, p), {status_operacional: 'Em Uso'}, {merge:true});
    elPerc.value = '';
    if(window.buscarTudo) await window.buscarTudo();
  } catch(e) { console.error(e); alert("Erro: " + e.message); } finally { window.toggleButtonLoading(btn, false); window.loading(false); }
};

window.encerrarViagem = async function(idViagem, placa) {
  if(!confirm("Encerrar uso do equipamento?")) return;
  window.loading(true);
  try {
      await setDoc(doc(db, `${window.tenant}_viagens`, idViagem), {status: 'Finalizada', dataFim: new Date().toISOString()}, {merge:true});
      await setDoc(doc(db, `${window.tenant}_veiculos`, placa), {status_operacional: 'Disponível'}, {merge:true});
      if(window.buscarTudo) await window.buscarTudo();
  } catch(e) { console.error(e); alert("Erro: " + e.message); window.loading(false); }
};

// =========================================================================
// 3. GESTORES DE ABASTECIMENTO (FILA E AVULSOS)
// =========================================================================
window.renderPainelAbastecimento = function() {
  const userSecs = window.USUARIO.secretarias || []; 
  const podeVerTudo = userSecs.includes('TODAS');
  
  let valesAutorizados = window.DADOS_ABASTECIMENTOS.filter(a => a.status === 'Autorizado');
  let placasAutorizadas = valesAutorizados.map(a => a.placa);

  let hLiberar = '';
  window.DADOS_VIAGENS.filter(v => v.status === 'Em Andamento').forEach(via => {
     if(placasAutorizadas.includes(via.placa)) return; 
     let veic = window.DADOS_VEICULOS.find(x => x.id === via.placa);
     if(veic && (!podeVerTudo && !userSecs.includes(veic.secretaria || veic.sec))) return;
     hLiberar += `<div class="col-md-4"><div class="card p-3 border-start border-primary border-4 shadow-sm h-100"><h4 class="fw-bold mb-0">${via.placa}</h4><small class="text-muted d-block mb-2">${veic?(veic.modelo||veic.veiculo):''}</small><button class="btn btn-success btn-sm w-100 mt-auto fw-bold" onclick="window.abrirModalAutorizarGestor('${via.id}')"><i class="fas fa-check"></i> Autorizar Bomba</button></div></div>`;
  });
  if(document.getElementById('listaAbast')) document.getElementById('listaAbast').innerHTML = hLiberar || '<p class="text-muted">Nenhum equipamento da frota rodando no momento.</p>';

  let hPista = '';
  valesAutorizados.forEach(a => {
     let veic = window.DADOS_VEICULOS.find(x => x.id === a.placa);
     if(!a.placaExibicao && veic && (!podeVerTudo && !userSecs.includes(veic.secretaria || veic.sec))) return;
     let isAvulso = !!a.placaExibicao; let placaShow = isAvulso ? a.placaExibicao : a.placa;
     let txtModelo = isAvulso ? `<span class="text-danger fw-bold"><i class="fas fa-link"></i> Vinculado à Frota: ${a.placa}</span>` : (veic ? (veic.modelo||veic.veiculo) : '');
     let lblPosto = a.postoAutorizado ? `<div class="mt-2 small fw-bold text-dark"><i class="fas fa-store"></i> ${a.postoAutorizado}</div>` : '';

     hPista += `<div class="col-md-4"><div class="card p-3 border-start border-warning border-4 shadow-sm h-100 bg-light"><div class="d-flex justify-content-between"><h4 class="fw-bold m-0 text-dark">${placaShow}</h4></div><small class="text-muted d-block mb-2">${txtModelo}</small>${lblPosto}<button class="btn btn-outline-danger btn-sm mt-auto mt-3" onclick="window.cancelarVale('${a.id}')"><i class="fas fa-times"></i> Retirar da Fila</button></div></div>`;
  });
  if(document.getElementById('listaAguardandoPista')) document.getElementById('listaAguardandoPista').innerHTML = hPista || '<p class="text-muted">Fila vazia.</p>';
  
  let qtdP = valesAutorizados.length; let badge = document.getElementById('badgePista');
  if(badge) { badge.innerText = qtdP; if(qtdP > 0) badge.classList.remove('hidden'); else badge.classList.add('hidden'); }
};

window.toggleAvulso = function() { 
    let p = document.getElementById('painelAvulso');
    if(p) p.classList.toggle('hidden'); 
};

window.autorizarPlacaAvulsa = async function() {
    let elPlacaBomba = document.getElementById('txtPlacaAvulsa');
    let elVeicReal = document.getElementById('selVeiculoRealAvulso');
    let elMotorista = document.getElementById('txtMotoristaAvulso');
    let elObs = document.getElementById('txtObsAvulso');
    let elPosto = document.getElementById('selPostoAvulso');

    if(!elPlacaBomba || !elVeicReal || !elPosto) return;

    const placaBomba = elPlacaBomba.value.toUpperCase().trim();
    const veiculoRealId = elVeicReal.value;
    const motorista = elMotorista ? elMotorista.value : '';
    const observacao = elObs ? elObs.value : '';
    const postoSelecionado = elPosto.value;

    if(!placaBomba) return alert("Digite a Placa que vai aparecer para o frentista.");
    if(!veiculoRealId) return alert("Você precisa escolher qual carro oficial vai receber este gasto na nota!");
    if(!postoSelecionado) return alert("Selecione para qual Posto você está enviando esta liberação!");

    let veic = window.DADOS_VEICULOS.find(x => x.id === veiculoRealId);
    let sec = veic.secretaria || veic.sec || 'GERAL';
    let dest = veic.destinacao || 'GERAL';
    
    if(window.validarContratoRigido) {
        let erroC = window.validarContratoRigido(sec, dest, veic.combustivel, postoSelecionado);
        if(erroC) return alert(erroC);
    }

    if(!confirm(`Liberar abastecimento para ${placaBomba} no posto ${postoSelecionado}?`)) return;
    
    let btn = document.querySelector('#painelAvulso .btn-primary');
    window.toggleButtonLoading(btn, true); window.loading(true, "Enviando para a fila do posto...");
    try {
        await setDoc(doc(db, `${window.tenant}_abastecimentos`, "ABAST-" + Date.now()), { 
            placa: veiculoRealId, placaExibicao: placaBomba, motorista: motorista || "PLANTÃO", observacao: observacao,
            postoAutorizado: postoSelecionado, gestorAutorizou: window.USUARIO.nome, status: 'Autorizado', dataAutorizacao: new Date().toISOString() 
        });
        elPlacaBomba.value = ''; elVeicReal.value = ''; elPosto.value = '';
        if(elMotorista) elMotorista.value = ''; if(elObs) elObs.value = ''; 
        if(document.getElementById('painelAvulso')) document.getElementById('painelAvulso').classList.add('hidden');
        if(window.buscarTudo) await window.buscarTudo();
    } catch(e) { console.error(e); alert("Erro: " + e.message); } finally { window.toggleButtonLoading(btn, false); window.loading(false); }
};

window.abrirModalAutorizarGestor = function(viagemId) {
    let via = window.DADOS_VIAGENS.find(v => v.id === viagemId);
    if(!via) return;
    if(document.getElementById('authGestorIdViagem')) document.getElementById('authGestorIdViagem').value = viagemId;
    if(document.getElementById('authGestorPlaca')) document.getElementById('authGestorPlaca').value = via.placa;
    if(document.getElementById('authGestorPlacaLabel')) document.getElementById('authGestorPlacaLabel').innerText = via.placa;
    if(document.getElementById('authGestorPosto')) document.getElementById('authGestorPosto').value = '';
    
    let motAtual = via.nomeMotorista;
    if(motAtual === "PLANTÃO" || motAtual === "N/I") motAtual = "";
    
    if(document.getElementById('authGestorMotorista')) document.getElementById('authGestorMotorista').value = motAtual;
    if(document.getElementById('authGestorObs')) document.getElementById('authGestorObs').value = '';
    if(window.modalAutorizarGestorObj) window.modalAutorizarGestorObj.show();
};

window.confirmarAutorizacao = async function() {
  const placa = document.getElementById('authGestorPlaca')?.value;
  const motorista = document.getElementById('authGestorMotorista')?.value;
  const obs = document.getElementById('authGestorObs')?.value;
  const postoSelecionado = document.getElementById('authGestorPosto')?.value;
  let btn = document.querySelector('#modalAutorizarGestor .btn-primary');
  
  if(!postoSelecionado) return alert("Por favor, selecione para qual Posto você deseja liberar o abastecimento.");

  let veic = window.DADOS_VEICULOS.find(x => x.id === placa);
  let sec = veic.secretaria || veic.sec || 'GERAL';
  let dest = veic.destinacao || 'GERAL';
  
  if(window.validarContratoRigido) {
      let erroC = window.validarContratoRigido(sec, dest, veic.combustivel, postoSelecionado);
      if(erroC) return alert(erroC);
  }

  window.toggleButtonLoading(btn, true); window.loading(true, "Enviando para o Posto...");
  try {
      await setDoc(doc(db, `${window.tenant}_abastecimentos`, "ABAST-" + Date.now()), { 
          placa: placa, motorista: motorista || "PLANTÃO", observacao: obs, postoAutorizado: postoSelecionado,
          gestorAutorizou: window.USUARIO.nome, status: 'Autorizado', dataAutorizacao: new Date().toISOString() 
      });
      if(window.modalAutorizarGestorObj) window.modalAutorizarGestorObj.hide(); 
      if(window.buscarTudo) await window.buscarTudo();
  } catch(e) { console.error(e); alert("Erro: " + e.message); } finally { window.toggleButtonLoading(btn, false); window.loading(false); }
};

window.cancelarVale = async function(id) {
  if(!confirm("Remover da fila?")) return;
  window.loading(true); 
  try { 
      await setDoc(doc(db, `${window.tenant}_abastecimentos`, id), {status:'Cancelado'}, {merge:true}); 
      if(window.buscarTudo) await window.buscarTudo(); 
  } catch(e) { console.error(e); alert("Erro: " + e.message); window.loading(false); }
};

// =========================================================================
// 4. FRENTISTA DA BOMBA E GESTÃO DE NOTAS
// =========================================================================
window.renderFilaPosto = function() {
  let setorUser = String(window.USUARIO.setor || '').toUpperCase();
  let postoDoFrentista = null;
  
  window.DADOS_POSTOS.forEach(p => {
      let codPosto = String(p.codigoVinculo || '').toUpperCase().trim();
      if(codPosto) { let regex = new RegExp(`\\b${codPosto}\\b`, 'i'); if(regex.test(setorUser)) { postoDoFrentista = p.nome; } }
  });

  let lblPainel = document.getElementById('lblNomePostoFrentista');
  if(lblPainel) {
      if(postoDoFrentista) {
          lblPainel.innerHTML = `<i class="fas fa-store"></i> ${postoDoFrentista}`;
          lblPainel.className = "text-dark mb-4 fw-bold text-center border p-2 bg-light rounded border-success shadow-sm";
      } else {
          lblPainel.innerHTML = `<i class="fas fa-exclamation-triangle text-danger"></i> Seu usuário não possui o código de nenhum posto.`;
          lblPainel.className = "text-danger mb-4 fw-bold text-center border p-2 bg-warning rounded border-danger shadow-sm";
      }
  }

  let valesAutorizados = window.DADOS_ABASTECIMENTOS.filter(a => {
      if(a.status !== 'Autorizado') return false;
      if(postoDoFrentista && a.postoAutorizado && a.postoAutorizado !== postoDoFrentista) return false;
      return true;
  });

  let h = '';
  valesAutorizados.forEach(a => {
     let placaParaFrentista = a.placaExibicao || a.placa;
     let isAvulso = !!a.placaExibicao; let v = window.DADOS_VEICULOS.find(x => x.id === a.placa);
     let icone = (v && v.tipo_padronizado === 'Máquina') ? '<i class="fas fa-tractor"></i>' : '<i class="fas fa-car"></i>';
     let descModelo = isAvulso ? 'Veículo em Rota' : (v? (v.modelo||v.veiculo):'');
     let badgeObs = a.observacao ? `<div class="bg-warning text-dark fw-bold rounded px-2 py-1 mt-2 small shadow-sm"><i class="fas fa-bell"></i> ${a.observacao}</div>` : '';

     h += `<div class="col-md-4 col-sm-6"><div class="card p-3 border-success shadow-sm text-center h-100"><h3 class="fw-bold text-success mb-0">${placaParaFrentista}</h3><h6 class="text-muted mt-1">${icone} ${descModelo}</h6>${badgeObs}<button onclick="window.abrirModalFrentista('${a.id}')" class="btn btn-success w-100 fw-bold mt-auto py-2 mt-3"><i class="fas fa-gas-pump"></i> PREENCHER BOMBA</button></div></div>`;
  });
  if(document.getElementById('listaPosto')) document.getElementById('listaPosto').innerHTML = h || '<div class="alert alert-light border">Nenhum equipamento na fila deste posto.</div>';
};

window.abrirModalFrentista = function(id) {
    let a = window.DADOS_ABASTECIMENTOS.find(x => x.id === id); if(!a) return;
    if(document.getElementById('hdnIdAbast')) document.getElementById('hdnIdAbast').value = a.id;
    let v = window.DADOS_VEICULOS.find(x => x.id === a.placa);

    let placaParaFrentista = a.placaExibicao || a.placa;
    if(document.getElementById('lblPlacaFrentista')) document.getElementById('lblPlacaFrentista').innerText = placaParaFrentista;
    
    let elModFren = document.getElementById('lblModeloFrentista');
    if(elModFren) {
        if(a.placaExibicao) { elModFren.innerHTML = `<span class="text-danger"><i class="fas fa-link"></i> Oficial: ${a.placa}</span>`; } 
        else { elModFren.innerText = v ? (v.modelo || v.veiculo) : '---'; }
    }
    
    if(document.getElementById('badgeTipoFrota')) document.getElementById('badgeTipoFrota').innerText = v ? v.tipo_padronizado : 'Veículo';
    
    let boxObs = document.getElementById('boxObsFrentista');
    if(boxObs) {
        if(a.observacao) { 
            boxObs.innerHTML = `<i class="fas fa-exclamation-circle"></i> OBS: ${a.observacao}`; 
            boxObs.classList.remove('hidden'); 
        } else { 
            boxObs.classList.add('hidden'); 
        }
    }

    if(v && v.combustivel && document.getElementById('inpCombFrentista')) document.getElementById('inpCombFrentista').value = v.combustivel;
    if(a.postoAutorizado && document.getElementById('inpPostoFrentista')) document.getElementById('inpPostoFrentista').value = a.postoAutorizado;
    
    if(document.getElementById('inpOdoFrentista')) document.getElementById('inpOdoFrentista').value = ''; 
    if(document.getElementById('inpLitrosFrentista')) document.getElementById('inpLitrosFrentista').value = '';
    
    if(window.modalFrentistaObj) window.modalFrentistaObj.show();
};

window.renderGestaoNotas = function() {
    let pendentes = window.DADOS_ABASTECIMENTOS.filter(a => a.status === 'Concluído' && !a.notaEmitida);
    pendentes.sort((a,b) => new Date(a.dataAbastecimento) - new Date(b.dataAbastecimento));

    let hPend = '';
    pendentes.forEach(a => {
        let dFmt = new Date(a.dataAbastecimento).toLocaleString('pt-BR').slice(0, 16);
        let litros = window.safeCurrency(a.quantidade).toLocaleString('pt-BR', {minimumFractionDigits: 3});
        let odo = window.safeCurrency(a.odometroPainel).toFixed(1);
        
        hPend += `<tr><td>${dFmt}</td><td class="text-muted fw-bold">${a.nomePosto || '-'}</td><td class="fw-bold text-dark">${a.placa}</td><td class="text-primary fw-bold">${litros} L</td><td class="text-danger fw-bold">${odo}</td><td><button onclick="window.marcarNotaEmitida('${a.id}')" class="btn btn-sm btn-info fw-bold shadow-sm text-white"><i class="fas fa-file-invoice"></i> Gerar NF-e</button></td></tr>`;
    });
    
    let msgVaziaPend = '<tr><td colspan="6" class="text-muted py-4">Nenhuma NF-e pendente.</td></tr>';
    if(document.getElementById('tbGestorPendentes')) document.getElementById('tbGestorPendentes').innerHTML = hPend || msgVaziaPend;
    if(document.getElementById('tbFrentPendentes')) document.getElementById('tbFrentPendentes').innerHTML = hPend || msgVaziaPend;

    let filtroDataFrent = document.getElementById('filtroDataNotasFrentista') ? document.getElementById('filtroDataNotasFrentista').value : '';
    let filtroDataGest = document.getElementById('filtroDataNotasGestor') ? document.getElementById('filtroDataNotasGestor').value : '';
    let emitidas = window.DADOS_ABASTECIMENTOS.filter(a => a.status === 'Concluído' && a.notaEmitida === true);
    
    if(document.getElementById('tbFrentEmitidas')) {
        let filtradasF = emitidas.filter(a => a.dataAbastecimento.startsWith(filtroDataFrent) || (a.dataEmissaoNota && a.dataEmissaoNota.startsWith(filtroDataFrent)));
        filtradasF.sort((a,b) => new Date(b.dataEmissaoNota) - new Date(a.dataEmissaoNota));
        let hF = '';
        filtradasF.forEach(a => {
            let dAb = new Date(a.dataAbastecimento).toLocaleString('pt-BR').slice(0, 16);
            let dEm = a.dataEmissaoNota ? new Date(a.dataEmissaoNota).toLocaleString('pt-BR').slice(0, 16) : '-';
            hF += `<tr><td>${dAb}</td><td class="text-success fw-bold">${dEm}</td><td>${a.nomePosto || '-'}</td><td class="fw-bold">${a.placa}</td><td>${window.safeCurrency(a.quantidade).toLocaleString('pt-BR', {minimumFractionDigits: 3})} L</td><td><small class="text-muted">${a.usuarioEmitiuNota}</small></td></tr>`;
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
            hG += `<tr><td>${dAb}</td><td class="text-success fw-bold">${dEm}</td><td>${a.nomePosto || '-'}</td><td class="fw-bold">${a.placa}</td><td>${window.safeCurrency(a.quantidade).toLocaleString('pt-BR', {minimumFractionDigits: 3})} L</td><td><small class="text-muted">${a.usuarioEmitiuNota}</small></td></tr>`;
        });
        document.getElementById('tbGestorEmitidas').innerHTML = hG || '<tr><td colspan="6" class="text-muted py-4">Nenhuma NF-e emitida nesta data.</td></tr>';
    }
};

window.marcarNotaEmitida = async function(id) {
  if(!confirm("Confirma emissão da NF-e Simplificada?")) return;
  window.loading(true, "Registrando emissão...");
  try {
      await setDoc(doc(db, `${window.tenant}_abastecimentos`, id), { notaEmitida: true, dataEmissaoNota: new Date().toISOString(), usuarioEmitiuNota: window.USUARIO.nome }, {merge: true});
      if(window.buscarTudo) await window.buscarTudo(); 
  } catch(e) { console.error(e); alert("Erro ao emitir nota: " + e.message); window.loading(false); }
};

window.renderRelatorioExtrasPosto = function() {
    if(!document.getElementById('tbFrentExtrasLista')) return;
    let extrasCpf = window.DADOS_ABASTECIMENTOS.filter(a => a.lancamentoManual === true && a.frentistaCpf === window.USUARIO.cpf);
    extrasCpf.sort((a,b) => new Date(b.dataAbastecimento) - new Date(a.dataAbastecimento));
    let hE = '';
    extrasCpf.forEach(a => {
        let dFmt = new Date(a.dataAbastecimento).toLocaleString('pt-BR').slice(0, 16);
        hE += `<tr><td>${dFmt}</td><td class="fw-bold">${a.placa}</td><td>${a.tipoCombustivel}</td><td class="fw-bold text-primary">${window.safeCurrency(a.quantidade).toLocaleString('pt-BR', {minimumFractionDigits: 3})} L</td><td>${a.motorista || '-'}</td></tr>`;
    });
    document.getElementById('tbFrentExtrasLista').innerHTML = hE || '<tr><td colspan="5" class="text-muted py-4">Nenhum lançamento extra realizado.</td></tr>';
};

window.renderPainelRetroativo = function() {
    if(!document.getElementById('tbMeusRetroativos')) return;
    let meusLancamentos = window.DADOS_ABASTECIMENTOS.filter(a => a.lancamentoManual === true && a.frentistaCpf === window.USUARIO.cpf);
    meusLancamentos.sort((a,b) => new Date(b.dataAbastecimento) - new Date(a.dataAbastecimento));
    let h = '';
    meusLancamentos.forEach(a => {
        let dFmt = new Date(a.dataAbastecimento).toLocaleString('pt-BR').slice(0, 16);
        h += `<tr><td>${dFmt}</td><td class="fw-bold text-dark">${a.placa}</td><td>${a.tipoCombustivel}</td><td class="text-primary fw-bold">${window.safeCurrency(a.quantidade).toLocaleString('pt-BR', {minimumFractionDigits: 3})} L</td><td>${a.nomePosto || '-'}</td></tr>`;
    });
    document.getElementById('tbMeusRetroativos').innerHTML = h || '<tr><td colspan="5" class="text-muted py-4">Nenhum lançamento retroativo realizado por você.</td></tr>';
};
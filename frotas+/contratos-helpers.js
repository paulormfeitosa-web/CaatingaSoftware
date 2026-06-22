import { db } from './firebase-env.js';
import { doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.atualizarFiltroDestContrato = function() {
    let elSec = document.getElementById('filtroContratoSec');
    let elDest = document.getElementById('filtroContratoDest');
    if(!elSec || !elDest) return;

    let sec = elSec.value.toUpperCase();
    let dests = (window.DADOS_CONTRATOS || []).filter(c => !sec || (c.secretaria && c.secretaria.toUpperCase() === sec)).map(c => c.destinacao || 'GERAL');
    let unicos = [...new Set(dests)].sort();
    
    let html = '<option value="">TODAS AS DESTINAÇÕES</option>';
    unicos.forEach(d => html += `<option value="${d}">${d}</option>`);
    elDest.innerHTML = html;
};

window.adicionarDestinacaoTemp = function() {
    let els = {
        dest: document.getElementById('cadContratoDest'),
        gL: document.getElementById('cadGasL'), gV: document.getElementById('cadGasV'),
        dL: document.getElementById('cadDieL'), dV: document.getElementById('cadDieV'),
        eL: document.getElementById('cadEtaL'), eV: document.getElementById('cadEtaV')
    };

    if(!els.dest) return;

    let dest = els.dest.value.toUpperCase().trim() || 'GERAL';
    let gL = els.gL ? window.safeCurrency(els.gL.value) : 0; let gV = els.gV ? window.safeCurrency(els.gV.value) : 0;
    let dL = els.dL ? window.safeCurrency(els.dL.value) : 0; let dV = els.dV ? window.safeCurrency(els.dV.value) : 0;
    let eL = els.eL ? window.safeCurrency(els.eL.value) : 0; let eV = els.eV ? window.safeCurrency(els.eV.value) : 0;
    
    let subtotal = (gL * gV) + (dL * dV) + (eL * eV);
    
    if(subtotal === 0) return alert("A divisão precisa ter pelo menos um combustível com quantidade e preço.");
    
    let idx = window.tempDestinacoes.findIndex(x => x.destinacao === dest);
    if(idx >= 0) return alert(`A divisão "${dest}" já está na lista. Remova-a antes.`);
    
    window.tempDestinacoes.push({ 
        idDoc: "CONT-" + Date.now() + Math.floor(Math.random()*100000), 
        destinacao: dest, 
        gasolina: { litros: gL, precoLicitado: gV }, 
        diesel: { litros: dL, precoLicitado: dV }, 
        etanol: { litros: eL, precoLicitado: eV }, 
        valorInicial: subtotal 
    });
    
    els.dest.value = ''; 
    if(els.gL) els.gL.value = ''; if(els.gV) els.gV.value = '';
    if(els.dL) els.dL.value = ''; if(els.dV) els.dV.value = ''; 
    if(els.eL) els.eL.value = ''; if(els.eV) els.eV.value = '';
    
    window.renderTempDest();
};

window.removerDestTemp = function(index) { 
    window.tempDestinacoes.splice(index, 1); 
    window.renderTempDest(); 
};

window.renderTempDest = function() {
    let h = ''; let totalGeral = 0;
    if(window.tempDestinacoes.length === 0) { 
        h = '<tr><td colspan="6" class="text-muted small py-3">Nenhuma divisão adicionada.</td></tr>'; 
    } else {
        window.tempDestinacoes.forEach((item, idx) => {
            totalGeral += item.valorInicial;
            let txtG = item.gasolina.litros > 0 ? `${item.gasolina.litros} L (R$ ${item.gasolina.precoLicitado})` : '-';
            let txtD = item.diesel.litros > 0 ? `${item.diesel.litros} L (R$ ${item.diesel.precoLicitado})` : '-';
            let txtE = item.etanol.litros > 0 ? `${item.etanol.litros} L (R$ ${item.etanol.precoLicitado})` : '-';
            h += `<tr><td class="fw-bold text-primary">${item.destinacao}</td><td class="small text-danger">${txtG}</td><td class="small text-dark">${txtD}</td><td class="small text-success">${txtE}</td><td class="fw-bold text-dark">R$ ${item.valorInicial.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td><button class="btn btn-sm text-danger" title="Remover da lista" onclick="window.removerDestTemp(${idx})"><i class="fas fa-times"></i></button></td></tr>`;
        });
    }
    
    let elTb = document.getElementById('tbTempDestinacoes');
    let elTotal = document.getElementById('lblTotalCont');
    
    if(elTb) elTb.innerHTML = h;
    if(elTotal) elTotal.innerText = "R$ " + totalGeral.toLocaleString('pt-BR', {minimumFractionDigits:2});
};

window.salvarContratoLote = async function() {
    let els = {
        sec: document.getElementById('cadContratoSec'),
        num: document.getElementById('cadContratoNum'),
        posto: document.getElementById('cadContratoPosto'),
        validade: document.getElementById('cadContratoValidade'),
        hdn: document.getElementById('hdnIdContrato'),
        btnSave: document.getElementById('btnSaveContrato')
    };

    if(!els.sec || !els.validade) return;

    const sec = els.sec.value.toUpperCase().trim();
    const num = els.num ? els.num.value.trim() : '';
    const posto = els.posto ? els.posto.value : 'TODOS';
    const validade = els.validade.value;
    const editId = els.hdn ? els.hdn.value : ''; 

    if(!sec) return alert("A Secretaria Macro é obrigatória.");
    if(!validade) return alert("A Data de Validade é obrigatória.");

    window.toggleButtonLoading(els.btnSave, true); 
    window.loading(true, "Gravando Banco...");
    
    try {
        if(editId) {
            let elDest = document.getElementById('cadContratoDest');
            let dest = elDest ? elDest.value.toUpperCase().trim() || 'GERAL' : 'GERAL';
            
            let gL = document.getElementById('cadGasL') ? window.safeCurrency(document.getElementById('cadGasL').value) : 0;
            let gV = document.getElementById('cadGasV') ? window.safeCurrency(document.getElementById('cadGasV').value) : 0;
            let dL = document.getElementById('cadDieL') ? window.safeCurrency(document.getElementById('cadDieL').value) : 0;
            let dV = document.getElementById('cadDieV') ? window.safeCurrency(document.getElementById('cadDieV').value) : 0;
            let eL = document.getElementById('cadEtaL') ? window.safeCurrency(document.getElementById('cadEtaL').value) : 0;
            let eV = document.getElementById('cadEtaV') ? window.safeCurrency(document.getElementById('cadEtaV').value) : 0;
            
            let subtotal = (gL * gV) + (dL * dV) + (eL * eV);
            let payload = { secretaria: sec, destinacao: dest, numero: num, posto: posto, validade: validade, gasolina: { litros: gL, precoLicitado: gV }, diesel: { litros: dL, precoLicitado: dV }, etanol: { litros: eL, precoLicitado: eV }, valorInicial: subtotal };
            
            await setDoc(doc(db, `${window.tenant}_contratos`, editId), payload, {merge: true});
        } else {
            if(window.tempDestinacoes.length === 0) { 
                window.loading(false); 
                window.toggleButtonLoading(els.btnSave, false); 
                return alert("Adicione pelo menos uma Divisão/Destinação."); 
            }
            for (let item of window.tempDestinacoes) {
                let payload = { secretaria: sec, destinacao: item.destinacao, numero: num, posto: posto, validade: validade, gasolina: item.gasolina, diesel: item.diesel, etanol: item.etanol, valorInicial: item.valorInicial, aditivos: [], liquidados: [] };
                await setDoc(doc(db, `${window.tenant}_contratos`, item.idDoc), payload, {merge: true});
            }
        }
        window.cancelarEdicaoContrato(); 
        if(window.buscarTudo) await window.buscarTudo();
    } catch(e) { 
        console.error(e); alert("Erro: " + e.message); 
    } finally { 
        window.toggleButtonLoading(els.btnSave, false); window.loading(false); 
    }
};

window.cancelarEdicaoContrato = function() {
    let ids = [
        'cadContratoSec', 'cadContratoNum', 'cadContratoValidade', 'hdnIdContrato',
        'cadContratoDest', 'cadGasL', 'cadGasV', 'cadDieL', 'cadDieV', 'cadEtaL', 'cadEtaV'
    ];
    
    ids.forEach(id => {
        let el = document.getElementById(id);
        if(el) el.value = '';
    });

    let elPosto = document.getElementById('cadContratoPosto');
    if(elPosto) elPosto.value = 'TODOS';
    
    let elBoxLista = document.getElementById('boxAddListaContrato');
    if(elBoxLista) elBoxLista.classList.remove('hidden');
    
    let elBoxTabela = document.getElementById('boxTabelaContratoTemp');
    if(elBoxTabela) elBoxTabela.classList.remove('hidden');
    
    window.tempDestinacoes = []; 
    window.renderTempDest();
    
    let btnSave = document.getElementById('btnSaveContrato');
    if(btnSave) btnSave.innerHTML = '<i class="fas fa-save"></i> SALVAR CONTRATO COMPLETO'; 
    
    let btnCancel = document.getElementById('btnCancelContrato');
    if(btnCancel) btnCancel.classList.add('hidden');
};

window.editarContrato = function(id) {
    let c = (window.DADOS_CONTRATOS || []).find(x => x.id === id); 
    if(!c) return;
    
    let els = {
        sec: document.getElementById('cadContratoSec'),
        num: document.getElementById('cadContratoNum'),
        posto: document.getElementById('cadContratoPosto'),
        validade: document.getElementById('cadContratoValidade'),
        hdn: document.getElementById('hdnIdContrato'),
        dest: document.getElementById('cadContratoDest'),
        gL: document.getElementById('cadGasL'), gV: document.getElementById('cadGasV'),
        dL: document.getElementById('cadDieL'), dV: document.getElementById('cadDieV'),
        eL: document.getElementById('cadEtaL'), eV: document.getElementById('cadEtaV'),
        boxLista: document.getElementById('boxAddListaContrato'),
        boxTabela: document.getElementById('boxTabelaContratoTemp'),
        btnSave: document.getElementById('btnSaveContrato'),
        btnCancel: document.getElementById('btnCancelContrato')
    };

    if(els.sec) els.sec.value = c.secretaria || ''; 
    if(els.num) els.num.value = c.numero || ''; 
    if(els.posto) els.posto.value = c.posto || 'TODOS'; 
    if(els.validade) els.validade.value = c.validade || ''; 
    if(els.hdn) els.hdn.value = c.id;
    if(els.dest) els.dest.value = c.destinacao || 'GERAL';
    
    if(els.gL) els.gL.value = window.formatarNumeroInput(c.gasolina?.litros, 3); 
    if(els.gV) els.gV.value = window.formatarNumeroInput(c.gasolina?.precoLicitado, 2);
    if(els.dL) els.dL.value = window.formatarNumeroInput(c.diesel?.litros, 3); 
    if(els.dV) els.dV.value = window.formatarNumeroInput(c.diesel?.precoLicitado, 2);
    if(els.eL) els.eL.value = window.formatarNumeroInput(c.etanol?.litros, 3); 
    if(els.eV) els.eV.value = window.formatarNumeroInput(c.etanol?.precoLicitado, 2);
    
    if(els.boxLista) els.boxLista.classList.add('hidden'); 
    if(els.boxTabela) els.boxTabela.classList.add('hidden');
    
    if(els.btnSave) els.btnSave.innerHTML = '<i class="fas fa-save"></i> SALVAR ALTERAÇÃO DO LOTE'; 
    if(els.btnCancel) els.btnCancel.classList.remove('hidden'); 
    
    window.scrollTo(0, 0);
};

window.excluirContrato = async function(id) {
    if(!confirm("Excluir este centro de custo permanentemente? (Não apaga abastecimentos).")) return;
    window.loading(true, "Removendo contrato...");
    try { 
        await deleteDoc(doc(db, `${window.tenant}_contratos`, id)); 
        if(window.buscarTudo) await window.buscarTudo(); 
    } catch(e) { 
        console.error(e); alert("Erro: " + e.message); window.loading(false); 
    }
};
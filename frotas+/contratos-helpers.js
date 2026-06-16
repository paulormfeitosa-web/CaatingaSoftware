import { db } from './firebase-env.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.validarContratoRigido = function(sec, dest, comb, posto) {
    if(!sec) return null; 
    let d = dest || 'GERAL';
    let contratos = window.DADOS_CONTRATOS.filter(c => 
        c.secretaria && c.secretaria.toUpperCase() === sec.toUpperCase() && 
        (c.destinacao || 'GERAL').toUpperCase() === d.toUpperCase()
    );
    
    if(contratos.length === 0) return `BLOQUEADO: A Secretaria ${sec} (${d}) não possui nenhum contrato/centro de custo cadastrado.`;
    
    let dHoje = new Date().toISOString().slice(0, 10);
    let temValido = false;
    
    for(let c of contratos) {
        let isVigente = c.validade && c.validade >= dHoje;
        let isPosto = !c.posto || c.posto === "TODOS" || String(c.posto).toUpperCase() === String(posto).toUpperCase();
        let isComb = false;
        
        // Validação segura usando a função safeCurrency para os litros contratados
        if (comb === 'Gasolina' && c.gasolina && window.safeCurrency(c.gasolina.litros) > 0) isComb = true;
        if (comb === 'Diesel' && c.diesel && window.safeCurrency(c.diesel.litros) > 0) isComb = true;
        if (comb === 'Etanol' && c.etanol && window.safeCurrency(c.etanol.litros) > 0) isComb = true;
        
        if(isVigente && isPosto && isComb) { temValido = true; break; }
    }
    
    if(!temValido) return `BLOQUEADO: A Secretaria ${sec} (${d}) está com o contrato VENCIDO ou não possui licitação ativa para ${comb} no posto ${posto}.`;
    return null;
};

window.calcularTotaisContrato = function(c) {
    if (!c) return null;
    let litrosGasTotal = c.gasolina ? window.safeCurrency(c.gasolina.litros) : 0;
    let litrosDieTotal = c.diesel ? window.safeCurrency(c.diesel.litros) : 0;
    let litrosEtaTotal = c.etanol ? window.safeCurrency(c.etanol.litros) : 0;
    let totalValorContrato = window.safeCurrency(c.valorInicial);

    if(c.aditivos) {
        c.aditivos.forEach(ad => { 
            if(ad.combustivel === 'Gasolina') litrosGasTotal += window.safeCurrency(ad.litros);
            if(ad.combustivel === 'Diesel') litrosDieTotal += window.safeCurrency(ad.litros);
            if(ad.combustivel === 'Etanol') litrosEtaTotal += window.safeCurrency(ad.litros);
            totalValorContrato += window.safeCurrency(ad.valor); 
        });
    }

    let litrosGasGasto = 0, litrosDieGasto = 0, litrosEtaGasto = 0, valorGasto = 0;
    
    window.DADOS_ABASTECIMENTOS.forEach(a => {
        if(a.status !== 'Concluído') return;
        
        let aSec = a.secretaria; 
        let aDest = a.destinacao || 'GERAL';
        
        // Recupera secretaria/destino do veículo caso o abastecimento não tenha (retroativo)
        if(!aSec) { 
            let v = window.DADOS_VEICULOS.find(x => x.id === a.placa); 
            aSec = v ? v.secretaria : null; 
            if(!a.destinacao && v) aDest = v.destinacao || 'GERAL'; 
        }
        
        if (!aSec || !c.secretaria) return;
        
        let checkSec = aSec.toUpperCase() === c.secretaria.toUpperCase();
        let checkDest = aDest.toUpperCase() === (c.destinacao || 'GERAL').toUpperCase();
        let checkPosto = (!c.posto || c.posto === "TODOS" || String(a.nomePosto).toUpperCase() === String(c.posto).toUpperCase());
        
        if(checkSec && checkDest && checkPosto) {
            if(a.tipoCombustivel === 'Gasolina' && litrosGasTotal > 0) { litrosGasGasto += window.safeCurrency(a.quantidade); valorGasto += window.safeCurrency(a.valorTotal); }
            if(a.tipoCombustivel === 'Diesel' && litrosDieTotal > 0) { litrosDieGasto += window.safeCurrency(a.quantidade); valorGasto += window.safeCurrency(a.valorTotal); }
            if(a.tipoCombustivel === 'Etanol' && litrosEtaTotal > 0) { litrosEtaGasto += window.safeCurrency(a.quantidade); valorGasto += window.safeCurrency(a.valorTotal); }
        }
    });

    let valorLiquidado = 0;
    if(c.liquidados) { c.liquidados.forEach(l => { valorLiquidado += window.safeCurrency(l.valor); }); }
    
    return { 
        litrosGasTotal, litrosDieTotal, litrosEtaTotal, 
        totalValorContrato, litrosGasGasto, litrosDieGasto, litrosEtaGasto, 
        valorGasto, valorLiquidado, 
        saldoValor: totalValorContrato - valorGasto, 
        saldoPendentePgto: valorGasto - valorLiquidado 
    };
};

window.renderContratos = function() {
    let elFSec = document.getElementById('filtroContratoSec');
    let elFDest = document.getElementById('filtroContratoDest');
    let elFPosto = document.getElementById('filtroContratoPosto');
    
    let fSec = elFSec ? elFSec.value.toUpperCase() : '';
    let fDest = elFDest ? elFDest.value.toUpperCase() : '';
    let fPosto = elFPosto ? elFPosto.value.toUpperCase() : '';

    let contratosOrdenados = [...window.DADOS_CONTRATOS].sort((a,b) => {
        let sA = (a.secretaria || '').toUpperCase(); let sB = (b.secretaria || '').toUpperCase();
        if(sA < sB) return -1; if(sA > sB) return 1;
        let dA = (a.destinacao || 'GERAL').toUpperCase(); let dB = (b.destinacao || 'GERAL').toUpperCase();
        if(dA < dB) return -1; if(dA > dB) return 1; return 0;
    });

    let h = ''; let dHoje = new Date().toISOString().slice(0, 10);
    
    // Funções auxiliares para manter o padrão na renderização
    const formataLitro = (valor) => valor.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3});
    const formataMoeda = (valor) => valor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    contratosOrdenados.forEach(c => {
        if(fSec && (!c.secretaria || c.secretaria.toUpperCase() !== fSec)) return;
        if(fDest && (c.destinacao || 'GERAL').toUpperCase() !== fDest) return;
        if(fPosto && c.posto && c.posto !== "TODOS" && c.posto.toUpperCase() !== fPosto) return;

        let totais = window.calcularTotaisContrato(c);
        let corSaldoV = totais.saldoValor < 0 ? 'text-danger' : 'text-success';
        let statusValidade = (c.validade && c.validade < dHoje) ? `<span class="badge bg-danger shadow-sm"><i class="fas fa-exclamation-triangle"></i> VENCIDO</span>` : `<span class="badge bg-success shadow-sm"><i class="fas fa-calendar-check"></i> Até ${c.validade ? c.validade.split('-').reverse().join('/') : '-'}</span>`;
        let badgePosto = c.posto && c.posto !== "TODOS" ? `<span class="badge bg-dark me-1 mb-1"><i class="fas fa-gas-pump"></i> ${c.posto}</span>` : `<span class="badge bg-secondary me-1 mb-1">Todos Postos</span>`;
        
        let htmlCombustiveis = '';
        
        if(totais.litrosGasTotal > 0) htmlCombustiveis += `<div class="linha-comb d-flex justify-content-between"><span><i class="fas fa-tint text-danger"></i> Gasolina</span> <b><span class="${totais.litrosGasTotal - totais.litrosGasGasto < 0 ? 'text-danger' : 'text-primary'}">${formataLitro(totais.litrosGasTotal - totais.litrosGasGasto)} L</span> <small class="text-muted">/ ${formataLitro(totais.litrosGasTotal)} L</small></b></div>`;
        if(totais.litrosDieTotal > 0) htmlCombustiveis += `<div class="linha-comb d-flex justify-content-between"><span><i class="fas fa-tint text-dark"></i> Diesel</span> <b><span class="${totais.litrosDieTotal - totais.litrosDieGasto < 0 ? 'text-danger' : 'text-dark'}">${formataLitro(totais.litrosDieTotal - totais.litrosDieGasto)} L</span> <small class="text-muted">/ ${formataLitro(totais.litrosDieTotal)} L</small></b></div>`;
        if(totais.litrosEtaTotal > 0) htmlCombustiveis += `<div class="linha-comb d-flex justify-content-between"><span><i class="fas fa-tint text-success"></i> Etanol</span> <b><span class="${totais.litrosEtaTotal - totais.litrosEtaGasto < 0 ? 'text-danger' : 'text-success'}">${formataLitro(totais.litrosEtaTotal - totais.litrosEtaGasto)} L</span> <small class="text-muted">/ ${formataLitro(totais.litrosEtaTotal)} L</small></b></div>`;

        h += `<div class="col-md-6 col-lg-4"><div class="card p-3 shadow-sm contract-box h-100 position-relative">
            <button class="btn btn-sm text-danger position-absolute top-0 end-0 m-2" onclick="window.excluirContrato('${c.id}')" title="Excluir Contrato"><i class="fas fa-trash"></i></button>
            <h5 class="fw-bold mb-0 text-dark">${c.secretaria || 'NÃO INFORMADA'}</h5>
            <div class="fw-bold text-primary mb-1"><i class="fas fa-bullseye"></i> ${c.destinacao || 'GERAL'}</div>
            <small class="text-muted d-block mb-2">Contrato Nº ${c.numero || "S/N"} | ${statusValidade}</small><div class="mb-2">${badgePosto}</div>
            <div class="bg-light p-2 rounded border mb-2"><div class="small text-muted fw-bold mb-1">SALDO DE VOLUME (LITROS):</div>${htmlCombustiveis}</div>
            <div class="bg-white p-2 rounded border mb-2"><div class="d-flex justify-content-between mb-1"><span class="small fw-bold text-muted">Teto Financeiro (R$):</span><span class="small fw-bold text-dark">R$ ${formataMoeda(totais.totalValorContrato)}</span></div><div class="d-flex justify-content-between mb-1"><span class="small fw-bold text-muted">Total Consumido (R$):</span><span class="small fw-bold text-danger">R$ ${formataMoeda(totais.valorGasto)}</span></div><hr class="my-1"><div class="d-flex justify-content-between"><span class="small fw-bold text-muted">SALDO RESTANTE (R$):</span><span class="small fw-bold ${corSaldoV}">R$ ${formataMoeda(totais.saldoValor)}</span></div></div>
            <div class="p-2 border rounded border-success mb-3 bg-white"><div class="d-flex justify-content-between mb-1"><span class="small fw-bold text-success">Pago (Liquidado):</span><span class="small fw-bold text-success">R$ ${formataMoeda(totais.valorLiquidado)}</span></div><div class="d-flex justify-content-between"><span class="small fw-bold text-danger">Saldo Devedor:</span><span class="small fw-bold text-danger">R$ ${formataMoeda(totais.saldoPendentePgto)}</span></div></div>
            <div class="d-flex gap-1 mt-auto flex-wrap">
                <button onclick="window.editarContrato('${c.id}')" class="btn btn-outline-dark btn-sm flex-fill fw-bold px-1"><i class="fas fa-edit"></i> Editar</button>
                <button onclick="window.abrirModalAditivo('${c.id}')" class="btn btn-outline-primary btn-sm flex-fill fw-bold px-1"><i class="fas fa-plus"></i> Op</button>
                <button onclick="window.abrirModalLiquidar('${c.id}')" class="btn btn-outline-success btn-sm flex-fill fw-bold px-1"><i class="fas fa-check"></i> Pago</button>
                <button onclick="window.abrirModalExtrato('${c.id}')" class="btn btn-secondary btn-sm flex-fill fw-bold px-1"><i class="fas fa-list"></i> Extrato</button>
            </div>
        </div></div>`;
    });
    
    let elCards = document.getElementById('listaContratosCards');
    if(elCards) elCards.innerHTML = h || '<div class="col-12"><div class="alert alert-light border text-center text-muted py-4">Nenhum contrato cadastrado ou encontrado.</div></div>';
};

window.salvarAditivo = async function() {
    let elId = document.getElementById('aditContratoId');
    let elTipo = document.getElementById('aditTipo');
    let elComb = document.getElementById('aditComb');
    let elData = document.getElementById('aditData');
    let elLitros = document.getElementById('aditLitros');
    let elValor = document.getElementById('aditValor');
    let elObs = document.getElementById('aditObs');

    if(!elId || !elTipo || !elComb || !elData || !elLitros || !elValor) return;

    const id = elId.value;
    const tipo = elTipo.value; 
    const comb = elComb.value; 
    const dt = elData.value;
    const litros = window.safeCurrency(elLitros.value); 
    const valor = window.safeCurrency(elValor.value); 
    const obs = elObs ? elObs.value.trim() : "";
    
    let btn = document.querySelector('#modalAditivoContrato .btn-primary');
    
    if(!id || (litros === 0 && valor === 0)) return alert("Preencha litros ou valor.");
    
    window.toggleButtonLoading(btn, true); window.loading(true, "Registrando Operação...");
    
    try {
        let c = window.DADOS_CONTRATOS.find(x => x.id === id); 
        if(!c) throw new Error("Contrato não encontrado no sistema.");
        
        let ads = c.aditivos || [];
        ads.push({ id: Date.now().toString(), data: dt, tipo: tipo, combustivel: comb, litros: litros, valor: valor, justificativa: obs });
        
        await setDoc(doc(db, `${window.tenant}_contratos`, id), { aditivos: ads }, {merge:true});
        if(window.modalAditivoObj) window.modalAditivoObj.hide(); 
        await window.buscarTudo();
    } catch(e) { 
        console.error(e); alert("Erro: " + e.message); 
    } finally { 
        window.toggleButtonLoading(btn, false); window.loading(false); 
    }
};

window.salvarLiquidacao = async function() {
    let elId = document.getElementById('liqContratoId');
    let elMes = document.getElementById('liqMesAno');
    let elValor = document.getElementById('liqValor');

    if(!elId || !elMes || !elValor) return;

    const id = elId.value; 
    const mes = elMes.value; 
    const valor = window.safeCurrency(elValor.value);
    
    let btn = document.querySelector('#modalLiquidarContrato .btn-success');
    
    if(!id || !mes || valor <= 0) return alert("Preencha o Mês e o Valor pago.");
    
    window.toggleButtonLoading(btn, true); window.loading(true, "Registrando Pagamento...");
    
    try {
        let c = window.DADOS_CONTRATOS.find(x => x.id === id); 
        if(!c) throw new Error("Contrato não encontrado no sistema.");
        
        let liqs = c.liquidados || [];
        liqs.push({ id: Date.now().toString(), mes: mes, valor: valor });
        
        await setDoc(doc(db, `${window.tenant}_contratos`, id), { liquidados: liqs }, {merge:true});
        if(window.modalLiquidarObj) window.modalLiquidarObj.hide(); 
        await window.buscarTudo();
    } catch(e) { 
        console.error(e); alert("Erro: " + e.message); 
    } finally { 
        window.toggleButtonLoading(btn, false); window.loading(false); 
    }
};
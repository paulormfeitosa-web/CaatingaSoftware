import { db } from './firebase-env.js';
import { doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const mod = "frota";

window.renderizarTabelaContratos = function(contratos) {
    const tb = document.querySelector('#table-contratos tbody'); 
    if(!tb) return; 
    tb.innerHTML = '';
    
    if(contratos.length === 0) { 
        tb.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Nenhum contrato cadastrado.</td></tr>'; 
        return; 
    }
    
    contratos.forEach(c => {
        let tipoBadge = c.categoria === 'Itens' ? '<span class="badge bg-dark mt-1">Catálogo</span>' : '<span class="badge bg-secondary mt-1">Global</span>';
        let HTMLSaldo = '';

        if(c.categoria === 'Itens') {
            let teto = c.valor_total || 0;
            let gasto = c.saldo_consumido_real || 0;
            let saldo = teto - gasto;
            let pct = teto > 0 ? (gasto / teto) * 100 : 0;
            let colorClass = pct > 90 ? 'bg-danger' : (pct > 70 ? 'bg-warning text-dark' : 'bg-success');

            HTMLSaldo = `
              <div class="d-flex justify-content-between small fw-bold mb-1">
                 <span class="text-secondary">Licitado: ${window.formatarMoeda(teto)}</span>
                 <span class="${saldo < 0 ? 'text-danger' : 'text-success'}">Saldo: ${window.formatarMoeda(saldo)}</span>
              </div>
              <div class="progress-bar-fundo shadow-sm" style="height: 16px;">
                 <div class="progress-bar-preenchimento ${colorClass}" style="width: ${Math.min(pct, 100)}%; font-size: 10px; line-height: 16px;">${pct.toFixed(1)}% Consumido</div>
              </div>
            `;
        } 
        else if(c.categoria === 'Global' && c.lotes_contrato && c.lotes_contrato.length > 0) {
            HTMLSaldo = `<div class="d-flex flex-column gap-2" style="max-height: 220px; overflow-y: auto; padding-right: 5px;">`;
            c.lotes_contrato.forEach(l => {
                let tetoP = l.teto_pecas || 0; let gastoP = l.consumido_pecas || 0; let saldoP = tetoP - gastoP; let pctP = tetoP > 0 ? (gastoP / tetoP) * 100 : 0; let colP = pctP > 90 ? 'bg-danger' : (pctP > 70 ? 'bg-warning text-dark' : 'bg-success');
                let tetoS = l.teto_servicos || 0; let gastoS = l.consumido_servicos || 0; let saldoS = tetoS - gastoS; let pctS = tetoS > 0 ? (gastoS / tetoS) * 100 : 0; let colS = pctS > 90 ? 'bg-danger' : (pctS > 70 ? 'bg-warning text-dark' : 'bg-success');

                HTMLSaldo += `
                <div class="border rounded p-1 bg-white shadow-sm">
                    <div class="text-center small fw-bold text-dark border-bottom border-light mb-1 bg-light pb-1">${l.descricao}</div>
                    <div class="row g-1 px-1">
                       <div class="col-6 border-end">
                          <div class="d-flex justify-content-between" style="font-size: 10px;">
                              <span class="text-secondary">Pçs</span><span class="${saldoP < 0 ? 'text-danger' : 'text-primary'} fw-bold">${window.formatarMoeda(saldoP)}</span>
                          </div>
                          <div class="progress-bar-fundo" style="height: 10px; margin-top: 1px;"><div class="progress-bar-preenchimento ${colP}" style="width: ${Math.min(pctP, 100)}%;"></div></div>
                       </div>
                       <div class="col-6">
                          <div class="d-flex justify-content-between" style="font-size: 10px;">
                              <span class="text-secondary">M.O.</span><span class="${saldoS < 0 ? 'text-danger' : 'text-warning text-dark'} fw-bold">${window.formatarMoeda(saldoS)}</span>
                          </div>
                          <div class="progress-bar-fundo" style="height: 10px; margin-top: 1px;"><div class="progress-bar-preenchimento ${colS}" style="width: ${Math.min(pctS, 100)}%;"></div></div>
                       </div>
                    </div>
                </div>`;
            });
            HTMLSaldo += `</div>`;
        } else {
            let tetoPecas = c.valor_teto_pecas || 0; let gastoPecas = c.saldo_consumido_pecas || 0; let saldoPecas = tetoPecas - gastoPecas; let pctPecas = tetoPecas > 0 ? (gastoPecas / tetoPecas) * 100 : 0; let colorPecas = pctPecas > 90 ? 'bg-danger' : (pctPecas > 70 ? 'bg-warning text-dark' : 'bg-success');
            let tetoServicos = c.valor_teto_servicos || 0; let gastoServicos = c.saldo_consumido_servicos || 0; let saldoServicos = tetoServicos - gastoServicos; let pctServ = tetoServicos > 0 ? (gastoServicos / tetoServicos) * 100 : 0; let colorServ = pctServ > 90 ? 'bg-danger' : (pctServ > 70 ? 'bg-warning text-dark' : 'bg-success');

            HTMLSaldo = `
              <div class="row g-2 align-items-center">
                 <div class="col-12 col-md-6 border-end">
                    <div class="d-flex justify-content-between small fw-bold"><span class="text-secondary">Peças</span><span class="${saldoPecas < 0 ? 'text-danger' : 'text-primary'}">${window.formatarMoeda(saldoPecas)}</span></div>
                    <div class="progress-bar-fundo shadow-sm" style="height: 12px; margin-top: 2px;"><div class="progress-bar-preenchimento ${colorPecas}" style="width: ${Math.min(pctPecas, 100)}%;"></div></div>
                 </div>
                 <div class="col-12 col-md-6">
                    <div class="d-flex justify-content-between small fw-bold"><span class="text-secondary">M.O.</span><span class="${saldoServicos < 0 ? 'text-danger' : 'text-warning'}">${window.formatarMoeda(saldoServicos)}</span></div>
                    <div class="progress-bar-fundo shadow-sm" style="height: 12px; margin-top: 2px;"><div class="progress-bar-preenchimento ${colorServ}" style="width: ${Math.min(pctServ, 100)}%;"></div></div>
                 </div>
              </div>`;
        }
        
        tb.innerHTML += `
        <tr>
           <td><strong class="text-primary fs-6">${c.numero}</strong><br>${tipoBadge}</td>
           <td><span class="fw-bold">${c.fornecedor}</span></td>
           <td><span class="badge bg-light text-dark border">${c.secretaria || 'GERAL'}</span></td>
           <td class="small text-muted text-nowrap">${c.data_inicio ? new Date(c.data_inicio).toLocaleDateString('pt-BR') : '-'} a<br>${c.data_fim ? new Date(c.data_fim).toLocaleDateString('pt-BR') : '-'}</td>
           <td colspan="3" class="align-middle p-2" style="min-width: 280px; vertical-align: top !important;">${HTMLSaldo}</td>
           <td class="adm-only text-nowrap text-end align-middle">
              <button class="btn btn-sm btn-info text-white me-1 fw-bold shadow-sm" onclick='window.abrirEncarteContrato("${c.id}")'><i class="fas fa-search-plus"></i></button>
              <button class="btn btn-sm btn-light text-primary border shadow-sm" onclick='window.editarContrato(${JSON.stringify(c)})'><i class="fas fa-edit"></i></button>
           </td>
        </tr>`;
    });
};

window.abrirEncarteContrato = function(idContrato) {
    let c = window.contratosList.find(x => x.id === idContrato);
    if(!c) return alert("Contrato não encontrado.");

    let totalContratado = 0; let totalGasto = 0; let detalhamentoHtml = '';

    if (c.categoria === 'Itens') {
        totalContratado = c.valor_total || 0; totalGasto = c.saldo_consumido_real || 0;
        if (c.itens_contrato && c.itens_contrato.length > 0) {
            detalhamentoHtml += `<div class="table-responsive"><table class="table table-sm table-bordered"><thead class="table-light"><tr><th>Item Licitado</th><th class="text-center">Qtd Licitada</th><th class="text-end">Vlr Unitário</th><th class="text-end">Total Previsto</th></tr></thead><tbody>`;
            c.itens_contrato.forEach(it => { detalhamentoHtml += `<tr><td>${it.descricao}</td><td class="text-center">${it.qtd_licitada}</td><td class="text-end">${window.formatarMoeda(it.valor_unitario)}</td><td class="text-end fw-bold">${window.formatarMoeda((it.qtd_licitada || 0) * (it.valor_unitario || 0))}</td></tr>`; });
            detalhamentoHtml += `</tbody></table></div>`;
        } else { detalhamentoHtml = '<p class="text-muted">Sem itens detalhados.</p>'; }
    } else {
        totalContratado = (c.valor_teto_pecas || 0) + (c.valor_teto_servicos || 0); totalGasto = (c.saldo_consumido_pecas || 0) + (c.saldo_consumido_servicos || 0);
        if (c.lotes_contrato && c.lotes_contrato.length > 0) {
            c.lotes_contrato.forEach(l => {
                let lTetoTotal = (l.teto_pecas || 0) + (l.teto_servicos || 0); let lGastoTotal = (l.consumido_pecas || 0) + (l.consumido_servicos || 0); let lSaldo = lTetoTotal - lGastoTotal;
                let pct = lTetoTotal > 0 ? (lGastoTotal / lTetoTotal) * 100 : 0; let colorClass = pct > 90 ? 'bg-danger' : (pct > 70 ? 'bg-warning text-dark' : 'bg-success');
                detalhamentoHtml += `<div class="border p-3 rounded mb-3 bg-white shadow-sm lote-item"><h6 class="fw-bold text-dark border-bottom pb-2">${l.descricao}</h6><div class="row small mb-2"><div class="col-4"><strong>Contratado:</strong> ${window.formatarMoeda(lTetoTotal)}</div><div class="col-4 text-danger"><strong>Gasto:</strong> ${window.formatarMoeda(lGastoTotal)}</div><div class="col-4 text-success"><strong>Saldo Restante:</strong> ${window.formatarMoeda(lSaldo)}</div></div><div class="progress-bar-fundo border"><div class="progress-bar-preenchimento ${colorClass}" style="width: ${Math.min(pct, 100)}%;">${pct.toFixed(1)}%</div></div></div>`;
            });
        } else { detalhamentoHtml = '<p class="text-muted">Sem lotes criados para este contrato.</p>'; }
    }

    let htmlCompleto = `
        <div class="text-center mb-4 encarte-header"><h3 class="fw-bold m-0 text-primary">ENCARTE DE EXECUÇÃO DE CONTRATO</h3><p class="text-muted m-0">Contrato: ${c.numero} | Fornecedor: ${c.fornecedor}</p></div>
        <div class="row mb-4 text-center">
            <div class="col-md-4 mb-2"><div class="card card-azul h-100 shadow border-0 py-2"><div class="card-body py-1"><h6 class="fw-bold opacity-75">Total Contratado</h6><h4 class="fw-bold m-0">${window.formatarMoeda(totalContratado)}</h4></div></div></div>
            <div class="col-md-4 mb-2"><div class="card card-laranja h-100 shadow border-0 py-2"><div class="card-body py-1"><h6 class="fw-bold opacity-75">Total Executado</h6><h4 class="fw-bold m-0">${window.formatarMoeda(totalGasto)}</h4></div></div></div>
            <div class="col-md-4 mb-2"><div class="card card-verde h-100 shadow border-0 py-2"><div class="card-body py-1"><h6 class="fw-bold opacity-75">Saldo Disponível</h6><h4 class="fw-bold m-0">${window.formatarMoeda(totalContratado - totalGasto)}</h4></div></div></div>
        </div>
        <h5 class="fw-bold mb-3 border-bottom pb-2">Detalhamento por Lotes/Categorias</h5>${detalhamentoHtml}`;

    document.getElementById('content-encarte-modal').innerHTML = htmlCompleto;
    new bootstrap.Modal(document.getElementById('modalEncarte')).show();
};

window.imprimirEncarteAtual = function() { window.imprimirDocumento(document.getElementById('content-encarte-modal').innerHTML, 'Encarte_Contrato'); };

window.popularSecretariasContrato = function() {
    let select = document.getElementById('c-secretaria');
    select.innerHTML = '<option value="GERAL / TODAS AS SECRETARIAS">GERAL / TODAS AS SECRETARIAS</option>';
    window.getSecretariasInteligentes().forEach(s => { select.innerHTML += `<option value="${s}">${s}</option>`; });
};

window.popularSelectCatalogoContrato = function() {
    let sel = document.getElementById('c-item-catalogo');
    sel.innerHTML = '<option value="">Selecione um item do Catálogo...</option><option value="NOVO" class="fw-bold text-primary">+++ NOVO ITEM (Digitar Manualmente) +++</option>';
    window.catalogoList.forEach(c => { sel.innerHTML += `<option value="${c.id}" data-desc="${c.descricao}" data-cat="${c.categoria}">[${c.categoria}] ${c.descricao} (Ref: ${window.formatarMoeda(c.valor_referencia)})</option>`; });
};

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
};

window.verificarNovoItemContrato = function() {
    let sel = document.getElementById('c-item-catalogo');
    let divNovo = document.getElementById('div-c-novo-item');
    if(sel && sel.value === 'NOVO') { divNovo.classList.remove('hidden'); } else { if(divNovo) divNovo.classList.add('hidden'); }
};

window.adicionarLoteContrato = function() {
    let desc = document.getElementById('c-lote-desc').value.toUpperCase().trim();
    if(!desc) return alert("Descreva a Categoria (ex: Médio Porte Gasolina).");

    let vlrPecas = parseFloat(document.getElementById('c-lote-pecas').value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    let vlrMo = parseFloat(document.getElementById('c-lote-mo').value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

    if(vlrPecas === 0 && vlrMo === 0) return alert("Defina pelo menos um valor para Peças ou Mão de Obra.");

    window.lotesContratoAtual.push({ descricao: desc, teto_pecas: vlrPecas, teto_servicos: vlrMo });
    document.getElementById('c-lote-desc').value = ''; document.getElementById('c-lote-pecas').value = ''; document.getElementById('c-lote-mo').value = '';
    window.renderLotesContrato();
};

window.removerLoteContrato = function(idx) { window.lotesContratoAtual.splice(idx, 1); window.renderLotesContrato(); };

window.renderLotesContrato = function() {
    let tb = document.querySelector('#table-contrato-lotes tbody');
    tb.innerHTML = ''; let sumPecas = 0, sumMo = 0;
    
    window.lotesContratoAtual.forEach((lote, idx) => {
        sumPecas += lote.teto_pecas; sumMo += lote.teto_servicos;
        tb.innerHTML += `<tr><td><strong>${lote.descricao}</strong></td><td class="text-end text-primary">${window.formatarMoeda(lote.teto_pecas)}</td><td class="text-end text-warning">${window.formatarMoeda(lote.teto_servicos)}</td><td class="text-end fw-bold">${window.formatarMoeda(lote.teto_pecas + lote.teto_servicos)}</td><td class="text-center"><button type="button" class="btn btn-sm btn-light text-danger py-0" onclick="window.removerLoteContrato(${idx})"><i class="fas fa-trash"></i></button></td></tr>`;
    });
    
    if(window.lotesContratoAtual.length === 0) tb.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma categoria adicionada. O contrato ficará zerado.</td></tr>';
    
    document.getElementById('c-tot-pecas').innerText = window.formatarMoeda(sumPecas);
    document.getElementById('c-tot-mo').innerText = window.formatarMoeda(sumMo);
    document.getElementById('c-tot-geral').innerText = window.formatarMoeda(sumPecas + sumMo);
};

window.adicionarItemContrato = function() {
    let sel = document.getElementById('c-item-catalogo');
    let isNovo = (sel.value === 'NOVO');
    if(!sel.value) return alert("Selecione um item do catálogo ou crie um novo.");
    
    let qtd = parseInt(document.getElementById('c-item-qtd').value) || 0;
    if(qtd <= 0) return alert("A quantidade licitada deve ser maior que zero.");
    
    let vlrUnit = parseFloat(document.getElementById('c-item-vlr').value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
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

        let jaExiste = window.itensContratoAtual.find(i => i.id_catalogo === sel.value);
        if(jaExiste) {
            jaExiste.qtd_licitada += qtd; jaExiste.valor_unitario = vlrUnit; 
            window.renderItensContrato(); return;
        }
    }
    
    window.itensContratoAtual.push({ id_catalogo: idParaAdicionar, descricao: descParaAdicionar, categoria: catParaAdicionar, qtd_licitada: qtd, valor_unitario: vlrUnit, qtd_consumida: 0 });
    
    document.getElementById('c-item-qtd').value = '1'; document.getElementById('c-item-vlr').value = ''; 
    if(document.getElementById('c-item-desc-novo')) document.getElementById('c-item-desc-novo').value = '';
    sel.value = ''; window.verificarNovoItemContrato(); window.renderItensContrato();
};

window.removerItemContrato = function(idx) { window.itensContratoAtual.splice(idx, 1); window.renderItensContrato(); };

window.renderItensContrato = function() {
    let tb = document.querySelector('#table-contrato-itens tbody');
    tb.innerHTML = ''; let somaTotal = 0;
    
    window.itensContratoAtual.forEach((it, idx) => {
        let vlrTotalItem = it.qtd_licitada * it.valor_unitario; somaTotal += vlrTotalItem;
        let indNovo = !it.id_catalogo ? ' <span class="badge bg-warning text-dark ml-1">Novo</span>' : '';
        tb.innerHTML += `<tr><td>${it.descricao}${indNovo}</td><td class="text-center">${it.qtd_licitada}</td><td class="text-end">${window.formatarMoeda(it.valor_unitario)}</td><td class="text-end fw-bold text-primary">${window.formatarMoeda(vlrTotalItem)}</td><td class="text-center"><button type="button" class="btn btn-sm btn-light text-danger py-0" onclick="window.removerItemContrato(${idx})"><i class="fas fa-trash"></i></button></td></tr>`;
    });
    
    if(window.itensContratoAtual.length === 0) tb.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum item adicionado à ata.</td></tr>';
    
    let elValor = document.getElementById('c-valor-total');
    elValor.value = somaTotal.toFixed(2).replace(".", "");
    window.aplicarMascaraMonetaria(elValor);
};

window.abrirModalContrato = function() { 
    document.getElementById('formContrato').reset(); 
    document.getElementById('c-id').value = ''; 
    window.itensContratoAtual = []; window.lotesContratoAtual = []; 
    window.popularSecretariasContrato(); window.popularSelectCatalogoContrato(); 
    window.verificarNovoItemContrato(); window.mudarTipoContrato(); 
    document.getElementById('btn-del-contrato').classList.add('hidden'); 
    new bootstrap.Modal(document.getElementById('modalContrato')).show(); 
};

window.editarContrato = function(c) { 
    document.getElementById('c-id').value = c.id; 
    document.getElementById('c-numero').value = c.numero; 
    document.getElementById('c-categoria').value = c.categoria || 'Global';
    document.getElementById('c-fornecedor').value = c.fornecedor; 
    document.getElementById('c-objeto').value = c.objeto || ''; 
    document.getElementById('c-ini').value = c.data_inicio || ''; 
    document.getElementById('c-fim').value = c.data_fim || ''; 
    
    window.popularSecretariasContrato();
    document.getElementById('c-secretaria').value = c.secretaria || 'GERAL / TODAS AS SECRETARIAS'; 
    window.popularSelectCatalogoContrato();
    
    window.itensContratoAtual = c.itens_contrato ? [...c.itens_contrato] : [];
    window.lotesContratoAtual = c.lotes_contrato ? [...c.lotes_contrato] : [];
    
    if((c.categoria === 'Global' || !c.categoria) && window.lotesContratoAtual.length === 0 && (c.valor_teto_pecas > 0 || c.valor_teto_servicos > 0)) {
        window.lotesContratoAtual.push({ descricao: "FROTA GERAL (MIGRADO)", teto_pecas: c.valor_teto_pecas || 0, teto_servicos: c.valor_teto_servicos || 0 });
    }

    window.verificarNovoItemContrato(); window.mudarTipoContrato(); 
    
    let elValorTot = document.getElementById('c-valor-total');
    elValorTot.value = (parseFloat(c.valor_total) || 0).toFixed(2).replace(".", "");
    window.aplicarMascaraMonetaria(elValorTot);
    
    document.getElementById('btn-del-contrato').classList.remove('hidden'); 
    new bootstrap.Modal(document.getElementById('modalContrato')).show(); 
};

window.salvarContrato = async function() { 
    const numero = document.getElementById('c-numero').value.trim(); 
    if(!numero) return alert("Informe o número do contrato."); 
    
    let cat = document.getElementById('c-categoria').value;
    if(cat === 'Itens' && window.itensContratoAtual.length === 0) return alert("Adicione pelo menos um item licitado à ata.");
    if(cat === 'Global' && window.lotesContratoAtual.length === 0) return alert("Adicione pelo menos uma categoria de frota (Lote) ao contrato.");

    document.getElementById('loading').classList.remove('hidden');

    let valTetoPecas = 0, valTetoServicos = 0, valTotalItens = 0;

    if(cat === 'Global') {
        window.lotesContratoAtual.forEach(lote => { valTetoPecas += lote.teto_pecas; valTetoServicos += lote.teto_servicos; });
    }

    if(cat === 'Itens') {
        for(let i = 0; i < window.itensContratoAtual.length; i++) {
            let it = window.itensContratoAtual[i];
            valTotalItens += (it.qtd_licitada * it.valor_unitario);
            if(!it.id_catalogo) {
                let novoIdCat = `ITEM-${Date.now()}-${Math.floor(Math.random()*1000)}`;
                await setDoc(doc(db, `${mod}_${window.tenant}_catalogo`, novoIdCat), { categoria: it.categoria || 'Peças', descricao: it.descricao, aplicacao_modelos: '', valor_referencia: it.valor_unitario, garantia_meses: 0, garantia_km: 0 });
                window.itensContratoAtual[i].id_catalogo = novoIdCat;
            }
        }
    }
    
    const dados = { 
        numero: numero, categoria: cat, fornecedor: document.getElementById('c-fornecedor').value, secretaria: document.getElementById('c-secretaria').value.toUpperCase(),
        objeto: document.getElementById('c-objeto').value, data_inicio: document.getElementById('c-ini').value, data_fim: document.getElementById('c-fim').value, 
        valor_total: cat === 'Itens' ? valTotalItens : (valTetoPecas + valTetoServicos), valor_teto_pecas: valTetoPecas, valor_teto_servicos: valTetoServicos,
        itens_contrato: cat === 'Itens' ? window.itensContratoAtual : null, lotes_contrato: cat === 'Global' ? window.lotesContratoAtual : null, ativo: true 
    }; 
    
    let id = document.getElementById('c-id').value || `CONT-${Date.now()}`; 
    await setDoc(doc(db, `${mod}_${window.tenant}_contratos`, id), dados, {merge: true}); 
    
    document.getElementById('loading').classList.add('hidden');
    bootstrap.Modal.getInstance(document.getElementById('modalContrato')).hide(); 
    alert("Contrato salvo com sucesso!"); 
    window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value); 
};

window.deletarContrato = async function() { 
    if(confirm("Tem certeza que deseja excluir este contrato?")) { 
        await deleteDoc(doc(db, `${mod}_${window.tenant}_contratos`, document.getElementById('c-id').value)); 
        bootstrap.Modal.getInstance(document.getElementById('modalContrato')).hide(); 
        window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value); 
    } 
};
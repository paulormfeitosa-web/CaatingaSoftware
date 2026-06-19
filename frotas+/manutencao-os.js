import { db } from './firebase-env.js';
import { doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const mod = "frota";

window.renderTabelaItensOS = function() {
    let tb = document.querySelector('#table-os-itens tbody');
    if(!tb) return;
    tb.innerHTML = '';
    let totalOS = 0;
    
    window.itensOSAtual.forEach((it, idx) => {
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
    
    if(window.itensOSAtual.length === 0) {
        tb.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Nenhum item adicionado ao orçamento ainda.</td></tr>';
    }
    
    let lblTotal = document.getElementById('lbl-os-total');
    if(lblTotal) lblTotal.innerText = window.formatarMoeda(totalOS);
};

window.removerItemOS = function(index) {
    window.itensOSAtual.splice(index, 1);
    window.renderTabelaItensOS();
};

window.abrirModalBuscaItem = function() {
    document.getElementById('m-item-desc').value = '';
    document.getElementById('m-item-qtd').value = '1';
    document.getElementById('m-item-valor').value = '';
    document.getElementById('m-item-desconto').value = '';
    document.getElementById('lbl-previa-item').innerText = 'R$ 0,00';
    
    window.atualizarListaCatalogoOS();
    new bootstrap.Modal(document.getElementById('modalBuscaItem')).show();
};

window.atualizarListaCatalogoOS = function() {
    let vSelect = document.getElementById('os-veiculo');
    let modVeiculo = '';
    if(vSelect && vSelect.selectedIndex > -1) {
        let optVeiculo = vSelect.options[vSelect.selectedIndex];
        if(optVeiculo.value) modVeiculo = (optVeiculo.getAttribute('data-modelo') || '').toUpperCase().trim();
    }
    
    let sel = document.getElementById('m-item-catalogo');
    sel.innerHTML = '<option value="">+++ NOVO ITEM (Digitar Manualmente) +++</option>';
    
    let idContratoSelecionado = document.getElementById('os-contrato').value;
    let contratoFiltrado = window.contratosList.find(c => c.id === idContratoSelecionado);
    let usarFiltro = document.getElementById('toggle-filtro-compativel')?.checked;

    const isCompativel = (catInfo) => {
        if(!usarFiltro) return true; 
        if(!catInfo.aplicacao_modelos || catInfo.aplicacao_modelos.trim() === '') return true; 
        if(!modVeiculo) return true; 
        let aplicacoes = catInfo.aplicacao_modelos.split(',').map(m => m.trim().toUpperCase());
        return aplicacoes.some(app => modVeiculo.includes(app) || app.includes(modVeiculo));
    };

    let htmlCompativel = ''; let htmlIncompativel = '';
    
    if(contratoFiltrado && contratoFiltrado.categoria === 'Itens' && contratoFiltrado.itens_contrato) {
        contratoFiltrado.itens_contrato.forEach(ic => {
            let infoCat = window.catalogoList.find(x => x.id === ic.id_catalogo);
            if(infoCat) {
               let optHTML = `<option value="${infoCat.id}" data-desc="${infoCat.descricao}" data-val="${ic.valor_unitario}" data-cat="${infoCat.categoria}">[${infoCat.categoria}] ${infoCat.descricao} (Max Licitado: ${window.formatarMoeda(ic.valor_unitario)})</option>`;
               if(isCompativel(infoCat)) htmlCompativel += optHTML; else htmlIncompativel += optHTML;
            }
        });
    } else {
        window.catalogoList.forEach(c => {
            let optHTML = `<option value="${c.id}" data-desc="${c.descricao}" data-val="${c.valor_referencia}" data-cat="${c.categoria}">[${c.categoria}] ${c.descricao} - Ref: ${window.formatarMoeda(c.valor_referencia)}</option>`;
            if(isCompativel(c)) htmlCompativel += optHTML; else htmlIncompativel += optHTML;
        });
    }

    if(htmlCompativel) sel.innerHTML += `<optgroup label="✅ Peças ${usarFiltro ? 'Compatíveis/Universais' : 'do Catálogo'}">${htmlCompativel}</optgroup>`;
    if(htmlIncompativel) sel.innerHTML += `<optgroup label="⚠️ Outros Modelos / Não compatíveis">${htmlIncompativel}</optgroup>`;
};

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
};

window.calcularPreviaItem = function() {
    let qtd = parseInt(document.getElementById('m-item-qtd').value) || 1;
    let valStr = document.getElementById('m-item-valor').value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    let vlrUnit = parseFloat(valStr) || 0;
    let descPct = parseFloat(document.getElementById('m-item-desconto').value) || 0;
    
    if(descPct < 0) descPct = 0; if(descPct > 100) descPct = 100;

    let vlrBruto = qtd * vlrUnit;
    let vlrDesconto = vlrBruto * (descPct / 100);
    let vlrFinal = vlrBruto - vlrDesconto;

    document.getElementById('lbl-previa-item').innerText = window.formatarMoeda(vlrFinal);
};

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
        let cTarget = window.contratosList.find(c => c.id === idContratoSelecionado);
        if(cTarget && cTarget.categoria === 'Itens') {
            if(!idCat) return alert("Atenção! Este contrato exige que o item seja selecionado no CATÁLOGO DO CONTRATO.");
            
            let licitado = cTarget.itens_contrato.find(i => i.id_catalogo === idCat);
            if(licitado && vlrUnit > licitado.valor_unitario) {
                if(!confirm(`⚠️ AVISO DE PREÇO: O valor inserido (${window.formatarMoeda(vlrUnit)}) ultrapassa o valor licitado na Ata (${window.formatarMoeda(licitado.valor_unitario)}).\n\nDeseja forçar a inclusão?`)) {
                    return;
                }
            }
        }
    }
    
    let vlrBruto = qtd * vlrUnit; let vlrDesconto = vlrBruto * (descPct / 100); let vlrFinalLiquido = vlrBruto - vlrDesconto;
    
    let vSelect = document.getElementById('os-veiculo'); let modVeiculo = '';
    if(vSelect && vSelect.selectedIndex > -1) {
        let optVeiculo = vSelect.options[vSelect.selectedIndex];
        if(optVeiculo.value) modVeiculo = (optVeiculo.getAttribute('data-modelo') || '').toUpperCase().trim();
    }
    
    if(idCat) {
        let itemCatInfo = window.catalogoList.find(c => c.id === idCat);
        if(itemCatInfo) {
            let aplicacoesStr = itemCatInfo.aplicacao_modelos || '';
            let aplicacoes = aplicacoesStr.split(',').map(m => m.trim().toUpperCase()).filter(m => m !== '');
            let isUniversal = aplicacoes.length === 0;
            let isCompativel = isUniversal || (modVeiculo && aplicacoes.some(app => modVeiculo.includes(app) || app.includes(modVeiculo)));

            if(!isCompativel && modVeiculo) {
                if(confirm(`A peça/serviço "${itemCatInfo.descricao}" não está atualmente associada ao modelo "${modVeiculo}".\n\nDeseja vincular este modelo à peça?`)) {
                    aplicacoes.push(modVeiculo); let novaAplicacao = aplicacoes.join(', ');
                    setDoc(doc(db, `${mod}_${window.tenant}_catalogo`, idCat), { aplicacao_modelos: novaAplicacao }, {merge: true}).catch(e => console.error(e));
                }
            }

            if(itemCatInfo.garantia_meses > 0 && vSelect.value) {
                let idAtual = document.getElementById('os-id').value;
                let osAnteriores = window.ordensGlobal.filter(o => o.placa === vSelect.value && o.idOS !== idAtual);
                let ultimaData = null;
                
                for(let o of osAnteriores) {
                    if(o.itens) {
                       let achou = o.itens.find(i => i.id_catalogo === idCat);
                       if(achou && (!ultimaData || new Date(o.data_registro) > new Date(ultimaData))) ultimaData = o.data_registro;
                    }
                }
                
                if(ultimaData) {
                    let diffMeses = (new Date() - new Date(ultimaData)) / (1000 * 60 * 60 * 24 * 30);
                    if(diffMeses < itemCatInfo.garantia_meses) {
                        if(!confirm(`⚠️ ALERTA DE GARANTIA!\nEste item foi trocado há ${diffMeses.toFixed(1)} meses.\nA garantia cadastrada é de ${itemCatInfo.garantia_meses} meses.\n\nDeseja adicionar mesmo assim?`)) {
                            return;
                        }
                    }
                }
            }
        }
    }
    
    window.itensOSAtual.push({ id_catalogo: idCat || null, categoria: categoria, descricao: desc, qtd: qtd, valor_unit: vlrUnit, desconto_pct: descPct, valor_total: vlrFinalLiquido });
    
    window.renderTabelaItensOS();
    bootstrap.Modal.getInstance(document.getElementById('modalBuscaItem')).hide();
};

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
};

window.selecionarTodasOS = function(chk) {
    document.querySelectorAll('.chk-os-item').forEach(el => el.checked = chk.checked);
};

window.atualizarLotesOS = function() {
    const idContrato = document.getElementById('os-contrato').value;
    const selectLote = document.getElementById('os-contrato-lote');
    const divLote = document.getElementById('div-os-lote');
    
    selectLote.innerHTML = '<option value="">Selecione o Lote / Categoria...</option>';
    divLote.classList.add('hidden');
    
    if(idContrato) {
        let c = window.contratosList.find(x => x.id === idContrato);
        if(c && c.categoria === 'Global' && c.lotes_contrato) {
            c.lotes_contrato.forEach(l => {
                let saldoPecas = (l.teto_pecas || 0) - (l.consumido_pecas || 0);
                let saldoServicos = (l.teto_servicos || 0) - (l.consumido_servicos || 0);
                selectLote.innerHTML += `<option value="${l.descricao}">${l.descricao} (Saldo Pç: ${window.formatarMoeda(saldoPecas)} | MO: ${window.formatarMoeda(saldoServicos)})</option>`;
            });
            divLote.classList.remove('hidden');
        }
    }
};

window.abrirModalOS = function() {
    document.getElementById('formOS').reset(); 
    document.getElementById('os-id').value = ''; 
    document.getElementById('os-data').valueAsDate = new Date();
    
    document.getElementById('toggle-os-nf').checked = false; window.toggleModoNF();
    document.getElementById('os-nf-num').value = ''; document.getElementById('os-nf-valor').value = ''; document.getElementById('os-nf-tipo').value = 'Serviço';
    document.getElementById('os-contrato-lote').innerHTML = ''; document.getElementById('div-os-lote').classList.add('hidden');

    window.itensOSAtual = []; window.renderTabelaItensOS();

    const select = document.getElementById('os-veiculo'); 
    select.innerHTML = '<option value="">Selecione o Veículo...</option>';
    
    window.veiculosList.forEach(v => {
        if(v.status_operacional !== 'Inservível') {
            let indicativo = v.status_operacional === 'Em Oficina' ? ' (⚠️ EM OFICINA)' : '';
            let modeloReal = v.modelo || v.veiculo || 'N/A';
            let secReal = v.secretaria || v.sec || '';
            let kmReal = parseInt(v.km_atual) || parseInt(v.odometro) || parseInt(v.horimetro) || 0;
            
            select.innerHTML += `<option value="${v.placa}" data-modelo="${modeloReal}" data-sec="${secReal}" data-dest="${v.destinacao || ''}" data-km="${kmReal}">${v.placa} - ${modeloReal}${indicativo}</option>`;
        }
    });
    
    window.filtrarContratosPorSec();

    const p = String(window.USUARIO?.nivel_acesso || '').toUpperCase();
    if(!p.includes('ADM') && !p.includes('MASTER') && p !== 'GESTOR') { 
        document.getElementById('os-status').value = "Pendente"; 
        document.getElementById('os-status').parentElement.classList.add('hidden'); 
    } else { 
        document.getElementById('os-status').parentElement.classList.remove('hidden'); 
    }

    new bootstrap.Modal(document.getElementById('modalOS')).show();
};

window.filtrarContratosPorSec = function() {
    const vSelect = document.getElementById('os-veiculo');
    const opt = vSelect.options[vSelect.selectedIndex];
    const kmVeic = opt ? opt.getAttribute('data-km') : '';
    
    if(kmVeic) document.getElementById('os-km').value = kmVeic; else document.getElementById('os-km').value = '';
    
    const selectCont = document.getElementById('os-contrato'); 
    selectCont.innerHTML = '<option value="">Avulso / Despesa Direta (Sem Contrato)</option>';
    
    window.contratosList.forEach(c => {
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
};

window.salvarOS = async function() {
    const vSelect = document.getElementById('os-veiculo'); 
    if(!vSelect.value) return alert("Selecione um veículo."); 
    
    let valorFinalOS = 0; const isNF = document.getElementById('toggle-os-nf').checked;

    if(isNF) {
        let numNF = document.getElementById('os-nf-num').value.trim();
        let vlrStr = document.getElementById('os-nf-valor').value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
        let valorNF = parseFloat(vlrStr) || 0;
        let tipoNF = document.getElementById('os-nf-tipo').value;
        
        if(!numNF || valorNF <= 0) return alert("Para lançamento rápido, informe o Número da NF e o Valor Total da Nota.");
        
        window.itensOSAtual = [{
            id_catalogo: null, categoria: tipoNF, descricao: `LANÇAMENTO RETROATIVO - REF. NF Nº ${numNF}`,
            qtd: 1, valor_unit: valorNF, desconto_pct: 0, valor_total: valorNF
        }];
        valorFinalOS = valorNF;
    } else {
        if(window.itensOSAtual.length === 0) return alert("A Ordem de Serviço precisa ter pelo menos um item adicionado.");
        for(let i = 0; i < window.itensOSAtual.length; i++) { valorFinalOS += window.itensOSAtual[i].valor_total; }
    }

    let idContratoSelecionado = document.getElementById('os-contrato').value;
    let nomeLote = document.getElementById('os-contrato-lote').value;

    if(idContratoSelecionado) {
        let cTarget = window.contratosList.find(c => c.id === idContratoSelecionado);
        if(cTarget) {
            let totalOS_Pecas = 0; let totalOS_Servicos = 0;
            window.itensOSAtual.forEach(it => {
               if(it.categoria === 'Peças' || it.categoria === 'Pneus' || it.categoria === 'Bateria') totalOS_Pecas += it.valor_total;
               else totalOS_Servicos += it.valor_total;
            });
            
            let vaiEstourar = false; let msgAviso = ""; 

            if(cTarget.categoria === 'Itens') {
                let saldoTotal = (cTarget.valor_total || 0) - (cTarget.saldo_consumido_real || 0);
                if(valorFinalOS > saldoTotal) { vaiEstourar = true; msgAviso = `O valor da OS (${window.formatarMoeda(valorFinalOS)}) ultrapassa o saldo do contrato (${window.formatarMoeda(saldoTotal)}).`; }
            } else {
                if(nomeLote && cTarget.lotes_contrato) {
                    let lTarget = cTarget.lotes_contrato.find(l => l.descricao === nomeLote);
                    if(lTarget) {
                        let saldoRestantePecas = (lTarget.teto_pecas || 0) - (lTarget.consumido_pecas || 0);
                        let saldoRestanteServicos = (lTarget.teto_servicos || 0) - (lTarget.consumido_servicos || 0);
                        if(totalOS_Pecas > saldoRestantePecas) { vaiEstourar = true; msgAviso += `\n- Gasto com Peças excede o saldo do lote (${window.formatarMoeda(saldoRestantePecas)}).`; }
                        if(totalOS_Servicos > saldoRestanteServicos) { vaiEstourar = true; msgAviso += `\n- Gasto com Serviços excede o saldo do lote (${window.formatarMoeda(saldoRestanteServicos)}).`; }
                    }
                } else {
                    let saldoRestantePecas = (cTarget.valor_teto_pecas || 0) - (cTarget.saldo_consumido_pecas || 0);
                    let saldoRestanteServicos = (cTarget.valor_teto_servicos || 0) - (cTarget.saldo_consumido_servicos || 0);
                    if(totalOS_Pecas > saldoRestantePecas) { vaiEstourar = true; msgAviso += `\n- Gasto com Peças excede o saldo global (${window.formatarMoeda(saldoRestantePecas)}).`; }
                    if(totalOS_Servicos > saldoRestanteServicos) { vaiEstourar = true; msgAviso += `\n- Gasto com Serviços excede o saldo global (${window.formatarMoeda(saldoRestanteServicos)}).`; }
                }
            }
            if (vaiEstourar && !confirm(`⚠️ AVISO DE SALDO EXCEDIDO!\n${msgAviso}\n\nDeseja lançar e salvar esta OS mesmo assim?`)) return; 
        }
    }

    const opt = vSelect.options[vSelect.selectedIndex];
    document.getElementById('loading').classList.remove('hidden');
    let tipoOS = document.getElementById('os-tipo').value;

    if(!isNF) {
        for(let i = 0; i < window.itensOSAtual.length; i++) {
            let it = window.itensOSAtual[i];
            if(it.id_catalogo) {
                let catExistente = window.catalogoList.find(c => c.id === it.id_catalogo);
                if(catExistente && (catExistente.descricao !== it.descricao || catExistente.valor_referencia !== it.valor_unit || catExistente.categoria !== it.categoria)) {
                    await setDoc(doc(db, `${mod}_${window.tenant}_catalogo`, it.id_catalogo), { categoria: it.categoria, descricao: it.descricao, valor_referencia: it.valor_unit }, {merge: true});
                }
            } else {
                let novoIdCat = `ITEM-${Date.now()}-${Math.floor(Math.random()*1000)}`;
                await setDoc(doc(db, `${mod}_${window.tenant}_catalogo`, novoIdCat), { categoria: it.categoria, descricao: it.descricao, aplicacao_modelos: opt.getAttribute('data-modelo') ? opt.getAttribute('data-modelo').toUpperCase() : '', valor_referencia: it.valor_unit, garantia_meses: 0, garantia_km: 0 });
                window.itensOSAtual[i].id_catalogo = novoIdCat; 
            }
        }
    }

    const dataISO = document.getElementById('os-data').value ? new Date(document.getElementById('os-data').value + "T12:00:00").toISOString() : new Date().toISOString();
    let statusFinal = document.getElementById('os-status').value;
    const p = String(window.USUARIO?.nivel_acesso || '').toUpperCase();
    if(!p.includes('ADM') && !p.includes('MASTER') && p !== 'GESTOR') { statusFinal = "Pendente"; }

    let kmDeclarado = parseInt(document.getElementById('os-km').value) || 0;

    const dados = { 
        data_registro: dataISO, placa: vSelect.value, modelo_veiculo: opt.getAttribute('data-modelo'), secretaria_veiculo: opt.getAttribute('data-sec'), destinacao_veiculo: opt.getAttribute('data-dest'),
        tipoServico: tipoOS, status: statusFinal, fornecedor: document.getElementById('os-fornecedor').value, responsavel: document.getElementById('os-responsavel').value, 
        id_contrato: document.getElementById('os-contrato').value, lote_contrato: nomeLote || null, congelado: false, itens: window.itensOSAtual, valor: valorFinalOS, km_registro: kmDeclarado
    };
    
    let idParaSalvar = document.getElementById('os-id').value || 'OS-' + Date.now();
    await setDoc(doc(db, `${mod}_${window.tenant}_ordens_servico`, idParaSalvar), dados, {merge: true});
    
    if (kmDeclarado > 0) {
       let veicAtual = window.veiculosList.find(v => v.placa === vSelect.value);
       let kmLidoBanco = veicAtual ? (parseInt(veicAtual.km_atual) || parseInt(veicAtual.odometro) || parseInt(veicAtual.horimetro) || 0) : 0;
       if(veicAtual && kmLidoBanco < kmDeclarado) {
           await setDoc(doc(db, `${window.tenant}_veiculos`, vSelect.value), { km_atual: kmDeclarado, odometro: kmDeclarado, horimetro: kmDeclarado }, {merge: true});
       }
    }

    if(statusFinal === 'Pendente' || statusFinal === 'Aprovada') { 
        await setDoc(doc(db, `${window.tenant}_veiculos`, vSelect.value), {status_operacional: 'Em Oficina'}, {merge: true}); 
    } else if (statusFinal === 'Paga') { 
        await setDoc(doc(db, `${window.tenant}_veiculos`, vSelect.value), {status_operacional: 'Disponível'}, {merge: true}); 
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
};

window.editarOS = function(os) {
    if(os.congelado) return alert("Registro bloqueado por fechamento de período.");
    
    window.abrirModalOS(); 
    document.getElementById('os-id').value = os.idOS; 
    document.getElementById('os-veiculo').value = os.placa; 
    window.filtrarContratosPorSec();
    
    if(os.data_registro) document.getElementById('os-data').value = os.data_registro.split('T')[0]; 
    
    document.getElementById('os-tipo').value = os.tipoServico || 'Manutenção Geral'; 
    document.getElementById('os-status').value = os.status || 'Pendente'; 
    document.getElementById('os-fornecedor').value = os.fornecedor || ''; 
    document.getElementById('os-responsavel').value = os.responsavel || '';
    document.getElementById('os-km').value = os.km_registro || '';
    
    if(os.id_contrato) {
        document.getElementById('os-contrato').value = os.id_contrato;
        window.atualizarLotesOS();
        if(os.lote_contrato) document.getElementById('os-contrato-lote').value = os.lote_contrato; 
    }
    
    window.itensOSAtual = []; let isNFMode = false;

    if (os.itens && os.itens.length === 1 && os.itens[0].descricao && os.itens[0].descricao.includes("REF. NF Nº")) {
        isNFMode = true; document.getElementById('toggle-os-nf').checked = true; window.toggleModoNF();

        let nfStr = os.itens[0].descricao.split("Nº ");
        document.getElementById('os-nf-num').value = nfStr.length > 1 ? nfStr[1] : '';
        document.getElementById('os-nf-tipo').value = os.itens[0].categoria || 'Serviço';

        let elValor = document.getElementById('os-nf-valor');
        elValor.value = (os.itens[0].valor_total || 0).toFixed(2).replace(".", "");
        window.aplicarMascaraMonetaria(elValor);
    } else {
        document.getElementById('toggle-os-nf').checked = false; window.toggleModoNF();
    }

    if(os.itens && os.itens.length > 0) {
        window.itensOSAtual = [...os.itens];
    } else if (!isNFMode) {
        window.itensOSAtual.push({
            id_catalogo: os.id_catalogo || null, categoria: 'Serviço', descricao: os.descricao || 'Item Antigo Migrado',
            qtd: 1, valor_unit: parseFloat(os.valor) || 0, desconto_pct: 0, valor_total: parseFloat(os.valor) || 0
        });
    }
    window.renderTabelaItensOS();
};

window.deletarOS = async function(id) { 
    if(confirm("Deseja realmente excluir esta Ordem de Serviço?")) { 
        await deleteDoc(doc(db, `${mod}_${window.tenant}_ordens_servico`, id)); 
        window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value); 
    } 
};

window.aplicarStatusLote = async function() {
    const novoStatus = document.getElementById('lote-status').value; 
    if(!novoStatus) return alert("Selecione o status.");
    
    const selecionados = Array.from(document.querySelectorAll('.chk-os-item:checked')).map(cb => cb.value); 
    if(selecionados.length === 0) return alert("Marque pelo menos uma OS.");
    
    if(confirm(`Mudar o status de ${selecionados.length} ordens para '${novoStatus}'?`)) {
        document.getElementById('loading').classList.remove('hidden');
        for(let id of selecionados) { 
            await setDoc(doc(db, `${mod}_${window.tenant}_ordens_servico`, id), {status: novoStatus}, {merge: true}); 
        }
        alert("Operação concluída!"); 
        window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value);
    }
};

window.imprimirOS = function(idOS) {
    const os = window.ordensGlobal.find(o => o.idOS === idOS);
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

    let veic = window.veiculosList.find(v => v.placa === os.placa) || {};
    let secReal = os.secretaria_veiculo || veic.secretaria || veic.sec || '';
    let modeloReal = os.modelo_veiculo || veic.modelo || veic.veiculo || '';
    let kmReal = os.km_registro || veic.km_atual || veic.odometro || veic.horimetro || 'Não inf.';

    let html = `
    <div class="text-center mb-4">
      <h3 class="fw-bold m-0">TICKET DE ORDEM DE SERVIÇO</h3>
      <p class="text-muted m-0">${window.tenant.toUpperCase()} - MÓDULO FROTAS E OFICINA</p>
    </div>
    <div class="row mb-4 border p-3 rounded bg-light">
       <div class="col-6"><strong>Ordem ID:</strong> ${os.idOS}<br><strong>Data:</strong> ${os.data_registro ? new Date(os.data_registro).toLocaleDateString('pt-BR') : '-'}<br><strong>Status Sistema:</strong> ${os.status}</div>
       <div class="col-6"><strong>Placa:</strong> ${os.placa}<br><strong>Modelo/Secretaria:</strong> ${modeloReal} - ${secReal}<br><strong>KM Atual:</strong> ${kmReal}</div>
    </div>
    <div class="mb-4"><strong>Fornecedor/Oficina:</strong> ${os.fornecedor || 'Despesa Direta'}<br><strong>Classificação:</strong> ${os.tipoServico}<br><strong>Autorizado por:</strong> ${os.responsavel || '-'}</div>
    <table class="table table-sm"><thead class="table-dark"><tr><th>Qtd</th><th>Descrição do Serviço / Peça</th><th class="text-end">Vlr. Unit</th><th class="text-end">Vlr. Total</th></tr></thead><tbody>${itensHtml}</tbody></table>
    <div class="text-end mt-3 mb-5"><h4 class="fw-bold">TOTAL: ${window.formatarMoeda(os.valor)}</h4></div>
    <div class="row mt-5 pt-5 text-center" style="page-break-inside: avoid;">
       <div class="col-4"><div class="border-top border-dark mx-3 pt-2"><strong>Oficina / Fornecedor</strong><br><small>Assinatura</small></div></div>
       <div class="col-4"><div class="border-top border-dark mx-3 pt-2"><strong>Motorista</strong><br><small>Assinatura</small></div></div>
       <div class="col-4"><div class="border-top border-dark mx-3 pt-2"><strong>Gestor da Frota</strong><br><small>Visto e Aprovação</small></div></div>
    </div>
    <div class="text-center mt-5 text-muted small">Gerado por: Feitosa Softwares</div>`;

    window.imprimirDocumento(html, 'OS_' + os.idOS);
};
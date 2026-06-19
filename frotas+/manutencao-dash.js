import { db } from './firebase-env.js';
import { collection, doc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const mod = "frota";

// Inicialização segura das variáveis globais
window.chartSec = null; 
window.chartTipo = null; 
window.chartVeic = null;
window.veiculosList = window.veiculosList || []; 
window.ordensGlobal = window.ordensGlobal || []; 
window.contratosList = window.contratosList || []; 
window.catalogoList = window.catalogoList || [];  
window.itensOSAtual = window.itensOSAtual || [];
window.itensContratoAtual = window.itensContratoAtual || [];
window.lotesContratoAtual = window.lotesContratoAtual || [];

window.getSecretariasInteligentes = function() {
    let secSet = new Set(['SAÚDE', 'EDUCAÇÃO', 'OBRAS', 'AGRICULTURA', 'ASSISTÊNCIA SOCIAL', 'ADMINISTRAÇÃO', 'FINANÇAS', 'MEIO AMBIENTE', 'ESPORTES', 'CULTURA', 'TURISMO', 'SEGURANÇA', 'TRANSPORTE', 'GABINETE', 'EMPREENDEDORISMO']);
    window.veiculosList.forEach(v => {
        if(v.secretaria) secSet.add(v.secretaria.toUpperCase().trim());
        if(v.sec) secSet.add(v.sec.toUpperCase().trim());
    });
    window.contratosList.forEach(c => {
        if(c.secretaria && !c.secretaria.includes('GERAL')) secSet.add(c.secretaria.toUpperCase().trim());
    });
    window.ordensGlobal.forEach(os => {
        if(os.secretaria_veiculo) secSet.add(os.secretaria_veiculo.toUpperCase().trim());
    });
    return [...secSet].filter(s => s !== '').sort();
};

window.pesquisarAbaOS = function() {
    let dIni = document.getElementById('f-os-ini').value;
    let dFim = document.getElementById('f-os-fim').value;
    
    document.getElementById('r-data-ini').value = dIni;
    document.getElementById('r-data-fim').value = dFim;
    
    window.carregarDadosGerais(dIni, dFim);
};

window.limparBancoFrotas = async function() {
    if (window.USUARIO?.cpf !== "01305663306") return alert("Ação restrita ao Administrador Master.");
    
    let confirmacao = prompt(`ATENÇÃO! Esta ação apagará permanentemente TODAS as Ordens de Serviço, Contratos e Itens de Catálogo do tenant atual (${window.tenant.toUpperCase()}).\nPara continuar, digite APAGAR TUDO:`);
    
    if (confirmacao !== "APAGAR TUDO") return alert("Operação cancelada.");
    
    document.getElementById('loading').classList.remove('hidden');
    try {
        const colecoesParaLimpar = [
            `${mod}_${window.tenant}_ordens_servico`,
            `${mod}_${window.tenant}_contratos`,
            `${mod}_${window.tenant}_catalogo`
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
};

async function puxarVeiculosDoFirebase() { 
    const snap = await getDocs(collection(db, `${window.tenant}_veiculos`)); 
    let v = []; snap.forEach(d => { let x = d.data(); x.id = d.id; x.placa = d.id; v.push(x); }); return v; 
}

async function puxarContratosDoFirebase() { 
    const snap = await getDocs(collection(db, `${mod}_${window.tenant}_contratos`)); 
    let c = []; snap.forEach(d => { let x = d.data(); x.id = d.id; c.push(x); }); return c; 
}

async function puxarCatalogoDoFirebase() { 
    const snap = await getDocs(collection(db, `${mod}_${window.tenant}_catalogo`)); 
    let c = []; snap.forEach(d => { let x = d.data(); x.id = d.id; c.push(x); }); return c; 
}

async function puxarTodasOSDoFirebase() {
    const snap = await getDocs(collection(db, `${mod}_${window.tenant}_ordens_servico`));
    let o = []; snap.forEach(d => { let x = d.data(); x.idOS = d.id; o.push(x); }); return o;
}

// O CORAÇÃO DO SISTEMA DE DADOS
window.carregarDadosGerais = async function(buscarDataIni = null, buscarDataFim = null) {
    let loadingEl = document.getElementById('loading');
    if(loadingEl) loadingEl.classList.remove('hidden');
    
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
        
        let elIni = document.getElementById('r-data-ini'); if(elIni) elIni.value = dataIni;
        let elFim = document.getElementById('r-data-fim'); if(elFim) elFim.value = dataFim;
        let elOsIni = document.getElementById('f-os-ini'); if(elOsIni) elOsIni.value = dataIni;
        let elOsFim = document.getElementById('f-os-fim'); if(elOsFim) elOsFim.value = dataFim;

        window.veiculosList = await puxarVeiculosDoFirebase(); 
        window.contratosList = await puxarContratosDoFirebase(); 
        window.catalogoList = await puxarCatalogoDoFirebase();
        window.ordensGlobal = await puxarTodasOSDoFirebase(); 

        window.contratosList.forEach(c => {
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
        
        window.ordensGlobal.forEach(os => {
            if(os.id_contrato && os.status === 'Paga') {
                let cTarget = window.contratosList.find(c => c.id === os.id_contrato); 
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
        
        // Chamadas dinâmicas para outras telas caso existam
        if(typeof window.renderizarTabelaVeiculos === 'function') window.renderizarTabelaVeiculos(window.veiculosList); 
        if(typeof window.renderizarTabelaContratos === 'function') window.renderizarTabelaContratos(window.contratosList); 
        if(typeof window.renderizarTabelaCatalogo === 'function') window.renderizarTabelaCatalogo(window.catalogoList);
        
        if(document.getElementById('dash-total-destaque')) await window.carregarDashFiltro(true); 
        if(document.querySelector('#table-os')) await window.carregarTabelaOSComFiltro(true); 
        
    } catch(e) { 
        console.error("Erro ao carregar dados gerais:", e); 
    }
    
    if(loadingEl) loadingEl.classList.add('hidden');
};

window.gerarAuditoriaConsumo = function(ordensConsideradas) {
    const hoje = new Date(); 
    const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate(); 
    const diasCorridos = hoje.getDate() || 1; 
    
    let agrupamento = {};
    ordensConsideradas.forEach(os => {
        let veic = window.veiculosList.find(v => v.placa === os.placa); 
        let sec = os.secretaria_veiculo || 'Indefinida'; 
        let dotacao = veic && veic.dotacao ? veic.dotacao : 'Não Informada';
        let chave = sec + "|" + dotacao;
        
        if(!agrupamento[chave]) agrupamento[chave] = { sec: sec, dotacao: dotacao, gasto: 0 };
        agrupamento[chave].gasto += (parseFloat(os.valor_filtrado) || 0);
    });
    
    const tb = document.querySelector('#table-auditoria tbody'); 
    if(!tb) return;
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
};

window.carregarDashFiltro = async function(aplicarFiltrosFront = true) {
    let dtIni = document.getElementById('r-data-ini').value;
    let dtFim = document.getElementById('r-data-fim').value;

    let ordens = window.ordensGlobal.filter(os => {
        if(!os.data_registro) return true;
        let d = os.data_registro.split('T')[0];
        return d >= dtIni && d <= dtFim;
    });
    
    if(aplicarFiltrosFront) {
        const fPlaca = document.getElementById('r-placa')?.value; 
        const fForn = document.getElementById('r-forn')?.value; 
        const fStatus = document.getElementById('r-status')?.value;
        const fSec = document.getElementById('r-sec')?.value;
        const fDest = document.getElementById('r-dest')?.value;
        const fClassOS = document.getElementById('r-class-os')?.value;
        const fCatItem = document.getElementById('r-cat-item')?.value;
        
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
            let lblTotal = document.getElementById('lbl-dash-total');
            if(lblTotal) lblTotal.innerText = `Gasto Apenas com: ${fCatItem}`;
        } else {
            let lblTotal = document.getElementById('lbl-dash-total');
            if(lblTotal) lblTotal.innerText = `Gasto Total Consolidado (Período)`;
        }
    }
    
    let totSec = {}, totTipo = {}, totVeic = {}, valorTotalGeral = 0;
    let fornecedoresUnicos = new Set(), responsaveisUnicos = new Set(), destinacoesUnicas = new Set();
    
    window.veiculosList.forEach(v => { 
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
        
        let vTarget = window.veiculosList.find(v => v.id === os.placa); 
        if(vTarget) vTarget.gasto_total += valor;
    });
    
    let destq = document.getElementById('dash-total-destaque');
    if(destq) destq.innerText = window.formatarMoeda(valorTotalGeral);
    
    const preencherDataList = (id, set) => {
        let dl = document.getElementById(id);
        if(dl) {
            dl.innerHTML = '';
            [...set].sort().forEach(item => dl.innerHTML += `<option value="${item}">`);
        }
    };
    
    preencherDataList('lista-fornecedores', fornecedoresUnicos);
    preencherDataList('lista-responsaveis', responsaveisUnicos);
    preencherDataList('lista-destinacoes', destinacoesUnicas);
    preencherDataList('lista-secretarias', window.getSecretariasInteligentes());
    
    if(document.getElementById('chartSecretaria')) {
        if(window.chartSec) window.chartSec.destroy(); 
        window.chartSec = new Chart(document.getElementById('chartSecretaria'), { type: 'pie', data: { labels: Object.keys(totSec), datasets: [{ data: Object.values(totSec), backgroundColor: ['#0d6efd','#198754','#dc3545','#ffc107','#0dcaf0','#6610f2'] }] } });
    }
    
    if(document.getElementById('chartTipo')) {
        if(window.chartTipo) window.chartTipo.destroy(); 
        window.chartTipo = new Chart(document.getElementById('chartTipo'), { type: 'doughnut', data: { labels: Object.keys(totTipo), datasets: [{ data: Object.values(totTipo), backgroundColor: ['#fd7e14','#20c997','#e83e8c','#6f42c1','#343a40'] }] } });
    }
    
    if(document.getElementById('chartVeiculo')) {
        const topVeiculos = Object.entries(totVeic).sort((a,b) => b[1] - a[1]).slice(0,5);
        if(window.chartVeic) window.chartVeic.destroy(); 
        window.chartVeic = new Chart(document.getElementById('chartVeiculo'), { type: 'bar', data: { labels: topVeiculos.map(x=>x[0]), datasets: [{ label: 'R$ Gasto', data: topVeiculos.map(x=>x[1]), backgroundColor: '#0d6efd' }] } });
    }
    
    const tbody = document.querySelector('#table-resumo-veiculos tbody'); 
    if(tbody) {
        tbody.innerHTML = '';
        let veiculosOrdenados = [...window.veiculosList].sort((a,b) => (b.gasto_total||0) - (a.gasto_total||0));
        veiculosOrdenados.forEach(v => { 
            if(v.gasto_total > 0) {
                let modeloReal = v.modelo || v.veiculo || '';
                let secReal = v.secretaria || v.sec || '';
                tbody.innerHTML += `<tr><td><strong>${v.placa}</strong></td><td>${modeloReal}</td><td>${secReal}<br><small class="text-info">${v.destinacao || ''}</small></td><td>${v.dotacao || '-'}</td><td>${v.vinculo || '-'}</td><td class="text-danger fw-bold text-end pe-4">${window.formatarMoeda(v.gasto_total)}</td></tr>`; 
            }
        });
    }
    
    window.gerarAuditoriaConsumo(ordensParaGraficos);
};

window.carregarTabelaOSComFiltro = async function(temFiltro = true) {
    let dtIni = document.getElementById('r-data-ini').value;
    let dtFim = document.getElementById('r-data-fim').value;

    let ordens = window.ordensGlobal.filter(os => {
        if(!os.data_registro) return true;
        let d = os.data_registro.split('T')[0];
        return d >= dtIni && d <= dtFim;
    });
    
    if(temFiltro) {
        const fPlaca = document.getElementById('f-os-placa')?.value; 
        const fForn = document.getElementById('f-os-forn')?.value; 
        const fStatus = document.getElementById('f-os-status')?.value;
        
        if (fPlaca) ordens = ordens.filter(os => os.placa && os.placa.toUpperCase().includes(fPlaca.toUpperCase()));
        if (fForn) ordens = ordens.filter(os => os.fornecedor && os.fornecedor.toUpperCase().includes(fForn.toUpperCase()));
        if (fStatus) ordens = ordens.filter(os => os.status === fStatus);
    }
    
    ordens.sort((a,b) => new Date(b.data_registro) - new Date(a.data_registro));
    
    const tb = document.querySelector('#table-os tbody'); 
    if(!tb) return;
    tb.innerHTML = '';
    
    if(ordens.length === 0) { 
        tb.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Nenhuma ordem encontrada no período ou filtro selecionado.</td></tr>'; 
        return; 
    }
    
    const isAdm = String(window.USUARIO?.nivel_acesso || '').toUpperCase().includes('ADM') || String(window.USUARIO?.nivel_acesso || '').toUpperCase() === 'GESTOR';
    
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
};
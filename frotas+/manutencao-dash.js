import { db } from './firebase-env.js';
import { collection, doc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const mod = "frota";

// Inicialização segura das instâncias de gráficos para evitar duplicidade
window.chartSec = null; 
window.chartTipo = null; 
window.chartVeic = null;

// Sincronização e fallback seguro das variáveis globais entre os escopos do sistema
window.veiculosList = window.veiculosList || []; 
window.ordensGlobal = window.ordensGlobal || []; 
window.contratosList = window.contratosList || []; 
window.catalogoList = window.catalogoList || [];  
window.itensOSAtual = window.itensOSAtual || [];

window.getSecretariasInteligentes = function() {
    let secSet = new Set(['SAÚDE', 'EDUCAÇÃO', 'OBRAS', 'AGRICULTURA', 'ASSISTÊNCIA SOCIAL', 'ADMINISTRAÇÃO', 'FINANÇAS', 'MEIO AMBIENTE', 'ESPORTES', 'CULTURA', 'TURISMO', 'SEGURANÇA', 'TRANSPORTE', 'GABINETE', 'EMPREENDEDORISMO']);
    
    let listaFrota = window.DADOS_VEICULOS || window.veiculosList || [];
    let listaContratos = window.DADOS_CONTRATOS || window.contratosList || [];
    let listaOrdens = window.ordensGlobal || [];

    listaFrota.forEach(v => {
        if(v.secretaria) secSet.add(v.secretaria.toUpperCase().trim());
        if(v.sec) secSet.add(v.sec.toUpperCase().trim());
    });
    listaContratos.forEach(c => {
        if(c.secretaria && !c.secretaria.includes('GERAL')) secSet.add(c.secretaria.toUpperCase().trim());
    });
    listaOrdens.forEach(os => {
        if(os.secretaria_veiculo) secSet.add(os.secretaria_veiculo.toUpperCase().trim());
    });
    return [...secSet].filter(s => s !== '').sort();
};

window.pesquisarAbaOS = function() {
    let dIni = document.getElementById('f-os-ini')?.value;
    let dFim = document.getElementById('f-os-fim')?.value;
    
    if(document.getElementById('r-data-ini')) document.getElementById('r-data-ini').value = dIni || '';
    if(document.getElementById('r-data-fim')) document.getElementById('r-data-fim').value = dFim || '';
    
    window.carregarDadosGerais(dIni, dFim);
};

window.limparBancoFrotas = async function() {
    if (window.USUARIO?.cpf !== "01305663306") return alert("Ação restrita ao Administrador Master.");
    
    let confirmacao = prompt(`ATENÇÃO! Esta ação apagará permanentemente TODAS as Ordens de Serviço, Contratos e Itens de Catálogo do tenant atual (${window.tenant.toUpperCase()}).\nPara continuar, digite APAGAR TUDO:`);
    
    if (confirmacao !== "APAGAR TUDO") return alert("Operação cancelada.");
    
    window.loading(true, "Limpando tabelas da oficina...");
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
        alert(`Base de dados da oficina limpa com sucesso! ${totalApagados} registros foram removidos.`);
        window.carregarDadosGerais();
    } catch(e) {
        alert("Erro ao limpar dados: " + e.message);
    } finally {
        window.loading(false);
    }
};

// Sincroniza e espelha as variáveis do core para manter compatibilidade com o módulo de oficina
window.carregarDadosGerais = async function(buscarDataIni = null, buscarDataFim = null) {
    window.loading(true, "Processando Métricas de Oficina...");
    
    try {
        if(window.buscarTudo) {
            await window.buscarTudo(); 
        }

        // Alinha os arrays locais com a carga unificada do dados.js
        window.veiculosList = window.DADOS_VEICULOS || [];
        window.contratosList = window.DADOS_CONTRATOS || [];
        window.ordensGlobal = window.DADOS_ABASTECIMENTOS || []; // Cruzamento passivo com abastecimento

        let dataIni = buscarDataIni;
        let dataFim = buscarDataFim;
        
        if(!dataIni || !dataFim) {
            const hj = new Date(); 
            const m = String(hj.getMonth() + 1).padStart(2, '0'); 
            const u = new Date(hj.getFullYear(), hj.getMonth() + 1, 0).getDate();
            dataIni = `${hj.getFullYear()}-${m}-01`; 
            dataFim = `${hj.getFullYear()}-${m}-${u}`;
        }
        
        if(document.getElementById('r-data-ini')) document.getElementById('r-data-ini').value = dataIni; 
        if(document.getElementById('r-data-fim')) document.getElementById('r-data-fim').value = dataFim;
        if(document.getElementById('f-os-ini')) document.getElementById('f-os-ini').value = dataIni; 
        if(document.getElementById('f-os-fim')) document.getElementById('f-os-fim').value = dataFim;

        if(document.getElementById('dash-total-destaque')) await window.carregarDashFiltro(true); 
        if(document.querySelector('#table-os')) await window.carregarTabelaOSComFiltro(true); 
        
    } catch(e) { 
        console.error("Erro ao carregar dados gerais da oficina:", e); 
    } finally {
        window.loading(false);
    }
};

window.gerarAuditoriaConsumo = function(ordensConsideradas) {
    const hoje = new Date(); 
    const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate(); 
    const diasCorridos = hoje.getDate() || 1; 
    
    let agrupamento = {};
    ordensConsideradas.forEach(os => {
        let veic = (window.DADOS_VEICULOS || window.veiculosList || []).find(v => v.id === os.placa); 
        let sec = os.secretaria_veiculo || os.secretariaReal || 'Indefinida'; 
        let dotacao = veic && veic.dotacao ? veic.dotacao : (veic && veic.destinacao ? veic.destinacao : 'Não Informada');
        let chave = sec + "|" + dotacao;
        
        if(!agrupamento[chave]) agrupamento[chave] = { sec: sec, dotacao: dotacao, gasto: 0 };
        agrupamento[chave].gasto += (parseFloat(os.valor_filtrado || os.valorTotal || os.valor || 0));
    });
    
    const tb = document.querySelector('#table-auditoria tbody'); 
    if(!tb) return;
    tb.innerHTML = '';
    
    if(Object.keys(agrupamento).length === 0) { 
        tb.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Sem dados financeiros de consumo neste período.</td></tr>'; 
        return; 
    }
    
    Object.values(agrupamento).forEach(item => {
        if(item.gasto <= 0) return;
        let projecao = (item.gasto / diasCorridos) * diasNoMes; 
        let badgeRisco = projecao > 20000 ? '<span class="badge bg-danger pulse-anim">Alto Volume</span>' : '<span class="badge bg-success">Estável</span>';
        tb.innerHTML += `<tr><td><strong>${item.sec}</strong></td><td>${item.dotacao}</td><td class="text-primary fw-bold">${window.formatarMoeda(item.gasto)}</td><td class="text-danger fw-bold">${window.formatarMoeda(projecao)}</td><td>${badgeRisco}</td></tr>`;
    });
};

window.carregarDashFiltro = async function(aplicarFiltrosFront = true) {
    let dtIni = document.getElementById('r-data-ini')?.value;
    let dtFim = document.getElementById('r-data-fim')?.value;

    let ordens = (window.DADOS_ABASTECIMENTOS || window.ordensGlobal || []).filter(os => {
        if(!os.dataAbastecimento) return true;
        let d = os.dataAbastecimento.split('T')[0];
        return d >= dtIni && d <= dtFim;
    });
    
    if(aplicarFiltrosFront) {
        const fPlaca = document.getElementById('r-placa')?.value; 
        const fForn = document.getElementById('r-forn')?.value; 
        const fStatus = document.getElementById('r-status')?.value;
        const fSec = document.getElementById('r-sec')?.value;
        const fDest = document.getElementById('r-dest')?.value;
        
        if (fPlaca) ordens = ordens.filter(os => os.placa && os.placa.toUpperCase().includes(fPlaca.toUpperCase()));
        if (fForn) ordens = ordens.filter(os => os.nomePosto && os.nomePosto.toUpperCase().includes(fForn.toUpperCase()));
        if (fStatus) ordens = ordens.filter(os => os.status === fStatus);
        if (fSec) ordens = ordens.filter(os => (os.secretaria || os.secretariaReal || '').toUpperCase().includes(fSec.toUpperCase()));
        if (fDest) ordens = ordens.filter(os => (os.destinacao || os.destinacaoReal || '').toUpperCase().includes(fDest.toUpperCase()));
        
        ordens.forEach(os => {
            os.valor_filtrado = parseFloat(os.valorTotal || os.valor || 0);
        });
    }
    
    let totSec = {}, totTipo = {}, totVeic = {}, valorTotalGeral = 0;
    let frotaList = window.DADOS_VEICULOS || window.veiculosList || [];
    
    frotaList.forEach(v => { v.gasto_total = 0; });
    let ordensParaGraficos = ordens.filter(os => os.status === 'Concluído');

    ordensParaGraficos.forEach(os => {
        let valor = parseFloat(os.valor_filtrado || os.valorTotal || 0); 
        let sec = os.secretaria || os.secretariaReal || 'Indefinida'; 
        let tipo = os.combustivel || os.tipoCombustivel || 'Outros'; 
        let veicLabel = os.placa;
        
        totSec[sec] = (totSec[sec] || 0) + valor; 
        totTipo[tipo] = (totTipo[tipo] || 0) + valor; 
        totVeic[veicLabel] = (totVeic[veicLabel] || 0) + valor; 
        valorTotalGeral += valor;
        
        let vTarget = frotaList.find(v => v.id === os.placa); 
        if(vTarget) vTarget.gasto_total += valor;
    });
    
    let destq = document.getElementById('dash-total-destaque');
    if(destq) destq.innerText = window.formatarMoeda(valorTotalGeral);
    
    // Renderização dos gráficos com proteção de existência do elemento no DOM
    if(document.getElementById('chartSecretaria') && typeof Chart !== 'undefined') {
        if(window.chartSec) window.chartSec.destroy(); 
        window.chartSec = new Chart(document.getElementById('chartSecretaria'), { type: 'pie', data: { labels: Object.keys(totSec), datasets: [{ data: Object.values(totSec), backgroundColor: ['#0d6efd','#198754','#dc3545','#ffc107','#0dcaf0','#6610f2'] }] } });
    }
    
    if(document.getElementById('chartTipo') && typeof Chart !== 'undefined') {
        if(window.chartTipo) window.chartTipo.destroy(); 
        window.chartTipo = new Chart(document.getElementById('chartTipo'), { type: 'doughnut', data: { labels: Object.keys(totTipo), datasets: [{ data: Object.values(totTipo), backgroundColor: ['#fd7e14','#20c997','#e83e8c','#6f42c1','#343a40'] }] } });
    }
    
    if(document.getElementById('chartVeiculo') && typeof Chart !== 'undefined') {
        const topVeiculos = Object.entries(totVeic).sort((a,b) => b[1] - a[1]).slice(0,5);
        if(window.chartVeic) window.chartVeic.destroy(); 
        window.chartVeic = new Chart(document.getElementById('chartVeiculo'), { type: 'bar', data: { labels: topVeiculos.map(x=>x[0]), datasets: [{ label: 'R$ Gasto', data: topVeiculos.map(x=>x[1]), backgroundColor: '#0d6efd' }] } });
    }
    
    const tbody = document.querySelector('#table-resumo-veiculos tbody'); 
    if(tbody) {
        tbody.innerHTML = '';
        let veiculosOrdenados = [...frotaList].sort((a,b) => (b.gasto_total||0) - (a.gasto_total||0));
        veiculosOrdenados.forEach(v => { 
            if(v.gasto_total > 0) {
                tbody.innerHTML += `<tr><td><strong>${v.placa || v.id}</strong></td><td>${v.modelo || v.veiculo || ''}</td><td>${v.secretaria || v.sec || ''}<br><small class="text-info">${v.destinacao || ''}</small></td><td>${v.dotacao || '-'}</td><td>${v.vinculo || v.origem || '-'}</td><td class="text-danger fw-bold text-end pe-4">${window.formatarMoeda(v.gasto_total)}</td></tr>`; 
            }
        });
    }
    
    window.gerarAuditoriaConsumo(ordensParaGraficos);
};

window.carregarTabelaOSComFiltro = async function(temFiltro = true) {
    // Mantém o espelho reverso estável com a listagem unificada
    if(window.filtrarRelatorio) window.filtrarRelatorio();
};

// =========================================================================
// 3. DOSSIÊ DE PRODUTIVIDADE DO CONDUTOR (MÓDULO MOTORISTA INTEGRADO)
// =========================================================================

window.abrirRelatorioMotorista = function(nomeMotorista) {
    window.motoristaSelecionadoParaRelatorio = nomeMotorista;
    let lblNome = document.getElementById('lblRelatorioMotoristaNome');
    if(lblNome) lblNome.innerText = nomeMotorista;
    
    const hj = new Date();
    const mesAno = `${hj.getFullYear()}-${String(hj.getMonth() + 1).padStart(2, '0')}`;
    let elFiltro = document.getElementById('filtroMesMotorista');
    if(elFiltro) elFiltro.value = mesAno;
    
    window.gerarDadosRelatorioMotorista();
    
    let modalDossie = document.getElementById('modalRelatorioMotorista');
    if(modalDossie) {
        let modalObj = bootstrap.Modal.getInstance(modalDossie) || new bootstrap.Modal(modalDossie);
        modalObj.show();
    }
};

window.gerarDadosRelatorioMotorista = function() {
    const nomeMot = window.motoristaSelecionadoParaRelatorio;
    const elFiltro = document.getElementById('filtroMesMotorista');
    if(!elFiltro) return;
    
    const mesAno = elFiltro.value; // Formato de entrada: YYYY-MM
    
    let rdvsDoMotorista = (window.ColecaoRDVs || []).filter(r => {
        // Checagem passiva: valida o condutor principal ou a lista de condutores anexada
        let bateData = r.data && r.data.startsWith(mesAno);
        let bateCondutor = false;
        
        if(r.motorista && r.motorista.toUpperCase() === nomeMot.toUpperCase()) bateCondutor = true;
        if(Array.isArray(r.condutores) && r.condutores.map(c => c.toUpperCase()).includes(nomeMot.toUpperCase())) bateCondutor = true;
        
        return bateData && bateCondutor;
    });

    let totalKM = 0;
    let veiculosUnicos = new Set();
    let diasTrabalhados = new Set();
    
    let tbody = document.getElementById('tbRelatorioMotorista');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(rdvsDoMotorista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Nenhum registro de atividade em RDV localizado para este condutor neste mês.</td></tr>';
    } else {
        rdvsDoMotorista.forEach(r => {
            let odoIni = parseFloat(r.odo_inicial) || 0;
            let odoFim = parseFloat(r.odo_final) || odoIni;
            let kmRodado = odoFim - odoIni;
            if(kmRodado < 0) kmRodado = 0; // Trava física contra inversão acidental de digitação

            totalKM += kmRodado;
            if(r.veiculo || r.placa) veiculosUnicos.add((r.veiculo || r.placa).toUpperCase());
            if(r.data) diasTrabalhados.add(r.data);
            
            let dataFormatada = r.data ? r.data.split('-').reverse().join('/') : '-';
            let veicNome = r.veiculo ? r.veiculo.toUpperCase() : '-';
            let rotaStr = r.rota || r.destino || 'Não Especificada';
            
            tbody.innerHTML += `
            <tr>
                <td class="fw-bold text-dark">${dataFormatada}</td>
                <td class="fw-bold">${veicNome}</td>
                <td class="small text-muted text-start">${rotaStr}</td>
                <td>${odoIni.toFixed(1)}</td>
                <td>${odoFim.toFixed(1)}</td>
                <td class="fw-bold text-primary">${kmRodado.toFixed(1)}</td>
            </tr>`;
        });
    }
    
    // Atualização em lote dos KPIs superiores do dossiê
    let elMotKMs = document.getElementById('relMotKMs'); if(elMotKMs) elMotKMs.innerText = totalKM.toFixed(1);
    let elMotDias = document.getElementById('relMotDias'); if(elMotDias) elMotDias.innerText = diasTrabalhados.size;
    let elMotVeic = document.getElementById('relMotVeiculos'); if(elMotVeic) elMotVeic.innerText = veiculosUnicos.size;
};
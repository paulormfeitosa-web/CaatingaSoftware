import { db } from './firebase-env.js';
import { doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// =========================================================================
// RASTREADOR DE INTELIGÊNCIA: ODOMETRO E MÉDIA REAL
// =========================================================================
window.obterDadosReaisVeiculo = function(placa, odoBase) {
    let ultimoOdo = window.safeCurrency(odoBase) || 0;
    let dataUltimo = new Date(0);

    let abastecimentos = (window.DADOS_ABASTECIMENTOS || []).filter(a => a.placa === placa && a.status === 'Concluído');
    let rdvs = (window.ColecaoRDVs || []).filter(r => r.placa === placa);

    abastecimentos.forEach(a => {
        if(a.dataAbastecimento && new Date(a.dataAbastecimento) > dataUltimo) {
            if(a.odometroPainel > 0) {
                dataUltimo = new Date(a.dataAbastecimento);
                ultimoOdo = window.safeCurrency(a.odometroPainel);
            }
        }
    });

    rdvs.forEach(r => {
        if(r.data && new Date(r.data) > dataUltimo) {
            if(r.odometroFinal > 0) {
                dataUltimo = new Date(r.data);
                ultimoOdo = window.safeCurrency(r.odometroFinal);
            }
        }
    });

    let mesAtual = new Date().toISOString().slice(0, 7);
    let abastsMes = abastecimentos.filter(a => a.dataAbastecimento && a.dataAbastecimento.startsWith(mesAtual));
    abastsMes.sort((a,b) => new Date(a.dataAbastecimento) - new Date(b.dataAbastecimento));

    let mediaMes = 0;
    if(abastsMes.length > 1) {
        let primeiro = abastsMes[0];
        let ultimo = abastsMes[abastsMes.length - 1];
        let diffKm = window.safeCurrency(ultimo.odometroPainel) - window.safeCurrency(primeiro.odometroPainel);
        let litrosTotais = 0;
        
        for(let i = 1; i < abastsMes.length; i++) {
            litrosTotais += window.safeCurrency(abastsMes[i].quantidade);
        }
        if(diffKm > 0 && litrosTotais > 0) {
            mediaMes = diffKm / litrosTotais;
        }
    }

    return { ultimoOdo, mediaMes };
};

// =========================================================================
// 1. GESTÃO DE VEÍCULOS E FROTA
// =========================================================================
window.atualizarDestinacoesVeiculo = function(valorAtual = '') {
    let elSec = document.getElementById('vSec');
    let sel = document.getElementById('vDest');
    if (!elSec || !sel) return;

    let secEscolhida = elSec.value.toUpperCase();
    let destsDaSec = (window.DADOS_CONTRATOS || []).filter(c => c.secretaria && c.secretaria.toUpperCase() === secEscolhida).map(c => c.destinacao || 'GERAL');
    let unicos = [...new Set(destsDaSec)];
    
    let html = '<option value="">-- Selecione a Divisão --</option>';
    if(unicos.length === 0) { 
        html += '<option value="GERAL">GERAL</option>'; 
    } else { 
        unicos.forEach(d => html += `<option value="${d}">${d}</option>`); 
    }
    
    sel.innerHTML = html;
    
    if(valorAtual && unicos.includes(valorAtual)) sel.value = valorAtual;
    else if (unicos.length === 1) sel.value = unicos[0];
};

window.renderTabVeiculos = function() {
    let h = '';
    let elBusca = document.getElementById('fBuscaVeic');
    let fBusca = elBusca ? elBusca.value.toUpperCase() : '';
    
    let elTotVeic = document.getElementById("dash-tot-veiculos");
    let elTotOficina = document.getElementById("dash-tot-oficina");

    if(elTotVeic && elTotOficina && window.DADOS_VEICULOS) {
        elTotVeic.innerText = window.DADOS_VEICULOS.filter(v => v.status_operacional === "Disponível" || !v.status_operacional).length;
        elTotOficina.innerText = window.DADOS_VEICULOS.filter(v => v.status_operacional === "Oficina" || v.status_operacional === "Inservível").length;
    }

    if(window.DADOS_VEICULOS) {
        window.DADOS_VEICULOS.forEach(v => {
            let textoBusca = `${v.id} ${v.placa||''} ${v.modelo || ''} ${v.secretaria || ''} ${v.destinacao || ''}`.toUpperCase();
            if (fBusca && !textoBusca.includes(fBusca)) return; 
            
            let jV = encodeURIComponent(JSON.stringify(v));
            let tipoStr = v.tipoFrota === 'Máquina' || v.tipo_padronizado === 'Máquina' ? '<i class="fas fa-tractor text-warning"></i> Máquina' : '<i class="fas fa-car text-primary"></i> Veículo';
            let origemStr = v.origem || 'Próprio';
            let badgeOrigem = origemStr === 'Locado' ? '<span class="badge bg-info text-dark"><i class="fas fa-handshake"></i> Locado</span>' : '<span class="badge bg-secondary">Próprio</span>';
            let destStr = v.destinacao ? ` / ${v.destinacao}` : '';
            let idShow = v.placa ? v.placa.toUpperCase() : v.id;

            let statusReal = v.status_operacional || 'Disponível';
            let badgeStatus = '<span class="badge bg-success shadow-sm">Disponível</span>';
            if(statusReal === 'Oficina') badgeStatus = '<span class="badge bg-warning text-dark shadow-sm">Na Oficina</span>';
            if(statusReal === 'Inservível') badgeStatus = '<span class="badge bg-danger shadow-sm">Inservível (Baixa)</span>';

            let odoInicialBase = v.odometroInicial || v.km_atual || 0;
            let dadosInteligentes = window.obterDadosReaisVeiculo(v.id, odoInicialBase);

            h += `<tr>
                <td class="fw-bold text-uppercase">${idShow}</td>
                <td>${badgeOrigem}</td>
                <td>${tipoStr}<br><small class="text-muted">${v.modelo || 'S/ Modelo'}</small></td>
                <td><span class="fw-bold">${v.secretaria || 'NÃO INFORMADA'}</span><br><small class="text-primary fw-bold">${destStr}</small></td>
                <td>${badgeStatus}</td>
                <td class="fw-bold text-success">${dadosInteligentes.ultimoOdo.toFixed(1)}</td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-sm btn-outline-info" title="Gerar RDV" onclick="window.IrParaRDV('${idShow}')"><i class="fas fa-file-pdf"></i></button>
                    <button class="btn btn-sm btn-outline-primary ms-1" onclick="window.prepararEdicaoVeic('${jV}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger ms-1" onclick="window.excluirVeic('${v.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
    }
    
    let elLista = document.getElementById('listaVeic');
    if(elLista) elLista.innerHTML = h || '<tr><td colspan="7" class="text-muted py-4 text-center">Nenhum equipamento encontrado.</td></tr>';
};

window.prepararEdicaoVeic = function(str) {
    const v = JSON.parse(decodeURIComponent(str)); 
    
    let ids = ['hdnOldPlaca', 'vTipo', 'vOrigem', 'vPlaca', 'vModelo', 'vSec', 'vComb', 'vMediaReal', 'vOdoInicial', 'vOdoAtual', 'vStatus', 'btnSaveVeic', 'btnCancelVeic'];
    let els = {};
    ids.forEach(id => els[id] = document.getElementById(id));

    if(els.hdnOldPlaca) els.hdnOldPlaca.value = v.id; 
    if(els.vTipo) els.vTipo.value = v.tipoFrota || v.tipo_padronizado || 'Veículo';
    if(els.vOrigem) els.vOrigem.value = v.origem || 'Próprio';
    if(els.vPlaca) { els.vPlaca.value = v.placa || v.id; els.vPlaca.readOnly = true; }
    if(els.vModelo) els.vModelo.value = v.modelo || ''; 
    if(els.vSec) els.vSec.value = v.secretaria || '';
    
    window.atualizarDestinacoesVeiculo(v.destinacao || 'GERAL');

    if(els.vComb) els.vComb.value = v.combustivel || 'Gasolina';
    if(els.vOdoInicial) els.vOdoInicial.value = v.odometroInicial !== undefined ? window.formatarNumeroInput(v.odometroInicial, 1) : '';
    if(els.vStatus) els.vStatus.value = v.status_operacional || 'Disponível';

    let odoInicialBase = v.odometroInicial || v.km_atual || 0;
    let dadosInteligentes = window.obterDadosReaisVeiculo(v.id, odoInicialBase);
    
    if(els.vMediaReal) els.vMediaReal.value = dadosInteligentes.mediaMes > 0 ? dadosInteligentes.mediaMes.toFixed(2) + ' Km/L' : 'S/ Dados';
    if(els.vOdoAtual) els.vOdoAtual.value = dadosInteligentes.ultimoOdo.toFixed(1);
    
    if(els.btnSaveVeic) els.btnSaveVeic.innerHTML = '<i class="fas fa-save"></i> SALVAR ALTERAÇÃO';
    if(els.btnCancelVeic) els.btnCancelVeic.classList.remove('hidden'); 
    
    window.scrollTo(0, 0);
};

window.cancelarEdicaoVeic = function() {
    let ids = ['hdnOldPlaca', 'vTipo', 'vOrigem', 'vPlaca', 'vModelo', 'vSec', 'vDest', 'vComb', 'vMediaReal', 'vOdoInicial', 'vOdoAtual', 'vStatus', 'btnSaveVeic', 'btnCancelVeic'];
    let els = {};
    ids.forEach(id => els[id] = document.getElementById(id));

    if(els.hdnOldPlaca) els.hdnOldPlaca.value = ''; 
    if(els.vTipo) els.vTipo.value = 'Veículo'; 
    if(els.vOrigem) els.vOrigem.value = 'Próprio';
    if(els.vPlaca) { els.vPlaca.value = ''; els.vPlaca.readOnly = false; }
    if(els.vModelo) els.vModelo.value = ''; 
    if(els.vSec) els.vSec.value = '';
    if(els.vDest) { els.vDest.innerHTML = '<option value="GERAL">GERAL</option>'; els.vDest.value = 'GERAL'; }
    if(els.vComb) els.vComb.value = 'Gasolina';
    if(els.vMediaReal) els.vMediaReal.value = ''; 
    if(els.vOdoInicial) els.vOdoInicial.value = '';
    if(els.vOdoAtual) els.vOdoAtual.value = '';
    if(els.vStatus) els.vStatus.value = 'Disponível';
    
    if(els.btnSaveVeic) els.btnSaveVeic.innerHTML = '<i class="fas fa-save"></i> GRAVAR VEÍCULO';
    if(els.btnCancelVeic) els.btnCancelVeic.classList.add('hidden');
};

window.salvarVeic = async function() {
    let elPlaca = document.getElementById('vPlaca');
    let elDest = document.getElementById('vDest');
    let elOdoIni = document.getElementById('vOdoInicial');
    let elStatus = document.getElementById('vStatus');
    let btnSalvar = document.getElementById('btnSaveVeic');

    if (!elPlaca || !elDest) return;

    const placa = elPlaca.value.toUpperCase().trim();
    const dest = elDest.value;
    const odoIniStr = elOdoIni ? elOdoIni.value : '';
    const statusSelect = elStatus ? elStatus.value : 'Disponível';

    if(!placa) return alert("Placa/ID é obrigatório.");
    if(!dest) return alert("Por favor, selecione uma Destinação (Centro de Custo).");

    window.toggleButtonLoading(btnSalvar, true);
    window.loading(true, "Salvando...");
    
    try {
        const dados = { 
            placa: placa,
            tipoFrota: document.getElementById('vTipo') ? document.getElementById('vTipo').value : 'Veículo', 
            tipo_veiculo: document.getElementById('vTipo') ? document.getElementById('vTipo').value : 'Veículo',
            origem: document.getElementById('vOrigem') ? document.getElementById('vOrigem').value : 'Próprio',
            modelo: document.getElementById('vModelo') ? document.getElementById('vModelo').value.trim() : '', 
            secretaria: document.getElementById('vSec') ? document.getElementById('vSec').value.toUpperCase().trim() : '', 
            destinacao: dest,
            combustivel: document.getElementById('vComb') ? document.getElementById('vComb').value : 'Gasolina', 
            status_operacional: statusSelect
        };
        
        let odoConvertido = 0;
        if(odoIniStr !== '') {
            odoConvertido = window.safeCurrency(odoIniStr);
            dados.odometroInicial = odoConvertido;
        }

        let elHdnOld = document.getElementById('hdnOldPlaca');
        if(!elHdnOld || !elHdnOld.value) { 
            dados.odometro = odoConvertido;
            dados.km_atual = odoConvertido;
            dados.horimetro = odoConvertido;
        }
        
        await setDoc(doc(db, `${window.tenant}_veiculos`, placa), dados, {merge:true});
        window.cancelarEdicaoVeic(); 
        if(window.buscarTudo) await window.buscarTudo();
    } catch(e) { 
        console.error(e); alert("Erro: " + e.message); 
    } finally { 
        window.toggleButtonLoading(btnSalvar, false); window.loading(false); 
    }
};

window.excluirVeic = async function(placa) {
    if(!confirm(`Excluir permanentemente o veículo ${placa}? Isso não apagará o histórico de abastecimentos ou RDVs.`)) return;
    window.loading(true, "Excluindo..."); 
    try { 
        await deleteDoc(doc(db, `${window.tenant}_veiculos`, placa)); 
        if(window.buscarTudo) await window.buscarTudo(); 
    } catch(e) { 
        console.error(e); alert("Erro: " + e.message); window.loading(false); 
    }
};

window.IrParaRDV = function(placa) {
    let tabTarget = document.querySelector('[data-bs-target="#admRDV"]');
    if(tabTarget) {
        let tab = new bootstrap.Tab(tabTarget);
        tab.show();
    }
    
    setTimeout(() => {
        let elRdv = document.getElementById('rdv-veiculo-input');
        if(elRdv) elRdv.value = placa;
        if(window.AcionarSincronizacaoRDV) window.AcionarSincronizacaoRDV();
    }, 400);
};

// =========================================================================
// IMPRESSÃO E RELATÓRIO PDF DA FROTA
// =========================================================================
window.abrirModalPrintVeic = function() {
    let selectSec = document.getElementById('pSec');
    if(selectSec) {
        selectSec.innerHTML = '<option value="">Todas</option>';
        let secs = [...new Set(window.DADOS_VEICULOS.map(v => v.secretaria).filter(s => s))].sort();
        secs.forEach(s => selectSec.innerHTML += `<option value="${s}">${s}</option>`);
    }
    
    let mObj = document.getElementById('modalPrintVeic');
    if(mObj) {
        let bsModal = bootstrap.Modal.getInstance(mObj) || new bootstrap.Modal(mObj);
        bsModal.show();
    }
};

window.gerarImpressaoVeic = function() {
    let pTipo = document.getElementById('pTipo')?.value || '';
    let pOrigem = document.getElementById('pOrigem')?.value || '';
    let pSec = document.getElementById('pSec')?.value || '';
    let pStatus = document.getElementById('pStatus')?.value || '';

    let lista = window.DADOS_VEICULOS.filter(v => {
        if(pTipo && (v.tipoFrota || v.tipo_padronizado || 'Veículo') !== pTipo) return false;
        if(pOrigem && (v.origem || 'Próprio') !== pOrigem) return false;
        if(pSec && v.secretaria !== pSec) return false;
        
        let st = v.status_operacional || 'Disponível';
        if(pStatus && st !== pStatus) return false;
        return true;
    });

    lista.sort((a,b) => {
        if((a.secretaria||'') < (b.secretaria||'')) return -1;
        if((a.secretaria||'') > (b.secretaria||'')) return 1;
        return 0;
    });

    let html = '';
    lista.forEach(v => {
        let odoBase = v.odometroInicial || v.km_atual || 0;
        let dadosInteligentes = window.obterDadosReaisVeiculo(v.id, odoBase);
        let stLocal = v.status_operacional || 'Disponível';
        
        html += `<tr>
            <td><strong>${v.placa || v.id}</strong></td>
            <td>${v.modelo || '-'}</td>
            <td>${v.secretaria || '-'} <small style="color:blue;">(${v.destinacao || 'GERAL'})</small></td>
            <td>${v.tipoFrota || v.tipo_padronizado || 'Veículo'}</td>
            <td>${v.origem || 'Próprio'}</td>
            <td>${v.combustivel || 'Gasolina'}</td>
            <td><strong>${stLocal}</strong></td>
            <td style="color:green; font-weight:bold;">${dadosInteligentes.ultimoOdo.toFixed(1)}</td>
        </tr>`;
    });

    let elCorpo = document.getElementById('print-corpo-relatorio-frota');
    if(elCorpo) elCorpo.innerHTML = html || '<tr><td colspan="8" class="text-center text-muted py-3">Nenhum veículo encontrado com os filtros selecionados.</td></tr>';

    let filtros = [];
    if(pTipo) filtros.push(`Tipo: ${pTipo}`);
    if(pOrigem) filtros.push(`Origem: ${pOrigem}`);
    if(pSec) filtros.push(`Secretaria: ${pSec}`);
    if(pStatus) filtros.push(`Status: ${pStatus}`);
    
    let elFiltros = document.getElementById('print-filtros-aplicados');
    if(elFiltros) elFiltros.innerText = filtros.length > 0 ? filtros.join(' | ') : 'TODOS OS VEÍCULOS (SEM FILTRO)';

    let mObj = document.getElementById('modalPrintVeic');
    if(mObj) bootstrap.Modal.getInstance(mObj).hide();

    // A MÁGICA DE IMPRESSÃO: Remove o d-none provisoriamente
    setTimeout(() => {
        let printContainer = document.getElementById('print-section-relatorio-frota');
        if (!printContainer) return;
        
        // Remove as classes que ocultam o elemento (do Bootstrap e do seu CSS)
        printContainer.classList.remove('d-none', 'hidden');
        
        // Exibe em formato block momentaneamente
        printContainer.style.display = 'block';

        if(window.imprimirDocumento) {
            // Manda o código HTML visível para a impressora
            window.imprimirDocumento(printContainer.outerHTML, 'Relatorio_Frota');
        }

        // Esconde novamente após enviar pra impressão
        setTimeout(() => {
            printContainer.classList.add('d-none', 'print-only');
            printContainer.style.display = 'none';
        }, 1000);
        
    }, 500);
};

// =========================================================================
// 2. EQUIPE / MOTORISTAS
// =========================================================================
window.renderMotoristas = function() {
    let h = '';
    if(window.DADOS_MOTORISTAS) {
        window.DADOS_MOTORISTAS.forEach(m => {
            h += `<tr>
                <td class="fw-bold">${m.nome}</td>
                <td>${m.cpf || '-'}</td>
                <td>${m.cnh || '-'}</td>
                <td><span class="badge bg-secondary">${m.categoria || '-'}</span></td>
                <td><span class="badge border border-dark text-dark">${m.cargo || 'Motorista'}</span></td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-sm btn-dark" title="Dossiê de Produtividade" onclick='window.abrirRelatorioMotorista("${m.nome}")'><i class="fas fa-chart-line"></i></button>
                    <button class="btn btn-sm btn-outline-primary ms-1" onclick="window.prepararEdicaoMot('${m.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger ms-1" onclick="window.excluirMotorista('${m.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
    }
    
    let elTabela = document.getElementById('listaMotoristasTabela');
    if(elTabela) elTabela.innerHTML = h || '<tr><td colspan="6" class="text-muted py-3">Nenhum motorista cadastrado.</td></tr>';
};

window.prepararEdicaoMot = function(id) {
    const m = window.DADOS_MOTORISTAS.find(x => x.id === id);
    if(!m) return;
    
    let els = {
        hdn: document.getElementById('hdnIdMotorista'),
        nome: document.getElementById('cadMotNome'),
        cpf: document.getElementById('cadMotCPF'),
        cnh: document.getElementById('cadMotCNH'),
        cat: document.getElementById('cadMotCat'),
        cargo: document.getElementById('cadMotCargo'),
        btnSave: document.getElementById('btnSaveMot'),
        btnCancel: document.getElementById('btnCancelMot')
    };

    if(els.hdn) els.hdn.value = m.id;
    if(els.nome) els.nome.value = m.nome || '';
    if(els.cpf) els.cpf.value = m.cpf || '';
    if(els.cnh) els.cnh.value = m.cnh || '';
    if(els.cat) els.cat.value = m.categoria || '';
    if(els.cargo) els.cargo.value = m.cargo || 'MOTORISTA';
    if(els.btnSave) els.btnSave.innerHTML = '<i class="fas fa-save"></i> ATUALIZAR';
    if(els.btnCancel) els.btnCancel.classList.remove('hidden');
};

window.cancelarEdicaoMot = function() {
    let els = {
        hdn: document.getElementById('hdnIdMotorista'),
        nome: document.getElementById('cadMotNome'),
        cpf: document.getElementById('cadMotCPF'),
        cnh: document.getElementById('cadMotCNH'),
        cat: document.getElementById('cadMotCat'),
        cargo: document.getElementById('cadMotCargo'),
        btnSave: document.getElementById('btnSaveMot'),
        btnCancel: document.getElementById('btnCancelMot')
    };

    if(els.hdn) els.hdn.value = '';
    if(els.nome) els.nome.value = '';
    if(els.cpf) els.cpf.value = '';
    if(els.cnh) els.cnh.value = '';
    if(els.cat) els.cat.value = '';
    if(els.cargo) els.cargo.value = 'MOTORISTA';
    if(els.btnSave) els.btnSave.innerHTML = '<i class="fas fa-save"></i> SALVAR';
    if(els.btnCancel) els.btnCancel.classList.add('hidden');
};

window.salvarMotorista = async function() {
    let els = {
        nome: document.getElementById('cadMotNome'),
        cpf: document.getElementById('cadMotCPF'),
        cnh: document.getElementById('cadMotCNH'),
        cat: document.getElementById('cadMotCat'),
        cargo: document.getElementById('cadMotCargo'),
        hdn: document.getElementById('hdnIdMotorista'),
        btnSave: document.getElementById('btnSaveMot')
    };

    if(!els.nome) return;

    const nome = els.nome.value.toUpperCase().trim();
    const cpf = els.cpf ? els.cpf.value.trim() : '';
    const cnh = els.cnh ? els.cnh.value.trim() : '';
    const cat = els.cat ? els.cat.value.toUpperCase().trim() : '';
    const cargo = els.cargo ? els.cargo.value : 'MOTORISTA';
    const editId = els.hdn ? els.hdn.value : '';

    if(!nome) return alert("O nome do motorista é obrigatório.");
    
    window.toggleButtonLoading(els.btnSave, true);
    window.loading(true, "Salvando Condutor...");
    
    try {
        let id = editId || "MOT-" + Date.now();
        await setDoc(doc(db, `${window.tenant}_motoristas`, id), { nome: nome, cpf: cpf, cnh: cnh, categoria: cat, cargo: cargo, status: "Ativo" }, {merge: true});
        await setDoc(doc(db, `${window.tenant}_equipe`, id), { nome: nome, doc: cpf, cargo: cargo, status: "Ativo" }, {merge: true}); 
        window.cancelarEdicaoMot(); 
        if(window.buscarTudo) await window.buscarTudo();
    } catch(e) { 
        console.error(e); alert("Erro: " + e.message); 
    } finally { 
        window.toggleButtonLoading(els.btnSave, false); window.loading(false); 
    }
};

window.SalvarMotoristaRapido = async function() {
    let elNome = document.getElementById('cadMotNome');
    let elCpf = document.getElementById('cadMotCpf');
    
    if(!elNome || !elNome.value.trim()) return alert("Digite o nome completo do condutor.");
    
    window.loading(true, "Salvando Condutor Rápido...");
    try {
        let nome = elNome.value.toUpperCase().trim();
        let cpf = elCpf ? elCpf.value : '';
        let id = "MOT-" + Date.now();
        
        await setDoc(doc(db, `${window.tenant}_motoristas`, id), { nome: nome, cpf: cpf, cnh: '', categoria: '', cargo: "MOTORISTA", status: "Ativo" }, {merge: true});
        await setDoc(doc(db, `${window.tenant}_equipe`, id), { nome: nome, doc: cpf, cargo: "MOTORISTA", status: "Ativo" }, {merge: true}); 
        
        if(window.buscarTudo) await window.buscarTudo();
        
        let mObj = document.getElementById('modalMembroEquipe');
        if(mObj) bootstrap.Modal.getInstance(mObj).hide();
        
        if(document.getElementById('rdv-motorista-busca')) document.getElementById('rdv-motorista-busca').value = '';
    } catch(e) {
        console.error(e); alert("Erro ao criar condutor: " + e.message);
    } finally {
        window.loading(false);
    }
};

window.excluirMotorista = async function(id) {
    if(!confirm("Tem certeza que deseja excluir este motorista?")) return;
    window.loading(true, "Excluindo...");
    try { 
        await deleteDoc(doc(db, `${window.tenant}_motoristas`, id)); 
        await deleteDoc(doc(db, `${window.tenant}_equipe`, id)); 
        if(window.buscarTudo) await window.buscarTudo(); 
    } catch(e) { 
        console.error(e); alert("Erro: " + e.message); window.loading(false); 
    }
};

// =========================================================================
// 3. POSTOS DE COMBUSTÍVEL
// =========================================================================
window.renderPostos = function() {
    let h = '';
    let dHoje = new Date().toISOString().slice(0, 10);
    if(window.DADOS_POSTOS) {
        window.DADOS_POSTOS.forEach(p => {
            let badgeCod = p.codigoVinculo ? `<span class="badge bg-primary px-2">${p.codigoVinculo}</span>` : '<span class="text-muted">-</span>';
            let precosAtuais = {Gasolina: 0, Diesel: 0, Etanol: 0};
            if(window.obterPrecoVigente) precosAtuais = window.obterPrecoVigente(p.nome, dHoje);
            
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
    }
    
    let elTabela = document.getElementById('listaPostosTabela');
    if(elTabela) elTabela.innerHTML = h || '<tr><td colspan="6" class="text-muted py-3">Nenhum posto cadastrado.</td></tr>';
};

window.prepararEdicaoPosto = function(id) {
    let p = window.DADOS_POSTOS.find(x => x.id === id);
    if(!p) return;
    
    let els = {
        hdn: document.getElementById('hdnIdPosto'),
        nome: document.getElementById('cadPostoNome'),
        codigo: document.getElementById('cadPostoCodigo'),
        vigencia: document.getElementById('cadPostoVigencia'),
        gas: document.getElementById('cadPostoGas'),
        die: document.getElementById('cadPostoDie'),
        eta: document.getElementById('cadPostoEta'),
        btnSave: document.getElementById('btnSavePosto'),
        btnCancel: document.getElementById('btnCancelPosto')
    };

    if(els.hdn) els.hdn.value = p.id;
    if(els.nome) els.nome.value = p.nome || '';
    if(els.codigo) els.codigo.value = p.codigoVinculo || '';
    
    let dHoje = new Date().toISOString().slice(0, 10);
    if(els.vigencia) els.vigencia.value = dHoje;
    
    let precosAtuais = {Gasolina: 0, Diesel: 0, Etanol: 0};
    if(window.obterPrecoVigente) precosAtuais = window.obterPrecoVigente(p.nome, dHoje);

    if(els.gas) els.gas.value = precosAtuais.Gasolina ? precosAtuais.Gasolina.toFixed(2).replace('.',',') : '';
    if(els.die) els.die.value = precosAtuais.Diesel ? precosAtuais.Diesel.toFixed(2).replace('.',',') : '';
    if(els.eta) els.eta.value = precosAtuais.Etanol ? precosAtuais.Etanol.toFixed(2).replace('.',',') : '';
    
    if (window.renderHistoricoPrecos) window.renderHistoricoPrecos(p);
    
    if(els.btnSave) els.btnSave.innerHTML = '<i class="fas fa-save"></i> SALVAR NOVO PREÇO';
    if(els.btnCancel) els.btnCancel.classList.remove('hidden');
    
    window.scrollTo(0, 0);
};

window.renderHistoricoPrecos = function(p) {
    let box = document.getElementById('boxHistoricoPrecos');
    let tb = document.getElementById('tbHistoricoPrecos');
    
    if(!box || !tb) return;
    
    box.classList.remove('hidden');
    
    if(!p.vigencias || p.vigencias.length === 0) {
        tb.innerHTML = '<tr><td colspan="5" class="text-muted">Nenhum histórico registrado ainda.</td></tr>'; 
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
};

window.excluirVigenciaPosto = async function(idPosto, dataVig) {
    if(!confirm(`Remover os preços do dia ${dataVig.split('-').reverse().join('/')}?`)) return;
    window.loading(true, "Apagando vigência...");
    try {
        let p = window.DADOS_POSTOS.find(x => x.id === idPosto);
        if(!p) throw new Error("Posto não encontrado.");
        let novasVig = p.vigencias.filter(v => v.data !== dataVig);
        let gas = 0, die = 0, eta = 0;
        if(novasVig.length > 0) { gas = novasVig[0].Gasolina; die = novasVig[0].Diesel; eta = novasVig[0].Etanol; }
        
        await setDoc(doc(db, `${window.tenant}_postos`, idPosto), { vigencias: novasVig, Gasolina: gas, Diesel: die, Etanol: eta }, {merge: true});
        if(window.buscarTudo) await window.buscarTudo(); 
        window.prepararEdicaoPosto(idPosto);
    } catch(e) { 
        console.error(e); alert("Erro: " + e.message); 
    } finally { 
        window.loading(false); 
    }
};

window.cancelarEdicaoPosto = function() {
    let els = {
        hdn: document.getElementById('hdnIdPosto'),
        nome: document.getElementById('cadPostoNome'),
        codigo: document.getElementById('cadPostoCodigo'),
        vigencia: document.getElementById('cadPostoVigencia'),
        gas: document.getElementById('cadPostoGas'),
        die: document.getElementById('cadPostoDie'),
        eta: document.getElementById('cadPostoEta'),
        box: document.getElementById('boxHistoricoPrecos'),
        btnSave: document.getElementById('btnSavePosto'),
        btnCancel: document.getElementById('btnCancelPosto')
    };

    if(els.hdn) els.hdn.value = '';
    if(els.nome) els.nome.value = ''; 
    if(els.codigo) els.codigo.value = '';
    if(els.vigencia) els.vigencia.value = new Date().toISOString().slice(0, 10);
    if(els.gas) els.gas.value = ''; 
    if(els.die) els.die.value = ''; 
    if(els.eta) els.eta.value = '';
    if(els.box) els.box.classList.add('hidden');
    if(els.btnSave) els.btnSave.innerHTML = '<i class="fas fa-save"></i> SALVAR POSTO';
    if(els.btnCancel) els.btnCancel.classList.add('hidden');
};

window.salvarPosto = async function() {
    let els = {
        hdn: document.getElementById('hdnIdPosto'),
        nome: document.getElementById('cadPostoNome'),
        codigo: document.getElementById('cadPostoCodigo'),
        vigencia: document.getElementById('cadPostoVigencia'),
        gas: document.getElementById('cadPostoGas'),
        die: document.getElementById('cadPostoDie'),
        eta: document.getElementById('cadPostoEta'),
        btnSave: document.getElementById('btnSavePosto')
    };

    if(!els.nome || !els.codigo || !els.vigencia) return;

    const idEdicao = els.hdn ? els.hdn.value : '';
    const nome = els.nome.value.toUpperCase().trim();
    const cod = els.codigo.value.toUpperCase().trim();
    const vigData = els.vigencia.value;
    const gas = els.gas ? window.safeCurrency(els.gas.value) : 0;
    const die = els.die ? window.safeCurrency(els.die.value) : 0;
    const eta = els.eta ? window.safeCurrency(els.eta.value) : 0;

    if(!nome || !cod) return alert("O Nome do Posto e o Cód. Identificador são obrigatórios.");
    if(!vigData) return alert("A Data de Início de Vigência é obrigatória.");
    
    window.toggleButtonLoading(els.btnSave, true);
    window.loading(true, "Salvando Posto e Vigência...");
    
    try {
        let id = idEdicao ? idEdicao : "POS-" + Date.now();
        let pExistente = window.DADOS_POSTOS.find(x => x.id === id);
        let vigs = (pExistente && pExistente.vigencias) ? [...pExistente.vigencias] : [];
        
        vigs = vigs.filter(v => v.data !== vigData);
        vigs.push({ data: vigData, Gasolina: gas, Diesel: die, Etanol: eta });
        vigs.sort((a,b) => (a.data > b.data) ? -1 : 1); 

        await setDoc(doc(db, `${window.tenant}_postos`, id), { nome: nome, codigoVinculo: cod, Gasolina: gas, Diesel: die, Etanol: eta, vigencias: vigs }, {merge: true});
        window.cancelarEdicaoPosto(); 
        if(window.buscarTudo) await window.buscarTudo();
    } catch(e) { 
        console.error(e); alert("Erro: " + e.message); 
    } finally { 
        window.toggleButtonLoading(els.btnSave, false); window.loading(false); 
    }
};

window.excluirPosto = async function(id) {
    if(!confirm("Excluir este posto e os preços dele?")) return;
    window.loading(true, "Excluindo...");
    try { 
        await deleteDoc(doc(db, `${window.tenant}_postos`, id)); 
        if(window.buscarTudo) await window.buscarTudo(); 
    } catch(e) { 
        console.error(e); alert("Erro: " + e.message); window.loading(false); 
    }
};

// =========================================================================
// 4. CONTRATOS DE COMBUSTÍVEL
// =========================================================================

window.atualizarFiltroDestContrato = function() {
    let elSec = document.getElementById('filtroContratoSec');
    let elDest = document.getElementById('filtroContratoDest');
    if(!elSec || !elDest) return;

    let sec = elSec.value.toUpperCase();
    let dests = window.DADOS_CONTRATOS.filter(c => !sec || (c.secretaria && c.secretaria.toUpperCase() === sec)).map(c => c.destinacao || 'GERAL');
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
            h += `<tr><td class="fw-bold text-primary">${item.destinacao}</td><td class="small text-danger">${txtG}</td><td class="small text-dark">${txtD}</td><td class="small text-success">${txtE}</td><td class="fw-bold text-dark">R$ ${item.valorInicial.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td><button type="button" class="btn btn-sm text-danger" title="Remover da lista" onclick="window.removerDestTemp(${idx})"><i class="fas fa-times"></i></button></td></tr>`;
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
    let c = window.DADOS_CONTRATOS.find(x => x.id === id); 
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
    window.loading(true, "Excluindo contrato...");
    try { 
        await deleteDoc(doc(db, `${window.tenant}_contratos`, id)); 
        if(window.buscarTudo) await window.buscarTudo(); 
    } catch(e) { 
        console.error(e); alert("Erro: " + e.message); window.loading(false); 
    }
};
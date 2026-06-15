import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, getDocs, setDoc, deleteDoc, collection } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// =========================================================================
// FEITOSA SOFTWARES - FROTAS+ (TABELA DE ABASTECIMENTO + EDIÇÃO DE VEÍCULOS)
// =========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBOEgd1WCElKtngAcQ-ygnx0_2lpHLUAyM",
    authDomain: "caatingasoftware.firebaseapp.com",
    projectId: "caatingasoftware",
    storageBucket: "caatingasoftware.firebasestorage.app",
    messagingSenderId: "357801806903",
    appId: "1:357801806903:web:7b03d8f9f0189bf32943b2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const portalSession = JSON.parse(localStorage.getItem("caatinga_user") || "{}");
if (!portalSession.cpf) { alert("Sessão expirada."); window.location.href = "/"; }
const tenantId = portalSession.empresa_id || "caatinga_admin"; 

const PATHS = {
    veiculos: `${tenantId}_veiculos`,
    abastecimentos: `${tenantId}_abastecimentos`,
    manutencoes: `${tenantId}_os`,
    equipe: `${tenantId}_equipe`,
    config: `${tenantId}_config`,
    rdvs: `${tenantId}_rdv`
};

let BUFFER_IMAGENS = { odo_inicial: "", odo_final: "", servicos: [], vales: [] };
let LOGO_PREFEITURA_FIXA = "";
let MOTORISTAS_SELECIONADOS_RDV = [];

let ColecaoEquipe = [];
let ColecaoFrota = [];
let ColecaoRDVs = [];

function normalizar(str) {
    if (!str) return "";
    return String(str).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

// =========================================================================
// 1. INICIALIZAÇÃO
// =========================================================================
document.addEventListener("DOMContentLoaded", async function () {
    if(document.getElementById("tenant-display-badge")) document.getElementById("tenant-display-badge").innerText = tenantId;
    
    const hoje = new Date().toISOString().split('T')[0];
    if(document.getElementById("rdv-data")) {
        document.getElementById("rdv-data").value = hoje;
        document.getElementById("rdv-data").addEventListener("change", () => {
            const placaAtual = document.getElementById("rdv-veiculo-input")?.value;
            window.SincronizarEventosDoDia(placaAtual, document.getElementById("rdv-data").value);
        });
    }
    if(document.getElementById("dash-data-pendencia")) document.getElementById("dash-data-pendencia").value = hoje;
    
    await Promise.all([ CarregarTabelaEquipe(), CarregarTabelaFrota(), CarregarHistoricoRDVs(), CarregarConfiguracoesGovernamentais() ]);
    window.SincronizarCombosETratamentos();
    window.AdicionarLinhaAbastecimento(); 
    if(document.getElementById("dash-data-pendencia")) window.VerificarPendenciasRDV(hoje);
});

window.alternarModulo = function(idModulo) {
    document.querySelectorAll(".aba-conteudo").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".nav-link").forEach(el => el.classList.remove("active"));
    document.getElementById(`view-${idModulo}`).classList.remove("hidden");
    document.getElementById(`nav-${idModulo}`).classList.add("active");
};

// =========================================================================
// 2. LÓGICA DA FROTA (TABELA LIMPA E FUNÇÃO DE EDIÇÃO/UPDATE)
// =========================================================================
async function CarregarTabelaFrota() {
    ColecaoFrota = []; 
    const snap = await getDocs(collection(db, PATHS.veiculos));
    snap.forEach(d => {
        let v = d.data();
        v.id_banco = d.id; // Guarda o ID verdadeiro do documento
        
        // Interpreta as variáveis exatas do banco do Abastecimento:
        let tipoReal = v.tipo_veiculo || v.tipo || ((v.maquina === true || v.maquina === "sim") ? "Máquina" : "Veículo");
        let propReal = v.propriedade || v.locacao || "FROTA PRÓPRIA";
        let secReal = v.secretaria || v.sec || v.orgao || "NÃO INFORMADA";
        
        v.tipo_padronizado = tipoReal;
        v.prop_padronizada = propReal;
        v.sec_padronizada = secReal;
        
        ColecaoFrota.push(v);
    });

    if(document.getElementById("dash-tot-veiculos")) {
        document.getElementById("dash-tot-veiculos").innerText = ColecaoFrota.filter(v => v.status !== "Oficina" && v.status !== "Manutenção" && v.status !== "Inativo").length;
        document.getElementById("dash-tot-oficina").innerText = ColecaoFrota.filter(v => v.status === "Oficina" || v.status === "Manutenção").length;
    }

    const setSec = new Set(), setProp = new Set(), setComb = new Set();
    ColecaoFrota.forEach(v => {
        setSec.add(v.sec_padronizada.toUpperCase()); 
        setProp.add(v.prop_padronizada.toUpperCase()); 
        setComb.add((v.combustivel || v.tipoCombustivel || "NÃO INFORMADO").toUpperCase());
    });

    const injetarOpcoes = (idSelect, conj, labelTodos) => {
        const sel = document.getElementById(idSelect);
        if(!sel) return;
        sel.innerHTML = `<option value="">${labelTodos}</option>`;
        Array.from(conj).sort().forEach(item => { sel.innerHTML += `<option value="${item}">${item}</option>`; });
    };

    injetarOpcoes('f-secretaria', setSec, 'Todas as Secretarias');
    injetarOpcoes('f-propriedade', setProp, 'Toda Propriedade');
    injetarOpcoes('f-combustivel', setComb, 'Todos os Tipos');

    window.RenderizarListaFrota();
}

window.RenderizarListaFrota = function() {
    const fSec = document.getElementById("f-secretaria")?.value.toUpperCase() || "";
    const fProp = document.getElementById("f-propriedade")?.value.toUpperCase() || "";
    const fComb = document.getElementById("f-combustivel")?.value.toUpperCase() || "";

    const tbody = document.getElementById("tbody-frota-lista");
    if(!tbody) return;
    tbody.innerHTML = "";

    const veiculosFiltrados = ColecaoFrota.filter(v => {
        if (!fSec && !fProp && !fComb) return true;
        
        const vSec = v.sec_padronizada.toUpperCase();
        const vProp = v.prop_padronizada.toUpperCase();
        const vComb = (v.combustivel || v.tipoCombustivel || "NÃO INFORMADO").toUpperCase();

        if (fSec && vSec !== fSec) return false;
        if (fProp && vProp !== fProp) return false;
        if (fComb && vComb !== fComb) return false;
        return true;
    });

    if(veiculosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-muted p-4 text-center">Nenhum veículo corresponde aos filtros.</td></tr>`;
        return;
    }

    veiculosFiltrados.forEach(v => {
        const st = v.status || v.status_operacional || 'Operando';
        const isOfi = (st.toUpperCase() === "OFICINA" || st.toUpperCase() === "MANUTENÇÃO");
        const badgeCol = isOfi ? "bg-warning text-dark" : (st.toUpperCase() === "INATIVO" ? "bg-danger" : "bg-success");
        const placaVisivel = v.placa ? v.placa.toUpperCase() : "S/N";

        tbody.innerHTML += `
            <tr>
                <td><div class="fw-bold text-dark">${placaVisivel}</div></td>
                <td><div class="fw-bold text-dark">${v.modelo || v.veiculo || 'Não informado'}</div></td>
                <td><small class="fw-bold text-secondary">${v.sec_padronizada}</small></td>
                <td><span class="badge border border-secondary text-secondary">${v.tipo_padronizado}</span></td>
                <td><small>${v.prop_padronizada}</small></td>
                <td><span class="badge bg-light text-dark border">${v.combustivel || v.tipoCombustivel || 'N/A'}</span></td>
                <td><span class="badge ${badgeCol}"><i class="fas ${isOfi ? 'fa-tools' : 'fa-check'} me-1"></i>${st}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" title="Gerar RDV" onclick="window.IrParaRDV('${placaVisivel}')"><i class="fas fa-file-invoice"></i></button>
                    <button class="btn btn-sm btn-outline-dark mx-1" title="Editar Dados" onclick="window.AbrirModalEditarVeiculo('${v.id_banco}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="Excluir" onclick="window.DeletarVeiculo('${v.id_banco}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
};

// --- FUNÇÃO PARA EDITAR E ATUALIZAR O CARRO ---
window.AbrirModalVeiculo = function() { 
    document.getElementById('form-cadastro-veiculo').reset(); 
    document.getElementById('v-id-original').value = ""; // Vazio significa 'Novo'
    document.getElementById('tituloModalVeiculo').innerText = "Cadastrar Novo Veículo";
    document.getElementById('v-placa').readOnly = false;
    new bootstrap.Modal(document.getElementById('modalVeiculo')).show(); 
};

window.AbrirModalEditarVeiculo = function(id_banco) {
    const v = ColecaoFrota.find(carro => carro.id_banco === id_banco);
    if(!v) return;
    
    document.getElementById('tituloModalVeiculo').innerText = `Editar Veículo: ${v.placa.toUpperCase()}`;
    document.getElementById('v-id-original').value = v.id_banco;
    document.getElementById('v-placa').value = v.placa;
    document.getElementById('v-placa').readOnly = true; // Não deixa mudar a placa original para não quebrar referências
    
    document.getElementById('v-tipo-frota').value = v.tipo_padronizado;
    document.getElementById('v-propriedade').value = v.prop_padronizada;
    document.getElementById('v-modelo').value = v.modelo || v.veiculo || "";
    document.getElementById('v-secretaria').value = v.sec_padronizada;
    
    // Tenta setar o combustível
    const comb = (v.combustivel || v.tipoCombustivel || "DIESEL S10").toUpperCase();
    const selC = document.getElementById('v-combustivel');
    let achouC = Array.from(selC.options).some(opt => opt.value.toUpperCase() === comb);
    if(achouC) selC.value = comb;
    
    const st = v.status || v.status_operacional || "Operando";
    document.getElementById('v-status').value = st;

    new bootstrap.Modal(document.getElementById('modalVeiculo')).show();
};

window.GravarNovoVeiculoBanco = async function() {
    const placa = document.getElementById("v-placa").value.toUpperCase().trim(); 
    if(!placa) return alert("A Placa é obrigatória!");
    
    const idExistente = document.getElementById('v-id-original').value;
    const isEdicao = idExistente !== "";
    const docIdTarget = isEdicao ? idExistente : placa; // Se for edição, grava por cima do id original
    
    const tipo = document.getElementById("v-tipo-frota").value;

    const dadosCarro = { 
        placa: placa,
        tipo_veiculo: tipo,
        maquina: (tipo === "Máquina"),
        combustivel: document.getElementById("v-combustivel").value,
        modelo: document.getElementById("v-modelo").value.toUpperCase().trim(), 
        secretaria: document.getElementById("v-secretaria").value.toUpperCase().trim(), 
        sec: document.getElementById("v-secretaria").value.toUpperCase().trim(), 
        propriedade: document.getElementById("v-propriedade").value,
        status: document.getElementById("v-status").value,
        status_operacional: document.getElementById("v-status").value
    };

    try { 
        await setDoc(doc(db, PATHS.veiculos, docIdTarget), dadosCarro, { merge: true }); // Merge garante que não apaga odômetros anteriores
        bootstrap.Modal.getInstance(document.getElementById("modalVeiculo")).hide(); 
        await CarregarTabelaFrota(); 
        window.SincronizarCombosETratamentos(); 
        alert(isEdicao ? "Dados do veículo atualizados com sucesso!" : "Novo veículo cadastrado na frota!");
    } catch(e) { alert("Erro de gravação: " + e.message); }
};
// --- FIM DA EDIÇÃO ---

window.DeletarVeiculo = async function(id_banco) { 
    if(confirm("Deseja realmente remover este veículo permanentemente da base?")) { 
        await deleteDoc(doc(db, PATHS.veiculos, id_banco)); 
        CarregarTabelaFrota(); window.SincronizarCombosETratamentos(); 
    } 
};

window.IrParaRDV = function(placa) {
    window.alternarModulo('rdv');
    setTimeout(() => {
        document.getElementById('rdv-veiculo-input').value = placa;
        window.SincronizarEventosDoDia(placa, document.getElementById('rdv-data').value);
    }, 300);
};

window.ImprimirListaFrota = function() {
    const fSec = document.getElementById("f-secretaria")?.value.toUpperCase() || "TODAS";
    const fProp = document.getElementById("f-propriedade")?.value.toUpperCase() || "TODAS";
    const fComb = document.getElementById("f-combustivel")?.value.toUpperCase() || "TODOS";

    document.getElementById("print-filtros-aplicados").innerText = `Filtros Aplicados: Secretaria [${fSec}] | Propriedade [${fProp}] | Combustível [${fComb}]`;
    const tbody = document.getElementById("print-corpo-relatorio-frota");
    tbody.innerHTML = "";

    const veiculosFiltrados = ColecaoFrota.filter(v => {
        if (!document.getElementById("f-secretaria")?.value && !document.getElementById("f-propriedade")?.value && !document.getElementById("f-combustivel")?.value) return true;
        const vSec = v.sec_padronizada.toUpperCase();
        const vProp = v.prop_padronizada.toUpperCase();
        const vComb = (v.combustivel || v.tipoCombustivel || "NÃO INFORMADO").toUpperCase();
        if (fSec !== "TODAS" && vSec !== fSec) return false;
        if (fProp !== "TODAS" && vProp !== fProp) return false;
        if (fComb !== "TODOS" && vComb !== fComb) return false;
        return true;
    });

    veiculosFiltrados.forEach(v => {
        tbody.innerHTML += `
            <tr>
                <td class="fw-bold text-dark">${v.placa ? v.placa.toUpperCase() : ''}</td>
                <td class="small fw-bold">${v.modelo || v.veiculo || '-'}</td>
                <td class="small">${v.sec_padronizada}</td>
                <td class="small">${v.tipo_padronizado}</td>
                <td class="small">${v.prop_padronizada}</td>
                <td class="small">${v.combustivel || v.tipoCombustivel || '-'}</td>
                <td class="fw-bold">${v.status || v.status_operacional || 'Operando'}</td>
            </tr>
        `;
    });

    document.getElementById('print-section').classList.add('d-none');
    document.getElementById('print-section-relatorio-frota').classList.remove('d-none');
    document.getElementById('print-section-relatorio-frota').classList.add('print-only');
    
    window.print();

    setTimeout(() => {
        document.getElementById('print-section-relatorio-frota').classList.add('d-none');
        document.getElementById('print-section-relatorio-frota').classList.remove('print-only');
        document.getElementById('print-section').classList.add('print-only');
    }, 1000);
};


// =========================================================================
// 3. EVENTOS, RDV E CRUZAMENTO DE DADOS
// =========================================================================
window.SincronizarEventosDoDia = async function(placaBusca, dataBusca) {
    if (!placaBusca || !dataBusca) return;
    const tbody = document.getElementById("corpo-rdv-abastecimentos");
    tbody.innerHTML = "";
    let achouAbast = false; 

    const placaMestraLimpa = normalizar(placaBusca);
    const dIso = dataBusca; 
    const dPt = dataBusca.split('-').reverse().join('/'); 
    const dPt2 = dataBusca.split('-').reverse().join('-'); 

    try {
        const abastSnap = await getDocs(collection(db, PATHS.abastecimentos));
        abastSnap.forEach(doc => {
            const a = doc.data();
            const placaDBLimpa = normalizar(a.placa || a.veiculo || a.veiculo_id || a.id_veiculo || "");
            const dataDB = String(a.dataAbastecimento || a.data || a.data_abastecimento || a.createdAt || "");

            if (placaDBLimpa === placaMestraLimpa && (dataDB.includes(dIso) || dataDB.includes(dPt) || dataDB.includes(dPt2))) {
                achouAbast = true;
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><input type="text" class="form-control form-control-sm bg-light fw-bold text-dark text-center" value="${a.nomePosto || 'Posto Oficial'}" readonly></td>
                    <td><input type="text" class="form-control form-control-sm bg-light text-center" value="${a.tipoCombustivel || 'Combustível'}" readonly></td>
                    <td><input type="text" class="form-control form-control-sm bg-light fw-bold text-danger text-center" value="${a.quantidade || 0}" readonly></td>
                    <td><input type="text" class="form-control form-control-sm bg-light text-center" value="${a.odometroPainel || a.odometro || ''}" readonly></td>
                    <td><input type="text" class="form-control form-control-sm bg-light fw-bold text-primary text-center" value="R$ ${a.valorTotal || 0}" readonly></td>
                    <td class="text-center"><span class="badge bg-success"><i class="fas fa-link"></i></span></td>
                `;
                tbody.appendChild(tr);
            }
        });
        if (!achouAbast) window.AdicionarLinhaAbastecimento();

        let descricoesServico = [];
        const osSnap = await getDocs(collection(db, PATHS.manutencoes)); 
        osSnap.forEach(doc => {
            const os = doc.data();
            const vOs = normalizar(os.placa || os.veiculo || "");
            const dOs = String(os.data || os.data_entrada || os.criado_em || "");
            if (vOs === placaMestraLimpa && (dOs.includes(dIso) || dOs.includes(dPt) || dOs.includes(dPt2))) {
                descricoesServico.push(`OS #${os.numero || doc.id}: ${os.descricao || os.servico_realizado || 'Manutenção faturada'}`);
            }
        });

        const v = ColecaoFrota.find(veh => normalizar(veh.placa) === placaMestraLimpa);
        const statusGeralVeiculo = v ? (v.status || v.status_operacional || "Operando") : "Operando";

        const txtOficina = document.getElementById("rdv-oficina-descricao");
        const cbOficina = document.getElementById("rdv-veiculo-oficina");

        if (descricoesServico.length > 0) {
            cbOficina.checked = true; window.AlternarCamposOficina(true);
            txtOficina.value = "SERVIÇOS DE OFICINA IMPORTADOS:\n" + descricoesServico.join("\n");
            txtOficina.readOnly = true; 
        } else if (statusGeralVeiculo.toUpperCase() === "OFICINA" || statusGeralVeiculo.toUpperCase() === "MANUTENÇÃO") {
            cbOficina.checked = true; window.AlternarCamposOficina(true);
            txtOficina.value = `Aviso: O status do veículo consta como '${statusGeralVeiculo}', mas nenhuma OS foi localizada na data selecionada.`;
            txtOficina.readOnly = false; 
        } else {
            cbOficina.checked = false; window.AlternarCamposOficina(false);
            txtOficina.value = ""; txtOficina.readOnly = false;
        }

    } catch (e) {
        console.warn("Aviso na Sincronização:", e);
        if(!achouAbast) window.AdicionarLinhaAbastecimento();
    }
};

window.SincronizarCombosETratamentos = function() {
    const contVeiculo = document.getElementById("rdv-veiculo-busca-container");
    if(contVeiculo) {
        contVeiculo.innerHTML = `
            <label class="form-label fw-bold">Buscar Veículo</label>
            <input type="text" id="rdv-veiculo-input" class="form-control border-primary shadow-sm" placeholder="Digite a Placa..." autocomplete="off"
                   onkeyup="window.FiltrarLista('veiculo', this.value)" onclick="window.FiltrarLista('veiculo', '')">
            <div id="dropdown-veiculos" class="list-group position-absolute w-100 hidden shadow-lg" style="z-index:999; max-height:250px; overflow-y:auto; top:70px;"></div>
        `;
    }
    const contRota = document.getElementById("rdv-rota-busca-container");
    if(contRota) {
        contRota.innerHTML = `
            <label class="form-label fw-bold">Rota / Destino</label>
            <input type="text" id="rdv-rota-input" class="form-control border-primary shadow-sm" placeholder="Digite ou selecione a rota..." autocomplete="off"
                   onkeyup="window.FiltrarLista('rota', this.value)" onclick="window.FiltrarLista('rota', '')">
            <div id="dropdown-rotas" class="list-group position-absolute w-100 hidden shadow-lg" style="z-index:999; max-height:200px; overflow-y:auto; top:70px;"></div>
        `;
    }
};

window.FiltrarLista = function(tipo, termo) {
    const isVeiculo = tipo === 'veiculo';
    const lista = isVeiculo ? ColecaoFrota : ["Sede Central", "Deslocamento Distrito", "Viagem Intermunicipal", "Rota Rural", "Ronda Escolar", "Transporte Pacientes"];
    const dropdown = document.getElementById(isVeiculo ? "dropdown-veiculos" : "dropdown-rotas");
    
    dropdown.innerHTML = ""; dropdown.classList.remove("hidden");
    const filtrados = lista.filter(item => {
        const str = isVeiculo ? `${item.placa} ${item.modelo || item.veiculo || ''}` : item;
        return normalizar(str).includes(normalizar(termo));
    });

    if(filtrados.length === 0) dropdown.innerHTML = `<div class="list-group-item text-muted small">Nenhum resultado...</div>`;
    
    filtrados.forEach(item => {
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "list-group-item list-group-item-action fw-bold";
        btn.innerHTML = isVeiculo ? `<span class="text-primary">${item.placa ? item.placa.toUpperCase() : ''}</span> <br><small class="text-muted fw-normal">${item.modelo || item.veiculo || ''}</small>` : item;
        
        btn.onclick = () => {
            document.getElementById(isVeiculo ? "rdv-veiculo-input" : "rdv-rota-input").value = isVeiculo ? item.placa.toUpperCase() : item;
            dropdown.classList.add("hidden");
            if(isVeiculo) window.SincronizarEventosDoDia(item.placa, document.getElementById("rdv-data").value);
        };
        dropdown.appendChild(btn);
    });

    document.addEventListener("click", function hideMenu(e) {
        if(!e.target.closest(`#${isVeiculo ? 'rdv-veiculo-busca-container' : 'rdv-rota-busca-container'}`)) {
            dropdown.classList.add("hidden");
            document.removeEventListener("click", hideMenu);
        }
    });
};

// =========================================================================
// 4. MÉTODOS GERAIS DE EQUIPE E DASHBOARD
// =========================================================================
window.VerificarPendenciasRDV = function(dataAlvo) {
    if(!dataAlvo) return;
    const rdvsDoDia = ColecaoRDVs.filter(r => r.data === dataAlvo);
    const placasHomologadas = rdvsDoDia.map(r => normalizar(r.veiculo));

    const ulGerados = document.getElementById("lista-rdvs-gerados");
    const ulPendentes = document.getElementById("lista-rdvs-pendentes");
    if(!ulGerados || !ulPendentes) return; 
    
    ulGerados.innerHTML = ""; ulPendentes.innerHTML = "";
    let qG = 0, qP = 0;

    ColecaoFrota.forEach(v => {
        const placaL = normalizar(v.placa);
        if (placasHomologadas.includes(placaL)) {
            ulGerados.innerHTML += `<li class="list-group-item py-2 border-bottom"><i class="fas fa-check-circle text-success me-2"></i><strong class="text-dark">${v.placa ? v.placa.toUpperCase() : ''}</strong></li>`;
            qG++;
        } else {
            const st = v.status || v.status_operacional || 'Operando';
            const isInOficina = (st.toUpperCase() === 'OFICINA' || st.toUpperCase() === 'MANUTENÇÃO');
            const badgeOfi = isInOficina ? `<span class="badge bg-warning text-dark float-end"><i class="fas fa-tools"></i> Oficina</span>` : "";
            const bgClass = isInOficina ? "list-group-item-light text-muted" : "";
            const icon = isInOficina ? "fa-wrench" : "fa-exclamation-triangle text-danger";
            
            ulPendentes.innerHTML += `<li class="list-group-item ${bgClass} py-2 border-bottom bg-transparent"><i class="fas ${icon} me-2"></i><strong class="text-dark">${v.placa ? v.placa.toUpperCase() : ''}</strong> ${badgeOfi}</li>`;
            if(!isInOficina) qP++; 
        }
    });
    document.getElementById("qtd-gerados").innerText = qG; document.getElementById("qtd-pendentes").innerText = qP;
};

async function CarregarTabelaEquipe() {
    ColecaoEquipe = []; const snap = await getDocs(collection(db, PATHS.equipe));
    snap.forEach(d => ColecaoEquipe.push({ id: d.id, ...d.data() }));
    const tbody = document.getElementById("tabela-corpo-equipe");
    if(tbody) {
        tbody.innerHTML = "";
        ColecaoEquipe.forEach(e => tbody.innerHTML += `<tr><td class="fw-bold">${e.nome}</td><td>${e.doc}</td><td><span class="badge bg-dark">${e.cargo}</span></td><td><span class="text-success fw-bold"><i class="fas fa-check-circle me-1"></i>${e.status}</span></td><td><button class="btn btn-sm btn-outline-danger" onclick="window.DeletarColaborador('${e.id}')"><i class="fas fa-trash"></i></button></td></tr>`);
    }
}

async function CarregarHistoricoRDVs() {
    ColecaoRDVs = []; const snap = await getDocs(collection(db, PATHS.rdvs));
    snap.forEach(d => ColecaoRDVs.push({ id: d.id, ...d.data() }));
    ColecaoRDVs.sort((a,b) => new Date(b.data) - new Date(a.data)); 
    
    const container = document.getElementById("lista-rdvs-recentes");
    if(container) {
        container.innerHTML = "";
        if(ColecaoRDVs.length === 0) container.innerHTML = `<div class="text-center p-4 text-muted small"><i class="fas fa-folder-open d-block fs-3 mb-2"></i>Nenhum RDV gravado.</div>`;
        else ColecaoRDVs.forEach(r => container.innerHTML += `<div class="list-group-item p-3 border rounded mb-2 bg-white"><div class="d-flex justify-content-between align-items-center mb-1"><strong class="text-primary"><i class="fas fa-file-pdf me-1"></i>Placa: ${r.veiculo}</strong><span class="badge bg-success small">${r.status}</span></div><div class="small text-muted"><strong>Data:</strong> ${r.data.split('-').reverse().join('/')} | <strong>Rota:</strong> ${r.rota}</div></div>`);
        if(document.getElementById("dash-tot-rdv")) document.getElementById("dash-tot-rdv").innerText = ColecaoRDVs.length;
    }
}

async function CarregarConfiguracoesGovernamentais() {
    const snap = await getDoc(doc(db, PATHS.config, "identidade_oficial"));
    if(snap.exists()) {
        const c = snap.data();
        document.getElementById("cfg-prefeitura-nome").value = c.nome_prefeitura || "";
        document.getElementById("cfg-prefeitura-secretaria").value = c.secretaria || "";
        document.getElementById("cfg-prefeitura-setor").value = c.setor || "";
        if(c.logo_base64) { LOGO_PREFEITURA_FIXA = c.logo_base64; document.getElementById("cfg-prefeitura-logo-preview").src = LOGO_PREFEITURA_FIXA; }
    }
}

// =========================================================================
// 5. RESTANTES WRITES DO FIREBASE
// =========================================================================
window.GravarNovoColaboradorBanco = async function() {
    const nome = document.getElementById("eq-nome").value; const docIdent = document.getElementById("eq-documento").value; const cargo = document.getElementById("eq-cargo").value;
    if(!nome || !docIdent) return alert("Preencha todos os dados!");
    try { await setDoc(doc(db, PATHS.equipe, `EQ-${Date.now()}`), { id: `EQ-${Date.now()}`, nome, doc: docIdent, cargo, status: "Ativo" }); bootstrap.Modal.getInstance(document.getElementById("modalMembroEquipe")).hide(); await CarregarTabelaEquipe(); } catch(e) { alert("Erro: " + e.message); }
};

window.SalvarConfiguracoesGovernamentais = async function() {
    try { await setDoc(doc(db, PATHS.config, "identidade_oficial"), { nome_prefeitura: document.getElementById("cfg-prefeitura-nome").value, secretaria: document.getElementById("cfg-prefeitura-secretaria").value, setor: document.getElementById("cfg-prefeitura-setor").value, logo_base64: LOGO_PREFEITURA_FIXA }, {merge: true}); alert("Configuração Governamental salva com sucesso."); } catch(e) { alert("Erro: " + e.message); }
};

window.DeletarColaborador = async function(id) { if(confirm("Deseja excluir este colaborador?")) { await deleteDoc(doc(db, PATHS.equipe, id)); CarregarTabelaEquipe(); } };
window.AbrirModalMembroEquipe = function() { document.getElementById('form-cadastro-equipe').reset(); new bootstrap.Modal(document.getElementById('modalMembroEquipe')).show(); };


// =========================================================================
// 6. LÓGICA DE FOTOS E CONDUTORES (RDV)
// =========================================================================
window.TratarMedidorDefeito = function(isDefeituoso) {
    const ti = document.getElementById("rdv-odo-inicial"); const tf = document.getElementById("rdv-odo-final");
    ti.disabled = isDefeituoso; tf.disabled = isDefeituoso; ti.value = isDefeituoso ? "" : ti.value; tf.value = isDefeituoso ? "" : tf.value;
    ti.placeholder = isDefeituoso ? "DEFEITO" : "Medidor Início"; tf.placeholder = isDefeituoso ? "DEFEITO" : "Medidor Final";
    document.querySelectorAll(".abast-odo-evt").forEach(el => { el.value = isDefeituoso ? "" : el.value; el.disabled = isDefeituoso; el.placeholder = isDefeituoso ? "DEFEITO" : "Atual"; });
};

window.AlternarCamposOficina = function(isN) { const a = document.getElementById("rdv-oficina-descricao"); if(isN) { a.focus(); a.classList.add("border-warning"); } else a.classList.remove("border-warning"); };
window.ProcessarImagemUnica = function(inp, id) { const f = inp.files[0]; if(!f) return; const r = new FileReader(); r.onload = e => { document.getElementById(id).src = e.target.result; if(id==='preview-odo-ini') BUFFER_IMAGENS.odo_inicial = e.target.result; if(id==='preview-odo-fim') BUFFER_IMAGENS.odo_final = e.target.result; }; r.readAsDataURL(f); };
window.ProcessarLogoPrefeituraFixa = function(inp) { const f = inp.files[0]; if(!f) return; const r = new FileReader(); r.onload = e => { LOGO_PREFEITURA_FIXA = e.target.result; document.getElementById("cfg-prefeitura-logo-preview").src = e.target.result; }; r.readAsDataURL(f); };

window.ProcessarImagensMultiplas = function(inp, galleryId, arrayKey) {
    const files = inp.files; if(!files || files.length === 0) return;
    const galeria = document.getElementById(galleryId);
    Array.from(files).forEach(file => { const r = new FileReader(); r.onload = e => { const src = e.target.result; BUFFER_IMAGENS[arrayKey].push(src); galeria.innerHTML += `<div class="position-relative d-inline-block m-1"><img src="${src}" class="img-galeria shadow-sm"></div>`; }; r.readAsDataURL(file); });
    inp.value = "";
};
window.LimparGaleria = function(galleryId, arrayKey) { document.getElementById(galleryId).innerHTML = ""; BUFFER_IMAGENS[arrayKey] = []; };

window.BuscarMotoristaListaInteligente = function(tb) {
    const dp = document.getElementById("lista-inteligente-dropdown"); if (!tb.trim()) { dp.classList.add("hidden"); return; }
    dp.innerHTML = ""; const fs = ColecaoEquipe.filter(m => m.cargo === "Motorista" && m.nome.toLowerCase().includes(tb.toLowerCase()));
    fs.forEach(m => { const btn = document.createElement("button"); btn.type = "button"; btn.className = "list-group-item list-group-item-action fw-bold"; btn.innerHTML = `<i class="fas fa-user-check text-success me-2"></i>${m.nome}`; btn.onclick = () => { window.AdicionarMotoristaAoRDV(m); dp.classList.add("hidden"); document.getElementById("rdv-motorista-busca").value = ""; }; dp.appendChild(btn); });
    if (!ColecaoEquipe.some(m => m.nome.toLowerCase() === tb.toLowerCase())) { const bq = document.createElement("button"); bq.type = "button"; bq.className = "list-group-item list-group-item-warning fw-bold"; bq.innerHTML = `<i class="fas fa-bolt me-2"></i>Criar "${tb}" rápido`; bq.onclick = () => { dp.classList.add("hidden"); document.getElementById("eq-nome").value = tb; document.getElementById("eq-cargo").value = "Motorista"; window.AbrirModalMembroEquipe(); }; dp.appendChild(bq); }
    dp.classList.remove("hidden");
};

window.AdicionarMotoristaAoRDV = function(m) { if(!MOTORISTAS_SELECIONADOS_RDV.some(x => x.id === m.id)) { MOTORISTAS_SELECIONADOS_RDV.push(m); renderTags(); } };
window.RemoverMotoristaDoRDV = function(id) { MOTORISTAS_SELECIONADOS_RDV = MOTORISTAS_SELECIONADOS_RDV.filter(m => m.id !== id); renderTags(); };
function renderTags() { const c = document.getElementById("container-motoristas-tags"); c.innerHTML = ""; if(MOTORISTAS_SELECIONADOS_RDV.length === 0) c.innerHTML = `<span class="text-muted small">Nenhum condutor.</span>`; else MOTORISTAS_SELECIONADOS_RDV.forEach(m => c.innerHTML += `<span class="driver-tag"><i class="fas fa-id-card text-primary me-1"></i> ${m.nome} <i class="fas fa-times-circle" onclick="window.RemoverMotoristaDoRDV('${m.id}')"></i></span>`); }
window.AdicionarLinhaAbastecimento = function() { const tb = document.getElementById("corpo-rdv-abastecimentos"); const tr = document.createElement("tr"); const dis = document.getElementById("rdv-medidor-defeito").checked ? "disabled placeholder='DEFEITO'" : "placeholder='Odo.'"; tr.innerHTML = `<td><input type="text" class="form-control form-control-sm abast-posto text-center" placeholder="Posto"></td><td><select class="form-select form-select-sm abast-comb text-center"><option>DIESEL S10</option><option>GASOLINA</option><option>ETANOL</option></select></td><td><input type="number" class="form-control form-control-sm abast-litros text-center" placeholder="L/M³"></td><td><input type="number" class="form-control form-control-sm abast-odo-evt text-center" ${dis}></td><td><input type="text" class="form-control form-control-sm abast-valor text-center" placeholder="R$"></td><td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('tr').remove()"><i class="fas fa-trash"></i></button></td>`; tb.appendChild(tr); };


// =========================================================================
// 7. GERAÇÃO DE PDF E FINALIZAÇÃO DO RDV
// =========================================================================
window.CompilarERenderizarPDF_Prefeitura = function() {
    const placa = document.getElementById("rdv-veiculo-input")?.value; if(!placa) return alert("Selecione a Placa do Veículo primeiro.");
    const v = ColecaoFrota.find(veh => normalizar(veh.placa) === normalizar(placa)) || {placa: placa, prefixo: "---"};
    
    document.getElementById("print-pdf-logo").src = LOGO_PREFEITURA_FIXA || "";
    document.getElementById("print-pdf-pref-nome").innerText = document.getElementById("cfg-prefeitura-nome").value || "PREFEITURA MUNICIPAL";
    document.getElementById("print-pdf-sec-nome").innerText = document.getElementById("cfg-prefeitura-secretaria").value || "SECRETARIA GESTORA";
    document.getElementById("print-pdf-setor-nome").innerText = document.getElementById("cfg-prefeitura-setor").value || "SETOR DE FROTAS";
    document.getElementById("print-pdf-data").innerText = document.getElementById("rdv-data").value.split('-').reverse().join('/');
    document.getElementById("print-pdf-placa").innerText = v.placa ? v.placa.toUpperCase() : ''; 
    document.getElementById("print-pdf-itinerario").innerText = document.getElementById("rdv-rota-input").value || "OPERAÇÃO PADRÃO";

    const defeito = document.getElementById("rdv-medidor-defeito").checked;
    document.getElementById("print-pdf-odo-ini").innerText = defeito ? "---" : (document.getElementById("rdv-odo-inicial").value || "N/A");
    document.getElementById("print-pdf-odo-fim").innerText = defeito ? "---" : (document.getElementById("rdv-odo-final").value || "N/A");

    const tbm = document.getElementById("print-pdf-corpo-motoristas"); tbm.innerHTML = "";
    if(MOTORISTAS_SELECIONADOS_RDV.length === 0) tbm.innerHTML = "<tr><td colspan='3' class='text-center'>Nenhum condutor registado.</td></tr>"; 
    else MOTORISTAS_SELECIONADOS_RDV.forEach(m => tbm.innerHTML += `<tr><td><strong>${m.nome}</strong></td><td>CPF/CNH: ${m.doc}</td><td>Autorizado</td></tr>`);

    const tba = document.getElementById("print-pdf-corpo-abastecimentos"); tba.innerHTML = ""; let hAbast = false;
    document.querySelectorAll("#corpo-rdv-abastecimentos tr").forEach(tr => {
        const p = tr.querySelector(".abast-posto")?.value || tr.querySelector("input").value; 
        if(p) { hAbast = true; tba.innerHTML += `<tr><td>${p}</td><td>${tr.querySelector(".abast-comb")?.value || tr.querySelectorAll("input")[1].value}</td><td class="text-danger fw-bold">${tr.querySelector(".abast-litros")?.value || tr.querySelectorAll("input")[2].value} L</td><td>${tr.querySelector(".abast-odo-evt")?.value || tr.querySelectorAll("input")[3].value || "N/A"}</td><td class="text-primary fw-bold">${tr.querySelector(".abast-valor")?.value || tr.querySelectorAll("input")[4].value}</td></tr>`; }
    });
    if(!hAbast) tba.innerHTML = "<tr><td colspan='5' class='text-center'>Sem movimentação de abastecimento.</td></tr>";

    const isOfi = document.getElementById("rdv-veiculo-oficina").checked;
    document.getElementById("print-pdf-oficina-txt").innerHTML = isOfi ? `<strong>Ocorrências:</strong> ${document.getElementById("rdv-oficina-descricao").value}` : "Veículo em operação normal.";

    const galeriaPDF = document.getElementById("print-pdf-galeria-dinamica"); galeriaPDF.innerHTML = "";
    if(BUFFER_IMAGENS.odo_inicial) galeriaPDF.innerHTML += `<div class="text-center m-1" style="width:23%; display:inline-block;"><img src="${BUFFER_IMAGENS.odo_inicial}" style="width:100%; height:120px; object-fit:contain; border:1px solid #ccc;"><div style="font-size:7pt; margin-top:2px;">Odo Inicial</div></div>`;
    if(BUFFER_IMAGENS.odo_final) galeriaPDF.innerHTML += `<div class="text-center m-1" style="width:23%; display:inline-block;"><img src="${BUFFER_IMAGENS.odo_final}" style="width:100%; height:120px; object-fit:contain; border:1px solid #ccc;"><div style="font-size:7pt; margin-top:2px;">Odo Final</div></div>`;
    BUFFER_IMAGENS.servicos.forEach((src, i) => { galeriaPDF.innerHTML += `<div class="text-center m-1" style="width:23%; display:inline-block;"><img src="${src}" style="width:100%; height:120px; object-fit:contain; border:1px solid #ccc;"><div style="font-size:7pt; margin-top:2px;">Serviço/Trajeto ${i+1}</div></div>`; });
    BUFFER_IMAGENS.vales.forEach((src, i) => { galeriaPDF.innerHTML += `<div class="text-center m-1" style="width:23%; display:inline-block;"><img src="${src}" style="width:100%; height:120px; object-fit:contain; border:1px solid #ccc;"><div style="font-size:7pt; margin-top:2px;">Vale/Cupom ${i+1}</div></div>`; });
    if(galeriaPDF.innerHTML === "") galeriaPDF.innerHTML = "<div class='text-center w-100 p-3 text-muted'>Sem registos fotográficos anexados nesta data.</div>";

    const cAss = document.getElementById("print-pdf-container-assinaturas"); cAss.innerHTML = "";
    const addA = (n,c) => cAss.innerHTML += `<div class="col-4 mb-4 text-center d-inline-block" style="width:32%; vertical-align:bottom;"><div style="border-top:1px solid black; margin:40px auto 4px auto; width:90%;"></div><strong>${n}</strong><br><span style="font-size:7pt;">${c}</span></div>`;
    MOTORISTAS_SELECIONADOS_RDV.forEach(m => addA(m.nome, `Condutor`));
    if(!isOfi) addA(ColecaoEquipe.find(e => e.cargo === "Fiscal de Transporte")?.nome || "Fiscalização", "Fiscal de Rota");
    if(hAbast) addA(ColecaoEquipe.find(e => e.cargo === "Gestor de Abastecimento")?.nome || "Responsável Posto", "Gestão de Abastecimento");
    if(isOfi) addA(ColecaoEquipe.find(e => e.cargo === "Gestor de Frota")?.nome || "Chefe de Oficina", "Gestão de Manutenção");

    document.getElementById('print-section-relatorio-frota').classList.add('d-none');
    document.getElementById('print-section').classList.remove('d-none');
    window.print();
};

window.FinalizarRDVEPurgarMidia = async function() {
    const placa = document.getElementById("rdv-veiculo-input")?.value; if(!placa) return alert("Selecione um veículo válido");
    if(confirm("Deseja gravar o Relatório Diário e limpar os anexos pesados da memória?")) {
        const idRdv = `RDV-${Date.now()}`;
        try {
            await setDoc(doc(db, PATHS.rdvs, idRdv), { id: idRdv, veiculo: placa, data: document.getElementById("rdv-data").value, rota: document.getElementById("rdv-rota-input").value, odo_inicial: document.getElementById("rdv-odo-inicial").value, odo_final: document.getElementById("rdv-odo-final").value, medidor_defeito: document.getElementById("rdv-medidor-defeito").checked, oficina: document.getElementById("rdv-veiculo-oficina").checked, status: "Homologado", autor: portalSession.cpf });
            alert("RDV gravado com sucesso!"); window.LimparFormularioRDV(); await CarregarHistoricoRDVs(); window.VerificarPendenciasRDV(document.getElementById("dash-data-pendencia").value); window.alternarModulo('dashboard');
        } catch(e) { alert("Erro: " + e.message); }
    }
};

window.LimparFormularioRDV = function() {
    document.getElementById("form-master-rdv").reset(); document.getElementById("rdv-veiculo-busca-container").innerHTML = ""; document.getElementById("rdv-rota-busca-container").innerHTML = "";
    window.SincronizarCombosETratamentos(); document.getElementById("rdv-data").value = new Date().toISOString().split('T')[0];
    MOTORISTAS_SELECIONADOS_RDV = []; renderTags(); document.getElementById("corpo-rdv-abastecimentos").innerHTML = "";
    window.TratarMedidorDefeito(false); window.AdicionarLinhaAbastecimento();
    BUFFER_IMAGENS = { odo_inicial: "", odo_final: "", servicos: [], vales: [] };
    ["preview-odo-ini", "preview-odo-fim"].forEach(i => document.getElementById(i).src = "");
    ["galeria-servicos", "galeria-vales"].forEach(i => document.getElementById(i).innerHTML = "");
};
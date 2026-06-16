import { db } from './firebase-env.js';
import { doc, getDocs, setDoc, collection } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.SincronizarEventosDoDia = async function(placaBusca, dataBusca) {
    if (!placaBusca || !dataBusca) return;
    
    const tbody = document.getElementById("corpo-rdv-abastecimentos"); 
    if (tbody) tbody.innerHTML = "";
    
    let achouAbast = false; 

    const placaMestraLimpa = window.normalizar(placaBusca);
    const dIso = dataBusca; 
    const dPt = dataBusca.split('-').reverse().join('/'); 
    const dPt2 = dataBusca.split('-').reverse().join('-'); 

    try {
        const abastSnap = await getDocs(collection(db, window.PATHS.abastecimentos));
        abastSnap.forEach(doc => {
            const a = doc.data();
            const placaDBLimpa = window.normalizar(a.placa || a.veiculo || a.veiculo_id || a.id_veiculo || "");
            const dataDB = String(a.dataAbastecimento || a.data || a.data_abastecimento || a.createdAt || "");

            if (placaDBLimpa === placaMestraLimpa && (dataDB.includes(dIso) || dataDB.includes(dPt) || dataDB.includes(dPt2))) {
                achouAbast = true;
                if (tbody) {
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
            }
        });
        
        if (!achouAbast && typeof window.AdicionarLinhaAbastecimento === 'function') {
            window.AdicionarLinhaAbastecimento();
        }

        let descricoesServico = [];
        const osSnap = await getDocs(collection(db, window.PATHS.manutencoes)); 
        osSnap.forEach(doc => {
            const os = doc.data(); 
            const vOs = window.normalizar(os.placa || os.veiculo || ""); 
            const dOs = String(os.data || os.data_entrada || os.criado_em || "");
            if (vOs === placaMestraLimpa && (dOs.includes(dIso) || dOs.includes(dPt) || dOs.includes(dPt2))) { 
                descricoesServico.push(`OS #${os.numero || doc.id}: ${os.descricao || os.servico_realizado || 'Manutenção faturada'}`); 
            }
        });

        const v = window.ColecaoFrota.find(veh => window.normalizar(veh.placa) === placaMestraLimpa);
        const statusGeralVeiculo = v ? (v.status || v.status_operacional || "Operando") : "Operando";
        const txtOficina = document.getElementById("rdv-oficina-descricao");
        const cbOficina = document.getElementById("rdv-veiculo-oficina");

        if (descricoesServico.length > 0) {
            if(cbOficina) cbOficina.checked = true; 
            if(window.AlternarCamposOficina) window.AlternarCamposOficina(true);
            if(txtOficina) {
                txtOficina.value = "SERVIÇOS DE OFICINA IMPORTADOS:\n" + descricoesServico.join("\n"); 
                txtOficina.readOnly = true; 
            }
        } else if (statusGeralVeiculo.toUpperCase() === "OFICINA" || statusGeralVeiculo.toUpperCase() === "MANUTENÇÃO") {
            if(cbOficina) cbOficina.checked = true; 
            if(window.AlternarCamposOficina) window.AlternarCamposOficina(true);
            if(txtOficina) {
                txtOficina.value = `Aviso: O status do veículo consta como '${statusGeralVeiculo}', mas nenhuma OS foi localizada na data selecionada.`; 
                txtOficina.readOnly = false; 
            }
        } else {
            if(cbOficina) cbOficina.checked = false; 
            if(window.AlternarCamposOficina) window.AlternarCamposOficina(false);
            if(txtOficina) {
                txtOficina.value = ""; 
                txtOficina.readOnly = false;
            }
        }
    } catch (e) { 
        console.warn("Aviso na Sincronização:", e); 
        if(!achouAbast && typeof window.AdicionarLinhaAbastecimento === 'function') window.AdicionarLinhaAbastecimento(); 
    }
};

window.FiltrarLista = function(tipo, termo) {
    const isVeiculo = tipo === 'veiculo';
    const lista = isVeiculo ? window.ColecaoFrota : ["Sede Central", "Deslocamento Distrito", "Viagem Intermunicipal", "Rota Rural", "Ronda Escolar", "Transporte Pacientes"];
    const dropdown = document.getElementById(isVeiculo ? "dropdown-veiculos" : "dropdown-rotas");
    
    if(!dropdown) return;
    
    dropdown.innerHTML = ""; dropdown.classList.remove("hidden");
    const filtrados = lista.filter(item => {
        const str = isVeiculo ? `${item.placa} ${item.modelo || item.veiculo || ''}` : item;
        return window.normalizar(str).includes(window.normalizar(termo));
    });

    if(filtrados.length === 0) dropdown.innerHTML = `<div class="list-group-item text-muted small">Nenhum resultado...</div>`;
    
    filtrados.forEach(item => {
        const btn = document.createElement("button"); btn.type = "button"; btn.className = "list-group-item list-group-item-action fw-bold";
        btn.innerHTML = isVeiculo ? `<span class="text-primary">${item.placa ? item.placa.toUpperCase() : ''}</span> <br><small class="text-muted fw-normal">${item.modelo || item.veiculo || ''}</small>` : item;
        btn.onclick = () => {
            let elInput = document.getElementById(isVeiculo ? "rdv-veiculo-input" : "rdv-rota-input");
            if(elInput) elInput.value = isVeiculo ? item.placa.toUpperCase() : item;
            
            dropdown.classList.add("hidden");
            
            if(isVeiculo) {
                let elData = document.getElementById("rdv-data");
                if(elData) window.SincronizarEventosDoDia(item.placa, elData.value);
            }
        };
        dropdown.appendChild(btn);
    });

    document.addEventListener("click", function hideMenu(e) {
        if(!e.target.closest(`#${isVeiculo ? 'rdv-veiculo-busca-container' : 'rdv-rota-busca-container'}`)) {
            dropdown.classList.add("hidden"); document.removeEventListener("click", hideMenu);
        }
    });
};

window.BuscarMotoristaListaInteligente = function(tb) {
    const dp = document.getElementById("lista-inteligente-dropdown"); 
    if (!dp) return;
    
    if (!tb.trim()) { dp.classList.add("hidden"); return; }
    
    dp.innerHTML = ""; 
    const fs = window.ColecaoEquipe.filter(m => m.cargo === "Motorista" && m.nome.toLowerCase().includes(tb.toLowerCase()));
    
    fs.forEach(m => { 
        const btn = document.createElement("button"); btn.type = "button"; btn.className = "list-group-item list-group-item-action fw-bold"; btn.innerHTML = `<i class="fas fa-user-check text-success me-2"></i>${m.nome}`; 
        btn.onclick = () => { 
            if(window.AdicionarMotoristaAoRDV) window.AdicionarMotoristaAoRDV(m); 
            dp.classList.add("hidden"); 
            let elBusca = document.getElementById("rdv-motorista-busca");
            if(elBusca) elBusca.value = ""; 
        }; 
        dp.appendChild(btn); 
    });
    
    if (!window.ColecaoEquipe.some(m => m.nome.toLowerCase() === tb.toLowerCase())) { 
        const bq = document.createElement("button"); bq.type = "button"; bq.className = "list-group-item list-group-item-warning fw-bold"; bq.innerHTML = `<i class="fas fa-bolt me-2"></i>Criar "${tb}" rápido`; 
        bq.onclick = () => { 
            dp.classList.add("hidden"); 
            let elCadNome = document.getElementById("cadMotNome"); if(elCadNome) elCadNome.value = tb; 
            let elCadCargo = document.getElementById("cadMotCargo"); if(elCadCargo) elCadCargo.value = "MOTORISTA"; 
            if(window.AbrirModalMembroEquipe) window.AbrirModalMembroEquipe(); 
        }; 
        dp.appendChild(bq); 
    }
    dp.classList.remove("hidden");
};

// ... Todas as funções auxiliares de PDF, Galeria e TratarMedidorDefeito entram aqui perfeitamente seguindo a arquitetura exportada!

window.TratarMedidorDefeito = function(isDefeituoso) {
    const ti = document.getElementById("rdv-odo-inicial"); 
    const tf = document.getElementById("rdv-odo-final");
    
    if(ti) {
        ti.disabled = isDefeituoso; 
        ti.value = isDefeituoso ? "" : ti.value;
        ti.placeholder = isDefeituoso ? "DEFEITO" : "Medidor Início"; 
    }
    
    if(tf) {
        tf.disabled = isDefeituoso; 
        tf.value = isDefeituoso ? "" : tf.value;
        tf.placeholder = isDefeituoso ? "DEFEITO" : "Medidor Final";
    }
    
    document.querySelectorAll(".abast-odo-evt").forEach(el => { 
        el.value = isDefeituoso ? "" : el.value; 
        el.disabled = isDefeituoso; 
        el.placeholder = isDefeituoso ? "DEFEITO" : "Atual"; 
    });
};

window.FinalizarRDVEPurgarMidia = async function() {
    let elPlaca = document.getElementById("rdv-veiculo-input");
    const placa = elPlaca ? elPlaca.value : null; 
    
    if(!placa) return alert("Selecione um veículo válido");
    
    if(confirm("Deseja gravar o Relatório Diário e limpar os anexos pesados da memória?")) {
        const idRdv = `RDV-${Date.now()}`;
        try {
            let elData = document.getElementById("rdv-data");
            let elRota = document.getElementById("rdv-rota-input");
            let elOdoIni = document.getElementById("rdv-odo-inicial");
            let elOdoFin = document.getElementById("rdv-odo-final");
            let cbDefeito = document.getElementById("rdv-medidor-defeito");
            let cbOficina = document.getElementById("rdv-veiculo-oficina");

            await setDoc(doc(db, window.PATHS.rdvs, idRdv), { 
                id: idRdv, 
                veiculo: placa, 
                data: elData ? elData.value : new Date().toISOString().split('T')[0], 
                rota: elRota ? elRota.value : '', 
                odo_inicial: elOdoIni ? elOdoIni.value : '', 
                odo_final: elOdoFin ? elOdoFin.value : '', 
                medidor_defeito: cbDefeito ? cbDefeito.checked : false, 
                oficina: cbOficina ? cbOficina.checked : false, 
                status: "Homologado", 
                autor: window.USUARIO.cpf 
            });
            
            alert("RDV gravado com sucesso!"); 
            if(window.LimparFormularioRDV) window.LimparFormularioRDV(); 
            await window.buscarTudo(); 
            if(window.alternarModulo) window.alternarModulo('dashboard');
        } catch(e) { 
            alert("Erro: " + e.message); 
        }
    }
};
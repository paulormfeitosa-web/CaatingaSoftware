import { db } from './firebase-env.js';
import { doc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- GATILHO E SINCRONIZAÇÃO GERAL DO RDV ---

window.AcionarSincronizacaoRDV = function() {
    let placa = document.getElementById("rdv-veiculo-input")?.value;
    let data = document.getElementById("rdv-data")?.value;
    if (placa && data) window.SincronizarEventosDoDia(placa, data);
};

window.SincronizarEventosDoDia = async function(placaBusca, dataBusca) {
    if (!placaBusca || !dataBusca) return;
    
    const tbody = document.getElementById("corpo-rdv-abastecimentos"); 
    if (tbody) tbody.innerHTML = "";
    let achouAbast = false; 
    
    const norm = str => String(str).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const placaMestraLimpa = norm(placaBusca);
    
    const dIso = dataBusca; 
    const dPt = dataBusca.split('-').reverse().join('/'); 
    const dPt2 = dataBusca.split('-').reverse().join('-'); 

    try {
        let todosAbastecimentos = window.DADOS_ABASTECIMENTOS || [];
        if (todosAbastecimentos.length === 0) {
            const snap = await getDocs(collection(db, `${window.tenant}_abastecimentos`));
            todosAbastecimentos = snap.docs.map(d => d.data());
        }
        
        const abastecimentosDoDia = todosAbastecimentos.filter(a => {
            const placaDB = norm(a.placa || a.veiculo || a.veiculo_id || "");
            const dataDB = String(a.dataAbastecimento || a.data || a.data_abastecimento || a.createdAt || "");
            const status = String(a.status || "").toLowerCase();
            const statusLimpo = status.normalize('NFD').replace(/[\u0300-\u036f]/g, ""); 
            
            const batePlaca = (placaDB === placaMestraLimpa);
            const bateData = (dataDB.includes(dIso) || dataDB.includes(dPt) || dataDB.includes(dPt2));
            const bateStatus = statusLimpo.includes('conclui') || status === '' || statusLimpo === 'aprovado';

            return batePlaca && bateData && bateStatus;
        });

        abastecimentosDoDia.forEach(a => {
            achouAbast = true;
            if (tbody) {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><input type="text" class="form-control form-control-sm bg-light fw-bold text-dark text-center" value="${a.nomePosto || 'Posto Oficial'}" readonly></td>
                    <td><input type="text" class="form-control form-control-sm bg-light text-center" value="${a.tipoCombustivel || 'Combustível'}" readonly></td>
                    <td><input type="text" class="form-control form-control-sm bg-light fw-bold text-danger text-center abast-qtd-evt" value="${window.safeCurrency(a.quantidade).toFixed(3)}" readonly></td>
                    <td><input type="text" class="form-control form-control-sm bg-light text-center" value="${a.odometroPainel || a.odometroSistema || ''}" readonly></td>
                    <td><input type="text" class="form-control form-control-sm bg-light fw-bold text-primary text-center" value="R$ ${window.safeCurrency(a.valorTotal).toFixed(2)}" readonly></td>
                    <td class="text-center"><span class="badge bg-success" title="Sincronizado"><i class="fas fa-link"></i></span></td>
                `;
                tbody.appendChild(tr);
            }
        });
        
        if (!achouAbast && typeof window.AdicionarLinhaAbastecimento === 'function') {
            window.AdicionarLinhaAbastecimento();
        }

        const frota = window.DADOS_VEICULOS || window.ColecaoFrota || [];
        const v = frota.find(veh => norm(veh.id || veh.placa) === placaMestraLimpa);
        const statusGeralVeiculo = v ? (v.status || v.status_operacional || "Operando") : "Operando";
        
        const txtOficina = document.getElementById("rdv-oficina-descricao");
        const cbOficina = document.getElementById("rdv-veiculo-oficina");

        if (statusGeralVeiculo.toUpperCase() === "OFICINA" || statusGeralVeiculo.toUpperCase() === "MANUTENÇÃO") {
            if(cbOficina) cbOficina.checked = true; 
            if(window.AlternarCamposOficina) window.AlternarCamposOficina(true);
            if(txtOficina) { txtOficina.value = `Aviso: Veículo consta como '${statusGeralVeiculo}'.`; txtOficina.readOnly = false; }
        } else {
            if(cbOficina) cbOficina.checked = false; 
            if(window.AlternarCamposOficina) window.AlternarCamposOficina(false);
            if(txtOficina) { txtOficina.value = ""; txtOficina.readOnly = false; }
        }
        window.CalcularMetricasRDV();
    } catch (e) { 
        console.error("Erro na Sincronização:", e); 
        if (!achouAbast && typeof window.AdicionarLinhaAbastecimento === 'function') window.AdicionarLinhaAbastecimento();
    }
};

window.FiltrarLista = function(tipo, termo) {
    const isVeiculo = tipo === 'veiculo';
    const frota = window.DADOS_VEICULOS || window.ColecaoFrota || [];
    const lista = isVeiculo ? frota : ["Sede Central", "Deslocamento Distrito", "Viagem Intermunicipal", "Rota Rural", "Ronda Escolar", "Transporte Pacientes"];
    const dropdown = document.getElementById(isVeiculo ? "dropdown-veiculos" : "dropdown-rotas");
    if(!dropdown) return;
    
    dropdown.innerHTML = ""; dropdown.classList.remove("hidden");
    const norm = str => String(str).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    const filtrados = lista.filter(item => {
        const str = isVeiculo ? `${item.id || item.placa} ${item.modelo || item.veiculo || ''}` : item;
        return norm(str).includes(norm(termo));
    });

    if(filtrados.length === 0) {
        dropdown.innerHTML = `<div class="list-group-item text-muted small">Nenhum resultado...</div>`; return;
    }

    filtrados.forEach(item => {
        const btn = document.createElement("button"); btn.type = "button"; btn.className = "list-group-item list-group-item-action fw-bold";
        const exPlaca = item.id || item.placa || '';
        const exModelo = item.modelo || item.veiculo || '';
        btn.innerHTML = isVeiculo ? `<span class="text-primary">${exPlaca.toUpperCase()}</span> <br><small class="text-muted fw-normal">${exModelo}</small>` : item;
        btn.onclick = () => {
            let elInput = document.getElementById(isVeiculo ? "rdv-veiculo-input" : "rdv-rota-input");
            if(elInput) elInput.value = isVeiculo ? exPlaca.toUpperCase() : item;
            dropdown.classList.add("hidden");
            if(isVeiculo) window.AcionarSincronizacaoRDV();
        };
        dropdown.appendChild(btn);
    });
};

document.addEventListener("click", function(e) {
    const dVeic = document.getElementById("dropdown-veiculos");
    const dRota = document.getElementById("dropdown-rotas");
    if(dVeic && !e.target.closest("#rdv-veiculo-busca-container")) dVeic.classList.add("hidden");
    if(dRota && !e.target.closest("#rdv-rota-busca-container")) dRota.classList.add("hidden");
});

window.BuscarMotoristaListaInteligente = function(tb) {
    const dp = document.getElementById("lista-inteligente-dropdown"); 
    if (!dp) return;
    if (!tb.trim()) { dp.classList.add("hidden"); return; }
    dp.innerHTML = ""; 
    
    const equipe = window.DADOS_MOTORISTAS || window.ColecaoEquipe || [];
    const fs = equipe.filter(m => String(m.cargo).toUpperCase() === "MOTORISTA" && m.nome.toLowerCase().includes(tb.toLowerCase()));
    
    fs.forEach(m => { 
        const btn = document.createElement("button"); btn.type = "button"; btn.className = "list-group-item list-group-item-action fw-bold"; btn.innerHTML = `<i class="fas fa-user-check text-success me-2"></i>${m.nome}`; 
        btn.onclick = () => { window.AdicionarMotoristaAoRDV(m); dp.classList.add("hidden"); document.getElementById("rdv-motorista-busca").value = ""; }; 
        dp.appendChild(btn); 
    });

    if (fs.length === 0) {
        const bq = document.createElement("button"); bq.type = "button"; bq.className = "list-group-item list-group-item-warning fw-bold"; bq.innerHTML = `<i class="fas fa-bolt me-2"></i>Criar "${tb}" rápido`; 
        bq.onclick = () => { 
            dp.classList.add("hidden"); 
            document.getElementById("cadMotNome").value = tb; document.getElementById("cadMotCargo").value = "MOTORISTA"; 
            window.AbrirModalMembroEquipe(); 
        }; 
        dp.appendChild(bq);
    }
    dp.classList.remove("hidden");
};

window.AdicionarMotoristaAoRDV = function(motoristaObj) {
    const container = document.getElementById("container-motoristas-tags");
    if(!container) return;
    const div = document.createElement("div");
    div.className = "badge bg-secondary me-2 p-2 fw-bold d-inline-flex align-items-center mb-1";
    div.innerHTML = `<i class="fas fa-user me-2"></i> ${motoristaObj.nome} <i class="fas fa-times ms-2" style="cursor:pointer;" onclick="this.parentElement.remove()"></i><input type="hidden" class="mot-rdv-adicionado" value="${motoristaObj.cpf || motoristaObj.id || ''}">`;
    container.appendChild(div);
};

window.TratarMedidorDefeito = function(isDefeituoso) {
    const ti = document.getElementById("rdv-odo-inicial"); const tf = document.getElementById("rdv-odo-final");
    if(ti) { ti.disabled = isDefeituoso; ti.value = isDefeituoso ? "" : ti.value; ti.placeholder = isDefeituoso ? "DEFEITO" : "Medidor Início"; }
    if(tf) { tf.disabled = isDefeituoso; tf.value = isDefeituoso ? "" : tf.value; tf.placeholder = isDefeituoso ? "DEFEITO" : "Medidor Final"; }
    window.CalcularMetricasRDV();
};

window.FinalizarRDVEPurgarMidia = async function() {
    let elPlaca = document.getElementById("rdv-veiculo-input");
    const placa = elPlaca ? elPlaca.value : null; 
    if(!placa) return alert("Selecione um veículo válido");
    
    if(confirm("Deseja gravar o Relatório Diário?")) {
        window.loading(true, "Finalizando RDV e atualizando o hodômetro central...");
        const idRdv = `RDV-${Date.now()}`;
        let odoFinal = parseFloat(document.getElementById("rdv-odo-final")?.value) || 0;

        try {
            await setDoc(doc(db, `${window.tenant}_rdvs`, idRdv), { 
                id: idRdv, veiculo: placa, 
                data: document.getElementById("rdv-data")?.value || new Date().toISOString().split('T')[0], 
                rota: document.getElementById("rdv-rota-input")?.value || '', 
                odo_inicial: document.getElementById("rdv-odo-inicial")?.value || '', 
                odo_final: odoFinal, 
                status: "Homologado", autor: window.USUARIO.cpf 
            }, { merge: true });
            
            // INTEGRAÇÃO DE ODÔMETRO: Informa ao Motor Central o KM final da viagem
            if (odoFinal > 0 && window.sincronizarOdometroCentral) {
                await window.sincronizarOdometroCentral(placa, odoFinal);
            }

            alert("RDV gravado com sucesso!"); 
            window.LimparFormularioRDV(); 
            if(window.buscarTudo) await window.buscarTudo();
        } catch(e) { 
            alert("Erro ao salvar: " + e.message); 
        } finally {
            window.loading(false);
        }
    }
};

window.LimparFormularioRDV = function() {
    document.getElementById("form-master-rdv")?.reset();
    let c = document.getElementById("corpo-rdv-abastecimentos"); if(c) c.innerHTML = "";
    let mt = document.getElementById("container-motoristas-tags"); if(mt) mt.innerHTML = "";
    let pIni = document.getElementById("preview-odo-ini"); if(pIni) pIni.src = "";
    let pFim = document.getElementById("preview-odo-fim"); if(pFim) pFim.src = "";
    let gs = document.getElementById("galeria-servicos"); if(gs) gs.innerHTML = "";
    let gv = document.getElementById("galeria-vales"); if(gv) gv.innerHTML = "";
    let res = document.getElementById("resumo-rdv-calc"); if(res) { res.innerHTML = ""; res.classList.add('hidden'); }
    window.AdicionarLinhaAbastecimento();
};

window.AdicionarLinhaAbastecimento = function() {
    const tbody = document.getElementById("corpo-rdv-abastecimentos");
    if(!tbody) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td><input type="text" class="form-control form-control-sm" placeholder="Posto"></td>
        <td><input type="text" class="form-control form-control-sm" placeholder="Combustível"></td>
        <td><input type="text" class="form-control form-control-sm input-calc-litros abast-qtd-evt" placeholder="0,000" oninput="window.maskLitros(event); window.CalcularMetricasRDV()"></td>
        <td><input type="text" class="form-control form-control-sm" placeholder="Odo"></td>
        <td><input type="text" class="form-control form-control-sm" placeholder="R$ 0,00" oninput="window.maskMoeda(event)"></td>
        <td class="text-center"><button class="btn btn-sm btn-danger" onclick="this.parentElement.parentElement.remove(); window.CalcularMetricasRDV()"><i class="fas fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
};

window.AbrirModalMembroEquipe = function() {
    let modalEl = document.getElementById('modalMembroEquipe');
    if(modalEl) {
        let modalObj = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modalObj.show();
    } else { alert("Modal não encontrado no HTML."); }
};

window.SalvarMotoristaRapido = async function() {
    let nome = document.getElementById("cadMotNome")?.value.toUpperCase();
    let cargo = document.getElementById("cadMotCargo")?.value.toUpperCase();
    let cpf = document.getElementById("cadMotCpf")?.value;
    if(!nome) return alert("Por favor, preencha o nome!");
    
    let idMotorista = cpf && cpf.length > 5 ? cpf : `MOT-${Date.now()}`;
    let novoMotorista = { id: idMotorista, cpf: idMotorista, nome: nome, cargo: cargo, status: "Ativo" };
    
    window.loading(true, "Salvando motorista...");
    try {
        await setDoc(doc(db, `${window.tenant}_equipe`, idMotorista), novoMotorista);
        window.AdicionarMotoristaAoRDV(novoMotorista);
        if(window.DADOS_MOTORISTAS) window.DADOS_MOTORISTAS.push(novoMotorista);
        if(window.ColecaoEquipe) window.ColecaoEquipe.push(novoMotorista);
        
        let modalEl = document.getElementById('modalMembroEquipe');
        let modalObj = bootstrap.Modal.getInstance(modalEl);
        if(modalObj) modalObj.hide();
        alert(`Motorista salvo!`);
    } catch(e) { 
        console.error(e); 
        alert("Erro ao salvar."); 
    } finally {
        window.loading(false);
    }
};

window.AlternarCamposOficina = function(status) {
    const txt = document.getElementById("rdv-oficina-descricao");
    if(txt) txt.disabled = !status;
};

window.ProcessarImagemUnica = function(input, previewId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { document.getElementById(previewId).src = e.target.result; };
        reader.readAsDataURL(input.files[0]);
    }
};

window.ProcessarImagensMultiplas = function(input, galleryId, tipo) {
    const galeria = document.getElementById(galleryId);
    if(!galeria) return;
    if (input.files) {
        Array.from(input.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const div = document.createElement("div");
                div.className = "img-thumb position-relative shadow-sm";
                div.innerHTML = `<img src="${e.target.result}" style="width:70px; height:70px; object-fit:cover; border-radius:6px; border: 1px solid #ccc;">`;
                galeria.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    }
};

window.LimparGaleria = function(galleryId, tipo) {
    let g = document.getElementById(galleryId);
    if(g) g.innerHTML = "";
};

window.CalcularMetricasRDV = function() {
    const odoIni = parseFloat(document.getElementById("rdv-odo-inicial")?.value) || 0;
    const odoFim = parseFloat(document.getElementById("rdv-odo-final")?.value) || 0;
    const isDefeito = document.getElementById("rdv-medidor-defeito")?.checked;
    
    let kmRodado = 0;
    if (!isDefeito && odoFim > odoIni) kmRodado = odoFim - odoIni;

    let totalLitros = 0;
    const inputsLitros = document.querySelectorAll(".abast-qtd-evt");
    inputsLitros.forEach(input => {
        const val = input.value;
        if(val) totalLitros += window.safeCurrency(val);
    });

    const elResumo = document.getElementById("resumo-rdv-calc");
    if(elResumo) {
        if (kmRodado > 0 || totalLitros > 0) {
            const media = (totalLitros > 0 && kmRodado > 0) ? (kmRodado / totalLitros) : 0;
            elResumo.innerHTML = `
                <div class="alert alert-info py-2 m-0 mt-3 border-info shadow-sm d-flex justify-content-between text-dark">
                    <span><i class="fas fa-road me-1"></i> <b>Rodado:</b> ${kmRodado.toFixed(1)} km</span>
                    <span><i class="fas fa-tint me-1 text-primary"></i> <b>Litros:</b> ${totalLitros.toFixed(3)} L</span>
                    <span><i class="fas fa-tachometer-alt me-1 text-success"></i> <b>Média:</b> ${media.toFixed(2)} km/L</span>
                </div>
            `;
            elResumo.classList.remove('hidden');
        } else { elResumo.innerHTML = ""; elResumo.classList.add('hidden'); }
    }
};

document.addEventListener('input', function(e) {
    if (e.target.id === 'rdv-odo-inicial' || e.target.id === 'rdv-odo-final') window.CalcularMetricasRDV();
});

// =========================================================================
// GERAÇÃO DE RELATÓRIO PDF PROFISSIONAL COM FOTOS E LOGO
// =========================================================================

window.CompilarERenderizarPDF_Prefeitura = function() {
    // 1. Dados Governamentais (Salvos no app.js)
    let logoGov = localStorage.getItem("caatinga_logo_gov") || window.LOGO_PREFEITURA_FIXA || ""; 
    let nomeGov = localStorage.getItem("caatinga_nome_gov") || "SISTEMA DE GESTÃO DE FROTA";
    
    // Configura o cabeçalho
    let logoHTML = logoGov ? `<img src="${logoGov}" style="max-height: 80px; max-width: 150px; object-fit: contain;">` : '';
    let headerHTML = logoGov 
        ? `<table style="width: 100%; border:none; margin-bottom: 20px;">
             <tr>
               <td style="width: 20%; text-align: left; border:none;">${logoHTML}</td>
               <td style="width: 80%; text-align: center; border:none;">
                  <h2 style="margin:0; font-size: 22px;">${nomeGov}</h2>
                  <p style="margin:5px 0 0 0; font-size: 14px; color:#555;">RELATÓRIO DIÁRIO DE VIAGEM (RDV)</p>
               </td>
             </tr>
           </table>`
        : `<div style="text-align: center; margin-bottom: 20px;">
              <h2 style="margin:0; font-size: 22px;">${nomeGov}</h2>
              <p style="margin:5px 0 0 0; font-size: 14px; color:#555;">RELATÓRIO DIÁRIO DE VIAGEM (RDV)</p>
           </div>`;

    // 2. Coleta dos dados do formulário
    let placa = document.getElementById("rdv-veiculo-input")?.value || "N/A";
    let data = document.getElementById("rdv-data")?.value ? document.getElementById("rdv-data").value.split('-').reverse().join('/') : "N/A";
    let rota = document.getElementById("rdv-rota-input")?.value || "N/A";
    let odoIni = document.getElementById("rdv-odo-inicial")?.value || "0";
    let odoFim = document.getElementById("rdv-odo-final")?.value || "0";
    let oficina = document.getElementById("rdv-oficina-descricao")?.value || "Sem ocorrências registradas.";
    
    let motoristas = [];
    document.querySelectorAll("#container-motoristas-tags div").forEach(div => motoristas.push(div.innerText.trim()));
    let textoMotoristas = motoristas.length > 0 ? motoristas.join(", ") : "Nenhum condutor vinculado";
    let resumo = document.getElementById("resumo-rdv-calc")?.innerText.replace(/\n/g, ' | ') || "Métricas não calculadas";

    // 3. Coleta das Imagens/Fotos
    let imgOdoIni = document.getElementById("preview-odo-ini")?.src;
    let imgOdoFim = document.getElementById("preview-odo-fim")?.src;
    
    let boxOdoIni = (imgOdoIni && !imgOdoIni.endsWith("index.html")) ? `<img src="${imgOdoIni}">` : `<div class="sem-foto">Sem Imagem</div>`;
    let boxOdoFim = (imgOdoFim && !imgOdoFim.endsWith("index.html")) ? `<img src="${imgOdoFim}">` : `<div class="sem-foto">Sem Imagem</div>`;

    let htmlGaleria = "";
    document.querySelectorAll("#galeria-servicos img").forEach(img => {
        if(img.src) htmlGaleria += `<img src="${img.src}" class="foto-galeria">`;
    });
    document.querySelectorAll("#galeria-vales img").forEach(img => {
        if(img.src) htmlGaleria += `<img src="${img.src}" class="foto-galeria">`;
    });
    if(!htmlGaleria) htmlGaleria = `<span style="font-size:12px; color:#777;">Nenhuma evidência fotográfica anexada.</span>`;

    // 4. Coleta da Tabela de Abastecimento
    let linhasAbast = "";
    document.querySelectorAll("#corpo-rdv-abastecimentos tr").forEach(tr => {
        let inputs = tr.querySelectorAll("input");
        if(inputs.length >= 5) {
            linhasAbast += `
            <tr>
                <td>${inputs[0].value || '-'}</td>
                <td>${inputs[1].value || '-'}</td>
                <td>${inputs[2].value || '-'}</td>
                <td>${inputs[3].value || '-'}</td>
                <td>${inputs[4].value || '-'}</td>
            </tr>`;
        }
    });
    if(!linhasAbast) linhasAbast = `<tr><td colspan="5" style="text-align: center; color:#777;">Nenhum abastecimento registrado.</td></tr>`;

    // 5. Estrutura HTML Profissional
    let htmlPrint = `
    <html>
    <head>
        <title>RDV - ${placa} - ${data}</title>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #111; font-size: 13px; line-height: 1.4; }
            .content { border: 2px solid #000; padding: 20px; box-sizing: border-box; }
            .section-title { background: #333; color: white; padding: 5px 10px; font-weight: bold; margin-top: 15px; margin-bottom: 10px; font-size: 12px; text-transform: uppercase; }
            .grid-2 { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .col { width: 48%; }
            .info-label { font-weight: bold; color: #444; font-size: 11px; text-transform: uppercase; }
            .info-value { padding: 5px; border-bottom: 1px solid #ccc; background: #fafafa; font-size: 13px; font-weight: bold; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 12px; }
            th { background-color: #eee; border: 1px solid #aaa; padding: 8px; text-align: center; font-weight: bold; }
            td { border: 1px solid #aaa; padding: 6px; text-align: center; }
            
            .box-fotos { display: flex; gap: 10px; }
            .foto-medidor { width: 140px; border: 1px solid #000; text-align: center; background: #fff; padding: 5px;}
            .foto-medidor img { width: 100%; height: 100px; object-fit: cover; }
            .sem-foto { height: 100px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 11px; background: #f4f4f4;}
            
            .galeria-container { display: flex; flex-wrap: wrap; gap: 10px; border: 1px dashed #ccc; padding: 10px; min-height: 60px; }
            .foto-galeria { width: 120px; height: 120px; object-fit: cover; border: 1px solid #888; border-radius: 4px; }
            
            .resumo-box { text-align: center; font-weight: bold; font-size: 14px; border: 2px dashed #444; padding: 10px; background: #fdfdfd; margin-top: 10px; }
            
            .assinaturas { margin-top: 40px; display: flex; justify-content: space-around; page-break-inside: avoid; }
            .ass-linha { border-top: 1px solid #000; width: 220px; text-align: center; padding-top: 5px; font-size: 11px; font-weight: bold; }
            
            @media print { body { -webkit-print-color-adjust: exact; padding: 0; } .content { border: none; padding: 0; } }
        </style>
    </head>
    <body>
        <div class="content">
            ${headerHTML}

            <div class="section-title">Dados da Operação</div>
            <div class="grid-2">
                <div class="col">
                    <div class="info-label">Veículo (Placa)</div>
                    <div class="info-value">${placa}</div>
                </div>
                <div class="col">
                    <div class="info-label">Data de Referência</div>
                    <div class="info-value">${data}</div>
                </div>
            </div>
            <div style="margin-bottom: 10px;">
                <div class="info-label">Destino / Rota</div>
                <div class="info-value">${rota}</div>
            </div>
            <div style="margin-bottom: 10px;">
                <div class="info-label">Condutores Designados</div>
                <div class="info-value">${textoMotoristas}</div>
            </div>

            <div class="section-title">Métricas e Odômetro</div>
            <div class="grid-2">
                <div class="col" style="display:flex; gap:10px;">
                    <div class="foto-medidor">
                        <div class="info-label">Medidor Inicial</div>
                        <div style="font-size:16px; font-weight:bold; margin:5px 0;">${odoIni}</div>
                        ${boxOdoIni}
                    </div>
                    <div class="foto-medidor">
                        <div class="info-label">Medidor Final</div>
                        <div style="font-size:16px; font-weight:bold; margin:5px 0;">${odoFim}</div>
                        ${boxOdoFim}
                    </div>
                </div>
                <div class="col">
                    <div class="info-label">Desempenho Diário</div>
                    <div class="resumo-box">${resumo}</div>
                </div>
            </div>

            <div class="section-title">Registros de Abastecimento</div>
            <table>
                <thead>
                    <tr>
                        <th>Posto / Fornecedor</th>
                        <th>Combustível</th>
                        <th>Litros</th>
                        <th>Odômetro BD</th>
                        <th>Valor Total</th>
                    </tr>
                </thead>
                <tbody>${linhasAbast}</tbody>
            </table>

            <div class="section-title">Ocorrências / Manutenção</div>
            <div style="border: 1px solid #ccc; padding: 10px; background:#fff; min-height: 40px; margin-bottom: 10px;">
                ${oficina.replace(/\n/g, '<br>')}
            </div>

            <div class="section-title">Galeria de Evidências Fotográficas</div>
            <div class="galeria-container">
                ${htmlGaleria}
            </div>

            <div class="assinaturas">
                <div class="ass-linha">Assinatura do Condutor</div>
                <div class="ass-linha">Visto da Gestão de Frota</div>
            </div>
        </div>
        <script>
            // Garante que todas as imagens Base64 carreguem antes de acionar a impressão
            setTimeout(() => { window.print(); window.close(); }, 800);
        </script>
    </body>
    </html>`;

    let win = window.open('', '_blank');
    win.document.write(htmlPrint);
    win.document.close();
};
import { db } from './firebase-env.js';
import { collection, doc, getDocs, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.normalizarBaseVeiculos = async function() {
    if(!confirm("Isso vai padronizar todos os veículos da coleção para o formato Híbrido (Abastecimento + Frotas). Continuar?")) return;
    
    document.getElementById('loading').classList.remove('hidden');
    try {
        const snap = await getDocs(collection(db, `${window.tenant}_veiculos`));
        let count = 0;

        for (const docSnap of snap.docs) {
            let v = docSnap.data();
            
            let kmReal = parseInt(v.km_atual) || parseInt(v.odometro) || parseInt(v.horimetro) || 0;
            let tipoReal = v.tipo_veiculo || v.tipo;
            if (!tipoReal) {
                tipoReal = (v.maquina === true || v.maquina === "sim") ? "Máquina" : "Veículo";
            }
            
            let modReal = v.modelo || v.veiculo || 'NÃO INFORMADO';
            let secReal = v.secretaria || v.sec || '';

            let atualizacao = {
                km_atual: kmReal,
                odometro: kmReal, 
                horimetro: kmReal,
                tipo_veiculo: tipoReal,
                maquina: tipoReal === "Máquina",
                status_operacional: v.status_operacional || 'Disponível',
                modelo: modReal,
                veiculo: modReal,
                sec: secReal,
                km_proxima_troca_oleo: parseInt(v.km_proxima_troca_oleo) || 0,
                km_proxima_revisao: parseInt(v.km_proxima_revisao) || 0
            };

            await setDoc(doc(db, `${window.tenant}_veiculos`, docSnap.id), atualizacao, { merge: true });
            count++;
        }
        
        alert(`✅ SUCESSO! ${count} veículos foram padronizados.`);
        window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value);
        
    } catch(e) {
        console.error(e);
        alert("Erro ao normalizar: " + e.message);
    }
    document.getElementById('loading').classList.add('hidden');
};

window.renderizarTabelaVeiculos = function(vs) {
    const tb = document.querySelector('#table-veiculos tbody');
    if(!tb) return;
    tb.innerHTML = '';
    
    if(vs.length === 0) { 
        tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhum veículo cadastrado.</td></tr>'; 
        return; 
    }
    
    vs.forEach(v => {
        let k = parseInt(v.km_atual) || parseInt(v.odometro) || parseInt(v.horimetro) || 0;
        let stBadge = v.status_operacional === 'Disponível' ? 'bg-success' : (v.status_operacional === 'Em Oficina' ? 'bg-warning text-dark' : (v.status_operacional === 'Inservível' ? 'bg-danger' : 'bg-primary'));
        
        tb.innerHTML += `<tr>
            <td><strong>${v.placa}</strong></td>
            <td>${v.tipo_veiculo || v.tipo || 'Veículo'}<br><small class="text-muted">${v.modelo || v.veiculo || ''}</small></td>
            <td>${v.dotacao || '-'}<br><small class="text-muted">${v.secretaria || v.sec || ''}</small></td>
            <td><span class="badge ${stBadge}">${v.status_operacional || 'Disponível'}</span></td>
            <td>KM/H: ${k}</td>
            <td class="adm-only"><button class="btn btn-sm btn-light text-primary" onclick='window.editarVeiculo(${JSON.stringify(v)})'><i class="fas fa-edit"></i></button></td>
        </tr>`;
    });
};

window.mudarLabelsOdometro = function() {
    let t = document.getElementById('v-tipo').value;
    let l1 = 'KM Atual', l2 = 'Aviso: Troca Óleo (KM)', l3 = 'Aviso: Revisão (KM)';
    if(t === 'Máquina'){ l1 = 'Horímetro Atual'; l2 = 'Aviso: Troca Óleo (H)'; l3 = 'Aviso: Revisão (H)'; }
    
    let elL1 = document.getElementById('lbl-km-atual'); if(elL1) elL1.innerText = l1;
    let elL2 = document.getElementById('lbl-km-oleo'); if(elL2) elL2.innerText = l2;
    let elL3 = document.getElementById('lbl-km-rev'); if(elL3) elL3.innerText = l3;
};

window.abrirModalVeiculo = function() {
    document.getElementById('formVeiculo').reset();
    document.getElementById('v-id').value = '';
    document.getElementById('btn-del-veiculo').classList.add('hidden');
    window.mudarLabelsOdometro();
    new bootstrap.Modal(document.getElementById('modalVeiculo')).show();
};

window.editarVeiculo = function(v) {
    document.getElementById('v-id').value = v.placa;
    document.getElementById('v-placa').value = v.placa;
    document.getElementById('v-tipo').value = v.tipo_veiculo || v.tipo || 'Veículo';
    document.getElementById('v-modelo').value = v.modelo || v.veiculo || '';
    document.getElementById('v-combustivel').value = v.combustivel || 'Diesel';
    document.getElementById('v-secretaria').value = v.secretaria || v.sec || '';
    document.getElementById('v-destinacao').value = v.destinacao || '';
    document.getElementById('v-dotacao').value = v.dotacao || '';
    document.getElementById('v-renavam').value = v.renavam || '';
    document.getElementById('v-tombamento').value = v.tombamento || '';
    document.getElementById('v-ano').value = v.ano || '';
    document.getElementById('v-vinculo').value = v.vinculo || 'Próprio';
    document.getElementById('v-status-op').value = v.status_operacional || 'Disponível';
    
    document.getElementById('v-km-atual').value = parseInt(v.km_atual) || parseInt(v.odometro) || parseInt(v.horimetro) || 0;
    document.getElementById('v-km-oleo').value = v.km_proxima_troca_oleo || '';
    document.getElementById('v-km-revisao').value = v.km_proxima_revisao || '';
    document.getElementById('v-data-oleo').value = v.data_proxima_troca_oleo || '';
    document.getElementById('v-data-revisao').value = v.data_proxima_revisao || '';

    window.mudarLabelsOdometro();
    document.getElementById('btn-del-veiculo').classList.remove('hidden');
    new bootstrap.Modal(document.getElementById('modalVeiculo')).show();
};

window.salvarVeiculo = async function() {
    const p = document.getElementById('v-placa').value.toUpperCase().trim();
    if(!p) return alert("A placa é obrigatória!");
    
    let k = parseInt(document.getElementById('v-km-atual').value) || 0;
    let t = document.getElementById('v-tipo').value;

    const d = {
        placa: p,
        tipo_veiculo: t,
        maquina: t === 'Máquina',
        modelo: document.getElementById('v-modelo').value.toUpperCase(),
        veiculo: document.getElementById('v-modelo').value.toUpperCase(),
        combustivel: document.getElementById('v-combustivel').value,
        secretaria: document.getElementById('v-secretaria').value.toUpperCase(),
        sec: document.getElementById('v-secretaria').value.toUpperCase(),
        destinacao: document.getElementById('v-destinacao').value.toUpperCase(),
        dotacao: document.getElementById('v-dotacao').value.toUpperCase(),
        renavam: document.getElementById('v-renavam').value,
        tombamento: document.getElementById('v-tombamento').value,
        ano: document.getElementById('v-ano').value,
        vinculo: document.getElementById('v-vinculo').value,
        status_operacional: document.getElementById('v-status-op').value,
        km_atual: k, 
        odometro: k, 
        horimetro: k,
        km_proxima_troca_oleo: parseInt(document.getElementById('v-km-oleo').value) || 0,
        km_proxima_revisao: parseInt(document.getElementById('v-km-revisao').value) || 0,
        data_proxima_troca_oleo: document.getElementById('v-data-oleo').value,
        data_proxima_revisao: document.getElementById('v-data-revisao').value
    };

    await setDoc(doc(db, `${window.tenant}_veiculos`, p), d, {merge: true});
    bootstrap.Modal.getInstance(document.getElementById('modalVeiculo')).hide();
    alert("Veículo salvo com sucesso!");
    window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value);
};

window.deletarVeiculo = async function() {
    if(confirm("Deseja excluir este Veículo da lista? Isso não apagará as OS vinculadas a ele.")) {
        await deleteDoc(doc(db, `${window.tenant}_veiculos`, document.getElementById('v-id').value));
        bootstrap.Modal.getInstance(document.getElementById('modalVeiculo')).hide();
        window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value);
    }
};
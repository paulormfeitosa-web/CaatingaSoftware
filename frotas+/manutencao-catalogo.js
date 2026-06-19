import { db } from './firebase-env.js';
import { doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const mod = "frota";

window.renderizarTabelaCatalogo = function(itens) {
    const tb = document.querySelector('#table-catalogo tbody'); 
    if(!tb) return; 
    tb.innerHTML = '';
    
    if(itens.length === 0) { 
        tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhum item no catálogo.</td></tr>'; 
        return; 
    }
    
    itens.forEach(c => {
        let badgeCat = 'bg-secondary';
        if(c.categoria === 'Peças') badgeCat = 'bg-info text-dark';
        if(c.categoria === 'Mão de obra' || c.categoria === 'Serviço') badgeCat = 'bg-warning text-dark';
        if(c.categoria === 'Pneus') badgeCat = 'bg-dark';
        if(c.categoria === 'Bateria') badgeCat = 'bg-danger';
        
        tb.innerHTML += `
        <tr>
           <td><span class="badge ${badgeCat}">${c.categoria}</span></td>
           <td><strong>${c.descricao}</strong></td>
           <td>${c.marca || '-'}</td>
           <td>${c.garantia_meses ? c.garantia_meses + ' meses' : '-'} / ${c.garantia_km ? c.garantia_km + ' km' : '-'}</td>
           <td class="fw-bold text-danger text-end">${window.formatarMoeda(c.valor_referencia)}</td>
           <td class="adm-only"><button class="btn btn-sm btn-light text-primary" onclick='window.editarItemCatalogo(${JSON.stringify(c)})'><i class="fas fa-edit"></i></button></td>
        </tr>`;
    });
};

window.abrirModalCatalogo = function() { 
    document.getElementById('formCatalogo').reset(); 
    document.getElementById('cat-id').value = ''; 
    document.getElementById('btn-del-catalogo').classList.add('hidden'); 
    new bootstrap.Modal(document.getElementById('modalCatalogo')).show(); 
};

window.editarItemCatalogo = function(c) { 
    document.getElementById('cat-id').value = c.id; 
    document.getElementById('cat-categoria').value = c.categoria; 
    document.getElementById('cat-descricao').value = c.descricao; 
    document.getElementById('cat-aplicacao').value = c.aplicacao_modelos || ''; 
    document.getElementById('cat-marca').value = c.marca || ''; 
    document.getElementById('cat-garantia-meses').value = c.garantia_meses || ''; 
    document.getElementById('cat-garantia-km').value = c.garantia_km || ''; 
    
    let elValor = document.getElementById('cat-valor-ref'); 
    elValor.value = (parseFloat(c.valor_referencia) || 0).toFixed(2).replace(".", ""); 
    window.aplicarMascaraMonetaria(elValor); 
    
    document.getElementById('btn-del-catalogo').classList.remove('hidden'); 
    new bootstrap.Modal(document.getElementById('modalCatalogo')).show(); 
};

window.salvarItemCatalogo = async function() { 
    const descricao = document.getElementById('cat-descricao').value.toUpperCase().trim(); 
    if(!descricao) return alert("A descrição é obrigatória."); 
    
    let valorStr = document.getElementById('cat-valor-ref').value.replace(/[R$\s]/g, ''); 
    if (valorStr.includes(',')) valorStr = valorStr.replace(/\./g, '').replace(',', '.'); 
    
    const dados = { 
        categoria: document.getElementById('cat-categoria').value, 
        descricao: descricao, 
        aplicacao_modelos: document.getElementById('cat-aplicacao').value.toUpperCase().trim(),
        marca: document.getElementById('cat-marca').value, 
        garantia_meses: parseInt(document.getElementById('cat-garantia-meses').value) || 0, 
        garantia_km: parseInt(document.getElementById('cat-garantia-km').value) || 0, 
        valor_referencia: parseFloat(valorStr) || 0 
    }; 
    
    let id = document.getElementById('cat-id').value || `ITEM-${Date.now()}`; 
    
    await setDoc(doc(db, `${mod}_${window.tenant}_catalogo`, id), dados, {merge: true}); 
    bootstrap.Modal.getInstance(document.getElementById('modalCatalogo')).hide(); 
    alert("Item salvo no catálogo!"); 
    window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value); 
};

window.deletarItemCatalogo = async function() { 
    if(confirm("Tem certeza que deseja excluir este item do catálogo?")) { 
        await deleteDoc(doc(db, `${mod}_${window.tenant}_catalogo`, document.getElementById('cat-id').value)); 
        bootstrap.Modal.getInstance(document.getElementById('modalCatalogo')).hide(); 
        window.carregarDadosGerais(document.getElementById('r-data-ini').value, document.getElementById('r-data-fim').value); 
    } 
};
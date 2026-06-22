import { db } from './firebase-env.js';
import { doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const mod = "frota"; // Prefixo para isolamento da tabela no banco

window.renderizarTabelaCatalogo = function(itens) {
    const tb = document.querySelector('#table-catalogo tbody'); 
    if(!tb) return; 
    tb.innerHTML = '';
    
    if(!itens || itens.length === 0) { 
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
           <td class="adm-only text-end">
                <button class="btn btn-sm btn-light text-primary border shadow-sm" onclick='window.editarItemCatalogo(${JSON.stringify(c)})'><i class="fas fa-edit"></i></button>
           </td>
        </tr>`;
    });
};

window.abrirModalCatalogo = function() { 
    let form = document.getElementById('formCatalogo');
    if(form) form.reset(); 
    
    let elId = document.getElementById('cat-id');
    if(elId) elId.value = ''; 
    
    let btnDel = document.getElementById('btn-del-catalogo');
    if(btnDel) btnDel.classList.add('hidden'); 
    
    let modalEl = document.getElementById('modalCatalogo');
    if(modalEl) {
        let modalObj = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modalObj.show();
    }
};

window.editarItemCatalogo = function(c) { 
    let els = {
        id: document.getElementById('cat-id'),
        cat: document.getElementById('cat-categoria'),
        desc: document.getElementById('cat-descricao'),
        app: document.getElementById('cat-aplicacao'),
        marca: document.getElementById('cat-marca'),
        gMeses: document.getElementById('cat-garantia-meses'),
        gKm: document.getElementById('cat-garantia-km'),
        vlrRef: document.getElementById('cat-valor-ref'),
        btnDel: document.getElementById('btn-del-catalogo')
    };

    if(els.id) els.id.value = c.id; 
    if(els.cat) els.cat.value = c.categoria || 'Peças'; 
    if(els.desc) els.desc.value = c.descricao || ''; 
    if(els.app) els.app.value = c.aplicacao_modelos || ''; 
    if(els.marca) els.marca.value = c.marca || ''; 
    if(els.gMeses) els.gMeses.value = c.garantia_meses || ''; 
    if(els.gKm) els.gKm.value = c.garantia_km || ''; 
    
    if(els.vlrRef) {
        els.vlrRef.value = (parseFloat(c.valor_referencia) || 0).toFixed(2).replace(".", ""); 
        window.aplicarMascaraMonetaria(els.vlrRef); 
    }
    
    if(els.btnDel) els.btnDel.classList.remove('hidden'); 
    
    let modalEl = document.getElementById('modalCatalogo');
    if(modalEl) {
        let modalObj = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modalObj.show();
    }
};

window.salvarItemCatalogo = async function() { 
    let elDesc = document.getElementById('cat-descricao');
    let elValor = document.getElementById('cat-valor-ref');
    
    const descricao = elDesc ? elDesc.value.toUpperCase().trim() : ''; 
    if(!descricao) return alert("A descrição do item/serviço é obrigatória."); 
    
    let valorRef = elValor ? window.safeCurrency(elValor.value) : 0;
    
    let btnSalvar = document.querySelector('#modalCatalogo .btn-primary');
    window.toggleButtonLoading(btnSalvar, true);
    window.loading(true, "Salvando item no catálogo...");

    try {
        const dados = { 
            categoria: document.getElementById('cat-categoria')?.value || 'Peças', 
            descricao: descricao, 
            aplicacao_modelos: document.getElementById('cat-aplicacao')?.value.toUpperCase().trim() || '',
            marca: document.getElementById('cat-marca')?.value || '', 
            garantia_meses: parseInt(document.getElementById('cat-garantia-meses')?.value) || 0, 
            garantia_km: parseInt(document.getElementById('cat-garantia-km')?.value) || 0, 
            valor_referencia: valorRef 
        }; 
        
        let elId = document.getElementById('cat-id');
        let id = (elId && elId.value) ? elId.value : `ITEM-${Date.now()}`; 
        
        await setDoc(doc(db, `${mod}_${window.tenant}_catalogo`, id), dados, {merge: true}); 
        
        let modalEl = document.getElementById('modalCatalogo');
        if(modalEl) bootstrap.Modal.getInstance(modalEl).hide(); 
        
        alert("Item salvo no catálogo com sucesso!"); 
        
        if(window.buscarTudo) {
            await window.buscarTudo();
        } else if (window.carregarDadosGerais) {
            window.carregarDadosGerais(document.getElementById('r-data-ini')?.value, document.getElementById('r-data-fim')?.value);
        }
    } catch(e) {
        console.error(e);
        alert("Erro ao salvar catálogo: " + e.message);
    } finally {
        window.toggleButtonLoading(btnSalvar, false);
        window.loading(false);
    }
};

window.deletarItemCatalogo = async function() { 
    if(!confirm("Tem certeza que deseja excluir este item permanentemente do catálogo?")) return;
    
    window.loading(true, "Excluindo item...");
    try {
        let elId = document.getElementById('cat-id');
        if(elId && elId.value) {
            await deleteDoc(doc(db, `${mod}_${window.tenant}_catalogo`, elId.value)); 
            
            let modalEl = document.getElementById('modalCatalogo');
            if(modalEl) bootstrap.Modal.getInstance(modalEl).hide(); 
            
            if(window.buscarTudo) {
                await window.buscarTudo();
            } else if (window.carregarDadosGerais) {
                window.carregarDadosGerais(document.getElementById('r-data-ini')?.value, document.getElementById('r-data-fim')?.value);
            }
        }
    } catch(e) {
        console.error(e);
        alert("Erro ao excluir do catálogo: " + e.message);
    } finally {
        window.loading(false);
    }
};
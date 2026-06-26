import { db } from './firebase-env.js';
import { collection, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.buscarTudo = async function() {
    window.loading(true, "Sincronizando Banco de Dados...");
    try {
        const [snapV, snapA, snapVi, snapMot, snapEq, snapPos, snapCont, snapRdv, snapCfg] = await Promise.all([
            getDocs(collection(db, `${window.tenant}_veiculos`)),
            getDocs(collection(db, `${window.tenant}_abastecimentos`)),
            getDocs(collection(db, `${window.tenant}_viagens`)),
            getDocs(collection(db, `${window.tenant}_motoristas`)),
            getDocs(collection(db, `${window.tenant}_equipe`)),
            getDocs(collection(db, `${window.tenant}_postos`)),
            getDocs(collection(db, `${window.tenant}_contratos`)),
            getDocs(collection(db, `${window.tenant}_rdv`)),
            getDoc(doc(db, `${window.tenant}_config`, "identidade_oficial"))
        ]);

        window.DADOS_VEICULOS = []; window.ColecaoFrota = [];
        snapV.forEach(d => {
            let v = { id: d.id, ...d.data() };
            v.id_banco = d.id;
            v.placa = (v.placa || v.id).toUpperCase(); 
            v.tipo_padronizado = v.tipo_veiculo || v.tipo || ((v.maquina === true || v.maquina === "sim") ? "Máquina" : "Veículo");
            v.prop_padronizada = v.propriedade || v.locacao || "FROTA PRÓPRIA";
            v.sec_padronizada = v.secretaria || v.sec || v.orgao || "NÃO INFORMADA";
            window.DADOS_VEICULOS.push(v);
            window.ColecaoFrota.push(v);
        });

        window.DADOS_ABASTECIMENTOS = []; 
        snapA.forEach(d => window.DADOS_ABASTECIMENTOS.push({ id: d.id, ...d.data() }));
        window.DADOS_ABASTECIMENTOS.sort((a,b) => new Date(b.dataAbastecimento || 0) - new Date(a.dataAbastecimento || 0));

        window.DADOS_VIAGENS = []; snapVi.forEach(d => window.DADOS_VIAGENS.push({ id: d.id, ...d.data() }));
        window.DADOS_MOTORISTAS = []; snapMot.forEach(d => window.DADOS_MOTORISTAS.push({ id: d.id, ...d.data() }));
        window.ColecaoEquipe = []; snapEq.forEach(d => window.ColecaoEquipe.push({ id: d.id, ...d.data() }));
        window.DADOS_POSTOS = []; snapPos.forEach(d => window.DADOS_POSTOS.push({ id: d.id, ...d.data() }));
        window.DADOS_CONTRATOS = []; snapCont.forEach(d => window.DADOS_CONTRATOS.push({ id: d.id, ...d.data() }));
        
        window.ColecaoRDVs = []; snapRdv.forEach(d => window.ColecaoRDVs.push({ id: d.id, ...d.data() }));
        window.ColecaoRDVs.sort((a,b) => new Date(b.data || 0) - new Date(a.data || 0));

        if(snapCfg.exists()) {
            const c = snapCfg.data();
            let elNome = document.getElementById("cfg-prefeitura-nome"); if(elNome) elNome.value = c.nome_prefeitura || "";
            let elSec = document.getElementById("cfg-prefeitura-secretaria"); if(elSec) elSec.value = c.secretaria || "";
            let elSetor = document.getElementById("cfg-prefeitura-setor"); if(elSetor) elSetor.value = c.setor || "";
            
            if(c.logo_base64) { 
                window.LOGO_PREFEITURA_FIXA = c.logo_base64; 
                let elLogo = document.getElementById("cfg-prefeitura-logo-preview");
                if(elLogo) elLogo.src = window.LOGO_PREFEITURA_FIXA; 
            }
        }

        let secs = new Set(), rotas = new Set(), postosHistorico = new Set();
        window.DADOS_DESTINACOES.clear();

        window.DADOS_VEICULOS.forEach(v => { 
            if(v.secretaria) secs.add(v.secretaria.toUpperCase()); 
            if(v.destinacao) window.DADOS_DESTINACOES.add(v.destinacao.toUpperCase());
        });
        window.DADOS_VIAGENS.forEach(v => { if(v.percurso) rotas.add(v.percurso.toUpperCase()); });
        window.DADOS_ABASTECIMENTOS.forEach(a => { if(a.nomePosto) postosHistorico.add(a.nomePosto.toUpperCase()); });
        window.DADOS_POSTOS.forEach(p => { if(p.nome) postosHistorico.add(p.nome.toUpperCase()); });
        window.DADOS_CONTRATOS.forEach(c => { 
            if(c.secretaria) secs.add(c.secretaria.toUpperCase()); 
            if(c.destinacao) window.DADOS_DESTINACOES.add(c.destinacao.toUpperCase());
        });
        
        let secHTML = '<option value="">TODAS AS SECRETARIAS</option>';
        [...secs].sort().forEach(s => secHTML += `<option value="${s}">${s}</option>`);
        
        let elFSec = document.getElementById('fSec'); if(elFSec) elFSec.innerHTML = secHTML;
        let elListaSec = document.getElementById('listaSecretarias'); if(elListaSec) elListaSec.innerHTML = [...secs].map(s=>`<option value="${s}">`).join('');
        
        let destHTML = '<option value="">TODAS AS DESTINAÇÕES</option>';
        [...window.DADOS_DESTINACOES].sort().forEach(d => destHTML += `<option value="${d}">${d}</option>`);
        
        let elFDest = document.getElementById('fDest'); if(elFDest) elFDest.innerHTML = destHTML;
        let elListaDest = document.getElementById('listaDestinacoesGerais'); if(elListaDest) elListaDest.innerHTML = [...window.DADOS_DESTINACOES].map(d=>`<option value="${d}">`).join('');
        
        let elRotas = document.getElementById('listaRotas'); if(elRotas) elRotas.innerHTML = [...rotas].map(r=>`<option value="${r}">`).join('');
        let elFPosto = document.getElementById('fPosto'); if(elFPosto) elFPosto.innerHTML = '<option value="">Todos</option>' + [...postosHistorico].sort().map(p=>`<option value="${p}">${p}</option>`).join('');

        let optPostosUnicos = '<option value="">-- Selecione o Posto --</option>';
        let optPostosComboContrato = '<option value="TODOS">Todos os Postos</option>';
        
        window.DADOS_POSTOS.forEach(p => { 
            optPostosUnicos += `<option value="${p.nome}">${p.nome}</option>`; 
            optPostosComboContrato += `<option value="${p.nome}">${p.nome}</option>`;
        });
        
        let idsPostoOpt = ['inpPostoFrentista', 'admPostoNome', 'selPostoAvulso', 'authGestorPosto'];
        idsPostoOpt.forEach(id => { let el = document.getElementById(id); if(el) el.innerHTML = optPostosUnicos; });
        
        let elCadPosto = document.getElementById('cadContratoPosto'); if(elCadPosto) elCadPosto.innerHTML = optPostosComboContrato;

        let listMots = '';
        window.DADOS_MOTORISTAS.forEach(m => listMots += `<option value="${m.nome}">`);
        let elNomesMot = document.getElementById('listaNomesMotoristas'); if(elNomesMot) elNomesMot.innerHTML = listMots;

        let optVAvulso = '<option value="">-- Escolha o Carro Oficial --</option>';
        window.DADOS_VEICULOS.forEach(v => {
            if(v.status_operacional !== 'Em Oficina' && v.status_operacional !== 'Inservível') {
                optVAvulso += `<option value="${v.id}">${v.placa} - ${v.modelo || v.veiculo}</option>`;
            }
        });
        let elVeicReal = document.getElementById('selVeiculoRealAvulso'); if(elVeicReal) elVeicReal.innerHTML = optVAvulso;

        let elFiltroContSec = document.getElementById('filtroContratoSec');
        if(elFiltroContSec) {
            elFiltroContSec.innerHTML = secHTML;
            if(typeof window.atualizarFiltroDestContrato === 'function') window.atualizarFiltroDestContrato();
        }
        
        let elFiltroContPosto = document.getElementById('filtroContratoPosto');
        if(elFiltroContPosto) elFiltroContPosto.innerHTML = '<option value="">TODOS OS POSTOS</option>' + [...postosHistorico].sort().map(p=>`<option value="${p}">${p}</option>`).join('');

        // CHAMA FUNÇÕES ISOLADAMENTE COM PROTEÇÃO MÁXIMA
        let renderFunctions = [
            'renderTabVeiculos', 'renderAnaliseFrota', 'renderAuditoria', 
            'renderMotoristas', 'renderPostos', 'renderContratos', 
            'SincronizarCombosETratamentos', 'CarregarHistoricoRDVsView',
            'filtrarRelatorio', 'renderFilaPosto', 'renderGestaoNotas'
        ];
        
        renderFunctions.forEach(fn => {
            if(typeof window[fn] === 'function') {
                try { window[fn](); } catch(err) { console.warn(`Falha não fatal na renderização: ${fn}`, err); }
            }
        });

    } catch(e) { 
        console.error("Erro crítico na carga:", e); 
        alert("Falha de conexão. Recarregue a página."); 
    } finally {
        window.loading(false);
    }
};
import { db } from './firebase-env.js';
import { doc, getDoc, getDocs, collection, query, where, orderBy, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.obterPrecoVigente = function(nomePosto, dataIsoBase) {
    let p = window.DADOS_POSTOS.find(x => x.nome === nomePosto);
    if(!p) return { Gasolina: 0, Diesel: 0, Etanol: 0 };
    let dBusca = dataIsoBase.slice(0, 10); 
    
    if(p.vigencias && p.vigencias.length > 0) {
        let vigs = [...p.vigencias].sort((a,b) => (a.data > b.data) ? -1 : 1);
        for(let v of vigs) { 
            if(dBusca >= v.data) return { Gasolina: window.safeCurrency(v.Gasolina), Diesel: window.safeCurrency(v.Diesel), Etanol: window.safeCurrency(v.Etanol) }; 
        }
        let vOld = vigs[vigs.length-1]; 
        return { Gasolina: window.safeCurrency(vOld.Gasolina), Diesel: window.safeCurrency(vOld.Diesel), Etanol: window.safeCurrency(vOld.Etanol) };
    }
    return { Gasolina: window.safeCurrency(p.Gasolina), Diesel: window.safeCurrency(p.Etanol), Etanol: window.safeCurrency(p.Etanol) };
};

// === GUARDA-COSTAS: BLOQUEIO DE MÊS ===
window.isMesTrancado = async function(dataIsoCompleta) {
    if(!dataIsoCompleta) return false;
    let mesAno = dataIsoCompleta.substring(0, 7); 
    try {
        const docSnap = await getDoc(doc(db, `${window.tenant}_mesesFechados`, mesAno));
        return (docSnap.exists() && docSnap.data().fechado === true);
    } catch(e) { return false; }
};

window.verificarStatusMes = async function() {
    let elMes = document.getElementById('fMesFechamento');
    let btn = document.getElementById('btnTravarMes');
    if (!elMes || !btn || !elMes.value) return;

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checando...';
    try {
        const docSnap = await getDoc(doc(db, `${window.tenant}_mesesFechados`, elMes.value));
        if (docSnap.exists() && docSnap.data().fechado === true) {
            btn.className = "btn btn-danger fw-bold shadow-sm text-nowrap"; 
            btn.innerHTML = '<i class="fas fa-lock"></i> Mês Fechado (Clique p/ Reabrir)'; 
            btn.dataset.status = "fechado";
        } else {
            btn.className = "btn btn-success fw-bold shadow-sm text-nowrap"; 
            btn.innerHTML = '<i class="fas fa-lock-open"></i> Mês Aberto (Clique p/ Trancar)'; 
            btn.dataset.status = "aberto";
        }
    } catch(e) { console.error(e); }
};

window.alternarTravaMes = async function() {
    let mesSelecionado = document.getElementById('fMesFechamento')?.value;
    if (!mesSelecionado) return alert("Selecione um mês no campo ao lado primeiro!");
    
    let btn = document.getElementById('btnTravarMes'); 
    let isFechado = btn.dataset.status === "fechado";
    const docRef = doc(db, `${window.tenant}_mesesFechados`, mesSelecionado);
    
    window.toggleButtonLoading(btn, true);
    try {
        if (isFechado) { 
            if (confirm(`Deseja REABRIR o mês ${mesSelecionado} para edições?`)) { 
                await setDoc(docRef, { fechado: false }, { merge: true }); alert("Mês reaberto."); 
            } 
        } else { 
            if (confirm(`Deseja TRANCAR o mês ${mesSelecionado}?`)) { 
                await setDoc(docRef, { fechado: true, dataFechamento: new Date().toISOString() }, { merge: true }); alert("Mês trancado!"); 
            } 
        }
        await window.verificarStatusMes(); 
    } catch (e) { alert("Erro ao alterar status do mês."); console.error(e); } finally { window.toggleButtonLoading(btn, false); }
};

// === TIMELINE ENGINE ===
window.reprocessarHistoricoVeiculo = async function(placa) {
    try {
        const veicRef = doc(db, `${window.tenant}_veiculos`, placa);
        const veicSnap = await getDoc(veicRef);
        if (!veicSnap.exists()) return;

        let veicData = veicSnap.data();
        let mediaV = window.safeCurrency(veicData.media) > 0 ? window.safeCurrency(veicData.media) : 1;
        let odoAtualTimeline = window.safeCurrency(veicData.odometroInicial) || 0;

        const lockedSnap = await getDocs(collection(db, `${window.tenant}_mesesFechados`));
        let lockedMonths = new Set(); 
        lockedSnap.forEach(d => { if(d.data().fechado) lockedMonths.add(d.id); });

        const qAbast = query(collection(db, `${window.tenant}_abastecimentos`), where('placa', '==', placa), orderBy('dataAbastecimento', 'asc'));
        const abastSnap = await getDocs(qAbast);
        const batch = writeBatch(db); 
        let alteracoes = 0;

        abastSnap.forEach((docSnap) => {
            let abast = docSnap.data();
            if(abast.status !== 'Concluído') return;

            let lts = window.safeCurrency(abast.quantidade);
            let mesAno = abast.dataAbastecimento.slice(0, 7);
            let avanco = (veicData.tipoFrota === 'Máquina') ? (lts / mediaV) : (lts * mediaV);

            if (lockedMonths.has(mesAno)) {
                odoAtualTimeline = window.safeCurrency(abast.odometroPainel);
            } else {
                if (abast.odometroCalculado === true) {
                    odoAtualTimeline += avanco; 
                    odoAtualTimeline = Math.round(odoAtualTimeline * 10) / 10;
                    batch.update(docSnap.ref, { 
                        odometroPainel: odoAtualTimeline, 
                        odometroSistemaAnterior: Math.round((odoAtualTimeline - avanco) * 10) / 10, 
                        odometroSistema: odoAtualTimeline, 
                        saldoOdometro: 0 
                    });
                    alteracoes++;
                } else {
                    let odoReal = window.safeCurrency(abast.odometroPainel);
                    if (odoReal >= odoAtualTimeline || odoAtualTimeline === 0) {
                        let odoAnteriorSist = odoAtualTimeline;
                        odoAtualTimeline = odoReal; 
                        let odoProjSist = odoAnteriorSist + avanco;
                        let novoSaldo = (odoReal - odoAnteriorSist) - avanco;
                        batch.update(docSnap.ref, { 
                            odometroSistemaAnterior: odoAnteriorSist, 
                            odometroSistema: odoProjSist, 
                            saldoOdometro: novoSaldo 
                        });
                        alteracoes++;
                    }
                }
            }
        });
        batch.update(veicRef, { odometro: odoAtualTimeline });
        if (alteracoes > 0 || abastSnap.size > 0) await batch.commit();
    } catch (error) { console.error("Erro no recálculo cronológico:", error); }
};

window.reprocessarFrotaMes = async function(mesIso) {
    if(!mesIso) return alert("Selecione um mês na Auditoria.");
    if(!confirm(`RECALCULAR FROTA GLOBAL: O sistema irá varrer a linha do tempo de todos os veículos. Confirmar?`)) return;
    
    let btn = document.querySelector('.ferramentas-auditoria .btn-warning');
    window.toggleButtonLoading(btn, true, "Recalculando..."); 
    window.loading(true, "Recalculando Cadeia de Frota Global...");
    
    try {
        let placas = [...new Set(window.DADOS_ABASTECIMENTOS.map(a => a.placa))];
        for (let placa of placas) { await window.reprocessarHistoricoVeiculo(placa); }
        await window.buscarTudo(); 
        alert("Todos os hodômetros da frota foram reprocessados com sucesso!");
    } catch(e) { 
        alert("Erro no reprocessamento: " + e.message); 
    } finally { 
        window.toggleButtonLoading(btn, false); window.loading(false); 
    }
};

window.renderAnaliseFrota = function() {
    let elAnalise = document.getElementById('tbAnaliseBody');
    let elFreq = document.getElementById('listaAltaFrequencia');
    let elCons = document.getElementById('listaMaiorConsumo');
    
    if(!elAnalise) return;

    let mesAtual = new Date().toISOString().slice(0, 7);
    let analise = window.DADOS_VEICULOS.map(v => {
        let concluidosMes = window.DADOS_ABASTECIMENTOS.filter(a => a.placa === v.id && a.status === 'Concluído' && a.dataAbastecimento.startsWith(mesAtual));
        concluidosMes.sort((a,b) => new Date(b.dataAbastecimento) - new Date(a.dataAbastecimento));
        let ultimo = concluidosMes[0]; 
        let saldoUltimo = ultimo ? window.safeCurrency(ultimo.saldoOdometro) : 0;
        let desviosNegativos = concluidosMes.filter(a => window.safeCurrency(a.saldoOdometro) < -20).length;
        
        return { placa: v.id, modelo: v.modelo || '', secretaria: v.secretaria || 'N/A', destinacao: v.destinacao || 'GERAL', odometro: v.odometro || 0, tipoFrota: v.tipoFrota, saldoUltimo: saldoUltimo, qtdAbastecimentosMes: concluidosMes.length, alertasDesvio: desviosNegativos };
    });
    
    analise.sort((a,b) => b.qtdAbastecimentosMes - a.qtdAbastecimentosMes);
    let h = ''; let hAlertaFrequencia = ''; let hAlertaConsumo = '';
    
    analise.forEach(v => {
        let isCritico = v.alertasDesvio > 1 || v.qtdAbastecimentosMes > 8; 
        h += `<tr class="${isCritico ? 'linha-critica' : ''} tr-auditoria">
            <td class="fw-bold placa-busca text-start">${v.placa}<br><small class="text-muted fw-normal">${v.modelo}</small></td>
            <td>${v.secretaria}<br><small class="text-primary fw-bold">${v.destinacao}</small></td>
            <td class="text-dark fw-bold">${v.odometro.toFixed(1)} <small class="text-muted">${v.tipoFrota === 'Máquina' ? 'h' : 'km'}</small></td>
            <td><span class="badge bg-dark">${v.qtdAbastecimentosMes} no mês</span></td>
            <td class="fw-bold ${v.saldoUltimo < -20 ? 'text-danger' : (v.saldoUltimo > 20 ? 'text-warning' : 'text-success')} fs-6 bg-light border-start">${v.saldoUltimo > 0 ? '+'+v.saldoUltimo.toFixed(1) : v.saldoUltimo.toFixed(1)}</td>
        </tr>`;
        if(v.qtdAbastecimentosMes > 8) hAlertaFrequencia += `<div class="mb-1 border-bottom pb-1"><b class="text-danger">${v.placa}</b>: Alta frequência (<b>${v.qtdAbastecimentosMes} idas ao posto</b> no mês).</div>`;
        if(v.alertasDesvio > 1) hAlertaConsumo += `<div class="mb-1 border-bottom pb-1"><b class="text-danger">${v.placa}</b>: <b>Alto consumo detectado</b> (Múltiplos desvios negativos de km).</div>`;
    });
    
    elAnalise.innerHTML = h;
    if(elFreq) elFreq.innerHTML = hAlertaFrequencia || '<div class="text-success fw-bold mt-2"><i class="fas fa-check-circle"></i> Frequência de abastecimentos normalizada.</div>';
    if(elCons) elCons.innerHTML = hAlertaConsumo || '<div class="text-success fw-bold mt-2"><i class="fas fa-check-circle"></i> Sem anomalias de consumo detectadas.</div>';
};

window.filtrarRelatorio = function() {
    let ids = ['fIni', 'fFim', 'fSec', 'fDest', 'fComb', 'fPosto', 'fTexto', 'fOrigem', 'fOrigemLanc'];
    let els = {}; ids.forEach(id => els[id] = document.getElementById(id));

    let fIni = els.fIni ? els.fIni.value : ''; 
    let fFim = els.fFim ? els.fFim.value : '';
    let fSec = els.fSec ? els.fSec.value.toUpperCase() : ''; 
    let fDest = els.fDest ? els.fDest.value.toUpperCase() : '';
    let fComb = els.fComb ? els.fComb.value : ''; 
    let fPosto = els.fPosto ? els.fPosto.value.toUpperCase() : '';
    let fTxt = els.fTexto ? els.fTexto.value.toUpperCase() : '';
    let fOrigem = els.fOrigem ? els.fOrigem.value : ''; 
    let fOrigemLanc = els.fOrigemLanc ? els.fOrigemLanc.value : ''; 

    let tituloImp = "MAPA OFICIAL DE ABASTECIMENTO";
    let elTitulo = document.getElementById('tituloMapaPrint');
    if(elTitulo) {
        if (fIni && fFim && fIni === fFim) tituloImp = "MAPA DIÁRIO - " + fIni.split('-').reverse().join('/');
        else if (fIni && fFim) tituloImp = "MAPA DE (" + fIni.split('-').reverse().join('/') + " A " + fFim.split('-').reverse().join('/') + ")";
        elTitulo.innerText = tituloImp;
    }

    let concluidos = window.DADOS_ABASTECIMENTOS.filter(a => String(a.status).toLowerCase() === 'concluído');
    const userSecs = window.USUARIO.secretarias || []; 
    const podeVerTudo = userSecs.includes('TODAS');

    let filtrados = concluidos.filter(a => {
        let v = window.DADOS_VEICULOS.find(x => x.id === a.placa);
        a.modelo = v ? v.modelo : '-'; 
        a.secretariaReal = a.secretaria || (v ? v.secretaria : '-'); 
        a.destinacaoReal = a.destinacao || (v ? v.destinacao : 'GERAL') || 'GERAL';
        let origemReal = v ? (v.origem || 'Próprio') : 'Avulso';
        
        if(!podeVerTudo && !userSecs.includes(a.secretariaReal)) return false;
        if(fIni && a.dataAbastecimento < fIni) return false; 
        if(fFim && a.dataAbastecimento > fFim + "T23:59") return false;
        if(fSec && a.secretariaReal !== fSec) return false; 
        if(fDest && a.destinacaoReal !== fDest) return false;
        if(fComb && a.tipoCombustivel !== fComb) return false; 
        if(fPosto && String(a.nomePosto || '').toUpperCase() !== fPosto) return false;
        if(fOrigem && origemReal !== fOrigem) return false;
        
        if(fOrigemLanc === 'App' && a.lancamentoManual === true) return false;
        if(fOrigemLanc === 'Manual' && !a.lancamentoManual) return false;
        if(fOrigemLanc === 'ExtraPosto' && (!a.lancamentoManual || !String(a.nomeFrentista).includes('(Posto Extra)'))) return false;
        if(fOrigemLanc === 'ExtraADM' && (!a.lancamentoManual || !String(a.nomeFrentista).includes('(ADM)'))) return false;
        
        if(fTxt) { 
            let sTxt = `${a.placa} ${a.placaExibicao||''} ${a.modelo} ${a.motorista} ${a.nomePosto}`.toUpperCase(); 
            if(!sTxt.includes(fTxt)) return false; 
        }
        return true;
    });

    let tValor = 0, tLitros = 0; 
    filtrados.forEach(a => { tValor += window.safeCurrency(a.valorTotal); tLitros += window.safeCurrency(a.quantidade); });
    
    if(document.getElementById('kpiValor')) document.getElementById('kpiValor').innerText = tValor.toLocaleString('pt-BR', {minimumFractionDigits: 2});
    if(document.getElementById('kpiLitros')) document.getElementById('kpiLitros').innerText = tLitros.toLocaleString('pt-BR', {minimumFractionDigits: 2});
    if(document.getElementById('kpiQtd')) document.getElementById('kpiQtd').innerText = filtrados.length;
    
    filtrados.sort((a,b) => new Date(b.dataAbastecimento) - new Date(a.dataAbastecimento)); 
    let html = '';
    filtrados.forEach(a => {
        let dFmt = new Date(a.dataAbastecimento).toLocaleString('pt-BR').slice(0, 16);
        let v = window.DADOS_VEICULOS.find(x => x.id === a.placa);
        let origemInd = (v && v.origem === 'Locado') ? ' <span class="badge bg-info text-dark" title="Locado">L</span>' : '';
        let placaShow = a.placaExibicao ? `<span class="text-danger" title="Placa na Bomba: ${a.placaExibicao}">${a.placa}*</span>` : a.placa;
        let textSec = a.secretariaReal; if(a.destinacaoReal && a.destinacaoReal !== 'GERAL') textSec += `<br><small class="text-primary fw-bold">${a.destinacaoReal}</small>`;
        
        // Versão Blindada do badgeStatus
        let badgeStatus = `<span class="badge bg-secondary">-</span>`;
        if (a.statusConsumo) {
            if (a.statusConsumo.includes('Gastão')) badgeStatus = `<span class="badge bg-danger">Gastão</span>`;
            else if (a.statusConsumo.includes('Econômico')) badgeStatus = `<span class="badge bg-success">Econômico</span>`;
            else if (a.statusConsumo.includes('Na média')) badgeStatus = `<span class="badge bg-info text-dark">Na média</span>`;
        }

        html += `<tr><td class="text-nowrap">${dFmt}</td><td class="fw-bold text-nowrap">${placaShow}${origemInd}</td><td class="text-nowrap">${textSec}</td><td><small class="text-muted fw-bold">${a.nomePosto || '-'}</small></td><td><small class="text-secondary fw-bold">${a.tipoCombustivel || '-'}</small></td><td><small class="text-dark fw-bold">R$ ${window.safeCurrency(a.precoUnitario).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</small></td><td class="text-primary fw-bold">${window.safeCurrency(a.quantidade).toLocaleString('pt-BR', {minimumFractionDigits: 3})}</td><td class="text-success fw-bold">${window.safeCurrency(a.valorTotal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td><td class="text-dark fw-bold bg-light">${a.odometroSistema ? window.safeCurrency(a.odometroSistema).toFixed(1) : '-'}</td><td>${badgeStatus}</td><td class="d-print-none text-nowrap"><button onclick="window.abrirModalLancamentoAdm('${a.id}')" class="btn btn-sm btn-outline-dark" title="Editar"><i class="fas fa-edit"></i></button> <button onclick="window.excluirAbastecimento('${a.id}', '${a.placa}')" class="btn btn-sm btn-outline-danger ms-1" title="Excluir"><i class="fas fa-trash"></i></button></td></tr>`;
    });
    
    let elTbRelat = document.getElementById('tbRelatBody');
    if(elTbRelat) elTbRelat.innerHTML = html;
};

window.imprimirDiario = function() {
    let d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    let dataEscolhida = prompt("Informe a data para gerar o Mapa Diário (Formato: DD/MM/AAAA):", d.toISOString().slice(0, 10).split('-').reverse().join('/'));
    if(!dataEscolhida) return; 
    let dataLimpa = dataEscolhida.replace(/\D/g, ''); 
    if(dataLimpa.length !== 8) return alert("Por favor, digite a data no formato correto: Dia, Mês e Ano (Ex: 10/04/2026)");
    
    let dataIso = `${dataLimpa.substring(4, 8)}-${dataLimpa.substring(2, 4)}-${dataLimpa.substring(0, 2)}`;
    let elIni = document.getElementById('fIni'); let elFim = document.getElementById('fFim');
    if(elIni) elIni.value = dataIso; if(elFim) elFim.value = dataIso;
    
    window.filtrarRelatorio(); 
    setTimeout(() => { 
        let area = document.getElementById('areaImpressao');
        if(!area) return;
        let printDiv = area.outerHTML; 
        let win = window.open('', '_blank', 'width=1000,height=600');
        win.document.write(`<html><head><title>Mapa Diário</title><link href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" rel="stylesheet"><style>body { font-family: 'Segoe UI', Arial, sans-serif; padding: 25px; } table { font-size: 11px; } th { background-color: #eee !important; color: #000 !important; }</style></head><body>${printDiv} ${window.BLOCO_ASSINATURA} <script>setTimeout(() => { window.print(); window.close(); }, 500);<\/script></body></html>`);
        win.document.close();
    }, 500); 
};
import { db } from './firebase-env.js';
import { doc, setDoc, getDoc, getDocs, collection } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// =========================================================================
// 1. FECHAMENTO E TRAVAS DE MÊS (AUDITORIA)
// =========================================================================
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
    return { Gasolina: window.safeCurrency(p.Gasolina), Diesel: window.safeCurrency(p.Diesel), Etanol: window.safeCurrency(p.Etanol) };
};

window.isMesTrancado = async function(dataIsoCompleta) {
    if(!dataIsoCompleta || !window.tenant) return false;
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
            if (confirm(`Deseja TRANCAR o mês ${mesSelecionado}? Lançamentos retroativos não serão mais permitidos neste período.`)) { 
                await setDoc(docRef, { fechado: true, dataFechamento: new Date().toISOString() }, { merge: true }); alert("Mês trancado!"); 
            } 
        }
        await window.verificarStatusMes(); 
    } catch (e) { alert("Erro ao alterar status do mês."); console.error(e); } finally { window.toggleButtonLoading(btn, false); }
};

// =========================================================================
// 2. NOVA AUDITORIA CIRÚRGICA DE FROTAS (Sem reprocessamento em cadeia)
// =========================================================================
window.renderAnaliseFrota = function() {
    let elAnalise = document.getElementById('tbAnaliseBody');
    let elFreq = document.getElementById('listaAltaFrequencia');
    let elCons = document.getElementById('listaMaiorConsumo');
    
    if(!elAnalise) return;

    let mesAtual = new Date().toISOString().slice(0, 7);
    let analise = window.DADOS_VEICULOS.map(v => {
        let concluidosMes = window.DADOS_ABASTECIMENTOS.filter(a => a.placa === v.id && a.status === 'Concluído' && a.dataAbastecimento.startsWith(mesAtual));
        concluidosMes.sort((a,b) => new Date(b.dataAbastecimento) - new Date(a.dataAbastecimento));
        
        let alertasDesvio = 0; // Removida a dependência de "saldoOdometro" do BD. Agora é calculado no renderAuditoria.
        
        return { 
            placa: v.id, 
            modelo: v.modelo || v.veiculo || '', 
            secretaria: v.secretaria || v.sec || 'N/A', 
            destinacao: v.destinacao || 'GERAL', 
            odometro: v.km_atual || v.odometro || 0, 
            tipoFrota: v.tipo_padronizado || v.tipoFrota, 
            qtdAbastecimentosMes: concluidosMes.length, 
            alertasDesvio: alertasDesvio 
        };
    });
    
    analise.sort((a,b) => b.qtdAbastecimentosMes - a.qtdAbastecimentosMes);
    let h = ''; let hAlertaFrequencia = ''; let hAlertaConsumo = '';
    
    analise.forEach(v => {
        let isCritico = v.qtdAbastecimentosMes > 8; 
        h += `<tr class="${isCritico ? 'linha-critica' : ''} tr-auditoria">
            <td class="fw-bold placa-busca text-start">${v.placa}<br><small class="text-muted fw-normal">${v.modelo}</small></td>
            <td>${v.secretaria}<br><small class="text-primary fw-bold">${v.destinacao}</small></td>
            <td class="text-dark fw-bold">${v.odometro.toFixed(1)} <small class="text-muted">${v.tipoFrota === 'Máquina' ? 'h' : 'km'}</small></td>
            <td><span class="badge bg-dark">${v.qtdAbastecimentosMes} no mês</span></td>
            <td class="fw-bold text-success fs-6 bg-light border-start"><i class="fas fa-check"></i> Monitorado</td>
        </tr>`;
        if(v.qtdAbastecimentosMes > 8) hAlertaFrequencia += `<div class="mb-1 border-bottom pb-1"><b class="text-danger">${v.placa}</b>: Alta frequência (<b>${v.qtdAbastecimentosMes} idas ao posto</b> no mês).</div>`;
    });
    
    elAnalise.innerHTML = h;
    if(elFreq) elFreq.innerHTML = hAlertaFrequencia || '<div class="text-success fw-bold mt-2"><i class="fas fa-check-circle"></i> Frequência de abastecimentos normalizada.</div>';
    if(elCons) elCons.innerHTML = hAlertaConsumo || '<div class="text-success fw-bold mt-2"><i class="fas fa-check-circle"></i> Análise de Média Ativa (Baseada nos lançamentos mais recentes)</div>';
};

window.renderAuditoria = function() {
    let mesFiltro = document.getElementById('fMesAuditoria') ? document.getElementById('fMesAuditoria').value : '';
    if(!mesFiltro) {
        let d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        mesFiltro = d.toISOString().slice(0, 7);
        if(document.getElementById('fMesAuditoria')) document.getElementById('fMesAuditoria').value = mesFiltro;
    }

    let hAuditoria = '';
    let abastecimentosAgrupados = {};

    window.DADOS_ABASTECIMENTOS.filter(a => a.status === 'Concluído').forEach(a => {
        if(!abastecimentosAgrupados[a.placa]) abastecimentosAgrupados[a.placa] = [];
        abastecimentosAgrupados[a.placa].push(a);
    });

    let listaAuditoria = [];

    for(let placa in abastecimentosAgrupados) {
        let abasts = abastecimentosAgrupados[placa];
        abasts.sort((a,b) => new Date(a.dataAbastecimento) - new Date(b.dataAbastecimento));

        for(let i = 0; i < abasts.length; i++) {
            let a = abasts[i];
            if(!a.dataAbastecimento.startsWith(mesFiltro)) continue;

            let tempoUltimo = '-'; let alertaTempo = false; let diffKm = 0; let kmlReal = 0; let saldoLocal = 0;
            
            if(i > 0) {
                let ant = abasts[i-1];
                let dataAtual = new Date(a.dataAbastecimento);
                let dataAnt = new Date(ant.dataAbastecimento);
                let diffMs = dataAtual - dataAnt;
                let diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
                let diffMin = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                
                tempoUltimo = `${diffHoras}h ${diffMin}m`;
                if(diffHoras < 3) alertaTempo = true; 
                
                let odoAnt = window.safeCurrency(ant.odometroPainel);
                let odoAt = window.safeCurrency(a.odometroPainel);
                
                if(odoAnt > 0 && odoAt > odoAnt) {
                    diffKm = odoAt - odoAnt;
                    let lts = window.safeCurrency(a.quantidade);
                    kmlReal = (lts > 0) ? (diffKm / lts) : 0;
                    
                    let veic = window.DADOS_VEICULOS.find(x => x.id === a.placa);
                    let baseMedia = veic ? window.safeCurrency(veic.media) : 0;
                    
                    if(baseMedia > 0) {
                        let esperadoKm = lts * baseMedia;
                        saldoLocal = diffKm - esperadoKm;
                    }
                }
            }

            let alertaKm = false;
            if(saldoLocal < -15 || saldoLocal > 100) alertaKm = true; 

            listaAuditoria.push({
                a: a, tempoUltimo, alertaTempo, 
                odoPainel: window.safeCurrency(a.odometroPainel), 
                kmlReal, saldoLocal, alertaKm, dataObj: new Date(a.dataAbastecimento)
            });
        }
    }

    listaAuditoria.sort((a,b) => b.dataObj - a.dataObj);

    listaAuditoria.forEach(item => {
        let a = item.a;
        let v = window.DADOS_VEICULOS.find(x => x.id === a.placa);
        let dFmt = item.dataObj.toLocaleString('pt-BR').slice(0, 16);
        
        let txtPainel = (item.odoPainel > 0) ? item.odoPainel.toFixed(1) : '<span class="text-muted">-</span>';
        let txtSaldo = (item.saldoLocal !== 0) ? (item.saldoLocal > 0 ? '+'+item.saldoLocal.toFixed(1) : item.saldoLocal.toFixed(1)) : '-';
        
        let corTempo = item.alertaTempo ? 'text-danger fw-bold' : 'text-dark';
        let iconeTempo = item.alertaTempo ? '<i class="fas fa-exclamation-triangle" title="Menos de 3h entre abastecimentos"></i> ' : '';
        let corSaldo = item.saldoLocal >= 0 ? (item.alertaKm ? 'text-warning text-dark fw-bold' : 'text-success') : 'text-danger fw-bold';
        
        let statusClasse = (item.alertaTempo || item.alertaKm) ? 'linha-atencao' : 'linha-ok';

        let badgeStatus = '-';
        if(item.kmlReal > 0 && v && window.safeCurrency(v.media) > 0) {
             let base = window.safeCurrency(v.media);
             if (item.kmlReal < (base * 0.7)) badgeStatus = `<span class="badge bg-danger" title="Média Real: ${item.kmlReal.toFixed(2)} (Base: ${base})"><i class="fas fa-arrow-down"></i> Baixo Rencimento</span>`;
             else if (item.kmlReal > (base * 1.3)) badgeStatus = `<span class="badge bg-warning text-dark" title="Média Real: ${item.kmlReal.toFixed(2)} (Base: ${base})"><i class="fas fa-arrow-up"></i> Alto Desvio</span>`;
             else badgeStatus = `<span class="badge bg-success" title="Média Real: ${item.kmlReal.toFixed(2)} (Base: ${base})"><i class="fas fa-check"></i> Na média</span>`;
        }
        
        hAuditoria += `<tr class="${statusClasse} tr-auditoria">
            <td>${dFmt}</td>
            <td class="fw-bold text-dark placa-busca">${a.placa}<br><small class="text-muted fw-normal">${v ? v.modelo || v.veiculo : '-'}</small></td>
            <td><small>${a.nomePosto || '-'}</small></td>
            <td class="${corTempo}">${iconeTempo}${item.tempoUltimo}</td>
            <td class="fw-bold border-start">${txtPainel}</td>
            <td>${badgeStatus}</td>
            <td class="${corSaldo} border-end">${txtSaldo}</td>
        </tr>`;
    });
    
    if(document.getElementById('tbAuditoriaBody')) {
        document.getElementById('tbAuditoriaBody').innerHTML = hAuditoria || '<tr><td colspan="7" class="text-muted py-4">Nenhum registro no mês selecionado.</td></tr>';
    }
};

window.filtrarAuditoriaVisual = function() {
    let placaStr = document.getElementById('fAuditoriaPlaca') ? document.getElementById('fAuditoriaPlaca').value.toUpperCase() : '';
    let statusSel = document.getElementById('fAuditoriaStatus') ? document.getElementById('fAuditoriaStatus').value : 'todos';

    let linhas = document.querySelectorAll('.tr-auditoria');
    linhas.forEach(linha => {
        let textoPlaca = linha.querySelector('.placa-busca') ? linha.querySelector('.placa-busca').innerText.toUpperCase() : '';
        let isAlerta = linha.classList.contains('linha-critica') || linha.classList.contains('linha-atencao');

        let mostraPlaca = textoPlaca.includes(placaStr);
        let mostraStatus = true;
        if (statusSel === 'alerta' && !isAlerta) mostraStatus = false;
        if (statusSel === 'ok' && isAlerta) mostraStatus = false;

        linha.style.display = (mostraPlaca && mostraStatus) ? '' : 'none';
    });
};

window.imprimirAuditoria = function() {
    let hOciosidade = document.getElementById('tabelaOciosidade').outerHTML;
    let hDesvios = document.getElementById('tabelaAuditoriaSaldos').outerHTML;
    let mes = document.getElementById('fMesAuditoria').value.split('-').reverse().join('/');

    let win = window.open('', '_blank', 'width=1000,height=600');
    win.document.write(`
        <html><head><title>Relatório de Auditoria de Frota</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 25px; }
            h3 { text-align: center; text-transform: uppercase; margin-bottom: 20px; color: #333; border-bottom: 2px solid #000; padding-bottom: 10px; }
            h4 { margin-top: 30px; color: #555; font-size: 16px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; text-align: center; font-size: 12px; margin-bottom: 20px; border: 1px solid #ccc; }
            th, td { border: 1px solid #ccc; padding: 8px; }
            th { background-color: #f2f2f2; }
            .text-danger { color: red; }
            .text-success { color: green; }
            .text-primary { color: blue; }
            .text-warning { color: darkgoldenrod; }
            .text-muted { color: gray; }
            .fw-bold { font-weight: bold; }
            .badge { border: 1px solid #000; padding: 3px 5px; font-size: 10px; border-radius: 4px; }
            .bg-danger { background-color: #f8d7da !important; color: #721c24 !important; }
            .bg-warning { background-color: #fff3cd !important; color: #856404 !important; }
            .linha-critica { background-color: #ffeeee !important; font-weight: bold; }
            .linha-atencao { background-color: #fffdf2 !important; }
        </style>
        </head><body>
            <h3>RELATÓRIO DE AUDITORIA DE FROTA - MÊS: ${mes}</h3>
            <h4><i class="fas fa-parking"></i> STATUS ATUAL DA FROTA</h4>
            ${hOciosidade}
            <h4><i class="fas fa-shield-alt"></i> HISTÓRICO DE DESVIOS E ABASTECIMENTOS DO MÊS</h4>
            ${hDesvios}
            ${window.BLOCO_ASSINATURA}
            <script>setTimeout(() => { window.print(); window.close(); }, 500);<\/script>
        </body></html>
    `);
    win.document.close();
};

// =========================================================================
// 3. MAPAS GERENCIAIS E IMPRESSÕES GERAIS
// =========================================================================
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
        a.modelo = v ? (v.modelo || v.veiculo) : '-'; 
        a.secretariaReal = a.secretaria || (v ? (v.secretaria || v.sec) : '-'); 
        a.destinacaoReal = a.destinacao || (v ? (v.destinacao || 'GERAL') : 'GERAL') || 'GERAL';
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
            let sTxt = `${a.placa} ${a.placaExibicao||''} ${a.modelo} ${a.motorista||''} ${a.nomePosto||''}`.toUpperCase(); 
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
        
        let odoStr = (a.odometroPainel > 0) ? a.odometroPainel.toFixed(1) : '-';

        html += `<tr><td class="text-nowrap">${dFmt}</td><td class="fw-bold text-nowrap">${placaShow}${origemInd}</td><td class="text-nowrap">${textSec}</td><td><small class="text-muted fw-bold">${a.nomePosto || '-'}</small></td><td><small class="text-secondary fw-bold">${a.tipoCombustivel || '-'}</small></td><td><small class="text-dark fw-bold">R$ ${window.safeCurrency(a.precoUnitario).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</small></td><td class="text-primary fw-bold">${window.safeCurrency(a.quantidade).toLocaleString('pt-BR', {minimumFractionDigits: 3})}</td><td class="text-success fw-bold">${window.safeCurrency(a.valorTotal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td><td class="text-dark fw-bold bg-light">${odoStr}</td><td>-</td><td class="d-print-none text-nowrap"><button onclick="window.abrirModalLancamentoAdm('${a.id}')" class="btn btn-sm btn-outline-dark" title="Editar"><i class="fas fa-edit"></i></button> <button onclick="window.excluirAbastecimento('${a.id}', '${a.placa}')" class="btn btn-sm btn-outline-danger ms-1" title="Excluir"><i class="fas fa-trash"></i></button></td></tr>`;
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
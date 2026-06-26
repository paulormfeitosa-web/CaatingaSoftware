import { db } from './firebase-env.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// =========================================================================
// 1. FECHAMENTO E TRAVAS DE MÊS
// =========================================================================
window.obterPrecoVigente = function(nomePosto, dataIsoBase) {
    if (!window.DADOS_POSTOS) return { Gasolina: 0, Diesel: 0, Etanol: 0 };
    let p = window.DADOS_POSTOS.find(x => x.nome === nomePosto);
    if(!p || !dataIsoBase) return { Gasolina: 0, Diesel: 0, Etanol: 0 };
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
            btn.innerHTML = '<i class="fas fa-lock"></i> Mês Fechado'; 
            btn.dataset.status = "fechado";
        } else {
            btn.className = "btn btn-success fw-bold shadow-sm text-nowrap"; 
            btn.innerHTML = '<i class="fas fa-lock-open"></i> Mês Aberto'; 
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
    
    if(window.toggleButtonLoading) window.toggleButtonLoading(btn, true);
    try {
        if (isFechado) { 
            if (confirm(`Deseja REABRIR o mês ${mesSelecionado} para edições?`)) { 
                await setDoc(docRef, { fechado: false }, { merge: true }); alert("Mês reaberto com sucesso."); 
            } 
        } else { 
            if (confirm(`Deseja TRANCAR o mês ${mesSelecionado}? Edições não serão mais permitidas.`)) { 
                await setDoc(docRef, { fechado: true, dataFechamento: new Date().toISOString() }, { merge: true }); alert("Mês trancado e protegido."); 
            } 
        }
        await window.verificarStatusMes(); 
    } catch (e) { alert("Erro ao alterar status."); console.error(e); } 
    finally { if(window.toggleButtonLoading) window.toggleButtonLoading(btn, false); }
};

// =========================================================================
// 2. AUDITORIA VISUAL AVANÇADA
// =========================================================================
window.renderAnaliseFrota = function() {
    let mesAtual = new Date().toISOString().slice(0, 7);
    let elFreq = document.getElementById('listaVisualAltaFrequencia');
    let elCons = document.getElementById('listaVisualMaiorConsumo');
    let kpiFreq = document.getElementById('audi-kpi-freq');
    
    let analise = window.DADOS_VEICULOS.map(v => {
        let concluidosMes = window.DADOS_ABASTECIMENTOS.filter(a => a.placa === v.id && a.status === 'Concluído' && a.dataAbastecimento && a.dataAbastecimento.startsWith(mesAtual));
        return { placa: v.id, qtdAbastecimentosMes: concluidosMes.length };
    });
    
    analise.sort((a,b) => b.qtdAbastecimentosMes - a.qtdAbastecimentosMes);
    let hAlertaFrequencia = '';
    let totalAlertasFreq = 0;
    
    analise.forEach(v => {
        if(v.qtdAbastecimentosMes > 8) {
            totalAlertasFreq++;
            hAlertaFrequencia += `<div class="mb-2 p-2 bg-white border border-danger rounded shadow-sm d-flex justify-content-between align-items-center"><b class="text-danger">${v.placa}</b> <span class="badge bg-danger rounded-pill">${v.qtdAbastecimentosMes} Idas ao Posto</span></div>`;
        }
    });
    
    if(kpiFreq) kpiFreq.innerText = totalAlertasFreq;
    if(elFreq) elFreq.innerHTML = hAlertaFrequencia || '<div class="text-success fw-bold mt-2"><i class="fas fa-check-circle"></i> Nenhuma anomalia de frequência.</div>';
    if(elCons) elCons.innerHTML = '<div class="text-success fw-bold mt-2"><i class="fas fa-check-circle"></i> As anomalias de média baseadas no histórico real são exibidas na tabela abaixo.</div>';
};

window.renderAuditoriaVisual = function() {
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
    let contOK = 0, contDesvio = 0;

    for(let placa in abastecimentosAgrupados) {
        let abasts = abastecimentosAgrupados[placa];
        
        let abastsOrdenadosTudo = [...abasts].sort((x,y) => new Date(x.dataAbastecimento || 0) - new Date(y.dataAbastecimento || 0));
        let histKm = 0, histLts = 0;
        if(abastsOrdenadosTudo.length > 1) {
            let pPrimeiroOdo = window.safeCurrency(abastsOrdenadosTudo[0].odometroPainel);
            let pUltimoOdo = window.safeCurrency(abastsOrdenadosTudo[abastsOrdenadosTudo.length-1].odometroPainel);
            if (pUltimoOdo > pPrimeiroOdo) {
                histKm = pUltimoOdo - pPrimeiroOdo;
                for(let j=1; j<abastsOrdenadosTudo.length; j++) histLts += window.safeCurrency(abastsOrdenadosTudo[j].quantidade);
            }
        }
        let mediaHistorica = (histKm > 0 && histLts > 0) ? (histKm / histLts) : 0;

        for(let i = 0; i < abastsOrdenadosTudo.length; i++) {
            let a = abastsOrdenadosTudo[i];
            if(!a.dataAbastecimento || !a.dataAbastecimento.startsWith(mesFiltro)) continue;

            let tempoUltimo = '-'; let alertaTempo = false; let diffKm = 0; let kmlReal = 0;
            
            if(i > 0) {
                let ant = abastsOrdenadosTudo[i-1];
                if(a.dataAbastecimento && ant.dataAbastecimento) {
                    let dataAtual = new Date(a.dataAbastecimento);
                    let dataAnt = new Date(ant.dataAbastecimento);
                    let diffMs = dataAtual - dataAnt;
                    let diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
                    let diffMin = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    tempoUltimo = `${diffHoras}h ${diffMin}m`;
                    if(diffHoras < 3) alertaTempo = true; 
                }
                
                let odoAnt = window.safeCurrency(ant.odometroPainel);
                let odoAt = window.safeCurrency(a.odometroPainel);
                if(odoAnt > 0 && odoAt > odoAnt) {
                    diffKm = odoAt - odoAnt;
                    let lts = window.safeCurrency(a.quantidade);
                    kmlReal = (lts > 0) ? (diffKm / lts) : 0;
                }
            }

            listaAuditoria.push({ a: a, tempoUltimo, alertaTempo, odoPainel: window.safeCurrency(a.odometroPainel), kmlReal, mediaHistorica, dataObj: new Date(a.dataAbastecimento) });
        }
    }

    listaAuditoria.sort((a,b) => b.dataObj - a.dataObj);

    listaAuditoria.forEach(item => {
        let a = item.a;
        let v = window.DADOS_VEICULOS.find(x => x.id === a.placa);
        let dFmt = item.dataObj.toLocaleString('pt-BR').slice(0, 16);
        let txtPainel = (item.odoPainel > 0) ? item.odoPainel.toFixed(1) : '<span class="text-muted">-</span>';
        let statusClasse = '';
        let badgeStatus = '<span class="badge bg-secondary">Aguardando Parâmetro</span>';

        if(item.alertaTempo) statusClasse = 'linha-atencao';

        if(item.kmlReal > 0 && item.mediaHistorica > 0) {
             let margemInferior = item.mediaHistorica * 0.7; 
             let margemSuperior = item.mediaHistorica * 1.3; 
             
             if (item.kmlReal < margemInferior) {
                 badgeStatus = `<span class="badge bg-danger shadow-sm"><i class="fas fa-arrow-down"></i> Baixo Rendimento</span>`;
                 statusClasse = 'linha-critica';
                 contDesvio++;
             } else if (item.kmlReal > margemSuperior) {
                 badgeStatus = `<span class="badge bg-warning text-dark shadow-sm"><i class="fas fa-arrow-up"></i> Manipulação Odo.</span>`;
                 statusClasse = 'linha-atencao';
                 contDesvio++;
             } else {
                 badgeStatus = `<span class="badge bg-success shadow-sm"><i class="fas fa-check"></i> Normal</span>`;
                 if(statusClasse === '') statusClasse = 'linha-ok';
                 contOK++;
             }
        } else if (item.odoPainel > 0) {
             badgeStatus = `<span class="badge bg-info text-dark shadow-sm"><i class="fas fa-check"></i> Informado</span>`;
             if(statusClasse === '') statusClasse = 'linha-ok';
             contOK++;
        }

        let txtHistorica = item.mediaHistorica > 0 ? `${item.mediaHistorica.toFixed(1)} Km/L` : 'S/ Dados';
        let txtRendimento = item.kmlReal > 0 ? `${item.kmlReal.toFixed(1)} Km/L` : '-';
        let txtLocal = a.nomePosto ? a.nomePosto : (a.nomeFrentista && a.nomeFrentista.includes('ADM') ? 'Painel Administrativo' : 'Não Informado');
        
        hAuditoria += `<tr class="${statusClasse} tr-auditoria">
            <td class="text-nowrap">${dFmt}</td>
            <td class="fw-bold text-dark placa-busca">${a.placa}<br><small class="text-muted fw-normal">${v ? v.modelo || v.veiculo : '-'}</small></td>
            <td><small class="fw-bold">${txtLocal}</small></td>
            <td class="text-nowrap fw-bold ${item.alertaTempo ? 'text-danger' : 'text-dark'}">${item.tempoUltimo}</td>
            <td class="fw-bold border-start border-dark">${txtPainel}</td>
            <td>${badgeStatus}<br><small class="text-muted" style="font-size:10px;">Base Histórica: ${txtHistorica}</small></td>
            <td class="fw-bold fs-6 ${item.kmlReal > 0 ? 'text-primary' : 'text-muted'}">${txtRendimento}</td>
        </tr>`;
    });
    
    let elTbAud = document.getElementById('tbAuditoriaVisualBody');
    if(elTbAud) elTbAud.innerHTML = hAuditoria || '<tr><td colspan="7" class="text-muted py-5 fw-bold"><i class="fas fa-box-open fs-2 mb-2 d-block"></i>Nenhum registro encontrado neste mês.</td></tr>';

    let elOk = document.getElementById('audi-kpi-ok'); if(elOk) elOk.innerText = contOK;
    let elDesv = document.getElementById('audi-kpi-desvio'); if(elDesv) elDesv.innerText = contDesvio;
    
    if (window.renderAnaliseFrota) window.renderAnaliseFrota();
};

window.filtrarAuditoriaNaTela = function() {
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

window.imprimirPainelAuditoria = function() {
    let hDesvios = document.getElementById('tabelaAuditoriaSaldos').outerHTML;
    let mes = document.getElementById('fMesAuditoria').value.split('-').reverse().join('/');

    let htmlConteudo = `
        <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            h3 { text-align: center; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 5px;}
            p.sub { text-align: center; font-weight: bold; margin-bottom: 20px; color: #444; }
            h4 { color: #222; text-transform: uppercase; margin-top: 20px; font-size: 14px;}
            table { width: 100%; border-collapse: collapse; font-size: 11px; text-align: center; margin-top: 10px; }
            th, td { border: 1px solid #555; padding: 6px; }
            th { background-color: #e0e0e0 !important; font-weight: bold; color: #000; }
            tr { page-break-inside: avoid; }
            .linha-critica { background-color: #ffe6e6 !important; }
            .linha-atencao { background-color: #fff3cd !important; }
            .text-success { color: #006600 !important; }
            .text-primary { color: #0000cc !important; }
            .text-danger { color: #cc0000 !important; }
            .text-warning { color: #cc8800 !important; }
            .badge { padding: 4px; border: 1px solid #ccc; border-radius: 4px; display: inline-block; font-size: 10px; background: #fff;}
        </style>
        <h3>RELATÓRIO GERENCIAL DE AUDITORIA DE FROTA (ANTIFRAUDE)</h3>
        <p class="sub">PERÍODO ANALISADO: ${mes}</p>
        <h4>DETALHAMENTO DE DESVIOS DE MÉDIA</h4>
        ${hDesvios}
        <div style="margin-top: 30px; font-size: 11px; color: #555; padding: 10px; border: 1px dashed #ccc; border-radius: 5px; page-break-inside: avoid;">
          <b>Nota Explicativa:</b><br>
          * A Avaliação de Desempenho acusa anomalia se o KM/L do momento for 30% maior ou menor do que a Base Histórica (média de todo o período no sistema) do próprio veículo.<br>
          * Abastecimentos com menos de 3 horas de diferença apontam erro logístico ou suspeita de fragmentação.
        </div>
    `;
    if(window.imprimirDocumento) window.imprimirDocumento(htmlConteudo, 'Auditoria_Frota_' + mes.replace('/',''));
};

// =========================================================================
// 3. MAPAS GERENCIAIS (Aba Mapa Combustível)
// =========================================================================

window.filtrarRelatorio = function() {
    let ids = ['fIni', 'fFim', 'fSec', 'fDest', 'fComb', 'fPosto', 'fTexto', 'fOrigem', 'fOrigemLanc'];
    let els = {}; ids.forEach(id => els[id] = document.getElementById(id));

    // A MÁGICA DO FILTRO AUTOMÁTICO PARA O MÊS ATUAL
    if (!els.fIni.value && !els.fFim.value) {
        let d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        let ano = d.getFullYear();
        let mes = String(d.getMonth() + 1).padStart(2, '0');
        let ultimoDia = new Date(ano, d.getMonth() + 1, 0).getDate();
        
        els.fIni.value = `${ano}-${mes}-01`;
        els.fFim.value = `${ano}-${mes}-${ultimoDia}`;
    }

    let fIni = els.fIni.value; 
    let fFim = els.fFim.value;
    let fSec = els.fSec.value.toUpperCase(); 
    let fDest = els.fDest.value.toUpperCase();
    let fComb = els.fComb.value; 
    let fPosto = els.fPosto.value.toUpperCase();
    let fTxt = els.fTexto.value.toUpperCase();
    let fOrigem = els.fOrigem.value; 
    let fOrigemLanc = els.fOrigemLanc.value; 

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
        
        if(fIni && (!a.dataAbastecimento || a.dataAbastecimento < fIni)) return false; 
        if(fFim && (!a.dataAbastecimento || a.dataAbastecimento > fFim + "T23:59")) return false;
        
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
    
    filtrados.sort((a,b) => new Date(b.dataAbastecimento || 0) - new Date(a.dataAbastecimento || 0)); 
    let html = '';
    
    filtrados.forEach(a => {
        let dFmt = a.dataAbastecimento ? new Date(a.dataAbastecimento).toLocaleString('pt-BR').slice(0, 16) : '-';
        let v = window.DADOS_VEICULOS.find(x => x.id === a.placa);
        let origemInd = (v && v.origem === 'Locado') ? ' <span class="badge bg-info text-dark" title="Locado">L</span>' : '';
        let placaShow = a.placaExibicao ? `<span class="text-danger" title="Placa na Bomba: ${a.placaExibicao}">${a.placa}*</span>` : a.placa;
        let textSec = a.secretariaReal; if(a.destinacaoReal && a.destinacaoReal !== 'GERAL') textSec += `<br><small class="text-primary fw-bold">${a.destinacaoReal}</small>`;
        
        let odoStr = (a.odometroPainel > 0) ? a.odometroPainel.toFixed(1) : '-';

        html += `<tr>
            <td class="text-nowrap">${dFmt}</td>
            <td class="fw-bold text-nowrap">${placaShow}${origemInd}</td>
            <td class="text-nowrap">${textSec}</td>
            <td><small class="text-muted fw-bold">${a.nomePosto || '-'}</small></td>
            <td><small class="text-secondary fw-bold">${a.tipoCombustivel || '-'}</small></td>
            <td><small class="text-dark fw-bold">R$ ${window.safeCurrency(a.precoUnitario).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</small></td>
            <td class="text-primary fw-bold">${window.safeCurrency(a.quantidade).toLocaleString('pt-BR', {minimumFractionDigits: 3})}</td>
            <td class="text-success fw-bold">${window.safeCurrency(a.valorTotal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
            <td class="text-dark fw-bold bg-light">${odoStr}</td>
            <td class="d-print-none text-nowrap"><button onclick="window.abrirModalLancamentoAdm('${a.id}')" class="btn btn-sm btn-outline-dark" title="Editar"><i class="fas fa-edit"></i></button> <button onclick="window.excluirAbastecimento('${a.id}', '${a.placa}')" class="btn btn-sm btn-outline-danger ms-1" title="Excluir"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });
    
    let elTbRelat = document.getElementById('tbRelatBody');
    if(elTbRelat) elTbRelat.innerHTML = html;
};

// Nova Função Dedicada de Impressão do Mapa
window.imprimirMapa = function() {
    let area = document.getElementById('areaImpressao');
    if(!area) return;
    
    let clone = area.cloneNode(true);
    let acoesH = clone.querySelectorAll('.d-print-none');
    acoesH.forEach(el => el.remove());

    let htmlFinal = `
    <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        h4 { text-align: center; text-transform: uppercase; font-size: 18px; margin-bottom: 20px; color: #222; border-bottom: 2px solid #000; padding-bottom: 10px;}
        .row { display: flex; width: 100%; justify-content: space-between; margin-bottom: 20px; }
        .col-4 { width: 32%; }
        .kpi-card { border: 1px solid #444; padding: 12px; border-radius: 8px; text-align: center; font-weight: bold; background-color: #f9f9f9; }
        .kpi-card h4 { font-size: 18px; margin: 0; padding: 0; border: none; color: #000; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; text-align: center; margin-top: 15px; }
        th, td { border: 1px solid #555; padding: 6px; }
        th { background-color: #e0e0e0 !important; font-weight: bold; color: #000; }
        tr { page-break-inside: avoid; }
        .text-success { color: #006600 !important; }
        .text-primary { color: #0000cc !important; }
        .text-danger { color: #cc0000 !important; }
        .text-muted { color: #666 !important; }
        .d-print-none { display: none !important; }
        .d-none { display: block !important; } /* Força exibir o título do print */
    </style>
    ${clone.outerHTML}
    `;
    if(window.imprimirDocumento) window.imprimirDocumento(htmlFinal, 'Mapa_Abastecimento');
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
    setTimeout(() => { window.imprimirMapa(); }, 500); 
};
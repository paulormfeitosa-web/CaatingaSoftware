// =======================================================
// RENDERIZAÇÃO E CÁLCULOS DE CONTRATOS DE COMBUSTÍVEL
// =======================================================

window.calcularTotaisContrato = function(c) {
    let litrosGasTotal = c.gasolina ? window.safeCurrency(c.gasolina.litros) : 0;
    let litrosDieTotal = c.diesel ? window.safeCurrency(c.diesel.litros) : 0;
    let litrosEtaTotal = c.etanol ? window.safeCurrency(c.etanol.litros) : 0;
    let totalValorContrato = window.safeCurrency(c.valorInicial);

    if(c.aditivos) {
        c.aditivos.forEach(ad => {
            if(ad.combustivel === 'Gasolina') litrosGasTotal += window.safeCurrency(ad.litros);
            if(ad.combustivel === 'Diesel') litrosDieTotal += window.safeCurrency(ad.litros);
            if(ad.combustivel === 'Etanol') litrosEtaTotal += window.safeCurrency(ad.litros);
            totalValorContrato += window.safeCurrency(ad.valor);
        });
    }

    let litrosGasGasto = 0; let litrosDieGasto = 0; let litrosEtaGasto = 0;
    let valorGasto = 0;

    if (window.DADOS_ABASTECIMENTOS) {
        window.DADOS_ABASTECIMENTOS.forEach(a => {
            if(a.status !== 'Concluído') return;

            let aSec = a.secretaria;
            let aDest = a.destinacao || 'GERAL';

            if(!aSec) {
                let v = window.DADOS_VEICULOS && window.DADOS_VEICULOS.find(x => x.id === a.placa);
                aSec = v ? v.secretaria : null;
                if(!a.destinacao && v) aDest = v.destinacao || 'GERAL';
            }

            let checkSec = aSec && c.secretaria && aSec.toUpperCase() === c.secretaria.toUpperCase();
            let checkDest = aDest && c.destinacao && aDest.toUpperCase() === (c.destinacao || 'GERAL').toUpperCase();
            let checkPosto = (!c.posto || c.posto === "TODOS" || String(a.nomePosto).toUpperCase() === String(c.posto).toUpperCase());

            if(checkSec && checkDest && checkPosto) {
                if(a.tipoCombustivel === 'Gasolina' && litrosGasTotal > 0) { litrosGasGasto += window.safeCurrency(a.quantidade); valorGasto += window.safeCurrency(a.valorTotal); }
                if(a.tipoCombustivel === 'Diesel' && litrosDieTotal > 0) { litrosDieGasto += window.safeCurrency(a.quantidade); valorGasto += window.safeCurrency(a.valorTotal); }
                if(a.tipoCombustivel === 'Etanol' && litrosEtaTotal > 0) { litrosEtaGasto += window.safeCurrency(a.quantidade); valorGasto += window.safeCurrency(a.valorTotal); }
            }
        });
    }

    let valorLiquidado = 0;
    if(c.liquidados) { c.liquidados.forEach(l => { valorLiquidado += window.safeCurrency(l.valor); }); }

    let saldoValor = totalValorContrato - valorGasto;
    let saldoPendentePgto = valorGasto - valorLiquidado;

    return {
        litrosGasTotal, litrosDieTotal, litrosEtaTotal, totalValorContrato,
        litrosGasGasto, litrosDieGasto, litrosEtaGasto, valorGasto,
        valorLiquidado, saldoValor, saldoPendentePgto
    };
};

window.renderContratos = function() {
    let elCards = document.getElementById('listaContratosCards');
    if(!elCards) return;

    if(!window.DADOS_CONTRATOS || window.DADOS_CONTRATOS.length === 0) {
        elCards.innerHTML = '<div class="col-12"><div class="alert alert-light border text-center text-muted py-4">Nenhum contrato de combustível cadastrado na base de dados.</div></div>';
        return;
    }

    let fSec = document.getElementById('filtroContratoSec') ? document.getElementById('filtroContratoSec').value.toUpperCase() : '';
    let fDest = document.getElementById('filtroContratoDest') ? document.getElementById('filtroContratoDest').value.toUpperCase() : '';
    let fPosto = document.getElementById('filtroContratoPosto') ? document.getElementById('filtroContratoPosto').value.toUpperCase() : '';

    let contratosOrdenados = [...window.DADOS_CONTRATOS].sort((a,b) => {
        let sA = (a.secretaria || "").toUpperCase(); let sB = (b.secretaria || "").toUpperCase();
        if(sA < sB) return -1; if(sA > sB) return 1;
        let dA = (a.destinacao || 'GERAL').toUpperCase(); let dB = (b.destinacao || 'GERAL').toUpperCase();
        if(dA < dB) return -1; if(dA > dB) return 1;
        return 0;
    });

    let h = '';
    let dHoje = new Date().toISOString().slice(0, 10);
    let countCards = 0;

    contratosOrdenados.forEach(c => {
        if(!c.gasolina && !c.diesel && !c.etanol) return;

        if(fSec && c.secretaria && c.secretaria.toUpperCase() !== fSec) return;
        if(fDest && (c.destinacao || 'GERAL').toUpperCase() !== fDest) return;
        if(fPosto && c.posto && c.posto !== "TODOS" && c.posto.toUpperCase() !== fPosto) return;

        countCards++;
        let totais = window.calcularTotaisContrato(c);
        let corSaldoV = totais.saldoValor < 0 ? 'text-danger' : 'text-success';

        let statusValidade = (c.validade && c.validade < dHoje)
            ? `<span class="badge bg-danger shadow-sm"><i class="fas fa-exclamation-triangle"></i> VENCIDO</span>`
            : `<span class="badge bg-success shadow-sm"><i class="fas fa-calendar-check"></i> Até ${c.validade ? c.validade.split('-').reverse().join('/') : '-'}</span>`;

        let badgePosto = c.posto && c.posto !== "TODOS" ? `<span class="badge bg-dark me-1 mb-1"><i class="fas fa-gas-pump"></i> ${c.posto}</span>` : `<span class="badge bg-secondary me-1 mb-1">Todos Postos</span>`;

        let htmlCombustiveis = '';
        const formataLitro = (valor) => valor.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3});
        const formataMoeda = (valor) => valor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        if(totais.litrosGasTotal > 0) {
            let saldoG = totais.litrosGasTotal - totais.litrosGasGasto;
            let cG = saldoG < 0 ? 'text-danger' : 'text-primary';
            htmlCombustiveis += `<div class="linha-comb d-flex justify-content-between"><span><i class="fas fa-tint text-danger"></i> Gasolina</span> <b><span class="${cG}">${formataLitro(saldoG)} L</span> <small class="text-muted">/ ${formataLitro(totais.litrosGasTotal)} L</small></b></div>`;
        }
        if(totais.litrosDieTotal > 0) {
            let saldoD = totais.litrosDieTotal - totais.litrosDieGasto;
            let cD = saldoD < 0 ? 'text-danger' : 'text-dark';
            htmlCombustiveis += `<div class="linha-comb d-flex justify-content-between"><span><i class="fas fa-tint text-dark"></i> Diesel</span> <b><span class="${cD}">${formataLitro(saldoD)} L</span> <small class="text-muted">/ ${formataLitro(totais.litrosDieTotal)} L</small></b></div>`;
        }
        if(totais.litrosEtaTotal > 0) {
            let saldoE = totais.litrosEtaTotal - totais.litrosEtaGasto;
            let cE = saldoE < 0 ? 'text-danger' : 'text-success';
            htmlCombustiveis += `<div class="linha-comb d-flex justify-content-between"><span><i class="fas fa-tint text-success"></i> Etanol</span> <b><span class="${cE}">${formataLitro(saldoE)} L</span> <small class="text-muted">/ ${formataLitro(totais.litrosEtaTotal)} L</small></b></div>`;
        }

        h += `
        <div class="col-md-6 col-lg-4">
            <div class="card p-3 shadow-sm contract-box h-100 position-relative border-0 rounded-4">
                <button class="btn btn-sm text-danger position-absolute top-0 end-0 m-2" onclick="window.excluirContrato('${c.id}')" title="Excluir Contrato"><i class="fas fa-trash"></i></button>

                <h5 class="fw-bold mb-0 text-dark">${c.secretaria}</h5>
                <div class="fw-bold text-primary mb-1"><i class="fas fa-bullseye"></i> ${c.destinacao || 'GERAL'}</div>
                <small class="text-muted d-block mb-2">Contrato Nº ${c.numero || "S/N"} | ${statusValidade}</small>
                <div class="mb-2">${badgePosto}</div>

                <div class="bg-light p-2 rounded border mb-2">
                    <div class="small text-muted fw-bold mb-1">SALDO DE VOLUME (LITROS):</div>
                    ${htmlCombustiveis}
                </div>

                <div class="bg-white p-2 rounded border mb-2">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="small fw-bold text-muted">Teto Financeiro (R$):</span>
                        <span class="small fw-bold text-dark">R$ ${formataMoeda(totais.totalValorContrato)}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-1">
                        <span class="small fw-bold text-muted">Total Consumido (R$):</span>
                        <span class="small fw-bold text-danger">R$ ${formataMoeda(totais.valorGasto)}</span>
                    </div>
                    <hr class="my-1">
                    <div class="d-flex justify-content-between">
                        <span class="small fw-bold text-muted">SALDO RESTANTE (R$):</span>
                        <span class="small fw-bold ${corSaldoV}">R$ ${formataMoeda(totais.saldoValor)}</span>
                    </div>
                </div>

                <div class="p-2 border rounded border-success mb-3 bg-white">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="small fw-bold text-success">Pago (Liquidado):</span>
                        <span class="small fw-bold text-success">R$ ${formataMoeda(totais.valorLiquidado)}</span>
                    </div>
                    <div class="d-flex justify-content-between">
                        <span class="small fw-bold text-danger">Saldo Devedor:</span>
                        <span class="small fw-bold text-danger">R$ ${formataMoeda(totais.saldoPendentePgto)}</span>
                    </div>
                </div>

                <div class="d-flex gap-1 mt-auto flex-wrap">
                    <button onclick="window.editarContrato('${c.id}')" class="btn btn-outline-dark btn-sm flex-fill fw-bold px-1" title="Editar"><i class="fas fa-edit"></i> Edit</button>
                    <button onclick="window.abrirModalAditivo('${c.id}')" class="btn btn-outline-primary btn-sm flex-fill fw-bold px-1" title="Aditivo/Realinhamento"><i class="fas fa-plus"></i> Aditivo</button>
                    <button onclick="window.abrirModalLiquidar('${c.id}')" class="btn btn-outline-success btn-sm flex-fill fw-bold px-1" title="Informar Pagamento"><i class="fas fa-check"></i> Pagar</button>
                    <button onclick="window.abrirModalExtrato('${c.id}')" class="btn btn-secondary btn-sm flex-fill fw-bold px-1" title="Ver Histórico"><i class="fas fa-list"></i> Extrato</button>
                </div>
            </div>
        </div>`;
    });

    if(countCards === 0) h = '<div class="col-12"><div class="alert alert-light border text-center text-muted py-4">Nenhum contrato encontrado para os filtros selecionados.</div></div>';
    elCards.innerHTML = h;
};

// IMPRESSÃO DOS CONTRATOS (NOVO LAYOUT)
window.imprimirRelatorioContratos = function() {
    let fSec = document.getElementById('filtroContratoSec') ? document.getElementById('filtroContratoSec').value.toUpperCase() : '';
    let fDest = document.getElementById('filtroContratoDest') ? document.getElementById('filtroContratoDest').value.toUpperCase() : '';
    let fPosto = document.getElementById('filtroContratoPosto') ? document.getElementById('filtroContratoPosto').value.toUpperCase() : '';

    let txtSec = fSec ? fSec : "TODAS AS SECRETARIAS";
    let txtDest = fDest ? fDest : "TODAS AS DESTINAÇÕES";
    let txtPosto = fPosto ? fPosto : "TODOS OS POSTOS";

    let htmlTable = `
        <table>
        <thead>
            <tr>
                <th>Secretaria / Destinação</th>
                <th>Posto Vencedor</th>
                <th>Teto Financeiro</th>
                <th>Consumido (R$)</th>
                <th>Saldo Restante</th>
                <th>Pago / Liquidado</th>
                <th>Saldo Devedor</th>
            </tr>
        </thead><tbody>`;

    let totalTeto = 0, totalConsumo = 0, totalSaldo = 0, totalPago = 0, totalDevedor = 0;
    let temContrato = false;

    if (window.DADOS_CONTRATOS) {
        window.DADOS_CONTRATOS.forEach(c => {
            if(!c.gasolina && !c.diesel && !c.etanol) return;
            if(fSec && c.secretaria.toUpperCase() !== fSec) return;
            if(fDest && (c.destinacao || 'GERAL').toUpperCase() !== fDest) return;
            if(fPosto && c.posto && c.posto !== "TODOS" && c.posto.toUpperCase() !== fPosto) return;

            temContrato = true;
            let totais = window.calcularTotaisContrato(c);

            totalTeto += totais.totalValorContrato;
            totalConsumo += totais.valorGasto;
            totalSaldo += totais.saldoValor;
            totalPago += totais.valorLiquidado;
            totalDevedor += totais.saldoPendentePgto;

            htmlTable += `<tr>
                <td style="text-align:left;"><b>${c.secretaria}</b><br><span style="color:#0d6efd; font-size:10px;">${c.destinacao || 'GERAL'}</span></td>
                <td>${c.posto || 'Todos'}</td>
                <td style="color: blue;">R$ ${totais.totalValorContrato.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                <td style="color: red;">R$ ${totais.valorGasto.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                <td style="font-weight:bold;">R$ ${totais.saldoValor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                <td style="color: green;">R$ ${totais.valorLiquidado.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                <td style="color: darkred; font-weight:bold;">R$ ${totais.saldoPendentePgto.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            </tr>`;
        });
    }

    if(!temContrato) {
        htmlTable += `<tr><td colspan="7" style="padding:15px; color:#666;">Nenhum contrato encontrado.</td></tr>`;
    } else {
        htmlTable += `<tr style="background-color: #ddd; font-weight: bold; font-size: 13px;">
            <td colspan="2" style="text-align: right;">TOTAIS GERAIS:</td>
            <td style="color: blue;">R$ ${totalTeto.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="color: red;">R$ ${totalConsumo.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td>R$ ${totalSaldo.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="color: green;">R$ ${totalPago.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="color: darkred;">R$ ${totalDevedor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        </tr>`;
    }
    htmlTable += `</tbody></table>`;

    let htmlFinal = `
        <style>
            @page { size: landscape; margin: 12mm; }
            body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            h3 { text-align: center; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 5px;}
            .text-muted { color: #555; font-size: 12px; text-align: center; display: block; margin-bottom: 20px;}
            table { width: 100%; border-collapse: collapse; font-size: 11px; text-align: center; margin-top: 10px; }
            th, td { border: 1px solid #555; padding: 6px; }
            th { background-color: #e0e0e0 !important; font-weight: bold; color: #000; }
            tr { page-break-inside: avoid; }
        </style>
        <h3>RELATÓRIO GERENCIAL DE CONTRATOS DE COMBUSTÍVEL</h3>
        <div class="text-muted"><b>Filtros</b> &mdash; Sec: ${txtSec} | Dest: ${txtDest} | Posto: ${txtPosto}</div>
        ${htmlTable}
    `;

    if(window.imprimirDocumento) window.imprimirDocumento(htmlFinal, 'Relatorio_Contratos');
};

// IMPRESSÃO DO EXTRATO FINANCEIRO (NOVO LAYOUT)
window.imprimirExtrato = function() {
    let titulo = document.getElementById('lblSecExtrato') ? document.getElementById('lblSecExtrato').innerText : "EXTRATO DO CONTRATO";
    let aditivos = document.getElementById('tbExtratoAditivos') ? document.getElementById('tbExtratoAditivos').innerHTML : "";
    let pagamentos = document.getElementById('tbExtratoPagamentos') ? document.getElementById('tbExtratoPagamentos').innerHTML : "";

    let htmlFinal = `
        <style>
            @page { size: portrait; margin: 15mm; }
            body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            h3 { text-align: center; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;}
            h4 { color: #0000cc; font-size: 14px; margin-bottom: 5px; margin-top: 25px; border-bottom: 1px dashed #ccc;}
            .text-muted { color: #555; font-size: 12px; text-align: center; display: block; margin-bottom: 20px;}
            table { width: 100%; border-collapse: collapse; font-size: 11px; text-align: center; margin-top: 5px; }
            th, td { border: 1px solid #555; padding: 6px; }
            th { background-color: #e0e0e0 !important; font-weight: bold; color: #000; }
            tr { page-break-inside: avoid; }
        </style>
        <h3>EXTRATO FINANCEIRO</h3>
        <div class="text-muted fw-bold" style="font-size: 14px;">${titulo}</div>
        
        <h4>Aditivos e Realinhamentos de Preço</h4>
        <table>
            <thead><tr><th>Data</th><th>Tipo</th><th>Combustível</th><th>Justificativa</th><th>L Adic.</th><th>R$ Adic.</th></tr></thead>
            <tbody>${aditivos}</tbody>
        </table>

        <h4>Histórico de Pagamentos (Liquidados)</h4>
        <table>
            <thead><tr><th>Mês Referência</th><th>Valor Pago (R$)</th></tr></thead>
            <tbody>${pagamentos}</tbody>
        </table>
    `;

    if(window.imprimirDocumento) window.imprimirDocumento(htmlFinal, 'Extrato_Contrato');
};
// URL do Google Apps Script
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby3FpkSJIKGfsLVpmH_HYr9I9WWxL79M5wtFK7lyAaIM5QeWbY8WkYDJq1e2K3ZlGTJEA/exec';

// Variáveis globais
let todosDados = [], dadosFiltradosHistorico = [];
let paginaAtual = 1; const itensPorPagina = 10;
let graficoVendas = null, graficoPagamento = null, graficoDescontos = null, graficoValorPagamento = null;

// --- FUNÇÕES UTILITÁRIAS ---
function formatarData(data) {
    return data.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function atualizarDataAtual() {
    document.getElementById('currentDate').textContent = formatarData(new Date());
    document.getElementById('filterDate').textContent = 'Filtrar por data';
    document.getElementById('reportDate').textContent = 'Período atual';
}

function calcularValorFinal() {
    const valor = parseFloat(document.getElementById('valorInput').value) || 0;
    const desconto = parseFloat(document.getElementById('descontoInput').value) || 0;
    const valorFinal = Math.max(0, valor - desconto);
    document.getElementById('valorFinalDisplay').textContent = formatarMoeda(valorFinal);
    
    // Validação visual
    if (desconto > valor) {
        document.getElementById('descontoInput').style.borderColor = 'var(--danger)';
        document.getElementById('valorFinalDisplay').style.color = 'var(--danger)';
    } else {
        document.getElementById('descontoInput').style.borderColor = '';
        document.getElementById('valorFinalDisplay').style.color = 'var(--success)';
    }
}

// --- INICIALIZAÇÃO DOS INPUTS ---
document.addEventListener('DOMContentLoaded', function() {
    // Atualizar valor final quando os inputs mudarem
    document.getElementById('valorInput').addEventListener('input', calcularValorFinal);
    document.getElementById('descontoInput').addEventListener('input', calcularValorFinal);
    
    // Calcular valor inicial
    calcularValorFinal();
});

// --- FUNÇÕES DE NAVEGAÇÃO ---
function showSection(id, btn, isDesktop = false) {
    if (sessionStorage.getItem('loja_logado') !== 'true') {
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('loginStatus').textContent = "Faça login para acessar esta seção!";
        document.getElementById('loginStatus').className = 'status-message status-error';
        return;
    }
    
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    if (isDesktop) {
        document.querySelectorAll('.menu-btn').forEach(el => el.classList.remove('active'));
        if(btn) btn.classList.add('active');
    }
    
    if (window.innerWidth <= 992) {
        const mobileBtns = document.querySelectorAll('.mobile-nav-btn');
        if (mobileBtns.length >= 4) {
            const indexMap = {
                'novaVenda': 0,
                'lancamentos': 1,
                'relatorios': 2
            };
            
            document.querySelectorAll('.mobile-nav-btn').forEach(el => el.classList.remove('active'));
            if (indexMap[id] !== undefined) {
                mobileBtns[indexMap[id]].classList.add('active');
            }
        }
    }
    
    if(id === 'lancamentos' || id === 'relatorios') carregarDados();
}

// --- LOGIN ---
document.getElementById('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const btn = document.getElementById('btnLogin');
    const status = document.getElementById('loginStatus');
    
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginPassword').value.trim();
    
    if (!email || !senha) {
        status.textContent = "Por favor, preencha todos os campos!";
        status.className = 'status-message status-error';
        return;
    }

    const fd = new FormData();
    fd.append('action', 'login');
    fd.append('email', email);
    fd.append('senha', senha);

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';

    fetch(SCRIPT_URL, { method: 'POST', body: fd })
    .then(res => res.json())
    .then(res => {
        if(res.status === 'sucesso') {
            sessionStorage.setItem('user_email', email);
            sessionStorage.setItem('loja_logado', 'true');
            
            document.getElementById('loginOverlay').classList.add('hidden');
            document.getElementById('userEmail').textContent = email;
            document.getElementById('userInfo').classList.add('active');
            document.getElementById('loginForm').reset();
            status.textContent = "";
            
            atualizarDataAtual();
            carregarDados();
            
            if (window.innerWidth > 992) {
                document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelector('.menu-btn').classList.add('active');
            } else {
                document.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelector('.mobile-nav-btn').classList.add('active');
            }
            showSection('novaVenda');
        } else {
            status.textContent = res.message || "Credenciais inválidas!";
            status.className = 'status-message status-error';
        }
    })
    .catch(() => {
        status.textContent = "Erro na conexão. Tente novamente.";
        status.className = 'status-message status-error';
    })
    .finally(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
    });
});

function fazerLogout() {
    sessionStorage.clear();
    localStorage.clear();
    
    document.getElementById('loginOverlay').classList.remove('hidden');
    document.getElementById('userInfo').classList.remove('active');
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    document.getElementById('loginStatus').textContent = "Sessão encerrada. Faça login novamente.";
    document.getElementById('loginStatus').className = 'status-message status-success';
    document.getElementById('loginForm').reset();
    
    if (window.innerWidth > 992) {
        document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.menu-btn').classList.add('active');
    } else {
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.mobile-nav-btn').classList.add('active');
    }
    showSection('novaVenda');
    
    todosDados = [];
    dadosFiltradosHistorico = [];
}

// --- VALIDAÇÃO DO FORMULÁRIO ---
function validarVenda() {
    const valor = parseFloat(document.getElementById('valorInput').value) || 0;
    const desconto = parseFloat(document.getElementById('descontoInput').value) || 0;
    const pagamento = document.getElementById('pagInput').value;
    const descricao = document.getElementById('descInput').value.trim();
    
    if (!descricao) {
        alert("Por favor, informe a descrição da venda!");
        document.getElementById('descInput').focus();
        return false;
    }
    
    if (valor <= 0) {
        alert("O valor da venda deve ser maior que zero!");
        document.getElementById('valorInput').focus();
        return false;
    }
    
    if (desconto < 0) {
        alert("O desconto não pode ser negativo!");
        document.getElementById('descontoInput').focus();
        return false;
    }
    
    if (desconto > valor) {
        alert("O desconto não pode ser maior que o valor da venda!");
        document.getElementById('descontoInput').focus();
        document.getElementById('descontoInput').value = valor;
        calcularValorFinal();
        return false;
    }
    
    if (!pagamento) {
        alert("Por favor, selecione a forma de pagamento!");
        document.getElementById('pagInput').focus();
        return false;
    }
    
    return true;
}

// --- REGISTRAR VENDA ---
document.getElementById('vendaForm').addEventListener('submit', e => {
    e.preventDefault();
    
    if (sessionStorage.getItem('loja_logado') !== 'true') {
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('loginStatus').textContent = "Faça login para registrar vendas!";
        document.getElementById('loginStatus').className = 'status-message status-error';
        return;
    }
    
    if (!validarVenda()) return;
    
    const btn = document.getElementById('btnSalvar');
    const status = document.getElementById('status');
    const isEdit = document.getElementById('editId').value !== "";
    
    const formData = new FormData(e.target);
    const emailLogado = sessionStorage.getItem('user_email') || "Desconhecido";
    formData.append('vendedor', emailLogado);

    if (isEdit) {
        formData.append('action', 'editar');
        formData.append('id', document.getElementById('editId').value);
    } else {
        formData.set('action', 'salvar');
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

    fetch(SCRIPT_URL, { method: 'POST', body: formData })
    .then(res => res.json())
    .then(response => {
        if(response.status === 'sucesso') {
            status.textContent = "✅ " + response.message;
            status.className = 'status-message status-success';
            
            if(isEdit) {
                cancelarEdicao();
            } else {
                e.target.reset();
                calcularValorFinal();
            }
            
            carregarDados();
            setTimeout(() => status.textContent = "", 3000);
        } else {
            throw new Error(response.message);
        }
    })
    .catch(err => {
        status.textContent = "❌ " + err.message;
        status.className = 'status-message status-error';
    })
    .finally(() => {
        btn.disabled = false;
        btn.innerHTML = isEdit ? 
            '<i class="fas fa-save"></i> Atualizar' : 
            '<i class="fas fa-check-circle"></i> Confirmar Venda';
    });
});

// --- CARREGAR DADOS ---
function carregarDados() {
    if (sessionStorage.getItem('loja_logado') !== 'true') return;
    
    const container = document.getElementById('tabelaContainer');
    if(container) {
        container.innerHTML = `
            <div style="padding: 3rem; text-align: center;">
                <i class="fas fa-spinner fa-spin fa-2x" style="color: var(--primary);"></i>
                <p style="margin-top: 1rem; color: var(--gray);">Carregando dados...</p>
            </div>
        `;
    }
    
    const fd = new FormData();
    fd.append('action', 'listar');

    fetch(SCRIPT_URL, { method: 'POST', body: fd })
    .then(res => res.json())
    .then(res => {
        if(res.status === 'sucesso') {
            todosDados = (res.data || []).slice().reverse();
            dadosFiltradosHistorico = [...todosDados];
            paginaAtual = 1;
            renderizarPagina();
            gerarRelatorios(todosDados);
            gerarGraficos(todosDados);
        }
    })
    .catch(err => {
        if(container) {
            container.innerHTML = `
                <div style="padding: 3rem; text-align: center;">
                    <i class="fas fa-exclamation-triangle fa-2x" style="color: var(--danger);"></i>
                    <p style="margin-top: 1rem; color: var(--danger);">Erro ao carregar dados</p>
                </div>
            `;
        }
    });
}

// --- PROCESSAMENTO DE DATAS ---
function parseDataInteligente(dataStr) {
    if(!dataStr) return null;
    let d = new Date(dataStr);
    if(!isNaN(d.getTime())) return d;
    try {
        let partes = dataStr.split(' ');
        let dataParts = partes[0].split('/');
        if(dataParts.length === 3) return new Date(dataParts[2], dataParts[1]-1, dataParts[0]);
    } catch(e) {}
    return null;
}

function formatarDataVisual(dataStr) {
    if (!dataStr) return "---";
    const d = parseDataInteligente(dataStr);
    if(!d) return dataStr;
    const dia = String(d.getDate()).padStart(2,'0');
    const mes = String(d.getMonth()+1).padStart(2,'0');
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2,'0');
    const min = String(d.getMinutes()).padStart(2,'0');
    return `${dia}/${mes}/${ano} ${hora}:${min}`;
}

function getBadgeClass(pagamento) {
    switch(pagamento) {
        case 'Pix': return 'badge-pix';
        case 'Cartão Crédito':
        case 'Cartão Débito': return 'badge-card';
        case 'Dinheiro': return 'badge-money';
        default: return '';
    }
}

// --- RENDERIZAR TABELA COM DESCONTO ---
function renderizarPagina() {
    const container = document.getElementById('tabelaContainer');
    const controls = document.getElementById('paginationControls');
    const pageInfo = document.getElementById('pageInfo');
    
    if(dadosFiltradosHistorico.length === 0) {
        container.innerHTML = `
            <div style="padding: 3rem; text-align: center;">
                <i class="fas fa-inbox fa-2x" style="color: var(--gray);"></i>
                <p style="margin-top: 1rem; color: var(--gray);">Nenhuma venda encontrada</p>
            </div>
        `;
        controls.style.display = 'none';
        return;
    }
    
    controls.style.display = 'flex';
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const pagData = dadosFiltradosHistorico.slice(inicio, fim);
    const totalPags = Math.ceil(dadosFiltradosHistorico.length / itensPorPagina);
    pageInfo.innerText = `${paginaAtual}/${totalPags}`;

    let html = `
        <table>
            <thead>
                <tr>
                    <th>Data/Hora</th>
                    <th>Descrição</th>
                    <th>Valor Bruto</th>
                    <th>Desconto</th>
                    <th>Valor Líquido</th>
                    <th>Pagamento</th>
                    <th>Vendedor</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    pagData.forEach(item => {
        const descricaoSegura = item.descricao
            .replace(/'/g, "&#39;")
            .replace(/"/g, "&quot;")
            .replace(/\\/g, "&#92;");
        
        const badgeClass = getBadgeClass(item.pagamento);
        const valorBruto = parseFloat(item.valor) || 0;
        const desconto = parseFloat(item.desconto) || 0;
        const valorLiquido = valorBruto - desconto;
        
        html += `
            <tr>
                <td style="font-weight: 500;">${formatarDataVisual(item.data)}</td>
                <td>${item.descricao}</td>
                <td style="font-weight: 700; color: var(--warning);">
                    R$ ${valorBruto.toFixed(2).replace('.', ',')}
                </td>
                <td style="font-weight: 700; color: var(--danger);">
                    R$ ${desconto.toFixed(2).replace('.', ',')}
                </td>
                <td style="font-weight: 700; color: var(--success);">
                    R$ ${valorLiquido.toFixed(2).replace('.', ',')}
                </td>
                <td><span class="badge ${badgeClass}">${item.pagamento}</span></td>
                <td style="font-size: 0.9em; color: var(--primary);">${item.vendedor || '---'}</td>
                <td>
                    <button class="btn-icon" onclick="prepararEdicao('${item.id}', '${descricaoSegura}', '${item.valor}', '${item.pagamento}', '${item.desconto || 0}')" 
                            style="background: rgba(255, 159, 28, 0.1); color: var(--warning); margin-right: 5px;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="excluirItem('${item.id}')" 
                            style="background: rgba(230, 57, 70, 0.1); color: var(--danger);">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function mudarPagina(d) {
    const total = Math.ceil(dadosFiltradosHistorico.length / itensPorPagina);
    if(paginaAtual + d > 0 && paginaAtual + d <= total) {
        paginaAtual += d;
        renderizarPagina();
    }
}

// --- FUNÇÃO PARA PREPARAR EDIÇÃO ---
function prepararEdicao(id, d, v, p, desconto = 0) {
    if (sessionStorage.getItem('loja_logado') !== 'true') {
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('loginStatus').textContent = "Faça login para editar registros!";
        document.getElementById('loginStatus').className = 'status-message status-error';
        return;
    }
    
    showSection('novaVenda');
    document.getElementById('editId').value = id;
    
    const descricaoDecodificada = d
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&#92;/g, '\\');
    
    document.getElementById('descInput').value = descricaoDecodificada;
    document.getElementById('valorInput').value = v;
    document.getElementById('pagInput').value = p;
    document.getElementById('descontoInput').value = desconto;
    document.getElementById('btnSalvar').innerHTML = '<i class="fas fa-save"></i> Atualizar';
    document.getElementById('btnCancelar').style.display = "block";
    
    calcularValorFinal();
    document.getElementById('valorInput').focus();
}

function cancelarEdicao() {
    document.getElementById('vendaForm').reset();
    document.getElementById('editId').value = "";
    document.getElementById('btnSalvar').innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Venda';
    document.getElementById('btnCancelar').style.display = "none";
    calcularValorFinal();
}

// --- FILTROS ---
function aplicarFiltroHistorico() {
    if (sessionStorage.getItem('loja_logado') !== 'true') {
        document.getElementById('loginOverlay').classList.remove('hidden');
        return;
    }
    
    const i = document.getElementById('dataInicial').value;
    const f = document.getElementById('dataFinal').value;
    if(!i || !f) {
        alert("Selecione a data inicial e final para filtrar");
        return;
    }
    const dI = new Date(i + "T00:00:00");
    const dF = new Date(f + "T23:59:59");
    dadosFiltradosHistorico = todosDados.filter(item => {
        const d = parseDataInteligente(item.data);
        return d && d >= dI && d <= dF;
    });
    paginaAtual = 1;
    renderizarPagina();
    document.getElementById('filterDate').textContent = `Filtro: ${i} até ${f}`;
}

function limparFiltroHistorico() {
    if (sessionStorage.getItem('loja_logado') !== 'true') {
        document.getElementById('loginOverlay').classList.remove('hidden');
        return;
    }
    
    document.getElementById('dataInicial').value = "";
    document.getElementById('dataFinal').value = "";
    dadosFiltradosHistorico = [...todosDados];
    paginaAtual = 1;
    renderizarPagina();
    document.getElementById('filterDate').textContent = 'Filtrar por data';
}

function filtrarRelatorio() {
    if (sessionStorage.getItem('loja_logado') !== 'true') {
        document.getElementById('loginOverlay').classList.remove('hidden');
        return;
    }
    
    const i = document.getElementById('dataInicialRel').value;
    const f = document.getElementById('dataFinalRel').value;
    if(!i || !f) {
        alert("Selecione o período para filtrar");
        return;
    }
    const dI = new Date(i + "T00:00:00");
    const dF = new Date(f + "T23:59:59");
    const filtrados = todosDados.filter(item => {
        const d = parseDataInteligente(item.data);
        return d && d >= dI && d <= dF;
    });
    gerarRelatorios(filtrados);
    gerarGraficos(filtrados);
    document.getElementById('reportDate').textContent = `Período: ${i} até ${f}`;
}

function limparFiltroRelatorio() {
    if (sessionStorage.getItem('loja_logado') !== 'true') {
        document.getElementById('loginOverlay').classList.remove('hidden');
        return;
    }
    
    document.getElementById('dataInicialRel').value = "";
    document.getElementById('dataFinalRel').value = "";
    gerarRelatorios(todosDados);
    gerarGraficos(todosDados);
    document.getElementById('reportDate').textContent = 'Período atual';
}

// --- EXCLUSÃO ---
function excluirItem(id) {
    if (sessionStorage.getItem('loja_logado') !== 'true') {
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('loginStatus').textContent = "Faça login para excluir registros!";
        document.getElementById('loginStatus').className = 'status-message status-error';
        return;
    }
    
    if(confirm("Tem certeza que deseja excluir esta venda?")) {
        const fd = new FormData();
        fd.append('action','excluir');
        fd.append('id',id);
        fetch(SCRIPT_URL, {method:'POST', body:fd})
            .then(() => carregarDados())
            .catch(() => alert("Erro ao excluir. Tente novamente."));
    }
}

// --- RELATÓRIOS COM DESCONTO ---
function gerarRelatorios(dados) {
    if (sessionStorage.getItem('loja_logado') !== 'true') return;
    
    const hojeStr = new Date().toLocaleDateString('pt-BR');
    const mesAtual = new Date().getMonth();
    const anoAtual = new Date().getFullYear();
    let totalDia = 0, totalMes = 0, totalGeral = 0;
    let descontoDia = 0, descontoMes = 0, descontoGeral = 0;
    let qtdDia = 0, qtdMes = 0, qtdGeral = 0;
    
    dados.forEach(i => {
        const valorBruto = parseFloat(i.valor) || 0;
        const desconto = parseFloat(i.desconto) || 0;
        const valorLiquido = valorBruto - desconto;
        
        totalGeral += valorLiquido;
        descontoGeral += desconto;
        qtdGeral++;
        
        const d = parseDataInteligente(i.data);
        if(d) {
            if(d.toLocaleDateString('pt-BR') === hojeStr) {
                totalDia += valorLiquido;
                descontoDia += desconto;
                qtdDia++;
            }
            if(d.getMonth() === mesAtual && d.getFullYear() === anoAtual) {
                totalMes += valorLiquido;
                descontoMes += desconto;
                qtdMes++;
            }
        }
    });
    
    const fmt = v => formatarMoeda(v);
    
    document.getElementById('totalDia').innerHTML = `
        ${fmt(totalDia)} <br>
        <small><i class="fas fa-shopping-cart"></i> ${qtdDia} venda(s)</small>
    `;
    document.getElementById('descontoDia').textContent = `Descontos: ${fmt(descontoDia)}`;
    
    document.getElementById('totalMes').innerHTML = `
        ${fmt(totalMes)} <br>
        <small><i class="fas fa-shopping-cart"></i> ${qtdMes} venda(s)</small>
    `;
    document.getElementById('descontoMes').textContent = `Descontos: ${fmt(descontoMes)}`;
    
    document.getElementById('totalGeral').innerHTML = `
        ${fmt(totalGeral)} <br>
        <small><i class="fas fa-shopping-cart"></i> ${qtdGeral} venda(s)</small>
    `;
    document.getElementById('descontoGeral').textContent = `Descontos: ${fmt(descontoGeral)}`;
}

// --- GRÁFICOS ---
function gerarGraficos(dados) {
    if (sessionStorage.getItem('loja_logado') !== 'true') return;
    
    const porMesLiquido = {}, porMesDesconto = {}, porPag = {}, valorPorPag = {};
    
    dados.forEach(i => {
        const d = parseDataInteligente(i.data);
        const valorBruto = parseFloat(i.valor) || 0;
        const desconto = parseFloat(i.desconto) || 0;
        const valorLiquido = valorBruto - desconto;
        const p = i.pagamento || "Outro";
        
        if(d) {
            const k = `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
            porMesLiquido[k] = (porMesLiquido[k] || 0) + valorLiquido;
            porMesDesconto[k] = (porMesDesconto[k] || 0) + desconto;
        }
        porPag[p] = (porPag[p] || 0) + 1;
        valorPorPag[p] = (valorPorPag[p] || 0) + valorLiquido;
    });
    
    const cores = ['#4361ee', '#7209b7', '#2ec4b6', '#ff9f1c', '#e63946'];
    
    // Destruir gráficos existentes
    if(graficoVendas) graficoVendas.destroy();
    if(graficoPagamento) graficoPagamento.destroy();
    if(graficoDescontos) graficoDescontos.destroy();
    if(graficoValorPagamento) graficoValorPagamento.destroy();
    
    // Gráfico de vendas líquidas por mês
    graficoVendas = new Chart(document.getElementById('chartVendas'), {
        type: 'line',
        data: {
            labels: Object.keys(porMesLiquido),
            datasets: [{
                label: 'Vendas Líquidas (R$)',
                data: Object.values(porMesLiquido),
                borderColor: '#4361ee',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                }
            }
        }
    });
    
    // Gráfico de pizza (métodos de pagamento)
    graficoPagamento = new Chart(document.getElementById('chartPagamento'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(porPag),
            datasets: [{
                data: Object.values(porPag),
                backgroundColor: cores,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                }
            }
        }
    });
    
    // Gráfico de descontos por mês
    graficoDescontos = new Chart(document.getElementById('chartDescontos'), {
        type: 'bar',
        data: {
            labels: Object.keys(porMesDesconto),
            datasets: [{
                label: 'Descontos (R$)',
                data: Object.values(porMesDesconto),
                backgroundColor: 'rgba(230, 57, 70, 0.7)',
                borderColor: 'rgba(230, 57, 70, 1)',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                }
            }
        }
    });
    
    // NOVO GRÁFICO: Valor por método de pagamento (barra)
    const labelsPag = Object.keys(valorPorPag);
    const valoresPag = Object.values(valorPorPag);
    
    // Ordenar os métodos de pagamento em uma ordem específica
    const ordemPagamentos = ['Dinheiro', 'Pix', 'Cartão Crédito', 'Cartão Débito', 'Outro'];
    const labelsOrdenadas = ordemPagamentos.filter(pag => labelsPag.includes(pag));
    const valoresOrdenados = labelsOrdenadas.map(pag => valorPorPag[pag] || 0);
    
    // Adicionar valores que não estão na lista padrão
    labelsPag.forEach(pag => {
        if (!labelsOrdenadas.includes(pag)) {
            labelsOrdenadas.push(pag);
            valoresOrdenados.push(valorPorPag[pag]);
        }
    });
    
    // Mapear os nomes para exibição (se necessário)
    const labelsExibicao = labelsOrdenadas.map(pag => {
        const map = {
            'Dinheiro': 'Dinheiro',
            'Pix': 'Pix',
            'Cartão Crédito': 'Cartão Crédito',
            'Cartão Débito': 'Cartão Débito'
        };
        return map[pag] || pag;
    });
    
    // Cores específicas para cada método de pagamento
    const coresPagamentos = labelsOrdenadas.map(pag => {
        const coresMap = {
            'Dinheiro': '#4361ee', // Azul
            'Pix': '#7209b7', // Roxo
            'Cartão Crédito': '#2ec4b6', // Verde
            'Cartão Débito': '#ff9f1c' // Laranja
        };
        return coresMap[pag] || '#e63946'; // Vermelho para outros
    });
    
    graficoValorPagamento = new Chart(document.getElementById('chartValorPagamento'), {
        type: 'bar',
        data: {
            labels: labelsExibicao,
            datasets: [{
                label: 'Valor Total (R$)',
                data: valoresOrdenados,
                backgroundColor: coresPagamentos,
                borderColor: coresPagamentos.map(cor => cor.replace('0.7', '1')),
                borderWidth: 2,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Valor: ${formatarMoeda(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    },
                    title: {
                        display: true,
                        text: 'Valor Total (R$)',
                        font: {
                            weight: 'bold'
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Método de Pagamento',
                        font: {
                            weight: 'bold'
                        }
                    }
                }
            }
        }
    });
}

// --- EXPORTAÇÃO ---
function exportarExcel() {
    if (sessionStorage.getItem('loja_logado') !== 'true') {
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('loginStatus').textContent = "Faça login para exportar dados!";
        document.getElementById('loginStatus').className = 'status-message status-error';
        return;
    }
    
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const dadosPagina = dadosFiltradosHistorico.slice(inicio, fim);

    if (dadosPagina.length === 0) {
        alert("Não há dados para exportar");
        return;
    }

    const dadosFormatados = dadosPagina.map(i => {
        const dataLimpa = formatarDataVisual(i.data).replace(/<[^>]*>?/gm, '');
        const valorBruto = parseFloat(i.valor) || 0;
        const desconto = parseFloat(i.desconto) || 0;
        const valorLiquido = valorBruto - desconto;
        
        return {
            "Data": dataLimpa,
            "Descrição": i.descricao,
            "Valor Bruto": valorBruto,
            "Desconto": desconto,
            "Valor Líquido": valorLiquido,
            "Pagamento": i.pagamento,
            "Vendedor": i.vendedor || ''
        };
    });

    const ws = XLSX.utils.json_to_sheet(dadosFormatados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendas");
    
    const hoje = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Vendas_${hoje}_Pagina_${paginaAtual}.xlsx`);
}

function exportarPDF() {
    if (sessionStorage.getItem('loja_logado') !== 'true') {
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('loginStatus').textContent = "Faça login para exportar dados!";
        document.getElementById('loginStatus').className = 'status-message status-error';
        return;
    }
    
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const dadosPagina = dadosFiltradosHistorico.slice(inicio, fim);

    if (dadosPagina.length === 0) {
        alert("Não há dados para exportar");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const dadosPdf = dadosPagina.map(i => {
        const valorBruto = parseFloat(i.valor) || 0;
        const desconto = parseFloat(i.desconto) || 0;
        const valorLiquido = valorBruto - desconto;
        
        return [
            formatarDataVisual(i.data).replace(/<[^>]*>?/gm, ''),
            i.descricao,
            `R$ ${valorBruto.toFixed(2).replace('.', ',')}`,
            `R$ ${desconto.toFixed(2).replace('.', ',')}`,
            `R$ ${valorLiquido.toFixed(2).replace('.', ',')}`,
            i.pagamento,
            i.vendedor || ''
        ];
    });

    doc.setFontSize(16);
    doc.setTextColor(67, 97, 238);
    doc.text('Relatório de Vendas', 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} - Página ${paginaAtual}`, 14, 22);
    
    doc.autoTable({
        head: [['Data', 'Descrição', 'Valor Bruto', 'Desconto', 'Valor Líquido', 'Pagamento', 'Vendedor']],
        body: dadosPdf,
        startY: 30,
        theme: 'striped',
        headStyles: { 
            fillColor: [26, 26, 46],
            textColor: 255
        },
        margin: { top: 30 }
    });
    
    const hoje = new Date().toISOString().split('T')[0];
    doc.save(`Vendas_${hoje}_Pagina_${paginaAtual}.pdf`);
}

// --- INICIALIZAÇÃO ---
window.onload = () => {
    sessionStorage.clear();
    localStorage.clear();
    
    document.getElementById('loginOverlay').classList.remove('hidden');
    document.getElementById('userInfo').classList.remove('active');
    
    document.getElementById('loginForm').reset();
    document.getElementById('vendaForm').reset();
    
    document.getElementById('btnCancelar').style.display = "none";
    
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    document.getElementById('novaVenda').classList.add('active');
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.menu-btn').classList.add('active');
    
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.mobile-nav-btn').classList.add('active');
    
    todosDados = [];
    dadosFiltradosHistorico = [];
    
    // Definir datas padrão para filtros
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    document.getElementById('dataInicialRel').value = primeiroDia.toISOString().split('T')[0];
    document.getElementById('dataFinalRel').value = ultimoDia.toISOString().split('T')[0];
    
    // Definir período de 30 dias para filtro histórico
    const data30DiasAtras = new Date();
    data30DiasAtras.setDate(data30DiasAtras.getDate() - 30);
    document.getElementById('dataInicial').value = data30DiasAtras.toISOString().split('T')[0];
    document.getElementById('dataFinal').value = hoje.toISOString().split('T')[0];
    
    atualizarDataAtual();
    calcularValorFinal();
    
    // Responsividade
    if (window.innerWidth <= 992) {
        document.querySelector('.sidebar').style.display = 'none';
        document.getElementById('mobileFooter').style.display = 'block';
    } else {
        document.querySelector('.sidebar').style.display = 'flex';
        document.getElementById('mobileFooter').style.display = 'none';
    }
    
    window.addEventListener('resize', function() {
        if (window.innerWidth <= 992) {
            document.querySelector('.sidebar').style.display = 'none';
            document.getElementById('mobileFooter').style.display = 'block';
        } else {
            document.querySelector('.sidebar').style.display = 'flex';
            document.getElementById('mobileFooter').style.display = 'none';
        }
    });
    
    setTimeout(() => {
        document.getElementById('loginEmail').focus();
    }, 500);
};

window.addEventListener('beforeunload', function() {
    sessionStorage.clear();
});
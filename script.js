// ==================== CONFIGURAÇÃO ====================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxy2FUUBdpLWlEbxJUfEQirNAhkmvp_7eEOs8Z1wSSINoQGbm4OncUjJ9HRe5h8lOntzw/exec';

// Variáveis globais
let todosDados = [];
let dadosFiltradosHistorico = [];
let todasDespesas = [];
let despesasFiltradas = [];
let paginaAtual = 1;
let paginaDespesaAtual = 1;
const itensPorPagina = 150;
const itensDespesaPorPagina = 150;

// Gráficos
let graficoVendas = null;
let graficoPagamento = null;
let graficoPagamentoValor = null;
let graficoDescontos = null;
let graficoDespesasLucro = null;
let graficoDespesasMes = null;

// Dados filtrados para relatórios
let dadosFiltradosRelatorio = [];
let despesasFiltradasRelatorio = [];

// ==================== FUNÇÕES UTILITÁRIAS ====================
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function formatarDataVisual(dataStr) {
    if (!dataStr) return '---';
    try {
        let d = new Date(dataStr);
        if (isNaN(d.getTime())) {
            let partes = dataStr.split(' ');
            let dataPartes = partes[0].split('/');
            if (dataPartes.length === 3) {
                d = new Date(dataPartes[2], dataPartes[1] - 1, dataPartes[0]);
            }
        }
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
        }
        return dataStr;
    } catch (e) {
        return dataStr;
    }
}

function formatarDataDespesa(dataStr) {
    if (!dataStr) return '---';
    if (dataStr.includes('/')) {
        return dataStr;
    }
    try {
        let d = new Date(dataStr);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('pt-BR');
        }
    } catch (e) {}
    return dataStr;
}

function formatarDataParaRelatorio(dataStr) {
    if (!dataStr) return '---';
    try {
        let d = new Date(dataStr);
        if (isNaN(d.getTime())) {
            let partes = dataStr.split(' ');
            let dataPartes = partes[0].split('/');
            if (dataPartes.length === 3) {
                d = new Date(dataPartes[2], dataPartes[1] - 1, dataPartes[0]);
            }
        }
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('pt-BR');
        }
        return dataStr;
    } catch (e) {
        return dataStr;
    }
}

function parseDataInteligente(dataStr) {
    if (!dataStr) return null;
    try {
        let d = new Date(dataStr);
        if (!isNaN(d.getTime())) return d;
        let partes = dataStr.split(' ');
        let dataPartes = partes[0].split('/');
        if (dataPartes.length === 3) {
            return new Date(dataPartes[2], dataPartes[1] - 1, dataPartes[0]);
        }
    } catch (e) {}
    return null;
}

function normalizarDataParaComparacao(dataStr) {
    if (!dataStr) return null;
    let data = parseDataInteligente(dataStr);
    if (data && !isNaN(data.getTime())) {
        return data;
    }
    try {
        let d = new Date(dataStr);
        if (!isNaN(d.getTime())) {
            return d;
        }
    } catch (e) {}
    return null;
}

function converterDataParaInput(dataStr) {
    if (!dataStr) return '';
    if (dataStr.includes('/')) {
        let partes = dataStr.split('/');
        if (partes.length === 3) {
            return `${partes[2]}-${partes[1]}-${partes[0]}`;
        }
    }
    return dataStr;
}

function formatarDataParaExibicao(dataStr) {
    if (!dataStr) return '';
    try {
        let d = new Date(dataStr + 'T00:00:00');
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('pt-BR');
        }
    } catch (e) {}
    try {
        let d = new Date(dataStr);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('pt-BR');
        }
    } catch (e) {}
    return dataStr;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function atualizarDataAtual() {
    const data = new Date();
    const dataStr = data.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const currentDateElem = document.getElementById('currentDate');
    if (currentDateElem) currentDateElem.textContent = dataStr;
}

function calcularValorFinal() {
    const valor = parseFloat(document.getElementById('valorInput').value) || 0;
    const desconto = parseFloat(document.getElementById('descontoInput').value) || 0;
    const valorFinal = Math.max(0, valor - desconto);
    const valorFinalDisplay = document.getElementById('valorFinalDisplay');
    if (valorFinalDisplay) valorFinalDisplay.textContent = formatarMoeda(valorFinal);
    
    if (desconto > valor) {
        const descontoInput = document.getElementById('descontoInput');
        if (descontoInput) descontoInput.style.borderColor = '#e63946';
        if (valorFinalDisplay) valorFinalDisplay.style.color = '#e63946';
    } else {
        const descontoInput = document.getElementById('descontoInput');
        if (descontoInput) descontoInput.style.borderColor = '';
        if (valorFinalDisplay) valorFinalDisplay.style.color = '#2ec4b6';
    }
}

// ==================== FUNÇÃO PARA CALCULAR TOTAIS POR PAGAMENTO ====================
function calcularTotaisPorPagamento(dados) {
    const totais = {};
    let totalGeral = 0;
    let totalDescontos = 0;
    
    for (const item of dados) {
        const valorBruto = parseFloat(item.valor) || 0;
        const desconto = parseFloat(item.desconto) || 0;
        const valorLiquido = valorBruto - desconto;
        const pagamento = item.pagamento || 'Outros';
        
        if (!totais[pagamento]) {
            totais[pagamento] = {
                quantidade: 0,
                valorBruto: 0,
                desconto: 0,
                valorLiquido: 0
            };
        }
        
        totais[pagamento].quantidade++;
        totais[pagamento].valorBruto += valorBruto;
        totais[pagamento].desconto += desconto;
        totais[pagamento].valorLiquido += valorLiquido;
        
        totalGeral += valorLiquido;
        totalDescontos += desconto;
    }
    
    return { totais, totalGeral, totalDescontos };
}

// ==================== FUNÇÃO PARA RENDERIZAR RESUMO POR PAGAMENTO ====================
function renderizarResumoPagamento(dados) {
    const container = document.getElementById('resumoPagamentoContainer');
    if (!container) return;
    
    const { totais, totalGeral, totalDescontos } = calcularTotaisPorPagamento(dados);
    const pagamentos = Object.keys(totais);
    
    if (pagamentos.length === 0) {
        container.innerHTML = `
            <div class="resumo-vazio">
                <i class="fas fa-info-circle"></i>
                <span>Nenhum dado para exibir</span>
            </div>
        `;
        return;
    }
    
    const cores = {
        'Dinheiro': '#2ec4b6',
        'Pix': '#4361ee',
        'Cartão Crédito': '#ff9f1c',
        'Cartão Débito': '#7209b7',
        'Outros': '#6c757d'
    };
    
    let html = `
        <div class="resumo-pagamento">
            <div class="resumo-header">
                <h4><i class="fas fa-chart-pie"></i> Resumo por Forma de Pagamento</h4>
                <div class="resumo-total-geral">
                    <span>Total Geral: <strong>${formatarMoeda(totalGeral)}</strong></span>
                    <span style="color: #e63946; font-size: 0.85rem;">Descontos: ${formatarMoeda(totalDescontos)}</span>
                </div>
            </div>
            <div class="resumo-grid">
    `;
    
    const sortedPagamentos = pagamentos.sort((a, b) => totais[b].valorLiquido - totais[a].valorLiquido);
    
    for (const pagamento of sortedPagamentos) {
        const data = totais[pagamento];
        const cor = cores[pagamento] || '#6c757d';
        const percentual = totalGeral > 0 ? ((data.valorLiquido / totalGeral) * 100).toFixed(1) : 0;
        
        html += `
            <div class="resumo-item" style="border-left: 4px solid ${cor};">
                <div class="resumo-item-header">
                    <span class="resumo-pagamento-nome">${pagamento}</span>
                    <span class="resumo-pagamento-qtd">${data.quantidade} venda(s)</span>
                </div>
                <div class="resumo-item-valores">
                    <span class="resumo-valor-liquido">${formatarMoeda(data.valorLiquido)}</span>
                    <span class="resumo-percentual">${percentual}%</span>
                </div>
                <div class="resumo-item-detalhes">
                    <span>Bruto: ${formatarMoeda(data.valorBruto)}</span>
                    <span style="color: #e63946;">Desc: ${formatarMoeda(data.desconto)}</span>
                </div>
                <div class="resumo-bar">
                    <div class="resumo-bar-fill" style="width: ${percentual}%; background: ${cor};"></div>
                </div>
            </div>
        `;
    }
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// ==================== NAVEGAÇÃO ====================
function showSection(sectionId) {
    if (sessionStorage.getItem('loja_logado') !== 'true') {
        document.getElementById('loginOverlay').classList.remove('hidden');
        const loginStatus = document.getElementById('loginStatus');
        if (loginStatus) {
            loginStatus.textContent = "Faça login para acessar!";
            loginStatus.className = 'status-message status-error';
        }
        return;
    }
    
    document.querySelectorAll('.section').forEach(el => {
        el.classList.remove('active');
    });
    
    const section = document.getElementById(sectionId);
    if (section) section.classList.add('active');
    
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-section') === sectionId) {
            btn.classList.add('active');
        }
    });
    
    if (window.innerWidth <= 992) {
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-section') === sectionId) {
                btn.classList.add('active');
            }
        });
    }
    
    if (sectionId === 'lancamentos' || sectionId === 'relatorios') {
        carregarDados();
    }
    if (sectionId === 'despesas') {
        carregarDespesas();
    }
}

// ==================== LOGIN ====================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('btnLogin');
        const statusDiv = document.getElementById('loginStatus');
        const email = document.getElementById('loginEmail').value.trim();
        const senha = document.getElementById('loginPassword').value.trim();
        
        if (!email || !senha) {
            if (statusDiv) {
                statusDiv.textContent = "Preencha todos os campos!";
                statusDiv.className = 'status-message status-error';
            }
            return;
        }
        
        const fd = new FormData();
        fd.append('action', 'login');
        fd.append('email', email);
        fd.append('senha', senha);
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
        }
        
        try {
            const response = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
            const res = await response.json();
            
            if (res.status === 'sucesso') {
                sessionStorage.setItem('loja_logado', 'true');
                sessionStorage.setItem('user_email', email);
                
                const loginOverlay = document.getElementById('loginOverlay');
                if (loginOverlay) loginOverlay.classList.add('hidden');
                
                const userInfo = document.getElementById('userInfo');
                if (userInfo) userInfo.classList.add('active');
                
                const userEmail = document.getElementById('userEmail');
                if (userEmail) userEmail.textContent = email;
                
                atualizarDataAtual();
                carregarDados();
                carregarDespesas();
                showSection('novaVenda');
            } else {
                if (statusDiv) {
                    statusDiv.textContent = res.message || "Credenciais inválidas!";
                    statusDiv.className = 'status-message status-error';
                }
            }
        } catch (error) {
            console.error('Erro no login:', error);
            if (statusDiv) {
                statusDiv.textContent = "Erro na conexão!";
                statusDiv.className = 'status-message status-error';
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
            }
        }
    });
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        sessionStorage.clear();
        location.reload();
    });
}

// ==================== VENDAS ====================
const vendaForm = document.getElementById('vendaForm');
if (vendaForm) {
    vendaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (sessionStorage.getItem('loja_logado') !== 'true') {
            alert("Faça login primeiro!");
            return;
        }
        
        const descricao = document.getElementById('descInput').value.trim();
        const valor = parseFloat(document.getElementById('valorInput').value) || 0;
        const desconto = parseFloat(document.getElementById('descontoInput').value) || 0;
        const pagamento = document.getElementById('pagInput').value;
        
        if (!descricao) {
            alert("Informe a descrição!");
            return;
        }
        if (valor <= 0) {
            alert("Valor deve ser maior que zero!");
            return;
        }
        if (desconto > valor) {
            alert("Desconto não pode ser maior que o valor!");
            return;
        }
        if (!pagamento) {
            alert("Selecione a forma de pagamento!");
            return;
        }
        
        const btn = document.getElementById('btnSalvar');
        const statusDiv = document.getElementById('status');
        const editId = document.getElementById('editId').value;
        const isEdit = editId !== "";
        
        const fd = new FormData();
        fd.append('action', isEdit ? 'editar' : 'salvar');
        if (isEdit) fd.append('id', editId);
        fd.append('descricao', descricao);
        fd.append('valor', valor.toString());
        fd.append('desconto', desconto.toString());
        fd.append('pagamento', pagamento);
        fd.append('vendedor', sessionStorage.getItem('user_email'));
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        }
        
        try {
            const response = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
            const res = await response.json();
            
            if (res.status === 'sucesso') {
                if (statusDiv) {
                    statusDiv.textContent = res.message;
                    statusDiv.className = 'status-message status-success';
                }
                
                if (isEdit) {
                    cancelarEdicao();
                } else {
                    vendaForm.reset();
                    const valorInput = document.getElementById('valorInput');
                    const descontoInput = document.getElementById('descontoInput');
                    if (valorInput) valorInput.value = '0';
                    if (descontoInput) descontoInput.value = '0';
                    calcularValorFinal();
                }
                
                carregarDados();
                setTimeout(() => {
                    if (statusDiv) {
                        statusDiv.textContent = '';
                        statusDiv.className = 'status-message';
                    }
                }, 3000);
            } else {
                throw new Error(res.message);
            }
        } catch (error) {
            console.error('Erro ao salvar venda:', error);
            if (statusDiv) {
                statusDiv.textContent = "Erro ao salvar!";
                statusDiv.className = 'status-message status-error';
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = isEdit ? '<i class="fas fa-save"></i> Atualizar' : '<i class="fas fa-check-circle"></i> Confirmar Venda';
            }
        }
    });
}

async function carregarDados() {
    if (sessionStorage.getItem('loja_logado') !== 'true') return;
    
    const fd = new FormData();
    fd.append('action', 'listar');
    
    try {
        const response = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        const res = await response.json();
        
        if (res.status === 'sucesso') {
            todosDados = (res.data || []).sort((a, b) => {
                const dataA = parseDataInteligente(a.data);
                const dataB = parseDataInteligente(b.data);
                if (!dataA && !dataB) return 0;
                if (!dataA) return 1;
                if (!dataB) return -1;
                return dataB - dataA;
            });
            dadosFiltradosHistorico = [...todosDados];
            dadosFiltradosRelatorio = [...todosDados];
            paginaAtual = 1;
            renderizarPagina();
            atualizarRelatorios();
            gerarGraficosVendas(dadosFiltradosRelatorio);
            gerarGraficosDespesas(despesasFiltradasRelatorio);
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

function renderizarPagina() {
    const container = document.getElementById('tabelaContainer');
    const pageInfo = document.getElementById('pageInfo');
    const totalPaginasSpan = document.getElementById('totalPaginas');
    const totalRegistrosSpan = document.getElementById('totalRegistros');
    const btnAnterior = document.getElementById('btnPaginaAnterior');
    const btnProxima = document.getElementById('btnPaginaProxima');
    
    if (!container) return;
    
    const totalRegistros = dadosFiltradosHistorico.length;
    const totalPags = Math.ceil(totalRegistros / itensPorPagina);
    
    if (totalRegistrosSpan) totalRegistrosSpan.textContent = totalRegistros;
    if (totalPaginasSpan) totalPaginasSpan.textContent = totalPags || 1;
    if (pageInfo) pageInfo.textContent = paginaAtual;
    
    if (btnAnterior) btnAnterior.disabled = paginaAtual === 1;
    if (btnProxima) btnProxima.disabled = paginaAtual === totalPags;
    
    renderizarResumoPagamento(dadosFiltradosHistorico);
    
    if (dadosFiltradosHistorico.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 3rem;">
                    <i class="fas fa-inbox" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem; display: block;"></i>
                    <p style="color: #999;">Nenhuma venda encontrada</p>
                    <small style="color: #ccc;">Tente ajustar os filtros de busca</small>
                </td>
            </tr>
        `;
        return;
    }
    
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const pagData = dadosFiltradosHistorico.slice(inicio, fim);
    
    let html = '';
    
    for (const item of pagData) {
        const valorBruto = parseFloat(item.valor) || 0;
        const desconto = parseFloat(item.desconto) || 0;
        const valorLiquido = valorBruto - desconto;
        
        let badgeClass = '';
        if (item.pagamento === 'Pix') badgeClass = 'badge-pix';
        else if (item.pagamento === 'Cartão Crédito' || item.pagamento === 'Cartão Débito') badgeClass = 'badge-card';
        else if (item.pagamento === 'Dinheiro') badgeClass = 'badge-money';
        else badgeClass = 'badge-card';
        
        html += `
            <tr>
                <td style="font-size: 0.8rem;">${formatarDataVisual(item.data)}</td>
                <td><strong>${escapeHtml(item.descricao)}</strong></td>
                <td class="valor-bruto">${formatarMoeda(valorBruto)}</td>
                <td class="valor-desconto">${formatarMoeda(desconto)}</td>
                <td class="valor-liquido">${formatarMoeda(valorLiquido)}</td>
                <td><span class="${badgeClass}">${item.pagamento}</span></td>
                <td>${item.vendedor || '-'}</td>
                <td class="text-center" style="white-space: nowrap;">
                    <button class="btn-action btn-action-edit" onclick="prepararEdicao('${item.id}', '${escapeHtml(item.descricao)}', '${item.valor}', '${item.pagamento}', '${item.desconto || 0}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-action-delete" onclick="excluirItem('${item.id}')" title="Excluir">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }
    
    container.innerHTML = html;
}

function prepararEdicao(id, descricao, valor, pagamento, desconto) {
    showSection('novaVenda');
    const editId = document.getElementById('editId');
    const descInput = document.getElementById('descInput');
    const valorInput = document.getElementById('valorInput');
    const pagInput = document.getElementById('pagInput');
    const descontoInput = document.getElementById('descontoInput');
    const btnSalvar = document.getElementById('btnSalvar');
    const btnCancelar = document.getElementById('btnCancelar');
    
    if (editId) editId.value = id;
    if (descInput) descInput.value = descricao;
    if (valorInput) valorInput.value = valor;
    if (pagInput) pagInput.value = pagamento;
    if (descontoInput) descontoInput.value = desconto;
    if (btnSalvar) btnSalvar.innerHTML = '<i class="fas fa-save"></i> Atualizar';
    if (btnCancelar) btnCancelar.style.display = 'block';
    calcularValorFinal();
}

function cancelarEdicao() {
    const vendaForm = document.getElementById('vendaForm');
    const editId = document.getElementById('editId');
    const valorInput = document.getElementById('valorInput');
    const descontoInput = document.getElementById('descontoInput');
    const btnSalvar = document.getElementById('btnSalvar');
    const btnCancelar = document.getElementById('btnCancelar');
    
    if (vendaForm) vendaForm.reset();
    if (editId) editId.value = '';
    if (valorInput) valorInput.value = '0';
    if (descontoInput) descontoInput.value = '0';
    if (btnSalvar) btnSalvar.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Venda';
    if (btnCancelar) btnCancelar.style.display = 'none';
    calcularValorFinal();
}

async function excluirItem(id) {
    if (!confirm("Tem certeza que deseja excluir esta venda?")) return;
    
    const fd = new FormData();
    fd.append('action', 'excluir');
    fd.append('id', id);
    
    try {
        await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        carregarDados();
    } catch (error) {
        alert("Erro ao excluir!");
    }
}

// ==================== FILTROS DO HISTÓRICO ====================
function aplicarFiltroHistorico() {
    const dataIni = document.getElementById('dataInicial').value;
    const dataFim = document.getElementById('dataFinal').value;
    const buscaInput = document.getElementById('buscaInput');
    const buscaTermo = buscaInput ? buscaInput.value.toLowerCase().trim() : '';
    
    let dadosFiltrados = [...todosDados];
    
    // Filtro por busca
    if (buscaTermo) {
        dadosFiltrados = dadosFiltrados.filter(item => 
            item.descricao.toLowerCase().includes(buscaTermo)
        );
    }
    
    // Filtro por data
    if (dataIni && dataFim) {
        const dIni = new Date(dataIni + 'T00:00:00');
        const dFim = new Date(dataFim + 'T23:59:59');
        
        dadosFiltrados = dadosFiltrados.filter(item => {
            const dataItem = normalizarDataParaComparacao(item.data);
            if (!dataItem) return false;
            return dataItem >= dIni && dataItem <= dFim;
        });
        
        // Atualiza o cabeçalho com as datas selecionadas
        const filterDate = document.getElementById('filterDate');
        if (filterDate) {
            const dataIniFormatada = formatarDataParaExibicao(dataIni);
            const dataFimFormatada = formatarDataParaExibicao(dataFim);
            if (dataIni === dataFim) {
                filterDate.textContent = `Filtro: ${dataIniFormatada}`;
            } else {
                filterDate.textContent = `Filtro: ${dataIniFormatada} até ${dataFimFormatada}`;
            }
            filterDate.classList.add('active-filter');
        }
    } else {
        const filterDate = document.getElementById('filterDate');
        if (filterDate) {
            filterDate.textContent = 'Todos os registros';
            filterDate.classList.remove('active-filter');
        }
    }
    
    dadosFiltradosHistorico = dadosFiltrados;
    paginaAtual = 1;
    renderizarPagina();
}

function limparFiltroHistorico() {
    const dataInicial = document.getElementById('dataInicial');
    const dataFinal = document.getElementById('dataFinal');
    const buscaInput = document.getElementById('buscaInput');
    
    if (dataInicial) dataInicial.value = '';
    if (dataFinal) dataFinal.value = '';
    if (buscaInput) buscaInput.value = '';
    
    dadosFiltradosHistorico = [...todosDados];
    paginaAtual = 1;
    renderizarPagina();
    
    const filterDate = document.getElementById('filterDate');
    if (filterDate) {
        filterDate.textContent = 'Todos os registros';
        filterDate.classList.remove('active-filter');
    }
}

function filtrarPorBusca() {
    const buscaInput = document.getElementById('buscaInput');
    if (buscaInput) {
        const termo = buscaInput.value.toLowerCase().trim();
        const dataIni = document.getElementById('dataInicial').value;
        const dataFim = document.getElementById('dataFinal').value;
        
        let dadosFiltrados = [...todosDados];
        
        // Filtro por busca
        if (termo) {
            dadosFiltrados = dadosFiltrados.filter(item => 
                item.descricao.toLowerCase().includes(termo)
            );
        }
        
        // Filtro por data
        if (dataIni && dataFim) {
            const dIni = new Date(dataIni + 'T00:00:00');
            const dFim = new Date(dataFim + 'T23:59:59');
            
            dadosFiltrados = dadosFiltrados.filter(item => {
                const dataItem = normalizarDataParaComparacao(item.data);
                if (!dataItem) return false;
                return dataItem >= dIni && dataItem <= dFim;
            });
        }
        
        dadosFiltradosHistorico = dadosFiltrados;
        
        // Atualiza o cabeçalho
        const filterDate = document.getElementById('filterDate');
        if (filterDate) {
            if (dataIni && dataFim) {
                const dataIniFormatada = formatarDataParaExibicao(dataIni);
                const dataFimFormatada = formatarDataParaExibicao(dataFim);
                if (dataIni === dataFim) {
                    filterDate.textContent = `Filtro: ${dataIniFormatada}`;
                } else {
                    filterDate.textContent = `Filtro: ${dataIniFormatada} até ${dataFimFormatada}`;
                }
                filterDate.classList.add('active-filter');
            } else if (termo) {
                filterDate.textContent = `Buscando: "${termo}"`;
                filterDate.classList.add('active-filter');
                filterDate.style.color = '#ff9f1c';
            } else {
                filterDate.textContent = 'Todos os registros';
                filterDate.classList.remove('active-filter');
                filterDate.style.color = '';
            }
        }
        
        paginaAtual = 1;
        renderizarPagina();
    }
}

// ==================== DESPESAS ====================
async function carregarDespesas() {
    if (sessionStorage.getItem('loja_logado') !== 'true') return;
    
    const fd = new FormData();
    fd.append('action', 'listarDespesas');
    
    try {
        const response = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        const res = await response.json();
        
        if (res.status === 'sucesso') {
            todasDespesas = (res.data || []).sort((a, b) => {
                const dataA = parseDataInteligente(a.data);
                const dataB = parseDataInteligente(b.data);
                if (!dataA && !dataB) return 0;
                if (!dataA) return 1;
                if (!dataB) return -1;
                return dataB - dataA;
            });
            despesasFiltradas = [...todasDespesas];
            despesasFiltradasRelatorio = [...todasDespesas];
            paginaDespesaAtual = 1;
            renderizarTabelaDespesas();
            atualizarRelatorios();
            gerarGraficosDespesas(despesasFiltradasRelatorio);
        }
    } catch (error) {
        console.error('Erro ao carregar despesas:', error);
    }
}

function renderizarTabelaDespesas() {
    const container = document.getElementById('tabelaDespesasContainer');
    const pageInfoDespesa = document.getElementById('pageInfoDespesa');
    const totalPaginasDespesa = document.getElementById('totalPaginasDespesa');
    const totalRegistrosDespesa = document.getElementById('totalRegistrosDespesa');
    const btnDespesaAnterior = document.getElementById('btnDespesaAnterior');
    const btnDespesaProxima = document.getElementById('btnDespesaProxima');
    
    if (!container) return;
    
    const totalRegistros = despesasFiltradas.length;
    const totalPags = Math.ceil(totalRegistros / itensDespesaPorPagina);
    
    if (totalRegistrosDespesa) totalRegistrosDespesa.textContent = totalRegistros;
    if (totalPaginasDespesa) totalPaginasDespesa.textContent = totalPags || 1;
    if (pageInfoDespesa) pageInfoDespesa.textContent = paginaDespesaAtual;
    
    if (btnDespesaAnterior) btnDespesaAnterior.disabled = paginaDespesaAtual === 1;
    if (btnDespesaProxima) btnDespesaProxima.disabled = paginaDespesaAtual === totalPags;
    
    if (despesasFiltradas.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 3rem;">
                    <i class="fas fa-inbox" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem; display: block;"></i>
                    <p style="color: #999;">Nenhuma despesa encontrada</p>
                    <small style="color: #ccc;">Tente ajustar os filtros de busca</small>
                </td>
            </tr>
        `;
        return;
    }
    
    const inicio = (paginaDespesaAtual - 1) * itensDespesaPorPagina;
    const fim = inicio + itensDespesaPorPagina;
    const pagData = despesasFiltradas.slice(inicio, fim);
    
    let html = '';
    
    for (const item of pagData) {
        const valor = parseFloat(item.valor) || 0;
        
        let badgeStatusClass = '';
        if (item.status === 'Pago') badgeStatusClass = 'badge-pago';
        else if (item.status === 'Pendente') badgeStatusClass = 'badge-pendente';
        else if (item.status === 'Atrasado') badgeStatusClass = 'badge-atrasado';
        else badgeStatusClass = 'badge-pendente';
        
        html += `
            <tr>
                <td style="font-size: 0.8rem;">${formatarDataDespesa(item.data)}</td>
                <td><span class="categoria-badge">${item.categoria}</span></td>
                <td><strong>${escapeHtml(item.descricao) || '-'}</strong></td>
                <td class="valor-despesa">${formatarMoeda(valor)}</td>
                <td>${item.pagamento}</td>
                <td><span class="${badgeStatusClass}">${item.status}</span></td>
                <td class="text-center" style="white-space: nowrap;">
                    <button class="btn-action btn-action-edit" onclick="editarDespesa('${item.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-action-delete" onclick="excluirDespesa('${item.id}')" title="Excluir">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }
    
    container.innerHTML = html;
}

const despesaForm = document.getElementById('despesaForm');
if (despesaForm) {
    despesaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarDespesa();
    });
}

async function salvarDespesa() {
    const id = document.getElementById('editDespesaId').value;
    const isEdit = id !== "";
    
    const categoria = document.getElementById('categoriaInput').value;
    const descricao = document.getElementById('descDespesa').value;
    const valor = document.getElementById('valorDespesa').value;
    const data = document.getElementById('dataDespesa').value;
    const pagamento = document.getElementById('pagamentoDespesa').value;
    const status = document.getElementById('statusDespesa').value;
    
    if (!categoria) {
        alert("Selecione uma categoria!");
        return;
    }
    if (!valor || parseFloat(valor) <= 0) {
        alert("Informe um valor válido!");
        return;
    }
    if (!data) {
        alert("Informe a data!");
        return;
    }
    if (!pagamento) {
        alert("Selecione a forma de pagamento!");
        return;
    }
    
    const fd = new FormData();
    fd.append('action', isEdit ? 'editarDespesa' : 'salvarDespesa');
    if (isEdit) fd.append('id', id);
    fd.append('categoria', categoria);
    fd.append('descricao', descricao || '');
    fd.append('valor', valor.toString());
    fd.append('data', data);
    fd.append('pagamento', pagamento);
    fd.append('status', status);
    fd.append('criadoPor', sessionStorage.getItem('user_email') || 'Sistema');
    
    const btn = document.getElementById('btnSalvarDespesa');
    const statusMsg = document.getElementById('statusDespesaMsg');
    
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    }
    
    try {
        const response = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        const res = await response.json();
        
        if (res.status === 'sucesso') {
            if (statusMsg) {
                statusMsg.textContent = res.message;
                statusMsg.className = 'status-message status-success';
            }
            cancelarEdicaoDespesa();
            despesaForm.reset();
            const dataDespesa = document.getElementById('dataDespesa');
            if (dataDespesa) dataDespesa.value = new Date().toISOString().split('T')[0];
            await carregarDespesas();
            await carregarDados();
            setTimeout(() => {
                if (statusMsg) {
                    statusMsg.textContent = '';
                    statusMsg.className = 'status-message';
                }
            }, 3000);
        } else {
            throw new Error(res.message);
        }
    } catch (error) {
        console.error('Erro ao salvar despesa:', error);
        if (statusMsg) {
            statusMsg.textContent = "Erro ao salvar despesa: " + error.message;
            statusMsg.className = 'status-message status-error';
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Despesa';
        }
    }
}

function editarDespesa(id) {
    const despesa = todasDespesas.find(d => d.id === id);
    if (!despesa) return;
    
    showSection('despesas');
    
    const editDespesaId = document.getElementById('editDespesaId');
    const categoriaInput = document.getElementById('categoriaInput');
    const descDespesa = document.getElementById('descDespesa');
    const valorDespesa = document.getElementById('valorDespesa');
    const dataDespesa = document.getElementById('dataDespesa');
    const pagamentoDespesa = document.getElementById('pagamentoDespesa');
    const statusDespesa = document.getElementById('statusDespesa');
    const btnSalvarDespesa = document.getElementById('btnSalvarDespesa');
    const btnCancelarDespesa = document.getElementById('btnCancelarDespesa');
    
    if (editDespesaId) editDespesaId.value = despesa.id;
    if (categoriaInput) categoriaInput.value = despesa.categoria;
    if (descDespesa) descDespesa.value = despesa.descricao || '';
    if (valorDespesa) valorDespesa.value = despesa.valor;
    if (dataDespesa) dataDespesa.value = converterDataParaInput(despesa.data);
    if (pagamentoDespesa) pagamentoDespesa.value = despesa.pagamento;
    if (statusDespesa) statusDespesa.value = despesa.status;
    if (btnSalvarDespesa) btnSalvarDespesa.innerHTML = '<i class="fas fa-save"></i> Atualizar Despesa';
    if (btnCancelarDespesa) btnCancelarDespesa.style.display = 'block';
    
    const card = document.querySelector('#despesas .card');
    if (card) card.scrollIntoView({ behavior: 'smooth' });
}

function cancelarEdicaoDespesa() {
    const despesaForm = document.getElementById('despesaForm');
    const editDespesaId = document.getElementById('editDespesaId');
    const btnSalvarDespesa = document.getElementById('btnSalvarDespesa');
    const btnCancelarDespesa = document.getElementById('btnCancelarDespesa');
    const dataDespesa = document.getElementById('dataDespesa');
    
    if (despesaForm) despesaForm.reset();
    if (editDespesaId) editDespesaId.value = '';
    if (btnSalvarDespesa) btnSalvarDespesa.innerHTML = '<i class="fas fa-save"></i> Salvar Despesa';
    if (btnCancelarDespesa) btnCancelarDespesa.style.display = 'none';
    if (dataDespesa) dataDespesa.value = new Date().toISOString().split('T')[0];
}

async function excluirDespesa(id) {
    if (!confirm("Tem certeza que deseja excluir esta despesa?")) return;
    
    const fd = new FormData();
    fd.append('action', 'excluirDespesa');
    fd.append('id', id);
    
    try {
        await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        await carregarDespesas();
        await carregarDados();
    } catch (error) {
        console.error('Erro ao excluir despesa:', error);
        alert("Erro ao excluir despesa!");
    }
}

function aplicarFiltroDespesa() {
    const dataIni = document.getElementById('despesaDataInicial').value;
    const dataFim = document.getElementById('despesaDataFinal').value;
    const categoria = document.getElementById('categoriaFiltro').value;
    
    let dadosFiltrados = [...todasDespesas];
    
    if (categoria) {
        dadosFiltrados = dadosFiltrados.filter(desp => desp.categoria === categoria);
    }
    
    if (dataIni && dataFim) {
        const dIni = new Date(dataIni + 'T00:00:00');
        const dFim = new Date(dataFim + 'T23:59:59');
        
        dadosFiltrados = dadosFiltrados.filter(desp => {
            const data = normalizarDataParaComparacao(desp.data);
            return data && data >= dIni && data <= dFim;
        });
        
        const filterDespesaDate = document.getElementById('filterDespesaDate');
        if (filterDespesaDate) {
            const dataIniFormatada = formatarDataParaExibicao(dataIni);
            const dataFimFormatada = formatarDataParaExibicao(dataFim);
            if (dataIni === dataFim) {
                filterDespesaDate.textContent = `Filtro: ${dataIniFormatada}`;
            } else {
                filterDespesaDate.textContent = `Filtro: ${dataIniFormatada} até ${dataFimFormatada}`;
            }
            filterDespesaDate.classList.add('active-filter');
        }
    } else {
        const filterDespesaDate = document.getElementById('filterDespesaDate');
        if (filterDespesaDate) {
            filterDespesaDate.textContent = 'Todas as despesas';
            filterDespesaDate.classList.remove('active-filter');
        }
    }
    
    despesasFiltradas = dadosFiltrados;
    paginaDespesaAtual = 1;
    renderizarTabelaDespesas();
}

function limparFiltroDespesa() {
    const despesaDataInicial = document.getElementById('despesaDataInicial');
    const despesaDataFinal = document.getElementById('despesaDataFinal');
    const categoriaFiltro = document.getElementById('categoriaFiltro');
    
    if (despesaDataInicial) despesaDataInicial.value = '';
    if (despesaDataFinal) despesaDataFinal.value = '';
    if (categoriaFiltro) categoriaFiltro.value = '';
    
    despesasFiltradas = [...todasDespesas];
    paginaDespesaAtual = 1;
    renderizarTabelaDespesas();
    
    const filterDespesaDate = document.getElementById('filterDespesaDate');
    if (filterDespesaDate) {
        filterDespesaDate.textContent = 'Todas as despesas';
        filterDespesaDate.classList.remove('active-filter');
    }
}

// ==================== RELATÓRIOS ====================
function atualizarRelatorios() {
    if (sessionStorage.getItem('loja_logado') !== 'true') return;
    
    const dados = dadosFiltradosRelatorio;
    const despesas = despesasFiltradasRelatorio;
    
    const hoje = new Date().toLocaleDateString('pt-BR');
    const mesAtual = new Date().getMonth();
    const anoAtual = new Date().getFullYear();
    
    let totalDia = 0, totalMes = 0, totalGeral = 0;
    let descontoDia = 0, descontoMes = 0, descontoGeral = 0;
    let qtdDia = 0, qtdMes = 0, qtdGeral = 0;
    
    for (const item of dados) {
        const valorBruto = parseFloat(item.valor) || 0;
        const desconto = parseFloat(item.desconto) || 0;
        const valorLiquido = valorBruto - desconto;
        
        totalGeral += valorLiquido;
        descontoGeral += desconto;
        qtdGeral++;
        
        const data = parseDataInteligente(item.data);
        if (data) {
            if (data.toLocaleDateString('pt-BR') === hoje) {
                totalDia += valorLiquido;
                descontoDia += desconto;
                qtdDia++;
            }
            if (data.getMonth() === mesAtual && data.getFullYear() === anoAtual) {
                totalMes += valorLiquido;
                descontoMes += desconto;
                qtdMes++;
            }
        }
    }
    
    let totalDespesasMes = 0;
    let totalDespesasGeral = 0;
    
    for (const desp of despesas) {
        const valor = parseFloat(desp.valor) || 0;
        totalDespesasGeral += valor;
        
        const data = parseDataInteligente(desp.data);
        if (data && data.getMonth() === mesAtual && data.getFullYear() === anoAtual) {
            totalDespesasMes += valor;
        }
    }
    
    const lucroMes = totalMes - totalDespesasMes;
    const lucroGeral = totalGeral - totalDespesasGeral;
    
    const totalDiaElem = document.getElementById('totalDia');
    const descontoDiaElem = document.getElementById('descontoDia');
    const totalMesElem = document.getElementById('totalMes');
    const descontoMesElem = document.getElementById('descontoMes');
    const totalGeralElem = document.getElementById('totalGeral');
    const descontoGeralElem = document.getElementById('descontoGeral');
    const despesaMesElem = document.getElementById('despesaMes');
    const lucroMesElem = document.getElementById('lucroMes');
    const lucroGeralElem = document.getElementById('lucroGeral');
    const lucroStatusElem = document.getElementById('lucroStatus');
    
    if (totalDiaElem) totalDiaElem.innerHTML = `${formatarMoeda(totalDia)}<br><small>${qtdDia} venda(s)</small>`;
    if (descontoDiaElem) descontoDiaElem.innerHTML = `Descontos: ${formatarMoeda(descontoDia)}`;
    if (totalMesElem) totalMesElem.innerHTML = `${formatarMoeda(totalMes)}<br><small>${qtdMes} venda(s)</small>`;
    if (descontoMesElem) descontoMesElem.innerHTML = `Descontos: ${formatarMoeda(descontoMes)}`;
    if (totalGeralElem) totalGeralElem.innerHTML = `${formatarMoeda(totalGeral)}<br><small>${qtdGeral} venda(s)</small>`;
    if (descontoGeralElem) descontoGeralElem.innerHTML = `Descontos: ${formatarMoeda(descontoGeral)}`;
    if (despesaMesElem) despesaMesElem.innerHTML = formatarMoeda(totalDespesasMes);
    if (lucroMesElem) lucroMesElem.innerHTML = formatarMoeda(lucroMes);
    if (lucroGeralElem) lucroGeralElem.innerHTML = formatarMoeda(lucroGeral);
    
    if (lucroStatusElem) {
        if (lucroMes >= 0) {
            lucroStatusElem.innerHTML = '💰 Lucro';
            lucroStatusElem.style.color = '#2ec4b6';
        } else {
            lucroStatusElem.innerHTML = '⚠️ Prejuízo';
            lucroStatusElem.style.color = '#e63946';
        }
    }
}

// ==================== GRÁFICOS ====================
function gerarGraficosVendas(dados) {
    const porMesLiquido = {};
    const porMesDesconto = {};
    const porPagamento = {};
    const porPagamentoValor = {};
    
    for (const item of dados) {
        const data = parseDataInteligente(item.data);
        const valorBruto = parseFloat(item.valor) || 0;
        const desconto = parseFloat(item.desconto) || 0;
        const valorLiquido = valorBruto - desconto;
        
        if (data) {
            const mes = `${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
            
            porMesLiquido[mes] = (porMesLiquido[mes] || 0) + valorLiquido;
            porMesDesconto[mes] = (porMesDesconto[mes] || 0) + desconto;
        }
        
        porPagamento[item.pagamento] = (porPagamento[item.pagamento] || 0) + 1;
        porPagamentoValor[item.pagamento] = (porPagamentoValor[item.pagamento] || 0) + valorLiquido;
    }
    
    const cores = ['#4361ee', '#7209b7', '#2ec4b6', '#ff9f1c', '#e63946', '#4cc9f0'];
    
    const chartVendas = document.getElementById('chartVendas');
    if (chartVendas) {
        if (graficoVendas) graficoVendas.destroy();
        const ctx = chartVendas.getContext('2d');
        graficoVendas = new Chart(ctx, {
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
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (v) => formatarMoeda(v) }
                    }
                }
            }
        });
    }
    
    const chartPagamento = document.getElementById('chartPagamento');
    if (chartPagamento) {
        if (graficoPagamento) graficoPagamento.destroy();
        const ctx = chartPagamento.getContext('2d');
        graficoPagamento = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(porPagamento),
                datasets: [{
                    data: Object.values(porPagamento),
                    backgroundColor: cores.slice(0, Object.keys(porPagamento).length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed} vendas (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    const chartPagamentoValor = document.getElementById('chartPagamentoValor');
    if (chartPagamentoValor) {
        if (graficoPagamentoValor) graficoPagamentoValor.destroy();
        const ctx = chartPagamentoValor.getContext('2d');
        
        const sortedLabels = Object.keys(porPagamentoValor).sort((a, b) => porPagamentoValor[b] - porPagamentoValor[a]);
        const sortedValues = sortedLabels.map(key => porPagamentoValor[key]);
        
        graficoPagamentoValor = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedLabels,
                datasets: [{
                    label: 'Valor Total (R$)',
                    data: sortedValues,
                    backgroundColor: [
                        '#4361ee', '#7209b7', '#2ec4b6', '#ff9f1c', '#e63946', '#4cc9f0'
                    ].slice(0, sortedLabels.length),
                    borderRadius: 8,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Total: ${formatarMoeda(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (v) => formatarMoeda(v)
                        }
                    }
                }
            }
        });
    }
    
    const chartDescontos = document.getElementById('chartDescontos');
    if (chartDescontos) {
        if (graficoDescontos) graficoDescontos.destroy();
        const ctx = chartDescontos.getContext('2d');
        graficoDescontos = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(porMesDesconto),
                datasets: [{
                    label: 'Descontos (R$)',
                    data: Object.values(porMesDesconto),
                    backgroundColor: 'rgba(230, 57, 70, 0.7)',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (v) => formatarMoeda(v) }
                    }
                }
            }
        });
    }
}

function gerarGraficosDespesas(despesas) {
    const mesAtual = new Date().getMonth();
    const anoAtual = new Date().getFullYear();
    
    let totalVendas = 0;
    for (const item of dadosFiltradosRelatorio) {
        const data = parseDataInteligente(item.data);
        if (data && data.getMonth() === mesAtual && data.getFullYear() === anoAtual) {
            totalVendas += (parseFloat(item.valor) || 0) - (parseFloat(item.desconto) || 0);
        }
    }
    
    let totalDespesas = 0;
    const despesasPorMes = {};
    
    for (const desp of despesas) {
        const valor = parseFloat(desp.valor) || 0;
        const data = parseDataInteligente(desp.data);
        
        if (data) {
            if (data.getMonth() === mesAtual && data.getFullYear() === anoAtual) {
                totalDespesas += valor;
            }
            
            const mes = `${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
            despesasPorMes[mes] = (despesasPorMes[mes] || 0) + valor;
        }
    }
    
    const chartDespesasLucro = document.getElementById('chartDespesasLucro');
    if (chartDespesasLucro) {
        if (graficoDespesasLucro) graficoDespesasLucro.destroy();
        const ctx = chartDespesasLucro.getContext('2d');
        graficoDespesasLucro = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Vendas Líquidas', 'Despesas'],
                datasets: [{
                    data: [totalVendas, totalDespesas],
                    backgroundColor: ['#2ec4b6', '#e63946'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${formatarMoeda(context.parsed)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    const chartDespesasMes = document.getElementById('chartDespesasMes');
    if (chartDespesasMes) {
        if (graficoDespesasMes) graficoDespesasMes.destroy();
        const ctx = chartDespesasMes.getContext('2d');
        graficoDespesasMes = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(despesasPorMes),
                datasets: [{
                    label: 'Despesas (R$)',
                    data: Object.values(despesasPorMes),
                    borderColor: '#e63946',
                    backgroundColor: 'rgba(230, 57, 70, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (v) => formatarMoeda(v) }
                    }
                }
            }
        });
    }
}

function filtrarRelatorio() {
    const dataIni = document.getElementById('dataInicialRel').value;
    const dataFim = document.getElementById('dataFinalRel').value;
    
    if (!dataIni || !dataFim) {
        alert("Selecione o período!");
        return;
    }
    
    const dIni = new Date(dataIni + 'T00:00:00');
    const dFim = new Date(dataFim + 'T23:59:59');
    
    dadosFiltradosRelatorio = todosDados.filter(item => {
        const data = normalizarDataParaComparacao(item.data);
        return data && data >= dIni && data <= dFim;
    });
    
    despesasFiltradasRelatorio = todasDespesas.filter(item => {
        const data = normalizarDataParaComparacao(item.data);
        return data && data >= dIni && data <= dFim;
    });
    
    atualizarRelatorios();
    gerarGraficosVendas(dadosFiltradosRelatorio);
    gerarGraficosDespesas(despesasFiltradasRelatorio);
    
    const reportDate = document.getElementById('reportDate');
    if (reportDate) {
        const dataIniFormatada = formatarDataParaExibicao(dataIni);
        const dataFimFormatada = formatarDataParaExibicao(dataFim);
        if (dataIni === dataFim) {
            reportDate.textContent = `Período: ${dataIniFormatada}`;
        } else {
            reportDate.textContent = `Período: ${dataIniFormatada} até ${dataFimFormatada}`;
        }
        reportDate.classList.add('active-filter');
    }
}

function limparFiltroRelatorio() {
    dadosFiltradosRelatorio = [...todosDados];
    despesasFiltradasRelatorio = [...todasDespesas];
    
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    const dataInicialRel = document.getElementById('dataInicialRel');
    const dataFinalRel = document.getElementById('dataFinalRel');
    
    if (dataInicialRel) dataInicialRel.value = primeiroDia.toISOString().split('T')[0];
    if (dataFinalRel) dataFinalRel.value = ultimoDia.toISOString().split('T')[0];
    
    atualizarRelatorios();
    gerarGraficosVendas(dadosFiltradosRelatorio);
    gerarGraficosDespesas(despesasFiltradasRelatorio);
    
    const reportDate = document.getElementById('reportDate');
    if (reportDate) {
        reportDate.textContent = 'Período atual';
        reportDate.classList.remove('active-filter');
    }
}

// ==================== EXPORTAÇÃO ====================
function exportarExcel() {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const dadosPagina = dadosFiltradosHistorico.slice(inicio, inicio + itensPorPagina);
    
    if (dadosPagina.length === 0) {
        alert("Não há dados para exportar!");
        return;
    }
    
    const dadosFormatados = dadosPagina.map(item => ({
        "Data": formatarDataVisual(item.data),
        "Descrição": item.descricao,
        "Valor Bruto": parseFloat(item.valor) || 0,
        "Desconto": parseFloat(item.desconto) || 0,
        "Valor Líquido": (parseFloat(item.valor) || 0) - (parseFloat(item.desconto) || 0),
        "Pagamento": item.pagamento,
        "Vendedor": item.vendedor || ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(dadosFormatados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendas");
    
    const hoje = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Vendas_${hoje}.xlsx`);
}

async function exportarPDF() {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const dadosPagina = dadosFiltradosHistorico.slice(inicio, inicio + itensPorPagina);
    
    if (dadosPagina.length === 0) {
        alert("Não há dados para exportar!");
        return;
    }
    
    if (typeof window.jspdf === 'undefined') {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    
    const dadosPdf = dadosPagina.map(item => {
        const valorBruto = parseFloat(item.valor) || 0;
        const desconto = parseFloat(item.desconto) || 0;
        const valorLiquido = valorBruto - desconto;
        
        return [
            formatarDataParaRelatorio(item.data),
            item.descricao,
            `R$ ${valorBruto.toFixed(2).replace('.', ',')}`,
            `R$ ${desconto.toFixed(2).replace('.', ',')}`,
            `R$ ${valorLiquido.toFixed(2).replace('.', ',')}`,
            item.pagamento,
            item.vendedor || '-'
        ];
    });
    
    let totalBruto = 0, totalDesconto = 0, totalLiquido = 0;
    for (const item of dadosPagina) {
        totalBruto += parseFloat(item.valor) || 0;
        totalDesconto += parseFloat(item.desconto) || 0;
        totalLiquido += (parseFloat(item.valor) || 0) - (parseFloat(item.desconto) || 0);
    }
    
    dadosPdf.push([
        '',
        'TOTAL:',
        `R$ ${totalBruto.toFixed(2).replace('.', ',')}`,
        `R$ ${totalDesconto.toFixed(2).replace('.', ',')}`,
        `R$ ${totalLiquido.toFixed(2).replace('.', ',')}`,
        '',
        ''
    ]);
    
    doc.setFontSize(18);
    doc.setTextColor(67, 97, 238);
    doc.text('Relatório de Vendas - Cortetons', 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 25);
    doc.text(`Página: ${paginaAtual} de ${Math.ceil(dadosFiltradosHistorico.length / itensPorPagina)}`, 14, 32);
    doc.text(`Total de registros: ${dadosFiltradosHistorico.length}`, 14, 39);
    
    doc.autoTable({
        head: [['Data', 'Descrição', 'Valor Bruto', 'Desconto', 'Valor Líquido', 'Pagamento', 'Vendedor']],
        body: dadosPdf,
        startY: 45,
        theme: 'striped',
        headStyles: { fillColor: [26, 26, 46], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 50 },
            2: { cellWidth: 25 },
            3: { cellWidth: 25 },
            4: { cellWidth: 25 },
            5: { cellWidth: 25 },
            6: { cellWidth: 25 }
        }
    });
    
    const hoje = new Date().toISOString().split('T')[0];
    doc.save(`Relatorio_Vendas_${hoje}_Pagina_${paginaAtual}.pdf`);
}

async function exportarDespesasPDF() {
    if (despesasFiltradas.length === 0) {
        alert("Não há despesas para exportar!");
        return;
    }
    
    if (typeof window.jspdf === 'undefined') {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const dadosPdf = despesasFiltradas.map(d => [
        formatarDataDespesa(d.data),
        d.categoria,
        d.descricao || '-',
        `R$ ${(parseFloat(d.valor) || 0).toFixed(2).replace('.', ',')}`,
        d.pagamento,
        d.status
    ]);
    
    let totalDespesas = 0;
    for (const d of despesasFiltradas) {
        totalDespesas += parseFloat(d.valor) || 0;
    }
    
    dadosPdf.push(['', '', 'TOTAL:', `R$ ${totalDespesas.toFixed(2).replace('.', ',')}`, '', '']);
    
    doc.setFontSize(16);
    doc.setTextColor(67, 97, 238);
    doc.text('Relatório de Despesas - Cortetons', 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22);
    doc.text(`Total de despesas: ${despesasFiltradas.length}`, 14, 29);
    
    doc.autoTable({
        head: [['Data', 'Categoria', 'Descrição', 'Valor', 'Pagamento', 'Status']],
        body: dadosPdf,
        startY: 35,
        theme: 'striped',
        headStyles: { fillColor: [26, 26, 46], textColor: 255 },
        bodyStyles: { fontSize: 9 }
    });
    
    const hoje = new Date().toISOString().split('T')[0];
    doc.save(`Relatorio_Despesas_${hoje}.pdf`);
}

function exportarDespesasExcel() {
    if (despesasFiltradas.length === 0) {
        alert("Não há despesas para exportar!");
        return;
    }
    
    const dadosFormatados = despesasFiltradas.map(d => ({
        "Data": formatarDataDespesa(d.data),
        "Categoria": d.categoria,
        "Descrição": d.descricao || '',
        "Valor": parseFloat(d.valor) || 0,
        "Pagamento": d.pagamento,
        "Status": d.status
    }));
    
    const ws = XLSX.utils.json_to_sheet(dadosFormatados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Despesas");
    
    const hoje = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Despesas_${hoje}.xlsx`);
}

// ==================== PAGINAÇÃO ====================
const btnPaginaAnterior = document.getElementById('btnPaginaAnterior');
const btnPaginaProxima = document.getElementById('btnPaginaProxima');
const btnDespesaAnterior = document.getElementById('btnDespesaAnterior');
const btnDespesaProxima = document.getElementById('btnDespesaProxima');

if (btnPaginaAnterior) {
    btnPaginaAnterior.addEventListener('click', () => {
        const total = Math.ceil(dadosFiltradosHistorico.length / itensPorPagina);
        if (paginaAtual > 1) {
            paginaAtual--;
            renderizarPagina();
        }
    });
}

if (btnPaginaProxima) {
    btnPaginaProxima.addEventListener('click', () => {
        const total = Math.ceil(dadosFiltradosHistorico.length / itensPorPagina);
        if (paginaAtual < total) {
            paginaAtual++;
            renderizarPagina();
        }
    });
}

if (btnDespesaAnterior) {
    btnDespesaAnterior.addEventListener('click', () => {
        const total = Math.ceil(despesasFiltradas.length / itensDespesaPorPagina);
        if (paginaDespesaAtual > 1) {
            paginaDespesaAtual--;
            renderizarTabelaDespesas();
        }
    });
}

if (btnDespesaProxima) {
    btnDespesaProxima.addEventListener('click', () => {
        const total = Math.ceil(despesasFiltradas.length / itensDespesaPorPagina);
        if (paginaDespesaAtual < total) {
            paginaDespesaAtual++;
            renderizarTabelaDespesas();
        }
    });
}

// ==================== EVENT LISTENERS ====================
document.querySelectorAll('.menu-btn[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.getAttribute('data-section');
        if (section) showSection(section);
    });
});

document.querySelectorAll('.mobile-nav-btn[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.getAttribute('data-section');
        if (section) showSection(section);
    });
});

const btnFiltrar = document.getElementById('btnFiltrar');
const btnLimparFiltro = document.getElementById('btnLimparFiltro');
const btnExportarExcel = document.getElementById('btnExportarExcel');
const btnExportarPDF = document.getElementById('btnExportarPDF');
const btnFiltrarRelatorio = document.getElementById('btnFiltrarRelatorio');
const btnLimparRelatorio = document.getElementById('btnLimparRelatorio');
const btnFiltrarDespesa = document.getElementById('btnFiltrarDespesa');
const btnLimparFiltroDespesa = document.getElementById('btnLimparFiltroDespesa');
const btnExportarDespesasExcel = document.getElementById('btnExportarDespesasExcel');
const btnExportarDespesasPDF = document.getElementById('btnExportarDespesasPDF');
const btnCancelar = document.getElementById('btnCancelar');
const btnCancelarDespesa = document.getElementById('btnCancelarDespesa');

if (btnFiltrar) btnFiltrar.addEventListener('click', aplicarFiltroHistorico);
if (btnLimparFiltro) btnLimparFiltro.addEventListener('click', limparFiltroHistorico);
if (btnExportarExcel) btnExportarExcel.addEventListener('click', exportarExcel);
if (btnExportarPDF) btnExportarPDF.addEventListener('click', exportarPDF);
if (btnFiltrarRelatorio) btnFiltrarRelatorio.addEventListener('click', filtrarRelatorio);
if (btnLimparRelatorio) btnLimparRelatorio.addEventListener('click', limparFiltroRelatorio);
if (btnFiltrarDespesa) btnFiltrarDespesa.addEventListener('click', aplicarFiltroDespesa);
if (btnLimparFiltroDespesa) btnLimparFiltroDespesa.addEventListener('click', limparFiltroDespesa);
if (btnExportarDespesasExcel) btnExportarDespesasExcel.addEventListener('click', exportarDespesasExcel);
if (btnExportarDespesasPDF) btnExportarDespesasPDF.addEventListener('click', exportarDespesasPDF);
if (btnCancelar) btnCancelar.addEventListener('click', cancelarEdicao);
if (btnCancelarDespesa) btnCancelarDespesa.addEventListener('click', cancelarEdicaoDespesa);

const valorInput = document.getElementById('valorInput');
const descontoInput = document.getElementById('descontoInput');
if (valorInput) valorInput.addEventListener('input', calcularValorFinal);
if (descontoInput) descontoInput.addEventListener('input', calcularValorFinal);

const buscaInput = document.getElementById('buscaInput');
if (buscaInput) {
    buscaInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            aplicarFiltroHistorico();
        } else {
            filtrarPorBusca();
        }
    });
}

// ==================== INICIALIZAÇÃO ====================
window.onload = () => {
    sessionStorage.clear();
    
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.classList.remove('hidden');
    
    const userInfo = document.getElementById('userInfo');
    if (userInfo) userInfo.classList.remove('active');
    
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    const dataInicialRel = document.getElementById('dataInicialRel');
    const dataFinalRel = document.getElementById('dataFinalRel');
    const dataDespesa = document.getElementById('dataDespesa');
    const dataInicial = document.getElementById('dataInicial');
    const dataFinal = document.getElementById('dataFinal');
    
    if (dataInicialRel) dataInicialRel.value = primeiroDia.toISOString().split('T')[0];
    if (dataFinalRel) dataFinalRel.value = ultimoDia.toISOString().split('T')[0];
    if (dataDespesa) dataDespesa.value = hoje.toISOString().split('T')[0];
    
    const data30Dias = new Date();
    data30Dias.setDate(data30Dias.getDate() - 30);
    if (dataInicial) dataInicial.value = data30Dias.toISOString().split('T')[0];
    if (dataFinal) dataFinal.value = hoje.toISOString().split('T')[0];
    
    atualizarDataAtual();
    calcularValorFinal();
    
    if (window.innerWidth <= 992) {
        const sidebar = document.querySelector('.sidebar');
        const mobileFooter = document.getElementById('mobileFooter');
        if (sidebar) sidebar.style.display = 'none';
        if (mobileFooter) mobileFooter.style.display = 'block';
    } else {
        const sidebar = document.querySelector('.sidebar');
        const mobileFooter = document.getElementById('mobileFooter');
        if (sidebar) sidebar.style.display = 'flex';
        if (mobileFooter) mobileFooter.style.display = 'none';
    }
    
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 992) {
            const sidebar = document.querySelector('.sidebar');
            const mobileFooter = document.getElementById('mobileFooter');
            if (sidebar) sidebar.style.display = 'none';
            if (mobileFooter) mobileFooter.style.display = 'block';
        } else {
            const sidebar = document.querySelector('.sidebar');
            const mobileFooter = document.getElementById('mobileFooter');
            if (sidebar) sidebar.style.display = 'flex';
            if (mobileFooter) mobileFooter.style.display = 'none';
        }
    });
    
    setTimeout(() => {
        const loginEmail = document.getElementById('loginEmail');
        if (loginEmail) loginEmail.focus();
    }, 500);
};

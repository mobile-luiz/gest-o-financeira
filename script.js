// ==================== CONFIGURAÇÃO ====================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzDqREcL55i3BlBvk4R8BoQRoef7mQ2KnwSx85RAbK9rY87RR7bYz-wJtUn6TXHZgQ9UQ/exec';

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
let graficoDiaSemana = null;
let graficoDespesasLucro = null;
let graficoDespesasMes = null;
let graficoServicos = null;
let graficoDesempenho = null;

// ==================== TIPOS DE SERVIÇO ====================
// O tipo é gravado no início da descrição, ex: "[Roupas] Camisa polo".
// Assim funciona sem precisar alterar a planilha / Apps Script.
const TIPOS_SERVICO = ['Roupas', 'Serviços de Salão'];
const TIPO_SEM_CLASSIFICACAO = 'Não classificado';
const CORES_TIPO = {
    'Roupas': '#7209b7',
    'Serviços de Salão': '#2ec4b6',
    'Não classificado': '#adb5bd'
};

// Palavras que indicam Serviço de Salão (sem acento). O que não bater aqui conta como Roupas.
// Para incluir um serviço novo, é só acrescentar a palavra na lista.
const PALAVRAS_SALAO = [
    'corte', 'cortar', 'cabelo', 'escova', 'progressiva', 'hidratacao', 'coloracao', 'tintura', 'pintar',
    'luzes', 'mechas', 'reflexo', 'alisamento', 'relaxamento', 'cauterizacao', 'botox', 'selagem',
    'penteado', 'manicure', 'pedicure', 'unha', 'unhas', 'esmaltacao', 'alongamento', 'fibra', 'gel',
    'sobrancelha', 'sobrancelhas', 'henna', 'cilios', 'depilacao', 'maquiagem', 'make', 'barba',
    'pigmentacao', 'tranca', 'trancas', 'babyliss', 'chapinha', 'lavagem', 'reconstrucao', 'nutricao',
    'matizacao', 'descoloracao', 'platinado', 'limpeza de pele', 'massagem', 'spa', 'salao', 'franja',
    'tinta', 'aplicacao', 'aplic', 'sobr', 'somb', 'sombreado', 'decapagem', 'relax', 'progr', 'secar', 'lavar',
    'escovar', 'hidrat', 'luz', 'pezinho', 'navalhado', 'degrade', 'raiz', 'retoque'
];
// Começos de palavra que também indicam salão (ex.: "sobranc", "progressiva", "aplicaçao")
const PREFIXOS_SALAO = ['sobranc', 'progress', 'aplica', 'sombr', 'relax', 'hidrat', 'colora', 'escov', 'depil', 'manicur', 'pedicur', 'cauteriz', 'alisa'];

function normalizarTexto(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function classificarTipo(descricao) {
    const t = ' ' + normalizarTexto(descricao).replace(/[^a-z0-9]+/g, ' ') + ' ';
    if (PALAVRAS_SALAO.some(p => t.includes(' ' + p + ' '))) return 'Serviços de Salão';
    if (t.trim().split(' ').some(w => PREFIXOS_SALAO.some(p => w.startsWith(p)))) return 'Serviços de Salão';
    return 'Roupas';
}

function extrairTipo(descricao) {
    const texto = String(descricao || '');
    const m = texto.match(/^\s*\[([^\]]+)\]\s*/);
    if (m && TIPOS_SERVICO.includes(m[1].trim())) {
        return { tipo: m[1].trim(), texto: texto.slice(m[0].length) };
    }
    // Vendas antigas (sem tipo gravado): classifica pela descrição
    return { tipo: classificarTipo(texto), texto: texto };
}

function montarDescricao(tipo, texto) {
    return `[${tipo}] ${texto}`;
}

function classeBadgeTipo(tipo) {
    if (tipo === 'Roupas') return 'badge-tipo badge-tipo-roupas';
    if (tipo === 'Serviços de Salão') return 'badge-tipo badge-tipo-salao';
    return 'badge-tipo badge-tipo-nc';
}

// Dados filtrados para relatórios
let dadosFiltradosRelatorio = [];
let despesasFiltradasRelatorio = [];
let filtroRelatorioAtivo = false;

function filtrarPeriodoRelatorio(lista) {
    if (!filtroRelatorioAtivo) return [...lista];
    const dataIni = document.getElementById('dataInicialRel').value;
    const dataFim = document.getElementById('dataFinalRel').value;
    if (!dataIni || !dataFim) return [...lista];
    const dIni = new Date(dataIni + 'T00:00:00');
    const dFim = new Date(dataFim + 'T23:59:59');
    return lista.filter(item => {
        const d = parseDataInteligente(item.data);
        return d && d >= dIni && d <= dFim;
    });
}

// ==================== COMUNICAÇÃO COM A PLANILHA (Apps Script) ====================
// Envia o token do login em toda chamada. Se a sessão vencer, volta para a tela de login.
async function apiFetch(fd) {
    const token = sessionStorage.getItem('token');
    if (token && !fd.has('token')) fd.append('token', token);
    const response = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
    const res = await response.json();
    if (res && res.codigo === 'SESSAO_EXPIRADA' && fd.get('action') !== 'login') {
        sessaoExpirada();
    }
    return { json: async () => res };
}

let avisouSessao = false;
function sessaoExpirada() {
    if (avisouSessao) return;
    avisouSessao = true;
    sessionStorage.clear();
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.classList.remove('hidden');
    const userInfo = document.getElementById('userInfo');
    if (userInfo) userInfo.classList.remove('active');
    const status = document.getElementById('loginStatus');
    if (status) {
        status.textContent = 'Sua sessão expirou. Entre novamente.';
        status.className = 'status-message status-error';
    }
    setTimeout(() => { avisouSessao = false; }, 2000);
}

function sair() {
    const token = sessionStorage.getItem('token');
    if (token) {
        const fd = new FormData();
        fd.append('action', 'logout');
        fd.append('token', token);
        // não espera a resposta para não travar a saída
        try { navigator.sendBeacon ? navigator.sendBeacon(SCRIPT_URL, fd) : fetch(SCRIPT_URL, { method: 'POST', body: fd }); } catch (e) {}
    }
    sessionStorage.clear();
    location.reload();
}

// ==================== FUNÇÕES UTILITÁRIAS ====================
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function formatarDataVisual(dataStr) {
    const d = parseDataInteligente(dataStr);
    if (!d) return dataStr ? String(dataStr) : '---';
    if (ehSomenteData(dataStr)) return d.toLocaleDateString('pt-BR');
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatarDataDespesa(dataStr) {
    const d = parseDataInteligente(dataStr);
    if (!d) return dataStr ? String(dataStr) : '---';
    return d.toLocaleDateString('pt-BR');
}

function formatarDataParaRelatorio(dataStr) {
    return formatarDataDespesa(dataStr);
}

function parseDataInteligente(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
    if (typeof valor === 'number') {
        const d = new Date(valor);
        return isNaN(d.getTime()) ? null : d;
    }
    const s = String(valor).trim();
    // Formato brasileiro: dd/mm/aaaa [hh:mm[:ss]]  (o JS lia como mm/dd!)
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\s,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    // Só data ISO (aaaa-mm-dd): usa horário local, sem "voltar um dia" pelo fuso
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

function dataLocalISO(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ehSomenteData(valor) {
    const s = String(valor || '').trim();
    return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function ordenarMeses(obj) {
    // chaves no formato mm/aaaa -> ordem cronológica
    return Object.keys(obj).sort((a, b) => {
        const [ma, aa] = a.split('/').map(Number);
        const [mb, ab] = b.split('/').map(Number);
        return (aa - ab) || (ma - mb);
    });
}

function normalizarDataParaComparacao(dataStr) {
    return parseDataInteligente(dataStr);
}

function converterDataParaInput(dataStr) {
    const d = parseDataInteligente(dataStr);
    return d ? dataLocalISO(d) : '';
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
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ==================== NOTIFICAÇÕES (substituem o alert) ====================
function mostrarToast(mensagem, tipo = 'aviso') {
    const container = document.getElementById('toastContainer');
    if (!container) { console.log(mensagem); return; }
    const icones = { sucesso: 'fa-circle-check', erro: 'fa-circle-xmark', aviso: 'fa-circle-exclamation' };
    const el = document.createElement('div');
    el.className = `toast toast-${tipo}`;
    el.innerHTML = `<i class="fas ${icones[tipo] || icones.aviso}"></i><span>${escapeHtml(mensagem)}</span>`;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }, 3500);
}

function confirmarAcao(mensagem, titulo = 'Confirmar exclusão') {
    return new Promise(resolve => {
        const modal = document.getElementById('confirmModal');
        if (!modal) { resolve(window.confirm(mensagem)); return; }
        document.getElementById('confirmTitulo').textContent = titulo;
        document.getElementById('confirmMensagem').textContent = mensagem;
        modal.classList.remove('hidden');
        const ok = document.getElementById('confirmOk');
        const cancelar = document.getElementById('confirmCancelar');
        const fechar = (valor) => {
            modal.classList.add('hidden');
            ok.onclick = cancelar.onclick = modal.onclick = null;
            document.removeEventListener('keydown', teclado);
            resolve(valor);
        };
        const teclado = (e) => { if (e.key === 'Escape') fechar(false); };
        ok.onclick = () => fechar(true);
        cancelar.onclick = () => fechar(false);
        modal.onclick = (e) => { if (e.target === modal) fechar(false); };
        document.addEventListener('keydown', teclado);
        ok.focus();
    });
}

// ==================== CHIPS (tipo de serviço / pagamento) ====================
function sincronizarChips() {
    document.querySelectorAll('.chip-group').forEach(grupo => {
        const select = document.getElementById(grupo.dataset.target);
        const valor = select ? select.value : '';
        grupo.querySelectorAll('.chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.value === valor);
        });
    });
}

// true quando o caixa clicou no tipo (aí a descrição não muda mais a escolha)
let tipoManual = false;

document.querySelectorAll('.chip-group').forEach(grupo => {
    grupo.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        const select = document.getElementById(grupo.dataset.target);
        if (select) select.value = chip.dataset.value;
        if (grupo.dataset.target === 'tipoServicoInput') tipoManual = true;
        sincronizarChips();
    });
});

function carregarScript(src) {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
}

async function garantirJsPDF() {
    if (typeof window.jspdf === 'undefined') {
        await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js');
    }
    if (typeof window.jspdf === 'undefined') {
        mostrarToast('Não foi possível carregar o gerador de PDF. Verifique a internet.', 'erro');
        return false;
    }
    return true;
}

function linhaCarregando(colunas, texto) {
    return `<tr><td colspan="${colunas}" class="linha-carregando"><i class="fas fa-spinner fa-spin"></i> ${texto}</td></tr>`;
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
        if (valorFinalDisplay) valorFinalDisplay.style.color = '';
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
    
    if (sectionId === 'lancamentos' || sectionId === 'relatorios' || sectionId === 'servicos') {
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
            const response = await apiFetch(fd);
            const res = await response.json();
            
            if (res.status === 'sucesso') {
                sessionStorage.setItem('loja_logado', 'true');
                if (res.token) sessionStorage.setItem('token', res.token);
                sessionStorage.setItem('user_email', email);
                
                const loginOverlay = document.getElementById('loginOverlay');
                if (loginOverlay) loginOverlay.classList.add('hidden');
                
                const userInfo = document.getElementById('userInfo');
                if (userInfo) userInfo.classList.add('active');
                
                const userEmail = document.getElementById('userEmail');
                if (userEmail) userEmail.textContent = email;
                atualizarAvatar(email);
                
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

// Mostrar/ocultar senha e aviso de Caps Lock
const btnMostrarSenha = document.getElementById('btnMostrarSenha');
if (btnMostrarSenha) {
    btnMostrarSenha.addEventListener('click', () => {
        const campo = document.getElementById('loginPassword');
        const mostrar = campo.type === 'password';
        campo.type = mostrar ? 'text' : 'password';
        btnMostrarSenha.innerHTML = `<i class="far ${mostrar ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
        btnMostrarSenha.title = mostrar ? 'Ocultar senha' : 'Mostrar senha';
        campo.focus();
    });
}
const campoSenha = document.getElementById('loginPassword');
if (campoSenha) {
    const verificarCaps = (e) => {
        const aviso = document.getElementById('avisoCaps');
        if (aviso && e.getModifierState) aviso.classList.toggle('hidden', !e.getModifierState('CapsLock'));
    };
    campoSenha.addEventListener('keydown', verificarCaps);
    campoSenha.addEventListener('keyup', verificarCaps);
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', sair);
}

// ==================== VENDAS ====================
const vendaForm = document.getElementById('vendaForm');
if (vendaForm) {
    vendaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (sessionStorage.getItem('loja_logado') !== 'true') {
            mostrarToast("Faça login primeiro!", 'aviso');
            return;
        }
        
        const descricaoTexto = extrairTipo(document.getElementById('descInput').value.trim()).texto.trim();
        const tipoServico = document.getElementById('tipoServicoInput').value || classificarTipo(descricaoTexto);
        const descricao = descricaoTexto;
        const valor = parseFloat(document.getElementById('valorInput').value) || 0;
        const desconto = parseFloat(document.getElementById('descontoInput').value) || 0;
        const pagamento = document.getElementById('pagInput').value;
        
        if (!descricao) {
            mostrarToast("Informe a descrição!", 'aviso');
            return;
        }
        if (valor <= 0) {
            mostrarToast("Valor deve ser maior que zero!", 'aviso');
            return;
        }
        if (desconto > valor) {
            mostrarToast("Desconto não pode ser maior que o valor!", 'aviso');
            return;
        }
        if (!pagamento) {
            mostrarToast("Selecione a forma de pagamento!", 'aviso');
            return;
        }
        
        if (!dataHoraVendaTexto()) {
            mostrarToast("Informe a data e o horário da venda!", 'aviso');
            return;
        }
        
        const btn = document.getElementById('btnSalvar');
        const statusDiv = document.getElementById('status');
        const editId = document.getElementById('editId').value;
        const isEdit = editId !== "";
        
        const fd = new FormData();
        fd.append('action', isEdit ? 'editar' : 'salvar');
        if (isEdit) fd.append('id', editId);
        fd.append('descricao', montarDescricao(tipoServico, descricao));
        fd.append('tipo', tipoServico);
        fd.append('valor', valor.toString());
        fd.append('desconto', desconto.toString());
        fd.append('pagamento', pagamento);
        fd.append('vendedor', sessionStorage.getItem('user_email'));
        fd.append('data', dataHoraVendaTexto());
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        }
        
        try {
            const response = await apiFetch(fd);
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
                    if (valorInput) valorInput.value = '';
                    if (descontoInput) descontoInput.value = '';
                    calcularValorFinal();
                    sincronizarChips();
                }
                mostrarToast(isEdit ? 'Venda atualizada!' : 'Venda registrada!', 'sucesso');
                
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
    const tabela = document.getElementById('tabelaContainer');
    if (tabela && todosDados.length === 0) tabela.innerHTML = linhaCarregando(9, 'Carregando vendas...');
    
    const fd = new FormData();
    fd.append('action', 'listar');
    
    try {
        const response = await apiFetch(fd);
        const res = await response.json();
        
        if (res.status === 'sucesso') {
            (res.data || []).forEach(item => {
                // Coluna "Tipo" da planilha (versão nova do Apps Script)
                if (item.tipo && TIPOS_SERVICO.includes(item.tipo) && !/^\s*\[/.test(String(item.descricao || ''))) {
                    item.descricao = `[${item.tipo}] ${item.descricao}`;
                }
            });
            todosDados = (res.data || []).sort((a, b) => {
                const dataA = parseDataInteligente(a.data);
                const dataB = parseDataInteligente(b.data);
                if (!dataA && !dataB) return 0;
                if (!dataA) return 1;
                if (!dataB) return -1;
                return dataB - dataA;
            });
            dadosFiltradosRelatorio = filtrarPeriodoRelatorio(todosDados);
            const paginaAnterior = paginaAtual;
            preencherAnosHistorico();
            aplicarFiltroHistorico({ silencioso: true });
            const totalPags = Math.max(1, Math.ceil(dadosFiltradosHistorico.length / itensPorPagina));
            paginaAtual = Math.min(paginaAnterior, totalPags);
            renderizarPagina();
            atualizarRelatorios();
            gerarGraficosVendas(dadosFiltradosRelatorio);
            gerarGraficosDespesas(despesasFiltradasRelatorio);
            renderizarServicosMes();
            gerarGraficoServicos(todosDados);
            atualizarPainelLateral();
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        mostrarToast('Não foi possível carregar as vendas. Verifique a internet.', 'erro');
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
                <td colspan="9" style="text-align: center; padding: 3rem;">
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
        const infoTipo = extrairTipo(item.descricao);
        
        let badgeClass = '';
        if (item.pagamento === 'Pix') badgeClass = 'badge-pix';
        else if (item.pagamento === 'Cartão Crédito' || item.pagamento === 'Cartão Débito') badgeClass = 'badge-card';
        else if (item.pagamento === 'Dinheiro') badgeClass = 'badge-money';
        else badgeClass = 'badge-card';
        
        html += `
            <tr>
                <td style="font-size: 0.8rem;">${formatarDataVisual(item.data)}</td>
                <td><strong>${escapeHtml(infoTipo.texto)}</strong></td>
                <td><span class="${classeBadgeTipo(infoTipo.tipo)}">${infoTipo.tipo}</span></td>
                <td class="valor-bruto">${formatarMoeda(valorBruto)}</td>
                <td class="valor-desconto">${formatarMoeda(desconto)}</td>
                <td class="valor-liquido">${formatarMoeda(valorLiquido)}</td>
                <td><span class="${badgeClass}">${escapeHtml(item.pagamento)}</span></td>
                <td class="col-vendedor" title="${escapeHtml(item.vendedor)}">${escapeHtml(String(item.vendedor || '-').split('@')[0])}</td>
                <td class="text-center" style="white-space: nowrap;">
                    <button class="btn-action btn-action-edit" onclick="prepararEdicaoPorId('${escapeHtml(item.id)}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-action-delete" onclick="excluirItem('${escapeHtml(item.id)}')" title="Excluir">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }
    
    container.innerHTML = html;
}

function prepararEdicaoPorId(id) {
    const item = todosDados.find(v => String(v.id) === String(id));
    if (!item) {
        mostrarToast('Venda não encontrada. Atualize a página.', 'erro');
        return;
    }
    prepararEdicao(item.id, item.descricao, item.valor, item.pagamento, item.desconto || 0);
    preencherDataHoraVenda(parseDataInteligente(item.data) || new Date(), true);
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
    const infoTipo = extrairTipo(descricao);
    const tipoServicoInput = document.getElementById('tipoServicoInput');
    if (descInput) descInput.value = infoTipo.texto;
    tipoManual = true;
    if (tipoServicoInput) tipoServicoInput.value = TIPOS_SERVICO.includes(infoTipo.tipo) ? infoTipo.tipo : '';
    if (valorInput) valorInput.value = valor;
    if (pagInput) pagInput.value = pagamento;
    if (descontoInput) descontoInput.value = desconto;
    if (btnSalvar) btnSalvar.innerHTML = '<i class="fas fa-save"></i> Atualizar';
    if (btnCancelar) btnCancelar.style.display = 'block';
    calcularValorFinal();
    sincronizarChips();
    const card = document.querySelector('#novaVenda .card');
    if (card) card.classList.add('editando');
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
    if (valorInput) valorInput.value = '';
    if (descontoInput) descontoInput.value = '';
    if (btnSalvar) btnSalvar.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Venda';
    if (btnCancelar) btnCancelar.style.display = 'none';
    calcularValorFinal();
    sincronizarChips();
    const card = document.querySelector('#novaVenda .card');
    if (card) card.classList.remove('editando');
}

async function excluirItem(id) {
    if (!(await confirmarAcao("Tem certeza que deseja excluir esta venda? Essa ação não pode ser desfeita."))) return;
    
    const fd = new FormData();
    fd.append('action', 'excluir');
    fd.append('id', id);
    
    try {
        const response = await apiFetch(fd);
        const res = await response.json().catch(() => ({}));
        if (res.status && res.status !== 'sucesso') throw new Error(res.message);
        mostrarToast('Venda excluída com sucesso!', 'sucesso');
        carregarDados();
    } catch (error) {
        console.error('Erro ao excluir venda:', error);
        mostrarToast("Erro ao excluir!", 'erro');
    }
}

// ==================== FILTROS DO HISTÓRICO ====================
// Um único filtro que junta: período, busca, tipo de serviço e forma de pagamento
function aplicarFiltroHistorico(opcoes = {}) {
    const elIni = document.getElementById('dataInicial');
    const elFim = document.getElementById('dataFinal');
    const dataIni = elIni ? elIni.value : '';
    const dataFim = elFim ? elFim.value : '';
    const buscaInput = document.getElementById('buscaInput');
    const termo = normalizarTexto(buscaInput ? buscaInput.value.trim() : '');
    const tipo = (document.getElementById('filtroTipo') || {}).value || '';
    const pagamento = (document.getElementById('filtroPagamento') || {}).value || '';
    
    if (dataIni && dataFim && dataIni > dataFim) {
        if (!opcoes.silencioso) mostrarToast('A data inicial não pode ser maior que a data final!', 'aviso');
        return;
    }
    
    const dIni = dataIni ? new Date(dataIni + 'T00:00:00') : null;
    const dFim = dataFim ? new Date(dataFim + 'T23:59:59') : null;
    
    dadosFiltradosHistorico = todosDados.filter(item => {
        const info = extrairTipo(item.descricao);
        if (tipo && info.tipo !== tipo) return false;
        if (pagamento && (item.pagamento || 'Outros') !== pagamento) return false;
        if (dIni || dFim) {
            const d = parseDataInteligente(item.data);
            if (!d) return false;
            if (dIni && d < dIni) return false;
            if (dFim && d > dFim) return false;
        }
        if (termo) {
            // busca sem diferenciar maiúscula/acento, na descrição, tipo, pagamento e vendedor
            const alvo = normalizarTexto([info.texto, info.tipo, item.pagamento, item.vendedor].join(' '));
            if (!termo.split(/\s+/).every(p => alvo.includes(p))) return false;
        }
        return true;
    });
    
    atualizarRotuloFiltroHistorico(dataIni, dataFim, termo, tipo, pagamento);
    atualizarBotoesPeriodo();
    paginaAtual = 1;
    renderizarPagina();
}

function atualizarRotuloFiltroHistorico(dataIni, dataFim, termo, tipo, pagamento) {
    const filterDate = document.getElementById('filterDate');
    if (!filterDate) return;
    const partes = [];
    if (dataIni && dataFim) {
        partes.push(dataIni === dataFim ? formatarDataParaExibicao(dataIni)
            : `${formatarDataParaExibicao(dataIni)} até ${formatarDataParaExibicao(dataFim)}`);
    } else if (dataIni) {
        partes.push(`A partir de ${formatarDataParaExibicao(dataIni)}`);
    } else if (dataFim) {
        partes.push(`Até ${formatarDataParaExibicao(dataFim)}`);
    }
    if (tipo) partes.push(tipo);
    if (pagamento) partes.push(pagamento);
    if (termo) partes.push(`"${document.getElementById('buscaInput').value.trim()}"`);
    
    const total = dadosFiltradosHistorico.reduce((a, i) => a + (parseFloat(i.valor) || 0) - (parseFloat(i.desconto) || 0), 0);
    if (partes.length) {
        filterDate.textContent = `${partes.join(' · ')} — ${dadosFiltradosHistorico.length} venda(s) · ${formatarMoeda(total)}`;
        filterDate.classList.add('active-filter');
    } else {
        filterDate.textContent = 'Todos os registros';
        filterDate.classList.remove('active-filter');
    }
    filterDate.style.color = '';
}

function limparFiltroHistorico() {
    ['dataInicial', 'dataFinal', 'buscaInput', 'filtroTipo', 'filtroPagamento'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    aplicarFiltroHistorico();
}

// Busca enquanto digita (espera o usuário parar de digitar)
let timerBusca = null;
function filtrarPorBusca() {
    clearTimeout(timerBusca);
    timerBusca = setTimeout(() => aplicarFiltroHistorico({ silencioso: true }), 250);
}

// Atalhos de período
function definirPeriodoHistorico(periodo) {
    const hoje = new Date();
    let ini = null, fim = new Date(hoje);
    if (periodo === 'hoje') ini = new Date(hoje);
    else if (periodo === '7dias') { ini = new Date(hoje); ini.setDate(ini.getDate() - 6); }
    else if (periodo === 'mes') ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    else if (periodo === 'ano') {
        ini = new Date(hoje.getFullYear(), 0, 1);
        fim = new Date(hoje.getFullYear(), 11, 31);
    }
    else if (/^\d{4}$/.test(periodo)) {
        ini = new Date(+periodo, 0, 1);
        fim = new Date(+periodo, 11, 31);
    }
    else if (periodo === 'mesPassado') {
        ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    }
    document.getElementById('dataInicial').value = ini ? dataLocalISO(ini) : '';
    document.getElementById('dataFinal').value = ini ? dataLocalISO(fim) : '';
    aplicarFiltroHistorico();
}

function atualizarBotoesPeriodo() {
    const ini = (document.getElementById('dataInicial') || {}).value || '';
    const fim = (document.getElementById('dataFinal') || {}).value || '';
    const hoje = new Date();
    const mapa = {
        hoje: [dataLocalISO(hoje), dataLocalISO(hoje)],
        '7dias': [dataLocalISO(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 6)), dataLocalISO(hoje)],
        mes: [dataLocalISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), dataLocalISO(hoje)],
        mesPassado: [dataLocalISO(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)), dataLocalISO(new Date(hoje.getFullYear(), hoje.getMonth(), 0))],
        ano: [`${hoje.getFullYear()}-01-01`, `${hoje.getFullYear()}-12-31`]
    };
    // Seletor de ano: marca o ano quando o período é exatamente 01/01 a 31/12
    const selAno = document.getElementById('filtroAno');
    if (selAno) {
        const m = ini.match(/^(\d{4})-01-01$/);
        selAno.value = (m && fim === `${m[1]}-12-31`) ? m[1] : '';
        selAno.classList.toggle('active', !!selAno.value);
    }
    document.querySelectorAll('.periodo-btn').forEach(b => {
        const p = b.dataset.periodo;
        const ativo = p === 'tudo' ? (!ini && !fim) : (mapa[p] && mapa[p][0] === ini && mapa[p][1] === fim);
        b.classList.toggle('active', !!ativo);
    });
}

document.querySelectorAll('.periodo-btn').forEach(b => b.addEventListener('click', () => definirPeriodoHistorico(b.dataset.periodo)));

// Preenche o seletor de ano com os anos que têm vendas
function preencherAnosHistorico() {
    const sel = document.getElementById('filtroAno');
    if (!sel) return;
    const anos = new Set([new Date().getFullYear()]);
    for (const item of todosDados) {
        const d = parseDataInteligente(item.data);
        if (d) anos.add(d.getFullYear());
    }
    const atual = sel.value;
    sel.innerHTML = '<option value="">Ano...</option>' +
        [...anos].sort((a, b) => b - a).map(a => `<option value="${a}">${a} (ano inteiro)</option>`).join('');
    sel.value = atual;
}
const selFiltroAno = document.getElementById('filtroAno');
if (selFiltroAno) selFiltroAno.addEventListener('change', () => {
    if (selFiltroAno.value) definirPeriodoHistorico(selFiltroAno.value);
    else definirPeriodoHistorico('tudo');
});
['filtroTipo', 'filtroPagamento', 'dataInicial', 'dataFinal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => aplicarFiltroHistorico());
});

// ==================== DESPESAS ====================
async function carregarDespesas() {
    if (sessionStorage.getItem('loja_logado') !== 'true') return;
    const tabela = document.getElementById('tabelaDespesasContainer');
    if (tabela && todasDespesas.length === 0) tabela.innerHTML = linhaCarregando(7, 'Carregando despesas...');
    
    const fd = new FormData();
    fd.append('action', 'listarDespesas');
    
    try {
        const response = await apiFetch(fd);
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
            despesasFiltradasRelatorio = filtrarPeriodoRelatorio(todasDespesas);
            aplicarFiltroDespesa();
            atualizarNotificacoes();
            atualizarRelatorios();
            gerarGraficosDespesas(despesasFiltradasRelatorio);
        }
    } catch (error) {
        console.error('Erro ao carregar despesas:', error);
        mostrarToast('Não foi possível carregar as despesas.', 'erro');
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
                <td><span class="categoria-badge">${escapeHtml(item.categoria)}</span></td>
                <td><strong>${escapeHtml(item.descricao) || '-'}</strong></td>
                <td class="valor-despesa">${formatarMoeda(valor)}</td>
                <td>${escapeHtml(item.pagamento)}</td>
                <td><span class="${badgeStatusClass}">${escapeHtml(item.status)}</span></td>
                <td class="text-center" style="white-space: nowrap;">
                    <button class="btn-action btn-action-edit" onclick="editarDespesa('${escapeHtml(item.id)}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-action-delete" onclick="excluirDespesa('${escapeHtml(item.id)}')" title="Excluir">
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
        mostrarToast("Selecione uma categoria!", 'aviso');
        return;
    }
    if (!valor || parseFloat(valor) <= 0) {
        mostrarToast("Informe um valor válido!", 'aviso');
        return;
    }
    if (!data) {
        mostrarToast("Informe a data!", 'aviso');
        return;
    }
    if (!pagamento) {
        mostrarToast("Selecione a forma de pagamento!", 'aviso');
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
        const response = await apiFetch(fd);
        const res = await response.json();
        
        if (res.status === 'sucesso') {
            if (statusMsg) {
                statusMsg.textContent = res.message;
                statusMsg.className = 'status-message status-success';
            }
            cancelarEdicaoDespesa();
            despesaForm.reset();
            const dataDespesa = document.getElementById('dataDespesa');
            if (dataDespesa) dataDespesa.value = dataLocalISO();
            mostrarToast(isEdit ? 'Despesa atualizada!' : 'Despesa salva!', 'sucesso');
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
    const despesa = todasDespesas.find(d => String(d.id) === String(id));
    if (!despesa) {
        mostrarToast('Despesa não encontrada. Atualize a página.', 'erro');
        return;
    }
    
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
    if (dataDespesa) dataDespesa.value = dataLocalISO();
}

async function excluirDespesa(id) {
    if (!(await confirmarAcao("Tem certeza que deseja excluir esta despesa? Essa ação não pode ser desfeita."))) return;
    
    const fd = new FormData();
    fd.append('action', 'excluirDespesa');
    fd.append('id', id);
    
    try {
        const response = await apiFetch(fd);
        const res = await response.json().catch(() => ({}));
        if (res.status && res.status !== 'sucesso') throw new Error(res.message);
        mostrarToast('Despesa excluída com sucesso!', 'sucesso');
        await carregarDespesas();
        await carregarDados();
    } catch (error) {
        console.error('Erro ao excluir despesa:', error);
        mostrarToast("Erro ao excluir despesa!", 'erro');
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
const CORES_PAGAMENTO = {
    'Pix': '#2ec4b6',
    'Dinheiro': '#7c3aed',
    'Cartão Crédito': '#ff9f1c',
    'Cartão Débito': '#4361ee',
    'Outros': '#94a3b8'
};
const NOMES_CURTOS_PAG = { 'Cartão Crédito': 'Crédito', 'Cartão Débito': 'Débito' };
const corPagamento = (p) => CORES_PAGAMENTO[p] || '#94a3b8';
const nomeCurtoPag = (p) => NOMES_CURTOS_PAG[p] || p || 'Outros';

let estiloGraficosAplicado = false;
function aplicarEstiloGraficos() {
    if (estiloGraficosAplicado || typeof Chart === 'undefined') return;
    estiloGraficosAplicado = true;
    Chart.defaults.font.family = "'Inter', 'Segoe UI', system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#64748b';
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.boxHeight = 8;
    Chart.defaults.plugins.legend.labels.padding = 14;
    Object.assign(Chart.defaults.plugins.tooltip, {
        backgroundColor: '#1a1a2e',
        titleColor: '#fff',
        bodyColor: '#e2e8f0',
        padding: 12,
        cornerRadius: 10,
        displayColors: true,
        boxPadding: 4,
        titleFont: { weight: '700' }
    });
}

// Todos os meses do período (inclusive os sem movimento, com 0)
function mesesDoPeriodo(...objs) {
    let ini = null, fim = null;
    if (filtroRelatorioAtivo) {
        const a = document.getElementById('dataInicialRel').value;
        const b = document.getElementById('dataFinalRel').value;
        if (a && b) { ini = new Date(a + 'T00:00:00'); fim = new Date(b + 'T00:00:00'); }
    }
    if (!ini) {
        const chaves = [...new Set(objs.flatMap(o => Object.keys(o)))];
        if (!chaves.length) return [];
        const ord = ordenarMeses(Object.fromEntries(chaves.map(k => [k, 0])));
        const [m1, a1] = ord[0].split('/').map(Number);
        const [m2, a2] = ord[ord.length - 1].split('/').map(Number);
        ini = new Date(a1, m1 - 1, 1); fim = new Date(a2, m2 - 1, 1);
    }
    const meses = [];
    const d = new Date(ini.getFullYear(), ini.getMonth(), 1);
    const limite = new Date(fim.getFullYear(), fim.getMonth(), 1);
    while (d <= limite && meses.length < 240) {
        meses.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
        d.setMonth(d.getMonth() + 1);
    }
    return meses;
}

function rotulosMeses(meses) {
    const varios = new Set(meses.map(k => k.split('/')[1])).size > 1;
    return meses.map(k => {
        const [m, a] = k.split('/').map(Number);
        const nome = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        return varios ? `${nome}/${String(a).slice(2)}` : nome;
    });
}

function tituloMes(meses) {
    return (itens) => {
        const k = meses[itens[0].dataIndex];
        if (!k) return '';
        const [m, a] = k.split('/').map(Number);
        const t = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        return t.charAt(0).toUpperCase() + t.slice(1);
    };
}

// Valores curtos no eixo: R$ 15 mil, R$ 1,2 mil
function moedaCurta(v) {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 1000000) return 'R$ ' + (n / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
    if (Math.abs(n) >= 1000) return 'R$ ' + (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    return 'R$ ' + n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function gradienteVertical(ctx, cor, alturaPx = 260) {
    const g = ctx.createLinearGradient(0, 0, 0, alturaPx);
    g.addColorStop(0, cor + '55');
    g.addColorStop(1, cor + '00');
    return g;
}

const EIXO_X_MESES = {
    grid: { display: false },
    border: { display: false },
    ticks: { maxRotation: 0, autoSkip: false, font: { size: 11 } }
};
const EIXO_Y_MOEDA = {
    beginAtZero: true,
    suggestedMax: 10,
    grid: { color: '#eef0f5' },
    border: { display: false },
    ticks: { callback: moedaCurta, maxTicksLimit: 6 }
};

function opcoesRosca(formatarValor) {
    return {
        cutout: '68%',
        plugins: {
            legend: { display: true, position: 'bottom' },
            tooltip: {
                callbacks: {
                    label: (c) => {
                        const total = c.dataset.data.reduce((a, b) => a + b, 0) || 1;
                        return ` ${c.label}: ${formatarValor(c.parsed)} (${((c.parsed / total) * 100).toFixed(1)}%)`;
                    }
                }
            }
        }
    };
}

// Texto no centro da rosca
const pluginTextoCentro = {
    id: 'textoCentro',
    afterDraw(chart, args, opts) {
        if (!opts || !opts.valor) return;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data || !meta.data[0]) return;
        const { x, y } = meta.data[0];
        const ctx = chart.ctx;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1a1a2e';
        ctx.font = "800 20px Inter, 'Segoe UI', sans-serif";
        ctx.fillText(opts.valor, x, y - 8);
        ctx.fillStyle = '#64748b';
        ctx.font = "500 12px Inter, 'Segoe UI', sans-serif";
        ctx.fillText(opts.rotulo || '', x, y + 14);
        ctx.restore();
    }
};

// Esconde o cartão do gráfico quando não há nada para mostrar (tudo zerado)
function mostrarCartaoGrafico(canvasId, temDados) {
    const canvas = document.getElementById(canvasId);
    const card = canvas ? canvas.closest('.chart-card') : null;
    if (card) card.classList.toggle('hidden', !temDados);
}
const temValor = (lista) => lista.some(v => Math.abs(Number(v) || 0) > 0.0001);

function gerarGraficosVendas(dados) {
    if (typeof Chart === 'undefined') return;
    aplicarEstiloGraficos();
    
    const porMesLiquido = {};
    const porMesDesconto = {};
    const porPagamento = {};
    const porPagamentoValor = {};
    
    for (const item of dados) {
        const data = parseDataInteligente(item.data);
        const desconto = parseFloat(item.desconto) || 0;
        const valorLiquido = (parseFloat(item.valor) || 0) - desconto;
        if (data) {
            const mes = `${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
            porMesLiquido[mes] = (porMesLiquido[mes] || 0) + valorLiquido;
            porMesDesconto[mes] = (porMesDesconto[mes] || 0) + desconto;
        }
        const pag = item.pagamento || 'Outros';
        porPagamento[pag] = (porPagamento[pag] || 0) + 1;
        porPagamentoValor[pag] = (porPagamentoValor[pag] || 0) + valorLiquido;
    }
    
    const meses = mesesDoPeriodo(porMesLiquido);
    const rotulos = rotulosMeses(meses);
    
    mostrarCartaoGrafico('chartVendas', temValor(Object.values(porMesLiquido)));
    mostrarCartaoGrafico('chartPagamento', temValor(Object.values(porPagamento)));
    mostrarCartaoGrafico('chartPagamentoValor', temValor(Object.values(porPagamentoValor)));
    mostrarCartaoGrafico('chartDescontos', temValor(Object.values(porMesDesconto)));
    
    // Vendas líquidas por mês (linha)
    const chartVendas = document.getElementById('chartVendas');
    if (chartVendas) {
        if (graficoVendas) graficoVendas.destroy();
        const ctx = chartVendas.getContext('2d');
        graficoVendas = new Chart(ctx, {
            type: 'line',
            data: {
                labels: rotulos,
                datasets: [{
                    label: 'Vendas líquidas',
                    data: meses.map(k => porMesLiquido[k] || 0),
                    borderColor: '#4f46e5',
                    backgroundColor: gradienteVertical(ctx, '#4f46e5'),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35,
                    cubicInterpolationMode: 'monotone',
                    pointRadius: 3.5,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#4f46e5',
                    pointBorderWidth: 2
                }]
            },
            options: {
                interaction: { mode: 'index', intersect: false },
                plugins: { tooltip: { callbacks: { title: tituloMes(meses), label: (c) => ` ${formatarMoeda(c.parsed.y)}` } } },
                scales: { x: EIXO_X_MESES, y: EIXO_Y_MOEDA }
            }
        });
    }
    
    // Ordem das formas de pagamento: maior valor primeiro
    const pagamentos = Object.keys(porPagamentoValor).sort((a, b) => porPagamentoValor[b] - porPagamentoValor[a]);
    
    // Quantidade por forma de pagamento (rosca)
    const chartPagamento = document.getElementById('chartPagamento');
    if (chartPagamento) {
        if (graficoPagamento) graficoPagamento.destroy();
        const totalQtd = pagamentos.reduce((a, p) => a + porPagamento[p], 0);
        graficoPagamento = new Chart(chartPagamento.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: pagamentos.map(nomeCurtoPag),
                datasets: [{
                    data: pagamentos.map(p => porPagamento[p]),
                    backgroundColor: pagamentos.map(corPagamento),
                    borderWidth: 3,
                    borderColor: '#fff',
                    hoverOffset: 6
                }]
            },
            options: (() => {
                const o = opcoesRosca(v => `${v} venda(s)`);
                o.plugins.textoCentro = { valor: String(totalQtd), rotulo: 'vendas' };
                return o;
            })(),
            plugins: [pluginTextoCentro]
        });
    }
    
    // Valor por forma de pagamento (barras horizontais)
    const chartPagamentoValor = document.getElementById('chartPagamentoValor');
    if (chartPagamentoValor) {
        if (graficoPagamentoValor) graficoPagamentoValor.destroy();
        graficoPagamentoValor = new Chart(chartPagamentoValor.getContext('2d'), {
            type: 'bar',
            data: {
                labels: pagamentos.map(nomeCurtoPag),
                datasets: [{
                    label: 'Valor líquido',
                    data: pagamentos.map(p => porPagamentoValor[p]),
                    backgroundColor: pagamentos.map(corPagamento),
                    borderRadius: 8,
                    borderSkipped: false,
                    barThickness: 22
                }]
            },
            options: {
                indexAxis: 'y',
                plugins: { tooltip: { callbacks: { label: (c) => ` ${formatarMoeda(c.parsed.x)}` } } },
                scales: {
                    x: { ...EIXO_Y_MOEDA, ticks: { callback: moedaCurta, maxTicksLimit: 4, maxRotation: 0 } },
                    y: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: '600' }, color: '#334155' } }
                }
            }
        });
    }
    
    // Vendas por dia da semana
    gerarGraficoDiaSemana(dados);
    
    // Descontos por mês (barras)
    const chartDescontos = document.getElementById('chartDescontos');
    if (chartDescontos) {
        if (graficoDescontos) graficoDescontos.destroy();
        graficoDescontos = new Chart(chartDescontos.getContext('2d'), {
            type: 'bar',
            data: {
                labels: rotulos,
                datasets: [{
                    label: 'Descontos',
                    data: meses.map(k => porMesDesconto[k] || 0),
                    backgroundColor: '#f87171',
                    hoverBackgroundColor: '#e63946',
                    borderRadius: 6,
                    maxBarThickness: 26
                }]
            },
            options: {
                plugins: { tooltip: { callbacks: { title: tituloMes(meses), label: (c) => ` ${formatarMoeda(c.parsed.y)}` } } },
                scales: { x: EIXO_X_MESES, y: EIXO_Y_MOEDA }
            }
        });
    }
}

// Quais dias da semana vendem mais (no período do filtro)
function gerarGraficoDiaSemana(dados) {
    const canvas = document.getElementById('chartDiaSemana');
    if (!canvas || typeof Chart === 'undefined') return;
    // ordem: Segunda ... Domingo
    const ordem = [1, 2, 3, 4, 5, 6, 0];
    const nomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const curtos = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const valor = new Array(7).fill(0);
    const qtd = new Array(7).fill(0);
    const diasDistintos = Array.from({ length: 7 }, () => new Set());
    
    for (const item of dados) {
        const d = parseDataInteligente(item.data);
        if (!d) continue;
        const w = d.getDay();
        valor[w] += (parseFloat(item.valor) || 0) - (parseFloat(item.desconto) || 0);
        qtd[w]++;
        diasDistintos[w].add(d.toDateString());
    }
    
    const valores = ordem.map(w => valor[w]);
    mostrarCartaoGrafico('chartDiaSemana', temValor(valores));
    const maior = Math.max(...valores);
    const melhorW = ordem[valores.indexOf(maior)];
    const cores = ordem.map(w => (maior > 0 && valor[w] === maior) ? '#7c3aed' : 'rgba(124, 58, 237, 0.35)');
    
    if (graficoDiaSemana) graficoDiaSemana.destroy();
    graficoDiaSemana = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ordem.map(w => curtos[w]),
            datasets: [{
                label: 'Vendas',
                data: valores,
                backgroundColor: cores,
                hoverBackgroundColor: '#6d28d9',
                borderRadius: 8,
                maxBarThickness: 38
            }]
        },
        options: {
            plugins: {
                tooltip: {
                    callbacks: {
                        title: (itens) => nomes[ordem[itens[0].dataIndex]],
                        label: (c) => {
                            const w = ordem[c.dataIndex];
                            const media = diasDistintos[w].size ? valor[w] / diasDistintos[w].size : 0;
                            return [
                                ` Total: ${formatarMoeda(valor[w])} (${qtd[w]} venda${qtd[w] === 1 ? '' : 's'})`,
                                ` Média por ${nomes[w].toLowerCase()}: ${formatarMoeda(media)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: '600' }, color: '#334155' } },
                y: { beginAtZero: true, suggestedMax: 10, grid: { color: '#eef0f5' }, border: { display: false }, ticks: { callback: moedaCurta, maxTicksLimit: 6 } }
            }
        }
    });
    
    const info = document.getElementById('semanaInfo');
    if (info) {
        if (maior > 0) {
            const ranking = ordem.slice().sort((a, b) => valor[b] - valor[a]);
            const pior = ranking.filter(w => valor[w] > 0).pop();
            const total = valor.reduce((a, b) => a + b, 0) || 1;
            info.innerHTML = `
                <span><i class="fas fa-trophy"></i> Mais vende: <strong>${nomes[melhorW]}</strong> · ${((maior / total) * 100).toFixed(0)}% do total</span>
                ${pior !== undefined && pior !== melhorW ? `<span>Menos vende: <strong>${nomes[pior]}</strong></span>` : ''}`;
        } else {
            info.innerHTML = '<span>Sem vendas no período</span>';
        }
    }
}

function gerarGraficosDespesas(despesas) {
    if (typeof Chart === 'undefined') return;
    aplicarEstiloGraficos();
    
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
        if (!data) continue;
        if (data.getMonth() === mesAtual && data.getFullYear() === anoAtual) totalDespesas += valor;
        const mes = `${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
        despesasPorMes[mes] = (despesasPorMes[mes] || 0) + valor;
    }
    
    mostrarCartaoGrafico('chartDespesasLucro', temValor([totalVendas, totalDespesas]));
    mostrarCartaoGrafico('chartDespesasMes', temValor(Object.values(despesasPorMes)));
    
    // Despesas x Lucro do mês (rosca)
    const chartDespesasLucro = document.getElementById('chartDespesasLucro');
    if (chartDespesasLucro) {
        if (graficoDespesasLucro) graficoDespesasLucro.destroy();
        const lucro = totalVendas - totalDespesas;
        graficoDespesasLucro = new Chart(chartDespesasLucro.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Lucro', 'Despesas'],
                datasets: [{
                    data: [Math.max(lucro, 0), totalDespesas],
                    backgroundColor: ['#22c55e', '#f43f5e'],
                    borderWidth: 3,
                    borderColor: '#fff',
                    hoverOffset: 6
                }]
            },
            options: (() => {
                const o = opcoesRosca(formatarMoeda);
                o.plugins.textoCentro = { valor: moedaCurta(totalVendas), rotulo: 'vendas no mês' };
                return o;
            })(),
            plugins: [pluginTextoCentro]
        });
    }
    
    // Despesas por mês (barras)
    const chartDespesasMes = document.getElementById('chartDespesasMes');
    if (chartDespesasMes) {
        if (graficoDespesasMes) graficoDespesasMes.destroy();
        const meses = mesesDoPeriodo(despesasPorMes);
        const ctx = chartDespesasMes.getContext('2d');
        graficoDespesasMes = new Chart(ctx, {
            type: 'line',
            data: {
                labels: rotulosMeses(meses),
                datasets: [{
                    label: 'Despesas',
                    data: meses.map(k => despesasPorMes[k] || 0),
                    borderColor: '#f43f5e',
                    backgroundColor: gradienteVertical(ctx, '#f43f5e'),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35,
                    cubicInterpolationMode: 'monotone',
                    pointRadius: 3.5,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#f43f5e',
                    pointBorderWidth: 2
                }]
            },
            options: {
                interaction: { mode: 'index', intersect: false },
                plugins: { tooltip: { callbacks: { title: tituloMes(meses), label: (c) => ` ${formatarMoeda(c.parsed.y)}` } } },
                scales: { x: EIXO_X_MESES, y: EIXO_Y_MOEDA }
            }
        });
    }
}

function filtrarRelatorio() {
    const dataIni = document.getElementById('dataInicialRel').value;
    const dataFim = document.getElementById('dataFinalRel').value;
    
    if (!dataIni || !dataFim) {
        mostrarToast("Selecione o período!", 'aviso');
        return;
    }
    
    const dIni = new Date(dataIni + 'T00:00:00');
    const dFim = new Date(dataFim + 'T23:59:59');
    
    if (dIni > dFim) {
        mostrarToast("A data inicial não pode ser maior que a final!", 'aviso');
        return;
    }
    
    filtroRelatorioAtivo = true;
    dadosFiltradosRelatorio = filtrarPeriodoRelatorio(todosDados);
    despesasFiltradasRelatorio = filtrarPeriodoRelatorio(todasDespesas);
    
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
    filtroRelatorioAtivo = false;
    dadosFiltradosRelatorio = [...todosDados];
    despesasFiltradasRelatorio = [...todasDespesas];
    
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    const dataInicialRel = document.getElementById('dataInicialRel');
    const dataFinalRel = document.getElementById('dataFinalRel');
    
    if (dataInicialRel) dataInicialRel.value = dataLocalISO(primeiroDia);
    if (dataFinalRel) dataFinalRel.value = dataLocalISO(ultimoDia);
    
    atualizarRelatorios();
    gerarGraficosVendas(dadosFiltradosRelatorio);
    gerarGraficosDespesas(despesasFiltradasRelatorio);
    
    const reportDate = document.getElementById('reportDate');
    if (reportDate) {
        reportDate.textContent = 'Período atual';
        reportDate.classList.remove('active-filter');
    }
}

// ==================== SERVIÇOS EXECUTADOS ====================
function renderizarServicosMes() {
    const kpis = document.getElementById('servicosKpis');
    const ranking = document.getElementById('servicosRanking');
    const mesInput = document.getElementById('mesServicos');
    if (!kpis || !ranking) return;
    
    const hoje = new Date();
    const valorMes = (mesInput && mesInput.value) ? mesInput.value
        : `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const [ano, mes] = valorMes.split('-').map(Number);
    
    const resumo = {};
    [...TIPOS_SERVICO, TIPO_SEM_CLASSIFICACAO].forEach(t => {
        resumo[t] = { qtd: 0, valor: 0, itens: {} };
    });
    
    let totalQtd = 0;
    for (const item of todosDados) {
        const data = parseDataInteligente(item.data);
        if (!data || data.getFullYear() !== ano || (data.getMonth() + 1) !== mes) continue;
        
        const info = extrairTipo(item.descricao);
        const liquido = (parseFloat(item.valor) || 0) - (parseFloat(item.desconto) || 0);
        const r = resumo[info.tipo];
        r.qtd++;
        r.valor += liquido;
        totalQtd++;
        
        const nome = (info.texto || '-').trim();
        const chave = nome.toLowerCase();
        if (!r.itens[chave]) r.itens[chave] = { nome: nome, qtd: 0, valor: 0 };
        r.itens[chave].qtd++;
        r.itens[chave].valor += liquido;
    }
    
    const icones = {
        'Roupas': 'fa-tshirt',
        'Serviços de Salão': 'fa-cut',
        'Não classificado': 'fa-question-circle'
    };
    
    const tiposExibir = [...TIPOS_SERVICO];
    if (resumo[TIPO_SEM_CLASSIFICACAO].qtd > 0) tiposExibir.push(TIPO_SEM_CLASSIFICACAO);
    
    const totalEl = document.getElementById('servicosTotal');
    if (totalEl) {
        const nomeMes = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const valorTotal = Object.values(resumo).reduce((a, r) => a + r.valor, 0);
        totalEl.innerHTML = `
            <div><span>Total de serviços em ${nomeMes}</span><strong>${totalQtd}</strong></div>
            <div><span>Valor total</span><strong>${formatarMoeda(valorTotal)}</strong></div>`;
    }
    
    const maisExecutado = TIPOS_SERVICO.reduce((a, b) => resumo[b].qtd > resumo[a].qtd ? b : a, TIPOS_SERVICO[0]);
    
    kpis.innerHTML = tiposExibir.map(tipo => {
        const r = resumo[tipo];
        const pct = totalQtd ? ((r.qtd / totalQtd) * 100).toFixed(1) : '0.0';
        const destaque = (tipo === maisExecutado && r.qtd > 0) ? '<span class="servico-destaque"><i class="fas fa-trophy"></i> Mais executado</span>' : '';
        return `
            <div class="servico-kpi" style="--cor-tipo: ${CORES_TIPO[tipo]}">
                <div class="servico-kpi-icone"><i class="fas ${icones[tipo]}"></i></div>
                <div class="servico-kpi-info">
                    <h4>${tipo} ${destaque}</h4>
                    <p>${r.qtd} <small>execução(ões)</small></p>
                    <span>${formatarMoeda(r.valor)} · ${pct}% do total</span>
                </div>
            </div>
        `;
    }).join('');
    
    ranking.innerHTML = tiposExibir.map(tipo => {
        const lista = Object.values(resumo[tipo].itens).sort((a, b) => b.qtd - a.qtd || b.valor - a.valor);
        const linhas = lista.length
            ? lista.slice(0, 10).map((it, i) => `
                <tr>
                    <td>${i + 1}º</td>
                    <td>${escapeHtml(it.nome)}</td>
                    <td class="text-center"><strong>${it.qtd}</strong></td>
                    <td>${formatarMoeda(it.valor)}</td>
                </tr>`).join('')
            : '<tr><td colspan="4" class="servicos-vazio">Nenhum lançamento neste mês</td></tr>';
        return `
            <div class="servico-ranking" style="--cor-tipo: ${CORES_TIPO[tipo]}">
                <h4><i class="fas ${icones[tipo]}"></i> Top ${tipo}</h4>
                <table>
                    <thead><tr><th>#</th><th>Item</th><th class="text-center">Qtd</th><th>Valor</th></tr></thead>
                    <tbody>${linhas}</tbody>
                </table>
            </div>
        `;
    }).join('');
}

function gerarGraficoServicos(dados) {
    if (typeof Chart === 'undefined') return;
    aplicarEstiloGraficos();
    const canvas = document.getElementById('chartServicos');
    if (!canvas) return;
    
    const porMes = {};
    let temNaoClassificado = false;
    for (const item of dados) {
        const data = parseDataInteligente(item.data);
        if (!data) continue;
        const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        const tipo = extrairTipo(item.descricao).tipo;
        if (tipo === TIPO_SEM_CLASSIFICACAO) temNaoClassificado = true;
        if (!porMes[chave]) porMes[chave] = {};
        porMes[chave][tipo] = (porMes[chave][tipo] || 0) + 1;
    }
    
    const chaves = Object.keys(porMes).sort();
    const labels = chaves.map(k => { const [a, m] = k.split('-'); return `${m}/${a}`; });
    const tipos = temNaoClassificado ? [...TIPOS_SERVICO, TIPO_SEM_CLASSIFICACAO] : [...TIPOS_SERVICO];
    
    if (graficoServicos) graficoServicos.destroy();
    graficoServicos = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: tipos.map(tipo => ({
                label: tipo,
                data: chaves.map(k => porMes[k][tipo] || 0),
                backgroundColor: CORES_TIPO[tipo],
                borderRadius: 6,
                maxBarThickness: 28
            }))
        },
        options: {
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: true, position: 'bottom' } },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0 } },
                y: { beginAtZero: true, grid: { color: '#eef0f5' }, border: { display: false }, ticks: { precision: 0 } }
            }
        }
    });
}

const mesServicosInput = document.getElementById('mesServicos');
if (mesServicosInput) mesServicosInput.addEventListener('change', renderizarServicosMes);

// ==================== EXPORTAÇÃO ====================
function exportarExcel() {
    // exporta TODAS as vendas do filtro atual (antes saía só a página da tela)
    const dadosPagina = [...dadosFiltradosHistorico];
    
    if (dadosPagina.length === 0) {
        mostrarToast("Não há dados para exportar!", 'aviso');
        return;
    }
    
    const dadosFormatados = dadosPagina.map(item => ({
        "Data": formatarDataVisual(item.data),
        "Descrição": extrairTipo(item.descricao).texto,
        "Tipo de Serviço": extrairTipo(item.descricao).tipo,
        "Valor Bruto": parseFloat(item.valor) || 0,
        "Desconto": parseFloat(item.desconto) || 0,
        "Valor Líquido": (parseFloat(item.valor) || 0) - (parseFloat(item.desconto) || 0),
        "Pagamento": item.pagamento,
        "Vendedor": item.vendedor || ''
    }));
    
    if (typeof XLSX === 'undefined') {
        mostrarToast('Não foi possível carregar o gerador de Excel. Verifique a internet.', 'erro');
        return;
    }
    
    const ws = XLSX.utils.json_to_sheet(dadosFormatados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendas");
    
    const hoje = dataLocalISO();
    XLSX.writeFile(wb, `Vendas_${hoje}.xlsx`);
}

async function exportarPDF() {
    // exporta TODAS as vendas do filtro atual (antes saía só a página da tela)
    const dadosPagina = [...dadosFiltradosHistorico];
    
    if (dadosPagina.length === 0) {
        mostrarToast("Não há dados para exportar!", 'aviso');
        return;
    }
    
    if (!(await garantirJsPDF())) return;
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    
    const dadosPdf = dadosPagina.map(item => {
        const valorBruto = parseFloat(item.valor) || 0;
        const desconto = parseFloat(item.desconto) || 0;
        const valorLiquido = valorBruto - desconto;
        
        return [
            formatarDataParaRelatorio(item.data),
            extrairTipo(item.descricao).texto,
            extrairTipo(item.descricao).tipo,
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
        '',
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
    doc.text(`Filtro: ${(document.getElementById('filterDate') || {}).textContent || 'Todos os registros'}`, 14, 32);
    doc.text(`Total de registros: ${dadosFiltradosHistorico.length}`, 14, 39);
    
    doc.autoTable({
        head: [['Data', 'Descrição', 'Tipo', 'Valor Bruto', 'Desconto', 'Valor Líquido', 'Pagamento', 'Vendedor']],
        body: dadosPdf,
        startY: 45,
        theme: 'striped',
        headStyles: { fillColor: [26, 26, 46], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 28 },
            1: { cellWidth: 60 },
            2: { cellWidth: 32 },
            3: { cellWidth: 25 },
            4: { cellWidth: 25 },
            5: { cellWidth: 25 },
            6: { cellWidth: 28 },
            7: { cellWidth: 45 }
        }
    });
    
    const hoje = dataLocalISO();
    doc.save(`Relatorio_Vendas_${hoje}.pdf`);
}

async function exportarDespesasPDF() {
    if (despesasFiltradas.length === 0) {
        mostrarToast("Não há despesas para exportar!", 'aviso');
        return;
    }
    
    if (!(await garantirJsPDF())) return;
    
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
    
    const hoje = dataLocalISO();
    doc.save(`Relatorio_Despesas_${hoje}.pdf`);
}

function exportarDespesasExcel() {
    if (despesasFiltradas.length === 0) {
        mostrarToast("Não há despesas para exportar!", 'aviso');
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
    
    if (typeof XLSX === 'undefined') {
        mostrarToast('Não foi possível carregar o gerador de Excel. Verifique a internet.', 'erro');
        return;
    }
    
    const ws = XLSX.utils.json_to_sheet(dadosFormatados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Despesas");
    
    const hoje = dataLocalISO();
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

if (btnFiltrar) btnFiltrar.addEventListener('click', () => aplicarFiltroHistorico());
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
    buscaInput.addEventListener('input', filtrarPorBusca);
    buscaInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { clearTimeout(timerBusca); aplicarFiltroHistorico(); }
    });
}

// ==================== PAINEL LATERAL (Resumo do Dia / Desempenho) ====================
function atualizarPainelLateral() {
    const agora = new Date();
    const hojeStr = agora.toDateString();
    let valorHoje = 0, qtdHoje = 0, descHoje = 0;
    let totalMes = 0, totalMesAnteriorMesmoPeriodo = 0;
    const diasNoMes = agora.getDate();
    const porDia = new Array(diasNoMes).fill(0);
    const qtdPorDia = new Array(diasNoMes).fill(0);
    const anteriorAno = agora.getMonth() === 0 ? agora.getFullYear() - 1 : agora.getFullYear();
    const anteriorMes = agora.getMonth() === 0 ? 11 : agora.getMonth() - 1;
    
    for (const item of todosDados) {
        const d = parseDataInteligente(item.data);
        if (!d) continue;
        const desconto = parseFloat(item.desconto) || 0;
        const liquido = (parseFloat(item.valor) || 0) - desconto;
        if (d.toDateString() === hojeStr) {
            valorHoje += liquido; qtdHoje++; descHoje += desconto;
        }
        if (d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth() && d.getDate() <= diasNoMes) {
            totalMes += liquido;
            porDia[d.getDate() - 1] += liquido;
            qtdPorDia[d.getDate() - 1]++;
        }
        if (d.getFullYear() === anteriorAno && d.getMonth() === anteriorMes && d.getDate() <= diasNoMes) {
            totalMesAnteriorMesmoPeriodo += liquido;
        }
    }
    
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set('resumoHojeValor', formatarMoeda(valorHoje));
    set('resumoHojeQtd', String(qtdHoje));
    set('resumoHojeDesc', formatarMoeda(descHoje));
    set('resumoHojeTicket', formatarMoeda(qtdHoje ? valorHoje / qtdHoje : 0));
    set('desempenhoMes', formatarMoeda(totalMes));
    
    const varEl = document.getElementById('desempenhoVar');
    if (varEl) {
        let pct = 0;
        if (totalMesAnteriorMesmoPeriodo > 0) pct = ((totalMes - totalMesAnteriorMesmoPeriodo) / totalMesAnteriorMesmoPeriodo) * 100;
        else if (totalMes > 0) pct = 100;
        const caiu = pct < 0;
        varEl.className = 'desempenho-var' + (caiu ? ' negativo' : '');
        varEl.innerHTML = `<i class="fas fa-arrow-${caiu ? 'down' : 'up'}"></i> ${Math.abs(pct).toFixed(0)}%`;
    }
    
    // Vendas por dia (barras) + acumulado do mês (linha)
    const canvas = document.getElementById('chartDesempenho');
    if (!canvas || typeof Chart === 'undefined') return;
    if (typeof aplicarEstiloGraficos === 'function') aplicarEstiloGraficos();
    let acumulado = 0;
    const serie = porDia.map(v => (acumulado += v));
    const mesStr = String(agora.getMonth() + 1).padStart(2, '0');
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, 'rgba(124, 58, 237, 0.22)');
    grad.addColorStop(1, 'rgba(124, 58, 237, 0)');
    if (graficoDesempenho) graficoDesempenho.destroy();
    graficoDesempenho = new Chart(ctx, {
        data: {
            labels: porDia.map((_, i) => String(i + 1)),
            datasets: [
                {
                    type: 'bar',
                    label: 'Vendas do dia',
                    data: porDia,
                    yAxisID: 'y',
                    backgroundColor: porDia.map((_, i) => i === diasNoMes - 1 ? '#7c3aed' : 'rgba(124, 58, 237, 0.35)'),
                    hoverBackgroundColor: '#7c3aed',
                    borderRadius: 4,
                    maxBarThickness: 14,
                    order: 2
                },
                {
                    type: 'line',
                    label: 'Acumulado no mês',
                    data: serie,
                    yAxisID: 'y1',
                    borderColor: '#6d28d9',
                    backgroundColor: grad,
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    cubicInterpolationMode: 'monotone',
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    itemSort: (a, b) => a.datasetIndex - b.datasetIndex,
                    callbacks: {
                        title: (itens) => `Dia ${String(itens[0].dataIndex + 1).padStart(2, '0')}/${mesStr}`,
                        label: (c) => c.datasetIndex === 0
                            ? ` Vendas do dia: ${formatarMoeda(c.parsed.y)} (${qtdPorDia[c.dataIndex]} venda${qtdPorDia[c.dataIndex] === 1 ? '' : 's'})`
                            : ` Acumulado: ${formatarMoeda(c.parsed.y)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 4 }
                },
                y: { display: false, beginAtZero: true },
                y1: { display: false, beginAtZero: true, position: 'right' }
            }
        }
    });
    
    const melhor = porDia.reduce((m, v, i) => v > porDia[m] ? i : m, 0);
    const media = diasNoMes ? totalMes / diasNoMes : 0;
    const info = document.getElementById('desempenhoInfo');
    if (info) {
        info.innerHTML = porDia[melhor] > 0
            ? `<span><i class="fas fa-trophy"></i> Melhor dia: <strong>${String(melhor + 1).padStart(2, '0')}/${mesStr}</strong> · ${formatarMoeda(porDia[melhor])}</span>
               <span>Média por dia: <strong>${formatarMoeda(media)}</strong></span>`
            : '<span>Sem vendas neste mês ainda</span>';
    }
}

// ==================== NOTIFICAÇÕES (despesas pendentes/atrasadas) ====================
function atualizarNotificacoes() {
    const lista = document.getElementById('notifLista');
    const ponto = document.getElementById('sinoPonto');
    const pendentes = todasDespesas.filter(d => d.status === 'Pendente' || d.status === 'Atrasado');
    if (ponto) ponto.classList.toggle('hidden', pendentes.length === 0);
    if (!lista) return;
    if (pendentes.length === 0) {
        lista.innerHTML = '<p class="notif-vazio"><i class="fas fa-circle-check"></i> Nenhuma despesa pendente</p>';
        return;
    }
    lista.innerHTML = pendentes.slice(0, 8).map(d => `
        <button type="button" class="notif-item" onclick="fecharDropdowns(); editarDespesa('${escapeHtml(d.id)}')">
            <span class="${d.status === 'Atrasado' ? 'badge-atrasado' : 'badge-pendente'}">${escapeHtml(d.status)}</span>
            <span class="notif-texto">${escapeHtml(d.descricao || d.categoria)}<small>${formatarDataDespesa(d.data)}</small></span>
            <strong>${formatarMoeda(parseFloat(d.valor) || 0)}</strong>
        </button>`).join('') + (pendentes.length > 8 ? `<p class="notif-vazio">+ ${pendentes.length - 8} outras</p>` : '');
}

// ==================== BARRA SUPERIOR ====================
function fecharDropdowns() {
    document.querySelectorAll('.topbar-dropdown').forEach(el => el.classList.add('hidden'));
}

function alternarDropdown(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const estavaAberto = !el.classList.contains('hidden');
    fecharDropdowns();
    if (!estavaAberto) el.classList.remove('hidden');
}

const btnNotificacoes = document.getElementById('btnNotificacoes');
if (btnNotificacoes) btnNotificacoes.addEventListener('click', (e) => { e.stopPropagation(); alternarDropdown('notifDropdown'); });
const userChip = document.getElementById('userChip');
if (userChip) userChip.addEventListener('click', (e) => { e.stopPropagation(); alternarDropdown('userDropdown'); });
document.querySelectorAll('.topbar-dropdown').forEach(el => el.addEventListener('click', e => e.stopPropagation()));
document.addEventListener('click', fecharDropdowns);

const btnSairMenu = document.getElementById('btnSairMenu');
if (btnSairMenu) btnSairMenu.addEventListener('click', sair);

const buscaGlobal = document.getElementById('buscaGlobal');
if (buscaGlobal) {
    buscaGlobal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const termo = buscaGlobal.value.trim();
            showSection('lancamentos');
            const buscaInput = document.getElementById('buscaInput');
            if (buscaInput) buscaInput.value = termo;
            filtrarPorBusca();
            buscaGlobal.blur();
        } else if (e.key === 'Escape') {
            buscaGlobal.value = '';
            buscaGlobal.blur();
        }
    });
}
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (buscaGlobal) { buscaGlobal.focus(); buscaGlobal.select(); }
    }
    if (e.key === 'Escape') fecharDropdowns();
});

// Enquanto digita a descrição, já marca Roupas ou Serviços de Salão
function atualizarTipoDetectado() {
    if (tipoManual) return;
    const desc = document.getElementById('descInput');
    const select = document.getElementById('tipoServicoInput');
    if (!desc || !select) return;
    const texto = desc.value.trim();
    select.value = texto ? classificarTipo(texto) : '';
    sincronizarChips();
}
const descInputTipo = document.getElementById('descInput');
if (descInputTipo) descInputTipo.addEventListener('input', atualizarTipoDetectado);

// ==================== DATA E HORA DA VENDA ====================
// Fica no horário atual (atualiza sozinho) até o usuário mudar
let dataVendaManual = false;

function preencherDataHoraVenda(d, manual) {
    const dataEl = document.getElementById('dataVendaInput');
    const horaEl = document.getElementById('horaVendaInput');
    if (!dataEl || !horaEl) return;
    dataEl.value = dataLocalISO(d);
    horaEl.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    dataVendaManual = !!manual;
    atualizarDicaDataVenda();
}

function atualizarDicaDataVenda() {
    const dica = document.getElementById('dataVendaDica');
    const btn = document.getElementById('btnAgora');
    if (btn) btn.classList.toggle('visivel', dataVendaManual);
    if (!dica) return;
    dica.textContent = dataVendaManual
        ? 'Data/hora alterada manualmente. Clique em "Agora" para voltar ao horário atual.'
        : 'Preenchido automaticamente com a data e hora atual — altere se a venda foi em outro momento.';
    dica.classList.toggle('dica-alterada', dataVendaManual);
}

// Texto enviado para a planilha: dd/mm/aaaa hh:mm:ss
function dataHoraVendaTexto() {
    const dataEl = document.getElementById('dataVendaInput');
    const horaEl = document.getElementById('horaVendaInput');
    if (!dataEl || !horaEl || !dataEl.value || !horaEl.value) return '';
    const [a, m, d] = dataEl.value.split('-');
    const hora = horaEl.value.length === 5 ? horaEl.value + ':00' : horaEl.value;
    return `${d}/${m}/${a} ${hora}`;
}

['dataVendaInput', 'horaVendaInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { dataVendaManual = true; atualizarDicaDataVenda(); });
});
const btnAgora = document.getElementById('btnAgora');
if (btnAgora) btnAgora.addEventListener('click', () => preencherDataHoraVenda(new Date(), false));
preencherDataHoraVenda(new Date(), false);
setInterval(() => { if (!dataVendaManual) preencherDataHoraVenda(new Date(), false); }, 20000);

function atualizarAvatar(email) {
    const avatar = document.getElementById('userAvatar');
    if (avatar && email) avatar.textContent = email.trim().charAt(0).toUpperCase();
}

// Valor e desconto: seleciona o "0" ao clicar, para digitar direto
['valorInput', 'descontoInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('focus', () => el.select());
});

const vendaFormReset = document.getElementById('vendaForm');
if (vendaFormReset) vendaFormReset.addEventListener('reset', () => { tipoManual = false; setTimeout(() => { sincronizarChips(); preencherDataHoraVenda(new Date(), false); }, 0); });

// ==================== INICIALIZAÇÃO ====================
window.onload = () => {
    // Mantém o login ao atualizar a página (sessão termina ao fechar a aba ou clicar em Sair)
    const logado = sessionStorage.getItem('loja_logado') === 'true';
    const emailSalvo = sessionStorage.getItem('user_email') || '';
    
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.classList.toggle('hidden', logado);
    
    const userInfo = document.getElementById('userInfo');
    if (userInfo) userInfo.classList.toggle('active', logado);
    
    if (logado) {
        const userEmail = document.getElementById('userEmail');
        if (userEmail) userEmail.textContent = emailSalvo;
        atualizarAvatar(emailSalvo);
        setTimeout(() => { carregarDados(); carregarDespesas(); }, 0);
    }
    
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    const dataInicialRel = document.getElementById('dataInicialRel');
    const dataFinalRel = document.getElementById('dataFinalRel');
    const dataDespesa = document.getElementById('dataDespesa');
    const dataInicial = document.getElementById('dataInicial');
    const dataFinal = document.getElementById('dataFinal');
    
    if (dataInicialRel) dataInicialRel.value = dataLocalISO(primeiroDia);
    if (dataFinalRel) dataFinalRel.value = dataLocalISO(ultimoDia);
    if (dataDespesa) dataDespesa.value = dataLocalISO(hoje);
    
    const mesServicos = document.getElementById('mesServicos');
    if (mesServicos) mesServicos.value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    
    if (dataInicial) dataInicial.value = '';
    if (dataFinal) dataFinal.value = '';
    
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
        if (loginEmail && !logado) loginEmail.focus();
    }, 500);
};

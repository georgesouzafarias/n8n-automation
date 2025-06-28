// Gerador de Relatório HTML para Tickets GLPI
// Processa user_tickets_report.json e gera HTML para envio por email

let inputData;
let operadorInfo = null;
let isLocalEnvironment = false;

// ============================================================================
// CONFIGURAÇÕES E CONSTANTES
// ============================================================================

const CONFIG = {
	colors: {
		status: {
			Novo: { color: '#007bff', bg: '#e3f2fd' },
			'Em andamento': { color: '#ffc107', bg: '#fff8e1' },
			Planejado: { color: '#6f42c1', bg: '#f3e5f5' },
			Pendente: { color: '#fd7e14', bg: '#fff3e0' },
			Resolvido: { color: '#28a745', bg: '#e8f5e9' },
			Fechado: { color: '#6c757d', bg: '#f5f5f5' },
		},
		prioridade: {
			Alta: { bg: '#ffebee', color: '#c62828', icon: '🔴', border: '#dc3545' },
			'Média-Alta': {
				bg: '#fff3e0',
				color: '#ef6c00',
				icon: '🟡',
				border: '#fd7e14',
			},
			Normal: {
				bg: '#e8f5e9',
				color: '#2e7d32',
				icon: '🟢',
				border: '#28a745',
			},
			Baixa: { bg: '#f5f5f5', color: '#616161', icon: '⚪', border: '#6c757d' },
		},
	},
	limits: {
		titleTruncate: 100,
		descriptionTruncate: 200,
		defaultTruncate: 150,
	},
};

// ============================================================================
// FUNÇÕES DE CARREGAMENTO DE DADOS
// ============================================================================

function carregarDadosOperador() {
	// Carregar dados do operador do search-user
	if (typeof $ !== 'undefined' && typeof $('search-user') !== 'undefined') {
		try {
			const userData = $('search-user').first().json.data[0];
			if (userData) {
				console.log('📋 Dados do operador carregados do search-user');
				return {
					titulo_eleitor: userData['1'], // 173604200205 - Titulo de Eleitor
					id_glpi: userData['2'], // 7 - ID no GLPI
					nome: userData['9'], // Jackson Cardoso - Nome
					sobrenome: userData['34'], // Souza - Last Name
					email: userData['5'], // jackson.cardoso@tre-mg.jus.br - Email
					nome_completo: `${userData['9']} ${userData['34']}`, // Nome completo combinado
				};
			}
		} catch (error) {
			console.warn(
				'⚠️  Não foi possível carregar dados do operador:',
				error.message,
			);
		}
	}

	// Fallback para ambiente local ou se não conseguir acessar
	console.log('📋 Usando dados padrão do operador (ambiente local)');
	return {
		titulo_eleitor: 'N/A',
		id_glpi: 'N/A',
		nome: 'Operador',
		sobrenome: 'Sistema',
		email: 'sistema@exemplo.com',
		nome_completo: 'Operador Sistema',
	};
}

function carregarDados() {
	// Detectar ambiente e carregar dados
	if (typeof $input !== 'undefined' && $input && $input.all) {
		// Ambiente n8n
		console.log('Ambiente n8n detectado');
		return $input.first().json;
	} else if (
		typeof $input !== 'undefined' &&
		$input &&
		$input.item &&
		$input.item.json
	) {
		// Ambiente n8n com formato alternativo
		console.log('Ambiente n8n detectado (formato alternativo)');
		return $input.item.json;
	} else {
		// Ambiente local
		console.log(
			'Ambiente local detectado, carregando user_tickets_report.json',
		);
		isLocalEnvironment = true;
		const fs = require('fs');
		const path = require('path');

		try {
			const dataPath = path.join(__dirname, 'user_tickets_report.json');
			const localData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
			console.log('Arquivo user_tickets_report.json carregado com sucesso');
			return localData;
		} catch (error) {
			console.error(
				'Erro ao carregar user_tickets_report.json:',
				error.message,
			);
			throw new Error('Não foi possível carregar os dados do usuário');
		}
	}
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================
function formatarData(dataISO) {
	if (!dataISO) return 'N/A';
	const data = new Date(dataISO);
	return data.toLocaleDateString('pt-BR', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
}

function formatarDataHora(dataISO) {
	if (!dataISO) return 'N/A';
	const data = new Date(dataISO);
	return data.toLocaleString('pt-BR', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function getStatusBadge(status, prioridade) {
	const statusStyle =
		CONFIG.colors.status[status] || CONFIG.colors.status['Novo'];
	const borderColor = CONFIG.colors.prioridade[prioridade]?.border || '#28a745';

	return `
		<span style="
			background-color: ${statusStyle.bg};
			color: ${statusStyle.color};
			padding: 4px 8px;
			border-radius: 12px;
			font-size: 12px;
			font-weight: 600;
			border-left: 3px solid ${borderColor};
			margin-right: 8px;
		">
			${status}
		</span>
	`;
}

function getPrioridadeBadge(prioridade) {
	const estilo =
		CONFIG.colors.prioridade[prioridade] || CONFIG.colors.prioridade['Normal'];

	return `
		<span style="
			background-color: ${estilo.bg};
			color: ${estilo.color};
			padding: 2px 6px;
			border-radius: 8px;
			font-size: 11px;
			font-weight: 500;
		">
			${estilo.icon} ${prioridade}
		</span>
	`;
}

function getOperadorBadge(operador) {
	if (!operador || operador === 'Não atribuído') {
		return `
			<span style="
				background-color: #f8f9fa;
				color: #6c757d;
				padding: 2px 6px;
				border-radius: 8px;
				font-size: 11px;
				font-weight: 500;
				border: 1px dashed #dee2e6;
			">
				👤 Não atribuído
			</span>
		`;
	}

	return `
		<span style="
			background-color: #e3f2fd;
			color: #1976d2;
			padding: 2px 6px;
			border-radius: 8px;
			font-size: 11px;
			font-weight: 500;
		">
			👨‍💻 ${operador}
		</span>
	`;
}

function truncarTexto(texto, limite = CONFIG.limits.defaultTruncate) {
	if (!texto) return '';
	return texto.length > limite ? texto.substring(0, limite) + '...' : texto;
}

// ============================================================================
// FUNÇÕES DE GERAÇÃO DE COMPONENTES HTML
// ============================================================================

function gerarCabecalho(dataRelatorio) {
	// Usar informações do operador logado
	const nomeOperador = operadorInfo?.nome_completo || 'Operador';
	const emailOperador = operadorInfo?.email || '';

	return `
        <!-- Cabeçalho -->
        <div class="header">
            <h1>📋 Relatório Diário de Tickets - ${nomeOperador}</h1>
            <p>${dataRelatorio}</p>
            ${
							emailOperador
								? `<p style="font-size: 14px; opacity: 0.8;">📧 ${emailOperador}</p>`
								: ''
						}
        </div>
	`;
}

function gerarResumoGeral(
	totalTicketsAbertos,
	totalTicketsFechados,
	ticketsRequeremAcao,
) {
	return `
        <!-- Resumo Geral -->
        <div class="summary">
            <div class="summary-item abertos">
                <div class="summary-number">${totalTicketsAbertos}</div>
                <div class="summary-label">Em Aberto</div>
            </div>
            <div class="summary-item fechados">
                <div class="summary-number">${totalTicketsFechados}</div>
                <div class="summary-label">Fechados</div>
            </div>
            <div class="summary-item acao">
                <div class="summary-number">${ticketsRequeremAcao}</div>
                <div class="summary-label">Requer Ação</div>
            </div>
        </div>
	`;
}

function gerarAlertaAcao(ticketsRequeremAcao) {
	if (ticketsRequeremAcao <= 0) return '';

	const nomeOperador = operadorInfo?.nome || 'Você';

	return `
        <!-- Alertas -->
        <div class="section">
            <div class="alert warning">
                <strong>⚠️ Atenção ${nomeOperador}!</strong> Você possui ${ticketsRequeremAcao} ticket(s) que requerem ação imediata.
            </div>
        </div>
	`;
}

function gerarDetalhesTicket(ticket, incluirSetor = false) {
	// Priorizar informações do operador real que atendeu o ticket
	const operadorNome =
		ticket.atendimento?.responsavel_real?.nome ||
		ticket.atendimento?.tecnico_atribuido?.nome ||
		ticket.operador?.nome ||
		operadorInfo?.nome_completo ||
		'Não atribuído';

	return `
		<div class="ticket-details">
			<div class="detail-item">
				<div class="detail-label">Categoria</div>
				<div class="detail-value">${ticket.categoria_principal}</div>
			</div>
			${
				incluirSetor
					? `
			<div class="detail-item">
				<div class="detail-label">Setor</div>
				<div class="detail-value">${ticket.setor || 'N/A'}</div>
			</div>
			`
					: ''
			}
			<div class="detail-item">
				<div class="detail-label">Operador Responsável</div>
				<div class="detail-value">${operadorNome}</div>
			</div>
			<div class="detail-item">
				<div class="detail-label">Urgência</div>
				<div class="detail-value">${ticket.urgencia}</div>
			</div>
			<div class="detail-item">
				<div class="detail-label">Abertura</div>
				<div class="detail-value">${formatarDataHora(ticket.data_abertura)}</div>
			</div>
			<div class="detail-item">
				<div class="detail-label">Contato</div>
				<div class="detail-value">${
					ticket.dados_completos?.forma_contato || 'N/A'
				}</div>
			</div>
			${
				incluirSetor
					? `
			<div class="detail-item">
				<div class="detail-label">Visibilidade</div>
				<div class="detail-value">${ticket.dados_completos?.visibilidade || 'N/A'}</div>
			</div>
			`
					: ''
			}
		</div>
	`;
}

function gerarTicketCard(ticket, incluirSetor = false) {
	// Usar as informações do operador de forma consistente
	const operadorNome =
		ticket.atendimento?.responsavel_real?.nome ||
		ticket.atendimento?.tecnico_atribuido?.nome ||
		ticket.operador?.nome ||
		operadorInfo?.nome_completo ||
		'Não atribuído';

	return `
		<div class="ticket-card">
			<div class="ticket-header">
				<div class="ticket-id">#${ticket.id}</div>
				<div class="ticket-title">${truncarTexto(
					ticket.titulo,
					CONFIG.limits.titleTruncate,
				)}</div>
				<div class="ticket-meta">
					${getStatusBadge(ticket.status, ticket.prioridade_calculada)}
					${getPrioridadeBadge(ticket.prioridade_calculada)}
					${getOperadorBadge(operadorNome)}
					<span style="font-size: 12px; color: #6c757d;">
						🕐 ${ticket.tempo_decorrido}
					</span>
				</div>
			</div>
			<div class="ticket-body">
				<div class="ticket-description">
					${truncarTexto(
						ticket.dados_completos?.descricao?.replace(/\n/g, '<br>') ||
							'Sem descrição',
						CONFIG.limits.descriptionTruncate,
					)}
				</div>
				${gerarDetalhesTicket(ticket, incluirSetor)}
			</div>
		</div>
	`;
}

function gerarSecaoTicketsUrgentes(ticketsUrgentes) {
	if (ticketsUrgentes.length === 0) return '';

	return `
        <!-- Tickets Urgentes -->
        <div class="section">
            <h2>🔴 Tickets Urgentes</h2>
            ${ticketsUrgentes
							.map((ticket) => gerarTicketCard(ticket, false))
							.join('')}
        </div>
	`;
}

function gerarSecaoTicketsAbertos(ticketsAbertos) {
	const nomeOperador = operadorInfo?.nome || 'Você';

	return `
        <!-- Todos os Tickets em Aberto -->
        <div class="section">
            <h2>📝 Tickets em Aberto (${ticketsAbertos.length})</h2>
            ${
							ticketsAbertos.length > 0
								? ticketsAbertos
										.map((ticket) => gerarTicketCard(ticket, true))
										.join('')
								: `
                <div class="no-tickets">
                    <div style="font-size: 48px; margin-bottom: 15px;">🎉</div>
                    <p>Parabéns ${nomeOperador}! Você não possui tickets em aberto no momento.</p>
                </div>
            `
						}
        </div>
	`;
}

function gerarSecaoEstatisticas(estatisticas, resumo_usuario) {
	return `
        <!-- Estatísticas -->
        <div class="section">
            <h2>📊 Estatísticas</h2>
            <div class="ticket-details">
                <div class="detail-item">
                    <div class="detail-label">Por Status</div>
                    <div class="detail-value">
                        ${Object.entries(estatisticas.por_status)
													.map(([status, count]) => `${status}: ${count}`)
													.join(' • ')}
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Por Urgência</div>
                    <div class="detail-value">
                        ${Object.entries(estatisticas.por_urgencia)
													.map(([urgencia, count]) => `${urgencia}: ${count}`)
													.join(' • ')}
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Período</div>
                    <div class="detail-value">
                        ${formatarData(
													resumo_usuario.periodo_analise.ticket_mais_antigo,
												)} -
                        ${formatarData(
													resumo_usuario.periodo_analise.ticket_mais_recente,
												)}
                    </div>
                </div>
                ${
									operadorInfo?.id_glpi
										? `
                <div class="detail-item">
                    <div class="detail-label">ID Operador GLPI</div>
                    <div class="detail-value">#${operadorInfo.id_glpi}</div>
                </div>
                `
										: ''
								}
            </div>
        </div>
	`;
}

function gerarRodape(resumo_usuario) {
	const nomeOperador = operadorInfo?.nome_completo || 'Operador';

	return `
        <!-- Rodapé -->
        <div class="footer">
            <p>📧 Relatório gerado automaticamente para <strong>${nomeOperador}</strong> em ${formatarDataHora(
		resumo_usuario.data_processamento,
	)}</p>
            <p>🔄 Próximo relatório será enviado amanhã no mesmo horário</p>
            ${
							operadorInfo?.titulo_eleitor
								? `<p style="font-size: 11px; color: #9e9e9e;">ID Funcional: ${operadorInfo.titulo_eleitor}</p>`
								: ''
						}
        </div>
	`;
}

// ============================================================================
// FUNÇÕES DE GERAÇÃO DE CSS E ESTRUTURA
// ============================================================================

function gerarCSS() {
	return `
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background-color: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
        }
        .summary {
            display: flex;
            justify-content: space-around;
            padding: 25px;
            background-color: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
        }
        .summary-item {
            text-align: center;
            flex: 1;
        }
        .summary-number {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .summary-label {
            font-size: 14px;
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .summary-item.abertos .summary-number { color: #ffc107; }
        .summary-item.fechados .summary-number { color: #28a745; }
        .summary-item.acao .summary-number { color: #dc3545; }
        .section {
            padding: 25px;
        }
        .section h2 {
            color: #495057;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-size: 22px;
        }
        .ticket-card {
            border: 1px solid #dee2e6;
            border-radius: 8px;
            margin-bottom: 20px;
            overflow: hidden;
            transition: box-shadow 0.3s ease;
        }
        .ticket-card:hover {
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        .ticket-header {
            background-color: #f8f9fa;
            padding: 15px;
            border-bottom: 1px solid #dee2e6;
        }
        .ticket-id {
            font-weight: bold;
            font-size: 16px;
            color: #495057;
            margin-bottom: 5px;
        }
        .ticket-title {
            font-size: 14px;
            color: #6c757d;
            margin-bottom: 10px;
        }
        .ticket-meta {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
        }
        .ticket-body {
            padding: 15px;
        }
        .ticket-description {
            margin-bottom: 15px;
            line-height: 1.5;
            color: #495057;
        }
        .ticket-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e9ecef;
        }
        .detail-item {
            display: flex;
            flex-direction: column;
        }
        .detail-label {
            font-size: 12px;
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 3px;
        }
        .detail-value {
            font-size: 14px;
            color: #495057;
            font-weight: 500;
        }
        .no-tickets {
            text-align: center;
            padding: 40px;
            color: #6c757d;
            font-style: italic;
        }
        .alert {
            background-color: #d1ecf1;
            border: 1px solid #bee5eb;
            color: #0c5460;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .alert.warning {
            background-color: #fff3cd;
            border-color: #ffeaa7;
            color: #856404;
        }
        .alert.success {
            background-color: #d4edda;
            border-color: #c3e6cb;
            color: #155724;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #dee2e6;
            font-size: 12px;
            color: #6c757d;
        }
        @media (max-width: 600px) {
            .summary {
                flex-direction: column;
                gap: 20px;
            }
            .ticket-details {
                grid-template-columns: 1fr;
            }
        }
	`;
}

// ============================================================================
// FUNÇÃO PRINCIPAL DE PROCESSAMENTO
// ============================================================================

function processarDados() {
	// Carregar dados
	const inputData = carregarDados();

	// Verificar se temos dados para processar
	if (!inputData) {
		console.error('Nenhum dado disponível para processamento');
		return isLocalEnvironment
			? { html: '<p>Erro: Nenhum dado disponível</p>' }
			: [{ json: { html: '<p>Erro: Nenhum dado disponível</p>' } }];
	}

	// Garantir que seja um array e pegar o primeiro item (dados processados)
	const dados = Array.isArray(inputData) ? inputData[0] : inputData;
	const {
		resumo_usuario,
		estatisticas,
		acoes_pendentes,
		tickets,
		automacao_sugerida,
	} = dados;

	console.log(
		`Gerando relatório HTML para ${resumo_usuario.total_tickets} ticket(s)`,
	);

	return dados;
}

function gerarRelatorioHTML(dados) {
	const { resumo_usuario, estatisticas, tickets } = dados;

	// Gerar estatísticas resumidas
	const totalTicketsAbertos = resumo_usuario.tickets_abertos;
	const totalTicketsFechados = resumo_usuario.tickets_fechados;
	const ticketsRequeremAcao = resumo_usuario.tickets_requerem_acao;

	// Separar tickets por urgência/prioridade
	const ticketsUrgentes = tickets.filter(
		(t) => t.prioridade_calculada === 'Alta' || t.urgencia === 'Alta',
	);
	const ticketsAbertos = tickets.filter(
		(t) => t.status !== 'Fechado' && t.status !== 'Resolvido',
	);

	// Data de hoje formatada
	const dataRelatorio = formatarData(new Date().toISOString());

	// Construir HTML do relatório
	const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório Diário de Tickets GLPI</title>
    <style>
        ${gerarCSS()}
    </style>
</head>
<body>
    <div class="container">
        ${gerarCabecalho(dataRelatorio)}
        ${gerarResumoGeral(
					totalTicketsAbertos,
					totalTicketsFechados,
					ticketsRequeremAcao,
				)}
        ${gerarAlertaAcao(ticketsRequeremAcao)}
        ${gerarSecaoTicketsUrgentes(ticketsUrgentes)}
        ${gerarSecaoTicketsAbertos(ticketsAbertos)}
        ${gerarSecaoEstatisticas(estatisticas, resumo_usuario)}
        ${gerarRodape(resumo_usuario)}
    </div>
</body>
</html>
`;

	return {
		htmlContent,
		totalTicketsAbertos,
		totalTicketsFechados,
		ticketsRequeremAcao,
		ticketsUrgentes,
	};
}

function gerarResultadoFinal(htmlData, resumo_usuario) {
	const {
		htmlContent,
		totalTicketsAbertos,
		totalTicketsFechados,
		ticketsRequeremAcao,
		ticketsUrgentes,
	} = htmlData;

	return {
		html: htmlContent,
		resumo: {
			tickets_processados: resumo_usuario.total_tickets,
			tickets_abertos: totalTicketsAbertos,
			tickets_fechados: totalTicketsFechados,
			tickets_urgentes: ticketsUrgentes.length,
			requer_acao: ticketsRequeremAcao,
			data_geracao: new Date().toISOString(),
		},
		email_config: {
			assunto: `📋 Relatório Diário GLPI - ${totalTicketsAbertos} ticket(s) em aberto`,
			prioridade: ticketsUrgentes.length > 0 ? 'alta' : 'normal',
			tem_urgentes: ticketsUrgentes.length > 0,
			resumo_email: `Você possui ${totalTicketsAbertos} tickets em aberto${
				ticketsUrgentes.length > 0
					? `, sendo ${ticketsUrgentes.length} urgente(s)`
					: ''
			}.`,
		},
	};
}

function salvarArquivosLocais(result) {
	if (!isLocalEnvironment) return;

	const fs = require('fs');
	const path = require('path');

	try {
		// Salvar HTML
		const outputPath = path.join(__dirname, 'relatorio_tickets.html');
		fs.writeFileSync(outputPath, result.html, 'utf8');
		console.log(`📄 Relatório HTML salvo em: ${outputPath}`);

		// Salvar configurações
		const configPath = path.join(__dirname, 'email_config.json');
		fs.writeFileSync(configPath, JSON.stringify(result, null, 2));
		console.log(`⚙️ Configurações de email salvas em: ${configPath}`);
	} catch (error) {
		console.error('Erro ao salvar arquivos:', error.message);
	}
}

// ============================================================================
// EXECUÇÃO PRINCIPAL
// ============================================================================

try {
	// Carregar dados do operador primeiro
	operadorInfo = carregarDadosOperador();
	console.log(
		`📋 Operador identificado: ${operadorInfo.nome_completo} (ID: ${operadorInfo.id_glpi})`,
	);

	// Processar dados
	const dados = processarDados();

	// Gerar HTML
	const htmlData = gerarRelatorioHTML(dados);

	// Gerar resultado final
	const htmlResult = gerarResultadoFinal(htmlData, dados.resumo_usuario);

	// Resultado final
	const result = {
		html: htmlResult.html,
		totalTickets: dados.resumo_usuario.total_tickets,
		operadorRealAtendente:
			dados.operador_que_real_atendeu ||
			operadorInfo?.nome_completo ||
			'Sistema Automatizado',
		operadorLogado: {
			nome: operadorInfo?.nome_completo || 'N/A',
			email: operadorInfo?.email || 'N/A',
			id_glpi: operadorInfo?.id_glpi || 'N/A',
			titulo_eleitor: operadorInfo?.titulo_eleitor || 'N/A',
		},
	};

	// Log de sucesso
	console.log(`✅ Relatório HTML gerado com sucesso!`);
	console.log(
		`   • Tickets processados: ${dados.resumo_usuario.total_tickets}`,
	);
	console.log(`   • Tickets em aberto: ${htmlData.totalTicketsAbertos}`);
	console.log(`   • Tickets urgentes: ${htmlData.ticketsUrgentes.length}`);
	console.log(`   • Tamanho HTML: ${Math.round(result.html.length / 1024)}KB`);

	// Salvar arquivos locais se necessário
	salvarArquivosLocais(result);

	// Retornar resultado baseado no ambiente
	if (isLocalEnvironment) {
		// Para ambiente local/Node.js
		if (typeof module !== 'undefined' && module.exports) {
			module.exports = result;
		}
		return result;
	} else {
		// Ambiente n8n - retornar diretamente
		return [{ json: result }];
	}
} catch (error) {
	console.error('Erro na geração do relatório:', error.message);

	const errorResult = {
		html: `<p>Erro na geração do relatório: ${error.message}</p>`,
		error: true,
	};

	if (isLocalEnvironment) {
		return errorResult;
	} else {
		return [{ json: errorResult }];
	}
}

// Extrator de tickets GLPI para usuário específico
// Baseado nos dados do data.json - foco em acompanhamento individual de chamados

let inputData;
let isLocalEnvironment = false;

// Detectar ambiente e carregar dados
if (typeof $input !== 'undefined' && $input && $input.all) {
	// Ambiente n8n
	console.log('Ambiente n8n detectado');
	inputData = $input.first().json;
} else if (
	typeof $input !== 'undefined' &&
	$input &&
	$input.item &&
	$input.item.json
) {
	// Ambiente n8n com formato alternativo
	console.log('Ambiente n8n detectado (formato alternativo)');
	inputData = $input.item.json;
} else {
	// Ambiente local
	console.log('Ambiente local detectado, carregando data.json');
	isLocalEnvironment = true;
	const fs = require('fs');
	const path = require('path');

	try {
		const dataPath = path.join(__dirname, 'data.json');
		const localData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
		inputData = localData;
		console.log('Arquivo data.json carregado com sucesso');
	} catch (error) {
		console.error('Erro ao carregar data.json:', error.message);
		throw new Error('Não foi possível carregar os dados do usuário');
	}
}

// Verificar se temos dados para processar
if (!inputData) {
	console.error('Nenhum dado disponível para processamento');
	const errorResult = [
		{
			json: {
				erro: 'Nenhum dado disponível para processamento',
				processado_em: new Date().toISOString(),
			},
		},
	];

	if (isLocalEnvironment) {
		return { results: errorResult };
	} else {
		return errorResult;
	}
}

console.log(
	'Estrutura dos dados recebidos:',
	JSON.stringify(inputData, null, 2).substring(0, 500) + '...',
);

// Garantir que inputData seja um array
let dataToProcess = Array.isArray(inputData) ? inputData : [inputData];

console.log(`Processando ${dataToProcess.length} conjunto(s) de dados`);

// Funções utilitárias
function decodeHtml(text) {
	if (!text) return '';
	return text
		.replace(/&#60;/g, '<')
		.replace(/&#62;/g, '>')
		.replace(/&#38;/g, '&')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#38;#62;/g, '>')
		.replace(/&#38;#60;/g, '<')
		.replace(/&#38;gt;/g, '>')
		.replace(/&#38;nbsp;/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&#160;/g, ' ')
		.replace(/&#38;lt;/g, '<');
}

function stripHtml(text) {
	if (!text) return '';
	return text.replace(/<[^>]*>/g, '').trim();
}

function extractBetween(text, start, end) {
	const startIndex = text.indexOf(start);
	if (startIndex === -1) return '';
	const endIndex = text.indexOf(end, startIndex + start.length);
	if (endIndex === -1) return text.substring(startIndex + start.length).trim();
	return text.substring(startIndex + start.length, endIndex).trim();
}

function getStatusText(statusId) {
	const statusMap = {
		1: 'Novo',
		2: 'Em andamento',
		3: 'Planejado',
		4: 'Pendente',
		5: 'Resolvido',
		6: 'Fechado',
	};
	return statusMap[statusId] || `Status ${statusId}`;
}

function calcularTempoDecorrido(dataAbertura) {
	if (!dataAbertura) return '';

	const inicio = new Date(dataAbertura);
	const agora = new Date();

	if (isNaN(inicio.getTime())) return '';

	const diffMs = agora - inicio;
	const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

	if (dias > 0) {
		return `${dias} dia(s) e ${horas} hora(s)`;
	} else if (horas > 0) {
		return `${horas} hora(s)`;
	} else {
		const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
		return `${minutos} minuto(s)`;
	}
}

function calcularDuracao(dataAbertura, dataFechamento) {
	if (!dataAbertura) return '';

	const inicio = new Date(dataAbertura);
	const fim = dataFechamento ? new Date(dataFechamento) : new Date();

	if (isNaN(inicio.getTime())) return '';
	if (dataFechamento && isNaN(fim.getTime())) return '';

	const diffMs = fim - inicio;
	const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

	if (dias > 0) {
		return `${dias}d ${horas}h ${minutos}m`;
	} else if (horas > 0) {
		return `${horas}h ${minutos}m`;
	} else {
		return `${minutos}m`;
	}
}

function extrairDescricaoCompleta(htmlContent) {
	if (!htmlContent) return '';

	const decodedContent = decodeHtml(htmlContent);

	// Extrair apenas a descrição principal (item 3)
	const descricao = extractBetween(
		decodedContent,
		'3) Descrição : </b>',
		'</div>',
	);
	return stripHtml(descricao) || stripHtml(decodedContent);
}

function extrairDadosEstruturados(htmlContent) {
	if (!htmlContent) return {};

	const decodedContent = decodeHtml(htmlContent);
	const dados = {};

	// Extrair campos específicos
	dados.motivo = extractBetween(
		decodedContent,
		'2) Indique o motivo/serviço : </b>',
		'</div>',
	);
	dados.descricao = extractBetween(
		decodedContent,
		'3) Descrição : </b>',
		'</div>',
	);
	dados.urgencia = extractBetween(
		decodedContent,
		'5) Urgência : </b>',
		'</div>',
	);
	dados.visibilidade = extractBetween(
		decodedContent,
		'6) Visibilidade : </b>',
		'</div>',
	);
	dados.forma_contato = extractBetween(
		decodedContent,
		'7) Forma de Contato : </b>',
		'</div>',
	);
	dados.observacao_contato = extractBetween(
		decodedContent,
		'8) Observação de contato : </b>',
		'</div>',
	);

	// Limpar HTML das extrações
	Object.keys(dados).forEach((key) => {
		dados[key] = stripHtml(dados[key]);
	});

	return dados;
}

// Estruturas para armazenar dados processados
let totalTickets = 0;
let ticketsProcessados = [];
let estatisticasGerais = {
	por_status: {},
	por_categoria: {},
	por_urgencia: {},
	por_setor: {},
	tickets_abertos: 0,
	tickets_fechados: 0,
};

// Processar dados
dataToProcess.forEach((conjunto, conjuntoIndex) => {
	if (conjunto.data && Array.isArray(conjunto.data)) {
		console.log(
			`Processando ${conjunto.data.length} tickets do conjunto ${conjuntoIndex}`,
		);

		conjunto.data.forEach((ticket, ticketIndex) => {
			try {
				totalTickets++;

				// Extrair dados básicos
				const ticketId = ticket['2'] || '';
				const categoria = stripHtml(decodeHtml(ticket['7'] || ''));
				const setor =
					stripHtml(decodeHtml(ticket['71'] || '')) || 'Sem setor definido';
				const status = getStatusText(ticket['12']);
				const dataAbertura = ticket['15'] || '';
				const dataFechamento = ticket['16'] || null;
				const operadorId = ticket['5'] || '';
				const usuarioId = ticket['4'] || '';

				// Extrair dados estruturados do HTML
				const dadosEstruturados = extrairDadosEstruturados(ticket['21']);

				// Calcular tempos
				const tempoDecorrido = calcularTempoDecorrido(dataAbertura);
				const duracao = calcularDuracao(dataAbertura, dataFechamento);

				// Determinar prioridade baseada na urgência e tempo decorrido
				let prioridade = 'Normal';
				const diasDecorridos = dataAbertura
					? Math.floor(
							(new Date() - new Date(dataAbertura)) / (1000 * 60 * 60 * 24),
					  )
					: 0;

				if (dadosEstruturados.urgencia === 'Alta' || diasDecorridos > 7) {
					prioridade = 'Alta';
				} else if (
					dadosEstruturados.urgencia === 'Média' &&
					diasDecorridos > 3
				) {
					prioridade = 'Média-Alta';
				}

				// Criar objeto do ticket processado
				const ticketProcessado = {
					id: ticketId,
					titulo: stripHtml(decodeHtml(ticket['1'] || '')),
					categoria: categoria,
					categoria_principal: categoria
						? categoria.split(' > ')[0]
						: 'Sem categoria',
					setor: setor,
					status: status,
					status_codigo: ticket['12'],
					urgencia: dadosEstruturados.urgencia || 'Não informado',
					prioridade_calculada: prioridade,
					operador_id: operadorId,
					usuario_id: usuarioId,
					data_abertura: dataAbertura,
					data_fechamento: dataFechamento,
					tempo_decorrido: tempoDecorrido,
					duracao: duracao,
					dias_decorridos: diasDecorridos,
					dados_completos: {
						motivo: dadosEstruturados.motivo,
						descricao: dadosEstruturados.descricao,
						visibilidade: dadosEstruturados.visibilidade,
						forma_contato: dadosEstruturados.forma_contato,
						observacao_contato: dadosEstruturados.observacao_contato,
					},
					// Flags para automação
					automacao: {
						requer_followup: status === 'Em andamento' && diasDecorridos > 2,
						urgente: dadosEstruturados.urgencia === 'Alta',
						atrasado: diasDecorridos > 5 && status !== 'Fechado',
						pendente_longo_tempo: status === 'Pendente' && diasDecorridos > 3,
					},
					processado_em: new Date().toISOString(),
				};

				ticketsProcessados.push(ticketProcessado);

				// Atualizar estatísticas
				estatisticasGerais.por_status[status] =
					(estatisticasGerais.por_status[status] || 0) + 1;
				estatisticasGerais.por_categoria[ticketProcessado.categoria_principal] =
					(estatisticasGerais.por_categoria[
						ticketProcessado.categoria_principal
					] || 0) + 1;
				estatisticasGerais.por_urgencia[ticketProcessado.urgencia] =
					(estatisticasGerais.por_urgencia[ticketProcessado.urgencia] || 0) + 1;
				estatisticasGerais.por_setor[setor] =
					(estatisticasGerais.por_setor[setor] || 0) + 1;

				if (status === 'Fechado') {
					estatisticasGerais.tickets_fechados++;
				} else {
					estatisticasGerais.tickets_abertos++;
				}
			} catch (error) {
				console.error(
					`Erro ao processar ticket ${ticketIndex}:`,
					error.message,
				);
			}
		});
	}
});

// Ordenar tickets por prioridade e data
ticketsProcessados.sort((a, b) => {
	const prioridadeOrder = { Alta: 4, 'Média-Alta': 3, Normal: 2, Baixa: 1 };
	const prioA = prioridadeOrder[a.prioridade_calculada] || 2;
	const prioB = prioridadeOrder[b.prioridade_calculada] || 2;

	if (prioA !== prioB) {
		return prioB - prioA; // Prioridade alta primeiro
	}

	// Se mesma prioridade, ordenar por data (mais antigo primeiro)
	return new Date(a.data_abertura) - new Date(b.data_abertura);
});

// Identificar tickets que precisam de ação
const ticketsRequeremAcao = ticketsProcessados.filter((ticket) =>
	Object.values(ticket.automacao).some((flag) => flag === true),
);

// Agrupar por tipo de ação necessária
const acoesPendentes = {
	followup: ticketsProcessados.filter((t) => t.automacao.requer_followup),
	urgentes: ticketsProcessados.filter((t) => t.automacao.urgente),
	atrasados: ticketsProcessados.filter((t) => t.automacao.atrasado),
	pendentes_longo_tempo: ticketsProcessados.filter(
		(t) => t.automacao.pendente_longo_tempo,
	),
};

// Calcular período de análise
let ticketMaisAntigo = null;
let ticketMaisRecente = null;

ticketsProcessados.forEach((ticket) => {
	if (ticket.data_abertura) {
		const data = new Date(ticket.data_abertura);
		if (!ticketMaisAntigo || data < ticketMaisAntigo) {
			ticketMaisAntigo = data;
		}
		if (!ticketMaisRecente || data > ticketMaisRecente) {
			ticketMaisRecente = data;
		}
	}
});

// Resultado final
const results = {
	resumo_usuario: {
		total_tickets: totalTickets,
		tickets_abertos: estatisticasGerais.tickets_abertos,
		tickets_fechados: estatisticasGerais.tickets_fechados,
		tickets_requerem_acao: ticketsRequeremAcao.length,
		data_processamento: new Date().toISOString(),
		periodo_analise: {
			ticket_mais_antigo: ticketMaisAntigo
				? ticketMaisAntigo.toISOString().split('T')[0]
				: '',
			ticket_mais_recente: ticketMaisRecente
				? ticketMaisRecente.toISOString().split('T')[0]
				: '',
		},
	},

	estatisticas: estatisticasGerais,

	acoes_pendentes: {
		resumo: {
			followup_necessario: acoesPendentes.followup.length,
			tickets_urgentes: acoesPendentes.urgentes.length,
			tickets_atrasados: acoesPendentes.atrasados.length,
			pendentes_longo_tempo: acoesPendentes.pendentes_longo_tempo.length,
		},
		detalhes: acoesPendentes,
	},

	tickets: ticketsProcessados,

	// Sugestões para automação
	automacao_sugerida: {
		notificacoes: {
			followup_diario: acoesPendentes.followup.map((t) => ({
				id: t.id,
				titulo: t.titulo,
				dias: t.dias_decorridos,
			})),
			urgentes_imediato: acoesPendentes.urgentes.map((t) => ({
				id: t.id,
				titulo: t.titulo,
				urgencia: t.urgencia,
			})),
		},
		relatorios: {
			frequencia_sugerida: 'diaria',
			metricas_acompanhar: [
				'tempo_medio_resolucao',
				'tickets_por_categoria',
				'sla_cumprimento',
			],
		},
	},
};

console.log(`✅ Processamento concluído:`);
console.log(`   • Total de tickets: ${totalTickets}`);
console.log(`   • Tickets em aberto: ${estatisticasGerais.tickets_abertos}`);
console.log(`   • Tickets fechados: ${estatisticasGerais.tickets_fechados}`);
console.log(`   • Tickets requerem ação: ${ticketsRequeremAcao.length}`);

if (isLocalEnvironment) {
	// Ambiente local - salvar arquivo
	const fs = require('fs');
	const path = require('path');

	try {
		const outputPath = path.join(__dirname, 'user_tickets_report.json');
		fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
		console.log(`📄 Relatório do usuário salvo em: ${outputPath}`);

		// Mostrar alertas importantes
		if (ticketsRequeremAcao.length > 0) {
			console.log('\n🚨 AÇÕES REQUERIDAS:');
			if (acoesPendentes.urgentes.length > 0) {
				console.log(
					`   • ${acoesPendentes.urgentes.length} ticket(s) URGENTE(S)`,
				);
			}
			if (acoesPendentes.atrasados.length > 0) {
				console.log(
					`   • ${acoesPendentes.atrasados.length} ticket(s) ATRASADO(S)`,
				);
			}
			if (acoesPendentes.followup.length > 0) {
				console.log(
					`   • ${acoesPendentes.followup.length} ticket(s) precisam de follow-up`,
				);
			}
			if (acoesPendentes.pendentes_longo_tempo.length > 0) {
				console.log(
					`   • ${acoesPendentes.pendentes_longo_tempo.length} ticket(s) pendente(s) há muito tempo`,
				);
			}
		}

		console.log('\n📊 Estatísticas por categoria:');
		Object.entries(estatisticasGerais.por_categoria)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 3)
			.forEach(([categoria, count]) => {
				console.log(`   • ${categoria}: ${count} ticket(s)`);
			});
	} catch (error) {
		console.error('Erro ao salvar arquivo:', error.message);
	}

	// Para ambiente local/Node.js
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = { results };
	}

	return { results };
} else {
	// Ambiente n8n - retornar diretamente
	return [{ json: results }];
}

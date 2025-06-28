// Detectar ambiente e carregar dados
let inputData;
let isLocalEnvironment = false;

// Verificar se estamos no n8n ou ambiente local
if (typeof $input !== 'undefined' && $input && $input.all) {
	// Ambiente n8n
	console.log('Ambiente n8n detectado');
	inputData = $input.first().json.datas;
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
	console.log('Ambiente local detectado, carregando output.json');
	isLocalEnvironment = true;
	const fs = require('fs');
	const path = require('path');

	try {
		const dataPath = path.join(__dirname, 'output.json');
		const localData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
		inputData = localData;
		console.log('Arquivo output.json carregado com sucesso');
	} catch (error) {
		console.error('Erro ao carregar output.json:', error.message);
		throw new Error('Não foi possível carregar os dados');
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

// Garantir que inputData seja um array e encontrar os dados corretos
let dataToProcess;

console.log(
	'Estrutura dos dados recebidos:',
	JSON.stringify(inputData, null, 2).substring(0, 500) + '...',
);

if (Array.isArray(inputData)) {
	// Se é um array, verificar se tem dados dentro
	if (inputData.length > 0 && inputData[0].datas) {
		// Array com objetos contendo 'datas' (formato do arquivo anexado)
		dataToProcess = inputData[0].datas;
		console.log('Detectado formato: array com datas');
	} else {
		// Array direto
		dataToProcess = inputData;
		console.log('Detectado formato: array direto');
	}
} else if (inputData.datas && Array.isArray(inputData.datas)) {
	// Objeto com propriedade 'datas'
	dataToProcess = inputData.datas;
	console.log('Detectado formato: objeto com datas');
} else {
	// Tentar tratar como item único
	dataToProcess = [inputData];
	console.log('Detectado formato: item único');
}

console.log(`Processando ${dataToProcess.length} item(s) de dados`);

// Criar mapeamento de operadores (primeira fase do processamento)
const operadoresMap = new Map();
let ticketsData = [];

// Separar operadores dos tickets
dataToProcess.forEach((item, itemIndex) => {
	if (item.data && Array.isArray(item.data) && item.data.length > 0) {
		// Verificar se é seção de operadores (tem campo '34' - sobrenome)
		const primeiroItem = item.data[0];
		if (primeiroItem['34']) {
			// É seção de operadores
			console.log(
				`Carregando ${item.data.length} operadores da seção ${itemIndex}`,
			);
			item.data.forEach((operador) => {
				const operadorId = operador['2']; // ID do operador
				const nome = operador['9'] || ''; // Nome
				const sobrenome = operador['34'] || ''; // Sobrenome
				const email = operador['5'] || '';
				const grupos = operador['13'] || '';

				// Construir nome completo
				let nomeCompleto = '';
				if (nome && sobrenome) {
					nomeCompleto = `${nome} ${sobrenome}`;
				} else if (nome) {
					nomeCompleto = nome;
				} else if (sobrenome) {
					nomeCompleto = sobrenome;
				} else {
					nomeCompleto = 'Sem nome';
				}

				if (operadorId) {
					operadoresMap.set(String(operadorId), {
						id: operadorId,
						nome: nome,
						sobrenome: sobrenome,
						nomeCompleto: nomeCompleto,
						email: email,
						grupos: Array.isArray(grupos) ? grupos : [grupos],
					});
				}
			});
		} else if (primeiroItem['1'] && primeiroItem['15']) {
			// É seção de tickets (tem campo '1' - título e '15' - data abertura)
			console.log(
				`Encontrados ${item.data.length} tickets na seção ${itemIndex}`,
			);
			ticketsData.push(item);
		}
	}
});

console.log(`✅ Carregados ${operadoresMap.size} operadores`);
console.log(`✅ Encontradas ${ticketsData.length} seções de tickets`);

// Função para obter nome do operador
function getOperadorNome(operadorId) {
	if (!operadorId) return 'Não atribuído';

	const operador = operadoresMap.get(String(operadorId));
	if (operador) {
		return operador.nomeCompleto;
	}
	return `Operador ${operadorId}`;
}

// Função para obter informações completas do operador
function getOperadorInfo(operadorId) {
	if (!operadorId)
		return {
			nome: 'Não atribuído',
			nomeCompleto: 'Não atribuído',
			email: '',
			grupos: [],
		};

	const operador = operadoresMap.get(String(operadorId));
	if (operador) {
		return {
			nome: operador.nome,
			sobrenome: operador.sobrenome,
			nomeCompleto: operador.nomeCompleto,
			email: operador.email,
			grupos: operador.grupos,
		};
	}
	return {
		nome: `Operador ${operadorId}`,
		sobrenome: '',
		nomeCompleto: `Operador ${operadorId}`,
		email: '',
		grupos: [],
	};
}

// Estrutura para agrupar por setor
const setoresSummary = {};
let totalTicketsProcessados = 0;

// Função para obter texto do status
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

// Função para obter texto da prioridade
function getPrioridadeText(prioridadeId) {
	const prioridadeMap = {
		1: 'Muito baixa',
		2: 'Baixa',
		3: 'Média',
		4: 'Alta',
		5: 'Muito alta',
	};
	return prioridadeMap[prioridadeId] || 'Não definida';
}

// Função para obter texto da urgência
function getUrgenciaText(urgenciaId) {
	const urgenciaMap = {
		1: 'Muito baixa',
		2: 'Baixa',
		3: 'Média',
		4: 'Alta',
		5: 'Muito alta',
	};
	return urgenciaMap[urgenciaId] || 'Não definida';
}

// Função para identificar quem realmente atendeu o ticket
function getQuemRealmenteAtendeu(ticket) {
	const atribuido = ticket['5'];
	const resolveu = ticket['81'];
	const fechou = ticket['19'];
	const ultimaAtualizacao = ticket['83'];

	// Informações dos operadores
	const infoAtribuido = getOperadorInfo(atribuido);
	const infoResolveu = getOperadorInfo(resolveu);
	const infoFechou = getOperadorInfo(fechou);
	const infoUltimaAtualizacao = getOperadorInfo(ultimaAtualizacao);

	// Determinar o responsável real (prioridade: resolveu > fechou > última atualização > atribuído)
	let responsavelRealId = resolveu || fechou || ultimaAtualizacao || atribuido;
	let responsavelRealInfo = getOperadorInfo(responsavelRealId);

	// Calcular confiabilidade da atribuição
	let confiabilidade = 'Baixa';
	if (resolveu) {
		confiabilidade = 'Alta';
	} else if (fechou) {
		confiabilidade = 'Média-Alta';
	} else if (ultimaAtualizacao && ultimaAtualizacao !== atribuido) {
		confiabilidade = 'Média';
	}

	return {
		tecnico_atribuido: {
			id: atribuido,
			nome: infoAtribuido.nomeCompleto,
			email: infoAtribuido.email,
			grupos: infoAtribuido.grupos,
		},
		tecnico_resolveu: {
			id: resolveu,
			nome: infoResolveu.nomeCompleto,
			email: infoResolveu.email,
			grupos: infoResolveu.grupos,
		},
		tecnico_fechou: {
			id: fechou,
			nome: infoFechou.nomeCompleto,
			email: infoFechou.email,
			grupos: infoFechou.grupos,
		},
		ultima_atualizacao_por: {
			id: ultimaAtualizacao,
			nome: infoUltimaAtualizacao.nomeCompleto,
			email: infoUltimaAtualizacao.email,
			grupos: infoUltimaAtualizacao.grupos,
		},
		// Quem realmente trabalhou no ticket (campo mais confiável)
		responsavel_real: {
			id: responsavelRealId,
			nome: responsavelRealInfo.nomeCompleto,
			email: responsavelRealInfo.email,
			grupos: responsavelRealInfo.grupos,
			confiabilidade: confiabilidade,
		},
		// Flags para análise
		atribuicao_diferente_resolucao: atribuido !== resolveu && resolveu !== null,
		teve_reatribuicao:
			ultimaAtualizacao !== atribuido && ultimaAtualizacao !== null,
		resolveu_quem_nao_era_atribuido:
			resolveu !== null && resolveu !== atribuido,
	};
}

// Função para calcular duração do ticket
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

// Processar cada item do array data
ticketsData.forEach((item, itemIndex) => {
	try {
		// Se o item contém tickets para processar
		if (
			item.totalcount !== undefined &&
			item.data &&
			Array.isArray(item.data) &&
			item.data.length > 0
		) {
			console.log(
				`Processando ${item.data.length} tickets do item ${itemIndex}`,
			);

			item.data.forEach((ticket, ticketIndex) => {
				try {
					// Função para decodificar HTML
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

					// Função para limpar HTML tags
					function stripHtml(text) {
						if (!text) return '';
						return text.replace(/<[^>]*>/g, '').trim();
					}

					// Função para extrair dados entre marcadores
					function extractBetween(text, start, end) {
						const startIndex = text.indexOf(start);
						if (startIndex === -1) return '';
						const endIndex = text.indexOf(end, startIndex + start.length);
						if (endIndex === -1)
							return text.substring(startIndex + start.length).trim();
						return text.substring(startIndex + start.length, endIndex).trim();
					} // Extrair dados básicos
					const setor =
						stripHtml(decodeHtml(ticket['71'] || '')) || 'Sem setor definido';
					const categoria = stripHtml(decodeHtml(ticket['7'] || ''));
					const status = getStatusText(ticket['12']);
					const prioridade = getPrioridadeText(ticket['37']);
					const urgencia = getUrgenciaText(ticket['30']);
					const tipo =
						stripHtml(decodeHtml(ticket['3'] || '')) || 'Não informado';

					// Extrair informações completas de quem atendeu
					const atendimentoInfo = getQuemRealmenteAtendeu(ticket);

					// Extrair urgência de forma mais robusta (mantido para compatibilidade)					let urgenciaLegacy = 'Não informado';
					if (ticket['21']) {
						const htmlContent = decodeHtml(ticket['21']);
						const urgenciaRaw = extractBetween(
							htmlContent,
							'Urgência',
							'</div>',
						);
						urgenciaLegacy =
							stripHtml(urgenciaRaw).replace(/^:\s*/, '').trim() ||
							'Não informado';
					}

					// Inicializar setor se não existir
					if (!setoresSummary[setor]) {
						setoresSummary[setor] = {
							setor: setor,
							total_tickets: 0,
							tickets_por_status: {},
							tickets_por_categoria: {},
							tickets_por_urgencia: {},
							tickets_por_prioridade: {},
							tickets_por_tipo: {},
							tickets_por_operador_atribuido: {},
							tickets_por_operador_resolveu: {},
							reatribuicoes: {
								total: 0,
								casos: [],
							},
							tempo_medio_resolucao: {
								total_minutos: 0,
								tickets_fechados: 0,
							},
							tickets: [],
						};
					}

					// Incrementar contadores
					setoresSummary[setor].total_tickets++;
					totalTicketsProcessados++;

					// Contar por status
					setoresSummary[setor].tickets_por_status[status] =
						(setoresSummary[setor].tickets_por_status[status] || 0) + 1;

					// Contar por categoria (categoria principal)
					const categoriaPrincipal = categoria
						? categoria.split(' > ')[0]
						: 'Sem categoria';
					setoresSummary[setor].tickets_por_categoria[categoriaPrincipal] =
						(setoresSummary[setor].tickets_por_categoria[categoriaPrincipal] ||
							0) + 1;

					// Contar por urgência
					setoresSummary[setor].tickets_por_urgencia[urgencia] =
						(setoresSummary[setor].tickets_por_urgencia[urgencia] || 0) + 1;

					// Contar por prioridade
					setoresSummary[setor].tickets_por_prioridade[prioridade] =
						(setoresSummary[setor].tickets_por_prioridade[prioridade] || 0) + 1;

					// Contar por tipo
					setoresSummary[setor].tickets_por_tipo[tipo] =
						(setoresSummary[setor].tickets_por_tipo[tipo] || 0) + 1;

					// Contar por operador atribuído
					const nomeOperadorAtribuido = atendimentoInfo.tecnico_atribuido.nome;
					setoresSummary[setor].tickets_por_operador_atribuido[
						nomeOperadorAtribuido
					] =
						(setoresSummary[setor].tickets_por_operador_atribuido[
							nomeOperadorAtribuido
						] || 0) + 1;

					// Contar por operador que realmente resolveu
					const nomeOperadorResolveu = atendimentoInfo.responsavel_real.nome;
					setoresSummary[setor].tickets_por_operador_resolveu[
						nomeOperadorResolveu
					] =
						(setoresSummary[setor].tickets_por_operador_resolveu[
							nomeOperadorResolveu
						] || 0) + 1;

					// Verificar reatribuições
					if (
						atendimentoInfo.atribuicao_diferente_resolucao ||
						atendimentoInfo.teve_reatribuicao
					) {
						setoresSummary[setor].reatribuicoes.total++;
						setoresSummary[setor].reatribuicoes.casos.push({
							ticket_id: ticket['2'],
							atribuido_para: atendimentoInfo.tecnico_atribuido.nome,
							resolvido_por: atendimentoInfo.responsavel_real.nome,
							motivo: atendimentoInfo.atribuicao_diferente_resolucao
								? 'Resolução por operador diferente'
								: 'Reatribuição',
						});
					}

					// Calcular tempo de resolução para tickets fechados
					if (status === 'Fechado' && ticket['15'] && ticket['16']) {
						const abertura = new Date(ticket['15']);
						const fechamento = new Date(ticket['16']);
						const diffMinutos = (fechamento - abertura) / (1000 * 60);

						setoresSummary[setor].tempo_medio_resolucao.total_minutos +=
							diffMinutos;
						setoresSummary[setor].tempo_medio_resolucao.tickets_fechados++;
					}

					const ticketData = {
						id: ticket['2'] || '',
						tipo: tipo,
						categoria_completa: categoria,
						categoria_principal: categoriaPrincipal,
						status: status,
						urgencia: urgencia,
						urgencia_legacy: urgenciaLegacy,
						prioridade: prioridade,
						// Informações detalhadas de atendimento
						atendimento: atendimentoInfo,
						// Datas importantes
						data_abertura: ticket['15'] || '',
						data_fechamento: ticket['16'] || null,
						data_resolucao: ticket['17'] || null,
						data_ultima_atualizacao: ticket['82'] || null,
						// Métricas
						duracao: calcularDuracao(ticket['15'], ticket['16']),
						tempo_resolucao: ticket['64'] || null,
						// Campos adicionais
						satisfacao: ticket['155'] || null,
						sla: ticket['18'] || null,
						impacto: ticket['31'] || null,
						// Compatibilidade com versão anterior
						operador: atendimentoInfo.tecnico_atribuido,
						tecnico_resolveu: atendimentoInfo.responsavel_real.nome,
					};

					// Adicionar ticket ao setor
					setoresSummary[setor].tickets.push(ticketData);
				} catch (error) {
					console.error(
						`Erro ao processar ticket ${ticketIndex} do item ${itemIndex}:`,
						error.message,
					);
				}
			});
		}
	} catch (error) {
		console.error(`Erro ao processar item ${itemIndex}:`, error.message);
	}
});

// Calcular médias de tempo e ordenar dados
Object.keys(setoresSummary).forEach((setor) => {
	const dados = setoresSummary[setor];

	// Calcular tempo médio de resolução
	if (dados.tempo_medio_resolucao.tickets_fechados > 0) {
		const mediaMinutos =
			dados.tempo_medio_resolucao.total_minutos /
			dados.tempo_medio_resolucao.tickets_fechados;

		const dias = Math.floor(mediaMinutos / (60 * 24));
		const horas = Math.floor((mediaMinutos % (60 * 24)) / 60);
		const minutos = Math.floor(mediaMinutos % 60);

		if (dias > 0) {
			dados.tempo_medio_resolucao.media_formatada = `${dias}d ${horas}h ${minutos}m`;
		} else if (horas > 0) {
			dados.tempo_medio_resolucao.media_formatada = `${horas}h ${minutos}m`;
		} else {
			dados.tempo_medio_resolucao.media_formatada = `${minutos}m`;
		}
	} else {
		dados.tempo_medio_resolucao.media_formatada = 'N/A';
	}

	// Remover campo auxiliar
	delete dados.tempo_medio_resolucao.total_minutos;

	// Ordenar operadores atribuídos por quantidade de tickets (decrescente)
	const operadoresAtribuidosOrdenados = Object.entries(
		dados.tickets_por_operador_atribuido,
	)
		.sort(([, a], [, b]) => b - a)
		.reduce((result, [operador, count]) => {
			result[operador] = count;
			return result;
		}, {});
	dados.tickets_por_operador_atribuido = operadoresAtribuidosOrdenados;

	// Ordenar operadores que realmente resolveram por quantidade de tickets (decrescente)
	const operadoresResolveuOrdenados = Object.entries(
		dados.tickets_por_operador_resolveu,
	)
		.sort(([, a], [, b]) => b - a)
		.reduce((result, [operador, count]) => {
			result[operador] = count;
			return result;
		}, {});
	dados.tickets_por_operador_resolveu = operadoresResolveuOrdenados;

	// Calcular percentual de reatribuições
	dados.reatribuicoes.percentual =
		dados.total_tickets > 0
			? ((dados.reatribuicoes.total / dados.total_tickets) * 100).toFixed(1) +
			  '%'
			: '0%';

	// Manter compatibilidade com versão anterior
	dados.tickets_por_operador = operadoresResolveuOrdenados;

	// Ordenar tickets por data de abertura (mais recente primeiro)
	dados.tickets.sort((a, b) => {
		if (!a.data_abertura) return 1;
		if (!b.data_abertura) return -1;
		return new Date(b.data_abertura) - new Date(a.data_abertura);
	});
});

// Ordenar setores por quantidade de tickets (decrescente)
const setoresOrdenados = Object.keys(setoresSummary)
	.sort(
		(a, b) => setoresSummary[b].total_tickets - setoresSummary[a].total_tickets,
	)
	.reduce((result, setor) => {
		result[setor] = setoresSummary[setor];
		return result;
	}, {});

// Criar resumo geral de operadores (quem realmente resolveu)
const operadoresSummary = {};
const operadoresAtribuidosSummary = {};

Object.values(setoresOrdenados).forEach((setor) => {
	// Resumo por quem resolveu
	Object.entries(setor.tickets_por_operador_resolveu).forEach(
		([operador, count]) => {
			if (!operadoresSummary[operador]) {
				operadoresSummary[operador] = {
					total_tickets: 0,
					setores_atendidos: new Set(),
				};
			}
			operadoresSummary[operador].total_tickets += count;
			operadoresSummary[operador].setores_atendidos.add(setor.setor);
		},
	);

	// Resumo por quem foi atribuído
	Object.entries(setor.tickets_por_operador_atribuido).forEach(
		([operador, count]) => {
			if (!operadoresAtribuidosSummary[operador]) {
				operadoresAtribuidosSummary[operador] = {
					total_tickets_atribuidos: 0,
					setores_atribuidos: new Set(),
				};
			}
			operadoresAtribuidosSummary[operador].total_tickets_atribuidos += count;
			operadoresAtribuidosSummary[operador].setores_atribuidos.add(setor.setor);
		},
	);
});

// Converter Set para Array e ordenar operadores
const operadoresGeral = Object.entries(operadoresSummary)
	.map(([nome, dados]) => ({
		nome,
		total_tickets_resolvidos: dados.total_tickets,
		setores_atendidos: Array.from(dados.setores_atendidos).sort(),
		quantidade_setores: dados.setores_atendidos.size,
		total_tickets_atribuidos:
			operadoresAtribuidosSummary[nome]?.total_tickets_atribuidos || 0,
		eficiencia:
			dados.total_tickets > 0 &&
			operadoresAtribuidosSummary[nome]?.total_tickets_atribuidos > 0
				? (
						(dados.total_tickets /
							operadoresAtribuidosSummary[nome].total_tickets_atribuidos) *
						100
				  ).toFixed(1) + '%'
				: 'N/A',
	}))
	.sort((a, b) => b.total_tickets_resolvidos - a.total_tickets_resolvidos);

// Calcular estatísticas gerais de reatribuição
let totalReatribuicoes = 0;
let totalTicketsComReatribuicao = 0;

Object.values(setoresOrdenados).forEach((setor) => {
	totalReatribuicoes += setor.reatribuicoes.total;
	totalTicketsComReatribuicao += setor.total_tickets;
});

const percentualReatribuicaoGeral =
	totalTicketsComReatribuicao > 0
		? ((totalReatribuicoes / totalTicketsComReatribuicao) * 100).toFixed(1) +
		  '%'
		: '0%';

// Encontrar período de análise
let ticketMaisAntigo = null;
let ticketMaisRecente = null;

Object.values(setoresOrdenados).forEach((setor) => {
	setor.tickets.forEach((ticket) => {
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
});

// Criar resultado final limpo e agrupado
const results = {
	resumo_geral: {
		total_tickets: totalTicketsProcessados,
		total_setores: Object.keys(setoresOrdenados).length,
		total_operadores: operadoresGeral.length,
		total_reatribuicoes: totalReatribuicoes,
		percentual_reatribuicoes: percentualReatribuicaoGeral,
		data_processamento: new Date().toISOString(),
		periodo_analise: {
			ticket_mais_antigo: ticketMaisAntigo
				? ticketMaisAntigo.toISOString().split('T')[0]
				: '',
			ticket_mais_recente: ticketMaisRecente
				? ticketMaisRecente.toISOString().split('T')[0]
				: '',
		},
		metricas_aprimoradas: {
			campos_incluidos: [
				'tecnico_atribuido',
				'tecnico_resolveu',
				'tecnico_fechou',
				'ultima_atualizacao_por',
				'prioridade',
				'urgencia',
				'tipo',
				'satisfacao',
				'sla',
				'impacto',
			],
			confiabilidade_dados:
				'Alta - baseado em múltiplos campos de rastreamento',
		},
	},
	operadores_resumo: operadoresGeral,
	analise_reatribuicoes: {
		total_casos: totalReatribuicoes,
		percentual_geral: percentualReatribuicaoGeral,
		setores_com_mais_reatribuicoes: Object.entries(setoresOrdenados)
			.filter(([, dados]) => dados.reatribuicoes.total > 0)
			.sort(([, a], [, b]) => b.reatribuicoes.total - a.reatribuicoes.total)
			.slice(0, 5)
			.map(([setor, dados]) => ({
				setor,
				total_reatribuicoes: dados.reatribuicoes.total,
				percentual: dados.reatribuicoes.percentual,
			})),
	},
	setores: setoresOrdenados,
};

console.log(
	`✅ Processamento APRIMORADO concluído: ${totalTicketsProcessados} tickets agrupados em ${
		Object.keys(setoresOrdenados).length
	} setores por ${operadoresGeral.length} operadores`,
);

console.log(
	`📊 Estatísticas de Reatribuição: ${totalReatribuicoes} casos (${percentualReatribuicaoGeral})`,
);
console.log(
	`🎯 Dados incluem rastreamento completo: atribuído vs resolvido vs fechado`,
);

// Retornar resultados baseado no ambiente
if (isLocalEnvironment) {
	// Ambiente local - salvar arquivo e retornar via module.exports
	const fs = require('fs');
	const path = require('path');

	try {
		const outputPath = path.join(__dirname, 'glpi_report_by_sector.json');
		fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
		console.log(`📄 Relatório salvo em: ${outputPath}`);
		// Mostrar estatísticas aprimoradas
		console.log('\n📊 Estatísticas Gerais:');
		console.log(`   • Total de tickets: ${results.resumo_geral.total_tickets}`);
		console.log(`   • Total de setores: ${results.resumo_geral.total_setores}`);
		console.log(
			`   • Total de operadores: ${results.resumo_geral.total_operadores}`,
		);
		console.log(
			`   • Reatribuições: ${results.resumo_geral.total_reatribuicoes} (${results.resumo_geral.percentual_reatribuicoes})`,
		);

		console.log('\n🏢 Top 3 setores por volume:');
		Object.entries(results.setores)
			.slice(0, 3)
			.forEach(([setor, dados], index) => {
				console.log(
					`   ${index + 1}. ${setor}: ${dados.total_tickets} tickets (${
						dados.reatribuicoes.percentual
					} reatribuições)`,
				);
			});

		console.log('\n👨‍💻 Top 3 operadores (por resolução real):');
		results.operadores_resumo.slice(0, 3).forEach((operador, index) => {
			console.log(
				`   ${index + 1}. ${operador.nome}: ${
					operador.total_tickets_resolvidos
				} resolvidos/${operador.total_tickets_atribuidos} atribuídos (${
					operador.eficiencia
				} eficiência)`,
			);
		});

		if (
			results.analise_reatribuicoes.setores_com_mais_reatribuicoes.length > 0
		) {
			console.log('\n🔄 Setores com mais reatribuições:');
			results.analise_reatribuicoes.setores_com_mais_reatribuicoes
				.slice(0, 3)
				.forEach((item, index) => {
					console.log(
						`   ${index + 1}. ${item.setor}: ${
							item.total_reatribuicoes
						} casos (${item.percentual})`,
					);
				});
		}
	} catch (error) {
		console.error('Erro ao salvar arquivo:', error.message);
	}

	// Para ambiente local/Node.js
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = { results };
	}

	return { results };
} else {
	// Ambiente n8n - retornar diretamente os resultados agrupados
	return [{ json: results }];
}

// Detectar ambiente e carregar dados
let inputData;
let isLocalEnvironment = false;

// Verificar se estamos no n8n ou ambiente local
if (typeof $input !== 'undefined' && $input && $input.all) {
	// Ambiente n8n
	console.log('Ambiente n8n detectado');
	inputData = $input.all();
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

// Processar dados GLPI
const results = [];

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
dataToProcess.forEach((item, itemIndex) => {
	try {
		// Se o item contém apenas metadados (totalcount, count, etc), registrar informações
		if (item.totalcount !== undefined || item.count !== undefined) {
			// Se não tem tickets (count = 0), apenas registrar metadados
			if (!item.data || !Array.isArray(item.data) || item.data.length === 0) {
				results.push({
					json: {
						tipo: 'metadados_setor',
						item_index: itemIndex,
						totalcount: item.totalcount || 0,
						count: item.count || 0,
						content_range: item['content-range'] || '',
						sort: item.sort || [],
						order: item.order || [],
						processado_em: new Date().toISOString(),
					},
				});
				return;
			}

			// Se tem tickets, processar cada um
			const setorInfo = {
				tipo: 'conjunto_tickets',
				item_index: itemIndex,
				totalcount: item.totalcount || 0,
				count: item.count || 0,
				content_range: item['content-range'] || '',
				total_tickets: item.data.length,
			};

			const ticketsProcessados = [];
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
					}

					// Extrair dados básicos
					const ticketData = {
						// Informações de localização
						item_index: itemIndex,
						ticket_index: ticketIndex,

						// Dados diretos dos campos do ticket
						ticket_id: ticket['2'] || '',
						titulo: stripHtml(decodeHtml(ticket['1'] || '')),
						categoria: stripHtml(decodeHtml(ticket['7'] || '')),
						grupo_atendimento: Array.isArray(ticket['8'])
							? ticket['8'].join(', ')
							: ticket['8'] || '',
						setor_responsavel: stripHtml(decodeHtml(ticket['71'] || '')),
						status_id: ticket['12'] || '',
						status_texto: getStatusText(ticket['12']),
						tecnico_responsavel: stripHtml(
							decodeHtml(ticket['5'] || ticket['81'] || ''),
						),
						data_abertura: ticket['15'] || '',
						data_fechamento: ticket['16'] || null,
						duracao: calcularDuracao(ticket['15'], ticket['16']),

						dados_extraidos: {},
					};

					// Processar conteúdo HTML se existir
					if (ticket['21']) {
						const htmlContent = decodeHtml(ticket['21']);

						// Extrair dados específicos do formulário
						const dados = {
							opcao_abertura: stripHtml(
								extractBetween(
									htmlContent,
									'1) Opção para abertura do chamado',
									'</div>',
								),
							),

							motivo_servico: stripHtml(
								extractBetween(
									htmlContent,
									'2) Indique o motivo/serviço',
									'</div>',
								) ||
									extractBetween(
										htmlContent,
										'2) Indique o setor atendente',
										'</div>',
									),
							),

							descricao: stripHtml(
								extractBetween(htmlContent, '3) Descrição', '</div>')
									.replace(/<p[^>]*>/g, '')
									.replace(/<\/p>/g, ' '),
							),

							chamado_offline: stripHtml(
								extractBetween(htmlContent, 'Chamado OFFLINE', '</div>') ||
									extractBetween(htmlContent, '4) Chamado OFFLINE', '</div>'),
							),

							urgencia: stripHtml(
								extractBetween(htmlContent, 'Urgência', '</div>'),
							),

							motivo_urgencia: stripHtml(
								extractBetween(htmlContent, 'Motivo da urgência', '</div>') ||
									extractBetween(
										htmlContent,
										'6) Motivo da urgência',
										'</div>',
									),
							),

							visibilidade: stripHtml(
								extractBetween(htmlContent, 'Visibilidade', '</div>'),
							),

							forma_contato: stripHtml(
								extractBetween(htmlContent, 'Forma de Contato', '</div>'),
							),

							telefone_ramal: stripHtml(
								extractBetween(htmlContent, 'Telefone/Ramal', '</div>'),
							),

							observacao_contato: stripHtml(
								extractBetween(htmlContent, 'Observação de contato', '</div>'),
							),

							anexos: stripHtml(
								extractBetween(htmlContent, 'Arquivo(s)', '</div>'),
							),
						};

						// LIMPEZA FINAL - remover campos vazios e aplicar decodificação final
						Object.keys(dados).forEach((key) => {
							if (dados[key]) {
								// Aplicar decodificação final e limpeza
								dados[key] = decodeHtml(dados[key])
									.replace(/^:\s*/, '') // Removes leading colon
									.replace(/\s+/g, ' ') // Normalize spaces
									.trim();

								// Se ficou vazio após limpeza, definir como string vazia
								if (dados[key] === '' || dados[key] === ':') {
									dados[key] = '';
								}
							} else {
								dados[key] = '';
							}
						});

						ticketData.dados_extraidos = dados;
					}

					// Adicionar metadados
					ticketData.processado_em = new Date().toISOString();

					ticketsProcessados.push(ticketData);
				} catch (error) {
					// Em caso de erro, adicionar ticket básico
					ticketsProcessados.push({
						item_index: itemIndex,
						ticket_index: ticketIndex,
						ticket_id: ticket['2'] || '',
						titulo: ticket['1'] || '',
						erro: error.message,
						processado_em: new Date().toISOString(),
					});
				}
			});

			// Adicionar resultado do conjunto de tickets
			results.push({
				json: {
					...setorInfo,
					tickets: ticketsProcessados,
					processado_em: new Date().toISOString(),
				},
			});
		}
	} catch (error) {
		// Em caso de erro no item
		results.push({
			json: {
				item_index: itemIndex,
				erro: `Erro ao processar item: ${error.message}`,
				processado_em: new Date().toISOString(),
			},
		});
	}
});

// Retornar resultados baseado no ambiente
if (isLocalEnvironment) {
	// Ambiente local - salvar arquivo e retornar via module.exports
	const fs = require('fs');
	const path = require('path');

	try {
		const outputPath = path.join(__dirname, 'analysis_result.json');
		fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
		console.log(`Resultados salvos em: ${outputPath}`);
		console.log(`Total de itens processados: ${results.length}`);
	} catch (error) {
		console.error('Erro ao salvar arquivo:', error.message);
	}

	// Para ambiente local/Node.js
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = { results };
	}

	return { results };
} else {
	// Ambiente n8n - retornar diretamente os resultados
	console.log(`Total de itens processados para n8n: ${results.length}`);
	return results;
}

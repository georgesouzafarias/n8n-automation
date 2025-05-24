// Verifica se é ambiente local ou n8n
const isLocalRun =
	typeof module !== 'undefined' && module.exports && require.main === module;

// Função para verificar se um valor existe
function exists(value) {
	return value !== null && value !== undefined && value !== '';
}

// Função para verificar se o título contém palavras-chave típicas de épicos
function determineEpicStatus(subIssuesSummary) {
	if (!subIssuesSummary || subIssuesSummary.total === 0) {
		return 'Not Started';
	}

	if (subIssuesSummary.percentCompleted === 100) {
		return 'Completed';
	} else if (subIssuesSummary.percentCompleted > 0) {
		return 'In Progress';
	}

	return 'Not Started';
}

// Função para identificar se uma issue é um épico
function isEpic(issue) {
	const issueTitle = issue.title || '';

	// Debug: exibir os campos disponíveis no issue
	console.log(`\nVerificando issue #${issue.number}: ${issueTitle}`);

	// Vamos criar um conjunto de critérios para identificar épicos
	let isEpicByType = false;
	let isEpicByLabel = false;
	let extractedIssueType = null;
	
	// Verificar se a issue tem um tipo explícito no campo issueType
	if (issue.issueType && issue.issueType.name) {
		console.log(`  Issue tem tipo explícito: ${issue.issueType.name}`);
		extractedIssueType = issue.issueType.name;
		
		// Verificar se o tipo é Epic/Épico
		if (issue.issueType.name.toLowerCase() === 'epic' || 
		    issue.issueType.name.toLowerCase() === 'épico') {
			isEpicByType = true;
			console.log(`  ✓ Issue confirmada como Épico pelo tipo: ${issue.issueType.name}`);
		} else {
			console.log(`  ✗ Issue não é Épico (tipo: ${issue.issueType.name})`);
			// Se o tipo está explicitamente definido como algo diferente de Epic, não é um épico
			return { isEpic: false, issueType: extractedIssueType };
		}
	}
	
	// Verificação pelo tipo (se disponível nos campos)
	if (!isEpicByType && issue.fieldValues && issue.fieldValues.nodes) {
		const epicTypeField = issue.fieldValues.nodes.find(
			(fieldValue) =>
				fieldValue.field &&
				(fieldValue.field.name === 'Type' ||
					fieldValue.field.name === 'Issue Type' ||
					fieldValue.field.name === 'Kind') &&
				fieldValue.name &&
				(fieldValue.name.toLowerCase() === 'epic' ||
					fieldValue.name.toLowerCase() === 'épico'),
		);

		if (epicTypeField) {
			isEpicByType = true;
			extractedIssueType = epicTypeField.name;
			console.log(`  ✓ Issue tem tipo Épico via campo: ${epicTypeField.name}`);
		}
	}
	
	// Verifica se a issue tem labels que indicam explicitamente que é um épico
	if (issue.labels && issue.labels.nodes) {
		const epicLabels = issue.labels.nodes.filter(
			(label) =>
				label.name &&
				(label.name.toLowerCase() === 'epic' ||
				 label.name.toLowerCase() === 'épico' ||
				 label.name.toLowerCase() === 'epic-issue')
		);
		
		if (epicLabels.length > 0) {
			isEpicByLabel = true;
			console.log(`  ✓ Issue tem label de épico: ${epicLabels.map(l => l.name).join(', ')}`);
			if (!extractedIssueType) {
				extractedIssueType = 'Épico'; // Se não temos tipo explícito, mas temos uma label de épico
			}
		}
	}

	// Critérios para decisão final:
	// 1. Se tem tipo explícito de épico, é épico
	// 2. Se tem label explícita de épico, é épico

	const isAnEpic = isEpicByType || isEpicByLabel;

	if (isAnEpic) {
		console.log(`  ✓ Confirmado como épico: ${issue.title}`);
	} else {
		console.log(`  ✗ Não é épico: ${issue.title}`);
	}

	return { isEpic: isAnEpic, issueType: extractedIssueType };
}

// Função principal de processamento
function processEpicsData(items) {
	console.log(`Processando ${items.length} itens para análise de épicos...`);

	if (items.length > 0) {
		console.log(
			'Estrutura do primeiro item:',
			JSON.stringify(items[0], null, 2),
		);
	}

	const epicsByStatus = {};
	const epicsDetails = [];
	let totalEpics = 0;
	let itemsProcessed = 0;
	let itemsSkipped = 0;

	// Processar cada item
	items.forEach((item, index) => {
		itemsProcessed++;

		// Pula itens sem conteúdo
		if (!exists(item)) {
			console.log(`Item ${index} é null/undefined`);
			itemsSkipped++;
			return;
		}

		if (!exists(item.content)) {
			console.log(`Item ${index} não tem content:`, Object.keys(item));
			itemsSkipped++;
			return;
		}

		const issue = item.content;

		// Verifica se é um épico (agora retorna um objeto com isEpic e issueType)
		const epicResult = isEpic(issue);
		console.log(
			`Item ${index} (${issue.title || 'sem título'}) é épico: ${epicResult.isEpic}`,
		);

		if (!epicResult.isEpic) {
			itemsSkipped++;
			return;
		}

		totalEpics++;
		console.log(`Épico encontrado: ${issue.title}`);

		// Obter informações do status do projeto
		let projectStatus = 'No Status';
		let priority = 'No Priority';
		let issueType = epicResult.issueType || 'No Type';  // Usar o tipo extraído da função isEpic

		// Debug log para verificar os campos disponíveis
		if (index === 0 && exists(item.fieldValues?.nodes)) {
			console.log('Campos disponíveis no primeiro item:');
			item.fieldValues.nodes.forEach((fieldValue) => {
				if (exists(fieldValue) && exists(fieldValue.field)) {
					console.log(
						`  Campo: ${fieldValue.field.name}, Valor: ${
							fieldValue.name ||
							fieldValue.title ||
							fieldValue.date ||
							'sem valor'
						}`,
					);
				}
			});
		}

		// Ainda verificar campos fieldValues para outros atributos como status e prioridade
		if (exists(item.fieldValues?.nodes)) {
			item.fieldValues.nodes.forEach((fieldValue) => {
				if (!exists(fieldValue) || !exists(fieldValue.field)) return;

				if (fieldValue.field.name === 'Status' && exists(fieldValue.name)) {
					projectStatus = fieldValue.name;
				}
				if (fieldValue.field.name === 'Priority' && exists(fieldValue.name)) {
					priority = fieldValue.name;
				}
				// Verificar campo de tipo apenas se ainda não temos um tipo da função isEpic
				if (
					issueType === 'No Type' &&
					(fieldValue.field.name === 'Type' ||
						fieldValue.field.name === 'Issue Type' ||
						fieldValue.field.name === 'Kind') &&
					exists(fieldValue.name)
				) {
					issueType = fieldValue.name;
					console.log(
						`Encontrado tipo "${issueType}" para issue: ${issue.title}`,
					);
				}
			});
		}

		// Verificar se a issue tem um tipo diretamente no conteúdo como última tentativa
		if (issue.type && issueType === 'No Type') {
			issueType = issue.type;
			console.log(`Tipo encontrado diretamente na issue: ${issueType}`);
		}

		// Atribuímos o tipo "Épico" apenas se a função isEpic determinou que é um épico
		// e não temos outro tipo
		if (epicResult.isEpic && issueType === 'No Type') {
			issueType = 'Épico';
			console.log(
				`Definindo tipo como Épico com base nos critérios rigorosos: ${issue.title}`,
			);
		}

		// Determinar status do épico baseado no progresso das sub-issues
		const epicStatus = determineEpicStatus(issue.subIssuesSummary);

		// Contabilizar por status
		epicsByStatus[epicStatus] = (epicsByStatus[epicStatus] || 0) + 1;

		// Criar detalhes do épico
		const epicDetail = {
			epicId: issue.number ? issue.number.toString() : item.id,
			epicTitle: issue.title || 'Sem título',
			epicUrl: issue.url || '#',
			status: epicStatus,
			projectStatus: projectStatus,
			priority: priority,
			issueType: issueType, // Agora issueType está sendo extraído corretamente do objeto issue.issueType
			completionRate: issue.subIssuesSummary
				? issue.subIssuesSummary.percentCompleted
				: 0,
			subIssuesTotal: issue.subIssuesSummary ? issue.subIssuesSummary.total : 0,
			subIssuesCompleted: issue.subIssuesSummary
				? issue.subIssuesSummary.completed
				: 0,
			subIssuesRemaining: issue.subIssuesSummary
				? issue.subIssuesSummary.total - issue.subIssuesSummary.completed
				: 0,
			assignees: issue.assignees?.nodes?.map((a) => a.login) || [],
			labels: issue.labels?.nodes?.map((l) => l.name) || [],
			updatedAt: issue.updatedAt || '',
			createdAt: issue.createdAt || '',
			// Descrição removida para reduzir tamanho dos dados no n8n
		};

		epicsDetails.push(epicDetail);
	});

	console.log(`\nResumo do processamento:`);
	console.log(`- Items processados: ${itemsProcessed}`);
	console.log(`- Items ignorados: ${itemsSkipped}`);
	console.log(`- Épicos encontrados: ${totalEpics}`);

	// Ordenar épicos por taxa de conclusão (decrescente) e depois por data de atualização
	epicsDetails.sort((a, b) => {
		if (b.completionRate !== a.completionRate) {
			return b.completionRate - a.completionRate;
		}
		return new Date(b.updatedAt) - new Date(a.updatedAt);
	});

	// Calcular estatísticas adicionais
	const averageCompletion =
		totalEpics > 0
			? epicsDetails.reduce((sum, epic) => sum + epic.completionRate, 0) /
			  totalEpics
			: 0;

	const totalSubIssues = epicsDetails.reduce(
		(sum, epic) => sum + epic.subIssuesTotal,
		0,
	);
	const completedSubIssues = epicsDetails.reduce(
		(sum, epic) => sum + epic.subIssuesCompleted,
		0,
	);

	// Criar resumo final
	const summary = {
		projectTitle: 'Epic Status Report',
		totalEpics: totalEpics,
		epicsProgress: epicsByStatus,
		epicsDetails: epicsDetails,
		statistics: {
			averageCompletionRate: Math.round(averageCompletion * 100) / 100,
			totalSubIssues: totalSubIssues,
			completedSubIssues: completedSubIssues,
			overallProgress:
				totalSubIssues > 0
					? Math.round((completedSubIssues / totalSubIssues) * 100)
					: 0,
		},
		date: new Date().toISOString(),
		generatedAt: new Date().toLocaleString('pt-BR', {
			timeZone: 'America/Sao_Paulo',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		}),
	};

	return summary;
}

// Execução principal
try {
	let data;

	if (isLocalRun) {
		const fs = require('fs');
		// Ambiente local - ler do arquivo data.json
		console.log('Executando em ambiente local...');

		if (!fs.existsSync('data.json')) {
			console.error('Erro: Arquivo data.json não encontrado!');
			console.log(
				'Execute o script github-query.sh primeiro para obter os dados.',
			);
			process.exit(1);
		}

		const rawData = fs.readFileSync('data.json', 'utf8');
		const jsonData = JSON.parse(rawData);

		// Verificar estrutura dos dados
		if (jsonData.data?.organization?.projectV2?.items?.nodes) {
			data = jsonData.data.organization.projectV2.items.nodes;
		} else if (Array.isArray(jsonData)) {
			data = jsonData;
		} else {
			throw new Error('Estrutura de dados inválida no arquivo data.json');
		}
	} else {
		// Ambiente n8n - usar dados de entrada
		const inputData = $input.all();

		console.log(`Recebidos ${inputData.length} itens de entrada no n8n`);
		console.log(
			'Primeiro item recebido:',
			JSON.stringify(inputData[0]?.json, null, 2),
		);

		if (!inputData || inputData.length === 0) {
			throw new Error('Nenhum dado de entrada fornecido');
		}

		// Combinar dados de múltiplas páginas se necessário
		data = [];
		inputData.forEach((item, index) => {
			console.log(
				`Processando item ${index + 1}:`,
				Object.keys(item.json || {}),
			);

			if (item.json) {
				if (Array.isArray(item.json)) {
					console.log(
						`Item ${index + 1} é array com ${item.json.length} elementos`,
					);
					data = data.concat(item.json);
				} else if (item.json.data?.organization?.projectV2?.items?.nodes) {
					const nodes = item.json.data.organization.projectV2.items.nodes;
					console.log(
						`Item ${index + 1} tem ${nodes.length} nodes na estrutura padrão`,
					);
					data = data.concat(nodes);
				} else if (item.json.projectTitle) {
					// Se já está processado (vindo de outro node), usar diretamente
					console.log(`Item ${index + 1} parece já processado`);
					data.push(item.json);
				} else {
					console.log(
						`Item ${
							index + 1
						} estrutura não reconhecida, adicionando como está`,
					);
					data.push(item.json);
				}
			}
		});

		console.log(`Total de dados para processamento: ${data.length}`);
		if (data.length > 0) {
			console.log('Primeiro item de dados:', JSON.stringify(data[0], null, 2));
		}
	}

	// Processar os dados
	const result = processEpicsData(data);

	if (isLocalRun) {
		// Salvar resultado em arquivo
		const fs = require('fs');
		fs.writeFileSync(
			'epics_analysis_result.json',
			JSON.stringify(result, null, 2),
		);
		console.log('\n=== RESUMO DOS ÉPICOS ===');
		console.log(`Total de Épicos: ${result.totalEpics}`);
		console.log(
			`Taxa Média de Conclusão: ${result.statistics.averageCompletionRate}%`,
		);
		console.log(`Progresso Geral: ${result.statistics.overallProgress}%`);
		console.log('\nProgresso por Status:');
		Object.entries(result.epicsProgress).forEach(([status, count]) => {
			console.log(`  ${status}: ${count} épicos`);
		});
		console.log('\nResultado salvo em epics_analysis_result.json');

		// Exportar para n8n
		module.exports = { json: result };
	} else {
		// Retornar para n8n
		return { json: result };
	}
} catch (error) {
	console.error('Erro no processamento:', error.message);

	const errorResult = {
		error: true,
		message: `Erro ao processar dados dos épicos: ${error.message}`,
		timestamp: new Date().toISOString(),
	};

	if (isLocalRun) {
		console.log(JSON.stringify(errorResult, null, 2));
		process.exit(1);
	} else {
		return { json: errorResult };
	}
}

// Verifica se é ambiente local ou n8n
const isLocalRun =
	typeof module !== 'undefined' && module.exports && require.main === module;

// Função para verificar se um valor existe
function exists(value) {
	return value !== null && value !== undefined && value !== '';
}

// Função para determinar o status do épico baseado no progresso
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
	// Verifica se a issue tem labels que indicam que é um épico
	if (issue.labels && issue.labels.nodes) {
		const hasEpicLabel = issue.labels.nodes.some(
			(label) =>
				label.name &&
				(label.name.toLowerCase() === 'epic' ||
					label.name.toLowerCase() === 'épico' ||
					label.name.toLowerCase().includes('epic')),
		);
		if (hasEpicLabel) {
			console.log(`  ✓ Épico por label: ${issue.title}`);
			return true;
		}
	}

	// Verifica se o título indica que é um épico
	if (issue.title) {
		const titleLower = issue.title.toLowerCase();
		if (
			titleLower.includes('[epic]') ||
			titleLower.includes('epic:') ||
			titleLower.startsWith('epic ')
		) {
			console.log(`  ✓ Épico por título: ${issue.title}`);
			return true;
		}
	}

	// Verifica se tem sub-issues (indicativo de épico)
	if (issue.subIssuesSummary && issue.subIssuesSummary.total > 0) {
		console.log(
			`  ✓ Épico por sub-issues (${issue.subIssuesSummary.total}): ${issue.title}`,
		);
		return true;
	}

	console.log(`  ✗ Não é épico: ${issue.title}`);
	return false;
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

		// Verifica se é um épico
		const isEpicResult = isEpic(issue);
		console.log(
			`Item ${index} (${issue.title || 'sem título'}) é épico: ${isEpicResult}`,
		);

		if (!isEpicResult) {
			itemsSkipped++;
			return;
		}

		totalEpics++;
		console.log(`Épico encontrado: ${issue.title}`);

		// ...existing code...

		// Obter informações do status do projeto
		let projectStatus = 'No Status';
		let priority = 'No Priority';

		if (exists(item.fieldValues?.nodes)) {
			item.fieldValues.nodes.forEach((fieldValue) => {
				if (!exists(fieldValue) || !exists(fieldValue.field)) return;

				if (fieldValue.field.name === 'Status' && exists(fieldValue.name)) {
					projectStatus = fieldValue.name;
				}
				if (fieldValue.field.name === 'Priority' && exists(fieldValue.name)) {
					priority = fieldValue.name;
				}
			});
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

// Função auxiliar para verificar se um valor existe
function exists(value) {
	return value !== null && value !== undefined;
}

// Função auxiliar para calcular a data de término de uma sprint
function calculateEndDate(startDate, durationDays) {
	if (!startDate || !durationDays) return null;

	const date = new Date(startDate);
	date.setDate(date.getDate() + parseInt(durationDays) - 1); // Subtrair 1 porque a data de início já conta como dia 1
	return date.toISOString().split('T')[0]; // Retorna apenas a parte da data (YYYY-MM-DD)
}

// Função para calcular a idade da issue em dias
function calculateIssueDuration(createdAt, updatedAt) {
	if (!createdAt || !updatedAt) return 0;

	const created = new Date(createdAt);
	const updated = new Date(updatedAt);
	const durationMs = updated - created;

	// Converte para dias
	return Math.floor(durationMs / (1000 * 60 * 60 * 24));
}

let projectData,
	items = [];

// Verifica se estamos em ambiente local
if (typeof $input === 'undefined') {
	console.log('Ambiente local detectado, carregando data.json');
	const fs = require('fs');
	let localData = JSON.parse(fs.readFileSync('./data.json', 'utf8'));

	$input = {
		item: { json: localData },
	};
	console.log('Arquivo data.json carregado com sucesso');
}

try {
	projectData = $input.item.json.data.organization.projectV2;
	items = projectData.items.nodes;
} catch (error) {
	return {
		json: {
			error: true,
			message: `Erro ao processar dados: ${error.message}`,
			inputStructure: JSON.stringify($input).substring(0, 500) + '...',
		},
	};
}

// Inicializa contadores
const statusCounts = {};
const priorityCounts = {};
const assigneeCounts = {}; // Número de issues por usuário
const assigneeBugCounts = {}; // Número de bugs por usuário
const assigneeEstimates = {}; // Total de pontos por usuário
const assigneeStatusCounts = {}; // Contagem de issues por status por usuário
const assigneeDetails = {}; // Detalhes detalhados por usuário
const issuesByStatus = {};
const bugsByStatus = {}; // Bugs organizados por status
const bugsByPriority = {}; // Bugs organizados por prioridade
const sprintCounts = {};
const issueTypeCounts = {}; // Para contar os tipos de issues (bugs, etc.)
const estimateTotals = {}; // Para armazenar o total de pontos por status
const bugResolutionTimes = []; // Armazena tempos de resolução de bugs
let totalEstimatePoints = 0; // Total de pontos em todas as issues
let deliveredPoints = 0; // Total de pontos em issues fechadas
let pendingPoints = 0; // Total de pontos em issues ainda não fechadas
let bugCount = 0; // Contador específico para bugs
let pendingBugCount = 0; // Contador para bugs pendentes
let deliveredBugCount = 0; // Contador para bugs fechados
let bugPoints = 0; // Total de pontos em bugs
let deliveredBugPoints = 0; // Pontos em bugs fechados
let pendingBugPoints = 0; // Pontos em bugs pendentes

// Armazena informações sobre sprints
const sprintInfo = {};
let currentSprint = null;
let currentSprintId = null;
// Primeira passagem: Identifica a sprint atual
// Precisamos fazer isso primeiro para depois filtrar apenas issues da sprint atual
items.forEach((item) => {
	if (!exists(item) || !exists(item.fieldValues?.nodes)) return;

	item.fieldValues.nodes.forEach((fieldValue) => {
		if (
			!exists(fieldValue) ||
			!exists(fieldValue.field) ||
			fieldValue.field.name !== 'Sprint' ||
			!exists(fieldValue.title)
		)
			return;

		const sprint = fieldValue.title;
		const sprintId = fieldValue.iterationId;
		const sprintStartDate = fieldValue.startDate;
		const sprintDuration = fieldValue.duration;

		// Armazena informações da sprint
		if (!sprintInfo[sprintId]) {
			sprintInfo[sprintId] = {
				title: sprint,
				startDate: sprintStartDate,
				duration: sprintDuration,
				endDate: calculateEndDate(sprintStartDate, sprintDuration),
			};
		}

		// Determina a sprint atual com base na data
		const today = new Date();
		const sprintStart = new Date(sprintStartDate);
		const sprintEnd = new Date(
			calculateEndDate(sprintStartDate, sprintDuration),
		);

		if (today >= sprintStart && today <= sprintEnd) {
			currentSprint = sprintInfo[sprintId];
			currentSprintId = sprintId;
		}
	});
});

// Se não encontrou nenhuma sprint atual, usa a data atual para avisar
if (!currentSprint) {
	console.log('Nenhuma sprint ativa no momento. Processando todos os itens.');
} else {
	console.log(
		`Sprint atual identificada: ${currentSprint.title} (${currentSprint.startDate} a ${currentSprint.endDate})`,
	);
}

// Filtra apenas itens da sprint atual (se uma for encontrada)
const currentSprintItems = currentSprintId
	? items.filter((item) => {
			if (!exists(item) || !exists(item.fieldValues?.nodes)) return false;

			// Verifica se o item pertence à sprint atual
			return item.fieldValues.nodes.some(
				(fieldValue) =>
					exists(fieldValue) &&
					exists(fieldValue.field) &&
					fieldValue.field.name === 'Sprint' &&
					exists(fieldValue.iterationId) &&
					fieldValue.iterationId === currentSprintId,
			);
	  })
	: items; // Se não houver sprint atual, usa todos os itens

// Log de informações de filtragem
if (currentSprintId) {
	if (currentSprintItems.length === 0) {
		console.log(
			`Alerta: Não foram encontradas issues na sprint atual (${currentSprint.title})`,
		);
	} else {
		console.log(
			`Filtrando apenas itens da sprint atual: ${
				currentSprintItems.length
			} de ${items.length} itens (${Math.round(
				(currentSprintItems.length / items.length) * 100,
			)}%)`,
		);
	}
} else {
	console.log(
		`Processando todos os ${items.length} itens, sem filtro de sprint.`,
	);
}

// Processa cada item da sprint atual
currentSprintItems.forEach((item) => {
	// Pula itens sem conteúdo
	if (!exists(item) || !exists(item.content)) return;

	const issue = item.content;

	// Verifica se há um tipo de issue diretamente no objeto content
	if (exists(issue.issueType) && exists(issue.issueType.name)) {
		const contentIssueType = issue.issueType.name;

		// Atualiza o contador de bugs
		if (contentIssueType.toLowerCase().includes('bug')) {
			bugCount++;
		}
		
		// O tipo de issue será contabilizado mais tarde
	}

	// Valores padrão
	let status = 'No Status';
	let priority = 'No Priority';
	let sprint = 'No Sprint';
	let issueType = 'No Type'; // Valor padrão para tipo de issue
	let sprintId = null;
	let sprintStartDate = null;
	let sprintDuration = null;
	let estimate = 0; // Valor padrão para estimativa/pontos

	// Tenta encontrar status e prioridade
	if (exists(item.fieldValues?.nodes)) {
		item.fieldValues.nodes.forEach((fieldValue) => {
			if (!exists(fieldValue) || !exists(fieldValue.field)) return;

			if (fieldValue.field.name === 'Status' && exists(fieldValue.name)) {
				status = fieldValue.name;
			}
			if (fieldValue.field.name === 'Priority' && exists(fieldValue.name)) {
				priority = fieldValue.name;
			}
			// Captura o tipo de issue (Bug, etc.) - verificando nos campos personalizados
			if (fieldValue.field.name === 'Type' && exists(fieldValue.name)) {
				issueType = fieldValue.name;

				// Incrementa o contador de bugs se o tipo for Bug
				if (issueType.toLowerCase().includes('bug')) {
					bugCount++;
				}
			}
			// Captura o valor de estimativa/pontos
			if (fieldValue.field.name === 'Estimate' && exists(fieldValue.number)) {
				estimate = parseFloat(fieldValue.number) || 0;
			}
			// Captura informações da sprint
			if (fieldValue.field.name === 'Sprint' && exists(fieldValue.title)) {
				sprint = fieldValue.title;
				sprintId = fieldValue.iterationId;
				sprintStartDate = fieldValue.startDate;
				sprintDuration = fieldValue.duration;

				// Armazena informações da sprint para uso posterior
				if (!sprintInfo[sprintId]) {
					sprintInfo[sprintId] = {
						title: sprint,
						startDate: sprintStartDate,
						duration: sprintDuration,
						endDate: calculateEndDate(sprintStartDate, sprintDuration),
					};
				}

				// Determina a sprint atual com base na data
				const today = new Date();
				const sprintStart = new Date(sprintStartDate);
				const sprintEnd = new Date(
					calculateEndDate(sprintStartDate, sprintDuration),
				);

				if (today >= sprintStart && today <= sprintEnd) {
					currentSprint = sprintInfo[sprintId];
					currentSprintId = sprintId;
				}
			}
		});
	}

	// Conta por status
	statusCounts[status] = (statusCounts[status] || 0) + 1;

	// Acumula pontos de estimativa por status
	if (!estimateTotals[status]) {
		estimateTotals[status] = 0;
	}
	estimateTotals[status] += estimate;
	totalEstimatePoints += estimate;

	// Calcula pontos entregues vs. pontos pendentes
	// Determina se a issue é um bug
	const isBug =
		exists(issue.issueType) &&
		issue.issueType.name.toLowerCase().includes('bug');

	// Calcula pontos entregues vs. pontos pendentes
	if (issue.state === 'CLOSED') {
		deliveredPoints += estimate;

		// Se for um bug, incremente o contador de bugs entregues
		if (isBug) {
			deliveredBugCount++;
			deliveredBugPoints += estimate; // Adiciona aos pontos de bugs entregues
		}
	} else {
		pendingPoints += estimate;

		// Se for um bug, incremente o contador de bugs pendentes
		if (isBug) {
			pendingBugCount++;
			pendingBugPoints += estimate; // Adiciona aos pontos de bugs pendentes
		}
	}

	// Rastreia bugs por status
	if (isBug) {
		// Adiciona aos pontos totais de bugs
		bugPoints += estimate;

		// Adiciona aos pontos de bugs entregues ou pendentes
		if (issue.state === 'CLOSED') {
			deliveredBugPoints += estimate;

			// Calcula o tempo de resolução para bugs fechados
			const resolutionTime = calculateIssueDuration(
				issue.createdAt,
				issue.updatedAt,
			);

			// Armazena informações sobre tempo de resolução
			bugResolutionTimes.push({
				number: issue.number,
				title: issue.title,
				resolutionDays: resolutionTime,
				assignees: issue.assignees?.nodes?.map((a) => a.login) || [],
			});
		} else {
			pendingBugPoints += estimate;
		}

		// Organiza bugs por status
		if (!bugsByStatus[status]) {
			bugsByStatus[status] = [];
		}
		bugsByStatus[status].push({
			title: issue.title || 'Sem título',
			number: issue.number || 0,
			url: issue.url || '#',
			state: issue.state || 'UNKNOWN',
			assignees: issue.assignees?.nodes?.map((a) => a.login) || [],
			priority: priority,
			estimate: estimate,
		});

		// Organiza bugs por prioridade
		if (!bugsByPriority[priority]) {
			bugsByPriority[priority] = [];
		}
		bugsByPriority[priority].push({
			title: issue.title || 'Sem título',
			number: issue.number || 0,
			url: issue.url || '#',
			state: issue.state || 'UNKNOWN',
			assignees: issue.assignees?.nodes?.map((a) => a.login) || [],
			status: status,
			estimate: estimate,
		});
	}

	// Rastreia bugs por prioridade
	if (isBug) {
		if (!bugsByPriority[priority]) {
			bugsByPriority[priority] = [];
		}
		bugsByPriority[priority].push({
			title: issue.title || 'Sem título',
			number: issue.number || 0,
			url: issue.url || '#',
			state: issue.state || 'UNKNOWN',
			assignees: issue.assignees?.nodes?.map((a) => a.login) || [],
			estimate: estimate,
		});
	}

	// Conta por prioridade
	priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;

	// Conta por tipo de issue (usa o tipo do content ou o tipo de campo, se disponível)
	const actualIssueType = exists(issue.issueType) 
		? issue.issueType.name 
		: issueType;
	
	// Atualiza a contagem de tipos (apenas uma vez por issue)
	issueTypeCounts[actualIssueType] = 
		(issueTypeCounts[actualIssueType] || 0) + 1;

	// Conta por sprint
	if (sprint !== 'No Sprint') {
		sprintCounts[sprint] = (sprintCounts[sprint] || 0) + 1;
	}

	// Agrupa issues por status
	if (!issuesByStatus[status]) {
		issuesByStatus[status] = [];
	}

	// Adiciona a issue ao grupo correspondente
	issuesByStatus[status].push({
		title: issue.title || 'Sem título',
		number: issue.number || 0,
		url: issue.url || '#',
		state: issue.state || 'UNKNOWN',
		assignees: issue.assignees?.nodes?.map((a) => a.login) || [],
		labels: issue.labels?.nodes?.map((l) => l.name) || [],
		priority: priority,
		issueType: exists(issue.issueType) ? issue.issueType.name : issueType, // Prioriza o tipo do objeto content
		sprint: sprint,
		estimate: estimate, // Adicionando a pontuação/estimativa da issue
		sprintStartDate: sprintStartDate,
		sprintEndDate: sprintStartDate
			? calculateEndDate(sprintStartDate, sprintDuration)
			: null,
		updatedAt: issue.updatedAt || '',
		createdAt: issue.createdAt || '',
	});

	// Conta por responsável e soma estimativas por responsável
	if (exists(issue.assignees?.nodes)) {
		issue.assignees.nodes.forEach((assignee) => {
			if (assignee && assignee.login) {
				const login = assignee.login;

				// Conta o número de issues
				assigneeCounts[login] = (assigneeCounts[login] || 0) + 1;

				// Conta o número de bugs por usuário
				if (isBug) {
					assigneeBugCounts[login] = (assigneeBugCounts[login] || 0) + 1;
				}

				// Soma as estimativas por usuário
				if (!assigneeEstimates[login]) {
					assigneeEstimates[login] = {
						total: 0, // Total de pontos
						delivered: 0, // Pontos entregues (issues fechadas)
						pending: 0, // Pontos pendentes (issues abertas)
					};
				}

				// Calcula pontos entregues vs. pendentes por usuário
				if (issue.state === 'CLOSED') {
					assigneeEstimates[login].delivered += estimate;
				} else {
					assigneeEstimates[login].pending += estimate;
				}

				assigneeEstimates[login].total += estimate;

				// Contagem por status para cada usuário
				if (!assigneeStatusCounts[login]) {
					assigneeStatusCounts[login] = {};
				}
				assigneeStatusCounts[login][status] =
					(assigneeStatusCounts[login][status] || 0) + 1;

				// Detalhes avançados por usuário
				if (!assigneeDetails[login]) {
					assigneeDetails[login] = {
						issues: [],
						totalEstimate: 0,
						totalBugs: 0, // Total de bugs
						statusBreakdown: {},
						priorityBreakdown: {},
						typeBreakdown: {}, // Adicionando contagem por tipo de issue
					};
				}

				// Adiciona a issue aos detalhes do usuário
				assigneeDetails[login].issues.push({
					title: issue.title || 'Sem título',
					number: issue.number || 0,
					url: issue.url || '#',
					status: status,
					priority: priority,
					issueType: exists(issue.issueType) ? issue.issueType.name : issueType, // Prioriza o tipo do objeto content
					estimate: estimate,
				});

				// Atualiza estatísticas
				assigneeDetails[login].totalEstimate += estimate;

				// Incrementa o contador de bugs se a issue for um bug
				if (isBug) {
					assigneeDetails[login].totalBugs += 1;
				}
			}
		});
	}

	// Soma as estimativas totais
	if (exists(issue.estimate)) {
		totalEstimatePoints += parseFloat(issue.estimate);
	}

	// Soma as estimativas por status
	if (!estimateTotals[status]) {
		estimateTotals[status] = 0;
	}
	estimateTotals[status] += exists(issue.estimate)
		? parseFloat(issue.estimate)
		: 0;
});

// Cria o resumo
const summary = {
	projectTitle: projectData.title,
	totalIssues: currentSprintItems.length,
	statusCounts: statusCounts,
	priorityCounts: priorityCounts,
	issueTypeCounts: issueTypeCounts, // Contagem por tipo de issue
	bugCount: bugCount, // Contador específico para bugs
	assigneeCounts: assigneeCounts,
	assigneeBugCounts: assigneeBugCounts, // Número de bugs por usuário

	// Calcula a proporção de bugs por usuário (quanto maior, pior a qualidade)
	assigneeBugRatio: Object.keys(assigneeCounts).reduce((acc, login) => {
		const totalIssues = assigneeCounts[login] || 0;
		const totalBugs = assigneeBugCounts[login] || 0;
		acc[login] =
			totalIssues > 0 ? Math.round((totalBugs / totalIssues) * 100) : 0;
		return acc;
	}, {}),

	assigneeEstimates: assigneeEstimates, // Adicionando as estimativas por usuário
	assigneeStatusCounts: assigneeStatusCounts, // Contagem de issues por status por usuário
	//assigneeDetails: assigneeDetails, // Detalhes detalhados por usuário - menos informação
	//sprintCounts: sprintCounts, //remove to reduce the information size
	estimateTotals: estimateTotals,
	totalEstimatePoints: totalEstimatePoints,
	currentSprint: currentSprint,
	//issuesByStatus: issuesByStatus, //remove to reduce the information size
	date: new Date().toISOString(),

	// Contadores adicionais úteis
	openIssues: currentSprintItems.filter(
		(item) => item.content?.state === 'OPEN',
	).length,
	closedIssues: currentSprintItems.filter(
		(item) => item.content?.state === 'CLOSED',
	).length,

	// Metadados da filtragem
	filteredBySprint: Boolean(currentSprintId),
	totalUnfilteredIssues: items.length,

	// Estimativas
	totalEstimatePoints: totalEstimatePoints,
	estimateTotals: estimateTotals,

	// Estatísticas de entrega
	deliveredPoints: deliveredPoints, // Total de pontos já entregues (issues fechadas)
	pendingPoints: pendingPoints, // Total de pontos ainda não entregues
	pendingPercentage:
		totalEstimatePoints > 0
			? Math.round((pendingPoints / totalEstimatePoints) * 100)
			: 0, // Porcentagem pendente
	deliveredPercentage:
		totalEstimatePoints > 0
			? Math.round((deliveredPoints / totalEstimatePoints) * 100)
			: 0, // Porcentagem entregue

	// Estatísticas de bugs
	bugPercentage:
		currentSprintItems.length > 0
			? Math.round((bugCount / currentSprintItems.length) * 100)
			: 0, // Porcentagem de bugs em relação ao total de issues
	bugResolutionRate:
		bugCount > 0 ? Math.round((deliveredBugCount / bugCount) * 100) : 0, // Taxa de resolução de bugs (porcentagem de bugs fechados)
	//bugsByStatus: bugsByStatus, // Bugs organizados por status
	//bugsByPriority: bugsByPriority, // Bugs organizados por prioridade
	pendingBugCount: pendingBugCount, // Número de bugs pendentes
	deliveredBugCount: deliveredBugCount, // Número de bugs entregues
	assigneeBugCounts: assigneeBugCounts, // Número de bugs por usuário

	// Estatísticas de tempo de resolução de bugs
	// bugResolution: {
	// 	times: bugResolutionTimes,
	// 	averageResolutionDays:
	// 		bugResolutionTimes.length > 0
	// 			? Math.round(
	// 					bugResolutionTimes.reduce(
	// 						(sum, bug) => sum + bug.resolutionDays,
	// 						0,
	// 					) / bugResolutionTimes.length,
	// 			  )
	// 			: 0,
	// 	maxResolutionDays:
	// 		bugResolutionTimes.length > 0
	// 			? Math.max(...bugResolutionTimes.map((bug) => bug.resolutionDays))
	// 			: 0,
	// 	minResolutionDays:
	// 		bugResolutionTimes.length > 0
	// 			? Math.min(...bugResolutionTimes.map((bug) => bug.resolutionDays))
	// 			: 0,
	// },
};

// Suporta ambos os ambientes (local e n8n)
if (typeof module !== 'undefined' && module.exports) {
	const fs = require('fs');
	fs.writeFileSync('./analysis_result.json', JSON.stringify(summary, null, 2));
	console.log({ json: summary }); // Exibe no console para visualização
	module.exports = { json: summary }; // Exporta para importação por outros módulos
} else {
	return { json: summary }; // n8n
}

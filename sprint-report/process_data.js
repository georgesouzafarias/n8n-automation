'use strict';
const { exit } = require('process');

let projectData;
let $input;
let summarySprints = {};

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

function extractSprint(listSprints) {
	let targets = [];
	let sprints = [];

	for (let item of listSprints) {
		if (item.name === 'Sprint') {
			targets.push(item.configuration.iterations[0]);
			targets.push(item.configuration.completedIterations[0]);
			targets.push(item.configuration.completedIterations[1]);
			targets.push(item.configuration.completedIterations[2]);
		}
	}

	for (let sprint of targets) {
		const today = new Date();
		const endDate = calculateEndDate(sprint.startDate, sprint.duration);
		const sprintStart = new Date(sprint.startDate);
		const sprintEnd = new Date(endDate);

		if (today >= sprintStart && today <= sprintEnd) {
			let currentSprint = true;
			sprints.push({ ...sprint, endDate, currentSprint });
		} else {
			let currentSprint = false;
			sprints.push({ ...sprint, endDate, currentSprint });
		}
	}

	return sprints;
}

function extractIssues(listIssues) {
	let issuesFormated = [];

	listIssues.forEach((item) => {
		// Pula itens sem conteúdo
		if (!exists(item) || !exists(item.content)) return;

		let issueFormated = {
			title: item.content.title,
			number: item.content.number,
			state: item.content.state,
			issueType: item.content.issueType.name,
			updatedAt: new Date(item.content.updatedAt),
			createdAt: new Date(item.content.createdAt),
			assignees: item.content.assignees.nodes[0]?.login,
			labels: item.content.labels.nodes,
			status: 'No Status',
			priority: 'No Priority',
			estimate: 0,
			sprint: 'No Sprint',
		};

		const issueDetail = item.fieldValues?.nodes;

		issueDetail.forEach((issue) => {
			if (issue.field?.name === 'Status') {
				issueFormated.status = issue.name;
			} else if (issue.field?.name === 'Priority') {
				issueFormated.priority = issue.name;
			} else if (issue.field?.name === 'Estimate') {
				issueFormated.estimate = +issue.number;
			} else if (issue.field?.name === 'Sprint') {
				issueFormated.sprint = issue.title;
			}
		});

		issuesFormated.push(issueFormated);
	});

	return issuesFormated;
}

function agregateSprintIssues(listSprints, listIssues) {
	const sprintsAndIssues = listSprints.map((sprint) => {
		const issuesRelacionadas = listIssues.filter(
			(issue) => issue.sprint === sprint.title,
		);

		return {
			...sprint,
			issues: issuesRelacionadas,
		};
	});

	return sprintsAndIssues;
}

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
	summarySprints = agregateSprintIssues(
		extractSprint(projectData.fields.nodes),
		extractIssues(projectData.items.nodes),
	);
} catch (error) {
	return {
		json: {
			error: true,
			message: `Erro ao processar dados: ${error.message}`,
			inputStructure: JSON.stringify($input).substring(0, 500) + '...',
		},
	};
}

console.log(summarySprints);

//console.log(JSON.stringify(sprintsComIssues));

//console.log('sprintAgregation', listIssues);

// Processa cada item da sprint atual
// function processSprint(listSprint, listIssue) {
// 	listSprint.forEach(function (sprint) {
// 		const statusCounts = {};
// 		const priorityCounts = {};
// 		const assigneeCounts = {}; // Número de issues por usuário
// 		const assigneeBugCounts = {}; // Número de bugs por usuário
// 		const assigneeEstimates = {}; // Total de pontos por usuário
// 		const assigneeStatusCounts = {}; // Contagem de issues por status por usuário
// 		const assigneeDetails = {}; // Detalhes detalhados por usuário
// 		const issuesByStatus = {};
// 		const bugsByStatus = {}; // Bugs organizados por status
// 		const bugsByPriority = {}; // Bugs organizados por prioridade
// 		const sprintCounts = {};
// 		const issueTypeCounts = {}; // Para contar os tipos de issues (bugs, etc.)
// 		const estimateTotals = {}; // Para armazenar o total de pontos por status
// 		const bugResolutionTimes = []; // Armazena tempos de resolução de bugs
// 		let totalEstimatePoints = 0; // Total de pontos em todas as issues
// 		let deliveredPoints = 0; // Total de pontos em issues fechadas
// 		let pendingPoints = 0; // Total de pontos em issues ainda não fechadas
// 		let bugCount = 0; // Contador específico para bugs
// 		let pendingBugCount = 0; // Contador para bugs pendentes
// 		let deliveredBugCount = 0; // Contador para bugs fechados
// 		let bugPoints = 0; // Total de pontos em bugs
// 		let deliveredBugPoints = 0; // Pontos em bugs fechados
// 		let pendingBugPoints = 0; // Pontos em bugs pendentes

// 		listIssue.forEach((item) => {
// 			// Valores padrão
// 			let status = 'No Status';
// 			let priority = 'No Priority';
// 			//let sprint = 'No Sprint';
// 			let issueType = 'No Type';
// 			let estimate = 0;
// 			// Pula itens sem conteúdo
// 			if (!exists(item) || !exists(item.content)) return;

// 			const issue = item.content;
// 			const issueDetail = item.fieldValues?.nodes;

// 			issueDetail.forEach((issue) => {
// 				console.log(sprint);
// 				if (sprint.title === issue.title) {
// 					if (issue.field?.name === 'Status') {
// 						status = issue.name;
// 					} else if (issue.field?.name === 'Priority') {
// 						priority = issue.name;
// 					} else if (issue.field?.name === 'Type') {
// 						issueType = issue.name;
// 					} else if (issue.field?.name === 'Estimate') {
// 						estimate = +issue.number;
// 					} else if (issue.field?.name === 'Sprint') {
// 						sprint = issue.title;
// 					}
// 					//console.log(status, priority, sprint, issueType, estimate);
// 				}
// 			});
// 		});
// 	});
// }

//processSprint(listSprint, listIssue);

// 				// Incrementa o contador de bugs se o tipo for Bug
// 				if (issueType.toLowerCase().includes('bug')) {
// 					bugCount++;
// 				}
// 			}
// 			// Captura o valor de estimativa/pontos
// 			if (fieldValue.field.name === 'Estimate' && exists(fieldValue.number)) {
// 				estimate = parseFloat(fieldValue.number) || 0;
// 			}
// 			// Captura informações da sprint
// 			if (fieldValue.field.name === 'Sprint' && exists(fieldValue.title)) {
// 				sprint = fieldValue.title;
// 				sprintId = fieldValue.iterationId;
// 				sprintStartDate = fieldValue.startDate;
// 				sprintDuration = fieldValue.duration;

// 				// Armazena informações da sprint para uso posterior
// 				if (!sprintInfo[sprintId]) {
// 					sprintInfo[sprintId] = {
// 						title: sprint,
// 						startDate: sprintStartDate,
// 						duration: sprintDuration,
// 						endDate: calculateEndDate(sprintStartDate, sprintDuration),
// 					};
// 				}
// 			}
// 		});

// 	// Conta por status
// 	statusCounts[status] = (statusCounts[status] || 0) + 1;

// 	// Acumula pontos de estimativa por status
// 	if (!estimateTotals[status]) {
// 		estimateTotals[status] = 0;
// 	}
// 	estimateTotals[status] += estimate;
// 	totalEstimatePoints += estimate;

// 	// Calcula pontos entregues vs. pontos pendentes
// 	// Determina se a issue é um bug
// 	const isBug =
// 		exists(issue.issueType) &&
// 		issue.issueType.name.toLowerCase().includes('bug');

// 	// Calcula pontos entregues vs. pontos pendentes
// 	if (issue.state === 'CLOSED') {
// 		deliveredPoints += estimate;

// 		// Se for um bug, incremente o contador de bugs entregues
// 		if (isBug) {
// 			deliveredBugCount++;
// 			deliveredBugPoints += estimate; // Adiciona aos pontos de bugs entregues
// 		}
// 	} else {
// 		pendingPoints += estimate;

// 		// Se for um bug, incremente o contador de bugs pendentes
// 		if (isBug) {
// 			pendingBugCount++;
// 			pendingBugPoints += estimate; // Adiciona aos pontos de bugs pendentes
// 		}
// 	}

// 	// Rastreia bugs por status
// 	if (isBug) {
// 		// Adiciona aos pontos totais de bugs
// 		bugPoints += estimate;

// 		// Adiciona aos pontos de bugs entregues ou pendentes
// 		if (issue.state === 'CLOSED') {
// 			deliveredBugPoints += estimate;

// 			// Calcula o tempo de resolução para bugs fechados
// 			const resolutionTime = calculateIssueDuration(
// 				issue.createdAt,
// 				issue.updatedAt,
// 			);

// 			// Armazena informações sobre tempo de resolução
// 			bugResolutionTimes.push({
// 				number: issue.number,
// 				title: issue.title,
// 				resolutionDays: resolutionTime,
// 				assignees: issue.assignees?.nodes?.map((a) => a.login) || [],
// 			});
// 		} else {
// 			pendingBugPoints += estimate;
// 		}

// 		// Organiza bugs por status
// 		if (!bugsByStatus[status]) {
// 			bugsByStatus[status] = [];
// 		}
// 		bugsByStatus[status].push({
// 			title: issue.title || 'Sem título',
// 			number: issue.number || 0,
// 			url: issue.url || '#',
// 			state: issue.state || 'UNKNOWN',
// 			assignees: issue.assignees?.nodes?.map((a) => a.login) || [],
// 			priority: priority,
// 			estimate: estimate,
// 		});

// 		// Organiza bugs por prioridade
// 		if (!bugsByPriority[priority]) {
// 			bugsByPriority[priority] = [];
// 		}
// 		bugsByPriority[priority].push({
// 			title: issue.title || 'Sem título',
// 			number: issue.number || 0,
// 			url: issue.url || '#',
// 			state: issue.state || 'UNKNOWN',
// 			assignees: issue.assignees?.nodes?.map((a) => a.login) || [],
// 			status: status,
// 			estimate: estimate,
// 		});
// 	}

// 	// Rastreia bugs por prioridade
// 	if (isBug) {
// 		if (!bugsByPriority[priority]) {
// 			bugsByPriority[priority] = [];
// 		}
// 		bugsByPriority[priority].push({
// 			title: issue.title || 'Sem título',
// 			number: issue.number || 0,
// 			url: issue.url || '#',
// 			state: issue.state || 'UNKNOWN',
// 			assignees: issue.assignees?.nodes?.map((a) => a.login) || [],
// 			estimate: estimate,
// 		});
// 	}

// 	// Conta por prioridade
// 	priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;

// 	// Conta por tipo de issue (usa o tipo do content ou o tipo de campo, se disponível)
// 	const actualIssueType = exists(issue.issueType)
// 		? issue.issueType.name
// 		: issueType;

// 	// Atualiza a contagem de tipos (apenas uma vez por issue)
// 	issueTypeCounts[actualIssueType] =
// 		(issueTypeCounts[actualIssueType] || 0) + 1;

// 	// Conta por sprint
// 	if (sprint !== 'No Sprint') {
// 		sprintCounts[sprint] = (sprintCounts[sprint] || 0) + 1;
// 	}

// 	// Agrupa issues por status
// 	if (!issuesByStatus[status]) {
// 		issuesByStatus[status] = [];
// 	}

// 	// Adiciona a issue ao grupo correspondente
// 	issuesByStatus[status].push({
// 		title: issue.title || 'Sem título',
// 		number: issue.number || 0,
// 		url: issue.url || '#',
// 		state: issue.state || 'UNKNOWN',
// 		assignees: issue.assignees?.nodes?.map((a) => a.login) || [],
// 		labels: issue.labels?.nodes?.map((l) => l.name) || [],
// 		priority: priority,
// 		issueType: exists(issue.issueType) ? issue.issueType.name : issueType, // Prioriza o tipo do objeto content
// 		sprint: sprint,
// 		estimate: estimate, // Adicionando a pontuação/estimativa da issue
// 		sprintStartDate: sprintStartDate,
// 		sprintEndDate: sprintStartDate
// 			? calculateEndDate(sprintStartDate, sprintDuration)
// 			: null,
// 		updatedAt: issue.updatedAt || '',
// 		createdAt: issue.createdAt || '',
// 	});

// 	// Conta por responsável e soma estimativas por responsável
// 	if (exists(issue.assignees?.nodes)) {
// 		issue.assignees.nodes.forEach((assignee) => {
// 			if (assignee && assignee.login) {
// 				const login = assignee.login;

// 				// Conta o número de issues
// 				assigneeCounts[login] = (assigneeCounts[login] || 0) + 1;

// 				// Conta o número de bugs por usuário
// 				if (isBug) {
// 					assigneeBugCounts[login] = (assigneeBugCounts[login] || 0) + 1;
// 				}

// 				// Soma as estimativas por usuário
// 				if (!assigneeEstimates[login]) {
// 					assigneeEstimates[login] = {
// 						total: 0, // Total de pontos
// 						delivered: 0, // Pontos entregues (issues fechadas)
// 						pending: 0, // Pontos pendentes (issues abertas)
// 					};
// 				}

// 				// Calcula pontos entregues vs. pendentes por usuário
// 				if (issue.state === 'CLOSED') {
// 					assigneeEstimates[login].delivered += estimate;
// 				} else {
// 					assigneeEstimates[login].pending += estimate;
// 				}

// 				assigneeEstimates[login].total += estimate;

// 				// Contagem por status para cada usuário
// 				if (!assigneeStatusCounts[login]) {
// 					assigneeStatusCounts[login] = {};
// 				}
// 				assigneeStatusCounts[login][status] =
// 					(assigneeStatusCounts[login][status] || 0) + 1;

// 				// Detalhes avançados por usuário
// 				if (!assigneeDetails[login]) {
// 					assigneeDetails[login] = {
// 						issues: [],
// 						totalEstimate: 0,
// 						totalBugs: 0, // Total de bugs
// 						statusBreakdown: {},
// 						priorityBreakdown: {},
// 						typeBreakdown: {}, // Adicionando contagem por tipo de issue
// 					};
// 				}

// 				// Adiciona a issue aos detalhes do usuário
// 				assigneeDetails[login].issues.push({
// 					title: issue.title || 'Sem título',
// 					number: issue.number || 0,
// 					url: issue.url || '#',
// 					status: status,
// 					priority: priority,
// 					issueType: exists(issue.issueType) ? issue.issueType.name : issueType, // Prioriza o tipo do objeto content
// 					estimate: estimate,
// 				});

// 				// Atualiza estatísticas
// 				assigneeDetails[login].totalEstimate += estimate;

// 				// Incrementa o contador de bugs se a issue for um bug
// 				if (isBug) {
// 					assigneeDetails[login].totalBugs += 1;
// 				}
// 			}
// 		});
// 	}

// 	// Soma as estimativas totais
// 	if (exists(issue.estimate)) {
// 		totalEstimatePoints += parseFloat(issue.estimate);
// 	}

// 	// Soma as estimativas por status
// 	if (!estimateTotals[status]) {
// 		estimateTotals[status] = 0;
// 	}
// 	estimateTotals[status] += exists(issue.estimate)
// 		? parseFloat(issue.estimate)
// 		: 0;
// });

// // // Cria o resumo
// // const summary = [];
// // summary.push = {
// // 	projectTitle: projectData.title,
// // 	totalIssues: currentSprintItems.length,
// // 	statusCounts: statusCounts,
// // 	priorityCounts: priorityCounts,
// // 	issueTypeCounts: issueTypeCounts, // Contagem por tipo de issue
// // 	bugCount: bugCount, // Contador específico para bugs
// // 	assigneeCounts: assigneeCounts,
// // 	assigneeBugCounts: assigneeBugCounts, // Número de bugs por usuário

// // 	// Calcula a proporção de bugs por usuário (quanto maior, pior a qualidade)
// // 	assigneeBugRatio: Object.keys(assigneeCounts).reduce((acc, login) => {
// // 		const totalIssues = assigneeCounts[login] || 0;
// // 		const totalBugs = assigneeBugCounts[login] || 0;
// // 		acc[login] =
// // 			totalIssues > 0 ? Math.round((totalBugs / totalIssues) * 100) : 0;
// // 		return acc;
// // 	}, {}),

// // 	assigneeEstimates: assigneeEstimates, // Adicionando as estimativas por usuário
// // 	assigneeStatusCounts: assigneeStatusCounts, // Contagem de issues por status por usuário
// // 	//assigneeDetails: assigneeDetails, // Detalhes detalhados por usuário - menos informação
// // 	//sprintCounts: sprintCounts, //remove to reduce the information size
// // 	estimateTotals: estimateTotals,
// // 	totalEstimatePoints: totalEstimatePoints,
// // 	currentSprint: currentSprint,
// // 	//issuesByStatus: issuesByStatus, //remove to reduce the information size
// // 	date: new Date().toISOString(),

// // 	// Contadores adicionais úteis
// // 	openIssues: currentSprintItems.filter(
// // 		(item) => item.content?.state === 'OPEN',
// // 	).length,
// // 	closedIssues: currentSprintItems.filter(
// // 		(item) => item.content?.state === 'CLOSED',
// // 	).length,

// // 	// Metadados da filtragem
// // 	filteredBySprint: Boolean(currentSprintId),
// // 	totalUnfilteredIssues: items.length,

// // 	// Estimativas
// // 	totalEstimatePoints: totalEstimatePoints,
// // 	estimateTotals: estimateTotals,

// // 	// Estatísticas de entrega
// // 	deliveredPoints: deliveredPoints, // Total de pontos já entregues (issues fechadas)
// // 	pendingPoints: pendingPoints, // Total de pontos ainda não entregues
// // 	pendingPercentage:
// // 		totalEstimatePoints > 0
// // 			? Math.round((pendingPoints / totalEstimatePoints) * 100)
// // 			: 0, // Porcentagem pendente
// // 	deliveredPercentage:
// // 		totalEstimatePoints > 0
// // 			? Math.round((deliveredPoints / totalEstimatePoints) * 100)
// // 			: 0, // Porcentagem entregue

// // 	// Estatísticas de bugs
// // 	bugPercentage:
// // 		currentSprintItems.length > 0
// // 			? Math.round((bugCount / currentSprintItems.length) * 100)
// // 			: 0, // Porcentagem de bugs em relação ao total de issues
// // 	bugResolutionRate:
// // 		bugCount > 0 ? Math.round((deliveredBugCount / bugCount) * 100) : 0, // Taxa de resolução de bugs (porcentagem de bugs fechados)
// // 	//bugsByStatus: bugsByStatus, // Bugs organizados por status
// // 	//bugsByPriority: bugsByPriority, // Bugs organizados por prioridade
// // 	pendingBugCount: pendingBugCount, // Número de bugs pendentes
// // 	deliveredBugCount: deliveredBugCount, // Número de bugs entregues
// // 	assigneeBugCounts: assigneeBugCounts, // Número de bugs por usuário
// // };

// // // Suporta ambos os ambientes (local e n8n)
// // if (typeof module !== 'undefined' && module.exports) {
// // 	const fs = require('fs');

// // 	fs.writeFileSync('./analysis_result.json', JSON.stringify(summary, null, 2));
// // 	//console.log({ json: summary }); // Exibe no console para visualização
// // 	module.exports = { json: summary }; // Exporta para importação por outros módulos
// // } else {
// // 	return { json: summary }; // n8n
// // }

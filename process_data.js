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

let projectData,
	items = [];

// Verifica se estamos em ambiente local
if (typeof $input === 'undefined') {
	console.log('Ambiente local detectado, carregando data.json');
	const fs = require('fs');
	$input = {
		item: { json: JSON.parse(fs.readFileSync('./data.json', 'utf8')) },
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
const assigneeCounts = {};
const issuesByStatus = {};
const sprintCounts = {};

// Armazena informações sobre sprints
const sprintInfo = {};
let currentSprint = null;

// Processa cada item
items.forEach((item) => {
	// Pula itens sem conteúdo
	if (!exists(item) || !exists(item.content)) return;

	const issue = item.content;

	// Valores padrão
	let status = 'No Status';
	let priority = 'No Priority';
	let sprint = 'No Sprint';
	let sprintId = null;
	let sprintStartDate = null;
	let sprintDuration = null;

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
				}
			}
		});
	}

	// Conta por status
	statusCounts[status] = (statusCounts[status] || 0) + 1;

	// Conta por prioridade
	priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;

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
		sprint: sprint,
		sprintStartDate: sprintStartDate,
		sprintEndDate: sprintStartDate
			? calculateEndDate(sprintStartDate, sprintDuration)
			: null,
		updatedAt: issue.updatedAt || '',
		createdAt: issue.createdAt || '',
	});

	// Conta por responsável
	if (exists(issue.assignees?.nodes)) {
		issue.assignees.nodes.forEach((assignee) => {
			if (assignee && assignee.login) {
				assigneeCounts[assignee.login] =
					(assigneeCounts[assignee.login] || 0) + 1;
			}
		});
	}
});

// Cria o resumo
const summary = {
	projectTitle: projectData.title,
	totalIssues: items.length,
	statusCounts: statusCounts,
	priorityCounts: priorityCounts,
	assigneeCounts: assigneeCounts,
	sprintCounts: sprintCounts,
	sprints: sprintInfo,
	currentSprint: currentSprint,
	issuesByStatus: issuesByStatus,
	date: new Date().toISOString(),

	// Contadores adicionais úteis
	openIssues: items.filter((item) => item.content?.state === 'OPEN').length,
	closedIssues: items.filter((item) => item.content?.state === 'CLOSED').length,
};

// Suporta ambos os ambientes (local e n8n)
if (typeof module !== 'undefined' && module.exports) {
	console.log({ json: summary }); // Exibe no console para visualização
	module.exports = { json: summary }; // Exporta para importação por outros módulos
} else {
	return { json: summary }; // n8n
}

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
					currentSprintId = sprintId;
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
	totalIssues: currentSprintItems.length,
	statusCounts: statusCounts,
	priorityCounts: priorityCounts,
	assigneeCounts: assigneeCounts,
	sprintCounts: sprintCounts,
	sprints: sprintInfo,
	currentSprint: currentSprint,
	issuesByStatus: issuesByStatus,
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
};

// Suporta ambos os ambientes (local e n8n)
if (typeof module !== 'undefined' && module.exports) {
	console.log({ json: summary }); // Exibe no console para visualização
	module.exports = { json: summary }; // Exporta para importação por outros módulos
} else {
	return { json: summary }; // n8n
}

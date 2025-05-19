// Função auxiliar para verificar se um valor existe
function exists(value) {
	return value !== null && value !== undefined;
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

// Processa cada item
items.forEach((item) => {
	// Pula itens sem conteúdo
	if (!exists(item) || !exists(item.content)) return;

	const issue = item.content;

	// Valores padrão
	let status = 'No Status';
	let priority = 'No Priority';

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
		});
	}

	// Conta por status
	statusCounts[status] = (statusCounts[status] || 0) + 1;

	// Conta por prioridade
	priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;

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
	issuesByStatus: issuesByStatus,
	date: new Date().toISOString(),

	// Contadores adicionais úteis
	openIssues: items.filter((item) => item.content?.state === 'OPEN').length,
	closedIssues: items.filter((item) => item.content?.state === 'CLOSED').length,
};

// Suporta ambos os ambientes (local e n8n)
if (typeof module !== 'undefined' && module.exports) {
	console.log({ json: summary }); // local
} else {
	return { json: summary }; // n8n
}

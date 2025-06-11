const { exit } = require('process');

let projectData;
let $input;
let sprintsStructured = {};
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

	listIssues.forEach(function (item) {
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

		issueDetail.forEach(function (issue) {
			{
				if (issue.field?.name === 'Status') {
					issueFormated.status = issue.name;
				} else if (issue.field?.name === 'Priority') {
					issueFormated.priority = issue.name;
				} else if (issue.field?.name === 'Estimate') {
					issueFormated.estimate = +issue.number;
				} else if (issue.field?.name === 'Sprint') {
					issueFormated.sprint = issue.title;
				}
			}
		});

		issuesFormated.push(issueFormated);
	});

	return issuesFormated;
}

function agregateSprintIssues(listSprints, listIssues) {
	const sprintsAndIssues = listSprints.map(function (sprint) {
		const issuesRelacionadas = listIssues.filter(function (issue) {
			return issue.sprint === sprint.title;
		});
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
	sprintsStructured = agregateSprintIssues(
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

//console.log(sprintsStructured[0].issues[0]);

const summarySprints1 = sprintsStructured.map(function (sprint) {
	const totalIssues = sprint.issues.length;

	const totalSprintEstimate = sprint.issues.reduce(function (acc, issue) {
		acc + issue.estimate;
	}, 0);

	const listMember = [
		...new Set(
			sprint.issues.map(function (issue) {
				return issue.assignees;
			}),
		),
	];

	const totalMembers = listMember.length;

	const totalEstimateDelivered = sprint.issues
		.filter(function (issue) {
			issue.state === 'CLOSED';
		})
		.reduce(function (acc) {
			acc + issue.estimate;
		}, 0);

	const totalEstimatePending = sprint.issues
		.filter(function (issue) {
			issue.state === 'OPEN';
		})
		.reduce(function (acc) {
			acc + issue.estimate;
		}, 0);

	const sprintCompletionRate =
		totalSprintEstimate > 0
			? (totalEstimateDelivered / totalSprintEstimate) * 100
			: 0;

	const totalBugsDelivered = sprint.issues
		.filter(function (issue) {
			issue.issueType == 'Bug';
		})
		.filter(function (issue) {
			issue.state === 'CLOSED';
		})
		.reduce(function (acc) {
			acc + 1;
		}, 0);

	const totalBugsPending = sprint.issues
		.filter(function (issue) {
			issue.issueType == 'Bug';
		})
		.filter(function (issue) {
			issue.state === 'OPEN';
		})
		.reduce(function (acc) {
			acc + 1;
		}, 0);

	const totalBugs = totalBugsDelivered + totalBugsPending;

	const issueThroughputRate = totalEstimateDelivered / sprint.duration;

	const membersThroughputRate = totalEstimateDelivered / totalMembers;

	const bugFixRate = totalBugs > 0 ? (totalBugsDelivered / totalBugs) * 100 : 0;

	const issueCountByType = sprint.issues.map(function () {});

	console.log(
		`
		Sprint: ${sprint.title},
		Total de Membros ${totalMembers};
		Lista de Membros ${listMember};
		Total de Issue ${totalIssues},
		Total de Bugs ${totalBugs},
		Total de Total de Pontos da Sprint ${totalSprintEstimate},
		Total de Total de Pontos de Entregues ${totalEstimateDelivered},
		Total de Total de Pontos de Pendentes ${totalEstimatePending},
		Total de Total de Bugs Entregues ${totalBugsDelivered},
		Total de Total de Bugs Pendentes ${totalBugsPending},
		Sprint Throughput Rate ${issueThroughputRate},
		Sprint Bug Throughput Rate ${bugFixRate}%,
		Members Throughput Rate ${membersThroughputRate},
		Porcentagem Entregues ${sprintCompletionRate}%

		`,
	);

	return {
		...sprint,
		totalIssues,
		totalBugs,
		totalBugsDelivered,
		totalBugsPending,
		totalSprintEstimate,
		totalEstimateDelivered,
		totalEstimatePending,
		sprintCompletionRate,
		issueThroughputRate,
		bugFixRate,
	};
});

// // Suporta ambos os ambientes (local e n8n)
// if (typeof module !== 'undefined' && module.exports) {
// 	const fs = require('fs');

// 	fs.writeFileSync('./analysis_result.json', JSON.stringify(summary, null, 2));
// 	//console.log({ json: summary }); // Exibe no console para visualização
// 	module.exports = { json: summary }; // Exporta para importação por outros módulos
// } else {
// 	return { json: summary }; // n8n
// }

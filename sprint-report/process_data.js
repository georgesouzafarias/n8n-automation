let projectData;
let sprintsStructured = {};

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

const summarySprints = sprintsStructured.map(function (sprint) {
	const totalIssues = sprint.issues.length;

	const totalSprintEstimate = sprint.issues.reduce(function (acc, issue) {
		return acc + issue.estimate;
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
			return issue.state === 'CLOSED';
		})
		.reduce(function (acc, issue) {
			return acc + issue.estimate;
		}, 0);

	const totalEstimatePending = sprint.issues
		.filter(function (issue) {
			return issue.state === 'OPEN';
		})
		.reduce(function (acc, issue) {
			return acc + issue.estimate;
		}, 0);

	const sprintCompletionRate =
		totalSprintEstimate > 0
			? (totalEstimateDelivered / totalSprintEstimate) * 100
			: 0;

	const totalBugsDelivered = sprint.issues
		.filter(function (issue) {
			return issue.issueType == 'Bug' && issue.state === 'CLOSED';
		})
		.reduce(function (acc) {
			return acc + 1;
		}, 0);

	const totalBugsPending = sprint.issues
		.filter(function (issue) {
			return (
				issue.issueType == 'Bug' &&
				sprint.currentSprint &&
				issue.state === 'OPEN'
			);
		})
		.reduce(function (acc) {
			return acc + 1;
		}, 0);

	const totalBugs = totalBugsDelivered + totalBugsPending;

	const issueThroughputRate = totalEstimateDelivered / sprint.duration;

	const membersThroughputRate = totalEstimateDelivered / totalMembers;

	const bugFixRate = totalBugs > 0 ? (totalBugsDelivered / totalBugs) * 100 : 0;

	const listPriority = [
		...new Set(
			sprint.issues.map(function (issue) {
				return issue.priority;
			}),
		),
	];

	const issueCountByType = sprint.issues.reduce(function (acc, issue) {
		const issueType = issue.issueType;
		acc[issueType] = (acc[issueType] || 0) + 1;
		return acc;
	}, {});

	const issueCountByStatus = sprint.issues.reduce(function (acc, issue) {
		const status = issue.status;
		acc[status] = (acc[status] || 0) + 1;
		return acc;
	}, {});

	const estimateTotalByStatus = sprint.issues.reduce(function (acc, issue) {
		const status = issue.status;
		acc[status] = (acc[status] || 0) + issue.estimate;
		return acc;
	}, {});

	const issueCountByAssignee = sprint.issues.reduce(function (acc, issue) {
		const assignees = Array.isArray(issue.assignees)
			? issue.assignees
			: [issue.assignees];

		assignees.forEach((assignee) => {
			acc[assignee] = (acc[assignee] || 0) + 1;
		});
		return acc;
	}, {});

	const estimateTotalByAssignee = sprint.issues.reduce((acc, issue) => {
		const assignees = Array.isArray(issue.assignees)
			? issue.assignees
			: [issue.assignees];

		assignees.forEach((assignee) => {
			acc[assignee] = (acc[assignee] || 0) + (issue.estimate || 0);
		});

		return acc;
	}, {});

	const estimateDeliveredByAssignee = sprint.issues
		.filter(function (issue) {
			return issue.state === 'CLOSED';
		})
		.reduce((acc, issue) => {
			const assignees = Array.isArray(issue.assignees)
				? issue.assignees
				: [issue.assignees];

			assignees.forEach((assignee) => {
				acc[assignee] = (acc[assignee] || 0) + (issue.estimate || 0);
			});

			return acc;
		}, {});

	const estimatePendingByAssignee = sprint.issues
		.filter(function (issue) {
			return issue.state === 'OPEN' && sprint.currentSprint;
		})
		.reduce((acc, issue) => {
			const assignees = Array.isArray(issue.assignees)
				? issue.assignees
				: [issue.assignees];

			assignees.forEach((assignee) => {
				acc[assignee] = (acc[assignee] || 0) + (issue.estimate || 0);
			});

			return acc;
		}, {});

	const carryOverEstimatePerSprint = sprint.issues.reduce((acc, issue) => {
		issue.labels.forEach((label) => {
			const labelName = label.name;

			if (labelName.startsWith('Transbordo')) {
				acc[labelName] = (acc[labelName] || 0) + (issue.estimate || 0);
			}
		});

		return acc;
	}, {});

	const { issues, ...sprintWithoutIssues } = sprint;

	return {
		...sprintWithoutIssues,
		totalIssues,
		totalSprintEstimate,
		listMember,
		totalMembers,
		totalEstimateDelivered,
		totalEstimatePending,
		sprintCompletionRate,
		totalBugsDelivered,
		totalBugsPending,
		totalBugs,
		issueThroughputRate,
		membersThroughputRate,
		bugFixRate,
		listPriority,
		issueCountByType,
		issueCountByAssignee,
		estimateTotalByAssignee,
		estimateDeliveredByAssignee,
		estimatePendingByAssignee,
		issueCountByStatus,
		estimateTotalByStatus,
		carryOverEstimatePerSprint,
	};
});

// Suporta ambos os ambientes (local e n8n)
if (typeof module !== 'undefined' && module.exports) {
	const fs = require('fs');

	fs.writeFileSync(
		'./analysis_result.json',
		JSON.stringify(summarySprints, null, 2),
	);

	module.exports = { summarySprints };
} else {
	return { summarySprints }; // n8n
}

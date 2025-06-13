/**
 * SPRINT DATA PROCESSING SCRIPT
 * =============================
 *
 * Processes GitHub Projects data to generate comprehensive sprint analytics
 *
 * MAIN FUNCTIONS:
 * • 📊 Extracts and formats sprint configurations from GitHub Projects
 * • 🎯 Processes issues with custom field mappings (Status, Priority, Estimate, Sprint)
 * • 📈 Calculates comprehensive metrics: completion rates, throughput, bug analysis
 * • 👥 Generates team performance analytics and workload distribution
 * • 🏷️ Analyzes distribution by type, status, assignee, and priority
 * • 📦 Tracks carry-over analysis from previous sprints
 * • 🚨 Identifies critical bugs and burnout risk indicators
 *
 * INPUT: GitHub Projects API data via n8n or local data.json
 * OUTPUT: { summarySprints } - Array of enriched sprint objects with analytics
 *
 * SUPPORTED PRIORITY FIELDS:
 * • issueCountByPriority - issue count distribution by priority (P0-P8)
 * • estimateTotalByPriority - estimate points distribution by priority
 * • bugCountByPriority - bug count distribution by priority
 *
 * ENVIRONMENTS: Local development (Node.js) and n8n automation platform
 */

let projectData;
let sprintsStructured = {};

/**
 * Helper function to check if a value exists (not null or undefined)
 * @param {*} value - The value to check
 * @returns {boolean} true if value is not null and not undefined
 */
function exists(value) {
	return value !== null && value !== undefined;
}

/**
 * Helper function to calculate the end date of a sprint
 * @param {string} startDate - Sprint start date in ISO format (YYYY-MM-DD)
 * @param {number|string} durationDays - Duration of the sprint in days
 * @returns {string|null} End date in ISO format (YYYY-MM-DD) or null if invalid input
 */
function calculateEndDate(startDate, durationDays) {
	if (!startDate || !durationDays) return null;

	const date = new Date(startDate);
	date.setDate(date.getDate() + parseInt(durationDays) - 1); // Subtrair 1 porque a data de início já conta como dia 1
	return date.toISOString().split('T')[0]; // Retorna apenas a parte da data (YYYY-MM-DD)
}

/**
 * Function to calculate the duration of an issue in days
 * @param {string} createdAt - Issue creation date in ISO format
 * @param {string} updatedAt - Issue last update date in ISO format
 * @returns {number} Duration in days (0 if invalid dates)
 */
function calculateIssueDuration(createdAt, updatedAt) {
	if (!createdAt || !updatedAt) return 0;

	const created = new Date(createdAt);
	const updated = new Date(updatedAt);
	const durationMs = updated - created;

	// Converte para dias
	return Math.floor(durationMs / (1000 * 60 * 60 * 24));
}

/**
 * Extract and process sprint information from GitHub Projects data
 * Identifies current and completed sprints with their metadata
 * @param {Array} listSprints - Array of sprint configurations from GitHub Projects
 * @returns {Array} Array of processed sprint objects with calculated properties
 */
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

/**
 * Extract and format issues from GitHub Projects data
 * Processes raw issue data and extracts relevant fields including custom field values
 * @param {Array} listIssues - Array of raw issue objects from GitHub Projects API
 * @returns {Array} Array of formatted issue objects with standardized properties
 */
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

/**
 * Aggregate sprints with their associated issues and calculate metrics
 * Combines sprint metadata with filtered issues and computes various statistics
 * @param {Array} listSprints - Array of processed sprint objects
 * @param {Array} listIssues - Array of formatted issue objects
 * @returns {Array} Array of sprint objects enriched with issue data and metrics
 */
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

/**
 * Local environment detection and data loading
 * Checks if running locally and loads test data from data.json file
 */
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

/**
 * Data extraction and processing pipeline
 * Extracts project data from n8n input and processes sprints with their issues
 * Handles errors gracefully with detailed error reporting
 */
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

/**
 * Sprint summary calculation and metrics generation
 * Transforms raw sprint data into comprehensive analytics including:
 * - Basic metrics (issues, estimates, members)
 * - Delivery tracking (completed vs pending)
 * - Bug analysis and resolution rates
 * - Performance metrics (throughput, completion rates)
 * - Distribution analysis (by type, status, assignee, priority)
 * - Carry-over analysis from previous sprints
 */
const summarySprints = sprintsStructured.map(function (sprint) {
	const totalIssues = sprint.issues.length;

	/**
	 * Calculate total sprint estimate points
	 */
	const totalSprintEstimate = sprint.issues.reduce(function (acc, issue) {
		return acc + issue.estimate;
	}, 0);

	/**
	 * Extract unique team members from assignees
	 */
	const listMember = [
		...new Set(
			sprint.issues.map(function (issue) {
				return issue.assignees;
			}),
		),
	];

	const totalMembers = listMember.length;

	/**
	 * Calculate delivered estimates (closed issues)
	 */
	const totalEstimateDelivered = sprint.issues
		.filter(function (issue) {
			return issue.state === 'CLOSED';
		})
		.reduce(function (acc, issue) {
			return acc + issue.estimate;
		}, 0);

	/**
	 * Calculate pending estimates (open issues)
	 */
	const totalEstimatePending = sprint.issues
		.filter(function (issue) {
			return issue.state === 'OPEN';
		})
		.reduce(function (acc, issue) {
			return acc + issue.estimate;
		}, 0);

	/**
	 * Calculate sprint completion rate percentage
	 */
	const sprintCompletionRate =
		totalSprintEstimate > 0
			? ((totalEstimateDelivered / totalSprintEstimate) * 100).toFixed(2)
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

	const issueThroughputRate = (
		totalEstimateDelivered / sprint.duration
	).toFixed(2);

	const membersThroughputRate = (totalEstimateDelivered / totalMembers).toFixed(
		2,
	);

	const bugFixRate =
		totalBugs > 0 ? ((totalBugsDelivered / totalBugs) * 100).toFixed(2) : 0;

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

	const issueCountByPriority = sprint.issues.reduce(function (acc, issue) {
		const priority = issue.priority;
		acc[priority] = (acc[priority] || 0) + 1;
		return acc;
	}, {});

	const estimateTotalByPriority = sprint.issues.reduce(function (acc, issue) {
		const priority = issue.priority;
		acc[priority] = (acc[priority] || issue.estimate) + 1;
		return acc;
	}, {});

	const bugCountByPriority = sprint.issues
		.filter(function (issue) {
			return issue.issueType === 'Bug';
		})
		.reduce(function (acc, issue) {
			const priority = issue.priority;
			acc[priority] = (acc[priority] || 0) + 1;
			return acc;
		}, {});

	const criticalBugCountP0P1 = sprint.issues
		.filter(function (issue) {
			return (
				(issue.issueType === 'Bug' && issue.priority === 'P0') ||
				issue.priority === 'P1'
			);
		})
		.reduce(function (acc) {
			return acc + 1;
		}, 0);

	const criticalBugCountP0P1Delivered = sprint.issues
		.filter(function (issue) {
			return (
				(issue.issueType === 'Bug' && issue.priority === 'P0') ||
				(issue.priority === 'P1' && issue.state === 'CLOSED')
			);
		})
		.reduce(function (acc) {
			return acc + 1;
		}, 0);

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

	const bugDeliveredByAssignee = sprint.issues
		.filter(function (issue) {
			return issue.state === 'CLOSED' && issue.issueType == 'Bug';
		})
		.reduce((acc, issue) => {
			const assignees = Array.isArray(issue.assignees)
				? issue.assignees
				: [issue.assignees];

			assignees.forEach((assignee) => {
				acc[assignee] = (acc[assignee] || 0) + 1;
			});

			return acc;
		}, {});

	const bugTotalByAssignee = sprint.issues
		.filter(function (issue) {
			return issue.issueType == 'Bug';
		})
		.reduce((acc, issue) => {
			const assignees = Array.isArray(issue.assignees)
				? issue.assignees
				: [issue.assignees];

			assignees.forEach((assignee) => {
				acc[assignee] = (acc[assignee] || 0) + 1;
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

	const bugHotfixCount = sprint.issues.reduce((acc, issue) => {
		issue.labels.forEach((label) => {
			const labelName = label.name;

			if (labelName.toLowerCase().includes('hotfix')) {
				acc[labelName] = (acc[labelName] || 0) + 1;
			}
		});

		return acc;
	}, {});

	const estimateLoadDistributionByAssignee = {};

	for (const [assignee, points] of Object.entries(estimateTotalByAssignee)) {
		estimateLoadDistributionByAssignee[assignee] = Number(
			((points / totalSprintEstimate) * 100).toFixed(2),
		);
	}

	const bugLoadDistributionByAssignee = {};

	for (const [assignee, bugs] of Object.entries(bugTotalByAssignee)) {
		bugLoadDistributionByAssignee[assignee] = Number(
			((bugs / totalBugs) * 100).toFixed(2),
		);
	}

	const burnoutRiskScore = {};

	for (const [assignee, points] of Object.entries(estimateTotalByAssignee)) {
		burnoutRiskScore[assignee] = Number(
			(points / (totalSprintEstimate / totalMembers)).toFixed(2),
		);
	}

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
		issueCountByPriority,
		estimateTotalByPriority,
		bugCountByPriority,
		criticalBugCountP0P1,
		bugHotfixCount,
		bugTotalByAssignee,
		bugDeliveredByAssignee,
		estimateLoadDistributionByAssignee,
		bugLoadDistributionByAssignee,
		burnoutRiskScore,
	};
});

/**
 * Cross-environment output handling
 * Supports both local development (Node.js module) and n8n automation environments
 * In local mode: writes analysis_result.json file and exports module
 * In n8n mode: returns data object for workflow processing
 */
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

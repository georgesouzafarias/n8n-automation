/**
 * EXECUTIVE SPRINT REPORT GENERATOR
 * =================================
 *
 * Generates executive-level sprint analytics for decision making
 * Focus: Key metrics, risks, and actionable insights
 * No emojis - Clean, professional format
 */

// Helper function to check if a value exists
function exists(value) {
	return value !== null && value !== undefined;
}

// Get sprint data from n8n input with robust handling
let sprintData;

// Try multiple possible structures from n8n
if (exists($input)) {
	if (exists($input.json)) {
		if (Array.isArray($input.json) && $input.json.length > 0) {
			sprintData = $input.json;
		} else if (
			exists($input.json.summarySprints) &&
			Array.isArray($input.json.summarySprints)
		) {
			sprintData = $input.json.summarySprints;
		} else {
			sprintData = $input.json;
		}
	} else if (exists($input.item) && exists($input.item.json)) {
		if (
			exists($input.item.json.summarySprints) &&
			Array.isArray($input.item.json.summarySprints)
		) {
			sprintData = $input.item.json.summarySprints;
		} else if (Array.isArray($input.item.json)) {
			sprintData = $input.item.json;
		} else {
			sprintData = $input.item.json;
		}
	} else {
		sprintData = $input;
	}
}

// Error handling for invalid data
if (
	!exists(sprintData) ||
	!Array.isArray(sprintData) ||
	sprintData.length === 0
) {
	return {
		json: {
			error: true,
			message: 'Sprint data not found or invalid',
			inputStructure: JSON.stringify($input).substring(0, 500) + '...',
		},
	};
}

// Identify current sprint and previous sprints for comparison
const currentSprint =
	sprintData.find((sprint) => sprint.currentSprint) || sprintData[0];
const previousSprints = sprintData
	.filter((sprint) => !sprint.currentSprint)
	.slice(0, 2);

// Format current date
const today = new Date();
const formattedDate = today.toLocaleDateString('pt-BR', {
	weekday: 'long',
	day: 'numeric',
	month: 'long',
	year: 'numeric',
});

/**
 * Generate executive summary with key metrics and alerts
 */
function generateExecutiveSummary(sprint) {
	if (!sprint) return '<p>No sprint data available</p>';

	const completionRate = parseFloat(sprint.sprintCompletionRate);
	const bugFixRate = parseFloat(sprint.bugFixRate);
	const throughputRate = parseFloat(sprint.issueThroughputRate);
	const membersThroughputRate = parseFloat(sprint.membersThroughputRate);
	const hotfixCount = Object.values(sprint.bugHotfixCount || {}).reduce(
		(sum, count) => sum + count,
		0,
	);

	// Risk indicators
	const risks = [];
	if (completionRate < 70) risks.push('Low completion rate');
	if (bugFixRate < 80) risks.push('Poor bug resolution');
	if (sprint.totalBugs > sprint.totalIssues * 0.3) risks.push('High bug ratio');
	if (hotfixCount > 2) risks.push('High hotfix frequency');

	// Burnout risk analysis using burnoutRiskScore
	const highRiskMembers = [];
	if (sprint.burnoutRiskScore) {
		Object.entries(sprint.burnoutRiskScore).forEach(([member, score]) => {
			if (score > 1.5) {
				// High burnout risk threshold
				highRiskMembers.push(`${member} (${score.toFixed(1)})`);
			}
		});
	}

	// Blocked issues analysis
	const blockedIssues = sprint.issueCountByStatus?.Blocked || 0;
	const blockedPoints = sprint.estimateTotalByStatus?.Blocked || 0;
	if (blockedIssues > 0)
		risks.push(`${blockedIssues} blocked issues (${blockedPoints} pts)`);

	return `
        <div class="executive-summary">
            <h2>Executive Summary</h2>
            <div class="key-metrics">
                <div class="metric ${
									completionRate < 70
										? 'alert'
										: completionRate > 90
										? 'success'
										: 'warning'
								}">
                    <span class="label">Sprint Progress</span>
                    <span class="value">${completionRate.toFixed(1)}%</span>
                    <span class="detail">${sprint.totalEstimateDelivered}/${
		sprint.totalSprintEstimate
	} pts</span>
                </div>
                <div class="metric ${bugFixRate < 80 ? 'alert' : 'success'}">
                    <span class="label">Bug Resolution</span>
                    <span class="value">${bugFixRate.toFixed(1)}%</span>
                    <span class="detail">${sprint.totalBugsDelivered}/${
		sprint.totalBugs
	} bugs</span>
                </div>
                <div class="metric">
                    <span class="label">Team Throughput</span>
                    <span class="value">${membersThroughputRate.toFixed(
											1,
										)}</span>
                    <span class="detail">pts/member</span>
                </div>
                <div class="metric ${
									hotfixCount > 2
										? 'alert'
										: hotfixCount > 0
										? 'warning'
										: 'success'
								}">
                    <span class="label">Hotfixes</span>
                    <span class="value">${hotfixCount}</span>
                    <span class="detail">emergency fixes</span>
                </div>
            </div>

            ${
							risks.length > 0
								? `
                <div class="risk-alerts">
                    <h3>▲ Risk Alerts</h3>
                    <ul>
                        ${risks.map((risk) => `<li>${risk}</li>`).join('')}
                    </ul>
                </div>
            `
								: ''
						}

            ${
							highRiskMembers.length > 0
								? `
                <div class="burnout-alert">
                    <h3>▲ Burnout Risk Alert</h3>
                    <p>High risk members: ${highRiskMembers.join(', ')}</p>
                </div>
            `
								: ''
						}
        </div>
    `;
}

/**
 * Generate priority distribution analysis for decision making
 */
function generatePriorityAnalysis(sprint) {
	if (!sprint.issueCountByPriority) return '';

	const priorities = ['P0', 'P1', 'P2', 'P3', 'P4'];
	const relevantPriorities = priorities.filter(
		(p) => sprint.issueCountByPriority[p] > 0,
	);

	if (relevantPriorities.length === 0) return '';

	return `
        <div class="priority-analysis">
            <h3>Priority Distribution</h3>
            <table class="priority-table">
                <tr>
                    <th>Priority</th>
                    <th>Issues</th>
                    <th>Story Points</th>
                    <th>Bugs</th>
                </tr>
                ${relevantPriorities
									.map((priority) => {
										const issueCount =
											sprint.issueCountByPriority[priority] || 0;
										const points =
											sprint.estimateTotalByPriority[priority] || 0;
										const bugs = sprint.bugCountByPriority[priority] || 0;

										return `
                        <tr class="${
													priority === 'P0' || priority === 'P1'
														? 'critical'
														: ''
												}">
                            <td><strong>${priority}</strong></td>
                            <td>${issueCount}</td>
                            <td>${points}</td>
                            <td>${bugs > 0 ? bugs : '-'}</td>
                        </tr>
                    `;
									})
									.join('')}
            </table>
        </div>
    `;
}

/**
 * Generate team performance overview
 */
function generateTeamOverview(sprint) {
	if (!sprint.estimateLoadDistributionByAssignee) return '';

	// Get workload distribution
	const workloadEntries = Object.entries(
		sprint.estimateLoadDistributionByAssignee,
	).sort(([, a], [, b]) => b - a);

	const overloadedMembers = workloadEntries.filter(([, load]) => load > 25);
	const avgLoad = 100 / sprint.totalMembers;

	// Top performers by delivered points
	const deliveredEntries = Object.entries(
		sprint.estimateDeliveredByAssignee || {},
	)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 3);

	// Bug analysis by assignee
	const bugsByMember = Object.entries(sprint.bugTotalByAssignee || {}).sort(
		([, a], [, b]) => b - a,
	);

	// Issue type distribution
	const typeStats = Object.entries(sprint.issueCountByType || {})
		.map(([type, count]) => `${type}: ${count}`)
		.join(', ');

	return `
        <div class="team-overview">
            <h3>Team Performance</h3>
            <div class="team-stats">
                <div class="stat">
                    <span class="label">Team Size</span>
                    <span class="value">${sprint.totalMembers}</span>
                </div>
                <div class="stat">
                    <span class="label">Avg. Throughput</span>
                    <span class="value">${parseFloat(
											sprint.membersThroughputRate,
										).toFixed(1)}</span>
                    <span class="detail">pts/member</span>
                </div>
                <div class="stat ${
									overloadedMembers.length > 0 ? 'alert' : 'success'
								}">
                    <span class="label">Overloaded</span>
                    <span class="value">${overloadedMembers.length}</span>
                </div>
                <div class="stat">
                    <span class="label">Issue Types</span>
                    <span class="value">${
											Object.keys(sprint.issueCountByType || {}).length
										}</span>
                    <span class="detail">${typeStats}</span>
                </div>
            </div>

            ${
							deliveredEntries.length > 0
								? `
                <div class="top-performers">
                    <h4>🎯 Top Performers (Delivered Points)</h4>
                    <ul>
                        ${deliveredEntries
													.map(
														([member, points]) =>
															`<li>${member}: ${points} points delivered</li>`,
													)
													.join('')}
                    </ul>
                </div>
            `
								: ''
						}

            ${
							overloadedMembers.length > 0
								? `
                <div class="workload-alert">
                    <h4>▲ Workload Distribution Issues</h4>
                    <ul>
                        ${overloadedMembers
													.map(
														([member, load]) =>
															`<li>${member}: ${load.toFixed(
																1,
															)}% of sprint capacity</li>`,
													)
													.join('')}
                    </ul>
                </div>
            `
								: ''
						}

            ${
							bugsByMember.length > 0
								? `
                <div class="bug-analysis">
                    <h4>🐛 Bug Responsibility</h4>
                    <ul>
                        ${bugsByMember
													.slice(0, 5)
													.map(([member, bugs]) => {
														const delivered =
															sprint.bugDeliveredByAssignee?.[member] || 0;
														const rate =
															bugs > 0
																? ((delivered / bugs) * 100).toFixed(1)
																: '0';
														return `<li>${member}: ${delivered}/${bugs} bugs fixed (${rate}%)</li>`;
													})
													.join('')}
                    </ul>
                </div>
            `
								: ''
						}
        </div>
    `;
}

/**
 * Generate sprint comparison with trends (avoiding unreliable completion rates)
 */
function generateSprintComparison(current, previous) {
	if (!previous || previous.length === 0) return '';

	// Get the last 3 sprints for comparison
	const lastThreeSprints = previous.slice(0, 3);

	return `
        <div class="sprint-comparison">
            <h3>Sprint Comparison - Last 3 Sprints</h3>
            <div class="comparison-note">
                <p><em>Note: Completion rates not compared due to sprint methodology differences</em></p>
            </div>
            <table class="comparison-table">
                <tr>
                    <th>Metric</th>
                    <th>Current (${current.title})</th>
                    ${lastThreeSprints
											.map((sprint) => `<th>${sprint.title}</th>`)
											.join('')}
                </tr>
                <tr>
                    <td>Issue Throughput</td>
                    <td>${current.issueThroughputRate} pts/day</td>
                    ${lastThreeSprints
											.map(
												(sprint) =>
													`<td>${sprint.issueThroughputRate} pts/day</td>`,
											)
											.join('')}
                </tr>
                <tr>
                    <td>Team Throughput</td>
                    <td>${current.membersThroughputRate} pts/member</td>
                    ${lastThreeSprints
											.map(
												(sprint) =>
													`<td>${sprint.membersThroughputRate} pts/member</td>`,
											)
											.join('')}
                </tr>
                <tr>
                    <td>Total Bugs</td>
                    <td>${current.totalBugs}</td>
                    ${lastThreeSprints
											.map((sprint) => `<td>${sprint.totalBugs}</td>`)
											.join('')}
                </tr>
                <tr>
                    <td>Hotfixes</td>
                    <td>${Object.values(current.bugHotfixCount || {}).reduce(
											(sum, count) => sum + count,
											0,
										)}</td>
                    ${lastThreeSprints
											.map((sprint) => {
												const hotfixes = Object.values(
													sprint.bugHotfixCount || {},
												).reduce((sum, count) => sum + count, 0);
												return `<td>${hotfixes}</td>`;
											})
											.join('')}
                </tr>
                <tr>
                    <td>Team Size</td>
                    <td>${current.totalMembers}</td>
                    ${lastThreeSprints
											.map((sprint) => `<td>${sprint.totalMembers}</td>`)
											.join('')}
                </tr>
                <tr>
                    <td>Bug Fix Rate</td>
                    <td>${parseFloat(current.bugFixRate).toFixed(1)}%</td>
                    ${lastThreeSprints
											.map(
												(sprint) =>
													`<td>${parseFloat(sprint.bugFixRate).toFixed(
														1,
													)}%</td>`,
											)
											.join('')}
                </tr>
            </table>

            <div class="trend-analysis">
                <h4>📈 Trend Analysis vs ${
									lastThreeSprints[0]?.title || 'Previous Sprint'
								}</h4>
                <div class="trends">
                    ${(() => {
											if (lastThreeSprints.length === 0) return '';
											const prev = lastThreeSprints[0];

											const throughputTrend =
												parseFloat(current.issueThroughputRate) -
												parseFloat(prev.issueThroughputRate);
											const membersThroughputTrend =
												parseFloat(current.membersThroughputRate) -
												parseFloat(prev.membersThroughputRate);
											const bugTrend = current.totalBugs - prev.totalBugs;
											const bugFixTrend =
												parseFloat(current.bugFixRate) -
												parseFloat(prev.bugFixRate);

											const currentHotfixes = Object.values(
												current.bugHotfixCount || {},
											).reduce((sum, count) => sum + count, 0);
											const prevHotfixes = Object.values(
												prev.bugHotfixCount || {},
											).reduce((sum, count) => sum + count, 0);
											const hotfixTrend = currentHotfixes - prevHotfixes;

											return `
                            <span class="trend-item ${
															throughputTrend >= 0 ? 'positive' : 'negative'
														}">
                                Issue Throughput: ${
																	throughputTrend >= 0 ? '▲' : '▼'
																} ${Math.abs(throughputTrend).toFixed(1)}
                            </span>
                            <span class="trend-item ${
															membersThroughputTrend >= 0
																? 'positive'
																: 'negative'
														}">
                                Team Throughput: ${
																	membersThroughputTrend >= 0 ? '▲' : '▼'
																} ${Math.abs(membersThroughputTrend).toFixed(1)}
                            </span>
                            <span class="trend-item ${
															bugTrend <= 0 ? 'positive' : 'negative'
														}">
                                Total Bugs: ${
																	bugTrend <= 0 ? '▼' : '▲'
																} ${Math.abs(bugTrend)}
                            </span>
                            <span class="trend-item ${
															bugFixTrend >= 0 ? 'positive' : 'negative'
														}">
                                Bug Fix Rate: ${
																	bugFixTrend >= 0 ? '▲' : '▼'
																} ${Math.abs(bugFixTrend).toFixed(1)}%
                            </span>
                            <span class="trend-item ${
															hotfixTrend <= 0 ? 'positive' : 'negative'
														}">
                                Hotfixes: ${
																	hotfixTrend <= 0 ? '▼' : '▲'
																} ${Math.abs(hotfixTrend)}
                            </span>
                        `;
										})()}
                </div>
            </div>
        </div>
    `;
}

// Generate the complete executive report components
const executiveSummary = generateExecutiveSummary(currentSprint);
const priorityAnalysis = generatePriorityAnalysis(currentSprint);
const teamOverview = generateTeamOverview(currentSprint);
const sprintComparison = generateSprintComparison(
	currentSprint,
	previousSprints,
);

// Professional CSS with dark mode support
const cssStyles = `
<style>
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        line-height: 1.6;
        color: #374151;
        background-color: #f9fafb;
    }

    .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        background: white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        border-radius: 8px;
    }

    .header {
        text-align: center;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 2px solid #e5e7eb;
    }

    .header h1 {
        color: #111827;
        font-size: 2.2em;
        margin-bottom: 10px;
        font-weight: 600;
    }

    .header .subtitle {
        color: #6b7280;
        font-size: 1.1em;
    }

    .executive-summary {
        margin-bottom: 30px;
        padding: 20px;
        background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
        color: white;
        border-radius: 8px;
    }

    .executive-summary h2 {
        margin-bottom: 20px;
        font-size: 1.8em;
    }

    .key-metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 15px;
        margin-bottom: 20px;
    }

    .metric {
        background: rgba(255,255,255,0.15);
        padding: 15px;
        border-radius: 6px;
        text-align: center;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.1);
    }

    .metric.alert {
        background: rgba(239, 68, 68, 0.9);
        border-color: rgba(239, 68, 68, 0.3);
    }

    .metric.warning {
        background: rgba(245, 158, 11, 0.9);
        border-color: rgba(245, 158, 11, 0.3);
        color: #1f2937;
    }

    .metric.success {
        background: rgba(34, 197, 94, 0.9);
        border-color: rgba(34, 197, 94, 0.3);
    }

    .metric .label {
        display: block;
        font-size: 0.9em;
        margin-bottom: 5px;
        opacity: 0.9;
    }

    .metric .value {
        display: block;
        font-size: 1.8em;
        font-weight: bold;
    }

    .metric .detail {
        display: block;
        font-size: 0.8em;
        margin-top: 5px;
        opacity: 0.8;
    }

    .risk-alerts, .burnout-alert {
        background: rgba(254, 226, 226, 0.8);
        padding: 15px;
        border-radius: 6px;
        margin-top: 15px;
        border-left: 4px solid #ef4444;
    }

    .risk-alerts h3, .burnout-alert h3 {
        color: #dc2626;
        margin-bottom: 10px;
    }

    .risk-alerts ul {
        list-style: none;
        padding-left: 0;
    }

    .risk-alerts li {
        padding: 5px 0;
        color: #991b1b;
    }

    .burnout-alert p {
        color: #991b1b;
    }

    .section {
        margin-bottom: 30px;
        padding: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        border: 1px solid #f3f4f6;
    }

    .section h3 {
        color: #111827;
        margin-bottom: 15px;
        font-size: 1.4em;
        border-bottom: 2px solid #e5e7eb;
        padding-bottom: 10px;
        font-weight: 600;
    }

    .priority-table, .comparison-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
    }

    .priority-table th, .comparison-table th,
    .priority-table td, .comparison-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #dee2e6;
    }

    .priority-table th, .comparison-table th {
        background-color: #f9fafb;
        font-weight: 600;
        color: #374151;
    }

    .priority-table tr.critical {
        background-color: #fef2f2;
    }

    .team-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        margin-bottom: 20px;
    }

    .stat {
        background: #f9fafb;
        padding: 15px;
        border-radius: 6px;
        text-align: center;
        border: 1px solid #f3f4f6;
    }

    .stat.alert {
        background: #fef2f2;
        color: #991b1b;
        border-color: #fecaca;
    }

    .stat.success {
        background: #f0fdf4;
        color: #166534;
        border-color: #bbf7d0;
    }

    .stat .label {
        display: block;
        font-size: 0.9em;
        margin-bottom: 5px;
        opacity: 0.8;
    }

    .stat .value {
        display: block;
        font-size: 1.5em;
        font-weight: bold;
    }

    .top-performers, .bug-analysis {
        background: #f0fdf4;
        padding: 15px;
        border-radius: 6px;
        margin-top: 15px;
        border-left: 4px solid #22c55e;
        border: 1px solid #bbf7d0;
    }

    .top-performers h4, .bug-analysis h4 {
        color: #166534;
        margin-bottom: 10px;
        font-size: 1em;
    }

    .top-performers ul, .bug-analysis ul {
        list-style: none;
        padding-left: 0;
    }

    .top-performers li, .bug-analysis li {
        padding: 3px 0;
        color: #166534;
        font-size: 0.9em;
    }

    .comparison-note {
        background: #eff6ff;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 15px;
        border-left: 4px solid #3b82f6;
        border: 1px solid #bfdbfe;
    }

    .comparison-note em {
        color: #1e40af;
        font-size: 0.9em;
    }

    .neutral {
        color: #6c757d;
        font-weight: bold;
    }

    .trend-analysis {
        margin-top: 20px;
        padding: 15px;
        background: #f9fafb;
        border-radius: 6px;
        border-left: 4px solid #6b7280;
        border: 1px solid #e5e7eb;
    }

    .trend-analysis h4 {
        color: #374151;
        margin-bottom: 10px;
        font-size: 1em;
    }

    .trends {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }

    .trend-item {
        background: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 0.9em;
        border: 1px solid #e5e7eb;
        white-space: nowrap;
        color: #374151;
    }

    .trend-item.positive {
        color: #166534;
        background: #dcfce7;
        border-color: #bbf7d0;
    }

    .trend-item.negative {
        color: #991b1b;
        background: #fee2e2;
        border-color: #fecaca;
    }

    @media (max-width: 768px) {
        .container {
            padding: 15px;
        }

        .key-metrics {
            grid-template-columns: repeat(2, 1fr);
        }

        .team-stats {
            grid-template-columns: 1fr;
        }

        .header h1 {
            font-size: 1.8em;
        }
    }    @media (prefers-color-scheme: dark) {
        body {
            background-color: #111827;
            color: #f3f4f6;
        }

        .container {
            background: #1f2937;
            color: #f3f4f6;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }

        .header h1 {
            color: #f9fafb;
        }

        .header .subtitle {
            color: #9ca3af;
        }

        .header {
            border-bottom: 2px solid #374151;
        }

        .executive-summary {
            background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
        }

        .section {
            background: #374151;
            color: #f3f4f6;
            border-color: #4b5563;
        }

        .section h3 {
            color: #f9fafb;
            border-bottom: 2px solid #4b5563;
        }

        .priority-table th, .comparison-table th {
            background-color: #4b5563;
            color: #f3f4f6;
        }

        .priority-table td, .comparison-table td {
            border-bottom: 1px solid #4b5563;
        }

        .priority-table tr.critical {
            background-color: #7f1d1d;
        }

        .stat {
            background: #4b5563;
            color: #f3f4f6;
            border-color: #6b7280;
        }

        .stat.alert {
            background: #991b1b;
            color: #fecaca;
            border-color: #dc2626;
        }

        .stat.success {
            background: #166534;
            color: #bbf7d0;
            border-color: #22c55e;
        }

        .workload-alert {
            background: #451a03;
            border: 1px solid #92400e;
            color: #fbbf24;
        }

        .workload-alert h4 {
            color: #fbbf24;
        }

        .workload-alert li {
            color: #fde68a;
        }

        .footer {
            border-top: 1px solid #374151;
            color: #9ca3af;
        }

        .risk-alerts, .burnout-alert {
            background: rgba(127, 29, 29, 0.4);
            border-left: 4px solid #ef4444;
            border-color: #dc2626;
        }

        .risk-alerts h3, .burnout-alert h3 {
            color: #fca5a5;
        }

        .risk-alerts li {
            color: #fecaca;
        }

        .burnout-alert p {
            color: #fecaca;
        }

        .top-performers, .bug-analysis {
            background: #14532d;
            border-left: 4px solid #22c55e;
            border-color: #16a34a;
        }

        .top-performers h4, .bug-analysis h4 {
            color: #bbf7d0;
        }

        .top-performers li, .bug-analysis li {
            color: #bbf7d0;
        }

        .comparison-note {
            background: #1e3a8a;
            border-left: 4px solid #3b82f6;
            border-color: #2563eb;
        }

        .comparison-note em {
            color: #bfdbfe;
        }

        .trend-analysis {
            background: #374151;
            border-left: 4px solid #6b7280;
            border-color: #4b5563;
        }

        .trend-analysis h4 {
            color: #f3f4f6;
        }

        .trend-item {
            background: #4b5563;
            border-color: #6b7280;
            color: #f3f4f6;
        }

        .trend-item.positive {
            background: #14532d;
            border-color: #16a34a;
            color: #bbf7d0;
        }

        .trend-item.negative {
            background: #7f1d1d;
            border-color: #dc2626;
            color: #fecaca;
        }
    }
</style>
`;

// Generate the complete HTML report
const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Executive Sprint Report</title>
    ${cssStyles}
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Executive Sprint Report</h1>
            <div class="subtitle">${
							currentSprint ? currentSprint.title : 'Sprint Analysis'
						} - ${formattedDate}</div>
        </div>

        ${executiveSummary}

        <div class="section">
            ${priorityAnalysis}
        </div>

        <div class="section">
            ${teamOverview}
        </div>

        <div class="section">
            ${sprintComparison}
        </div>

        <div class="footer">
            <p>Data extracted from GitHub Projects on ${formattedDate}</p>
        </div>
    </div>
</body>
</html>
`;

// Return the formatted HTML and email subject
return {
	json: {
		subject: `Executive Sprint Report - ${
			currentSprint ? currentSprint.title : 'Sprint Analysis'
		} - ${today.toLocaleDateString('pt-BR')}`,
		emailHtml: emailHtml,
		summary: {
			sprintTitle: currentSprint ? currentSprint.title : 'N/A',
			completionRate: currentSprint
				? parseFloat(currentSprint.sprintCompletionRate).toFixed(1)
				: '0.0',
			totalIssues: currentSprint ? currentSprint.totalIssues : 0,
			totalMembers: currentSprint ? currentSprint.totalMembers : 0,
			bugFixRate: currentSprint
				? parseFloat(currentSprint.bugFixRate).toFixed(1)
				: '0.0',
			throughputRate: currentSprint
				? parseFloat(currentSprint.issueThroughputRate).toFixed(1)
				: '0.0',
		},
	},
};

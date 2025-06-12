// Função auxiliar para verificar se um valor existe
function exists(value) {
	return value !== null && value !== undefined;
}

// Tenta obter os dados do processamento anterior de forma robusta
let sprintData;

// Tenta várias estruturas possíveis
if (exists($input)) {
	if (exists($input.json)) {
		if (Array.isArray($input.json) && $input.json.length > 0) {
			sprintData = $input.json; // Array de sprints direto
		} else if (
			exists($input.json.summarySprints) &&
			Array.isArray($input.json.summarySprints)
		) {
			sprintData = $input.json.summarySprints; // Dados em summarySprints
		} else {
			sprintData = $input.json; // Caso seja um objeto direto
		}
	} else if (exists($input.item) && exists($input.item.json)) {
		if (
			exists($input.item.json.summarySprints) &&
			Array.isArray($input.item.json.summarySprints)
		) {
			sprintData = $input.item.json.summarySprints; // Estrutura n8n com summarySprints
		} else if (Array.isArray($input.item.json)) {
			sprintData = $input.item.json; // Array direto em item.json
		} else {
			sprintData = $input.item.json; // Estrutura comum em n8n
		}
	} else if (exists($input.context) && exists($input.item)) {
		// Estrutura específica do n8n mostrada no erro
		if (exists($input.item.json) && exists($input.item.json.summarySprints)) {
			sprintData = $input.item.json.summarySprints;
		}
	} else {
		sprintData = $input; // Último recurso
	}
}

// Se ainda não encontramos dados úteis
if (
	!exists(sprintData) ||
	!Array.isArray(sprintData) ||
	sprintData.length === 0
) {
	// Tentar identificar onde estão os dados para debug
	let debugInfo = 'Estruturas encontradas: ';
	if (exists($input.json)) debugInfo += 'json ';
	if (exists($input.item)) debugInfo += 'item ';
	if (exists($input.item) && exists($input.item.json))
		debugInfo += 'item.json ';
	if (
		exists($input.item) &&
		exists($input.item.json) &&
		exists($input.item.json.summarySprints)
	)
		debugInfo += 'item.json.summarySprints ';
	if (exists($input.context)) debugInfo += 'context ';

	return {
		json: {
			error: true,
			message: 'Não foi possível obter os dados das sprints',
			debug: debugInfo,
			sprintDataType: typeof sprintData,
			sprintDataLength: Array.isArray(sprintData)
				? sprintData.length
				: 'not array',
			inputStructure: JSON.stringify($input).substring(0, 500) + '...',
		},
	};
}

// Encontrar a sprint atual
const currentSprint =
	sprintData.find((sprint) => sprint.currentSprint) || sprintData[0];
const lastSprints = sprintData
	.filter((sprint) => !sprint.currentSprint)
	.slice(0, 3);

// Formatar a data atual
const dateOptions = {
	weekday: 'long',
	day: 'numeric',
	month: 'long',
	year: 'numeric',
};
const today = new Date();
const formattedDate = today.toLocaleDateString('pt-BR', dateOptions);

// Criar estatísticas rápidas para a sprint atual
const quickStats = [];

// Sprint atual - informações básicas
if (currentSprint) {
	quickStats.push(`
		<div class="stat-card">
			<h3>Sprint Atual: ${currentSprint.title}</h3>
			<table class="stats-table">
				<tr><th>Métrica</th><th>Valor</th></tr>
				<tr><td>Total de Issues</td><td align="center"><b>${currentSprint.totalIssues}</b></td></tr>
				<tr><td>Total de Membros</td><td align="center"><b>${currentSprint.totalMembers}</b></td></tr>
				<tr><td>Estimativa Total</td><td align="center"><b>${currentSprint.totalSprintEstimate}</b> pontos</td></tr>
				<tr><td>Taxa de Conclusão</td><td align="center"><b>${currentSprint.sprintCompletionRate}%</b></td></tr>
			</table>
		</div>
	`);

	// Progresso de entrega
	quickStats.push(`
		<div class="stat-card">
			<h3>Progresso de Entrega</h3>
			<table class="stats-table">
				<tr><th>Status</th><th>Pontos</th></tr>
				<tr><td>Entregues</td><td align="center"><b>${
					currentSprint.totalEstimateDelivered
				}</b></td></tr>
				<tr><td>Pendentes</td><td align="center"><b>${
					currentSprint.totalEstimatePending
				}</b></td></tr>
				<tr><td>Taxa de Issues</td><td align="center"><b>${currentSprint.issueThroughputRate.toFixed(
					2,
				)}</b></td></tr>
				<tr><td>Taxa por Membro</td><td align="center"><b>${currentSprint.membersThroughputRate.toFixed(
					2,
				)}</b></td></tr>
			</table>
		</div>
	`);

	// Informações de bugs
	quickStats.push(`
		<div class="stat-card">
			<h3>Status de Bugs</h3>
			<table class="stats-table">
				<tr><th>Métrica</th><th>Valor</th></tr>
				<tr><td>Total de Bugs</td><td align="center"><b>${
					currentSprint.totalBugs
				}</b></td></tr>
				<tr><td>Bugs Resolvidos</td><td align="center"><b>${
					currentSprint.totalBugsDelivered
				}</b></td></tr>
				<tr><td>Bugs Pendentes</td><td align="center"><b>${
					currentSprint.totalBugsPending
				}</b></td></tr>
				<tr><td>Taxa de Resolução</td><td align="center"><b>${currentSprint.bugFixRate.toFixed(
					1,
				)}%</b></td></tr>
			</table>
		</div>
	`);

	// Distribuição por prioridade
	if (currentSprint.issueCountByType) {
		const priorityRows = Object.entries(currentSprint.issueCountByType)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(
				([priority, count]) =>
					`<tr><td>${priority}</td><td align="center"><b>${count}</b></td></tr>`,
			)
			.join('');

		quickStats.push(`
			<div class="stat-card">
				<h3>Distribuição por Prioridade</h3>
				<table class="stats-table">
					<tr><th>Prioridade</th><th>Quantidade</th></tr>
					${priorityRows}
				</table>
			</div>
		`);
	}
}

// Criar detalhes por responsável para a sprint atual
let memberDetails = '';

if (currentSprint && currentSprint.issueCountByAssignee) {
	memberDetails += '<h2>Detalhes por Responsável - Sprint Atual</h2>';

	// Criar tabela detalhada por membro
	memberDetails += `
		<div class="status-section">
			<table class="issue-table">
				<tr>
					<th>Responsável</th>
					<th>Issues</th>
					<th>Estimativa Total</th>
					<th>Entregue</th>
					<th>Pendente</th>
					<th>% Conclusão</th>
				</tr>
	`;

	Object.entries(currentSprint.issueCountByAssignee).forEach(
		([assignee, issueCount]) => {
			const totalEstimate =
				currentSprint.estimateTotalByAssignee[assignee] || 0;
			const deliveredEstimate =
				currentSprint.estimateDeliveredByAssignee[assignee] || 0;
			const pendingEstimate =
				currentSprint.estimatePendingByAssignee[assignee] || 0;
			const completionRate =
				totalEstimate > 0
					? ((deliveredEstimate / totalEstimate) * 100).toFixed(1)
					: '0.0';

			let rowClass = '';
			if (completionRate == 100) rowClass = 'completion-100';
			else if (completionRate >= 80) rowClass = 'completion-high';
			else if (completionRate >= 50) rowClass = 'completion-medium';
			else if (completionRate > 0) rowClass = 'completion-low';

			memberDetails += `
			<tr class="${rowClass}">
				<td><strong>${assignee}</strong></td>
				<td align="center">${issueCount}</td>
				<td align="center">${totalEstimate}</td>
				<td align="center">${deliveredEstimate}</td>
				<td align="center">${pendingEstimate}</td>
				<td align="center">
					<div class="mini-progress-bar-container">
						<div class="mini-progress-bar" style="width: ${completionRate}%">
							${completionRate}%
						</div>
					</div>
				</td>
			</tr>
		`;
		},
	);

	memberDetails += '</table></div>';
}

// Adicionar comparativo com sprints anteriores
let sprintComparison = '';

if (lastSprints.length > 0) {
	sprintComparison += '<h2>Comparativo com Sprints Anteriores</h2>';

	sprintComparison += `
		<div class="status-section">
			<table class="issue-table">
				<tr>
					<th>Sprint</th>
					<th>Período</th>
					<th>Issues</th>
					<th>Estimativa</th>
					<th>Taxa Conclusão</th>
					<th>Taxa Bugs</th>
					<th>Throughput</th>
				</tr>
	`;

	// Adicionar sprint atual primeiro
	if (currentSprint) {
		sprintComparison += `
			<tr class="current-sprint-row">
				<td><strong>${currentSprint.title} (Atual)</strong></td>
				<td>${new Date(currentSprint.startDate).toLocaleDateString(
					'pt-BR',
				)} - ${new Date(currentSprint.endDate).toLocaleDateString('pt-BR')}</td>
				<td align="center">${currentSprint.totalIssues}</td>
				<td align="center">${currentSprint.totalSprintEstimate}</td>
				<td align="center">${currentSprint.sprintCompletionRate}%</td>
				<td align="center">${currentSprint.bugFixRate.toFixed(1)}%</td>
				<td align="center">${currentSprint.issueThroughputRate.toFixed(1)}</td>
			</tr>
		`;
	}

	// Adicionar sprints anteriores
	lastSprints.forEach((sprint) => {
		sprintComparison += `
			<tr>
				<td>${sprint.title}</td>
				<td>${new Date(sprint.startDate).toLocaleDateString('pt-BR')} - ${new Date(
			sprint.endDate,
		).toLocaleDateString('pt-BR')}</td>
				<td align="center">${sprint.totalIssues}</td>
				<td align="center">${sprint.totalSprintEstimate}</td>
				<td align="center">${sprint.sprintCompletionRate}%</td>
				<td align="center">${sprint.bugFixRate.toFixed(1)}%</td>
				<td align="center">${sprint.issueThroughputRate.toFixed(1)}</td>
			</tr>
		`;
	});

	sprintComparison += '</table></div>';
}

// Montar o HTML final
const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Resumo da Sprint: ${
		currentSprint ? currentSprint.title : 'Relatório de Sprints'
	}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    h1 {
      color: #205375;
      border-bottom: 2px solid #205375;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }

    h2 {
      color: #2C74B3;
      margin-top: 30px;
      padding-bottom: 5px;
      border-bottom: 1px solid #ddd;
    }

    h3 {
      color: #0A2647;
      margin-top: 0;
    }

    .count {
      font-size: 0.8em;
      color: #666;
      font-weight: normal;
    }

    .stats-container {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 30px;
    }

    .stat-card {
      flex: 1;
      min-width: 300px;
      background-color: #f9f9f9;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .stats-table {
      width: 100%;
      border-collapse: collapse;
    }

    .stats-table th, .stats-table td {
      padding: 8px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }

    .stats-table th {
      background-color: #f2f2f2;
    }

    .status-section {
      margin-bottom: 40px;
    }

    .issue-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    .issue-table th, .issue-table td {
      padding: 10px;
      border: 1px solid #ddd;
    }

    .issue-table th {
      background-color: #f2f2f2;
      text-align: left;
    }

    .issue-table tr:nth-child(even) {
      background-color: #f9f9f9;
    }

    .current-sprint-row {
      background-color: #e8f4f8 !important;
      font-weight: bold;
    }

    .completion-100 {
      background-color: #d4edda !important;
    }

    .completion-high {
      background-color: #d1ecf1 !important;
    }

    .completion-medium {
      background-color: #fff3cd !important;
    }

    .completion-low {
      background-color: #f8d7da !important;
    }

    .status-summary {
      background-color: #eef6ff !important;
      font-size: 0.9em;
    }

    .priority-highest {
      background-color: #ffeeee !important;
    }

    .priority-high {
      background-color: #fff8e1 !important;
    }

    a {
      color: #2C74B3;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .date {
      font-style: italic;
      color: #666;
      margin-bottom: 30px;
    }

    .summary-box {
      background-color: #e9f5ff;
      border-left: 4px solid #2C74B3;
      padding: 15px;
      margin-bottom: 30px;
    }

    .sprint-info {
      background-color: #f0f8ff;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 30px;
      border: 1px solid #d1e3ff;
    }

    .progress-bar-container {
      background-color: #eee;
      border-radius: 5px;
      margin: 10px 0;
      height: 25px;
    }

    .progress-bar {
      height: 25px;
      background-color: #2C74B3;
      border-radius: 5px;
      color: white;
      text-align: center;
      line-height: 25px;
      font-size: 13px;
      font-weight: bold;
    }

    .mini-progress-bar-container {
      background-color: #eee;
      border-radius: 3px;
      margin: 0;
      height: 15px;
      width: 100%;
    }

    .mini-progress-bar {
      height: 15px;
      background-color: #4CAF50;
      border-radius: 3px;
      color: white;
      text-align: center;
      line-height: 15px;
      font-size: 11px;
      font-weight: bold;
    }

    .footer {
      margin-top: 50px;
      border-top: 1px solid #ddd;
      padding-top: 20px;
      color: #666;
      font-size: 0.9em;
      text-align: center;
    }

    .team-summary {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 30px;
    }

    .metric-highlight {
      background-color: #fff;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      padding: 10px;
      margin: 5px 0;
      display: inline-block;
      min-width: 120px;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>Relatório de Sprint - ${
		currentSprint ? currentSprint.title : 'Análise Geral'
	}</h1>
  <p class="date">Relatório gerado em: ${formattedDate}</p>

  ${
		currentSprint
			? `
  <div class="sprint-info">
    <h3>📊 Sprint Atual: ${currentSprint.title}</h3>
    <p><strong>Período:</strong> ${new Date(
			currentSprint.startDate,
		).toLocaleDateString('pt-BR')} a ${new Date(
					currentSprint.endDate,
			  ).toLocaleDateString('pt-BR')} (${currentSprint.duration} dias)</p>

    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin: 15px 0;">
      <div class="metric-highlight">
        <div style="font-size: 24px; font-weight: bold; color: #2C74B3;">${
					currentSprint.sprintCompletionRate
				}%</div>
        <div style="font-size: 12px; color: #666;">Taxa de Conclusão</div>
      </div>
      <div class="metric-highlight">
        <div style="font-size: 24px; font-weight: bold; color: #28a745;">${
					currentSprint.totalEstimateDelivered
				}</div>
        <div style="font-size: 12px; color: #666;">Pontos Entregues</div>
      </div>
      <div class="metric-highlight">
        <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${
					currentSprint.totalEstimatePending
				}</div>
        <div style="font-size: 12px; color: #666;">Pontos Pendentes</div>
      </div>
      <div class="metric-highlight">
        <div style="font-size: 24px; font-weight: bold; color: #ffc107;">${currentSprint.bugFixRate.toFixed(
					1,
				)}%</div>
        <div style="font-size: 12px; color: #666;">Taxa Resolução Bugs</div>
      </div>
    </div>

    <div class="progress-bar-container">
      <div class="progress-bar" style="width: ${
				currentSprint.sprintCompletionRate
			}%">
        ${currentSprint.sprintCompletionRate}% Completo
      </div>
    </div>
  </div>
  `
			: ''
	}

  <div class="summary-box">
    <h3>📈 Resumo Executivo</h3>
    ${
			currentSprint
				? `
    <p><strong>Sprint:</strong> ${currentSprint.title} (${
						currentSprint.currentSprint ? 'Em andamento' : 'Finalizada'
				  })</p>
    <p><strong>Equipe:</strong> ${currentSprint.totalMembers} membros ativos</p>
    <p><strong>Workload:</strong> ${
			currentSprint.totalIssues
		} issues totalizando ${currentSprint.totalSprintEstimate} pontos</p>
    <p><strong>Performance:</strong> Taxa de throughput de ${currentSprint.issueThroughputRate.toFixed(
			2,
		)} issues/dia e ${currentSprint.membersThroughputRate.toFixed(
						2,
				  )} pontos/membro</p>
    <p><strong>Qualidade:</strong> ${
			currentSprint.totalBugs
		} bugs no total, com ${currentSprint.bugFixRate.toFixed(
						1,
				  )}% de taxa de resolução</p>
    `
				: '<p>Dados de sprint não disponíveis</p>'
		}
  </div>

  <div class="stats-container">
    ${quickStats.join('')}
  </div>

  ${memberDetails}

  ${sprintComparison}

  <div class="footer">
    <p>Este relatório é gerado automaticamente pela automação n8n do time Interlis.</p>
    <p>Dados extraídos do GitHub Projects em ${formattedDate}</p>
  </div>
</body>
</html>
`;

// Retornar o HTML formatado e o assunto do email
return {
	json: {
		emailHtml: emailHtml,
		subject: `📊 Relatório Sprint ${
			currentSprint ? currentSprint.title : 'Análise'
		} - ${today.toLocaleDateString('pt-BR')}`,
		summary: {
			sprintTitle: currentSprint ? currentSprint.title : 'N/A',
			completionRate: currentSprint ? currentSprint.sprintCompletionRate : 0,
			totalIssues: currentSprint ? currentSprint.totalIssues : 0,
			totalMembers: currentSprint ? currentSprint.totalMembers : 0,
			bugFixRate: currentSprint ? currentSprint.bugFixRate.toFixed(1) : '0.0',
			throughputRate: currentSprint
				? currentSprint.issueThroughputRate.toFixed(2)
				: '0.00',
		},
	},
};

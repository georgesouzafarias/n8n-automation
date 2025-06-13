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
			<h3>📊 Sprint Atual: ${currentSprint.title}</h3>
			<table class="stats-table">
				<tr><th>Métrica</th><th>Valor</th></tr>
				<tr><td>Total de Issues</td><td align="center"><b>${
					currentSprint.totalIssues
				}</b></td></tr>
				<tr><td>Total de Membros</td><td align="center"><b>${
					currentSprint.totalMembers
				}</b></td></tr>
				<tr><td>Estimativa Total</td><td align="center"><b>${
					currentSprint.totalSprintEstimate
				}</b> pontos</td></tr>
				<tr><td>Taxa de Conclusão</td><td align="center"><b>${currentSprint.sprintCompletionRate.toFixed(
					2,
				)}%</b></td></tr>
			</table>
		</div>
	`);

	// Progresso de entrega
	quickStats.push(`
		<div class="stat-card">
			<h3>🎯 Progresso de Entrega</h3>
			<table class="stats-table">
				<tr><th>Status</th><th>Pontos</th></tr>
				<tr><td>Entregues</td><td align="center"><b>${
					currentSprint.totalEstimateDelivered
				}</b></td></tr>
				<tr><td>Pendentes</td><td align="center"><b>${
					currentSprint.totalEstimatePending
				}</b></td></tr>
				<tr><td>Taxa de Issues</td><td align="center"><b>${currentSprint.issueThroughputRate.toFixed(
					1,
				)}</b>/dia</td></tr>
				<tr><td>Taxa por Membro</td><td align="center"><b>${currentSprint.membersThroughputRate.toFixed(
					1,
				)}</b> pts</td></tr>
			</table>
		</div>
	`);

	// Informações de bugs
	quickStats.push(`
		<div class="stat-card">
			<h3>🐛 Status de Bugs</h3>
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

	// Distribuição por tipo de issue
	if (currentSprint.issueCountByType) {
		const typeRows = Object.entries(currentSprint.issueCountByType)
			.sort(([, a], [, b]) => b - a)
			.map(([type, count]) => {
				const percentage = ((count / currentSprint.totalIssues) * 100).toFixed(
					1,
				);
				let emoji = '';
				switch (type) {
					case 'Bug':
						emoji = '🐛';
						break;
					case 'Feature':
						emoji = '✨';
						break;
					case 'Task':
						emoji = '📋';
						break;
					case 'Spike':
						emoji = '🔍';
						break;
					default:
						emoji = '📝';
				}
				return `<tr><td>${emoji} ${type}</td><td align="center"><b>${count}</b></td><td align="center">${percentage}%</td></tr>`;
			})
			.join('');

		quickStats.push(`
			<div class="stat-card">
				<h3>📈 Distribuição por Tipo</h3>
				<table class="stats-table">
					<tr><th>Tipo</th><th>Qtd</th><th>%</th></tr>
					${typeRows}
				</table>
			</div>
		`);
	}

	// Status atual das issues
	if (currentSprint.issueCountByStatus) {
		const statusRows = Object.entries(currentSprint.issueCountByStatus)
			.sort(([, a], [, b]) => b - a)
			.map(([status, count]) => {
				const points = currentSprint.estimateTotalByStatus[status] || 0;
				let emoji = '';
				switch (status) {
					case 'Ready':
						emoji = '⏳';
						break;
					case 'In progress':
						emoji = '🔄';
						break;
					case 'In review':
						emoji = '👀';
						break;
					case 'Test':
						emoji = '🧪';
						break;
					case 'Blocked':
						emoji = '🚫';
						break;
					case 'Deployed to Production':
						emoji = '🚀';
						break;
					case 'Deployed to Staging':
						emoji = '🏗️';
						break;
					default:
						emoji = '📝';
				}
				return `<tr><td>${emoji} ${status}</td><td align="center"><b>${count}</b></td><td align="center">${points}</td></tr>`;
			})
			.join('');

		quickStats.push(`
			<div class="stat-card">
				<h3>🔄 Status das Issues</h3>
				<table class="stats-table">
					<tr><th>Status</th><th>Qtd</th><th>Pts</th></tr>
					${statusRows}
				</table>
			</div>
		`);
	}
}

// Criar detalhes por responsável para a sprint atual
let memberDetails = '';

if (currentSprint && currentSprint.issueCountByAssignee) {
	memberDetails += '<h2>👥 Detalhes por Responsável - Sprint Atual</h2>';

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

// Adicionar análise de carry over
let carryOverAnalysis = '';

if (
	currentSprint &&
	currentSprint.carryOverEstimatePerSprint &&
	Object.keys(currentSprint.carryOverEstimatePerSprint).length > 0
) {
	carryOverAnalysis += '<h2>📦 Análise de Carry Over</h2>';

	const carryOverEntries = Object.entries(
		currentSprint.carryOverEstimatePerSprint,
	).sort(([, a], [, b]) => b - a);

	const totalCarryOver = carryOverEntries.reduce(
		(sum, [, points]) => sum + points,
		0,
	);
	const carryOverPercentage = (
		(totalCarryOver / currentSprint.totalSprintEstimate) *
		100
	).toFixed(1);

	carryOverAnalysis += `
		<div class="summary-box">
			<p><strong>Total de Carry Over:</strong> ${totalCarryOver} pontos (${carryOverPercentage}% da sprint)</p>
		</div>
		<div class="status-section">
			<table class="issue-table">
				<tr>
					<th>Sprint de Origem</th>
					<th>Pontos</th>
					<th>% do Total</th>
				</tr>
	`;

	carryOverEntries.forEach(([sprintName, points]) => {
		const percentage = ((points / totalCarryOver) * 100).toFixed(1);
		carryOverAnalysis += `
			<tr>
				<td>${sprintName}</td>
				<td align="center"><b>${points}</b></td>
				<td align="center">${percentage}%</td>
			</tr>
		`;
	});

	carryOverAnalysis += '</table></div>';
}

// Adicionar análise por prioridade
let priorityAnalysis = '';

if (
	currentSprint &&
	currentSprint.issueCountByPriority &&
	Object.keys(currentSprint.issueCountByPriority).length > 0
) {
	priorityAnalysis += '<h2>📊 Análise por Prioridade</h2>';

	const priorityColors = {
		P0: '#FF3B30', // Vermelho crítico
		P1: '#FF9500', // Laranja alto
		P2: '#FFCC00', // Amarelo médio-alto
		P3: '#30D158', // Verde médio
		P4: '#007AFF', // Azul baixo
		P5: '#5856D6', // Roxo muito baixo
		P6: '#AF52DE', // Magenta opcional
		P8: '#8E8E93', // Cinza menor
	};

	const priorityLabels = {
		P0: 'Crítica',
		P1: 'Alta',
		P2: 'Média-Alta',
		P3: 'Média',
		P4: 'Baixa',
		P5: 'Muito Baixa',
		P6: 'Opcional',
		P8: 'Menor',
	};

	// Ordenar prioridades por número de issues (decrescente)
	const priorityEntries = Object.entries(
		currentSprint.issueCountByPriority,
	).sort(([, a], [, b]) => b - a);

	priorityAnalysis += `
		<div class="priority-grid">
	`;

	priorityEntries.forEach(([priority, issueCount]) => {
		const estimateTotal =
			currentSprint.estimateTotalByPriority?.[priority] || 0;
		const bugCount = currentSprint.bugCountByPriority?.[priority] || 0;
		const color = priorityColors[priority] || '#8E8E93';
		const label = priorityLabels[priority] || priority;

		priorityAnalysis += `
			<div class="priority-card" style="border-left: 4px solid ${color};">
				<div class="priority-header">
					<span class="priority-badge" style="background: ${color}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">${priority}</span>
					<span class="priority-label" style="font-weight: bold; margin-left: 8px;">${label}</span>
				</div>
				<div class="priority-metrics" style="margin-top: 8px;">
					<div class="priority-row" style="display: flex; justify-content: space-between; margin: 4px 0;">
						<span>📋 Issues:</span>
						<strong>${issueCount}</strong>
					</div>
					<div class="priority-row" style="display: flex; justify-content: space-between; margin: 4px 0;">
						<span>⏱️ Pontos:</span>
						<strong>${estimateTotal}</strong>
					</div>
					${
						bugCount > 0
							? `
						<div class="priority-row" style="display: flex; justify-content: space-between; margin: 4px 0;">
							<span>🐛 Bugs:</span>
							<strong>${bugCount}</strong>
						</div>
					`
							: ''
					}
				</div>
			</div>
		`;
	});

	priorityAnalysis += '</div>';
}

// Adicionar comparativo com sprints anteriores
let sprintComparison = '';

if (lastSprints.length > 0) {
	sprintComparison += '<h2>📊 Comparativo com Sprints Anteriores</h2>';

	sprintComparison += `
		<div class="status-section">
			<table class="issue-table">
				<tr>
					<th>Sprint</th>
					<th>Período</th>
					<th>Issues</th>
					<th>Estimativa</th>
					<th>Throughput</th>
					<th>Observações</th>
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
				<td align="center">${currentSprint.issueThroughputRate.toFixed(1)}</td>
				<td align="center">✅ ${currentSprint.sprintCompletionRate.toFixed(
					2,
				)}% concluído</td>
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
				<td align="center">${sprint.issueThroughputRate.toFixed(1)}</td>
				<td align="center">🏁 Finalizada</td>
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório Sprint - ${
		currentSprint ? currentSprint.title : 'Análise Geral'
	}</title>
  <style>
    /* Reset e base */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f8f9fa;
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .container {
      background-color: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }

    h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 10px;
    }

    .date {
      font-size: 16px;
      opacity: 0.9;
    }

    .content {
      padding: 30px;
    }

    h2 {
      color: #2c3e50;
      margin: 30px 0 20px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #ecf0f1;
      font-size: 24px;
    }

    h3 {
      color: #34495e;
      margin-bottom: 15px;
      font-size: 18px;
    }

    /* Sprint Info Card */
    .sprint-info {
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 30px;
      border-left: 5px solid #2196f3;
    }

    .sprint-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin: 20px 0;
    }

    .metric-highlight {
      background: white;
      border-radius: 8px;
      padding: 15px;
      flex: 1;
      min-width: 120px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .metric-value {
      font-size: 24px;
      font-weight: bold;
      color: #2c3e50;
    }

    .metric-label {
      font-size: 12px;
      color: #7f8c8d;
      margin-top: 5px;
    }

    .progress-bar-container {
      background-color: #ecf0f1;
      border-radius: 10px;
      height: 20px;
      margin: 15px 0;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #4caf50 0%, #45a049 100%);
      color: white;
      text-align: center;
      line-height: 20px;
      font-size: 12px;
      font-weight: bold;
      transition: width 0.3s ease;
    }

    /* Stats Grid */
    .stats-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      border-top: 4px solid #3498db;
    }

    .stats-table {
      width: 100%;
      border-collapse: collapse;
    }

    .stats-table th,
    .stats-table td {
      padding: 10px 8px;
      text-align: left;
      border-bottom: 1px solid #ecf0f1;
    }

    .stats-table th {
      background-color: #f8f9fa;
      font-weight: 600;
      color: #2c3e50;
    }

    .stats-table tbody tr:hover {
      background-color: #f8f9fa;
    }

    /* Issue Tables */
    .status-section {
      margin-bottom: 30px;
    }

    .issue-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .issue-table th,
    .issue-table td {
      padding: 12px;
      border-bottom: 1px solid #ecf0f1;
    }

    .issue-table th {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-weight: 600;
      text-align: left;
    }

    .issue-table tbody tr:nth-child(even) {
      background-color: #f8f9fa;
    }

    .issue-table tbody tr:hover {
      background-color: #e3f2fd;
    }

    /* Status Classes */
    .current-sprint-row {
      background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%) !important;
      font-weight: bold;
    }

    .completion-100 {
      background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%) !important;
    }

    .completion-high {
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%) !important;
    }

    .completion-medium {
      background: linear-gradient(135deg, #fff3e0 0%, #ffcc02 100%) !important;
    }

    .completion-low {
      background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%) !important;
    }

    /* Progress Bars */
    .mini-progress-bar-container {
      background-color: #ecf0f1;
      border-radius: 10px;
      height: 16px;
      width: 100%;
      overflow: hidden;
    }

    .mini-progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #4caf50 0%, #45a049 100%);
      color: white;
      text-align: center;
      line-height: 16px;
      font-size: 11px;
      font-weight: bold;
      transition: width 0.3s ease;
    }

    /* Summary Box */
    .summary-box {
      background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%);
      border-left: 5px solid #2196f3;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }

    /* Links */
    a {
      color: #3498db;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    /* Footer */
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ecf0f1;
      color: #7f8c8d;
      font-size: 14px;
      text-align: center;
    }

    /* Mobile Responsiveness */
    @media screen and (max-width: 768px) {
      body {
        padding: 10px;
      }

      .header {
        padding: 20px;
      }

      h1 {
        font-size: 24px;
      }

      .content {
        padding: 20px;
      }

      .stats-container {
        grid-template-columns: 1fr;
      }

      .sprint-metrics {
        flex-direction: column;
      }

      .metric-highlight {
        min-width: auto;
      }

      .stats-table th,
      .stats-table td,
      .issue-table th,
      .issue-table td {
        padding: 8px 4px;
        font-size: 14px;
      }

      h2 {
        font-size: 20px;
      }

      h3 {
        font-size: 16px;
      }
    }

    /* iPhone 15 Pro Max specific optimizations */
    @media screen and (max-width: 430px) and (max-height: 932px) {
      .issue-table {
        font-size: 13px;
      }

      .issue-table th,
      .issue-table td {
        padding: 6px 3px;
      }

      .stat-card {
        padding: 15px;
      }

      .metric-value {
        font-size: 20px;
      }
    }

    /* Dark mode support - Otimizado para mobile */
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #000000;
        color: #ffffff;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      .container {
        background-color: #1c1c1e;
        border: 1px solid #38383a;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
      }

      .header {
        background: linear-gradient(135deg, #1d1d1f 0%, #000000 100%);
        border-bottom: 1px solid #38383a;
      }

      .stat-card {
        background-color: #1c1c1e;
        border: 1px solid #38383a;
        border-top: 4px solid #007aff;
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      }

      .issue-table {
        background-color: #1c1c1e;
        border: 1px solid #38383a;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      }

      .sprint-info {
        background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
        border: 1px solid #38383a;
        border-left: 5px solid #007aff;
        color: #ffffff;
      }

      .summary-box {
        background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
        border: 1px solid #38383a;
        border-left: 5px solid #34c759;
        color: #ffffff;
      }

      .stats-table th {
        background-color: #2c2c2e;
        color: #ffffff;
        border-bottom: 2px solid #38383a;
        font-weight: 600;
      }

      .stats-table td {
        color: #ffffff;
        border-bottom: 1px solid #38383a;
      }

      .stats-table tbody tr:hover {
        background-color: #2c2c2e;
      }

      .issue-table th {
        background: linear-gradient(135deg, #2c2c2e 0%, #1c1c1e 100%);
        color: #ffffff;
        border-bottom: 2px solid #38383a;
        font-weight: 600;
      }

      .issue-table td {
        color: #ffffff;
        border-bottom: 1px solid #38383a;
      }

      .issue-table tbody tr:nth-child(even) {
        background-color: #2c2c2e;
      }

      .issue-table tbody tr:hover {
        background-color: #38383a;
      }

      .metric-highlight {
        background-color: #2c2c2e;
        color: #ffffff;
        border: 1px solid #38383a;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      }

      .metric-value {
        color: #ffffff;
        font-weight: 700;
      }

      .metric-label {
        color: #8e8e93;
        font-weight: 500;
      }

      h1, h2, h3 {
        color: #ffffff;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      }

      /* Status row colors for better contrast */
      .current-sprint-row {
        background: linear-gradient(135deg, #1e3a1e 0%, #2d5a2d 100%) !important;
        color: #ffffff !important;
        border: 1px solid #34c759 !important;
      }

      .completion-100 {
        background: linear-gradient(135deg, #1e3a1e 0%, #2d5a2d 100%) !important;
        color: #ffffff !important;
      }

      .completion-high {
        background: linear-gradient(135deg, #1e2a3a 0%, #2d4a5a 100%) !important;
        color: #ffffff !important;
      }

      .completion-medium {
        background: linear-gradient(135deg, #3a2a1e 0%, #5a4a2d 100%) !important;
        color: #ffffff !important;
      }

      .completion-low {
        background: linear-gradient(135deg, #3a1e1e 0%, #5a2d2d 100%) !important;
        color: #ffffff !important;
      }

      /* Progress bars */
      .progress-bar-container {
        background-color: #2c2c2e;
        border: 1px solid #38383a;
      }

      .progress-bar {
        background: linear-gradient(90deg, #34c759 0%, #30d158 100%);
        color: #000000;
        font-weight: 700;
      }

      .mini-progress-bar-container {
        background-color: #2c2c2e;
        border: 1px solid #38383a;
      }

      .mini-progress-bar {
        background: linear-gradient(90deg, #34c759 0%, #30d158 100%);
        color: #000000;
        font-weight: 700;
      }

      /* Links */
      a {
        color: #007aff;
      }

      a:hover {
        color: #0051d0;
      }

      .footer {
        color: #8e8e93;
        border-top: 1px solid #38383a;
      }

      /* Mobile dark mode specific improvements */
      @media screen and (max-width: 768px) {
        body {
          font-size: 17px;
          line-height: 1.6;
          background-color: #000000;
        }

        .container {
          border-radius: 0;
          margin: 0;
        }

        .stats-table th,
        .stats-table td {
          font-size: 16px;
          font-weight: 600;
          padding: 12px 8px;
        }

        .issue-table th,
        .issue-table td {
          font-size: 16px;
          font-weight: 600;
          padding: 12px 8px;
        }

        .metric-value {
          font-size: 24px;
          font-weight: 700;
        }

        .metric-label {
          font-size: 14px;
          font-weight: 600;
        }

        h1 {
          font-size: 26px;
        }

        h2 {
          font-size: 22px;
        }

        h3 {
          font-size: 18px;
        }
      }

      /* iPhone specific dark mode optimizations */
      @media screen and (max-width: 430px) {
        body {
          font-size: 18px;
          line-height: 1.7;
        }

        .issue-table th,
        .issue-table td {
          font-size: 17px;
          font-weight: 600;
          line-height: 1.5;
          padding: 14px 8px;
        }

        .stats-table th,
        .stats-table td {
          font-size: 17px;
          font-weight: 600;
          padding: 14px 8px;
        }

        .metric-value {
          font-size: 26px;
          font-weight: 700;
        }

        .stat-card {
          padding: 20px;
          margin-bottom: 16px;
        }

        .sprint-info,
        .summary-box {
          padding: 20px;
          margin-bottom: 16px;
        }
      }

      /* Priority Analysis Styles */
      .priority-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        margin: 20px 0;
      }

      .priority-card {
        background: white;
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: transform 0.2s ease;
      }

      .priority-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      }

      .priority-header {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
        font-size: 14px;
      }

      .priority-badge {
        display: inline-block;
        min-width: 32px;
        text-align: center;
        border-radius: 12px;
        font-weight: bold;
        font-size: 12px;
      }

      .priority-label {
        font-weight: bold;
        margin-left: 8px;
        color: #2c3e50;
      }

      .priority-metrics {
        margin-top: 8px;
      }

      .priority-row {
        display: flex;
        justify-content: space-between;
        margin: 4px 0;
        font-size: 14px;
        color: #34495e;
      }

      /* Dark mode for priority cards */
      @media (prefers-color-scheme: dark) {
        .priority-card {
          background: #1c1c1e;
          border: 1px solid #38383a;
        }

        .priority-label {
          color: #ffffff;
        }

        .priority-row {
          color: #e5e5e7;
        }
      }

      /* Mobile responsive for priority grid */
      @media screen and (max-width: 768px) {
        .priority-grid {
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .priority-card {
          padding: 14px;
        }

        .priority-row {
          font-size: 16px;
          font-weight: 600;
          padding: 2px 0;
        }
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Relatório de Sprint</h1>
      <div class="date">${formattedDate}</div>
    </div>

    <div class="content">
      ${
				currentSprint
					? `
        <div class="sprint-info">
          <h3>Sprint ${currentSprint.title}</h3>
          <p><strong>Período:</strong> ${new Date(
						currentSprint.startDate,
					).toLocaleDateString('pt-BR')} a ${new Date(
							currentSprint.endDate,
					  ).toLocaleDateString('pt-BR')} (${currentSprint.duration} dias)</p>

          <div class="sprint-metrics">
            <div class="metric-highlight">
              <div class="metric-value">${currentSprint.sprintCompletionRate.toFixed(
								2,
							)}%</div>
              <div class="metric-label">Taxa de Conclusão</div>
            </div>
            <div class="metric-highlight">
              <div class="metric-value">${
								currentSprint.totalEstimateDelivered
							}</div>
              <div class="metric-label">Pontos Entregues</div>
            </div>
            <div class="metric-highlight">
              <div class="metric-value">${
								currentSprint.totalEstimatePending
							}</div>
              <div class="metric-label">Pontos Pendentes</div>
            </div>
            <div class="metric-highlight">
              <div class="metric-value">${currentSprint.bugFixRate.toFixed(
								1,
							)}%</div>
              <div class="metric-label">Taxa Resolução Bugs</div>
            </div>
          </div>

          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${currentSprint.sprintCompletionRate.toFixed(
							2,
						)}%">
              ${currentSprint.sprintCompletionRate.toFixed(2)}% Completo
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
          <p><strong>Equipe:</strong> ${
						currentSprint.totalMembers
					} membros ativos</p>
          <p><strong>Workload:</strong> ${
						currentSprint.totalIssues
					} issues totalizando ${currentSprint.totalSprintEstimate} pontos</p>
          <p><strong>Performance:</strong> Taxa de throughput de ${currentSprint.issueThroughputRate.toFixed(
						1,
					)} issues/dia e ${currentSprint.membersThroughputRate.toFixed(
								1,
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

      ${carryOverAnalysis}

      ${priorityAnalysis}

      ${sprintComparison}

      <div class="footer">
        <p>Dados extraídos do GitHub Projects em ${formattedDate}</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

// Retornar o HTML formatado e o assunto do email
return {
	json: {
		subject: `📊 Relatório Sprint ${
			currentSprint ? currentSprint.title : 'Análise'
		} - ${today.toLocaleDateString('pt-BR')}`,
		emailHtml: emailHtml,
		summary: {
			sprintTitle: currentSprint ? currentSprint.title : 'N/A',
			completionRate: currentSprint ? currentSprint.sprintCompletionRate : 0,
			totalIssues: currentSprint ? currentSprint.totalIssues : 0,
			totalMembers: currentSprint ? currentSprint.totalMembers : 0,
			bugFixRate: currentSprint ? currentSprint.bugFixRate.toFixed(1) : '0.0',
			throughputRate: currentSprint
				? currentSprint.issueThroughputRate.toFixed(1)
				: '0.0',
		},
	},
};

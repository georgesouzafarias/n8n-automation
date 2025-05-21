// Função auxiliar para verificar se um valor existe
function exists(value) {
	return value !== null && value !== undefined;
}

// Tenta obter os dados do processamento anterior de forma robusta
let summary;

// Tenta várias estruturas possíveis
if (exists($input)) {
	if (exists($input.json)) {
		if (Array.isArray($input.json) && $input.json.length > 0) {
			summary = $input.json[0]; // Caso seja um array
		} else {
			summary = $input.json; // Caso seja um objeto direto
		}
	} else if (exists($input.item) && exists($input.item.json)) {
		summary = $input.item.json; // Estrutura comum em n8n
	} else {
		summary = $input; // Último recurso
	}
}

// Se ainda não encontramos dados úteis
if (
	!exists(summary) ||
	(!exists(summary.issuesByStatus) && !exists(summary.statusCounts))
) {
	return {
		json: {
			error: true,
			message: 'Não foi possível obter os dados do processamento anterior',
			inputStructure: JSON.stringify($input).substring(0, 500) + '...',
		},
	};
}

// Formatar a data atual
const dateOptions = {
	weekday: 'long',
	day: 'numeric',
	month: 'long',
	year: 'numeric',
};
const today = new Date();
const formattedDate = today.toLocaleDateString('pt-BR', dateOptions);

// Criar estatísticas rápidas
const quickStats = [];

// Contador por status
if (summary.statusCounts) {
	const statusRows = Object.entries(summary.statusCounts)
		.map(
			([status, count]) =>
				`<tr><td>${status}</td><td align="center"><b>${count}</b></td></tr>`,
		)
		.join('');

	quickStats.push(`
    <div class="stat-card">
      <h3>Status</h3>
      <table class="stats-table">
        <tr><th>Status</th><th>Quantidade</th></tr>
        ${statusRows}
      </table>
    </div>
  `);
}

// Contador por prioridade
if (summary.priorityCounts) {
	const priorityRows = Object.entries(summary.priorityCounts)
		.map(
			([priority, count]) =>
				`<tr><td>${priority}</td><td align="center"><b>${count}</b></td></tr>`,
		)
		.join('');

	quickStats.push(`
    <div class="stat-card">
      <h3>Prioridade</h3>
      <table class="stats-table">
        <tr><th>Prioridade</th><th>Quantidade</th></tr>
        ${priorityRows}
      </table>
    </div>
  `);
}

// Contador por responsável
if (summary.assigneeCounts) {
	const assigneeRows = Object.entries(summary.assigneeCounts)
		.map(
			([assignee, count]) =>
				`<tr><td>${assignee}</td><td align="center"><b>${count}</b></td></tr>`,
		)
		.join('');

	quickStats.push(`
    <div class="stat-card">
      <h3>Responsáveis</h3>
      <table class="stats-table">
        <tr><th>Responsável</th><th>Quantidade</th></tr>
        ${assigneeRows}
      </table>
    </div>
  `);
}

// Adicionar estatísticas de pontos estimados e entregues
if (exists(summary.deliveredPoints) && exists(summary.pendingPoints)) {
	quickStats.push(`
    <div class="stat-card">
      <h3>Progresso da Sprint</h3>
      <table class="stats-table">
        <tr><th>Métrica</th><th>Valor</th></tr>
        <tr><td>Pontos Entregues</td><td align="center"><b>${summary.deliveredPoints}</b> (${summary.deliveredPercentage}%)</td></tr>
        <tr><td>Pontos Pendentes</td><td align="center"><b>${summary.pendingPoints}</b> (${summary.pendingPercentage}%)</td></tr>
        <tr><td>Total de Pontos</td><td align="center"><b>${summary.totalEstimatePoints}</b></td></tr>
      </table>
    </div>
  `);
}

// Criar detalhes de cada status por assignee
let statusDetails = '';

// Se temos os dados detalhados dos responsáveis
if (summary.assigneeDetails) {
	statusDetails += '<h2>Detalhes por Responsável</h2>';

	Object.entries(summary.assigneeDetails).forEach(([assignee, data]) => {
		if (!data.issues || data.issues.length === 0) return;

		statusDetails += `
          <div class="status-section">
            <h3>${assignee} <span class="count">(${data.issues.length} issues, ${data.totalEstimate} pontos)</span></h3>
            <table class="issue-table">
              <tr>
                <th>Issue</th>
                <th>Status</th>
                <th>Prioridade</th>
                <th>Estimativa</th>
              </tr>
        `;

		// Listar issues do responsável
		data.issues.forEach((issue) => {
			// Verificar se é um objeto completo
			if (!exists(issue) || !exists(issue.title)) {
				return; // Pular issues incompletas
			}

			// Determinar a cor da linha baseada na prioridade
			let rowClass = '';
			if (issue.priority === 'P0') rowClass = 'priority-highest';
			else if (issue.priority === 'P1') rowClass = 'priority-high';

			// Adicionar linha da issue
			statusDetails += `
                <tr class="${rowClass}">
                  <td><a href="${issue.url || '#'}" target="_blank">#${
				issue.number || '?'
			}: ${issue.title}</a></td>
                  <td align="center">${issue.status || 'N/A'}</td>
                  <td align="center">${issue.priority || 'N/A'}</td>
                  <td align="center">${issue.estimate || 'N/A'}</td>
                </tr>
            `;
		});

		// Adicionar resumo de status
		if (data.statusBreakdown) {
			statusDetails += `
                <tr class="status-summary">
                  <td colspan="4">
                    <strong>Resumo por Status:</strong>
                    ${Object.entries(data.statusBreakdown)
											.map(
												([status, info]) =>
													`${status}: ${info.count || 0} issues (${
														info.points || 0
													} pontos)`,
											)
											.join(', ')}
                  </td>
                </tr>
            `;
		}

		statusDetails += `
            </table>
          </div>
        `;
	});
}

// Compatibilidade com o formato antigo, se disponível
else if (summary.issuesByStatus) {
	Object.entries(summary.issuesByStatus).forEach(([status, issues]) => {
		// Pular se não houver issues
		if (!issues || !issues.length) return;

		// Cabeçalho do status
		statusDetails += `
      <div class="status-section">
        <h2>${status} <span class="count">(${issues.length})</span></h2>
        <table class="issue-table">
          <tr>
            <th>Issue</th>
            <th>Prioridade</th>
            <th>Estado</th>
            <th>Responsáveis</th>
            <th>Última atualização</th>
          </tr>
    `;

		// Listar as issues
		issues.forEach((issue) => {
			// Verificar se é um objeto completo
			if (!exists(issue) || !exists(issue.title)) {
				return; // Pular issues incompletas
			}

			// Determinar a cor da linha baseada na prioridade
			let rowClass = '';
			if (issue.priority === 'P0') rowClass = 'priority-highest';
			else if (issue.priority === 'P1') rowClass = 'priority-high';

			// Formatar data de atualização
			const updatedDate = exists(issue.updatedAt)
				? new Date(issue.updatedAt).toLocaleDateString('pt-BR')
				: 'N/A';

			// Listar responsáveis
			const assigneesList = Array.isArray(issue.assignees)
				? issue.assignees.join(', ')
				: '';

			// Adicionar linha da issue
			statusDetails += `
        <tr class="${rowClass}">
          <td><a href="${issue.url || '#'}" target="_blank">#${
				issue.number || '?'
			}: ${issue.title}</a></td>
          <td align="center">${issue.priority || 'N/A'}</td>
          <td align="center">${
						issue.state === 'OPEN' ? 'Aberta' : 'Fechada'
					}</td>
          <td>${assigneesList}</td>
          <td>${updatedDate}</td>
        </tr>
      `;
		});

		statusDetails += `
        </table>
      </div>
    `;
	});
}

// Montar o HTML final
const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Resumo da Sprint: ${summary.projectTitle || 'Interlis Board'}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1000px;
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
      min-width: 250px;
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
      height: 20px;
    }

    .progress-bar {
      height: 20px;
      background-color: #2C74B3;
      border-radius: 5px;
      color: white;
      text-align: center;
      line-height: 20px;
      font-size: 12px;
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
  </style>
</head>
<body>
  <h1>Resumo da Sprint: ${summary.projectTitle || 'Interlis Board'}</h1>
  <p class="date">Relatório gerado em: ${formattedDate}</p>

  ${
		summary.currentSprint
			? `
  <div class="sprint-info">
    <h3>Sprint ${summary.currentSprint.title}</h3>
    <p><strong>Período:</strong> ${new Date(
			summary.currentSprint.startDate,
		).toLocaleDateString('pt-BR')} a ${new Date(
					summary.currentSprint.endDate,
			  ).toLocaleDateString('pt-BR')}</p>
    <p><strong>Duração:</strong> ${summary.currentSprint.duration} dias</p>
    <p><strong>Progresso:</strong></p>
    <div class="progress-bar-container">
      <div class="progress-bar" style="width: ${summary.deliveredPercentage}%">
        ${summary.deliveredPercentage}% Completo
      </div>
    </div>
  </div>
  `
			: ''
	}

  <div class="summary-box">
    <p><strong>Total de issues:</strong> ${summary.totalIssues || 'N/A'}</p>
    <p><strong>Issues abertas:</strong> ${summary.openIssues || 'N/A'}</p>
    <p><strong>Issues fechadas:</strong> ${summary.closedIssues || 'N/A'}</p>
    ${
			summary.totalEstimatePoints
				? `<p><strong>Total de pontos:</strong> ${summary.totalEstimatePoints}</p>`
				: ''
		}
    ${
			summary.deliveredPoints
				? `<p><strong>Pontos entregues:</strong> ${summary.deliveredPoints} (${summary.deliveredPercentage}%)</p>`
				: ''
		}
    ${
			summary.pendingPoints
				? `<p><strong>Pontos pendentes:</strong> ${summary.pendingPoints} (${summary.pendingPercentage}%)</p>`
				: ''
		}
  </div>

  <div class="stats-container">
    ${quickStats.join('')}
  </div>

  ${statusDetails}

  <div class="footer">
    <p>Este relatório é gerado automaticamente pela automação n8n.</p>
  </div>
</body>
</html>
`;

// Retornar o HTML formatado e o assunto do email
return {
	json: {
		emailHtml: emailHtml,
		subject: `Relatório Diário da Sprint: ${
			summary.projectTitle || 'Interlis Board'
		} - ${today.toLocaleDateString('pt-BR')}`,
	},
};

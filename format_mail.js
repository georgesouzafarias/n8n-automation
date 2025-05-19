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
if (!exists(summary) || !exists(summary.issuesByStatus)) {
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

// Criar detalhes de cada status
let statusDetails = '';

if (summary.issuesByStatus) {
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

  <div class="summary-box">
    <p><strong>Total de issues:</strong> ${summary.totalIssues || 'N/A'}</p>
    <p><strong>Issues abertas:</strong> ${summary.openIssues || 'N/A'}</p>
    <p><strong>Issues fechadas:</strong> ${summary.closedIssues || 'N/A'}</p>
  </div>

  <div class="stats-container">
    ${quickStats.join('')}
  </div>

  <h2>Detalhes por Status</h2>
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

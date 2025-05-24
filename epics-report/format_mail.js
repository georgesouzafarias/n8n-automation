// Formatação de email para relatório de épicos
// Este script formata os dados processados em um email HTML

function exists(value) {
	return value !== null && value !== undefined && value !== '';
}

function formatEpicsEmail(summary) {
	if (!summary || summary.error) {
		return {
			subject: 'Erro no Relatório de Épicos',
			html: `
                <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
                    <h1 style="color: #d32f2f;">Erro no Relatório de Épicos</h1>
                    <p style="color: #666;">${
											summary?.message ||
											'Erro desconhecido ao processar dados dos épicos'
										}</p>
                </div>
            `,
		};
	}

	// CSS básico para o email
	const styles = `
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 900px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 28px; }
            .header .subtitle { opacity: 0.9; margin-top: 10px; }
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
            .stat-card { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; text-align: center; }
            .stat-card h3 { margin: 0 0 10px 0; color: #495057; font-size: 14px; text-transform: uppercase; }
            .stat-card .number { font-size: 32px; font-weight: bold; margin: 10px 0; }
            .stat-card .percentage { font-size: 18px; color: #6c757d; }
            .progress-bar { background: #e9ecef; border-radius: 10px; overflow: hidden; height: 20px; margin: 10px 0; }
            .progress-fill { height: 100%; transition: width 0.3s ease; }
            .epic-item { background: white; border: 1px solid #dee2e6; border-radius: 8px; margin: 15px 0; padding: 20px; }
            .epic-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
            .epic-title { font-size: 18px; font-weight: bold; color: #212529; margin: 0; }
            .epic-status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
            .status-completed { background: #d4edda; color: #155724; }
            .status-in-progress { background: #fff3cd; color: #856404; }
            .status-not-started { background: #f8d7da; color: #721c24; }
            .epic-meta { font-size: 14px; color: #6c757d; margin: 5px 0; }
            .assignees { display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; }
            .assignee { background: #e9ecef; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
            .labels { display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; }
            .label { background: #6f42c1; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
            .footer { background: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; color: #6c757d; font-size: 14px; }
        </style>
    `;

	// Função para obter cor da barra de progresso
	function getProgressColor(percentage) {
		if (percentage >= 80) return '#28a745';
		if (percentage >= 50) return '#ffc107';
		if (percentage >= 20) return '#fd7e14';
		return '#dc3545';
	}

	// Função para obter classe do status
	function getStatusClass(status) {
		switch (status.toLowerCase()) {
			case 'completed':
				return 'status-completed';
			case 'in progress':
				return 'status-in-progress';
			default:
				return 'status-not-started';
		}
	}

	// Cabeçalho do email
	let html = `
        ${styles}
        <div class="container">
            <div class="header">
                <h1>📊 Relatório de Status dos Épicos</h1>
                <div class="subtitle">
                    ${summary.projectTitle || 'Projeto'} - ${
		summary.generatedAt || new Date().toLocaleString('pt-BR')
	}
                </div>
            </div>
    `;

	// Cards de estatísticas
	html += `
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total de Épicos</h3>
                <div class="number" style="color: #667eea;">${
									summary.totalEpics
								}</div>
            </div>
            <div class="stat-card">
                <h3>Taxa Média de Conclusão</h3>
                <div class="number" style="color: #28a745;">${
									summary.statistics?.averageCompletionRate || 0
								}%</div>
            </div>
            <div class="stat-card">
                <h3>Progresso Geral</h3>
                <div class="number" style="color: ${getProgressColor(
									summary.statistics?.overallProgress || 0,
								)};">${summary.statistics?.overallProgress || 0}%</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${
											summary.statistics?.overallProgress || 0
										}%; background: ${getProgressColor(
		summary.statistics?.overallProgress || 0,
	)};"></div>
                </div>
            </div>
            <div class="stat-card">
                <h3>Sub-issues Totais</h3>
                <div class="number" style="color: #6c757d;">${
									summary.statistics?.totalSubIssues || 0
								}</div>
                <div class="percentage">${
									summary.statistics?.completedSubIssues || 0
								} concluídas</div>
            </div>
        </div>
    `;

	// Distribuição por status
	if (summary.epicsProgress && Object.keys(summary.epicsProgress).length > 0) {
		html += `
            <div class="stat-card" style="margin: 20px 0;">
                <h3>Distribuição por Status</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 15px;">
        `;

		Object.entries(summary.epicsProgress).forEach(([status, count]) => {
			const percentage =
				summary.totalEpics > 0
					? Math.round((count / summary.totalEpics) * 100)
					: 0;
			html += `
                <div style="text-align: center;">
                    <div style="font-weight: bold; margin-bottom: 5px;">${status}</div>
                    <div style="font-size: 24px; color: ${getProgressColor(
											percentage,
										)};">${count}</div>
                    <div style="font-size: 12px; color: #6c757d;">${percentage}%</div>
                </div>
            `;
		});

		html += `
                </div>
            </div>
        `;
	}

	// Lista detalhada dos épicos
	if (summary.epicsDetails && summary.epicsDetails.length > 0) {
		html += `<h2 style="margin: 30px 0 20px 0; color: #495057;">📋 Detalhes dos Épicos</h2>`;

		summary.epicsDetails.forEach((epic) => {
			html += `
                <div class="epic-item">
                    <div class="epic-header">
                        <div style="flex-grow: 1;">
                            <h3 class="epic-title">
                                ${
																	epic.epicUrl !== '#'
																		? `<a href="${epic.epicUrl}" style="color: #007bff; text-decoration: none;">#${epic.epicId}</a>`
																		: `#${epic.epicId}`
																}
                                ${epic.epicTitle}
                            </h3>
                            <div class="epic-meta">
                                Projeto: ${epic.projectStatus} | Prioridade: ${
				epic.priority
			}
                            </div>
                        </div>
                        <span class="epic-status ${getStatusClass(
													epic.status,
												)}">${epic.status}</span>
                    </div>

                    <div style="margin: 15px 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <span style="font-weight: bold;">Progresso das Sub-issues</span>
                            <span style="font-weight: bold; color: ${getProgressColor(
															epic.completionRate,
														)};">${epic.completionRate}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${
															epic.completionRate
														}%; background: ${getProgressColor(
				epic.completionRate,
			)};"></div>
                        </div>
                        <div style="font-size: 14px; color: #6c757d; margin-top: 5px;">
                            ${epic.subIssuesCompleted} de ${
				epic.subIssuesTotal
			} sub-issues concluídas
                            ${
															epic.subIssuesRemaining > 0
																? ` (${epic.subIssuesRemaining} restantes)`
																: ''
														}
                        </div>
                    </div>

                    ${
											epic.description
												? `<div style="color: #6c757d; font-style: italic; margin: 10px 0;">${epic.description}</div>`
												: ''
										}

                    ${
											epic.assignees && epic.assignees.length > 0
												? `
                        <div>
                            <strong style="font-size: 14px;">Responsáveis:</strong>
                            <div class="assignees">
                                ${epic.assignees
																	.map(
																		(assignee) =>
																			`<span class="assignee">@${assignee}</span>`,
																	)
																	.join('')}
                            </div>
                        </div>
                    `
												: ''
										}

                    ${
											epic.labels && epic.labels.length > 0
												? `
                        <div>
                            <strong style="font-size: 14px;">Labels:</strong>
                            <div class="labels">
                                ${epic.labels
																	.map(
																		(label) =>
																			`<span class="label">${label}</span>`,
																	)
																	.join('')}
                            </div>
                        </div>
                    `
												: ''
										}

                    <div style="margin-top: 15px; font-size: 12px; color: #868e96;">
                        Criado: ${new Date(epic.createdAt).toLocaleDateString(
													'pt-BR',
												)} |
                        Atualizado: ${new Date(
													epic.updatedAt,
												).toLocaleDateString('pt-BR')}
                    </div>
                </div>
            `;
		});
	} else {
		html += `
            <div style="text-align: center; padding: 40px; color: #6c757d;">
                <p>Nenhum épico encontrado no projeto.</p>
            </div>
        `;
	}

	// Rodapé
	html += `
            <div class="footer">
                <p>Relatório gerado automaticamente em ${
									summary.date
										? new Date(summary.date).toLocaleString('pt-BR')
										: new Date().toLocaleString('pt-BR')
								}</p>
                <p style="font-size: 12px; margin-top: 10px;">Este relatório analisa épicos com base em suas sub-issues e progresso.</p>
            </div>
        </div>
    `;

	return {
		subject: `📊 Relatório de Épicos - ${summary.totalEpics} épicos (${
			summary.statistics?.overallProgress || 0
		}% concluído)`,
		html: html,
	};
}

// Execução
try {
	let summary;

	// Verificar se está rodando no n8n ou localmente
	if (typeof $input !== 'undefined') {
		// Ambiente n8n
		const inputData = $input.first()?.json;
		if (!inputData) {
			throw new Error('Nenhum dado de entrada fornecido');
		}
		summary = inputData;
	} else {
		// Ambiente local - ler do arquivo de resultado
		const fs = require('fs');
		if (!fs.existsSync('epics_analysis_result.json')) {
			throw new Error(
				'Arquivo epics_analysis_result.json não encontrado! Execute process_data.js primeiro.',
			);
		}
		const rawData = fs.readFileSync('epics_analysis_result.json', 'utf8');
		summary = JSON.parse(rawData);
	}

	const emailContent = formatEpicsEmail(summary);

	// Para ambiente local, exibir resultado
	if (typeof module !== 'undefined' && module.exports) {
		console.log('\n=== EMAIL FORMATADO ===');
		console.log('Subject:', emailContent.subject);
		console.log('\nHTML Content gerado com sucesso!');
		console.log('Total de caracteres:', emailContent.html.length);

		// Salvar HTML em arquivo para visualização
		const fs = require('fs');
		fs.writeFileSync('epic_report_email.html', emailContent.html);
		console.log('Email HTML salvo em epic_report_email.html');

		module.exports = emailContent;
	} else {
		// Ambiente n8n
		return emailContent;
	}
} catch (error) {
	console.error('Erro na formatação do email:', error.message);

	const errorEmail = {
		subject: 'Erro no Relatório de Épicos',
		html: `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #d32f2f;">❌ Erro no Relatório de Épicos</h1>
                <p style="color: #666; font-size: 16px;">Ocorreu um erro ao formatar o relatório:</p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace;">
                    ${error.message}
                </div>
                <p style="color: #666; margin-top: 20px;">
                    Verifique os dados de entrada e tente novamente.
                </p>
            </div>
        `,
	};

	if (typeof module !== 'undefined' && module.exports) {
		console.log(JSON.stringify(errorEmail, null, 2));
		process.exit(1);
	} else {
		return errorEmail;
	}
}

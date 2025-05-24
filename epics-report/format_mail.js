// Formatação de email para relatório de épicos
// Este script formata os dados processados em um email HTML otimizado para Gmail

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

	// CSS inline para melhor compatibilidade com clientes de email
	const css = `
		<style type="text/css">
			body, div, p, h1, h2, h3 { margin: 0; padding: 0; }
			body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f7f7f7; }
			.container { max-width: 900px; margin: 0 auto; background-color: #ffffff; }
			.header { background: #667eea; color: white; padding: 30px; }
			.content { padding: 20px; }
			.stat-card { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center; }
			.progress-bar { background: #e9ecef; border-radius: 10px; overflow: hidden; height: 20px; margin: 10px 0; }
			.progress-fill { height: 100%; transition: width 0.3s ease; }
			.epic-item { background: white; border: 1px solid #dee2e6; border-radius: 8px; margin: 15px 0; padding: 20px; }
			.epic-title { font-size: 18px; font-weight: bold; color: #212529; margin: 0; }
			.epic-status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
			.status-completed { background: #d4edda; color: #155724; }
			.status-in-progress { background: #fff3cd; color: #856404; }
			.status-not-started { background: #e2e3e5; color: #383d41; }
			.footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
			table { border-collapse: collapse; width: 100%; }
			td { vertical-align: top; padding: 0; }
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
	const today = new Date();

	// Início do HTML - usando tabelas para melhor compatibilidade com clientes de email
	let html = `
		<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
		<html xmlns="http://www.w3.org/1999/xhtml">
		<head>
			<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
			<title>Relatório de Status dos Épicos</title>
			${css}
		</head>
		<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f7f7f7;">
			<table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 900px; margin: 0 auto; background-color: #ffffff;">
				<!-- Cabeçalho -->
				<tr>
					<td style="padding: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
						<h1 style="margin: 0; font-size: 28px;">📊 Relatório de Status dos Épicos</h1>
						<div style="opacity: 0.9; margin-top: 10px;">
							${summary.projectTitle || 'Projeto'} - ${
		summary.generatedAt || new Date().toLocaleString('pt-BR')
	}
						</div>
					</td>
				</tr>

				<!-- Conteúdo -->
				<tr>
					<td style="padding: 20px;">
						<!-- Cards de estatísticas -->
						<table border="0" cellpadding="0" cellspacing="0" width="100%">
							<tr>
	`;

	// Cards de estatísticas
	const statCards = [
		{
			title: 'Total de Épicos',
			value: summary.totalEpics,
			color: '#667eea',
			// Format to be more prominent like the other numbers
			format: true,
		},
		{
			title: 'Taxa Média de Conclusão',
			value: `${summary.statistics?.averageCompletionRate || 0}%`,
			color: '#28a745',
		},
		{
			title: 'Progresso Geral',
			value: `${summary.statistics?.overallProgress || 0}%`,
			color: getProgressColor(summary.statistics?.overallProgress || 0),
			hasProgress: true,
			progress: summary.statistics?.overallProgress || 0,
		},
		{
			title: 'Sub-issues Totais',
			value: summary.statistics?.totalSubIssues || 0,
			subtext: `${summary.statistics?.completedSubIssues || 0} concluídas`,
			color: '#6c757d',
		},
	];

	// Gerar HTML para cada card de estatística
	statCards.forEach((card) => {
		html += `
								<td width="25%" style="padding: 10px;">
									<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; text-align: center;">
										<tr>
											<td style="padding: 20px;">
												<h3 style="margin: 0 0 10px 0; color: #495057; font-size: 14px; text-transform: uppercase;">${
													card.title
												}</h3>
												<div style="font-size: 32px; font-weight: bold; margin: 10px 0; color: ${
													card.color
												}; ${card.format ? 'letter-spacing: -0.5px;' : ''}">${
			card.value
		}</div>
												${
													card.subtext
														? `<div style="font-size: 18px; color: #6c757d;">${card.subtext}</div>`
														: ''
												}
												${
													card.hasProgress
														? `
													<div style="background: #e9ecef; border-radius: 10px; overflow: hidden; height: 20px; margin: 10px 0;">
														<div style="width: ${card.progress}%; background: ${card.color}; height: 100%;"></div>
													</div>
												`
														: ''
												}
											</td>
										</tr>
									</table>
								</td>
		`;
	});

	html += `
							</tr>
						</table>
	`;

	// Distribuição por status
	if (summary.epicsProgress && Object.keys(summary.epicsProgress).length > 0) {
		html += `
						<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px;">
							<tr>
								<td style="padding: 20px;">
									<h3 style="margin: 0 0 15px 0; color: #495057; font-size: 16px; text-transform: uppercase; text-align: center;">Distribuição por Status</h3>
									<table border="0" cellpadding="0" cellspacing="0" width="100%">
										<tr>
		`;

		// Calcular largura para cada status
		const statusCount = Object.keys(summary.epicsProgress).length;
		const columnWidth = 100 / statusCount;

		Object.entries(summary.epicsProgress).forEach(([status, count]) => {
			const percentage =
				summary.totalEpics > 0
					? Math.round((count / summary.totalEpics) * 100)
					: 0;

			// Define specific colors for each status
			let statusColor;
			if (status.toLowerCase() === 'completed') {
				statusColor = '#28a745'; // Green for completed
			} else if (status.toLowerCase() === 'in progress') {
				statusColor = '#ffc107'; // Yellow for in progress
			} else if (status.toLowerCase() === 'not started') {
				statusColor = '#6c757d'; // Gray for not started
			} else {
				statusColor = getProgressColor(percentage); // Fallback
			}

			html += `
											<td width="${columnWidth}%" style="padding: 5px; text-align: center;">
												<div style="font-weight: bold; margin-bottom: 5px;">${status}</div>
												<div style="font-size: 24px; color: ${statusColor};">${count}</div>
												<div style="font-size: 12px; color: #6c757d;">${percentage}%</div>
											</td>
			`;
		});

		html += `
										</tr>
									</table>
								</td>
							</tr>
						</table>
		`;
	}

	// Lista detalhada dos épicos
	if (summary.epicsDetails && summary.epicsDetails.length > 0) {
		html += `
						<h2 style="margin: 30px 0 20px 0; color: #495057;">📋 Detalhes dos Épicos</h2>
		`;

		summary.epicsDetails.forEach((epic) => {
			html += `
						<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background: white; border: 1px solid #dee2e6; border-radius: 8px; margin: 15px 0;">
							<tr>
								<td style="padding: 20px;">
									<!-- Cabeçalho do épico -->
									<table border="0" cellpadding="0" cellspacing="0" width="100%">
										<tr>
											<td style="vertical-align: top;">
												<h3 style="font-size: 18px; font-weight: bold; color: #212529; margin: 0;">
													${
														epic.epicUrl !== '#'
															? `<a href="${epic.epicUrl}" style="color: #007bff; text-decoration: none;">#${epic.epicId}</a>`
															: `#${epic.epicId}`
													}
													${epic.epicTitle}
												</h3>
												<div style="font-size: 14px; color: #6c757d; margin: 5px 0;">
													Projeto: ${epic.projectStatus} | Prioridade: ${epic.priority}
												</div>
											</td>
											<td style="text-align: right; vertical-align: top; width: 100px;">
												<span style="padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; background: ${
													epic.status.toLowerCase() === 'completed'
														? '#d4edda'
														: epic.status.toLowerCase() === 'in progress'
														? '#fff3cd'
														: '#e2e3e5'
												}; color: ${
				epic.status.toLowerCase() === 'completed'
					? '#155724'
					: epic.status.toLowerCase() === 'in progress'
					? '#856404'
					: '#383d41'
			};">${epic.status}</span>
											</td>
										</tr>
									</table>

									<!-- Progresso das sub-issues -->
									<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 15px 0;">
										<tr>
											<td style="padding-bottom: 5px;">
												<table border="0" cellpadding="0" cellspacing="0" width="100%">
													<tr>
														<td style="font-weight: bold;">Progresso das Sub-issues</td>
														<td style="text-align: right; font-weight: bold; color: ${getProgressColor(
															epic.completionRate,
														)};">${epic.completionRate}%</td>
													</tr>
												</table>
											</td>
										</tr>
										<tr>
											<td>
												<div style="background: #e9ecef; border-radius: 10px; overflow: hidden; height: 20px;">
													<div style="width: ${epic.completionRate}%; background: ${getProgressColor(
				epic.completionRate,
			)}; height: 100%;"></div>
												</div>
												<div style="font-size: 14px; color: #6c757d; margin-top: 5px;">
													${epic.subIssuesCompleted} de ${epic.subIssuesTotal} sub-issues concluídas
													${epic.subIssuesRemaining > 0 ? ` (${epic.subIssuesRemaining} restantes)` : ''}
												</div>
											</td>
										</tr>
									</table>
			`;

			// Descrição (se existir)
			if (epic.description) {
				html += `
									<div style="color: #6c757d; font-style: italic; margin: 10px 0;">
										${epic.description}
									</div>
				`;
			}

			// Responsáveis (se existirem)
			if (epic.assignees && epic.assignees.length > 0) {
				html += `
									<div style="margin: 10px 0;">
										<strong style="font-size: 14px;">Responsáveis:</strong>
										<div style="margin-top: 5px;">
				`;

				epic.assignees.forEach((assignee) => {
					html += `
											<span style="display: inline-block; background: #e9ecef; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 5px; margin-bottom: 5px;">@${assignee}</span>
					`;
				});

				html += `
										</div>
									</div>
				`;
			}

			// Labels (se existirem)
			if (epic.labels && epic.labels.length > 0) {
				html += `
									<div style="margin: 10px 0;">
										<strong style="font-size: 14px;">Labels:</strong>
										<div style="margin-top: 5px;">
				`;

				epic.labels.forEach((label) => {
					html += `
											<span style="display: inline-block; background: #6f42c1; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 5px; margin-bottom: 5px;">${label}</span>
					`;
				});

				html += `
										</div>
									</div>
				`;
			}

			// Datas de criação/atualização
			html += `
									<div style="margin-top: 15px; font-size: 12px; color: #868e96;">
										Criado: ${new Date(epic.createdAt).toLocaleDateString('pt-BR')} |
										Atualizado: ${new Date(epic.updatedAt).toLocaleDateString('pt-BR')}
									</div>
								</td>
							</tr>
						</table>
			`;
		});
	} else {
		html += `
						<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 40px 0;">
							<tr>
								<td style="text-align: center; padding: 40px; color: #6c757d;">
									<p>Nenhum épico encontrado no projeto.</p>
								</td>
							</tr>
						</table>
		`;
	}

	// Rodapé
	html += `
					</td>
				</tr>
				<tr>
					<td style="background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px;">
						<p>Relatório gerado automaticamente em ${
							summary.date
								? new Date(summary.date).toLocaleString('pt-BR')
								: new Date().toLocaleString('pt-BR')
						}</p>
						<p style="font-size: 12px; margin-top: 10px;">Este relatório analisa épicos com base em suas sub-issues e progresso.</p>
					</td>
				</tr>
			</table>
		</body>
		</html>
	`;

	return {
		subject: `📊 Relatório de Épicos - ${today.toLocaleDateString('pt-BR')}`,
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

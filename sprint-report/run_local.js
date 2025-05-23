#!/usr/bin/env node

/**
 * Script para executar a análise de sprint localmente
 * Uso: node run_local.js
 */

console.log('Iniciando análise de sprint...');

try {
	// Importa o módulo process_data.js
	const processData = require('./process_data.js');

	// O módulo exporta diretamente um objeto com a propriedade json
	const result = processData.json;

	// Verifica se houve erro no processamento
	if (result?.error) {
		console.error('Erro durante o processamento:');
		console.error(result.message);
		process.exit(1);
	}

	// Exibe um resumo dos resultados
	console.log('\n===== RESUMO DA ANÁLISE =====');
	console.log(`Projeto: ${result.projectTitle}`);
	console.log(`Total de issues: ${result.totalIssues}`);

	if (result.currentSprint) {
		console.log(`\nSprint atual: ${result.currentSprint.title}`);
		console.log(
			`Período: ${result.currentSprint.startDate} a ${result.currentSprint.endDate}`,
		);
	} else {
		console.log('\nNenhuma sprint atual em andamento');
	}

	console.log('\n-- Issues por Status --');
	Object.entries(result.statusCounts).forEach(([status, count]) => {
		console.log(`${status}: ${count} issues`);
	});

	console.log('\n-- Pontos por Status --');
	Object.entries(result.estimateTotals).forEach(([status, points]) => {
		console.log(`${status}: ${points} pontos`);
	});

	console.log('\n-- Issues e Pontos por Usuário --');
	// Ordenando usuários por número de issues (decrescente)
	const sortedUsers = Object.keys(result.assigneeCounts).sort(
		(a, b) => result.assigneeCounts[b] - result.assigneeCounts[a],
	);

	sortedUsers.forEach((user) => {
		const issues = result.assigneeCounts[user];
		const userEstimates = result.assigneeEstimates[user] || {
			total: 0,
			delivered: 0,
			pending: 0,
		};
		const points = userEstimates.total;

		// Calcular percentual de entrega
		const deliveredPercent =
			points > 0 ? Math.round((userEstimates.delivered / points) * 100) : 0;

		console.log(
			`\n${user}: ${issues} issues, ${points} pontos (${userEstimates.delivered} entregues/${userEstimates.pending} pendentes)`,
		);
		console.log(`  Progresso: ${deliveredPercent}% concluído`);

		// Exibe breakdown por status se disponível
		const statusCounts = result.assigneeStatusCounts?.[user];
		if (statusCounts) {
			console.log('  Status breakdown:');
			Object.entries(statusCounts)
				.sort((a, b) => b[1] - a[1]) // Ordenar por quantidade decrescente
				.forEach(([status, count]) => {
					console.log(`    - ${status}: ${count} issues`);
				});
		}

		// Exibe detalhes avançados se disponíveis
		const details = result.assigneeDetails?.[user];

		// Prioridades
		if (
			details?.priorityBreakdown &&
			Object.keys(details.priorityBreakdown).length > 0
		) {
			console.log('  Priority breakdown:');
			Object.entries(details.priorityBreakdown)
				.sort((a, b) => b[1].count - a[1].count)
				.forEach(([priority, data]) => {
					console.log(
						`    - ${priority}: ${data.count} issues, ${data.points} pontos`,
					);
				});
		}
	});

	console.log(`\nTotal de pontos: ${result.totalEstimatePoints}`);

	// Estatísticas de Entrega
	console.log('\n===== ESTATÍSTICAS DE ENTREGA =====');
	console.log(`Total de pontos na sprint: ${result.totalEstimatePoints}`);
	console.log(
		`Pontos entregues (issues fechadas): ${result.deliveredPoints} (${result.deliveredPercentage}%)`,
	);
	console.log(
		`Pontos pendentes (issues abertas): ${result.pendingPoints} (${result.pendingPercentage}%)`,
	);

	// Cálculo de progresso da sprint
	if (result.currentSprint) {
		const sprintStart = new Date(result.currentSprint.startDate);
		const sprintEnd = new Date(result.currentSprint.endDate);
		const today = new Date();

		// Calcula quanto da sprint já passou (em porcentagem)
		const totalDays = Math.ceil(
			(sprintEnd - sprintStart) / (1000 * 60 * 60 * 24),
		);
		const daysElapsed = Math.ceil(
			(today - sprintStart) / (1000 * 60 * 60 * 24),
		);
		const sprintProgress = Math.min(
			Math.round((daysElapsed / totalDays) * 100),
			100,
		);

		console.log(
			`Progresso da sprint: ${daysElapsed} de ${totalDays} dias (${sprintProgress}%)`,
		);

		// Análise de burndown ideal vs. real
		const idealBurnRate = sprintProgress; // Ideal: mesma taxa que o tempo
		const actualBurnRate = result.deliveredPercentage; // Real: porcentagem entregue

		console.log(`\nBurndown:`);
		console.log(
			`- Ideal: ${idealBurnRate}% dos pontos deveriam estar entregues`,
		);
		console.log(`- Real: ${actualBurnRate}% dos pontos estão entregues`);

		if (actualBurnRate >= idealBurnRate) {
			console.log('✅ Sprint está adiantada ou no ritmo esperado');
		} else if (actualBurnRate >= idealBurnRate * 0.8) {
			console.log('⚠️ Sprint está ligeiramente atrasada');
		} else {
			console.log('❌ Sprint está significativamente atrasada');
		}
	}

	// Análise de produtividade
	console.log('\n===== ANÁLISE DE PRODUTIVIDADE =====');

	// Calcular métricas de produtividade
	const productivity = sortedUsers.map((user) => {
		const issues = result.assigneeCounts[user];
		const userEstimates = result.assigneeEstimates[user] || {
			total: 0,
			delivered: 0,
			pending: 0,
		};
		const points = userEstimates.total;
		const pointsPerIssue = issues > 0 ? (points / issues).toFixed(1) : 0;

		// Usar os pontos entregues (issues fechadas)
		const deliveredPoints = userEstimates.delivered;

		// Encontrar issues finalizadas (em produção ou concluídas)
		const statusCounts = result.assigneeStatusCounts?.[user] || {};
		const completedIssues =
			(statusCounts['Deployed to Production'] || 0) +
			(statusCounts['Test Done'] || 0);

		// Usamos pontos entregues em vez de pontos por status específicos
		const completedPoints = deliveredPoints;

		// Porcentagem de conclusão
		const completionRate =
			issues > 0 ? Math.round((completedIssues / issues) * 100) : 0;
		const pointCompletionRate =
			points > 0 ? Math.round((completedPoints / points) * 100) : 0;

		return {
			user,
			issues,
			points,
			pointsPerIssue,
			completedIssues,
			completedPoints,
			completionRate,
			pointCompletionRate,
		};
	});

	// Ordenar por quantidade de pontos (produtividade)
	productivity.sort((a, b) => b.points - a.points);

	// Exibir tabela de produtividade
	console.log(
		'Usuário              | Issues | Pontos | Entregue | Pendente | Progresso',
	);
	console.log(
		'---------------------|--------|--------|----------|----------|----------',
	);
	productivity.forEach((p) => {
		const userName = p.user.padEnd(20).substring(0, 20);
		const pendingPoints = p.points - p.completedPoints;
		console.log(
			`${userName} | ${String(p.issues).padEnd(6)} | ${String(p.points).padEnd(
				6,
			)} | ${String(p.completedPoints).padEnd(8)} | ${String(
				pendingPoints,
			).padEnd(8)} | ${p.pointCompletionRate}%`,
		);
	});

	// Salva o resultado completo em um arquivo JSON para análise posterior
	const fs = require('fs');
	fs.writeFileSync('./analysis_result.json', JSON.stringify(result, null, 2));
	console.log('\nResultado completo salvo em analysis_result.json');
} catch (error) {
	console.error('Erro inesperado:');
	console.error(error);
	process.exit(1);
}

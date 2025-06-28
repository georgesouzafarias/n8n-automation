/**
 * Gerador de Resumo Executivo GLPI - Tickets em Andamento
 * Script para uso no n8n
 *
 * Este script processa o arquivo analysis_result.json e gera um resumo executivo
 * focado apenas nos tickets em andamento, fornecendo informações relevantes
 * para tomada de decisão executiva.
 */

function generateExecutiveSummary(data) {
	const resumo = {
		data_processamento: new Date().toISOString(),
		resumo_executivo: {},
		tickets_em_andamento: [],
		alertas: [],
		metricas_chave: {},
	};

	// Extrai informações gerais
	const resumoGeral = data.resumo_geral;

	// Calcula métricas dos tickets em andamento
	let totalTicketsAndamento = 0;
	let ticketsAlta = 0;
	let ticketsMedia = 0;
	let ticketsBaixa = 0;
	let ticketsLongaDuracao = [];
	let operadoresComTicketsAndamento = new Set();

	// Processa cada setor
	Object.values(data.setores).forEach((setor) => {
		const ticketsAndamento = setor.tickets_por_status['Em andamento'] || 0;
		totalTicketsAndamento += ticketsAndamento;

		// Filtra tickets em andamento
		const ticketsEmAndamento = setor.tickets.filter(
			(ticket) => ticket.status === 'Em andamento',
		);

		ticketsEmAndamento.forEach((ticket) => {
			// Conta urgências
			switch (ticket.urgencia) {
				case 'Alta':
					ticketsAlta++;
					break;
				case 'Média':
					ticketsMedia++;
					break;
				case 'Baixa':
					ticketsBaixa++;
					break;
			}

			// Adiciona operador ao conjunto
			operadoresComTicketsAndamento.add(ticket.operador.nomeCompleto);

			// Calcula duração em horas para identificar tickets de longa duração
			const duracaoHoras = parseDuration(ticket.duracao);

			// Prepara dados do ticket para o resumo
			const ticketInfo = {
				id: ticket.id,
				categoria: ticket.categoria_completa,
				urgencia: ticket.urgencia,
				operador: ticket.operador.nomeCompleto,
				grupos_operador: ticket.operador.grupos,
				data_abertura: ticket.data_abertura,
				duracao: ticket.duracao,
				duracao_horas: duracaoHoras,
				setor: setor.setor,
				tecnico_resolveu: ticket.tecnico_resolveu,
			};

			resumo.tickets_em_andamento.push(ticketInfo);

			// Identifica tickets de longa duração (mais de 7 dias = 168 horas)
			if (duracaoHoras > 168) {
				ticketsLongaDuracao.push(ticketInfo);
			}
		});
	});

	// Ordena tickets por duração (mais antigos primeiro)
	resumo.tickets_em_andamento.sort((a, b) => b.duracao_horas - a.duracao_horas);

	// Monta resumo executivo
	resumo.resumo_executivo = {
		total_tickets_sistema: resumoGeral.total_tickets,
		tickets_em_andamento: totalTicketsAndamento,
		percentual_andamento:
			((totalTicketsAndamento / resumoGeral.total_tickets) * 100).toFixed(1) +
			'%',
		distribuicao_urgencia: {
			alta: ticketsAlta,
			media: ticketsMedia,
			baixa: ticketsBaixa,
		},
		operadores_envolvidos: operadoresComTicketsAndamento.size,
		tickets_longa_duracao: ticketsLongaDuracao.length,
	};

	// Métricas chave
	resumo.metricas_chave = {
		ticket_mais_antigo:
			resumo.tickets_em_andamento.length > 0
				? resumo.tickets_em_andamento[0]
				: null,
		tickets_urgencia_alta: resumo.tickets_em_andamento.filter(
			(t) => t.urgencia === 'Alta',
		),
		tickets_mais_7_dias: ticketsLongaDuracao.length,
		distribuicao_por_setor: getDistribuicaoPorSetor(
			resumo.tickets_em_andamento,
		),
	};

	// Gera alertas
	resumo.alertas = generateAlertas(
		resumo.tickets_em_andamento,
		ticketsLongaDuracao,
	);

	return resumo;
}

function parseDuration(duracao) {
	// Converte duracao formato "Xd Xh Xm" para horas
	let horas = 0;

	const dias = duracao.match(/(\d+)d/);
	const horasMatch = duracao.match(/(\d+)h/);
	const minutos = duracao.match(/(\d+)m/);

	if (dias) horas += parseInt(dias[1]) * 24;
	if (horasMatch) horas += parseInt(horasMatch[1]);
	if (minutos) horas += parseInt(minutos[1]) / 60;

	return Math.round(horas * 100) / 100; // Arredonda para 2 casas decimais
}

function getDistribuicaoPorSetor(tickets) {
	const distribuicao = {};
	tickets.forEach((ticket) => {
		if (!distribuicao[ticket.setor]) {
			distribuicao[ticket.setor] = 0;
		}
		distribuicao[ticket.setor]++;
	});
	return distribuicao;
}

function generateAlertas(ticketsAndamento, ticketsLongaDuracao) {
	const alertas = [];

	// Alerta para tickets de alta urgência
	const ticketsAlta = ticketsAndamento.filter((t) => t.urgencia === 'Alta');
	if (ticketsAlta.length > 0) {
		alertas.push({
			tipo: 'URGENCIA_ALTA',
			nivel: 'CRITICO',
			mensagem: `${ticketsAlta.length} ticket(s) de urgência ALTA em andamento`,
			tickets: ticketsAlta.map((t) => t.id),
		});
	}

	// Alerta para tickets de longa duração
	if (ticketsLongaDuracao.length > 0) {
		alertas.push({
			tipo: 'LONGA DURACAO',
			nivel: 'ATENCAO',
			mensagem: `${ticketsLongaDuracao.length} ticket(s) em andamento há mais de 7 dias`,
			tickets: ticketsLongaDuracao.map((t) => ({
				id: t.id,
				duracao: t.duracao,
			})),
		});
	}

	// Alerta para concentração de tickets em um operador
	const ticketsPorOperador = {};
	ticketsAndamento.forEach((ticket) => {
		if (!ticketsPorOperador[ticket.operador]) {
			ticketsPorOperador[ticket.operador] = 0;
		}
		ticketsPorOperador[ticket.operador]++;
	});

	Object.entries(ticketsPorOperador).forEach(([operador, quantidade]) => {
		if (quantidade >= 5) {
			alertas.push({
				tipo: 'SOBRECARGA_OPERADOR',
				nivel: 'ATENCAO',
				mensagem: `Operador ${operador} possui ${quantidade} tickets em andamento`,
				operador: operador,
				quantidade: quantidade,
			});
		}
	});

	return alertas;
}

// ...existing code...

function formatEmailHTML(resumo) {
	// HTML otimizado para email com CSS inline
	let html = `
	<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background-color: #ffffff;">
		<!-- Cabeçalho -->
		<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
			<h1 style="margin: 0; font-size: 24px; font-weight: 300;">📊 Resumo Executivo GLPI</h1>
			<p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Tickets em Andamento - ${new Date(
				resumo.data_processamento,
			).toLocaleDateString('pt-BR', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			})}</p>
		</div>

		<!-- Conteúdo -->
		<div style="padding: 20px;">
			<!-- Métricas Principais -->
			<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
				<tr>
					<td style="padding: 15px; background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; width: 25%; text-align: center; vertical-align: top;">
						<div style="color: #495057; font-size: 14px; margin-bottom: 5px;">🎯 Total no Sistema</div>
						<div style="font-size: 28px; font-weight: bold; color: #007bff;">${
							resumo.resumo_executivo.total_tickets_sistema
						}</div>
						<div style="color: #6c757d; font-size: 12px;">Tickets registrados</div>
					</td>
					<td style="width: 25px;"></td>
					<td style="padding: 15px; background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; width: 25%; text-align: center; vertical-align: top;">
						<div style="color: #495057; font-size: 14px; margin-bottom: 5px;">⚡ Em Andamento</div>
						<div style="font-size: 28px; font-weight: bold; color: #007bff;">${
							resumo.resumo_executivo.tickets_em_andamento
						}</div>
						<div style="color: #6c757d; font-size: 12px;">${
							resumo.resumo_executivo.percentual_andamento
						} do total</div>
					</td>
					<td style="width: 25px;"></td>
					<td style="padding: 15px; background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; width: 25%; text-align: center; vertical-align: top;">
						<div style="color: #495057; font-size: 14px; margin-bottom: 5px;">👥 Operadores</div>
						<div style="font-size: 28px; font-weight: bold; color: #007bff;">${
							resumo.resumo_executivo.operadores_envolvidos
						}</div>
						<div style="color: #6c757d; font-size: 12px;">Envolvidos atualmente</div>
					</td>
				</tr>
			</table>`;

	// Alertas
	if (resumo.alertas.length > 0) {
		html += `
		<div style="margin: 20px 0;">
			<h2 style="color: #495057; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #dee2e6; padding-bottom: 8px;">🚨 Alertas</h2>`;

		resumo.alertas.forEach((alerta) => {
			const bgColor = alerta.nivel === 'CRITICO' ? '#ffebee' : '#fff3e0';
			const borderColor = alerta.nivel === 'CRITICO' ? '#f44336' : '#ff9800';
			const textColor = alerta.nivel === 'CRITICO' ? '#c62828' : '#ef6c00';
			const icon = alerta.nivel === 'CRITICO' ? '🔴' : '🟡';

			html += `
			<div style="padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid ${borderColor}; background-color: ${bgColor}; color: ${textColor};">
				<strong>${icon} ${alerta.tipo}:</strong> ${alerta.mensagem}
			</div>`;
		});

		html += `</div>`;
	} else {
		html += `
		<div style="text-align: center; padding: 20px; color: #28a745; font-size: 16px; background-color: #d4edda; border-radius: 8px; margin: 20px 0;">
			✅ Nenhum alerta crítico no momento
		</div>`;
	}

	// Distribuição por Urgência
	html += `
	<div style="margin: 20px 0;">
		<h2 style="color: #495057; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #dee2e6; padding-bottom: 8px;">⚡ Distribuição por Urgência</h2>
		<table style="width: 100%; border-collapse: collapse;">
			<tr>
				<td style="padding: 15px; background-color: #ffebee; border-radius: 8px; text-align: center; width: 33%; color: #c62828;">
					<div style="font-size: 14px; margin-bottom: 5px;">🔴 Alta</div>
					<div style="font-size: 24px; font-weight: bold;">${resumo.resumo_executivo.distribuicao_urgencia.alta}</div>
				</td>
				<td style="width: 10px;"></td>
				<td style="padding: 15px; background-color: #fff3e0; border-radius: 8px; text-align: center; width: 33%; color: #ef6c00;">
					<div style="font-size: 14px; margin-bottom: 5px;">🟡 Média</div>
					<div style="font-size: 24px; font-weight: bold;">${resumo.resumo_executivo.distribuicao_urgencia.media}</div>
				</td>
				<td style="width: 10px;"></td>
				<td style="padding: 15px; background-color: #e8f5e8; border-radius: 8px; text-align: center; width: 33%; color: #2e7d32;">
					<div style="font-size: 14px; margin-bottom: 5px;">🟢 Baixa</div>
					<div style="font-size: 24px; font-weight: bold;">${resumo.resumo_executivo.distribuicao_urgencia.baixa}</div>
				</td>
			</tr>
		</table>
	</div>`;

	// Ticket Mais Antigo
	if (resumo.metricas_chave.ticket_mais_antigo) {
		const ticket = resumo.metricas_chave.ticket_mais_antigo;
		html += `
		<div style="margin: 20px 0;">
			<h2 style="color: #495057; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #dee2e6; padding-bottom: 8px;">⏰ Ticket Mais Antigo em Andamento</h2>
			<div style="padding: 20px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff;">
				<h3 style="margin: 0 0 10px 0; color: #495057;">Ticket #${ticket.id}</h3>
				<p style="margin: 5px 0;"><strong>⏱️ Duração:</strong> ${ticket.duracao}</p>
				<p style="margin: 5px 0;"><strong>👤 Operador:</strong> ${ticket.operador}</p>
				<p style="margin: 5px 0;"><strong>🚨 Urgência:</strong> ${ticket.urgencia}</p>
				<p style="margin: 5px 0;"><strong>🏢 Setor:</strong> ${ticket.setor.replace(
					'INFORMATICA > ',
					'',
				)}</p>
			</div>
		</div>`;
	}

	// Top 5 Tickets
	if (resumo.tickets_em_andamento.length > 0) {
		html += `
		<div style="margin: 20px 0;">
			<h2 style="color: #495057; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #dee2e6; padding-bottom: 8px;">📋 Top ${Math.min(
				5,
				resumo.tickets_em_andamento.length,
			)} Tickets Mais Antigos</h2>
			<table style="width: 100%; border-collapse: collapse; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden;">
				<thead>
					<tr style="background-color: #007bff; color: white;">
						<th style="padding: 12px; text-align: left; font-size: 14px;">ID</th>
						<th style="padding: 12px; text-align: left; font-size: 14px;">Duração</th>
						<th style="padding: 12px; text-align: left; font-size: 14px;">Operador</th>
						<th style="padding: 12px; text-align: left; font-size: 14px;">Urgência</th>
						<th style="padding: 12px; text-align: left; font-size: 14px;">Setor</th>
					</tr>
				</thead>
				<tbody>`;

		resumo.tickets_em_andamento.slice(0, 5).forEach((ticket, index) => {
			let bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
			if (ticket.urgencia === 'Alta') bgColor = '#ffebee';
			else if (ticket.duracao_horas > 168) bgColor = '#fff3e0';

			html += `
			<tr style="background-color: ${bgColor};">
				<td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-size: 14px;"><strong>#${
					ticket.id
				}</strong></td>
				<td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-size: 14px;">${
					ticket.duracao
				}</td>
				<td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-size: 14px;">${
					ticket.operador
				}</td>
				<td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-size: 14px;">${
					ticket.urgencia
				}</td>
				<td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-size: 14px;">${ticket.setor.replace(
					'INFORMATICA > ',
					'',
				)}</td>
			</tr>`;
		});

		html += `
				</tbody>
			</table>
		</div>`;
	}

	// Rodapé
	html += `
		</div>
		<div style="text-align: center; padding: 20px; background-color: #6c757d; color: white; font-size: 12px; border-radius: 0 0 8px 8px;">
			Gerado automaticamente pelo sistema n8n • ${new Date().toLocaleString('pt-BR')}
		</div>
	</div>`;

	return html;
}

// Detectar ambiente e carregar dados
let inputData;
let isLocalEnvironment = false;

// Verificar se estamos no n8n ou ambiente local
if (typeof $input !== 'undefined' && $input && $input.all) {
	// Ambiente n8n
	console.log('Ambiente n8n detectado');
	inputData = $input.all()[0].json;
} else if (
	typeof $input !== 'undefined' &&
	$input &&
	$input.item &&
	$input.item.json
) {
	// Ambiente n8n com formato alternativo
	console.log('Ambiente n8n detectado (formato alternativo)');
	inputData = $input.item.json;
} else {
	// Ambiente local
	console.log('Ambiente local detectado, carregando analysis_result.json');
	isLocalEnvironment = true;
	const fs = require('fs');
	const path = require('path');

	try {
		const dataPath = path.join(__dirname, 'analysis_result.json');
		const localData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
		inputData = localData;
		console.log('Arquivo analysis_result.json carregado com sucesso');
	} catch (error) {
		console.error('Erro ao carregar analysis_result.json:', error.message);
		throw new Error('Não foi possível carregar os dados');
	}
}

// Verificar se temos dados para processar
if (!inputData) {
	console.error('Nenhum dado disponível para processamento');
	const errorResult = [
		{
			json: {
				error: true,
				email_html: `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffebee; padding: 20px; border-radius: 8px; border-left: 4px solid #f44336;">
					<h2 style="color: #d32f2f; margin-top: 0;">❌ Dados não encontrados</h2>
					<p><strong>Mensagem:</strong> Nenhum dado disponível para processamento</p>
					<p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
				</div>`,
				email_subject: `❌ Erro no Relatório GLPI - ${new Date().toLocaleDateString(
					'pt-BR',
				)}`,
				error_message: 'Nenhum dado disponível para processamento',
				processed_at: new Date().toISOString(),
			},
		},
	];

	if (isLocalEnvironment) {
		return { results: errorResult };
	} else {
		return errorResult;
	}
}

try {
	// Gera o resumo executivo
	const resumoExecutivo = generateExecutiveSummary(inputData);

	// Gera HTML otimizado para email
	const emailHTML = formatEmailHTML(resumoExecutivo);

	// Retorna dados baseado no ambiente
	const result = [
		{
			json: {
				// HTML principal para email
				email_html: emailHTML,

				// Dados para subject do email
				subject_data: {
					total_tickets: resumoExecutivo.resumo_executivo.tickets_em_andamento,
					tem_alertas: resumoExecutivo.alertas.length > 0,
					alertas_criticos: resumoExecutivo.alertas.filter(
						(a) => a.nivel === 'CRITICO',
					).length,
					data: new Date().toLocaleDateString('pt-BR'),
				},

				// Dados para condicionais no n8n
				workflow_data: {
					tem_alertas: resumoExecutivo.alertas.length > 0,
					tem_alertas_criticos:
						resumoExecutivo.alertas.filter((a) => a.nivel === 'CRITICO')
							.length > 0,
					tickets_urgencia_alta:
						resumoExecutivo.resumo_executivo.distribuicao_urgencia.alta,
					tickets_longa_duracao:
						resumoExecutivo.resumo_executivo.tickets_longa_duracao,
					percentual_andamento: parseFloat(
						resumoExecutivo.resumo_executivo.percentual_andamento.replace(
							'%',
							'',
						),
					),
				},

				// Subject sugerido para email
				email_subject: `📊 GLPI Resumo ${
					resumoExecutivo.alertas.length > 0 ? '🚨' : '✅'
				} - ${
					resumoExecutivo.resumo_executivo.tickets_em_andamento
				} tickets em andamento - ${new Date().toLocaleDateString('pt-BR')}`,

				// Resumo para notificações rápidas (Slack/Teams)
				quick_summary: `📊 GLPI: ${
					resumoExecutivo.resumo_executivo.tickets_em_andamento
				} tickets em andamento (${
					resumoExecutivo.resumo_executivo.percentual_andamento
				}) ${
					resumoExecutivo.alertas.length > 0
						? '🚨 ' + resumoExecutivo.alertas.length + ' alertas'
						: '✅ Sem alertas'
				}`,

				// Timestamp para logs
				processed_at: resumoExecutivo.data_processamento,
			},
		},
	];

	if (isLocalEnvironment) {
		// Ambiente local - salvar arquivo se fs estiver disponível
		try {
			const fs = require('fs');
			const path = require('path');

			// Salvar resultado completo
			const outputPath = path.join(__dirname, 'executive_summary_result.json');
			fs.writeFileSync(outputPath, JSON.stringify(result[0].json, null, 2));
			console.log(`📄 Resultado JSON salvo em: ${outputPath}`);

			// Salvar HTML separadamente
			const htmlPath = path.join(__dirname, 'executive_summary_result.html');
			fs.writeFileSync(htmlPath, emailHTML);
			console.log(`📄 Resultado HTML salvo em: ${htmlPath}`);

			console.log('\n📊 Resumo Executivo gerado com sucesso!');
			console.log(
				`   • Tickets em andamento: ${resumoExecutivo.resumo_executivo.tickets_em_andamento}`,
			);
			console.log(
				`   • Percentual: ${resumoExecutivo.resumo_executivo.percentual_andamento}`,
			);
			console.log(`   • Alertas: ${resumoExecutivo.alertas.length}`);
		} catch (error) {
			console.error('Erro ao salvar arquivos:', error.message);
		}

		// Para ambiente local/Node.js
		if (typeof module !== 'undefined' && module.exports) {
			module.exports = { results: result };
		}

		return { results: result };
	} else {
		// Ambiente n8n - retornar diretamente
		return result;
	}
} catch (error) {
	const errorResult = [
		{
			json: {
				error: true,
				email_html: `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffebee; padding: 20px; border-radius: 8px; border-left: 4px solid #f44336;">
				<h2 style="color: #d32f2f; margin-top: 0;">❌ Erro ao Processar Resumo Executivo GLPI</h2>
				<p><strong>Mensagem:</strong> ${error.message}</p>
				<p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
				<p style="font-size: 12px; color: #666;">Entre em contato com a equipe de TI para verificar o problema.</p>
			</div>`,
				email_subject: `❌ Erro no Relatório GLPI - ${new Date().toLocaleDateString(
					'pt-BR',
				)}`,
				error_message: error.message,
				processed_at: new Date().toISOString(),
			},
		},
	];

	if (isLocalEnvironment) {
		console.error('❌ Erro ao processar resumo executivo:', error.message);
		return { results: errorResult };
	} else {
		return errorResult;
	}
}

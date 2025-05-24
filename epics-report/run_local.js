const fs = require('fs');
const path = require('path');

console.log('🚀 Executando análise completa de épicos...\n');

// Função para executar um script e aguardar sua conclusão
function runScript(scriptPath, description) {
	return new Promise((resolve, reject) => {
		console.log(`📊 ${description}...`);

		if (!fs.existsSync(scriptPath)) {
			reject(new Error(`Script não encontrado: ${scriptPath}`));
			return;
		}

		const { spawn } = require('child_process');
		const extension = path.extname(scriptPath);

		let command, args;
		if (extension === '.js') {
			command = 'node';
			args = [scriptPath];
		} else if (extension === '.sh') {
			command = 'zsh';
			args = [scriptPath];
		} else {
			reject(new Error(`Tipo de arquivo não suportado: ${extension}`));
			return;
		}

		const child = spawn(command, args, {
			stdio: 'inherit',
			cwd: process.cwd(),
		});

		child.on('close', (code) => {
			if (code === 0) {
				console.log(`✅ ${description} concluído com sucesso!\n`);
				resolve();
			} else {
				reject(new Error(`${description} falhou com código: ${code}`));
			}
		});

		child.on('error', (error) => {
			reject(new Error(`Erro ao executar ${description}: ${error.message}`));
		});
	});
}

// Função principal
async function runEpicsAnalysis() {
	try {
		// Verificar se o arquivo de token existe
		if (!fs.existsSync('.token.txt')) {
			console.error('❌ Erro: Arquivo .token.txt não encontrado!');
			console.log(
				'📝 Crie um arquivo .token.txt na raiz do projeto com seu GitHub token.',
			);
			console.log('   Exemplo: github_pat_11AAAAAA...');
			process.exit(1);
		}

		// 1. Executar consulta ao GitHub
		await runScript(
			'./github-query.sh',
			'Coletando dados dos épicos do GitHub',
		);

		// Verificar se os dados foram coletados
		if (!fs.existsSync('data.json')) {
			throw new Error(
				'Falha ao coletar dados do GitHub - arquivo data.json não foi criado',
			);
		}

		// 2. Processar os dados
		await runScript('./process_data.js', 'Processando dados dos épicos');

		// Verificar se o processamento foi concluído
		if (!fs.existsSync('epics_analysis_result.json')) {
			throw new Error(
				'Falha no processamento - arquivo epics_analysis_result.json não foi criado',
			);
		}

		// 3. Formatar email (opcional)
		try {
			await runScript('./format_mail.js', 'Formatando email do relatório');
		} catch (error) {
			console.log(`⚠️  Aviso: Formatação de email falhou: ${error.message}`);
		}

		// 4. Exibir resumo dos resultados
		console.log('📋 === RESUMO DA ANÁLISE ===');

		try {
			const result = JSON.parse(
				fs.readFileSync('epics_analysis_result.json', 'utf8'),
			);

			console.log(`📊 Total de Épicos: ${result.totalEpics}`);
			console.log(
				`📈 Taxa Média de Conclusão: ${
					result.statistics?.averageCompletionRate || 0
				}%`,
			);
			console.log(
				`🎯 Progresso Geral: ${result.statistics?.overallProgress || 0}%`,
			);
			console.log(
				`📝 Sub-issues: ${result.statistics?.completedSubIssues || 0}/${
					result.statistics?.totalSubIssues || 0
				}`,
			);

			if (result.epicsProgress) {
				console.log('\n📊 Distribuição por Status:');
				Object.entries(result.epicsProgress).forEach(([status, count]) => {
					const icon =
						status === 'Completed'
							? '✅'
							: status === 'In Progress'
							? '🔄'
							: '⏸️ ';
					console.log(`   ${icon} ${status}: ${count} épicos`);
				});
			}

			console.log('\n📁 Arquivos gerados:');
			console.log('   📄 data.json - Dados brutos do GitHub');
			console.log('   📊 epics_analysis_result.json - Análise dos épicos');

			if (fs.existsSync('epic_report_email.html')) {
				console.log('   📧 epic_report_email.html - Email formatado');
			}
		} catch (parseError) {
			console.log('⚠️  Erro ao ler resultados para exibição do resumo');
		}

		console.log('\n🎉 Análise de épicos concluída com sucesso!');
	} catch (error) {
		console.error('\n❌ Erro durante a execução:', error.message);
		console.log('\n🔍 Verifique:');
		console.log(
			'   1. Se o arquivo .token.txt está presente e contém um token válido',
		);
		console.log('   2. Se você tem acesso ao projeto GitHub configurado');
		console.log('   3. Se todos os arquivos necessários estão no diretório');
		process.exit(1);
	}
}

// Verificar se está sendo executado diretamente
if (require.main === module) {
	runEpicsAnalysis();
}

module.exports = { runEpicsAnalysis };

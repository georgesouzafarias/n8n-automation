const SOURCE_NODE_NAME = 'Get Data'; // Nome do nó de origem
const MAX_ITERATIONS = 20; // Número máximo de iterações para prevenir loops infinitos

// Array para armazenar todos os nós combinados
let allNodes = [];
let projectData = null;
let totalPagesProcessed = 0;

console.log(
	`Iniciando coleta de dados de múltiplas execuções do nó: ${SOURCE_NODE_NAME}`,
);

// Loop para coletar todas as saídas disponíveis
let iteration = 0;
let hasMoreData = true;

while (hasMoreData && iteration < MAX_ITERATIONS) {
	try {
		// Tenta obter os dados da iteração atual
		const pages = $items(SOURCE_NODE_NAME, 0, iteration);

		if (!pages || pages.length === 0) {
			console.log(
				`Nenhum dado encontrado na iteração ${iteration}. Finalizando coleta.`,
			);
			hasMoreData = false;
			continue;
		}

		console.log(
			`Processando dados da iteração ${iteration}. Encontrados ${pages.length} itens.`,
		);

		// Processa cada item encontrado na iteração
		for (const item of pages) {
			// Verifica se temos os dados no formato esperado
			const project = item.json?.data?.organization?.projectV2;
			const nodes = project?.items?.nodes;

			if (project && nodes) {
				// Se ainda não temos metadados do projeto, salvamos da primeira ocorrência válida
				if (!projectData) {
					projectData = project;
					console.log(
						`Metadados do projeto obtidos: ${project.title} (ID: ${project.id})`,
					);
				}

				// Adiciona os nós encontrados ao array principal
				console.log(
					`Adicionando ${nodes.length} novos itens ao conjunto de dados`,
				);
				allNodes.push(...nodes);
				totalPagesProcessed++;
			} else {
				console.log(
					`Aviso: Formato de dados inesperado na iteração ${iteration}`,
				);
			}
		}

		// Avança para a próxima iteração
		iteration++;
	} catch (error) {
		// Se ocorrer um erro, significa que não há mais dados disponíveis
		console.log(
			`Fim dos dados disponíveis após ${iteration} iterações. Erro: ${error.message}`,
		);
		hasMoreData = false;
	}
}

// Verifica se conseguimos coletar algum dado
if (!projectData || allNodes.length === 0) {
	console.error('Erro: Nenhum dado válido foi encontrado em qualquer iteração');
	return [
		{
			json: {
				error: true,
				message: 'Não foi possível coletar dados válidos',
			},
		},
	];
}

// Estatísticas finais
console.log(`Coleta de dados concluída:`);
console.log(`- Total de iterações processadas: ${iteration}`);
console.log(`- Total de páginas válidas: ${totalPagesProcessed}`);
console.log(`- Total de itens coletados: ${allNodes.length}`);
console.log(`- Dados do projeto: ${projectData.title} (ID: ${projectData.id})`);

// Constrói o resultado final no formato esperado pelo process_data.js
const result = {
	data: {
		organization: {
			projectV2: {
				id: projectData.id,
				title: projectData.title,
				fields: projectData.fields,
				items: {
					nodes: allNodes,
				},
			},
		},
	},
};

// Retorna o resultado consolidado
return [{ json: result }];

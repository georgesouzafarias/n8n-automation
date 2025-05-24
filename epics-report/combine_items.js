// Combina todos os itens da paginação em um único array para análise de épicos
let allNodes = [];
let projectData = null;

// Cada item na entrada é uma página de resultados
$input.all().forEach((item) => {
	if (
		item.json &&
		item.json.data &&
		item.json.data.organization &&
		item.json.data.organization.projectV2 &&
		item.json.data.organization.projectV2.items &&
		item.json.data.organization.projectV2.items.nodes
	) {
		// Extrai os metadados do projeto da primeira resposta
		if (!projectData) {
			projectData = item.json.data.organization.projectV2;
		}

		// Adiciona todos os nós desta página à nossa coleção
		// Filtra apenas issues que são relevantes para análise de épicos
		const pageNodes = item.json.data.organization.projectV2.items.nodes.filter(
			(node) => {
				// Inclui apenas issues (não PRs) que podem ser épicos ou que têm sub-issues
				return (
					node.content &&
					node.content.title &&
					(node.content.subIssuesSummary ||
						(node.content.labels && node.content.labels.nodes))
				);
			},
		);

		allNodes = allNodes.concat(pageNodes);
	}
});

console.log(`Total de items coletados: ${allNodes.length}`);

// Constrói a saída final no formato esperado pelo script process_data.js
const result = {
	data: {
		organization: {
			projectV2: {
				id: projectData ? projectData.id : null,
				title: projectData ? projectData.title : 'Epic Analysis Project',
				fields: projectData ? projectData.fields : { nodes: [] },
				items: {
					nodes: allNodes,
				},
			},
		},
	},
};

// Retorna um único item com os dados combinados
return [{ json: result }];

// Combina todos os itens da paginação em um único array
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
		allNodes = allNodes.concat(
			item.json.data.organization.projectV2.items.nodes,
		);
	}
});

// Constrói a saída final no formato esperado pelo script process_data.js
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

// Retorna um único item com os dados combinados
return [{ json: result }];

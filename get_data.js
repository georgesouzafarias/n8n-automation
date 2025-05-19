const fs = require('fs');
const https = require('https');

let token;

if (typeof $vars === 'undefined') {
	console.log('Ambiente local detectado');
	try {
		const fs = require('fs');
		const https = require('https');

		const tokenFile = fs.readFileSync('.token.txt', 'utf8');
		const match = tokenFile.match(/github_pat_[A-Za-z0-9_]*/);

		if (match) {
			token = match[0];
		} else {
			console.error('Error: Could not extract GitHub token from .token.txt');
			process.exit(1);
		}
	} catch (error) {
		console.error('Error: .token.txt file not found!');
		process.exit(1);
	}
} else {
	console.log('Ambiente n8n');
	if (typeof $vars === 'undefined' || !$vars.TOKEN) {
		console.error('Error: TOKEN variable not found in n8n environment');
		process.exit(1);
	}
	token = $vars.TOKEN; // Use a variável TOKEN do n8n
}

function buildQuery(afterCursor = null) {
	const afterArg = afterCursor ? `, after: "${afterCursor}"` : '';

	return `
    query {
      organization(login: "${organization}") {
        projectV2(number: ${projectNumber}) {
          id
          title
          fields(first: 20) {
            nodes {
              ... on ProjectV2Field { id name }
              ... on ProjectV2IterationField {
                id
                name
                configuration {
                  completedIterations { id title startDate duration }
                  iterations { id title startDate duration }
                  duration
                  startDay
                }
              }
              ... on ProjectV2SingleSelectField { id name options { id name } }
            }
          }
          items(first: 100${afterArg}) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              content {
                ... on Issue {
                  title
                  number
                  state
                  url
                  assignees(first: 5) { nodes { login } }
                  labels(first: 5) { nodes { name } }
                  updatedAt
                  createdAt
                }
                ... on PullRequest {
                  title
                  number
                  state
                  url
                  assignees(first: 5) { nodes { login } }
                  labels(first: 5) { nodes { name } }
                  updatedAt
                  createdAt
                }
              }
              fieldValues(first: 20) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field { ... on ProjectV2FieldCommon { name } }
                  }
                  ... on ProjectV2ItemFieldDateValue {
                    date
                    field { ... on ProjectV2FieldCommon { name } }
                  }
                  ... on ProjectV2ItemFieldIterationValue {
                    title
                    startDate
                    duration
                    iterationId
                    field { ... on ProjectV2FieldCommon { name } }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
}

function makeGraphQLRequest(query) {
	return new Promise((resolve, reject) => {
		const data = JSON.stringify({ query });

		const options = {
			hostname: 'api.github.com',
			path: '/graphql',
			method: 'POST',
			headers: {
				Authorization: `token ${token}`,
				'Content-Type': 'application/json',
				'User-Agent': 'GitHub-GraphQL-API-Client',
			},
		};

		const req = https.request(options, (res) => {
			let responseData = '';

			res.on('data', (chunk) => {
				responseData += chunk;
			});

			res.on('end', () => {
				try {
					const parsedData = JSON.parse(responseData);
					resolve(parsedData);
				} catch (error) {
					reject(new Error(`Failed to parse response: ${error.message}`));
				}
			});
		});

		req.on('error', (error) => {
			reject(new Error(`Request failed: ${error.message}`));
		});

		req.write(data);
		req.end();
	});
}

// Construir a consulta GraphQL base

async function fetchDataWithPagination() {
	console.log('Making API request to GitHub with pagination...');

	let hasNextPage = true;
	let endCursor = null;
	let pageCount = 0;
	let allNodes = [];
	let firstPageData = null;

	try {
		// Loop para buscar todas as páginas até o limite ou até não haver mais dados
		while (hasNextPage && pageCount < maxPages) {
			pageCount++;
			console.log(`Fetching page ${pageCount}...`);

			const query = buildQuery(endCursor);
			const response = await makeGraphQLRequest(query);

			// Verificar se houve erros na resposta
			if (response.errors) {
				console.error(
					'Error in GraphQL query:',
					JSON.stringify(response.errors, null, 2),
				);
				process.exit(1);
			}

			// Salvar a primeira página para manter os metadados
			if (pageCount === 1) {
				firstPageData = response;
			}

			// Extrair os nós e informações de paginação
			const projectV2 = response.data.organization.projectV2;
			const nodes = projectV2.items.nodes;
			const pageInfo = projectV2.items.pageInfo;

			// Adicionar nós à lista completa
			allNodes = allNodes.concat(nodes);

			// Atualizar informações de paginação
			hasNextPage = pageInfo.hasNextPage;
			endCursor = pageInfo.endCursor;
		}

		// Construir o resultado final combinando os metadados da primeira página com todos os nós
		if (firstPageData) {
			firstPageData.data.organization.projectV2.items.nodes = allNodes;
			return allNodes;
		} else {
			const errorMsg = 'Error: No data received from GitHub API';
			throw new Error(errorMsg);
		}
	} catch (error) {
		console.error('Error:', error.message);
		process.exit(1);
	}
}

const organization = 'Interlis';
const projectNumber = 3;
const maxPages = 3; // Número máximo de páginas para buscar (3 x 100 = até 300 itens)

try {
	fetchDataWithPagination();
} catch (error) {
	return {
		json: {
			error: true,
			message: `Erro ao processar dados: ${error.message}`,
			inputStructure: JSON.stringify($input).substring(0, 500) + '...',
		},
	};
}

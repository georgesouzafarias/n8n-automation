# Sprint Analysis

Uma ferramenta para análise de dados de sprints do GitHub Projects, capaz de processar informações de issues e pull requests agrupadas por status, prioridade e atribuição.

## Visão Geral

Esta ferramenta foi projetada para funcionar em dois ambientes:

1. **Ambiente n8n**: Como um nó de código personalizado em um fluxo de trabalho n8n
2. **Ambiente Local**: Diretamente via Node.js em seu computador

## Requisitos

- Node.js (versão 14 ou superior)
- Um token de acesso pessoal do GitHub com permissões adequadas
- Acesso ao GitHub Project que deseja analisar

## Estrutura do Projeto

- `github-query.sh` - Script para obter dados do GitHub GraphQL API
- `process_data.js` - Script de processamento de dados principal

## Como Executar Localmente

### 1. Obtenha os Dados do GitHub

Primeiro, você precisa obter os dados do seu GitHub Project:

```bash
# Configure seu token do GitHub (substitua YOUR_GITHUB_TOKEN pelo seu token)
export GITHUB_TOKEN="your_github_token_here"

# Execute o script de consulta (ajuste os parâmetros conforme necessário)
./github-query.sh
```

Este comando irá gerar um arquivo `data.json` com os dados do GitHub Project.

### 2. Processe os Dados

Você tem duas opções para processar os dados:

#### Opção 1: Usando o script simplificado

```bash
node process_data.js
```

Este comando irá:

- Carregar automaticamente o arquivo `data.json`
- Processar os dados
- Gerar um resumo no console

## Uso em n8n

O script `process_data.js` foi projetado para funcionar como um nó de código personalizado em fluxos de trabalho n8n. Basta copiar o conteúdo do arquivo para um nó "Code" no n8n.

---

## Exemplo de Saída

```json
{
	"projectTitle": "Nome do Projeto",
	"totalIssues": 100,
	"statusCounts": {
		"In progress": 25,
		"Deployed to Production": 45,
		"Ready": 15,
		"Waiting Evidence": 10,
		"Test": 5
	},
	"priorityCounts": {
		"P0": 30,
		"P1": 40,
		"P2": 20,
		"P3": 10
	},
	"assigneeCounts": {
		"user1": 20,
		"user2": 15,
		"user3": 10
	},
	"openIssues": 55,
	"closedIssues": 45
}
```

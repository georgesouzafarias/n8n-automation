# n8n_automation

Coleção de automações para geração de relatórios desenvolvidas para o n8n, incluindo processamento de dados do GitHub Projects e SonarQube para análise de status de sprint e qualidade de código.

## Visão Geral

Este projeto contém automações projetadas para funcionar em dois ambientes:

1. **Ambiente n8n**: Como nós de código personalizados em fluxos de trabalho n8n
2. **Ambiente Local**: Diretamente via Node.js em seu computador

## Automações Disponíveis

### 1. sprint-report - Geração de Relatório do Status da Sprint

Processa dados de sprints do GitHub Projects, analisando issues e pull requests agrupados por status, prioridade e atribuição. Esta automação permite acompanhar o progresso da sprint, identificar gargalos e distribuir melhor as tarefas entre a equipe.

### 2. sonar-report - Geração de Relatório de Qualidade de Código

Obtém e processa métricas do SonarQube para avaliação de qualidade de código, incluindo cobertura de testes, bugs, code smells e vulnerabilidades. Esta automação permite monitorar a saúde do código, identificar problemas técnicos e garantir a manutenção de padrões de qualidade ao longo do desenvolvimento.

## Requisitos

### Gerais

- Node.js (versão 14 ou superior)
- n8n (para execução das automações em ambiente de workflow)

### Para Sprint Analysis

- Um token de acesso pessoal do GitHub com permissões adequadas
- Acesso ao GitHub Project que deseja analisar
- Permissões para usar a API GraphQL do GitHub

### Para SonarQube Report

- Acesso a uma instância do SonarQube
- Token de API do SonarQube (se autenticação for necessária)
- Projetos configurados no SonarQube para análise

## Estrutura do Projeto

O projeto é organizado em módulos com funcionalidades específicas:

### sprint-report - Geração de Relatório do Status da Sprint

- `sprint-report/github-query.sh` - Script para obter dados do GitHub GraphQL API
- `sprint-report/process_data.js` - Processamento principal de dados de sprint
- `sprint-report/combine_items.js` - Combinação de itens de diferentes fontes
- `sprint-report/format_mail.js` - Formatação de resultados para envio por email
- `sprint-report/run_local.js` - Script para execução local
- `sprint-report/Prompt.md` - Documentação auxiliar para usar com LLMs
- `sprint-report/dump/` - Diretório contendo exemplos de saída (Sprint_Analysis.json, Sprint_Summary.json)

### sonar-report - Geração de Relatório de Qualidade de Código

- `sonar-report/get-infos.sh` - Script para obter dados da API do SonarQube
- `sonar-report/process_data.js` - Processamento de métricas do SonarQube para o n8n
- `sonar-report/data.json` - Exemplo de dados do SonarQube para testes locais
- `sonar-report/project_Interlis_interlis-backend_details.json` - Exemplo de relatório detalhado
- `sonar-report/projects.json` - Lista de projetos do SonarQube

## Como Executar Localmente

### sprint-report - Geração de Relatório do Status da Sprint

#### 1. Obtenha os Dados do GitHub

Primeiro, você precisa obter os dados do seu GitHub Project:

```bash
# Configure seu token do GitHub
export GITHUB_TOKEN="your_github_token_here"

# Navegue até o diretório sprint-report
cd sprint-report

# Execute o script de consulta (ajuste os parâmetros conforme necessário)
./github-query.sh
```

Este comando irá gerar um arquivo `data.json` com os dados do GitHub Project.

#### 2. Processe os Dados

```bash
# Execute o processador de dados
node process_data.js
```

Este comando irá:

- Carregar automaticamente o arquivo `data.json`
- Processar os dados
- Gerar um arquivo `analysis_result.json` com os resultados

### sonar-report - Geração de Relatório de Qualidade de Código

#### 1. Obtenha os Dados do SonarQube

```bash
# Navegue até o diretório sonar-report
cd sonar-report

# Configure suas credenciais do SonarQube (se necessário)
export SONAR_TOKEN="your_sonar_token_here"

# Execute o script para obter os dados
./get-infos.sh
```

Este comando irá gerar um arquivo `data.json` com os dados do SonarQube.

#### 2. Processe os Dados do SonarQube

```bash
# Execute o processador de dados
node process_data.js
```

Este comando irá:

- Carregar o arquivo `data.json`
- Processar as métricas do SonarQube
- Gerar um arquivo `sonar-project-file.json` com os resultados

## Uso em n8n

### Configuração das Automações

Todos os scripts de processamento foram projetados para funcionar como nós de código personalizado em fluxos de trabalho n8n. Para utilizá-los:

1. Crie um novo nó de "Código" no n8n
2. Copie o conteúdo do arquivo `.js` desejado para o editor
3. Configure as entradas e saídas conforme necessário

### Automações Prontas para n8n

#### sprint-report - Workflow para Relatório do Status da Sprint

Esta automação analisa dados de sprints do GitHub Projects:

1. **Coleta de Dados**: Usa a API GraphQL do GitHub para obter informações sobre issues e pull requests
2. **Processamento de Dados**: Agrupa e analisa os dados por status, prioridade e atribuição
3. **Geração de Relatório**: Cria um resumo com estatísticas da sprint
4. **Notificação**: Opcionalmente pode enviar um email com os resultados formatados

#### sonar-report - Workflow para Relatório de Qualidade de Código

Esta automação coleta e processa métricas de qualidade de código:

1. **Obtenção de Dados**: Coleta métricas do SonarQube como cobertura de testes, bugs, code smells, etc.
2. **Processamento**: Extrai e organiza os dados relevantes por projeto
3. **Visualização**: Prepara os dados para apresentação em dashboards, emails ou relatórios gerenciais

---

## Exemplos de Saída

### Exemplo de saída do sprint-report (Relatório de Status da Sprint)

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

### Exemplo de saída do sonar-report (Relatório de Qualidade de Código)

```json
[
	{
		"id": "AYuXzMY4UWdQKkteXJO0",
		"key": "Interlis_interlis-backend",
		"name": "interlis-backend",
		"qualifier": "TRK",
		"measures": [
			{
				"metric": "coverage",
				"value": "65.8",
				"bestValue": false
			},
			{
				"metric": "bugs",
				"value": "3",
				"bestValue": false
			},
			{
				"metric": "code_smells",
				"value": "179",
				"bestValue": false
			},
			{
				"metric": "duplicated_lines_density",
				"value": "7.2",
				"bestValue": false
			},
			{
				"metric": "ncloc",
				"value": "92897"
			},
			{
				"metric": "vulnerabilities",
				"value": "0",
				"bestValue": true
			}
		]
	}
]
```

## Manutenção e Contribuição

Para contribuir com novas automações ou melhorar as existentes:

1. Clone o repositório
2. Crie um novo diretório para sua automação se necessário
3. Desenvolva e teste sua automação localmente
4. Atualize a documentação no README.md
5. Faça um pull request com suas alterações

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

### 3. epics-report - Geração de Relatório de Status dos Épicos

Analisa épicos do GitHub Projects através da API GraphQL, utilizando o campo `subIssuesSummary` para obter dados precisos sobre o progresso. Esta automação fornece uma visão executiva dos épicos, incluindo:

- **Análise Automática de Épicos**: Identifica épicos através de labels, títulos ou presença de sub-issues
- **Métricas de Progresso**: Utiliza `subIssuesSummary` para calcular percentual de conclusão preciso
- **Status Inteligente**: Determina automaticamente se épico está "Not Started", "In Progress" ou "Completed"
- **Relatório Executivo**: Gera resumo executivo com insights estratégicos e recomendações
- **Visualização Rica**: Relatórios HTML com gráficos de progresso e métricas visuais

**Recursos Principais:**

- Taxa média de conclusão de todos os épicos
- Progresso geral do projeto baseado em sub-issues
- Identificação de épicos prioritários
- Recomendações automáticas baseadas em análise de dados
- Suporte a automação semanal para acompanhamento contínuo

Esta automação é ideal para lideranças técnicas e product managers que precisam de visibilidade sobre o progresso de iniciativas estratégicas.

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
- `sprint-report/automation/` - Configurações para execução no n8n

### sonar-report - Geração de Relatório de Qualidade de Código

- `sonar-report/get-infos.sh` - Script para obter dados da API do SonarQube
- `sonar-report/process_data.js` - Processamento principal de métricas de qualidade
- `sonar-report/Prompt.md` - Instruções e documentação do módulo
- `sonar-report/automation/` - Configurações para execução no n8n

### epics-report - Geração de Relatório de Status dos Épicos

- `epics-report/github-query.sh` - Script para obter dados de épicos via GitHub GraphQL API (com suporte a `subIssuesSummary`)
- `epics-report/process_data.js` - Processamento inteligente de épicos e análise de progresso
- `epics-report/combine_items.js` - Combinação otimizada de dados para análise de épicos
- `epics-report/format_mail.js` - Formatação avançada com gráficos de progresso e métricas visuais
- `epics-report/run_local.js` - Script completo para execução local automatizada
- `epics-report/automation/Epic_Analysis.json` - Workflow completo n8n para análise detalhada
- `epics-report/automation/Epic_Summary.json` - Workflow n8n para relatório executivo semanal

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

### epics-report - Geração de Relatório de Status dos Épicos

#### Execução Automatizada (Recomendado)

```bash
# Navegue até o diretório epics-report
cd epics-report

# Configure seu token do GitHub no arquivo .token.txt
echo "github_pat_your_token_here" > .token.txt

# Execute análise completa
node run_local.js
```

Este comando executa todo o pipeline automaticamente:

1. Obtém dados do GitHub via GraphQL API
2. Processa épicos e calcula métricas de progresso
3. Gera relatório formatado em HTML
4. Exibe resumo executivo no terminal

#### Execução Manual (Passo a Passo)

##### 1. Obter Dados do GitHub

```bash
# Execute o script de consulta
./github-query.sh
```

##### 2. Processar Dados dos Épicos

```bash
# Execute o processador de dados
node process_data.js
```

##### 3. Formatar Relatório (Opcional)

```bash
# Gere email formatado
node format_mail.js
```

**Arquivos Gerados:**

- `data.json` - Dados brutos do GitHub
- `epics_analysis_result.json` - Análise completa dos épicos
- `epic_report_email.html` - Relatório HTML formatado

- Carregar automaticamente o arquivo `data.json`
- Processar os dados
- Gerar um arquivo `epics_analysis_result.json` com os resultados

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

#### epics-report - Workflows para Relatório de Status dos Épicos

Esta automação oferece dois tipos de análise:

**Epic_Analysis.json - Análise Detalhada:**

1. **Coleta Avançada**: Usa GraphQL API com `subIssuesSummary` para dados precisos
2. **Identificação Inteligente**: Detecta épicos via labels, títulos ou presença de sub-issues
3. **Análise de Progresso**: Calcula métricas detalhadas de conclusão e tendências
4. **Relatório Rico**: Gera HTML com gráficos visuais e insights estratégicos

**Epic_Summary.json - Resumo Executivo Semanal:**

1. **Automação Semanal**: Trigger automático todas as segundas às 9h
2. **Visão Executiva**: Foca em métricas de alto nível e status geral
3. **Insights Estratégicos**: Gera recomendações baseadas em análise de dados
4. **Email Profissional**: Envia resumo formatado para lideranças

**Recursos Avançados:**

- Detecção automática de status (Not Started/In Progress/Completed)
- Cálculo de taxa média de conclusão
- Identificação de épicos prioritários
- Recomendações automáticas baseadas em padrões
- Suporte a paginação para projetos grandes

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

### Exemplo de saída do epics-report (Relatório de Status dos Épicos)

```json
{
	"totalEpics": 10,
	"epicsProgress": {
		"Not Started": 3,
		"In Progress": 5,
		"Completed": 2
	},
	"epicsDetails": [
		{
			"epicId": "1",
			"epicTitle": "Epic 1",
			"status": "In Progress",
			"completionRate": 75,
			"subIssues": [
				{
					"issueId": "1.1",
					"issueTitle": "Sub-issue 1.1",
					"status": "Completed"
				},
				{
					"issueId": "1.2",
					"issueTitle": "Sub-issue 1.2",
					"status": "In Progress"
				}
			]
		},
		{
			"epicId": "2",
			"epicTitle": "Epic 2",
			"status": "Not Started",
			"completionRate": 0,
			"subIssues": []
		}
	]
}
```

## Manutenção e Contribuição

Para contribuir com novas automações ou melhorar as existentes:

1. Clone o repositório
2. Crie um novo diretório para sua automação se necessário
3. Desenvolva e teste sua automação localmente
4. Atualize a documentação no README.md
5. Faça um pull request com suas alterações

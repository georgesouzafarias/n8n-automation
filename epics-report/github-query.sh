#!/bin/zsh

# Read the GitHub token from .token.txt file
if [ ! -f .token.txt ]; then
    echo "Error: .token.txt file not found!"
    exit 1
fi

TOKEN=$(cat .token.txt | grep -o 'github_pat_[A-Za-z0-9_]*')

if [ -z "$TOKEN" ]; then
    echo "Error: Could not extract GitHub token from .token.txt"
    exit 1
fi

echo "Making API request to GitHub..."
curl -s -H "Authorization: token $TOKEN" \
     -X POST \
     -H "Content-Type: application/json" \
     -d @- https://api.github.com/graphql > data.json << 'EOF'
{
  "query": "query($organization: String!, $projectNumber: Int!, $afterCursor: String) { organization(login: $organization) { projectV2(number: $projectNumber) { id title fields(first: 20) { nodes { ... on ProjectV2Field { id name } ... on ProjectV2IterationField { id name configuration { completedIterations { id title startDate duration } iterations { id title startDate duration } duration startDay } } ... on ProjectV2SingleSelectField { id name options { id name } } } } items(first: 100, after: $afterCursor) { pageInfo { hasNextPage endCursor } nodes { id content { ... on Issue { title number state url labels(first: 10) { nodes { name } } assignees(first: 5) { nodes { login } } subIssuesSummary { completed percentCompleted total } issueType { id name description color } updatedAt createdAt } ... on PullRequest { title number state url assignees(first: 5) { nodes { login } } labels(first: 5) { nodes { name } } updatedAt createdAt } } fieldValues(first: 20) { nodes { ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } } ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2FieldCommon { name } } } ... on ProjectV2ItemFieldIterationValue { title startDate duration iterationId field { ... on ProjectV2FieldCommon { name } } } ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } } ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2FieldCommon { name } } } } } } } } } } }",
  "variables": {
    "afterCursor": "{{ $json.cursor ? $json.cursor : null }}",
    "organization": "{{ $("Set Params").item.json.organization }}",
    "projectNumber": {{ Number($("Set Params").item.json.projectNumber) }}
  }
}"
}
EOF

if [ $? -eq 0 ]; then
    echo "API request completed successfully."
    echo "Data has been saved to data.json"
else
    echo "Error: API request failed."
    exit 1
fi

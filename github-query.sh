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
  "query": "query {
    organization(login: \"Interlis\") {
      projectV2(number: 3) {
        id
        title
        fields(first: 20) {
          nodes {
            ... on ProjectV2Field {
              id
              name
            }
            ... on ProjectV2IterationField {
              id
              name
              configuration {
                completedIterations {
                  id
                  title
                  startDate
                  duration
                }
                iterations {
                  id
                  title
                  startDate
                  duration
                }
                duration
                startDay
              }
            }
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                id
                name
              }
            }
          }
        }
        items(first: 100) {
          nodes {
            id
            content {
              ... on Issue {
                title
                number
                state
                url
                assignees(first: 5) {
                  nodes {
                    login
                  }
                }
                labels(first: 5) {
                  nodes {
                    name
                  }
                }
                updatedAt
                createdAt
              }
              ... on PullRequest {
                title
                number
                state
                url
                assignees(first: 5) {
                  nodes {
                    login
                  }
                }
                labels(first: 5) {
                  nodes {
                    name
                  }
                }
                updatedAt
                createdAt
              }
            }
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldDateValue {
                  date
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldIterationValue {
                  title
                  startDate
                  duration
                  iterationId
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
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

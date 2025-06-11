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

echo "Making API request to GitHub with pagination..."

# Initialize variables for pagination
afterCursor=""
hasNextPage=true
allItems=()
projectInfo=""
fieldsInfo=""
pageCount=0

# Create temporary directory for storing page data
tempDir=$(mktemp -d)
trap "rm -rf $tempDir" EXIT

while [ "$hasNextPage" = "true" ]; do
    pageCount=$((pageCount + 1))
    echo "Fetching page $pageCount..."

    # Prepare the query with afterCursor variable
    if [ -z "$afterCursor" ]; then
        variables='{"afterCursor": null}'
    else
        variables='{"afterCursor": "'$afterCursor'"}'
    fi

    # Make the API request
    query='{"query": "query($afterCursor: String) { organization(login: \"Interlis\") { projectV2(number: 3) { id title fields(first: 20) { nodes { ... on ProjectV2Field { id name dataType } ... on ProjectV2IterationField { id name configuration { completedIterations { id title startDate duration } iterations { id title startDate duration } duration startDay } } ... on ProjectV2SingleSelectField { id name options { id name } } } } items(first: 100, after: $afterCursor) { pageInfo { hasNextPage endCursor } nodes { id content { ... on Issue { title number state url assignees(first: 5) { nodes { login } } labels(first: 5) { nodes { name } } issueType { id name description color } updatedAt createdAt } ... on PullRequest { title number state url assignees(first: 5) { nodes { login } } labels(first: 5) { nodes { name } } updatedAt createdAt } } fieldValues(first: 20) { nodes { ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } } ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2FieldCommon { name } } } ... on ProjectV2ItemFieldIterationValue { title startDate duration iterationId field { ... on ProjectV2FieldCommon { name } } } ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2FieldCommon { name } } } } } } } } } } }", "variables": '$variables'}'

    response=$(curl -s -H "Authorization: token $TOKEN" \
                    -X POST \
                    -H "Content-Type: application/json" \
                    -d "$query" \
                    https://api.github.com/graphql)

    if [ $? -ne 0 ]; then
        echo "Error: API request failed on page $pageCount"
        exit 1
    fi

    # Save page response to temporary file (clean control characters)
    echo "$response" | tr -d '\000-\037' > "$tempDir/page_$pageCount.json"

    # Extract pagination info (clean control characters from response)
    cleanResponse=$(echo "$response" | tr -d '\000-\037')
    hasNextPage=$(echo "$cleanResponse" | jq -r '.data.organization.projectV2.items.pageInfo.hasNextPage')
    afterCursor=$(echo "$cleanResponse" | jq -r '.data.organization.projectV2.items.pageInfo.endCursor')

    # Store project and fields info from first page
    if [ $pageCount -eq 1 ]; then
        projectInfo=$(echo "$cleanResponse" | jq '.data.organization.projectV2 | {id, title}')
        fieldsInfo=$(echo "$cleanResponse" | jq '.data.organization.projectV2.fields')
    fi

    # Check if we have valid data
    if [ "$hasNextPage" = "null" ]; then
        echo "Error: Invalid response from GitHub API"
        echo "Response: $cleanResponse"
        exit 1
    fi

    itemCount=$(echo "$cleanResponse" | jq '.data.organization.projectV2.items.nodes | length')
    echo "Page $pageCount: Retrieved $itemCount items"

    # Break if no more pages
    if [ "$hasNextPage" = "false" ]; then
        break
    fi

    # Safety check to prevent infinite loops
    if [ $pageCount -gt 50 ]; then
        echo "Warning: Reached maximum page limit (50). Breaking loop."
        break
    fi
done

echo "Combining data from $pageCount pages..."

# Combine all items from all pages
combinedItems="[]"
for i in $(seq 1 $pageCount); do
    if [ -f "$tempDir/page_$i.json" ]; then
        pageItems=$(jq '.data.organization.projectV2.items.nodes' "$tempDir/page_$i.json" 2>/dev/null)
        if [ "$pageItems" != "null" ] && [ -n "$pageItems" ]; then
            combinedItems=$(echo "$combinedItems" "$pageItems" | jq -s 'add')
        fi
    fi
done

# Create final JSON structure
if [ -n "$projectInfo" ] && [ -n "$fieldsInfo" ] && [ -n "$combinedItems" ]; then
    finalJson=$(jq -n --argjson project "$projectInfo" --argjson fields "$fieldsInfo" --argjson items "$combinedItems" '
        {
            data: {
                organization: {
                    projectV2: ($project + {
                        fields: $fields,
                        items: {
                            nodes: $items,
                            pageInfo: {
                                hasNextPage: false,
                                endCursor: null
                            }
                        }
                    })
                }
            }
        }
    ')
else
    echo "Error: Missing required data components"
    exit 1
fi

# Save final result
echo "$finalJson" > data.json

totalItems=$(echo "$combinedItems" | jq 'length')
echo "✅ Successfully retrieved $totalItems items across $pageCount pages"
echo "📄 Data has been saved to data.json"

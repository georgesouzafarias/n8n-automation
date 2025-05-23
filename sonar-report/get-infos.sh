#!/bin/bash

# Configuration
SONAR_TOKEN=""
ORGANIZATION=""

# Set default values for pagination
PAGE_SIZE=100
PAGE_INDEX=1

# Function to list projects
list_projects() {
    echo "Fetching projects from SonarCloud..."

    # Basic curl command to list projects
    curl -s -X GET "https://sonarcloud.io/api/projects/search?organization=${ORGANIZATION}&ps=${PAGE_SIZE}&p=${PAGE_INDEX}" \
      -H "Authorization: Bearer ${SONAR_TOKEN}" \
      -o projects.json

    echo "Projects saved to projects.json"

    # Optional: Display number of projects found
    TOTAL_PROJECTS=$(jq '.paging.total' projects.json)
    echo "Total projects found: ${TOTAL_PROJECTS}"
}

# Function to get detailed project information
get_project_details() {
    PROJECT_KEY=$1

    echo "Fetching details for project ${PROJECT_KEY}..."

    curl -s -X GET "https://sonarcloud.io/api/measures/component?component=${PROJECT_KEY}&metricKeys=ncloc,bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density" \
      -H "Authorization: Bearer ${SONAR_TOKEN}" \
      -o "project_${PROJECT_KEY}_details.json"

    echo "Details for ${PROJECT_KEY} saved to project_${PROJECT_KEY}_details.json"
}

# Main execution
main() {
    # Check if token is set
    if [ "$SONAR_TOKEN" = "YOUR_SONAR_TOKEN" ]; then
        echo "Error: Please set your SonarCloud token in the script"
        exit 1
    fi

    if [ "$ORGANIZATION" = "YOUR_ORGANIZATION" ]; then
        echo "Error: Please set your SonarCloud organization key in the script"
        exit 1
    fi

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        key="$1"
        case $key in
            --list-projects)
                list_projects
                shift
                ;;
            --project-details)
                if [ -z "$2" ]; then
                    echo "Error: Project key is required for --project-details"
                    exit 1
                fi
                get_project_details "$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--list-projects] [--project-details PROJECT_KEY]"
                exit 1
                ;;
        esac
    done

    # If no arguments provided, show usage
    if [ $# -eq 0 ]; then
        echo "Usage: $0 [--list-projects] [--project-details PROJECT_KEY]"
        echo ""
        echo "Examples:"
        echo "  $0 --list-projects"
        echo "  $0 --project-details my-project-key"
    fi
}

# Execute main function with all arguments
main "$@"
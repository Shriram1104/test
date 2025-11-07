projectInfo = {    
    project = "<project_id>"
    region = "<region>"
    serviceAccount = "<service-account-name>@<project_id>.iam.gserviceaccount.com"
}

cloudrunInfo = {
    name = "rag-schemeslib"
    spec = {
        image = "<repo-name>//rag-schemeslib:v1.0"
        ingress = "all"
        minCount = "1"
        maxCount = "5"
        traffic = 100
        requests = {
            cpu = "500m"
            memory = "512Mi"
        }
        limits = {
            cpu = "1000m"
            memory = "1Gi"
        }
    }
    ports = {
        name = "http1"
        protocol = "TCP"
        container_port = 80
    }
    envVars = [
    {
        name = "service"
        value = "rag-schemeslib:v1.0"
    }, 
    {
        name = "API_KEY"
        value = "<API_KEY>"
    },
    {
        name = "SECRET_KEY"
        value = "<SECRET_KEY>"
    },
    {
        name = "STATE_CODE"
        value = "<STATE_CODE>"
    },
    {
        name = "GENERATE_TOKEN_URL"
        value = "<GENERATE_TOKEN_URL>"
    },
    {
        name = "SCHEME_LIST_URL"
        value = "<SCHEME_LIST_URL>"
    },
    {
        name = "SCHEME_DETAILS_URL"
        value = "<SCHEME_DETAILS_URL>"
    },
    {
        name = "DATASTORE_UPLOAD_URL"
        value = "<DATASTORE_UPLOAD_URL>"
    },    
    {
        name = "PROJECT_ID"
        value = "<project-id>"
    }]
    members = ["allUsers"]
}
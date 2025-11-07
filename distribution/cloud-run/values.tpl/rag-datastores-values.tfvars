projectInfo = {    
    project = "<project_id>"
    region = "<region>"
    serviceAccount = "<service-account-name>@<project_id>.iam.gserviceaccount.com"
}

cloudrunInfo = {
    name = "rag-datastoreslib"
    spec = {
        image = "<repo-name>/rag-datastoreslib:v1.0"
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
        value = "rag-datastoreslib:v1.0"
    },        
    {
        name = "PROJECT_ID"
        value = "<project-id>"
    }]
    members = ["allUsers"]
}
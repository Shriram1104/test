projectInfo = {    
    project = "<project_id>"
    region = "<region>"
    serviceAccount = "<service-account-name>@<project_id>.iam.gserviceaccount.com"
}

cloudrunInfo = {
    name = "schemes-search-agent"
    spec = {
        image = "<repo-name>/schemes-search-agent:v1.0"
        ingress = "all"
        minCount = "1"
        maxCount = "10"
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
        value = "schemes-search-agent:v1.0"
    },
    {
        name = "DISCOVERY_ENGINE_HOST"
        value = "discoveryengine.googleapis.com/v1alpha"
    },
    {
        name = "DISCOVERY_ENGINE_SEARCH_PROMPT"
        value = "Given the conversation between a user and a helpful assistant and some search results, create a final answer for the assistant in English only. The answer should:\n- Use all relevant information from the search results.\n- Not introduce any additional information, and use exactly the same words as the search results when possible.\n- Not be more than 20 sentences.\n- Include as much detail as possible.\nAdditionally, the Datastore is a list of JSON documents with deep nesting of document hierarchy. Answer should carefully go through the hierarchy and understand the relationships while generating the final answer; e.g. Eligibility Criteria, Benefits, Document Checklist and Schemes.\nThe user persona is common people of India - Students, Farmers, Daily Wage workers etc.\nThe assistant should answer in a more down-to-earth and grounded manner.\nThe assistant should not use any vernacular dialect with english words by any means. It should honour the language code chosen and deliver responses accordingly."
    },
    {
        name = "SEARCH_MODEL_VERSION"
        value = "gemini-2.5-flash/answer_gen/v1"
    },
    {
        name = "WEBSOCK_STREAMER_HTTP_HOST"
        value = "<WEBSOCK_STREAMER_HTTP_HOST>"
    },
    {
        name = "PROJECT_ID"
        value = "<project-id>"
    }]
    members = ["allUsers"]
}
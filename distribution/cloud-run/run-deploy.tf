provider "google" {
    project = var.projectInfo.project
    region = var.projectInfo.region
}

resource "google_cloud_run_service" "cr_service" {    
    name = var.cloudrunInfo.name
    location = var.projectInfo.region
    template {
      spec {
        containers {
          image = var.cloudrunInfo.spec.image
          resources {
            limits = {
              cpu = var.cloudrunInfo.spec.limits.cpu
              memory = var.cloudrunInfo.spec.limits.memory
            }
            requests = {
              cpu = var.cloudrunInfo.spec.requests.cpu
              memory = var.cloudrunInfo.spec.requests.memory
            }
          }
          ports {
            name = var.cloudrunInfo.ports.name
            protocol = var.cloudrunInfo.ports.protocol
            container_port = var.cloudrunInfo.ports.container_port 
          }          
          dynamic "env" {
            for_each = var.cloudrunInfo.envVars
            content {
              name = env.value.name
              value = env.value.value
            }            
          }
        }        
        service_account_name = var.projectInfo.serviceAccount
      }
      
      metadata {
        annotations = {
          "autoscaling.knative.dev/minScale" = var.cloudrunInfo.spec.minCount
          "autoscaling.knative.dev/maxScale" = var.cloudrunInfo.spec.maxCount        
        }
      }
    }

    traffic {
      percent = var.cloudrunInfo.spec.traffic
      latest_revision = true
    }

    metadata {
      annotations = {
        "run.googleapis.com/ingress" = var.cloudrunInfo.spec.ingress               
      }
    }
}

resource "google_cloud_run_service_iam_binding" "cr_binding" {  
  project = var.projectInfo.project
  location = var.projectInfo.region
  service = var.cloudrunInfo.name
  role = "roles/run.invoker"
  members = var.cloudrunInfo.members
  depends_on = [
    google_cloud_run_service.cr_service
  ]
}


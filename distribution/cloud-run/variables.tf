variable "projectInfo"{    
    type = object({
        project = string
        region = string        
        serviceAccount = string
    })
    
    default = {
        project = ""
        region = ""
        serviceAccount = ""
    }
}

variable "cloudrunInfo"{
    type = object({
        name = string        
        spec = object({
            image = string
            ingress = string
            minCount = optional(string)
            maxCount = optional(string)
            traffic = number            
            limits = object({
                cpu = string
                memory = string
            })
            requests = object({
                cpu = string
                memory = string
            })             
        })
        ports = object({
            name = string
            protocol = string
            container_port = number
        })
        envVars = optional(list(object({
            name = string
            value = string
        })))        
        members = list(string)        
    })

    default = {
        name = ""
        spec = {
            image = ""
            ingress = ""                        
            traffic = 100            
            requests = {
                cpu = ""
                memory = ""
            }
            limits = {
                cpu = ""
                memory = ""
            }
        }
        ports = {
            name = ""
            protocol = ""
            container_port = 0
        }
        envVars = []        
        members = []        
    }    
}
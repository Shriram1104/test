terraform {
  backend "gcs" {
    bucket = "vertex-ai-471611-terra-stg"
    prefix = ""
  }
}
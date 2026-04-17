output "registry_endpoint" {
  description = "Private Scaleway Container Registry endpoint for ShelfScan images."
  value       = scaleway_registry_namespace.app.endpoint
}

output "suggested_registry_image" {
  description = "Suggested image reference to build and push before enabling deploy_container."
  value       = "${scaleway_registry_namespace.app.endpoint}/shelfscan:latest"
}

output "container_namespace_id" {
  description = "Scaleway Serverless Containers namespace ID."
  value       = scaleway_container_namespace.app.id
}

output "container_domain_name" {
  description = "Generated public domain for the deployed Serverless Container, when deploy_container is enabled."
  value       = try(scaleway_container.app[0].domain_name, null)
}

output "custom_container_hostname" {
  description = "Custom hostname bound to the container when container_hostname is configured."
  value       = try(scaleway_container_domain.app[0].hostname, null)
}

output "object_storage_bucket_name" {
  description = "Private Object Storage bucket used for uploaded images."
  value       = scaleway_object_bucket.uploads.name
}

output "object_storage_endpoint_url" {
  description = "S3-compatible endpoint URL for the created Object Storage bucket."
  value       = local.object_storage_endpoint
}

output "object_storage_access_key" {
  description = "Access key for the IAM application dedicated to ShelfScan object storage access."
  value       = scaleway_iam_api_key.object_storage.access_key
  sensitive   = true
}

output "object_storage_secret_key" {
  description = "Secret key for the IAM application dedicated to ShelfScan object storage access."
  value       = scaleway_iam_api_key.object_storage.secret_key
  sensitive   = true
}

output "database_host" {
  description = "Managed PostgreSQL endpoint host."
  value       = local.database_host
}

output "database_port" {
  description = "Managed PostgreSQL endpoint port."
  value       = 5432
}

output "database_name" {
  description = "ShelfScan application database name."
  value       = scaleway_rdb_database.app.name
}

output "database_user" {
  description = "ShelfScan application database username."
  value       = scaleway_rdb_user.app.name
}

output "database_password" {
  description = "ShelfScan application database password."
  value       = random_password.rdb_app.result
  sensitive   = true
}

output "database_url" {
  description = "Application database URL for non-container deployments."
  value       = local.database_url
  sensitive   = true
}

output "bootstrap_admin_username" {
  description = "Bootstrap admin username injected into the container."
  value       = var.bootstrap_admin_username
}

output "bootstrap_admin_password" {
  description = "Generated bootstrap admin password."
  value       = random_password.bootstrap_admin.result
  sensitive   = true
}

output "jwt_secret_key" {
  description = "Generated JWT signing secret."
  value       = random_password.jwt_secret.result
  sensitive   = true
}
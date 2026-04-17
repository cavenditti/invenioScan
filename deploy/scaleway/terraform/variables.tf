variable "project_id" {
  description = "Scaleway project ID. Leave null to use SCW_DEFAULT_PROJECT_ID from the environment."
  type        = string
  default     = null
}

variable "region" {
  description = "Scaleway region for regional resources."
  type        = string
  default     = "fr-par"
}

variable "zone" {
  description = "Scaleway zone for provider compatibility."
  type        = string
  default     = "fr-par-1"
}

variable "name_prefix" {
  description = "Prefix used when naming Scaleway resources."
  type        = string
  default     = "shelfscan"
}

variable "deploy_container" {
  description = "Whether to create and deploy the public Serverless Container after the image has been pushed."
  type        = bool
  default     = false
}

variable "container_name" {
  description = "Serverless Container name."
  type        = string
  default     = "web"
}

variable "container_registry_image" {
  description = "Fully qualified registry image to deploy. Leave null to use the generated registry namespace with /shelfscan:latest."
  type        = string
  default     = null
}

variable "container_hostname" {
  description = "Optional custom hostname to bind to the Serverless Container after DNS is configured."
  type        = string
  default     = null
}

variable "container_port" {
  description = "Port exposed by the ShelfScan container."
  type        = number
  default     = 8000
}

variable "container_cpu_limit" {
  description = "CPU limit in millicores for the Serverless Container."
  type        = number
  default     = 1024
}

variable "container_memory_limit" {
  description = "Memory limit in MB for the Serverless Container."
  type        = number
  default     = 2048
}

variable "container_min_scale" {
  description = "Minimum number of warm container instances."
  type        = number
  default     = 0
}

variable "container_max_scale" {
  description = "Maximum number of container instances."
  type        = number
  default     = 3
}

variable "container_timeout_seconds" {
  description = "Maximum request execution time for the Serverless Container."
  type        = number
  default     = 300
}

variable "container_max_concurrency" {
  description = "Maximum concurrent requests handled by a single container instance."
  type        = number
  default     = 80
}

variable "rdb_engine" {
  description = "Managed PostgreSQL engine version."
  type        = string
  default     = "PostgreSQL-16"
}

variable "rdb_node_type" {
  description = "Managed database node size."
  type        = string
  default     = "db-dev-s"
}

variable "rdb_database_name" {
  description = "Application database name."
  type        = string
  default     = "shelfscan"
}

variable "rdb_admin_username" {
  description = "Initial admin username for the managed database instance."
  type        = string
  default     = "shelfscan_admin"
}

variable "rdb_app_username" {
  description = "Application username for the managed database."
  type        = string
  default     = "shelfscan_app"
}

variable "rdb_high_availability" {
  description = "Whether to use a high-availability managed database cluster."
  type        = bool
  default     = false
}

variable "rdb_acl_cidrs" {
  description = "CIDR ranges allowed to reach the managed PostgreSQL endpoint."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "object_storage_prefix" {
  description = "Prefix used for uploaded objects inside the Object Storage bucket."
  type        = string
  default     = "uploads"
}

variable "bootstrap_admin_username" {
  description = "Bootstrap admin username injected into the app container."
  type        = string
  default     = "admin"
}

variable "bootstrap_admin_email" {
  description = "Bootstrap admin email injected into the app container."
  type        = string
  default     = "admin@example.com"
}

variable "tags" {
  description = "Tags applied to the managed database and container resources when supported."
  type        = list(string)
  default     = ["shelfscan", "production"]
}
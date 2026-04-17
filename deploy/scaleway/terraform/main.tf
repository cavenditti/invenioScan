provider "scaleway" {
  project_id = var.project_id
  region     = var.region
  zone       = var.zone
}

resource "random_string" "suffix" {
  length  = 6
  upper   = false
  lower   = true
  numeric = true
  special = false
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "random_password" "bootstrap_admin" {
  length  = 32
  special = false
}

resource "random_password" "rdb_admin" {
  length  = 32
  special = false
}

resource "random_password" "rdb_app" {
  length  = 32
  special = false
}

locals {
  registry_namespace_name  = "${var.name_prefix}-rg-${random_string.suffix.result}"
  container_namespace_name = "${var.name_prefix}-containers-${random_string.suffix.result}"
  bucket_name              = "${var.name_prefix}-${random_string.suffix.result}-uploads"
  object_storage_endpoint  = "https://s3.${var.region}.scw.cloud"
  registry_image           = coalesce(var.container_registry_image, "${scaleway_registry_namespace.app.endpoint}/shelfscan:latest")
  database_host            = scaleway_rdb_instance.main.load_balancer[0].ip
  database_url             = "postgresql+asyncpg://${scaleway_rdb_user.app.name}:${random_password.rdb_app.result}@${local.database_host}:5432/${scaleway_rdb_database.app.name}"
  public_base_env          = var.container_hostname == null ? {} : { INVSCAN_PUBLIC_BASE_URL = "https://${var.container_hostname}" }
}

resource "scaleway_registry_namespace" "app" {
  name        = local.registry_namespace_name
  description = "Private ShelfScan image registry"
  is_public   = false
}

resource "scaleway_container_namespace" "app" {
  name        = local.container_namespace_name
  description = "ShelfScan Serverless Containers namespace"
}

resource "scaleway_object_bucket" "uploads" {
  name   = local.bucket_name
  region = var.region

  tags = {
    app        = var.name_prefix
    managed-by = "opentofu"
  }
}

resource "scaleway_object_bucket_acl" "uploads" {
  bucket = scaleway_object_bucket.uploads.id
  acl    = "private"
}

resource "scaleway_iam_application" "object_storage" {
  name = "${var.name_prefix}-object-storage"
}

resource "scaleway_iam_policy" "object_storage" {
  name           = "${var.name_prefix}-object-storage"
  application_id = scaleway_iam_application.object_storage.id

  rule {
    project_ids          = [scaleway_object_bucket.uploads.project_id]
    permission_set_names = ["ObjectStorageFullAccess"]
  }
}

resource "scaleway_iam_api_key" "object_storage" {
  application_id = scaleway_iam_application.object_storage.id
}

resource "scaleway_rdb_instance" "main" {
  name               = "${var.name_prefix}-db"
  node_type          = var.rdb_node_type
  engine             = var.rdb_engine
  is_ha_cluster      = var.rdb_high_availability
  encryption_at_rest = true
  disable_backup     = false
  user_name          = var.rdb_admin_username
  password           = random_password.rdb_admin.result
  tags               = var.tags

  load_balancer {}
}

resource "scaleway_rdb_database" "app" {
  instance_id = scaleway_rdb_instance.main.id
  name        = var.rdb_database_name
}

resource "scaleway_rdb_user" "app" {
  instance_id = scaleway_rdb_instance.main.id
  name        = var.rdb_app_username
  password    = random_password.rdb_app.result
  is_admin    = false
}

resource "scaleway_rdb_acl" "app" {
  instance_id = scaleway_rdb_instance.main.id

  dynamic "acl_rules" {
    for_each = toset(var.rdb_acl_cidrs)

    content {
      ip          = acl_rules.value
      description = "ShelfScan application access"
    }
  }
}

resource "scaleway_container" "app" {
  count = var.deploy_container ? 1 : 0

  name         = var.container_name
  description  = "ShelfScan web application"
  namespace_id = scaleway_container_namespace.app.id
  tags         = var.tags

  registry_image  = local.registry_image
  port            = var.container_port
  cpu_limit       = var.container_cpu_limit
  memory_limit    = var.container_memory_limit
  min_scale       = var.container_min_scale
  max_scale       = var.container_max_scale
  timeout         = var.container_timeout_seconds
  max_concurrency = var.container_max_concurrency
  privacy         = "public"
  protocol        = "http1"
  deploy          = true

  environment_variables = merge(
    {
      INVSCAN_UPLOAD_BACKEND            = "s3"
      INVSCAN_S3_ENDPOINT_URL           = local.object_storage_endpoint
      INVSCAN_S3_REGION                 = var.region
      INVSCAN_S3_BUCKET                 = scaleway_object_bucket.uploads.name
      INVSCAN_S3_PREFIX                 = var.object_storage_prefix
      INVSCAN_BOOTSTRAP_ADMIN_USERNAME  = var.bootstrap_admin_username
      INVSCAN_BOOTSTRAP_ADMIN_EMAIL     = var.bootstrap_admin_email
      INVSCAN_COOKIE_SECURE             = "true"
    },
    local.public_base_env,
  )

  secret_environment_variables = {
    INVSCAN_DATABASE_URL             = local.database_url
    INVSCAN_JWT_SECRET_KEY           = random_password.jwt_secret.result
    INVSCAN_BOOTSTRAP_ADMIN_PASSWORD = random_password.bootstrap_admin.result
    INVSCAN_S3_ACCESS_KEY            = scaleway_iam_api_key.object_storage.access_key
    INVSCAN_S3_SECRET_KEY            = scaleway_iam_api_key.object_storage.secret_key
  }

  depends_on = [
    scaleway_rdb_database.app,
    scaleway_rdb_user.app,
    scaleway_rdb_acl.app,
  ]
}

resource "scaleway_container_domain" "app" {
  count = var.deploy_container && var.container_hostname != null ? 1 : 0

  container_id = scaleway_container.app[0].id
  hostname     = var.container_hostname
}
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6.0, < 4.0.0"
    }

    scaleway = {
      source  = "scaleway/scaleway"
      version = ">= 2.0.0, < 3.0.0"
    }
  }
}
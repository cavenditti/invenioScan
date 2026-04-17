from __future__ import annotations

import asyncio
from mimetypes import guess_type
from pathlib import Path
from pathlib import PurePosixPath
from urllib.parse import quote
from uuid import uuid4

import boto3
from fastapi import Request, UploadFile
from fastapi.responses import FileResponse, Response
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from shelfscan.settings import Settings


CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class InvalidUploadKeyError(ValueError):
    pass


class UploadNotFoundError(FileNotFoundError):
    pass


async def persist_upload(
    upload: UploadFile, settings: Settings, request: Request
) -> tuple[str, str]:
    storage = _build_upload_storage(settings)
    key = await storage.save(upload)
    relative_path = quote(key)
    public_base = (settings.public_base_url or str(request.base_url)).rstrip("/")
    public_url = f"{public_base}/uploads/{relative_path}"
    return key, public_url


async def build_upload_response(filename: str, settings: Settings) -> Response:
    storage = _build_upload_storage(settings)
    return await storage.build_response(filename)


def _build_upload_storage(settings: Settings) -> "BaseUploadStorage":
    if settings.upload_backend == "s3":
        return S3UploadStorage(settings)
    return LocalUploadStorage(settings)


class BaseUploadStorage:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def save(self, upload: UploadFile) -> str:
        raise NotImplementedError

    async def build_response(self, key: str) -> Response:
        raise NotImplementedError


class LocalUploadStorage(BaseUploadStorage):
    async def save(self, upload: UploadFile) -> str:
        upload_root = self.settings.upload_dir
        upload_root.mkdir(parents=True, exist_ok=True)

        suffix = _resolve_suffix(upload)
        filename = f"{uuid4().hex}{suffix}"
        destination = upload_root / filename
        content = await upload.read()
        destination.write_bytes(content)
        await upload.close()
        return filename

    async def build_response(self, key: str) -> Response:
        normalized_key = _normalize_upload_key(key)
        upload_dir = Path(self.settings.upload_dir).resolve()
        target = (upload_dir / normalized_key).resolve()
        try:
            target.relative_to(upload_dir)
        except ValueError as exc:
            raise InvalidUploadKeyError("Invalid upload path") from exc
        if not target.is_file():
            raise UploadNotFoundError(normalized_key)
        return FileResponse(target)


class S3UploadStorage(BaseUploadStorage):
    def __init__(self, settings: Settings):
        super().__init__(settings)
        self.client = _create_s3_client(settings)

    async def save(self, upload: UploadFile) -> str:
        suffix = _resolve_suffix(upload)
        filename = f"{uuid4().hex}{suffix}"
        key = _build_object_key(filename, self.settings)
        content = await upload.read()
        content_type = _resolve_content_type(upload, filename)
        await upload.close()
        await asyncio.to_thread(
            self.client.put_object,
            Bucket=self.settings.s3_bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
        )
        return key

    async def build_response(self, key: str) -> Response:
        normalized_key = _normalize_upload_key(key)
        try:
            obj = await asyncio.to_thread(
                self.client.get_object,
                Bucket=self.settings.s3_bucket,
                Key=normalized_key,
            )
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code")
            if error_code in {"404", "NoSuchKey", "NotFound"}:
                raise UploadNotFoundError(normalized_key) from exc
            raise

        body = obj["Body"]
        try:
            content = body.read()
        finally:
            body.close()

        media_type = obj.get("ContentType") or guess_type(normalized_key)[0]
        return Response(content=content, media_type=media_type or "application/octet-stream")


def _build_object_key(filename: str, settings: Settings) -> str:
    if settings.s3_prefix:
        return f"{settings.s3_prefix}/{filename}"
    return filename


def _normalize_upload_key(key: str) -> str:
    normalized = PurePosixPath(key)
    if not key or normalized.is_absolute() or ".." in normalized.parts:
        raise InvalidUploadKeyError("Invalid upload path")
    normalized_key = normalized.as_posix()
    if normalized_key in {"", "."}:
        raise InvalidUploadKeyError("Invalid upload path")
    return normalized_key


def _create_s3_client(settings: Settings):
    config = BotoConfig(
        s3={"addressing_style": "path" if settings.s3_force_path_style else "auto"}
    )
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=config,
    )


def _resolve_suffix(upload: UploadFile) -> str:
    if upload.filename:
        suffix = Path(upload.filename).suffix.lower()
        if suffix:
            return suffix
    return CONTENT_TYPE_EXTENSIONS.get(upload.content_type or "", ".jpg")


def _resolve_content_type(upload: UploadFile, filename: str) -> str:
    return upload.content_type or guess_type(filename)[0] or "application/octet-stream"

from io import BytesIO
from pathlib import Path

import pytest
from botocore.exceptions import ClientError
from starlette.datastructures import Headers, UploadFile
from starlette.requests import Request
from starlette.responses import FileResponse, Response

from shelfscan.settings import Settings
from shelfscan.uploads import build_upload_response, persist_upload


def _build_settings(**overrides) -> Settings:
    base = {"jwt_secret_key": "x" * 32}
    base.update(overrides)
    return Settings(**base)


def _build_request() -> Request:
    return Request(
        {
            "type": "http",
            "scheme": "https",
            "server": ("example.com", 443),
            "path": "/api/v1/ingest/upload",
            "headers": [],
        }
    )


def _build_upload(filename: str, content: bytes, content_type: str) -> UploadFile:
    return UploadFile(
        file=BytesIO(content),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )


class FakeS3Client:
    def __init__(self):
        self.objects: dict[tuple[str, str], tuple[bytes, str | None]] = {}

    def put_object(self, Bucket: str, Key: str, Body: bytes, ContentType: str | None = None):
        self.objects[(Bucket, Key)] = (Body, ContentType)

    def get_object(self, Bucket: str, Key: str):
        item = self.objects.get((Bucket, Key))
        if item is None:
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")
        body, content_type = item
        return {"Body": BytesIO(body), "ContentType": content_type}


@pytest.mark.asyncio
async def test_persist_upload_local_backend_and_serve(tmp_path: Path):
    settings = _build_settings(
        public_base_url="https://example.com",
        upload_backend="local",
        upload_dir=tmp_path,
    )
    upload = _build_upload("cover.jpg", b"local-image", "image/jpeg")

    key, public_url = await persist_upload(upload, settings, _build_request())

    assert public_url == f"https://example.com/uploads/{key}"
    assert (tmp_path / key).read_bytes() == b"local-image"

    response = await build_upload_response(key, settings)

    assert isinstance(response, FileResponse)
    assert Path(response.path).read_bytes() == b"local-image"


@pytest.mark.asyncio
async def test_persist_upload_s3_backend_and_serve(monkeypatch: pytest.MonkeyPatch):
    fake_client = FakeS3Client()
    monkeypatch.setattr("shelfscan.uploads._create_s3_client", lambda settings: fake_client)

    settings = _build_settings(
        public_base_url="https://example.com",
        upload_backend="s3",
        s3_endpoint_url="https://s3.fr-par.scw.cloud",
        s3_region="fr-par",
        s3_bucket="shelfscan-uploads",
        s3_access_key="access-key",
        s3_secret_key="secret-key",
        s3_prefix="covers",
    )
    upload = _build_upload("cover.png", b"cloud-image", "image/png")

    key, public_url = await persist_upload(upload, settings, _build_request())

    assert key.startswith("covers/")
    assert public_url == f"https://example.com/uploads/{key}"
    assert fake_client.objects[("shelfscan-uploads", key)][0] == b"cloud-image"

    response = await build_upload_response(key, settings)

    assert isinstance(response, Response)
    assert response.body == b"cloud-image"
    assert response.media_type == "image/png"


def test_s3_backend_requires_required_settings():
    with pytest.raises(ValueError, match="upload_backend='s3' requires"):
        _build_settings(upload_backend="s3")
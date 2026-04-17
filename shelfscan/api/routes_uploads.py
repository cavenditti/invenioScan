from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from shelfscan.dependencies import get_current_user
from shelfscan.models import User
from shelfscan.settings import Settings, get_settings
from shelfscan.uploads import InvalidUploadKeyError, UploadNotFoundError, build_upload_response

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.get("/{filename:path}")
async def serve_upload(
    filename: str,
    _user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    try:
        return await build_upload_response(filename, settings)
    except InvalidUploadKeyError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid path")
    except UploadNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

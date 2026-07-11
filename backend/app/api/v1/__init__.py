"""
API v1 routes
"""
from fastapi import APIRouter
from app.api.v1 import auth, wardrobe, tryon, admin, common, file

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["认证"])
router.include_router(common.router, prefix="/common", tags=["通用"])
router.include_router(wardrobe.router, prefix="/wardrobe", tags=["衣橱"])
router.include_router(tryon.router, prefix="/tryon", tags=["试穿"])
router.include_router(file.router, prefix="/file", tags=["文件"])
router.include_router(admin.router, prefix="/admin", tags=["管理后台"])

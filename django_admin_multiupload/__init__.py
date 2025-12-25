"""
Reusable Django admin multiple file upload.
"""

from .mixins import (
    MultipleUploadAdminMixin,
    MultipleUploadInlineMixin,
)

__all__ = [
    "MultipleUploadAdminMixin",
    "MultipleUploadInlineMixin",
]

# Django < 3.2 compatibility
default_app_config = "django_admin_multiupload.apps.DjangoAdminMultiuploadConfig"

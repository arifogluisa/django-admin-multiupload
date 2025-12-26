import json

from django.core.files.base import ContentFile
from django.db.models import FileField, ImageField
from django.utils.safestring import mark_safe

try:
    from django.utils.translation import gettext_lazy as _
except ImportError:
    from django.utils.translation import ugettext_lazy as _


class MultipleUploadInlineMixin:
    """
    Mixin for Django admin inline formsets to support multiple file uploads.

    Usage:
        class MyImagesInline(MultipleUploadInlineMixin, admin.TabularInline):
            model = MyImage
            upload_field_name = "image"  # Required: name of the FileField/ImageField on your model
    """

    # Configuration attributes (upload_field_name is required)
    upload_field_name = None

    # Translatable strings
    dropzone_text = _("Drag files here or click to select")
    delete_text = _("Delete")
    error_invalid_image = _(
        "Upload a valid image. The file you uploaded was either not an image or a corrupted image."
    )

    def _validate_upload_field_name(self):
        """Validate that upload_field_name is set."""
        if self.upload_field_name is None:
            raise ValueError(
                f"'{self.__class__.__name__}' must define 'upload_field_name' attribute. "
                f"Set it to the name of the FileField/ImageField on your {self.model.__name__} model."
            )

    def _get_upload_field_name(self):
        """Get unique upload field name for this inline."""
        return f"multiple_{self.model._meta.model_name}"

    def _get_accept_types(self):
        """Auto-detect accept types based on model field type."""
        self._validate_upload_field_name()

        try:
            field = self.model._meta.get_field(self.upload_field_name)
        except Exception as e:
            raise ValueError(
                f"Error getting accept types for {self.model.__name__}.{self.upload_field_name}: {e}"
            )

        if isinstance(field, ImageField):
            return "image/*"
        elif isinstance(field, FileField):
            return "*"
        else:
            raise ValueError(
                f"Invalid field type: {field.__class__.__name__} for {self.model.__name__}.{self.upload_field_name}. "
                "Expected ImageField or FileField."
            )

    def _get_upload_config(self, prefix=None):
        """Get configuration dict for JS."""
        return {
            "prefix": prefix,
            "upload_field_name": self._get_upload_field_name(),
            "accept_types": self._get_accept_types(),
            "dropzone_text": str(self.dropzone_text),
            "delete_text": str(self.delete_text),
            "error_invalid_image": str(self.error_invalid_image),
        }

    def _get_fk_field_name(self):
        """Get the foreign key field name pointing to parent model."""
        if hasattr(self, "fk_field_name"):
            return self.fk_field_name

        parent_model = self.parent_model
        for field in self.model._meta.get_fields():
            if hasattr(field, "related_model") and field.related_model == parent_model:
                return field.name

        raise ValueError(
            f"Could not find foreign key field in {self.model.__name__} "
            f"pointing to {parent_model.__name__}. "
            f"Please set 'fk_field_name' attribute on {self.__class__.__name__}."
        )

    class Media:
        css = {"all": ("django_admin_multiupload/css/multiple_upload.css",)}
        js = ("django_admin_multiupload/js/multiple_upload.js",)


class MultipleUploadAdminMixin:
    """
    Mixin for ModelAdmin to support multiple file uploads in inlines.
    Add this mixin to your ModelAdmin class that has MultipleUploadInlineMixin inlines.

    Usage:
        @admin.register(Product)
        class ProductAdmin(MultipleUploadAdminMixin, admin.ModelAdmin):
            inlines = [ProductImageInline]  # ProductImageInline uses MultipleUploadInlineMixin
    """

    change_form_template = "admin/django_admin_multiupload/change_form.html"

    def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
        """Inject multiple upload config into the page."""
        extra_context = extra_context or {}

        upload_configs = []
        for inline_class in self.inlines:
            if issubclass(inline_class, MultipleUploadInlineMixin):
                inline = inline_class(self.model, self.admin_site)
                formset = inline.get_formset(request, obj=None)
                prefix = formset.get_default_prefix()
                config = inline._get_upload_config(prefix=prefix)
                upload_configs.append(config)

        if upload_configs:
            extra_context["multiple_upload_configs"] = mark_safe(
                json.dumps(upload_configs)
            )

        return super().changeform_view(request, object_id, form_url, extra_context)

    def save_formset(self, request, form, formset, change):
        """Handle multiple file uploads for inlines."""
        super().save_formset(request, form, formset, change)

        inline_class = None
        for ic in self.inlines:
            if issubclass(ic, MultipleUploadInlineMixin) and ic.model == formset.model:
                inline_class = ic
                break

        if not inline_class:
            return

        inline = inline_class(self.model, self.admin_site)
        upload_field_name = inline._get_upload_field_name()
        multiple_files = request.FILES.getlist(upload_field_name)

        if not multiple_files:
            return

        parent_instance = form.instance
        fk_field_name = inline._get_fk_field_name()

        for file_obj in multiple_files:
            file_obj.seek(0)
            file_content = file_obj.read()

            instance_kwargs = {fk_field_name: parent_instance}
            instance = formset.model(**instance_kwargs)

            file_field = getattr(instance, inline.upload_field_name)
            file_field.save(file_obj.name, ContentFile(file_content), save=False)

            instance.save()

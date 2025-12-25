[![](https://img.shields.io/pypi/v/django-admin-multiupload.svg?color=blue&logo=pypi&logoColor=white)](https://pypi.org/project/django-admin-multiupload/)
[![PyPI Downloads](https://static.pepy.tech/personalized-badge/django-admin-multiupload?period=total&units=INTERNATIONAL_SYSTEM&left_color=BLACK&right_color=GREEN&left_text=downloads)](https://pepy.tech/projects/django-admin-multiupload)
[![](https://img.shields.io/github/stars/arifogluisa/django-admin-multiupload?logo=github)](https://github.com/arifogluisa/django-admin-multiupload/stargazers)
[![](https://img.shields.io/pypi/l/django-admin-multiupload.svg?color=blue)](https://github.com/arifogluisa/django-admin-multiupload/blob/master/LICENSE)

# django-admin-multiupload

Reusable multiple file upload for Django admin in new UI style. Compatible with Django's default admin, Jazzmin, and Grappelli admin interfaces. Install the package and use the mixins in your admin classes — the templates, CSS, and JS are bundled so you do not have to wire up static files manually.

## Examples

### Default Django Admin

![Django Default Admin](https://raw.githubusercontent.com/arifogluisa/django-admin-multiupload/refs/heads/master/docs/images/django-default.gif)

### Jazzmin Theme

![Jazzmin Theme](https://raw.githubusercontent.com/arifogluisa/django-admin-multiupload/refs/heads/master/docs/images/jazzmin.gif)

### Grappelli Theme

![Grappelli Theme](https://raw.githubusercontent.com/arifogluisa/django-admin-multiupload/refs/heads/master/docs/images/grappelli.gif)

## Installation

```bash
# with uv
uv add django-admin-multiupload

# or pip
pip install django-admin-multiupload
```

Add the app to `INSTALLED_APPS` so Django can discover the bundled templates and static assets:

```python
INSTALLED_APPS = [
    # ...
    "django_admin_multiupload",
]
```

## Usage

### models.py
```python
from django.db import models


class Product(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return self.name


class ProductImage(models.Model):
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="images"
    )
    image = models.ImageField(upload_to="product_images")

    def __str__(self):
        return self.product.name


class ProductFile(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="files")
    file = models.FileField(upload_to="product_files")

    def __str__(self):
        return self.product.name
```

### admin.py
```python
from django.contrib import admin

from django_admin_multiupload import MultipleUploadAdminMixin, MultipleUploadInlineMixin
from .models import Product, ProductFile, ProductImage


class ProductImageInline(MultipleUploadInlineMixin, admin.TabularInline):
    model = ProductImage
    extra = 1
    upload_field_name = "image"


class ProductFileInline(MultipleUploadInlineMixin, admin.TabularInline):
    model = ProductFile
    extra = 1
    upload_field_name = "file"


@admin.register(Product)
class ProductAdmin(MultipleUploadAdminMixin, admin.ModelAdmin):
    list_display = ("name", "price")
    search_fields = ("name", "description")
    inlines = [ProductImageInline, ProductFileInline]
```

That is it. The admin change form will render the drag-and-drop upload area and load the package's CSS/JS automatically.

## How It Works

1. Add `MultipleUploadInlineMixin` to your inline class and specify `upload_field_name`
2. Add `MultipleUploadAdminMixin` to your ModelAdmin class that uses the inline
3. The mixin automatically detects if the field is an ImageField or FileField
4. Files are uploaded and saved automatically when you save the parent object

## License

MIT License - see LICENSE file for details.

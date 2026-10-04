from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from .docs_view import swagger_docs_view, openapi_schema_view

urlpatterns = [
    path('admin/', admin.site.urls),

    # API Documentation (Interactive Swagger UI & OpenAPI Schema)
    path('api/docs', swagger_docs_view, name='swagger-docs'),
    path('api/docs/', swagger_docs_view, name='swagger-docs-slash'),
    path('api/schema/', openapi_schema_view, name='openapi-schema'),

    # Application endpoints
    path('api/', include('accounts.urls')),
    path('api/', include('catalog.urls')),
    path('api/stock/', include('stock.urls')),
    path('api/', include('shopping.urls')),
    path('api/', include('orders.urls')),
    path('api/', include('marketing.urls')),
    path('api/', include('notifications.urls')),
    path('api/', include('payments.urls')),
]

from django.urls import re_path
from django.views.static import serve

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
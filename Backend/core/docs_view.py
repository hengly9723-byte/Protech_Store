from django.http import HttpResponse
from rest_framework.schemas import get_schema_view
from rest_framework.permissions import AllowAny

openapi_schema_view = get_schema_view(
    title="Protech E-Commerce Platform API",
    description="Full-featured enterprise E-commerce backend REST API with Auth/RBAC, Product Catalog, Inventory, Cart, Orders, Checkout, Reviews, Marketing & Notifications.",
    version="1.0.0",
    permission_classes=[AllowAny],
)

SWAGGER_UI_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Protech API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; background: #0f172a; color: #f8fafc; font-family: sans-serif; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui { filter: invert(88%) hue-rotate(180deg); }
    .swagger-ui img { filter: invert(100%) hue-rotate(180deg); }
    .header-banner {
      background: linear-gradient(135deg, #1e293b, #0f172a);
      border-bottom: 1px solid #334155;
      padding: 20px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-banner h1 { margin: 0; font-size: 24px; color: #38bdf8; font-weight: 700; }
    .header-banner p { margin: 4px 0 0 0; color: #94a3b8; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header-banner">
    <div>
      <h1>⚡ Protech E-Commerce API Documentation</h1>
      <p>Interactive REST API documentation & sandbox</p>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/api/schema/",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>
"""


def swagger_docs_view(request):
    return HttpResponse(SWAGGER_UI_HTML, content_type="text/html")

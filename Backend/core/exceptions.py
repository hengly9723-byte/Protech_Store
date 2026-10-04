from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    """
    Standardized global exception handler formatting all API error responses consistently:
    {
        "status": "error",
        "message": "...",
        "errors": { ... } or null,
        "status_code": 400
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        error_payload = {
            "status": "error",
            "status_code": response.status_code,
        }

        if isinstance(response.data, dict):
            if "detail" in response.data:
                error_payload["message"] = str(response.data["detail"])
                error_payload["errors"] = {k: v for k, v in response.data.items() if k != "detail"} or None
            elif "error" in response.data:
                error_payload["message"] = str(response.data["error"])
                error_payload["errors"] = {k: v for k, v in response.data.items() if k != "error"} or None
            else:
                error_payload["message"] = "Validation or processing error."
                error_payload["errors"] = response.data
        elif isinstance(response.data, list):
            error_payload["message"] = "Validation error."
            error_payload["errors"] = response.data
        else:
            error_payload["message"] = str(response.data)
            error_payload["errors"] = None

        response.data = error_payload

    return response

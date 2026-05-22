from flask import jsonify


def success_response(message="Request successful", data=None, status_code=200, **payload):
    body = {
        "success": True,
        "message": message,
        "data": data,
    }
    body.update(payload)
    return jsonify(body), status_code


def error_response(message, status_code=400, **payload):
    with open("error.txt", "w") as f:
        f.write(str(message))
    body = {
        "success": False,
        "message": message,
    }
    body.update(payload)
    return jsonify(body), status_code

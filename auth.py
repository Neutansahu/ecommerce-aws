
import os
from functools import wraps

import jwt
from flask import request, jsonify, g
from database import get_db_connection


def require_auth(admin_only=False):

    def decorator(func):

        @wraps(func)
        def wrapper(*args, **kwargs):

            authorization = request.headers.get("Authorization", "")

            if not authorization.startswith("Bearer "):
                return jsonify({"error": "Unauthorized"}), 401

            token = authorization[len("Bearer "):].strip()

            try:
                jwt_secret = os.environ["JWT_SECRET"]

                payload = jwt.decode(
                    token,
                    jwt_secret,
                    algorithms=["HS256"]
                )

                user_id = payload.get("id")

                if user_id is None:
                    return jsonify({"error": "Unauthorized"}), 401

            except (jwt.InvalidTokenError, KeyError):
                return jsonify({"error": "Unauthorized"}), 401

            connection = None
            cursor = None

            try:
                connection = get_db_connection()
                cursor = connection.cursor(dictionary=True)

                cursor.execute(
                    "SELECT id, role FROM users WHERE id = %s",
                    (user_id,)
                )

                user = cursor.fetchone()

                if not user:
                    return jsonify({"error": "Unauthorized"}), 401

                if admin_only and user["role"] != "admin":
                    return jsonify({"error": "Forbidden"}), 403

                g.user = user

            except Exception:
                return jsonify({
                    "error": "Authentication service unavailable"
                }), 503

            finally:
                if cursor:
                    cursor.close()

                if connection and connection.is_connected():
                    connection.close()

            return func(*args, **kwargs)

        return wrapper

    return decorator

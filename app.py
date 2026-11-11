
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, g
from auth import require_auth
from database import get_db_connection

app = Flask(__name__)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "Flask service running"
    })


@app.route("/api/profile", methods=["GET"])
@require_auth()
def profile():
    return jsonify({
        "message": "Authenticated successfully",
        "user": g.user
    })


@app.route("/api/admin/analytics", methods=["GET"])
@require_auth(admin_only=True)
def analytics():

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                COUNT(*) AS total_orders,
                COALESCE(SUM(
                    CASE
                        WHEN payment_status = 'PAID'
                        THEN total
                        ELSE 0
                    END
                ), 0) AS total_revenue
            FROM orders
        """)

        order_stats = cursor.fetchone()

        cursor.execute("""
            SELECT COUNT(*) AS total_products
            FROM products
            WHERE active = 1
        """)

        product_stats = cursor.fetchone()

        cursor.execute("""
            SELECT COUNT(*) AS total_customers
            FROM users
            WHERE role = 'customer'
        """)

        customer_stats = cursor.fetchone()

        return jsonify({
            "message": "Analytics retrieved successfully",
            "analytics": {
                "total_orders": order_stats["total_orders"],
                "total_revenue": float(order_stats["total_revenue"]),
                "total_products": product_stats["total_products"],
                "total_customers": customer_stats["total_customers"]
            }
        })

    except Exception:
        app.logger.exception("Analytics query failed")
        return jsonify({
            "error": "Unable to retrieve analytics"
        }), 503

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False
    )

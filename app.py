
import os
from flask import Flask, jsonify
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = None

if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


@app.route("/")
def home():
    return jsonify({
        "message": "CampusFind Python Backend is running!"
    })


@app.route("/api/status")
def status():
    if supabase is None:
        return jsonify({
            "connected": False,
            "message": "Supabase credentials are not configured"
        }), 503

    try:
        supabase.table("posts").select("*").limit(1).execute()

        return jsonify({
            "connected": True,
            "message": "Supabase connection successful"
        })

    except Exception as e:
        return jsonify({
            "connected": False,
            "error_type": type(e).__name__,
            "error_details": str(e)
        }), 500


if __name__ == "__main__":
    app.run(debug=True)

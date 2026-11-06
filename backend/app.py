import json
import math
import os
import time
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from flask import Flask, jsonify, request, send_from_directory

from spatial_analysis import (
    get_objects,
    calculate_visibility
)
from obstacle_controls import update_obstacle

BASE = Path(__file__).resolve().parents[1]
FRONTEND = BASE / "frontend"


from cctv_analysis import camera_coverage
from vector_search import search_cases

app = Flask(__name__)


def db():
    return psycopg.connect(
        dbname=os.getenv("PGDATABASE", "crime_scene"),
        user=os.getenv("PGUSER", "postgres"),
        host=os.getenv("PGHOST", "/tmp"),
        port=os.getenv("PGPORT", "5432"),
        row_factory=dict_row
    )


@app.get("/")
def home():
    return send_from_directory(FRONTEND, "index.html")


@app.get("/vendor/<path:filename>")
def vendor_files(filename):
    return send_from_directory(
        FRONTEND / "vendor", filename
    )


@app.get("/js/<path:filename>")
def javascript_files(filename):
    return send_from_directory(
        FRONTEND / "js", filename
    )


@app.get("/api/health")
def health():
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT current_database() AS database,
                       PostGIS_Version() AS postgis
            """)
            result = cur.fetchone()

    return jsonify({"status": "ok", **result})


@app.get("/api/scene")
def get_scene():
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, height_m,
                       ST_AsGeoJSON(footprint) AS geometry
                FROM buildings ORDER BY id
            """)
            buildings = cur.fetchall()

            cur.execute("""
                SELECT id, building_id, floor_no,
                       ST_X(position) AS x,
                       ST_Y(position) AS y,
                       ST_Z(position) AS z
                FROM windows ORDER BY id
            """)
            windows = cur.fetchall()

            cur.execute("""
                SELECT id, description,
                       ST_X(location) AS x,
                       ST_Y(location) AS y,
                       ST_Z(location) AS z
                FROM incidents ORDER BY id
            """)
            incidents = cur.fetchall()

    for building in buildings:
        building["geometry"] = json.loads(
            building["geometry"]
        )

    return jsonify({
        "buildings": buildings,
        "windows": windows,
        "incidents": incidents
    })


NEAREST_SQL = """
SELECT w.id, b.name AS building, w.floor_no,
       ST_X(w.position) AS x,
       ST_Y(w.position) AS y,
       ST_Z(w.position) AS z,
       ROUND(
           ST_3DDistance(w.position,i.location)::numeric,2
       ) AS distance_m
FROM windows w
JOIN buildings b ON w.building_id=b.id
JOIN incidents i ON i.id=%s
ORDER BY ST_3DDistance(w.position,i.location),w.id
LIMIT %s
"""


@app.get("/api/windows/nearest")
def nearest():
    k = request.args.get("k", 5, type=int)

    if k is None or not 1 <= k <= 25:
        return jsonify({"error": "k must be 1-25"}), 400

    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(NEAREST_SQL, (1, k))
            rows = cur.fetchall()

    for row in rows:
        row["distance_m"] = float(row["distance_m"])

    return jsonify({
        "results": rows,
        "sql": NEAREST_SQL.strip(),
        "parameters": [1, k]
    })


@app.get("/api/objects")
def objects_api():
    return jsonify({"objects": get_objects()})


@app.get("/api/windows/visibility")
def visibility_api():
    try:
        x = float(request.args.get("x", 0))
        y = float(request.args.get("y", 0))
        z = float(request.args.get("z", 1.5))
        k = int(request.args.get("k", 5))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid parameters"}), 400

    if (
        not all(math.isfinite(v) for v in (x, y, z))
        or not (-55 <= x <= 55)
        or not (-55 <= y <= 55)
        or not (0 <= z <= 20)
        or not (1 <= k <= 25)
    ):
        return jsonify({"error": "Out of range"}), 400

    return jsonify(calculate_visibility(x, y, z, k))


@app.patch("/api/objects/<int:object_id>/enabled")
def set_object_enabled(object_id):
    payload = request.get_json(silent=True)

    if not isinstance(payload, dict):
        return jsonify({"error": "Invalid JSON"}), 400

    enabled = payload.get("enabled")

    if type(enabled) is not bool:
        return jsonify({
            "error": "enabled must be boolean"
        }), 400

    updated = update_obstacle(object_id, enabled)

    if updated is None:
        return jsonify({
            "error": "Object not found or not toggleable"
        }), 404

    return jsonify(updated)



@app.get("/api/cctv/coverage")
def cctv_coverage_api():
    try:
        x = float(request.args.get("x", 0))
        y = float(request.args.get("y", 0))
        z = float(request.args.get("z", 1.5))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid coordinates"}), 400

    if not all(math.isfinite(v) for v in (x,y,z)):
        return jsonify({"error": "Invalid coordinates"}), 400

    if not (-55 <= x <= 55 and -55 <= y <= 55
            and 0 <= z <= 20):
        return jsonify({"error": "Out of range"}), 400

    return jsonify(camera_coverage(x,y,z))


@app.get("/api/investigations/search")
def investigation_search_api():
    query = request.args.get("q", "").strip()

    if not query or len(query) > 300:
        return jsonify({"error": "Invalid search text"}), 400

    return jsonify(search_cases(query))


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False
    )

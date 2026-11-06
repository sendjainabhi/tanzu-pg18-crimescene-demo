import json
import os
import time

import psycopg
from psycopg.rows import dict_row
from visibility_engine import analyze_visibility

WINDOW_SQL = """
SELECT
    w.id, w.building_id,
    b.name AS building, w.floor_no,
    ST_X(w.position) AS x,
    ST_Y(w.position) AS y,
    ST_Z(w.position) AS z,
    ST_3DDistance(
        w.position,
        ST_SetSRID(ST_MakePoint(%s,%s,%s),0)
    ) AS distance_m
FROM windows w
JOIN buildings b ON b.id = w.building_id
WHERE ST_3DDWithin(
    w.position,
    ST_SetSRID(ST_MakePoint(%s,%s,%s),0),
    100
)
ORDER BY distance_m, w.id
"""


def connect():
    return psycopg.connect(
        dbname=os.getenv("PGDATABASE", "crime_scene"),
        user=os.getenv("PGUSER", "postgres"),
        host=os.getenv("PGHOST", "/tmp"),
        port=os.getenv("PGPORT", "5432"),
        row_factory=dict_row
    )


def get_objects():
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, object_type,
                    ST_X(position) AS x,
                    ST_Y(position) AS y,
                    ST_Z(position) AS z,
                    dimensions, rotation_deg,
                    blocks_visibility, enabled
                FROM scene_objects
                ORDER BY id
            """)
            return cur.fetchall()


def calculate_visibility(x, y, z, k):
    started = time.perf_counter()
    params = (x, y, z, x, y, z)

    database_started = time.perf_counter()

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(WINDOW_SQL, params)
            windows = cur.fetchall()

            cur.execute("""
                SELECT id, name, height_m,
                    ST_AsGeoJSON(footprint) AS geometry
                FROM buildings
            """)
            buildings = cur.fetchall()

            cur.execute("""
                SELECT id, name, object_type,
                    ST_X(position) AS x,
                    ST_Y(position) AS y,
                    ST_Z(position) AS z,
                    dimensions, enabled,
                    blocks_visibility
                FROM scene_objects
                WHERE enabled = TRUE
            """)
            objects = cur.fetchall()

    database_ms = (
        time.perf_counter() - database_started
    ) * 1000

    for building in buildings:
        building["geometry"] = json.loads(
            building["geometry"]
        )

    visibility_started = time.perf_counter()

    analyzed = analyze_visibility(
        [x, y, z], windows, buildings, objects
    )

    python_ms = (
        time.perf_counter() - visibility_started
    ) * 1000

    visible = [w for w in analyzed if w["visible"]]
    blocked = [w for w in analyzed if not w["visible"]]

    total_ms = (
        time.perf_counter() - started
    ) * 1000

    return {
        "incident": {"x": x, "y": y, "z": z},
        "requested_k": k,
        "candidate_count": len(analyzed),
        "visible_count": len(visible),
        "blocked_count": len(blocked),
        "visible_windows": visible[:k],
        "blocked_windows": blocked,
        "sql": WINDOW_SQL.strip(),
        "parameters": list(params),
        "database_ms": round(database_ms, 2),
        "python_visibility_ms": round(python_ms, 2),
        "total_elapsed_ms": round(total_ms, 2),
        "objects_examined": len(objects),
        "buildings_examined": len(buildings)
    }

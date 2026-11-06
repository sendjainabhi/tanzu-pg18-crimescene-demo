import json
import math

from spatial_analysis import connect
from visibility_engine import building_blocks, object_blocks


CAMERA_SQL = """
SELECT id, name,
       ST_X(position) AS x,
       ST_Y(position) AS y,
       ST_Z(position) AS z,
       dimensions,
       ST_3DDistance(
           position,
           ST_SetSRID(ST_MakePoint(%s,%s,%s),0)
       ) AS distance_m
FROM scene_objects
WHERE object_type = 'camera'
  AND enabled = TRUE
  AND ST_3DDWithin(
      position,
      ST_SetSRID(ST_MakePoint(%s,%s,%s),0),
      100
  )
ORDER BY distance_m, id
"""


def camera_coverage(x, y, z):
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                CAMERA_SQL,
                (x, y, z, x, y, z)
            )
            cameras = cur.fetchall()

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
                WHERE enabled AND blocks_visibility
            """)
            obstacles = cur.fetchall()

    for building in buildings:
        building["geometry"] = json.loads(
            building["geometry"]
        )

    results = []

    for camera in cameras:
        dimensions = camera["dimensions"]

        heading = float(dimensions.get("heading_deg", 0))
        fov = float(dimensions.get("fov_deg", 90))
        max_range = float(dimensions.get("range_m", 50))
        distance = float(camera["distance_m"])

        dx = x - camera["x"]
        dy = y - camera["y"]

        bearing = (
            math.degrees(math.atan2(dy, dx)) + 360
        ) % 360

        angle_difference = abs(
            (bearing - heading + 180) % 360 - 180
        )

        in_range = distance <= max_range
        in_fov = angle_difference <= fov / 2

        start = [
            camera["x"],
            camera["y"],
            camera["z"]
        ]
        end = [x, y, z]

        blockers = []

        if in_range and in_fov:
            for building in buildings:
                points = building["geometry"]["coordinates"][0]
                xs = [p[0] for p in points]
                ys = [p[1] for p in points]

                # Approximation: ignore the camera's host
                # building when the camera is on its boundary.
                on_host = (
                    min(xs)-0.01 <= start[0] <= max(xs)+0.01
                    and
                    min(ys)-0.01 <= start[1] <= max(ys)+0.01
                )

                if on_host:
                    continue

                if building_blocks(
                    start, end, building, -1
                ):
                    blockers.append(building["name"])

            for obj in obstacles:
                if object_blocks(start, end, obj):
                    blockers.append(obj["name"])

        covered = in_range and in_fov and not blockers

        results.append({
            "id": camera["id"],
            "name": camera["name"],
            "x": camera["x"],
            "y": camera["y"],
            "z": camera["z"],
            "distance_m": round(distance, 2),
            "heading_deg": heading,
            "range_m": max_range,
            "fov_deg": fov,
            "angle_difference_deg": round(
                angle_difference, 2
            ),
            "in_range": in_range,
            "in_fov": in_fov,
            "blockers": blockers,
            "covered": covered
        })

    return {
        "incident": {"x": x, "y": y, "z": z},
        "cameras": results,
        "covering_count": sum(
            1 for camera in results if camera["covered"]
        ),
        "sql": CAMERA_SQL.strip()
    }

import json
import os
import psycopg

objects = []

def add(name, kind, x, y, z, dims,
        blocks=False, rotation=0):
    objects.append((
        name, kind, x, y, z,
        json.dumps(dims), blocks, rotation
    ))

tree_positions = [
    (-8,-35),(8,-35),(-8,35),(8,35),
    (-35,-8),(-35,8),(35,-8),(35,8),
    (-9,-12),(9,-12),(-9,12),(9,12)
]

for n,(x,y) in enumerate(tree_positions,1):
    add(f"Tree {n}", "tree", x,y,0,
        {"trunk_radius":0.35,
         "trunk_height":3.0,
         "canopy_radius":2.4,
         "canopy_center_z":5.5}, True)

vehicle_positions = [
    (-5,-22),(5,-22),(-5,22),
    (5,22),(-22,-5),(22,5)
]

for n,(x,y) in enumerate(vehicle_positions,1):
    add(f"Vehicle {n}", "vehicle", x,y,0,
        {"width":2.2,"length":4.6,"height":1.8},
        True)

light_positions = [
    (-9,-28),(9,-28),(-9,28),(9,28),
    (-28,-9),(-28,9),(28,-9),(28,9)
]

for n,(x,y) in enumerate(light_positions,1):
    add(f"Streetlight {n}", "streetlight", x,y,0,
        {"height":7.0,"radius":0.15})

camera_positions = [
    (-15,-15,8),(15,-15,8),
    (-15,15,8),(15,15,8)
]

for n,(x,y,z) in enumerate(camera_positions,1):
    add(f"CCTV {n}", "camera", x,y,z,
        {"width":0.7,"height":0.4,"depth":0.7},
        rotation=n*90)

bench_positions = [
    (-10,-30),(10,-30),(-10,30),(10,30)
]

for n,(x,y) in enumerate(bench_positions,1):
    add(f"Bench {n}", "bench", x,y,0,
        {"width":2,"height":0.9,"depth":0.8})

wall_positions = [
    (-12,-4),(12,4),(4,12)
]

for n,(x,y) in enumerate(wall_positions,1):
    add(f"Wall {n}", "wall", x,y,0,
        {"width":5,"height":2.5,"depth":0.35},
        True)

evidence_positions = [
    (0,0),(2,3),(-3,2),(4,-3),(-2,-4)
]

for n,(x,y) in enumerate(evidence_positions,1):
    add(f"Evidence {n}", "evidence", x,y,0,
        {"radius":0.25,"height":0.4})

sql = """
INSERT INTO scene_objects (
    name, object_type, position,
    dimensions, blocks_visibility, rotation_deg
)
VALUES (
    %s, %s,
    ST_SetSRID(ST_MakePoint(%s,%s,%s),0),
    %s::jsonb, %s, %s
)
ON CONFLICT (name)
DO UPDATE SET
    object_type=EXCLUDED.object_type,
    position=EXCLUDED.position,
    dimensions=EXCLUDED.dimensions,
    blocks_visibility=EXCLUDED.blocks_visibility,
    rotation_deg=EXCLUDED.rotation_deg
"""

with psycopg.connect(
    dbname=os.getenv("PGDATABASE","crime_scene"),
    user=os.getenv("PGUSER","postgres"),
    host=os.getenv("PGHOST","/tmp")
) as conn:
    with conn.cursor() as cur:
        cur.executemany(sql, objects)

print(f"Loaded {len(objects)} scene objects")

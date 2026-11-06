import os
import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from incident_embeddings import encode, vector_literal

categories = [
    ("Witness Visibility",
     "Witness at window reports street incident with obstruction"),
    ("Vehicle Investigation",
     "Vehicle parked near intersection obstructs witness view"),
    ("CCTV Investigation",
     "CCTV camera surveillance of incident near building"),
    ("Evidence Investigation",
     "Evidence discovered near vehicle and street"),
    ("Tree Obstruction",
     "Tree canopy creates obstruction between witness window and incident"),
    ("Camera Obstruction",
     "CCTV camera view blocked by building obstruction"),
]

sql = """
INSERT INTO investigation_cases (
    case_code, description, category,
    location, embedding
)
VALUES (
    %s, %s, %s,
    ST_SetSRID(ST_MakePoint(%s,%s,1.5),0),
    %s::vector
)
ON CONFLICT (case_code)
DO UPDATE SET
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    location = EXCLUDED.location,
    embedding = EXCLUDED.embedding
"""

with psycopg.connect(
    dbname=os.getenv("PGDATABASE", "crime_scene"),
    user=os.getenv("PGUSER", "postgres"),
    host=os.getenv("PGHOST", "/tmp")
) as conn:
    with conn.cursor() as cur:
        for i in range(60):
            category, description = categories[i % len(categories)]

            x = ((i * 7) % 41) - 20
            y = ((i * 11) % 41) - 20

            description = (
                f"{description}. Synthetic investigation "
                f"number {i + 1}."
            )

            cur.execute(sql, (
                f"CASE-{i+1:03d}",
                description,
                category,
                x, y,
                vector_literal(encode(description))
            ))

print("Loaded 60 synthetic investigation cases")

from spatial_analysis import connect
from incident_embeddings import encode, vector_literal


HYBRID_SQL = """
SELECT
    case_code,
    description,
    category,
    ST_X(location) AS x,
    ST_Y(location) AS y,
    ST_Z(location) AS z,
    ROUND(
        ST_3DDistance(
            location,
            ST_SetSRID(
                ST_MakePoint(%s,%s,%s),0
            )
        )::numeric, 2
    ) AS distance_m,
    1 - (embedding <=> %s::vector)
        AS similarity
FROM investigation_cases
WHERE ST_3DDWithin(
    location,
    ST_SetSRID(
        ST_MakePoint(%s,%s,%s),0
    ),
    %s
)
ORDER BY embedding <=> %s::vector, case_code
LIMIT %s
"""


def hybrid_search(query, x, y, z, radius, limit):
    embedding = vector_literal(encode(query))

    params = (
        x, y, z,
        embedding,
        x, y, z,
        radius,
        embedding,
        limit
    )

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(HYBRID_SQL, params)
            rows = cur.fetchall()

    for row in rows:
        row["similarity"] = float(row["similarity"])
        row["distance_m"] = float(row["distance_m"])

    return {
        "query": query,
        "incident": {"x": x, "y": y, "z": z},
        "radius_m": radius,
        "results": rows,
        "result_count": len(rows),
        "sql": HYBRID_SQL.strip(),
        "parameters": [
            x, y, z, "[384-dimensional vector]",
            x, y, z, radius,
            "[384-dimensional vector]", limit
        ]
    }

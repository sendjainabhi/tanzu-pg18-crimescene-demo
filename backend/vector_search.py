from spatial_analysis import connect
from incident_embeddings import encode, vector_literal


def search_cases(query, limit=5):
    embedding = vector_literal(encode(query))

    sql = """
    SELECT case_code, description, category,
           ST_X(location) AS x,
           ST_Y(location) AS y,
           1 - (embedding <=> %s::vector)
               AS similarity
    FROM investigation_cases
    ORDER BY embedding <=> %s::vector
    LIMIT %s
    """

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (embedding, embedding, limit))
            rows = cur.fetchall()

    return {
        "query": query,
        "results": rows,
        "sql": sql.strip()
    }

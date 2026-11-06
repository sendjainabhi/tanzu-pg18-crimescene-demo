from spatial_analysis import connect


def update_obstacle(object_id, enabled):
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE scene_objects
                SET enabled = %s
                WHERE id = %s
                  AND object_type IN ('tree', 'vehicle', 'wall')
                RETURNING id, name, object_type, enabled
            """, (enabled, object_id))
            return cur.fetchone()

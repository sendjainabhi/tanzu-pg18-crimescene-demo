CREATE TABLE IF NOT EXISTS scene_objects (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    object_type TEXT NOT NULL CHECK (
        object_type IN (
            'tree', 'vehicle', 'streetlight',
            'camera', 'bench', 'wall', 'evidence'
        )
    ),
    position geometry(PointZ, 0) NOT NULL,
    rotation_deg DOUBLE PRECISION DEFAULT 0,
    dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
    blocks_visibility BOOLEAN DEFAULT FALSE,
    enabled BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS scene_objects_position_gix
ON scene_objects USING GIST(position);

CREATE INDEX IF NOT EXISTS windows_position_gix
ON windows USING GIST(position);

CREATE INDEX IF NOT EXISTS buildings_footprint_gix
ON buildings USING GIST(footprint);

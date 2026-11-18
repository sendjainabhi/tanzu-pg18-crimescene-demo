CREATE TABLE IF NOT EXISTS investigation_cases (
    id BIGSERIAL PRIMARY KEY,
    case_code TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    location geometry(PointZ, 0) NOT NULL,
    embedding vector(384) NOT NULL
);

CREATE INDEX IF NOT EXISTS investigation_cases_location_gix
ON investigation_cases USING GIST(location);

CREATE INDEX IF NOT EXISTS investigation_cases_embedding_hnsw
ON investigation_cases
USING hnsw (embedding vector_cosine_ops);

-- Add camera analysis properties to existing objects.
UPDATE scene_objects
SET dimensions = dimensions || jsonb_build_object(
    'range_m', 70,
    'fov_deg', 100,
    'heading_deg',
    mod(
      (
        degrees(atan2(
          -ST_Y(position),
          -ST_X(position)
        )) + 360
      )::numeric,
      360::numeric
    )
)
WHERE object_type = 'camera';

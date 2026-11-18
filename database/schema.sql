-- ============================================================
-- Tanzu PostgreSQL 3D Crime Scene Intelligence
-- Unified Database Schema
--
-- VMware PostgreSQL 18.6
-- PostGIS 3.6.1
-- pgvector 0.8.6
--
-- Supports fresh and existing demo databases.
-- Uses local Cartesian coordinates (SRID 0).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Extensions
-- ------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;


-- ------------------------------------------------------------
-- 2. Buildings
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS buildings (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    footprint geometry(Polygon, 0) NOT NULL,
    height_m DOUBLE PRECISION NOT NULL
);


-- ------------------------------------------------------------
-- 3. Windows
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS windows (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id),
    floor_no INTEGER NOT NULL,
    facade TEXT,
    position geometry(PointZ, 0) NOT NULL
);

-- Upgrade existing window table without deleting records.

ALTER TABLE windows
ADD COLUMN IF NOT EXISTS facade TEXT;


-- ------------------------------------------------------------
-- 4. Incidents
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    location geometry(PointZ, 0) NOT NULL,
    embedding vector(384)
);


-- ------------------------------------------------------------
-- 5. Scene Objects
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scene_objects (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    object_type TEXT NOT NULL CHECK (
        object_type IN (
            'tree',
            'vehicle',
            'streetlight',
            'camera',
            'bench',
            'wall',
            'evidence'
        )
    ),
    position geometry(PointZ, 0) NOT NULL,
    rotation_deg DOUBLE PRECISION DEFAULT 0,
    dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
    blocks_visibility BOOLEAN DEFAULT FALSE,
    enabled BOOLEAN DEFAULT TRUE
);


-- ------------------------------------------------------------
-- 6. Investigation Cases
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS investigation_cases (
    id BIGSERIAL PRIMARY KEY,
    case_code TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    location geometry(PointZ, 0) NOT NULL,
    embedding vector(384) NOT NULL
);


-- ------------------------------------------------------------
-- 7. Seed Buildings
-- ------------------------------------------------------------

WITH building_seed(name, footprint_wkt, height_m) AS (
    VALUES
    (
        'Building A',
        'POLYGON((-30 -30,-15 -30,-15 -15,-30 -15,-30 -30))',
        24.0
    ),
    (
        'Building B',
        'POLYGON((15 -30,30 -30,30 -15,15 -15,15 -30))',
        30.0
    ),
    (
        'Building C',
        'POLYGON((-30 15,-15 15,-15 30,-30 30,-30 15))',
        20.0
    ),
    (
        'Building D',
        'POLYGON((15 15,30 15,30 30,15 30,15 15))',
        28.0
    )
)
INSERT INTO buildings (
    name,
    footprint,
    height_m
)
SELECT
    s.name,
    ST_GeomFromText(s.footprint_wkt, 0),
    s.height_m
FROM building_seed s
WHERE NOT EXISTS (
    SELECT 1
    FROM buildings b
    WHERE b.name = s.name
);


-- ------------------------------------------------------------
-- 8. Seed Incident
-- ------------------------------------------------------------

INSERT INTO incidents (
    description,
    location
)
SELECT
    'Incident at the city intersection',
    ST_SetSRID(ST_MakePoint(0, 0, 1.5), 0)
WHERE NOT EXISTS (
    SELECT 1
    FROM incidents
    WHERE description = 'Incident at the city intersection'
);


-- ------------------------------------------------------------
-- 9. Assign Facades to Existing Windows
-- ------------------------------------------------------------

-- Existing windows were created on street-facing Y walls.
-- Negative-Y buildings face north.
-- Positive-Y buildings face south.

UPDATE windows w
SET facade =
    CASE
        WHEN ST_Y(ST_Centroid(b.footprint)) < 0
            THEN 'north'
        ELSE 'south'
    END
FROM buildings b
WHERE w.building_id = b.id
  AND w.facade IS NULL;


-- ------------------------------------------------------------
-- 10. Generate Four-Facade Windows
-- ------------------------------------------------------------

-- One window per facade per floor.
-- Floor height = 4 meters.
--
-- 25 floors across four buildings x 4 facades
-- = 100 windows.

WITH facade_positions AS (
    SELECT
        b.id AS building_id,
        f.floor_no,
        d.facade,

        ST_SetSRID(
            ST_MakePoint(
                CASE d.facade
                    WHEN 'east'
                        THEN ST_XMax(b.footprint)
                    WHEN 'west'
                        THEN ST_XMin(b.footprint)
                    ELSE ST_X(
                        ST_Centroid(b.footprint)
                    )
                END,

                CASE d.facade
                    WHEN 'north'
                        THEN ST_YMax(b.footprint)
                    WHEN 'south'
                        THEN ST_YMin(b.footprint)
                    ELSE ST_Y(
                        ST_Centroid(b.footprint)
                    )
                END,

                f.floor_no * 4.0
            ),
            0
        ) AS position

    FROM buildings b

    CROSS JOIN LATERAL
        generate_series(
            1,
            floor(b.height_m / 4.0)::integer
        ) AS f(floor_no)

    CROSS JOIN (
        VALUES
            ('north'),
            ('south'),
            ('east'),
            ('west')
    ) AS d(facade)

    WHERE b.name IN (
        'Building A',
        'Building B',
        'Building C',
        'Building D'
    )
)

INSERT INTO windows (
    building_id,
    floor_no,
    facade,
    position
)
SELECT
    fp.building_id,
    fp.floor_no,
    fp.facade,
    fp.position
FROM facade_positions fp

WHERE NOT EXISTS (
    SELECT 1
    FROM windows w
    WHERE w.building_id = fp.building_id
      AND w.floor_no = fp.floor_no
      AND w.facade = fp.facade
);


-- ------------------------------------------------------------
-- 11. Window Constraints
-- ------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'windows_facade_check'
          AND conrelid = 'windows'::regclass
    ) THEN
        ALTER TABLE windows
        ADD CONSTRAINT windows_facade_check
        CHECK (
            facade IN (
                'north',
                'south',
                'east',
                'west'
            )
        );
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
    windows_facade_unique
ON windows (
    building_id,
    floor_no,
    facade
);


-- ------------------------------------------------------------
-- 12. Spatial Indexes
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS buildings_footprint_gix
ON buildings
USING GIST(footprint);

CREATE INDEX IF NOT EXISTS windows_position_gix
ON windows
USING GIST(position);

CREATE INDEX IF NOT EXISTS incidents_location_gix
ON incidents
USING GIST(location);

CREATE INDEX IF NOT EXISTS scene_objects_position_gix
ON scene_objects
USING GIST(position);

CREATE INDEX IF NOT EXISTS investigation_cases_location_gix
ON investigation_cases
USING GIST(location);


-- ------------------------------------------------------------
-- 13. pgvector HNSW Index
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS
    investigation_cases_embedding_hnsw
ON investigation_cases
USING hnsw (
    embedding vector_cosine_ops
);


-- ------------------------------------------------------------
-- 14. CCTV Camera Configuration
-- ------------------------------------------------------------

-- Automatically assign default range, FOV and heading
-- to new cameras.
-- Existing custom camera settings are preserved.

CREATE OR REPLACE FUNCTION configure_demo_camera()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    calculated_heading NUMERIC;
BEGIN
    IF NEW.object_type = 'camera' THEN

        calculated_heading := mod(
            (
                degrees(
                    atan2(
                        -ST_Y(NEW.position),
                        -ST_X(NEW.position)
                    )
                ) + 360
            )::numeric,
            360::numeric
        );

        NEW.dimensions :=
            jsonb_build_object(
                'range_m', 70,
                'fov_deg', 100,
                'heading_deg', calculated_heading
            )
            || COALESCE(
                NEW.dimensions,
                '{}'::jsonb
            );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
    scene_camera_defaults_trigger
ON scene_objects;

CREATE TRIGGER scene_camera_defaults_trigger
BEFORE INSERT OR UPDATE OF
    position, object_type, dimensions
ON scene_objects
FOR EACH ROW
EXECUTE FUNCTION configure_demo_camera();


-- Configure cameras already stored in the database.

UPDATE scene_objects
SET dimensions =
    jsonb_build_object(
        'range_m', 70,
        'fov_deg', 100,
        'heading_deg',
        mod(
            (
                degrees(
                    atan2(
                        -ST_Y(position),
                        -ST_X(position)
                    )
                ) + 360
            )::numeric,
            360::numeric
        )
    ) || dimensions
WHERE object_type = 'camera';


-- ------------------------------------------------------------
-- 15. Investigation Test Wall
-- ------------------------------------------------------------

INSERT INTO scene_objects (
    name,
    object_type,
    position,
    dimensions,
    blocks_visibility,
    enabled
)
VALUES (
    'Investigation Test Wall',
    'wall',
    ST_SetSRID(
        ST_MakePoint(-11.25, -7.5, 0),
        0
    ),
    '{"width":6,"height":6,"depth":1}'::jsonb,
    TRUE,
    TRUE
)
ON CONFLICT (name) DO NOTHING;


COMMIT;


-- ============================================================
-- Verification
-- ============================================================

SELECT
    (SELECT COUNT(*) FROM buildings) AS buildings,
    (SELECT COUNT(*) FROM windows) AS windows,
    (SELECT COUNT(*) FROM incidents) AS incidents,
    (SELECT COUNT(*) FROM scene_objects) AS scene_objects,
    (SELECT COUNT(*) FROM investigation_cases)
        AS investigation_cases;

SELECT
    facade,
    COUNT(*) AS window_count
FROM windows
GROUP BY facade
ORDER BY facade;

SELECT
    extname,
    extversion
FROM pg_extension
WHERE extname IN ('postgis', 'vector')
ORDER BY extname;

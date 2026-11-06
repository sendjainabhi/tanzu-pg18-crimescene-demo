-- Tanzu PostgreSQL 18.6 / PostGIS 3.6.1 / pgvector 0.8.6
-- Unified schema + synthetic baseline data. Local Cartesian coordinates, SRID 0.
-- Execute against an EMPTY crime_scene database for a reproducible workshop.
-- Rerunnable: existing named seed records are not overwritten, except camera
-- defaults are filled when absent. This script never drops tables or data.
\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS buildings (
 id SERIAL PRIMARY KEY,
 name TEXT NOT NULL,
 footprint geometry(Polygon,0) NOT NULL,
 height_m DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS windows (
 id SERIAL PRIMARY KEY,
 building_id INTEGER REFERENCES buildings(id),
 floor_no INTEGER NOT NULL,
 position geometry(PointZ,0) NOT NULL
);
CREATE TABLE IF NOT EXISTS incidents (
 id SERIAL PRIMARY KEY,
 description TEXT NOT NULL,
 location geometry(PointZ,0) NOT NULL,
 embedding vector(384)
);
CREATE TABLE IF NOT EXISTS obstacles (
 id SERIAL PRIMARY KEY,
 name TEXT,
 footprint geometry(Polygon,0),
 max_height DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS scene_objects (
 id BIGSERIAL PRIMARY KEY,
 name TEXT NOT NULL UNIQUE,
 object_type TEXT NOT NULL CHECK (object_type IN
   ('tree','vehicle','streetlight','camera','bench','wall','evidence')),
 position geometry(PointZ,0) NOT NULL,
 rotation_deg DOUBLE PRECISION DEFAULT 0,
 dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
 blocks_visibility BOOLEAN DEFAULT FALSE,
 enabled BOOLEAN DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS investigation_cases (
 id BIGSERIAL PRIMARY KEY,
 case_code TEXT UNIQUE NOT NULL,
 description TEXT NOT NULL,
 category TEXT NOT NULL,
 location geometry(PointZ,0) NOT NULL,
 embedding vector(384) NOT NULL
);

CREATE INDEX IF NOT EXISTS buildings_footprint_gix ON buildings USING gist(footprint);
CREATE INDEX IF NOT EXISTS windows_position_gix ON windows USING gist(position);
CREATE INDEX IF NOT EXISTS scene_objects_position_gix ON scene_objects USING gist(position);
CREATE INDEX IF NOT EXISTS investigation_cases_location_gix ON investigation_cases USING gist(location);
CREATE INDEX IF NOT EXISTS investigation_cases_embedding_hnsw ON investigation_cases USING hnsw (embedding vector_cosine_ops);

-- Camera heading: 0 degrees = +X, 90 degrees = +Y in database coordinates.
-- Default headings aim at the center (0,0). Preserve explicit camera settings.
-- Trigger makes initialization order safe: load_scene.py can run AFTER schema.sql.
CREATE OR REPLACE FUNCTION demo_camera_defaults()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.object_type = 'camera' THEN
  NEW.dimensions := jsonb_build_object(
    'range_m',70,
    'fov_deg',100,
    'heading_deg',mod((degrees(atan2(-ST_Y(NEW.position),-ST_X(NEW.position)))+360)::numeric,360::numeric)
  ) || NEW.dimensions;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS demo_camera_defaults_trigger ON scene_objects;
CREATE TRIGGER demo_camera_defaults_trigger
BEFORE INSERT OR UPDATE OF position, dimensions, object_type ON scene_objects
FOR EACH ROW EXECUTE FUNCTION demo_camera_defaults();

-- Backfill any existing camera records with missing camera attributes.
UPDATE scene_objects SET dimensions=dimensions
WHERE object_type='camera' AND NOT
  (dimensions ? 'heading_deg' AND dimensions ? 'range_m' AND dimensions ? 'fov_deg');

-- Original city: 6 + 7 + 5 + 7 = 25 windows.
WITH seed(name,wkt,height_m) AS (
 VALUES
 ('Building A','POLYGON((-30 -30,-15 -30,-15 -15,-30 -15,-30 -30))',24.0::double precision),
 ('Building B','POLYGON((15 -30,30 -30,30 -15,15 -15,15 -30))',30.0::double precision),
 ('Building C','POLYGON((-30 15,-15 15,-15 30,-30 30,-30 15))',20.0::double precision),
 ('Building D','POLYGON((15 15,30 15,30 30,15 30,15 15))',28.0::double precision)
)
INSERT INTO buildings(name,footprint,height_m)
SELECT s.name,ST_GeomFromText(s.wkt,0),s.height_m FROM seed s
WHERE NOT EXISTS (SELECT 1 FROM buildings b WHERE b.name=s.name);

INSERT INTO windows(building_id,floor_no,position)
SELECT b.id, f.floor_no,
 ST_SetSRID(ST_MakePoint(
   ST_X(ST_Centroid(b.footprint)),
   CASE WHEN ST_Y(ST_Centroid(b.footprint)) < 0 THEN ST_YMax(b.footprint)
        ELSE ST_YMin(b.footprint) END,
   f.floor_no*4.0),0)
FROM buildings b
CROSS JOIN LATERAL generate_series(1,floor(b.height_m/4.0)::integer) AS f(floor_no)
WHERE b.name IN ('Building A','Building B','Building C','Building D')
 AND NOT EXISTS (SELECT 1 FROM windows w
                 WHERE w.building_id=b.id AND w.floor_no=f.floor_no);

INSERT INTO incidents(description,location)
SELECT 'Incident at the city intersection', ST_SetSRID(ST_MakePoint(0,0,1.5),0)
WHERE NOT EXISTS (SELECT 1 FROM incidents
                  WHERE description='Incident at the city intersection');

-- Reproducible obstruction. Baseline at incident (0,0,1.5): two windows blocked.
INSERT INTO scene_objects(name,object_type,position,dimensions,blocks_visibility,enabled)
SELECT 'Investigation Test Wall','wall',ST_SetSRID(ST_MakePoint(-11.25,-7.5,0),0),
 '{"width":6,"height":6,"depth":1}'::jsonb,TRUE,TRUE
WHERE NOT EXISTS (SELECT 1 FROM scene_objects WHERE name='Investigation Test Wall');
COMMIT;

-- Initial synthetic city data for Tanzu PostgreSQL 18 / PostGIS 3.6.
-- Run in a NEW crime_scene database before database/schema.sql.
-- Local Cartesian coordinates, SRID 0; distances are treated as meters.
-- Rerunnable for the same dataset; does not delete or overwrite existing rows.
-- Existing unrelated rows in the target tables are preserved.

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS buildings (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    footprint geometry(Polygon, 0) NOT NULL,
    height_m DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS windows (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id),
    floor_no INTEGER NOT NULL,
    position geometry(PointZ, 0) NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    location geometry(PointZ, 0) NOT NULL,
    embedding vector(384)
);

-- Heights yield 6 + 7 + 5 + 7 = 25 windows.
WITH seed(name, wkt, height_m) AS (
    VALUES
    ('Building A', 'POLYGON((-30 -30,-15 -30,-15 -15,-30 -15,-30 -30))', 24.0::double precision),
    ('Building B', 'POLYGON((15 -30,30 -30,30 -15,15 -15,15 -30))', 30.0::double precision),
    ('Building C', 'POLYGON((-30 15,-15 15,-15 30,-30 30,-30 15))', 20.0::double precision),
    ('Building D', 'POLYGON((15 15,30 15,30 30,15 30,15 15))', 28.0::double precision)
)
INSERT INTO buildings(name, footprint, height_m)
SELECT s.name, ST_GeomFromText(s.wkt, 0), s.height_m
FROM seed s
WHERE NOT EXISTS (SELECT 1 FROM buildings b WHERE b.name=s.name);

-- Match original demo: one window per floor on street-facing Y facade.
INSERT INTO windows(building_id, floor_no, position)
SELECT b.id, f.floor_no,
       ST_SetSRID(
         ST_MakePoint(
           ST_X(ST_Centroid(b.footprint)),
           CASE WHEN ST_Y(ST_Centroid(b.footprint)) < 0
                THEN ST_YMax(b.footprint)
                ELSE ST_YMin(b.footprint)
           END,
           f.floor_no * 4.0
         ), 0
       )
FROM buildings b
CROSS JOIN LATERAL generate_series(
    1, floor(b.height_m / 4.0)::integer
) AS f(floor_no)
WHERE b.name IN ('Building A','Building B','Building C','Building D')
  AND NOT EXISTS (
    SELECT 1 FROM windows w
    WHERE w.building_id=b.id AND w.floor_no=f.floor_no
  );

INSERT INTO incidents(description, location)
SELECT 'Incident at the city intersection',
       ST_SetSRID(ST_MakePoint(0, 0, 1.5), 0)
WHERE NOT EXISTS (
    SELECT 1 FROM incidents
    WHERE description='Incident at the city intersection'
);

COMMIT;

-- Verify after execution:
-- SELECT (SELECT count(*) FROM buildings) buildings,
--        (SELECT count(*) FROM windows) windows,
--        (SELECT count(*) FROM incidents) incidents;

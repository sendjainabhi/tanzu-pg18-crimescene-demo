-- Run AFTER database/schema.sql has created scene_objects.
-- Adds the obstruction used in the baseline workshop scenario.
INSERT INTO scene_objects
  (name, object_type, position, dimensions, blocks_visibility, enabled)
VALUES
  ('Investigation Test Wall', 'wall',
   ST_SetSRID(ST_MakePoint(-11.25,-7.5,0),0),
   '{"width":6,"height":6,"depth":1}'::jsonb, TRUE, TRUE)
ON CONFLICT (name) DO UPDATE SET
    position=EXCLUDED.position,
    dimensions=EXCLUDED.dimensions,
    blocks_visibility=TRUE,
    enabled=TRUE;

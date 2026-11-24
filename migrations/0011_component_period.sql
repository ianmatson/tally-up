ALTER TABLE components ADD COLUMN period TEXT NOT NULL DEFAULT 'day' CHECK (period IN ('day', 'week', 'month'));
UPDATE components SET period = 'week'
WHERE lower(replace(replace(replace(trim(name), '-', ''), ' ', ''), '_', '')) IN ('run', 'running')
  AND lower(trim(unit)) IN ('mi', 'mile', 'miles');

-- NULL preserves the configured rate until an admin saves new rates.
ALTER TABLE schools ADD COLUMN paper_points_per_kg INTEGER CHECK (paper_points_per_kg BETWEEN 1 AND 10000);
ALTER TABLE schools ADD COLUMN plastic_points_per_kg INTEGER CHECK (plastic_points_per_kg BETWEEN 1 AND 10000);

-- Add Australian States and Territories Script
-- Created: 2024-02-14

-- First, fix the typo in Victoria (change VIctoria to Victoria)
UPDATE countries
SET name = 'Victoria',
    subregion1 = 'Victoria',
    code2 = 'AU-VIC'
WHERE id = '0edca2a6-84ed-4258-828a-688d9bae549d';

-- Add all Australian states and territories
-- Using standard ISO 3166-2:AU codes for code2 field

-- New South Wales
INSERT INTO countries (id, name, code2, code3, subregion1, "parentId", disabled)
VALUES (
    gen_random_uuid(),
    'New South Wales',
    'AU-NSW',
    'NSW',
    'New South Wales',
    '071a36ac-c2e2-4462-b10d-3175b101bd06',
    false
) ON CONFLICT (code2) DO NOTHING;

-- Queensland
INSERT INTO countries (id, name, code2, code3, subregion1, "parentId", disabled)
VALUES (
    gen_random_uuid(),
    'Queensland',
    'AU-QLD',
    'QLD',
    'Queensland',
    '071a36ac-c2e2-4462-b10d-3175b101bd06',
    false
) ON CONFLICT (code2) DO NOTHING;

-- South Australia
INSERT INTO countries (id, name, code2, code3, subregion1, "parentId", disabled)
VALUES (
    gen_random_uuid(),
    'South Australia',
    'AU-SA',
    'SA',
    'South Australia',
    '071a36ac-c2e2-4462-b10d-3175b101bd06',
    false
) ON CONFLICT (code2) DO NOTHING;

-- Western Australia
INSERT INTO countries (id, name, code2, code3, subregion1, "parentId", disabled)
VALUES (
    gen_random_uuid(),
    'Western Australia',
    'AU-WA',
    'WA',
    'Western Australia',
    '071a36ac-c2e2-4462-b10d-3175b101bd06',
    false
) ON CONFLICT (code2) DO NOTHING;

-- Tasmania
INSERT INTO countries (id, name, code2, code3, subregion1, "parentId", disabled)
VALUES (
    gen_random_uuid(),
    'Tasmania',
    'AU-TAS',
    'TAS',
    'Tasmania',
    '071a36ac-c2e2-4462-b10d-3175b101bd06',
    false
) ON CONFLICT (code2) DO NOTHING;

-- Northern Territory
INSERT INTO countries (id, name, code2, code3, subregion1, "parentId", disabled)
VALUES (
    gen_random_uuid(),
    'Northern Territory',
    'AU-NT',
    'NT',
    'Northern Territory',
    '071a36ac-c2e2-4462-b10d-3175b101bd06',
    false
) ON CONFLICT (code2) DO NOTHING;

-- Australian Capital Territory
INSERT INTO countries (id, name, code2, code3, subregion1, "parentId", disabled)
VALUES (
    gen_random_uuid(),
    'Australian Capital Territory',
    'AU-ACT',
    'ACT',
    'Australian Capital Territory',
    '071a36ac-c2e2-4462-b10d-3175b101bd06',
    false
) ON CONFLICT (code2) DO NOTHING;

-- Verify the results
SELECT
    c.id,
    c.name,
    c.code2,
    c.code3,
    c.subregion1,
    c.disabled
FROM countries c
WHERE c."parentId" = '071a36ac-c2e2-4462-b10d-3175b101bd06'
ORDER BY c.name;
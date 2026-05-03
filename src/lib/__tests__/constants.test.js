import { describe, it, expect } from 'vitest'
import {
  EU_ALLERGENS,
  ALLERGEN_COLORS,
  FRIDGE_SAFE_MIN,
  FRIDGE_SAFE_MAX,
  STAFF_PERMISSIONS,
  STAFF_PERMISSION_IDS,
  DEFAULT_STAFF_PERMISSIONS,
  PERMISSION_PRESETS,
  STAFF_COLOUR_PALETTE,
  ROLE_OPTIONS,
  PLANS,
  EXPLAINED_EXCEEDANCE_REASONS,
} from '../constants'

describe('EU_ALLERGENS', () => {
  it('contains exactly 14 EU-regulated allergens', () => {
    expect(EU_ALLERGENS).toHaveLength(14)
  })

  it('includes all mandatory EU allergens', () => {
    const required = ['Gluten', 'Crustaceans', 'Eggs', 'Fish', 'Peanuts', 'Milk',
      'Tree Nuts', 'Celery', 'Mustard', 'Sesame', 'Soya', 'Sulphur Dioxide', 'Lupin', 'Molluscs']
    for (const allergen of required) {
      expect(EU_ALLERGENS).toContain(allergen)
    }
  })

  it('contains no duplicate allergens', () => {
    expect(new Set(EU_ALLERGENS).size).toBe(EU_ALLERGENS.length)
  })
})

describe('ALLERGEN_COLORS', () => {
  it('has a colour entry for every allergen in EU_ALLERGENS', () => {
    for (const allergen of EU_ALLERGENS) {
      expect(ALLERGEN_COLORS).toHaveProperty(allergen)
    }
  })

  it('has exactly as many entries as EU_ALLERGENS', () => {
    expect(Object.keys(ALLERGEN_COLORS)).toHaveLength(EU_ALLERGENS.length)
  })

  it('all colour classes are non-empty strings', () => {
    for (const cls of Object.values(ALLERGEN_COLORS)) {
      expect(typeof cls).toBe('string')
      expect(cls.length).toBeGreaterThan(0)
    }
  })
})

describe('Fridge safe range', () => {
  it('FRIDGE_SAFE_MIN is 0°C', () => {
    expect(FRIDGE_SAFE_MIN).toBe(0)
  })

  it('FRIDGE_SAFE_MAX is 5°C', () => {
    expect(FRIDGE_SAFE_MAX).toBe(5)
  })

  it('min is less than max', () => {
    expect(FRIDGE_SAFE_MIN).toBeLessThan(FRIDGE_SAFE_MAX)
  })
})

describe('STAFF_PERMISSIONS', () => {
  it('every permission has id, label, category, description', () => {
    for (const p of STAFF_PERMISSIONS) {
      expect(p).toHaveProperty('id')
      expect(p).toHaveProperty('label')
      expect(p).toHaveProperty('category')
      expect(p).toHaveProperty('description')
    }
  })

  it('has no duplicate permission IDs', () => {
    const ids = STAFF_PERMISSIONS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('STAFF_PERMISSION_IDS matches IDs from STAFF_PERMISSIONS', () => {
    const ids = STAFF_PERMISSIONS.map(p => p.id)
    expect(STAFF_PERMISSION_IDS).toEqual(ids)
  })

  it('categories are one of the known set', () => {
    const knownCategories = new Set(['Compliance', 'Operations', 'Team'])
    for (const p of STAFF_PERMISSIONS) {
      expect(knownCategories.has(p.category)).toBe(true)
    }
  })
})

describe('DEFAULT_STAFF_PERMISSIONS', () => {
  it('is a non-empty subset of STAFF_PERMISSION_IDS', () => {
    expect(DEFAULT_STAFF_PERMISSIONS.length).toBeGreaterThan(0)
    for (const id of DEFAULT_STAFF_PERMISSIONS) {
      expect(STAFF_PERMISSION_IDS).toContain(id)
    }
  })
})

describe('PERMISSION_PRESETS', () => {
  it('contains daily, senior, and full presets', () => {
    const ids = PERMISSION_PRESETS.map(p => p.id)
    expect(ids).toContain('daily')
    expect(ids).toContain('senior')
    expect(ids).toContain('full')
  })

  it('full preset contains every permission', () => {
    const full = PERMISSION_PRESETS.find(p => p.id === 'full')
    for (const id of STAFF_PERMISSION_IDS) {
      expect(full.permissions).toContain(id)
    }
  })

  it('every permission in every preset exists in STAFF_PERMISSION_IDS', () => {
    for (const preset of PERMISSION_PRESETS) {
      for (const permId of preset.permissions) {
        expect(STAFF_PERMISSION_IDS).toContain(permId)
      }
    }
  })

  it('senior preset is a proper subset of full preset', () => {
    const full   = PERMISSION_PRESETS.find(p => p.id === 'full')
    const senior = PERMISSION_PRESETS.find(p => p.id === 'senior')
    for (const id of senior.permissions) {
      expect(full.permissions).toContain(id)
    }
  })
})

describe('STAFF_COLOUR_PALETTE', () => {
  it('contains 10 colours', () => {
    expect(STAFF_COLOUR_PALETTE).toHaveLength(10)
  })

  it('all entries are valid hex colours', () => {
    for (const colour of STAFF_COLOUR_PALETTE) {
      expect(colour).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('contains no duplicates', () => {
    expect(new Set(STAFF_COLOUR_PALETTE).size).toBe(STAFF_COLOUR_PALETTE.length)
  })
})

describe('ROLE_OPTIONS', () => {
  it('every role has a label and color', () => {
    for (const role of ROLE_OPTIONS) {
      expect(typeof role.label).toBe('string')
      expect(typeof role.color).toBe('string')
    }
  })
})

describe('PLANS', () => {
  it('has STARTER and PRO plan identifiers', () => {
    expect(PLANS.STARTER).toBe('starter')
    expect(PLANS.PRO).toBe('pro')
  })
})

describe('EXPLAINED_EXCEEDANCE_REASONS', () => {
  it('contains at least delivery, defrost, and service_access', () => {
    expect(EXPLAINED_EXCEEDANCE_REASONS).toContain('delivery')
    expect(EXPLAINED_EXCEEDANCE_REASONS).toContain('defrost')
    expect(EXPLAINED_EXCEEDANCE_REASONS).toContain('service_access')
  })
})

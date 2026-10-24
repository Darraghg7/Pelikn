import { describe, it, expect } from 'vitest'
import { ingredientAllergens, labelIngredients, recipeAllergens } from '../ppdsLabel'

describe('PPDS label ingredients', () => {
  it('names an allergen the ingredient name does not make obvious', () => {
    expect(labelIngredients([{ name: 'Pesto', allergens: ['Tree Nuts', 'Milk'] }])).toEqual([
      { name: 'Pesto', emphasiseName: false, named: ['tree nuts', 'milk'] },
    ])
  })

  it('emphasises the name when it already declares the allergen', () => {
    expect(labelIngredients([{ name: 'Whole milk', allergens: ['Milk'] }])).toEqual([
      { name: 'Whole milk', emphasiseName: true, named: [] },
    ])
    expect(labelIngredients([{ name: 'Tahini', allergens: ['Sesame'] }])[0]).toMatchObject({ emphasiseName: true, named: [] })
  })

  it('can do both on one ingredient', () => {
    // Wheat flour declares gluten; the sesame still needs naming.
    expect(labelIngredients([{ name: 'Wheat flour', allergens: ['Gluten', 'Sesame'] }])[0])
      .toEqual({ name: 'Wheat flour', emphasiseName: true, named: ['sesame'] })
  })

  it('only matches whole-word starts', () => {
    // "goat" must not count as declaring gluten via "oat".
    expect(labelIngredients([{ name: 'Goat cheese', allergens: ['Milk', 'Gluten'] }])[0])
      .toEqual({ name: 'Goat cheese', emphasiseName: true, named: ['gluten'] })
  })

  it('reads rows saved with the old single-allergen shape', () => {
    expect(ingredientAllergens({ name: 'Pesto', allergen: 'Tree Nuts' })).toEqual(['Tree Nuts'])
    expect(ingredientAllergens({ name: 'Basil', allergen: null })).toEqual([])
    expect(labelIngredients([{ name: 'Pesto', allergen: 'Tree Nuts' }])[0].named).toEqual(['tree nuts'])
  })

  it('skips blank rows and lists every allergen once', () => {
    const rows = [{ name: '  ', allergens: ['Eggs'] }, { name: 'Bread', allergens: ['Gluten', 'Sesame'] }, { name: 'Mayo', allergen: 'Eggs' }]
    expect(labelIngredients(rows).map(r => r.name)).toEqual(['Bread', 'Mayo'])
    expect(recipeAllergens(rows)).toEqual(['Eggs', 'Gluten', 'Sesame'])
  })
})

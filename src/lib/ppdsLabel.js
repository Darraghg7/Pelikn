/**
 * What a PPDS (Natasha's Law) label says about each ingredient.
 *
 * The label used to bold the ingredient's name and nothing else, so "Pesto"
 * tagged Tree Nuts printed as a bold "Pesto" and a customer couldn't tell what
 * the allergen was; each ingredient could also only carry one allergen. UK
 * guidance is to name the allergen and emphasise it — e.g. "Pesto (tree nuts,
 * milk)" — unless the ingredient's name already makes it obvious ("Milk").
 *
 * Ingredient rows are stored as { name, allergens: string[] }. Rows saved
 * before that have { name, allergen: string | null } and are read the same way.
 */

/** The allergens on one ingredient row, old or new shape. */
export function ingredientAllergens(row) {
  if (Array.isArray(row?.allergens)) return row.allergens.filter(Boolean)
  return row?.allergen ? [row.allergen] : []
}

// Words in an ingredient name that already declare the allergen.
const NAME_WORDS = {
  'Celery': ['celery', 'celeriac'],
  'Gluten': ['gluten', 'wheat', 'barley', 'rye', 'oat', 'spelt'],
  'Crustaceans': ['crustacean', 'prawn', 'shrimp', 'crab', 'lobster', 'langoustine'],
  'Eggs': ['egg'],
  'Fish': ['fish', 'salmon', 'tuna', 'cod', 'haddock', 'anchov', 'mackerel'],
  'Lupin': ['lupin'],
  'Milk': ['milk', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt'],
  'Molluscs': ['mollusc', 'mussel', 'oyster', 'squid', 'clam', 'scallop', 'octopus'],
  'Mustard': ['mustard'],
  'Tree Nuts': ['almond', 'hazelnut', 'walnut', 'cashew', 'pecan', 'brazil nut', 'pistachio', 'macadamia', 'tree nut'],
  'Peanuts': ['peanut'],
  'Sesame': ['sesame', 'tahini'],
  'Soya': ['soya', 'soy', 'tofu', 'edamame'],
  'Sulphur Dioxide': ['sulphite', 'sulfite', 'sulphur dioxide'],
}

// Matched at the start of a word, so "goat cheese" doesn't read as "oat".
const nameDeclares = (name, allergen) =>
  (NAME_WORDS[allergen] ?? [allergen.toLowerCase()]).some(w => new RegExp(`\\b${w}`, 'i').test(name))

/**
 * The ingredients line, ready to render.
 * @returns {{ name: string, emphasiseName: boolean, named: string[] }[]}
 *   emphasiseName: the name contains an allergen, so the name itself is bold.
 *   named: allergens the name doesn't make obvious; shown bold in brackets.
 */
export function labelIngredients(rows) {
  return (rows ?? [])
    .filter(r => r?.name?.trim())
    .map(r => {
      const name = r.name.trim()
      const allergens = ingredientAllergens(r)
      return {
        name,
        emphasiseName: allergens.some(a => nameDeclares(name, a)),
        named: allergens.filter(a => !nameDeclares(name, a)).map(a => a.toLowerCase()),
      }
    })
}

/** Every allergen in the recipe, in the order first used. */
export function recipeAllergens(rows) {
  return [...new Set((rows ?? []).flatMap(ingredientAllergens))]
}

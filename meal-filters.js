export function isVeganMeal(meal) {
  return Array.isArray(meal.notes) && meal.notes.some((note) =>
    typeof note === 'string' && /^Menü ist vegan$/i.test(note.trim()));
}

export function isVegetarianMeal(meal) {
  return isVeganMeal(meal) || (Array.isArray(meal.notes) && meal.notes.some((note) =>
    typeof note === 'string' && /^Menü ist vegetarisch$/i.test(note.trim())));
}

export function dietaryCategory(meal) {
  if (isVeganMeal(meal)) return 'vegan';
  if (isVegetarianMeal(meal)) return 'vegetarian';
  // Unlabelled dishes belong here too: absence of a vegetarian label is not
  // proof that a dish contains meat. The UI explains this provider limitation.
  return 'meat';
}

export function mealTitleCodes(meal) {
  const codes = new Set();
  if (typeof meal.name !== 'string') return codes;
  for (const group of meal.name.matchAll(/\(([^()]*)\)/g)) {
    const tokens = group[1].split(/[,;]/).map((token) => token.trim().toUpperCase());
    // Only complete code lists count. Do not interpret prose, quantities,
    // arbitrary letters in a dish name, or the provider's "(-)" as allergens.
    if (tokens.every((token) => /^(?:[A-Z]\d*|\d+)$/.test(token))) {
      tokens.forEach((token) => codes.add(token));
    }
  }
  return codes;
}

// Dishes the Studentenwerk repeats on every weekday. The API has no "recurring"
// flag, so these are matched by cafeteria name plus a distinctive phrase of the
// dish title. The list is curated from the week of 2026-11-09 (KW46) and only
// covers the dishes checked there; extend it after inspecting a week's data.
// Phrases must be distinctive: on 2026-11-12 Siedepunkt also served a plain
// "Blumenkohlschnitzel mit Kohlrabi-Erbsengemüse", which is a different dish.
export const repeatedDishes = [
  { key: 'siedepunkt-salat-blumenkohl', canteen: 'Mensa Siedepunkt', phrase: 'dazu Blumenkohlschnitzel',
    label: 'Bunte Salatvariation mit Blumenkohlschnitzel' },
  { key: 'siedepunkt-salat-haehnchennuggets', canteen: 'Mensa Siedepunkt', phrase: 'dazu Hähnchennuggets',
    label: 'Bunte Salatvariation mit Hähnchennuggets' },
  { key: 'neue-mensa-softeis', canteen: 'Neue Mensa', phrase: 'Kleines Softeis in der Waffel',
    label: 'Kleines Softeis in der Waffel' },
  { key: 'alte-mensa-salattheke', canteen: 'Alte Mensa', phrase: 'unsere Salattheke',
    label: 'Salattheke' },
];

const repeatedPhrases = repeatedDishes.map((dish) => ({ ...dish, phrase: dish.phrase.toLowerCase() }));

// Key of the curated repeat this meal belongs to, or undefined.
export function repeatedDishKey(canteen, meal) {
  const canteenName = canteen?.name;
  if (typeof canteenName !== 'string' || typeof meal?.name !== 'string') return undefined;
  const name = meal.name.toLowerCase();
  return repeatedPhrases.find((dish) => dish.canteen === canteenName && name.includes(dish.phrase))?.key;
}

export function matchesMealFilters(meal, categories, excludedCodes) {
  return categories.has(dietaryCategory(meal)) &&
    ![...mealTitleCodes(meal)].some((code) => excludedCodes.has(code));
}

// Display name without the provider's parenthetical code/quantity groups.
// The raw name is kept in the data, filters still read it.
export function cleanMealName(meal) {
  if (typeof meal?.name !== 'string' || !meal.name.includes('(')) return meal?.name ?? '';
  const cleaned = meal.name.replace(/\([^()]*\)/g, '').replace(/\s+([,;.!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  return cleaned || meal.name;
}

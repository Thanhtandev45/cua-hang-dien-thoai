const enabled = value => value === true || value === 'true' || value === 1 || value === '1';
const hasBound = value => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value));

// The API's ordering and the product card must describe the same concrete variant.
// Ignore Array.map's numeric callback index when this function is passed directly.
export function representativeVariant(product, filters = {}) {
  const criteria = filters && typeof filters === 'object' && !Array.isArray(filters) ? filters : {};
  const storage = criteria.storage === undefined || criteria.storage === null || criteria.storage === ''
    ? []
    : (Array.isArray(criteria.storage) ? criteria.storage : String(criteria.storage).split(',')).map(value => String(value).trim()).filter(Boolean);
  const matches = (Array.isArray(product?.variants) ? product.variants : []).filter(variant => {
    const price = Number(variant.price);
    return Number.isFinite(price) && price >= 0 &&
      (!storage.length || storage.includes(String(variant.storage))) &&
      (!hasBound(criteria.min_price) || price >= Number(criteria.min_price)) &&
      (!hasBound(criteria.max_price) || price <= Number(criteria.max_price)) &&
      (!enabled(criteria.in_stock) || Number(variant.stock) > 0) &&
      (!enabled(criteria.on_sale) || Number(variant.original_price) > price);
  }).sort((a, b) => Number(a.price) - Number(b.price));
  return matches.find(variant => Number(variant.stock) > 0) || matches[0] || null;
}

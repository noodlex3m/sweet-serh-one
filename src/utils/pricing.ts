import type { CartItem } from "../types";

/**
 * Resolves the unit price for a given cart item.
 * If wholesale conditions are met (wholesalePrice and wholesaleMinQty are configured
 * and the quantity meets or exceeds the threshold), returns the wholesale price.
 * Otherwise, returns the standard retail price.
 */
export const getItemPrice = (item: CartItem): number => {
	const { product, quantity } = item;
	if (
		product.wholesalePrice &&
		product.wholesalePrice > 0 &&
		product.wholesaleMinQty &&
		product.wholesaleMinQty > 0 &&
		quantity >= product.wholesaleMinQty
	) {
		return product.wholesalePrice;
	}
	return product.price;
};

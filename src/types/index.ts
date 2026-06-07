export interface Product {
	id: string;
	sku: string;
	title: string;
	price: number;
	description: string;
	category: string;
	image: string; // URL зображення товару
	inStock: boolean; // чи є товар у наявності
}

export interface CartItem {
	product: Product;
	quantity: number;
}

export interface Order {
	id: string;
	customerName: string;
	customerPhone: string;
	customerEmail: string;
	deliveryMethod: "nova_poshta" | "ukr_poshta" | "pickup";
	deliveryAddress: string;
	paymentMethod: "cash_on_delivery" | "iban";
	items: CartItem[];
	totalAmount: number;
	status: "new" | "processing" | "shipped" | "completed" | "cancelled";
	createdAt: Date | string;
}

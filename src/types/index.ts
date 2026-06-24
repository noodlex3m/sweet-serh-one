export interface Product {
	id: string;
	sku: string;
	title: string;
	price: number;
	description?: string;
	category: string;
	image?: string; // URL зображення товару
	inStock: boolean; // чи є товар у наявності
	unit?: string; // Одиниця виміру (кг, шт, уп, блок тощо)
	shelfLife?: string; // Термін зберігання
	storageConditions?: string; // Умови зберігання
	packageWeight?: string; // Вага упаковки / ящика
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
	status: "new" | "awaiting_payment" | "paid" | "processing" | "shipped" | "completed" | "cancelled";
	adminNotes?: string;
	createdAt: Date | string;
}

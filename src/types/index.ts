export interface Product {
	id: number;
	title: string;
	price: number;
	description: string;
	category: string;
	image: string; // URL зображення товару
	inStock: boolean; // чи є товар у наявності
}

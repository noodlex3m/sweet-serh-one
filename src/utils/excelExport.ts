import * as XLSX from 'xlsx';
import type { Order } from '../types';
import { getItemPrice } from './pricing';

// Helper to format order status into Ukrainian
const formatStatus = (status: Order['status']): string => {
  switch (status) {
    case 'new': return 'Нове';
    case 'awaiting_payment': return 'Очікує оплати';
    case 'paid': return 'Оплачено';
    case 'processing': return 'В роботі';
    case 'shipped': return 'Відправлено';
    case 'completed': return 'Виконано';
    case 'cancelled': return 'Скасовано';
    default: return status;
  }
};

// Helper to format delivery method
const formatDelivery = (method: string): string => {
  switch (method) {
    case 'nova_poshta': return 'Нова Пошта';
    case 'ukr_poshta': return 'Укрпошта';
    case 'pickup': return 'Самовивіз (Чернівці)';
    default: return method;
  }
};

// Helper to format payment method
const formatPayment = (method: string): string => {
  switch (method) {
    case 'cash_on_delivery': return 'Накладений платіж';
    case 'iban': return 'Оплата за реквізитами IBAN';
    default: return method;
  }
};

/**
 * Exports a detailed list of orders, where every row represents one item in an order.
 */
export const exportDetailedOrdersToExcel = (orders: Order[]) => {
  const data = [];

  for (const order of orders) {
    const orderDate = order.createdAt 
      ? (order.createdAt instanceof Date ? order.createdAt : new Date((order.createdAt as any).seconds * 1000)).toLocaleString('uk-UA')
      : '';

    for (const item of order.items) {
      const priceApplied = getItemPrice(item);
      const subtotal = priceApplied * item.quantity;
      const isWholesale = priceApplied < item.product.price;

      data.push({
        'ID замовлення': order.id.slice(0, 8).toUpperCase(),
        'Повний ID': order.id,
        'Дата замовлення': orderDate,
        'Клієнт': order.customerName,
        'Телефон': order.customerPhone,
        'Email': order.customerEmail || '',
        'Спосіб доставки': formatDelivery(order.deliveryMethod),
        'Адреса доставки': order.deliveryAddress,
        'Спосіб оплати': formatPayment(order.paymentMethod),
        'Товар': item.product.title,
        'Артикул (SKU)': item.product.sku,
        'Кількість': item.quantity,
        'Од. вим.': item.product.unit || 'кг',
        'Ціна (грн)': priceApplied,
        'Тип ціни': isWholesale ? 'Опт' : 'Роздріб',
        'Сума (грн)': Math.round(subtotal * 100) / 100,
        'Всього замовлення (грн)': order.totalAmount,
        'Статус замовлення': formatStatus(order.status),
        'Службові нотатки': order.adminNotes || ''
      });
    }
  }

  // Create worksheet and workbook
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Детальний звіт');

  // Set column widths
  worksheet['!cols'] = [
    { wch: 15 }, // ID замовлення
    { wch: 25 }, // Повний ID
    { wch: 20 }, // Дата замовлення
    { wch: 25 }, // Клієнт
    { wch: 18 }, // Телефон
    { wch: 20 }, // Email
    { wch: 18 }, // Спосіб доставки
    { wch: 35 }, // Адреса доставки
    { wch: 25 }, // Спосіб оплати
    { wch: 35 }, // Товар
    { wch: 15 }, // Артикул
    { wch: 12 }, // Кількість
    { wch: 10 }, // Од. вим.
    { wch: 12 }, // Ціна
    { wch: 12 }, // Тип ціни
    { wch: 15 }, // Сума
    { wch: 20 }, // Всього замовлення
    { wch: 18 }, // Статус замовлення
    { wch: 30 }  // Службові нотатки
  ];

  // Save the file
  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `sweet_orders_detailed_${today}.xlsx`);
};

/**
 * Exports a consolidated pick-list (Накладна збору) summing quantities of identical items.
 */
export const exportPickListToExcel = (orders: Order[]) => {
  // Map to store aggregated item values
  // Key: SKU
  const aggregated: Record<string, {
    sku: string;
    title: string;
    category: string;
    totalQty: number;
    unit: string;
    orderRefs: string[];
  }> = {};

  for (const order of orders) {
    const shortId = order.id.slice(0, 8).toUpperCase();
    for (const item of order.items) {
      const p = item.product;
      const sku = p.sku;

      if (!aggregated[sku]) {
        aggregated[sku] = {
          sku: sku,
          title: p.title,
          category: p.category || 'Без категорії',
          totalQty: 0,
          unit: p.unit || 'кг',
          orderRefs: []
        };
      }

      aggregated[sku].totalQty += item.quantity;
      aggregated[sku].orderRefs.push(`#${shortId} (${item.quantity} ${p.unit || 'кг'})`);
    }
  }

  // Convert map to flat array
  const list = Object.values(aggregated).map(item => ({
    'Код (SKU)': item.sku,
    'Назва товару': item.title,
    'Категорія': item.category,
    'Необхідна кількість': Math.round(item.totalQty * 1000) / 1000,
    'Од. виміру': item.unit,
    'Статус збирання [ ]': '', // Blank column for packer ticks
    'Розподіл по замовленнях': item.orderRefs.join(', ')
  }));

  // Create workbook
  const worksheet = XLSX.utils.json_to_sheet(list);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pick-List');

  // Set column widths
  worksheet['!cols'] = [
    { wch: 15 }, // Код (SKU)
    { wch: 40 }, // Назва товару
    { wch: 25 }, // Категорія
    { wch: 22 }, // Необхідна кількість
    { wch: 12 }, // Од. виміру
    { wch: 20 }, // Статус збирання
    { wch: 50 }  // Розподіл по замовленнях
  ];

  // Save the file
  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `sweet_warehouse_picklist_${today}.xlsx`);
};

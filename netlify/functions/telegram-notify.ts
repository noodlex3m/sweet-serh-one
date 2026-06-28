import { Handler } from '@netlify/functions';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export const handler: Handler = async (event) => {
  // Handle preflight OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not defined in the server environment!');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server environment misconfiguration: Telegram credentials missing' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { order } = body;

    if (!order) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Order data is missing' }),
      };
    }

    // Format delivery method
    let deliveryText = order.deliveryMethod;
    if (order.deliveryMethod === 'nova_poshta') deliveryText = '🚀 Нова Пошта';
    else if (order.deliveryMethod === 'ukr_poshta') deliveryText = '✉️ Укрпошта';
    else if (order.deliveryMethod === 'pickup') deliveryText = '🏬 Самовивіз (Чернівці)';

    // Format payment method
    let paymentText = order.paymentMethod;
    if (order.paymentMethod === 'cash_on_delivery') paymentText = '💵 Накладений платіж';
    else if (order.paymentMethod === 'iban') paymentText = '🏦 Оплата на рахунок ФОП (IBAN)';

    // Format items list
    const itemsText = order.items
      .map((item: { product: { title: string; price: number; unit?: string; packageWeight?: string }; quantity: number }, idx: number) => {
        const p = item.product;
        const totalItemPrice = p.price * item.quantity;
        const unitText = p.unit ? ` ${p.unit}` : ' шт.';
        const weightText = p.packageWeight ? ` (вага: ${p.packageWeight})` : '';
        return `${idx + 1}. *${p.title}*${weightText}\n   Кількість: ${item.quantity}${unitText} x ${p.price} грн = *${totalItemPrice} грн*`;
      })
      .join('\n\n');

    // Build the final Telegram message
    const message = `🔔 *Нове замовлення № ${order.id}* 🔔\n\n` +
      `👤 *Клієнт:* ${order.customerName}\n` +
      `📞 *Телефон:* \`${order.customerPhone}\`\n` +
      `📧 *Email:* ${order.customerEmail || 'не вказано'}\n\n` +
      `🚚 *Спосіб доставки:* ${deliveryText}\n` +
      `📍 *Адреса:* ${order.deliveryAddress}\n\n` +
      `💳 *Спосіб оплати:* ${paymentText}\n\n` +
      `📦 *Товари:*\n${itemsText}\n\n` +
      `💰 *Загальна сума:* *${order.totalAmount} грн*\n\n` +
      `🔗 [Перейти в адмін-панель](https://sweet.serh.one/admin)`;

    // Send request to Telegram Bot API
    const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram API responded with status ${response.status}: ${errorText}`);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Error sending message to Telegram:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return {
      statusCode: 500,
      body: JSON.stringify({ error: errorMessage }),
    };
  }
};

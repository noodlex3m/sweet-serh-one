import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import type { Order, CartItem } from '../types';
import { getItemPrice } from '../utils/pricing';
import './Invoice.css';

// Helper to convert number to Ukrainian words for the invoice
function numberToUkrainianWords(num: number): string {
  const rounded = Math.round(num * 100) / 100;
  const hryvnias = Math.floor(rounded);
  const kopecks = Math.round((rounded - hryvnias) * 100);

  const units = ['', 'один', 'два', 'три', 'чотири', 'п\'ять', 'шість', 'сім', 'вісім', 'дев\'ять'];
  const unitsFeminine = ['', 'одна', 'дві', 'три', 'чотири', 'п\'ять', 'шість', 'сім', 'вісім', 'дев\'ять'];
  const teens = ['десять', 'одинадцять', 'дванадцять', 'тринадцять', 'чотирнадцять', 'п\'ятнадцять', 'шістнадцять', 'сімнадцять', 'вісімнадцять', 'дев\'ятнадцять'];
  const tens = ['', '', 'двадцять', 'тридцять', 'сорок', 'п\'ятдесят', 'шістдесят', 'сімдесят', 'вісімдесят', 'дев\'яносто'];
  const hundreds = ['', 'сто', 'двісті', 'триста', 'чотириста', 'п\'ятсот', 'шістсот', 'сімсот', 'вісімсот', 'дев\'ятсот'];

  function getWordGroup(n: number, isFeminine: boolean): string {
    let result = '';
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (h > 0) result += hundreds[h] + ' ';
    if (t === 1) {
      result += teens[u] + ' ';
    } else {
      if (t > 1) result += tens[t] + ' ';
      if (u > 0) {
        result += (isFeminine ? unitsFeminine[u] : units[u]) + ' ';
      }
    }
    return result.trim();
  }

  function getHryvniaDeclension(n: number): string {
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    if (t === 1) return 'гривень';
    if (u === 1) return 'гривня';
    if (u >= 2 && u <= 4) return 'гривні';
    return 'гривень';
  }

  if (hryvnias === 0) return `Нуль гривень ${kopecks.toString().padStart(2, '0')} копійок`;

  let words = '';
  
  // Millions
  const milVal = Math.floor(hryvnias / 1000000) % 1000;
  if (milVal > 0) {
    const grp = getWordGroup(milVal, false);
    const lastDigit = milVal % 10;
    const lastTwoDigits = milVal % 100;
    let suffix = 'мільйонів';
    if (Math.floor(lastTwoDigits / 10) !== 1) {
      if (lastDigit === 1) suffix = 'мільйон';
      else if (lastDigit >= 2 && lastDigit <= 4) suffix = 'мільйони';
    }
    words += grp + ' ' + suffix + ' ';
  }

  // Thousands
  const thVal = Math.floor(hryvnias / 1000) % 1000;
  if (thVal > 0) {
    const grp = getWordGroup(thVal, true);
    const lastDigit = thVal % 10;
    const lastTwoDigits = thVal % 100;
    let suffix = 'тисяч';
    if (Math.floor(lastTwoDigits / 10) !== 1) {
      if (lastDigit === 1) suffix = 'тисяча';
      else if (lastDigit >= 2 && lastDigit <= 4) suffix = 'тисячі';
    }
    words += grp + ' ' + suffix + ' ';
  }

  // Hryvnias
  const hrVal = hryvnias % 1000;
  if (hrVal > 0) {
    words += getWordGroup(hrVal, true) + ' ';
  }

  words = words.trim();
  words = words.charAt(0).toUpperCase() + words.slice(1);

  const hrText = getHryvniaDeclension(hryvnias);
  const copText = kopecks === 1 ? 'копійка' : (kopecks >= 2 && kopecks <= 4 && Math.floor((kopecks % 100) / 10) !== 1 ? 'копійки' : 'копійок');

  return `${words} ${hrText} ${kopecks.toString().padStart(2, '0')} ${copText}`;
}

export default function Invoice() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FOP details from env variables
  const fopName = import.meta.env.VITE_FOP_NAME || '';
  const fopIban = import.meta.env.VITE_FOP_IBAN || '';
  const fopIpn = import.meta.env.VITE_FOP_IPN || '';
  const fopBank = import.meta.env.VITE_FOP_BANK || '';
  const fopMfo = import.meta.env.VITE_FOP_MFO || '';
  const fopPhone = import.meta.env.VITE_FOP_PHONE || '';

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        setError('Не вказано ID замовлення');
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'orders', orderId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError('Замовлення не знайдено');
          setLoading(false);
          return;
        }

        const orderData = { id: docSnap.id, ...docSnap.data() } as Order;
        
        // Check permissions: admin or owner of the order
        const isAdmin = currentUser && currentUser.email === 'noodlex3m@gmail.com';
        const isOwner = currentUser && orderData.customerEmail === currentUser.email;

        if (!isAdmin && !isOwner) {
          setError('У вас немає прав для перегляду цього рахунку');
          setLoading(false);
          return;
        }

        // Restrict client from seeing the invoice unless status is 'awaiting_payment' or 'paid'
        if (!isAdmin && orderData.status === 'new') {
          setError('Рахунок буде доступний після того, як менеджер підтвердить наявність товарів на складі.');
          setLoading(false);
          return;
        }

        setOrder(orderData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching order for invoice:', err);
        setError('Виникла помилка під час завантаження даних замовлення');
        setLoading(false);
      }
    };

    if (currentUser !== undefined) {
      fetchOrder();
    }
  }, [orderId, currentUser]);

  // Trigger print dialog once loaded and rendering
  useEffect(() => {
    if (order && !loading) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [order, loading]);

  if (loading) {
    return (
      <div className="invoice-loading-wrapper">
        <div className="invoice-loading-box">
          <div className="invoice-loading-spinner"></div>
          <p>Завантаження рахунку на оплату...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="invoice-error-wrapper">
        <span className="invoice-error-icon">⚠️</span>
        <h2 className="invoice-error-title">Помилка доступу</h2>
        <p className="invoice-error-desc">{error || 'Замовлення не знайдено'}</p>
        <button className="btn invoice-error-btn" onClick={() => navigate('/account')}>
          Повернутися в кабінет
        </button>
      </div>
    );
  }

  // Format date to local Ukrainian standard
  const orderDate = order.createdAt 
    ? (order.createdAt instanceof Date ? order.createdAt : new Date((order.createdAt as unknown as { seconds: number }).seconds * 1000)).toLocaleDateString('uk-UA')
    : new Date().toLocaleDateString('uk-UA');

  return (
    <div className="invoice-print-container">
      
      {/* Interactive print control bar (hidden in CSS print mode) */}
      <div className="print-controls">
        <div>
          <span className="print-controls-title">📄 Рахунок готовий до друку або збереження в PDF</span>
        </div>
        <div className="print-controls-actions">
          <button onClick={() => window.print()} className="print-controls-btn-print">
            🖨️ Друкувати / Зберегти як PDF
          </button>
          <button onClick={() => navigate('/account')} className="print-controls-btn-back">
            Назад до кабінету
          </button>
        </div>
      </div>

      {/* Actual A4 Printable Invoice Form */}
      <div className="invoice-sheet">
        
        {/* Invoice Header / Supplier Banner */}
        <div className="invoice-supplier-banner">
          <div>
            <h1 className="invoice-supplier-name">{fopName}</h1>
            <p className="invoice-supplier-desc">
              Кондитерський оптово-роздрібний склад солодощів «sweet-serh-one»<br />
              Чернівці, Україна {fopPhone ? `| Тел: ${fopPhone}` : ''}
            </p>
          </div>
          <div className="invoice-supplier-logo">
            <span className="invoice-supplier-logo-icon">🍰</span>
            <p className="invoice-supplier-logo-domain">sweet.serh.one</p>
          </div>
        </div>

        {/* Invoice Title */}
        <div className="invoice-title-block">
          <h2 className="invoice-title">
            РАХУНОК-ФАКТУРА № {order.id.substring(0, 8).toUpperCase()}
          </h2>
          <p className="invoice-date">від {orderDate} р.</p>
        </div>

        {/* Supplier IBAN Details (Standartized Ukrainian Bill Format) */}
        <table className="invoice-details-table">
          <tbody>
            <tr>
              <td className="label-cell">Одержувач</td>
              <td>{fopName}</td>
            </tr>
            <tr>
              <td className="label-cell">Код отримувача (ЄДРПОУ / ІПН)</td>
              <td>{fopIpn}</td>
            </tr>
            <tr>
              <td className="label-cell">Банк одержувача</td>
              <td>{fopBank}</td>
            </tr>
            <tr>
              <td className="label-cell">МФО банку</td>
              <td>{fopMfo}</td>
            </tr>
            <tr>
              <td className="label-cell">Рахунок одержувача (IBAN)</td>
              <td className="iban-cell">{fopIban}</td>
            </tr>
            <tr>
              <td className="label-cell">Призначення платежу</td>
              <td className="purpose-cell">
                Оплата за замовлення № {order.id.substring(0, 8).toUpperCase()} від {orderDate} р. без ПДВ
              </td>
            </tr>
          </tbody>
        </table>

        {/* Payer and Delivery Details */}
        <div className="invoice-parties-block">
          <div className="invoice-party-box">
            <h3 className="invoice-party-title">
              Платник (Замовник)
            </h3>
            <p><strong>Ім'я:</strong> {order.customerName}</p>
            <p><strong>Телефон:</strong> {order.customerPhone}</p>
            <p><strong>Email:</strong> {order.customerEmail || 'не вказано'}</p>
          </div>
          <div className="invoice-party-box">
            <h3 className="invoice-party-title">
              Доставка
            </h3>
            <p>
              <strong>Спосіб:</strong> {
                order.deliveryMethod === 'nova_poshta' ? '🚀 Нова Пошта' :
                order.deliveryMethod === 'ukr_poshta' ? '✉️ Укрпошта' : '🏬 Самовивіз з Чернівців'
              }
            </p>
            <p><strong>Адреса:</strong> {order.deliveryAddress}</p>
          </div>
        </div>

        {/* Specification Items Table */}
        <table className="invoice-items-table">
          <thead>
            <tr>
              <th className="col-num">№</th>
              <th className="col-title">Товар (Опис)</th>
              <th className="col-unit">Од. вим.</th>
              <th className="col-qty">Кіл-сть</th>
              <th className="col-price">Ціна</th>
              <th className="col-amount">Сума, грн</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item: CartItem, idx: number) => {
              const p = item.product;
              const priceApplied = getItemPrice(item);
              return (
                <tr key={idx}>
                  <td className="cell-center">{idx + 1}</td>
                  <td>
                    {p.title}
                    {p.packageWeight ? <span className="package-weight-desc">Вага уп: {p.packageWeight}</span> : null}
                  </td>
                  <td className="cell-center">{p.unit || 'шт.'}</td>
                  <td className="cell-center">{item.quantity}</td>
                  <td className="cell-right">{priceApplied.toFixed(2)}</td>
                  <td className="cell-right">
                    {(priceApplied * item.quantity).toFixed(2)}
                  </td>
                </tr>
              );
            })}
            
            {/* Totals Row */}
            <tr className="invoice-totals-row">
              <td colSpan={5} className="cell-right">Разом без ПДВ:</td>
              <td className="cell-right">{order.totalAmount.toFixed(2)}</td>
            </tr>
            <tr className="invoice-totals-row">
              <td colSpan={5} className="cell-right">ПДВ:</td>
              <td className="cell-right">0.00</td>
            </tr>
            <tr className="grand-totals-row">
              <td colSpan={5} className="cell-right">Всього до сплати:</td>
              <td className="cell-right">{order.totalAmount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Total in words and billing info */}
        <div className="invoice-summary-words">
          <p>
            Всього найменувань <strong>{order.items.length}</strong>, на суму <strong>{order.totalAmount.toFixed(2)} грн.</strong>
          </p>
          <p className="in-words">
            Сума прописом: {numberToUkrainianWords(order.totalAmount)}
          </p>
        </div>

        {/* Step-by-Step Payment Instructions */}
        <div className="invoice-instructions-block">
          <h4 className="invoice-instructions-title">
            ℹ️ Як швидко здійснити оплату в банківському додатку (Приват24 / Монобанк тощо):
          </h4>
          <ol className="invoice-instructions-list">
            <li>Відкрийте банківський додаток на вашому смартфоні.</li>
            <li>Виберіть меню <strong>«Платежі»</strong> або <strong>«За реквізитами»</strong>.</li>
            <li>Введіть наш номер рахунку (IBAN): <strong>{fopIban}</strong>.</li>
            <li>Додаток автоматично підтягне назву <strong>{fopName}</strong>.</li>
            <li>У полі <strong>Сума</strong> вкажіть: <strong>{order.totalAmount.toFixed(2)} грн</strong>.</li>
            <li>У полі <strong>Призначення платежу</strong> вкажіть: <code>Оплата за замовлення № {order.id.substring(0, 8).toUpperCase()}</code>.</li>
            <li>Надішліть квитанцію про оплату вашому менеджеру для швидкої відправки товарів!</li>
          </ol>
        </div>

        {/* Signatures Footer */}
        <div className="invoice-signatures-block">
          <div className="invoice-signature-line">
            <strong>Виписав (постачальник):</strong>
            <div className="invoice-signature-space"></div>
          </div>
          <div className="invoice-signature-line">
            <strong>Отримав (покупець):</strong>
            <div className="invoice-signature-space"></div>
          </div>
        </div>

      </div>

    </div>
  );
}

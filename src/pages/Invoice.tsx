import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import type { Order } from '../types';

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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Outfit, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '4px solid var(--border-light)', borderTop: '4px solid var(--accent)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }}></div>
          <p>Завантаження рахунку на оплату...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ padding: '40px', maxWidth: '600px', margin: '80px auto', textAlign: 'center', fontFamily: 'Outfit, sans-serif', border: '1px solid var(--border-light)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
        <span style={{ fontSize: '48px' }}>⚠️</span>
        <h2 style={{ color: 'var(--text-primary)', margin: '16px 0 8px 0' }}>Помилка доступу</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{error || 'Замовлення не знайдено'}</p>
        <button className="btn" onClick={() => navigate('/account')} style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>
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
    <div className="invoice-print-container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Outfit, sans-serif', color: '#000', backgroundColor: '#fff' }}>
      
      {/* Interactive print control bar (hidden in CSS print mode) */}
      <div className="print-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '12px 20px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '8px' }}>
        <div>
          <span style={{ fontWeight: '600', fontSize: '15px' }}>📄 Рахунок готовий до друку або збереження в PDF</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => window.print()} style={{ backgroundColor: '#ff7e1b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
            🖨️ Друкувати / Зберегти як PDF
          </button>
          <button onClick={() => navigate('/account')} style={{ backgroundColor: '#6c757d', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
            Назад до кабінету
          </button>
        </div>
      </div>

      {/* Actual A4 Printable Invoice Form */}
      <div className="invoice-sheet" style={{ border: '1px solid #eee', padding: '30px', backgroundColor: '#fff' }}>
        
        {/* Invoice Header / Supplier Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 'bold' }}>{fopName}</h1>
            <p style={{ margin: '0', fontSize: '13px', color: '#555' }}>
              Кондитерський оптово-роздрібний склад солодощів «sweet-serh-one»<br />
              Чернівці, Україна {fopPhone ? `| Тел: ${fopPhone}` : ''}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '24px' }}>🍰</span>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', fontWeight: 'bold', color: '#777' }}>sweet.serh.one</p>
          </div>
        </div>

        {/* Invoice Title */}
        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <h2 style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>
            РАХУНОК-ФАКТУРА № {order.id.substring(0, 8).toUpperCase()}
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>від {orderDate} р.</p>
        </div>

        {/* Supplier IBAN Details (Standartized Ukrainian Bill Format) */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px', fontSize: '13px' }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', width: '30%' }}>Одержувач</td>
              <td style={{ border: '1px solid #000', padding: '6px' }}>{fopName}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>Код отримувача (ЄДРПОУ / ІПН)</td>
              <td style={{ border: '1px solid #000', padding: '6px' }}>{fopIpn}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>Банк одержувача</td>
              <td style={{ border: '1px solid #000', padding: '6px' }}>{fopBank}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>МФО банку</td>
              <td style={{ border: '1px solid #000', padding: '6px' }}>{fopMfo}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>Рахунок одержувача (IBAN)</td>
              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', letterSpacing: '0.5px' }}>{fopIban}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>Призначення платежу</td>
              <td style={{ border: '1px solid #000', padding: '6px', color: '#333' }}>
                Оплата за замовлення № {order.id.substring(0, 8).toUpperCase()} від {orderDate} р. без ПДВ
              </td>
            </tr>
          </tbody>
        </table>

        {/* Payer and Delivery Details */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '25px', fontSize: '13px' }}>
          <div style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', borderBottom: '1px solid #eee', paddingBottom: '4px', fontWeight: 'bold' }}>
              Платник (Замовник)
            </h3>
            <p style={{ margin: '0 0 4px 0' }}><strong>Ім'я:</strong> {order.customerName}</p>
            <p style={{ margin: '0 0 4px 0' }}><strong>Телефон:</strong> {order.customerPhone}</p>
            <p style={{ margin: '0' }}><strong>Email:</strong> {order.customerEmail || 'не вказано'}</p>
          </div>
          <div style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', borderBottom: '1px solid #eee', paddingBottom: '4px', fontWeight: 'bold' }}>
              Доставка
            </h3>
            <p style={{ margin: '0 0 4px 0' }}>
              <strong>Спосіб:</strong> {
                order.deliveryMethod === 'nova_poshta' ? '🚀 Нова Пошта' :
                order.deliveryMethod === 'ukr_poshta' ? '✉️ Укрпошта' : '🏬 Самовивіз з Чернівців'
              }
            </p>
            <p style={{ margin: '0' }}><strong>Адреса:</strong> {order.deliveryAddress}</p>
          </div>
        </div>

        {/* Specification Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f1f1' }}>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '5%' }}>№</th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left', width: '50%' }}>Товар (Опис)</th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '10%' }}>Од. вим.</th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '10%' }}>Кіл-сть</th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', width: '10%' }}>Ціна</th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', width: '15%' }}>Сума, грн</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => {
              const p = item.product;
              return (
                <tr key={idx}>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '6px' }}>
                    {p.title}
                    {p.packageWeight ? <span style={{ fontSize: '11px', color: '#555', display: 'block' }}>Вага уп: {p.packageWeight}</span> : null}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{p.unit || 'шт.'}</td>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{p.price.toFixed(2)}</td>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>
                    {(p.price * item.quantity).toFixed(2)}
                  </td>
                </tr>
              );
            })}
            
            {/* Totals Row */}
            <tr style={{ fontWeight: 'bold' }}>
              <td colSpan={5} style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>Разом без ПДВ:</td>
              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{order.totalAmount.toFixed(2)}</td>
            </tr>
            <tr style={{ fontWeight: 'bold' }}>
              <td colSpan={5} style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>ПДВ:</td>
              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>0.00</td>
            </tr>
            <tr style={{ fontWeight: 'bold', fontSize: '14px', backgroundColor: '#f1f1f1' }}>
              <td colSpan={5} style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>Всього до сплати:</td>
              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{order.totalAmount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Total in words and billing info */}
        <div style={{ fontSize: '13px', marginBottom: '30px', borderBottom: '1px solid #000', paddingBottom: '10px' }}>
          <p style={{ margin: '0 0 6px 0' }}>
            Всього найменувань <strong>{order.items.length}</strong>, на суму <strong>{order.totalAmount.toFixed(2)} грн.</strong>
          </p>
          <p style={{ margin: '0', fontWeight: 'bold', fontStyle: 'italic' }}>
            Сума прописом: {numberToUkrainianWords(order.totalAmount)}
          </p>
        </div>

        {/* Step-by-Step Payment Instructions */}
        <div style={{ fontSize: '12px', border: '1px dashed #777', padding: '12px', borderRadius: '4px', marginBottom: '40px', backgroundColor: '#fcfcfc' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 'bold', color: '#ff7e1b' }}>
            ℹ️ Як швидко здійснити оплату в банківському додатку (Приват24 / Монобанк тощо):
          </h4>
          <ol style={{ margin: '0', paddingLeft: '20px', lineHeight: '1.5' }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '40px' }}>
          <div style={{ width: '45%', borderBottom: '1px solid #000', paddingBottom: '4px' }}>
            <strong>Виписав (постачальник):</strong>
            <div style={{ height: '35px' }}></div>
          </div>
          <div style={{ width: '45%', borderBottom: '1px solid #000', paddingBottom: '4px' }}>
            <strong>Отримав (покупець):</strong>
            <div style={{ height: '35px' }}></div>
          </div>
        </div>

      </div>

      {/* Print only CSS Styles */}
      <style>{`
        @media print {
          body {
            background-color: #fff !important;
            color: #000 !important;
          }
          .print-controls {
            display: none !important;
          }
          .invoice-print-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .invoice-sheet {
            border: none !important;
            padding: 0 !important;
          }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, addDoc, deleteDoc, setDoc } from 'firebase/firestore';
import type { Order, Product, CartItem } from '../types';
import productsData from '../data/products.json';
import { getItemPrice } from '../utils/pricing';
import './Admin.css';

const CATEGORIES = [
  'Печиво та пряники',
  'Кекси та рулети',
  'Вафлі та трубочки',
  'Зефір, мармелад та ірис',
  'Цукерки та шоколад',
  'Святкові та патріотичні солодощі',
  'Подарункові набори та дитячі солодощі'
];

interface AdminOrderNotesProps {
  orderId: string;
  initialNotes: string;
}

function AdminOrderNotes({ orderId, initialNotes }: AdminOrderNotesProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveNotes = async () => {
    setIsSaving(true);
    setIsSaved(false);
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { adminNotes: notes.trim() });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (e) {
      console.error("Error saving admin notes: ", e);
      alert("Не вдалося зберегти нотатки");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="admin-notes-container">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Введіть службові нотатки (номер ТТН, дата проплати, заміна товарів тощо)..."
        rows={2}
        className="admin-notes-textarea"
      />
      <div className="admin-notes-actions-row">
        <button
          className="btn btn-outline admin-notes-save-btn"
          onClick={handleSaveNotes}
          disabled={isSaving}
        >
          {isSaving ? 'Збереження...' : 'Зберегти нотатки'}
        </button>
        {isSaved && (
          <span className="admin-notes-success-text">
            ✓ Нотатки збережено
          </span>
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  const { currentUser, login, logout } = useAuth();
  
  // Tab control
  const [activeTab, setActiveTab] = useState<'orders' | 'products'>('orders');

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Order editing states
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingItems, setEditingItems] = useState<CartItem[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // Auth form states
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Product form states
  const [sku, setSku] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState(0);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [inStock, setInStock] = useState(true);
  const [unit, setUnit] = useState('кг');
  const [shelfLife, setShelfLife] = useState('');
  const [storageConditions, setStorageConditions] = useState('');
  const [packageWeight, setPackageWeight] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState<string>('');
  const [wholesaleMinQty, setWholesaleMinQty] = useState<string>('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Check if current user is admin
  const isAdmin = currentUser && currentUser.email === 'noodlex3m@gmail.com';

  // Handle Admin Login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      await login(adminEmail, adminPassword);
      setAdminEmail('');
      setAdminPassword('');
    } catch (err) {
      console.error("Login error: ", err);
      setLoginError('Неправильний email або пароль');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Real-time Firestore orders listener (only when admin is logged in)
  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: Order[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedOrders.push({
          id: doc.id,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          deliveryMethod: data.deliveryMethod,
          deliveryAddress: data.deliveryAddress,
          paymentMethod: data.paymentMethod,
          items: data.items,
          totalAmount: data.totalAmount,
          status: data.status,
          createdAt: data.createdAt?.toDate() || new Date()
        });
      });
      setOrders(fetchedOrders);
    }, (error) => {
      console.error("Firestore listener error: ", error);
    });

    return () => unsubscribe();
  }, [currentUser, isAdmin]);

  // Real-time Firestore products listener (only when admin is logged in)
  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, 'products'), orderBy('category', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedProducts: Product[] = [];
      snapshot.forEach((doc) => {
        fetchedProducts.push({
          id: doc.id,
          ...doc.data()
        } as Product);
      });
      setProducts(fetchedProducts);
    });

    return () => unsubscribe();
  }, [currentUser, isAdmin]);

  // Seed Firestore if empty
  const handleSeedProducts = async () => {
    if (!isAdmin) return;
    if (confirm("Ви дійсно хочете завантажити початковий каталог (20 товарів) у Firestore?")) {
      try {
        const tempProducts = productsData.slice(0, 20); // Seed 20 items to respect write limits
        for (const prod of tempProducts) {
          const { id, ...prodWithoutId } = prod;
          const typedProd = prodWithoutId as unknown as Product;
          let wPrice = typedProd.wholesalePrice;
          let wMinQty = typedProd.wholesaleMinQty;

          // Automatically add wholesale prices to some items for demonstration
          if (!wPrice && !wMinQty) {
            if (typedProd.sku === 'SW_11' || typedProd.sku === 'SW-11' || typedProd.title.includes('Вафлі')) {
              wPrice = Math.round(typedProd.price * 0.8 * 100) / 100; // 20% discount
              wMinQty = 24; // starting from 24 units
            } else if (typedProd.sku === 'SW_1' || typedProd.sku === 'SW-1' || typedProd.title.includes('Печиво')) {
              wPrice = Math.round(typedProd.price * 0.85 * 100) / 100; // 15% discount
              wMinQty = 10; // starting from 10 units
            }
          }

          const productData = {
            sku: typedProd.sku,
            title: typedProd.title,
            category: typedProd.category,
            price: typedProd.price,
            description: typedProd.description || '',
            image: typedProd.image || '',
            inStock: typedProd.inStock,
            unit: typedProd.unit || 'кг',
            shelfLife: typedProd.shelfLife || '',
            storageConditions: typedProd.storageConditions || '',
            packageWeight: typedProd.packageWeight || '',
            ...(wPrice !== undefined && wPrice !== null ? { wholesalePrice: wPrice } : {}),
            ...(wMinQty !== undefined && wMinQty !== null ? { wholesaleMinQty: wMinQty } : {})
          };
          await setDoc(doc(db, 'products', id), productData);
        }
        localStorage.removeItem('sweet_serh_products_cache');
        alert("Успішно завантажено 20 товарів у Firestore");
      } catch (e) {
        console.error("Error seeding products: ", e);
        alert("Помилка завантаження товарів");
      }
    }
  };

  // Handle order status update in Firestore
  const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
    try {
      const orderDocRef = doc(db, 'orders', orderId);
      await updateDoc(orderDocRef, { status: newStatus });
    } catch (e) {
      console.error("Error updating order status: ", e);
      alert("Не вдалося оновити статус замовлення.");
    }
  };

  // Open product form for creating
  const openCreateForm = () => {
    setEditingProduct(null);
    setSku('SW-' + Math.floor(1000 + Math.random() * 9000));
    setTitle('');
    setCategory(CATEGORIES[0]);
    setPrice(0);
    setDescription('');
    setImage('');
    setInStock(true);
    setUnit('кг');
    setShelfLife('');
    setStorageConditions('');
    setPackageWeight('');
    setWholesalePrice('');
    setWholesaleMinQty('');
    setIsProductFormOpen(true);
  };

  // Open product form for editing
  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    setSku(product.sku);
    setTitle(product.title);
    setCategory(product.category);
    setPrice(product.price);
    setDescription(product.description || '');
    setImage(product.image || '');
    setInStock(product.inStock);
    setUnit(product.unit || 'кг');
    setShelfLife(product.shelfLife || '');
    setStorageConditions(product.storageConditions || '');
    setPackageWeight(product.packageWeight || '');
    setWholesalePrice(product.wholesalePrice !== undefined && product.wholesalePrice !== null ? String(product.wholesalePrice) : '');
    setWholesaleMinQty(product.wholesaleMinQty !== undefined && product.wholesaleMinQty !== null ? String(product.wholesaleMinQty) : '');
    setIsProductFormOpen(true);
  };

  // Handle product add or update
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSavingProduct(true);

    const wPrice = wholesalePrice.trim();
    const wMinQty = wholesaleMinQty.trim();

    const productData = {
      sku,
      title,
      category,
      price: Number(price),
      description: description.trim() || '',
      image: image.trim() || '',
      inStock,
      unit: unit.trim() || 'кг',
      shelfLife: shelfLife.trim() || '',
      storageConditions: storageConditions.trim() || '',
      packageWeight: packageWeight.trim() || '',
      ...(wPrice !== '' ? { wholesalePrice: Number(wPrice) } : {}),
      ...(wMinQty !== '' ? { wholesaleMinQty: Number(wMinQty) } : {})
    };

    try {
      if (editingProduct) {
        // Update
        await setDoc(doc(db, 'products', editingProduct.id), productData);
      } else {
        // Create
        await addDoc(collection(db, 'products'), productData);
      }
      
      // Clear cache so changes reflect instantly
      localStorage.removeItem('sweet_serh_products_cache');
      
      setIsProductFormOpen(false);
      setEditingProduct(null);
    } catch (e) {
      console.error("Error saving product: ", e);
      alert("Не вдалося зберегти зміни товару.");
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Handle product delete
  const handleDeleteProduct = async (productId: string) => {
    if (!isAdmin) return;
    if (confirm("Ви дійсно хочете видалити цей товар з каталогу?")) {
      try {
        await deleteDoc(doc(db, 'products', productId));
        localStorage.removeItem('sweet_serh_products_cache');
      } catch (e) {
        console.error("Error deleting product: ", e);
        alert("Не вдалося видалити товар.");
      }
    }
  };

  // Order editing functions
  const startEditingOrder = (orderId: string, items: CartItem[]) => {
    setEditingOrderId(orderId);
    setEditingItems(JSON.parse(JSON.stringify(items)));
    setProductSearchQuery('');
  };

  const cancelEditingOrder = () => {
    setEditingOrderId(null);
    setEditingItems([]);
    setProductSearchQuery('');
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    setEditingItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], quantity };
      return newItems;
    });
  };

  const removeItemFromOrder = (index: number) => {
    setEditingItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addItemToOrder = (product: Product) => {
    setEditingItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === product.id);
      if (existingIdx > -1) {
        const newItems = [...prev];
        newItems[existingIdx] = {
          ...newItems[existingIdx],
          quantity: newItems[existingIdx].quantity + 1,
        };
        return newItems;
      }
      return [...prev, { product, quantity: 1 }];
    });
    setProductSearchQuery('');
  };

  const saveOrderItems = async (orderId: string) => {
    if (editingItems.length === 0) {
      alert('Замовлення не може бути порожнім. Додайте товари або видаліть замовлення.');
      return;
    }
    const hasInvalidQty = editingItems.some((item) => !item.quantity || item.quantity <= 0);
    if (hasInvalidQty) {
      alert('Будь ласка, вкажіть коректну кількість для всіх товарів (більше 0).');
      return;
    }
    setIsSavingOrder(true);
    try {
      const totalAmount = editingItems.reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0);
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        items: editingItems,
        totalAmount: Math.round(totalAmount * 100) / 100,
      });
      setEditingOrderId(null);
      setEditingItems([]);
    } catch (e) {
      console.error('Error saving edited order items:', e);
      alert('Не вдалося зберегти зміни замовлення.');
    } finally {
      setIsSavingOrder(false);
    }
  };

  if (!isAdmin) {
    /* ADMIN LOGIN PAGE */
    return (
      <>
        <title>Панель керування | sweet-serh-one</title>
        <meta name="robots" content="noindex, nofollow" />
        <section className="admin-section">
          <div className="container admin-login-container">
          <div className="admin-login-card admin-login-card-nomargin">
            <h3>Вхід для адміністратора</h3>
            <p>Увійдіть, щоб керувати замовленнями та каталогом вашого магазину солодощів</p>
            
            {loginError && <div className="login-error-msg">{loginError}</div>}
            
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="admin-email">Email</label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  placeholder="noodlex3m@gmail.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="admin-password">Пароль</label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </div>
              
              <button type="submit" className="btn login-btn admin-login-btn" disabled={isLoggingIn}>
                {isLoggingIn ? 'Вхід...' : 'Увійти'}
              </button>
            </form>
          </div>
        </div>
      </section>
      </>
    );
  }

  return (
    <>
      <title>Панель керування | sweet-serh-one</title>
      <meta name="robots" content="noindex, nofollow" />
      <section className="admin-section">
        <div className="container">
        
        {/* ADMIN TOP BAR */}
        <div className="admin-top-bar">
          <div className="admin-user-info">
            <span>💼 Вхід виконано як: <strong>{currentUser?.email}</strong></span>
          </div>
          <div className="admin-header-actions">
            <button className="btn btn-outline logout-btn" onClick={handleSeedProducts}>
              Seed 20 товарів
            </button>
            <button className="btn btn-outline logout-btn" onClick={logout}>
              Вийти з акаунта
            </button>
          </div>
        </div>

        {/* TABS BUTTONS */}
        <div className="admin-tabs-container">
          <button 
            className={`btn ${activeTab === 'orders' ? '' : 'btn-outline'} admin-tab-btn`} 
            onClick={() => setActiveTab('orders')}
          >
            📋 Замовлення ({orders.length})
          </button>
          <button 
            className={`btn ${activeTab === 'products' ? '' : 'btn-outline'} admin-tab-btn`} 
            onClick={() => setActiveTab('products')}
          >
            🍪 Каталог товарів ({products.length})
          </button>
        </div>

        {activeTab === 'orders' ? (
          /* TAB 1: ORDERS MANAGER */
          <>
            <div className="admin-header">
              <h2 className="section-title">Панель управління замовленнями</h2>
              <p className="section-subtitle">Керування замовленнями в реальному часі через Firebase Firestore</p>
            </div>

            {orders.length > 0 ? (
              <div className="orders-list">
                {orders.map(order => (
                  <div key={order.id} className="order-card">
                    <div className="order-card-header">
                      <div>
                        <span className="order-id">{order.id}</span>
                        {order.items.some(item => getItemPrice(item) < item.product.price) && (
                          <span className="admin-order-wholesale-badge">ОПТ</span>
                        )}
                        <span className="order-date">
                          {new Date(order.createdAt).toLocaleString('uk-UA')}
                        </span>
                      </div>
                      
                      <div className="admin-order-status-row">
                        <span className={`order-status status-${order.status}`}>
                          {order.status === 'new' ? 'Нове' :
                           order.status === 'awaiting_payment' ? 'Очікує оплати' :
                           order.status === 'paid' ? 'Оплачено' :
                           order.status === 'processing' ? 'В роботі' :
                           order.status === 'shipped' ? 'Відправлено' :
                           order.status === 'completed' ? 'Виконано' : 'Скасовано'}
                        </span>
                        <select
                          className="status-select admin-status-select"
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value as Order['status'])}
                        >
                          <option value="new">Нове</option>
                          <option value="awaiting_payment">Очікує оплати</option>
                          <option value="paid">Оплачено</option>
                          <option value="processing">В роботі</option>
                          <option value="shipped">Відправлено</option>
                          <option value="completed">Виконано</option>
                          <option value="cancelled">Скасовано</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="order-card-body">
                      <div className="customer-details">
                        <h4>👨‍💼 Клієнт:</h4>
                        <p><strong>Ім'я:</strong> {order.customerName}</p>
                        <p><strong>Телефон:</strong> {order.customerPhone}</p>
                        <p><strong>Email:</strong> {order.customerEmail || '-'}</p>
                      </div>

                      <div className="delivery-details">
                        <h4>🚚 Доставка:</h4>
                        <p><strong>Спосіб:</strong> {
                          order.deliveryMethod === 'nova_poshta' ? 'Нова Пошта' :
                          order.deliveryMethod === 'ukr_poshta' ? 'Укрпошта' : 'Самовивіз'
                        }</p>
                        <p><strong>Адреса:</strong> {order.deliveryAddress}</p>
                        <p><strong>Оплата:</strong> {
                          order.paymentMethod === 'cash_on_delivery' ? 'При отриманні (післяплата)' : 'Оплата за IBAN'
                        }</p>
                      </div>

                      <div className="order-items">
                        <div className="admin-order-items-header">
                          <h4>🛍️ Товари в замовленні:</h4>
                          {editingOrderId !== order.id && (order.status === 'new' || order.status === 'awaiting_payment') && (
                            <button
                              onClick={() => startEditingOrder(order.id, order.items)}
                              className="btn btn-outline admin-edit-items-btn"
                            >
                              ✏️ Редагувати склад
                            </button>
                          )}
                        </div>

                        {editingOrderId === order.id ? (
                          <>
                            <ul className="admin-editing-items-list">
                              {editingItems.map((item, idx) => (
                                <li key={idx} className="admin-editing-item">
                                  <div className="admin-editing-item-info">
                                    <span className="admin-editing-item-title">{item.product.title}</span>
                                    <span className="admin-editing-item-price">
                                      Ціна: {getItemPrice(item).toFixed(2)} грн / {item.product.unit || 'шт'}
                                      {getItemPrice(item) < item.product.price && (
                                        <span className="admin-editing-item-opt">(ОПТ)</span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="admin-editing-item-qty-wrapper">
                                    <input
                                      type="number"
                                      min="0.001"
                                      step="any"
                                      value={item.quantity === 0 ? '' : item.quantity}
                                      onChange={(e) => updateItemQuantity(idx, parseFloat(e.target.value) || 0)}
                                      className="admin-editing-qty-input"
                                    />
                                    <span className="admin-editing-unit">{item.product.unit || 'шт.'}</span>
                                    <button
                                      onClick={() => removeItemFromOrder(idx)}
                                      className="admin-delete-item-btn"
                                      title="Видалити товар"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>

                            <div className="add-product-wrapper admin-add-item-box">
                              <span className="admin-add-item-title">➕ Додати товар до замовлення:</span>
                              <input
                                type="text"
                                placeholder="Введіть назву для пошуку..."
                                value={productSearchQuery}
                                onChange={(e) => setProductSearchQuery(e.target.value)}
                                className="admin-add-item-search"
                              />
                              {productSearchQuery.trim().length >= 1 && (
                                <div className="search-results-dropdown admin-add-item-dropdown">
                                  {(() => {
                                    const availableProducts = products.length > 0 ? products : (productsData as unknown as Product[]);
                                    const filtered = availableProducts.filter(p => p.title.toLowerCase().includes(productSearchQuery.toLowerCase()));
                                    return (
                                      <>
                                        {filtered.slice(0, 5).map(p => (
                                          <div
                                            key={p.id}
                                            onClick={() => addItemToOrder(p)}
                                            className="search-result-item admin-add-item-dropdown-item"
                                          >
                                            <strong>{p.title}</strong> — {p.price.toFixed(2)} грн / {p.unit || 'шт'}
                                          </div>
                                        ))}
                                        {filtered.length === 0 && (
                                          <div className="admin-dropdown-no-results">
                                            Нічого не знайдено
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                           <ul>
                             {order.items.map((item: CartItem, idx: number) => {
                               const currentPrice = getItemPrice(item);
                               const isWholesale = currentPrice < item.product.price;
                               return (
                                 <li key={idx}>
                                   <span className="item-title">{item.product.title}</span>
                                   <span className="item-qty">
                                     {item.quantity} {item.product.unit || 'шт.'}
                                     <span className="admin-item-badge-detail">
                                       ({currentPrice.toFixed(2)} грн / {item.product.unit || 'шт.'}
                                       {isWholesale && <span className="admin-item-badge-opt">ОПТ</span>})
                                     </span>
                                   </span>
                                   <span className="item-price">{(currentPrice * item.quantity).toFixed(2)} грн</span>
                                 </li>
                               );
                             })}
                           </ul>
                        )}
                      </div>

                      <div className="admin-notes-wrapper admin-notes-section">
                        <h4 className="admin-notes-title">
                          <span>📝</span> Нотатки адміністратора (службові):
                        </h4>
                        <AdminOrderNotes key={order.id + '-' + (order.adminNotes || '')} orderId={order.id} initialNotes={order.adminNotes || ''} />
                      </div>
                    </div>

                     <div className="order-card-footer admin-order-card-footer">
                       {editingOrderId === order.id ? (
                         <>
                            <div>
                              <span className="total-label">Нова сума: </span>
                              <span className="total-val admin-editing-total-val">
                                {editingItems.reduce((sum, item) => sum + (getItemPrice(item) * item.quantity), 0).toFixed(2)} грн
                              </span>
                            </div>
                           <div className="admin-actions-row">
                             <button 
                               className="btn admin-save-order-btn" 
                               onClick={() => saveOrderItems(order.id)}
                               disabled={isSavingOrder}
                             >
                               {isSavingOrder ? 'Збереження...' : '💾 Зберегти'}
                             </button>
                             <button 
                               className="btn btn-outline admin-btn-sm" 
                               onClick={cancelEditingOrder}
                               disabled={isSavingOrder}
                             >
                               Скасувати
                             </button>
                           </div>
                         </>
                       ) : (
                         <>
                           <div>
                             <span className="total-label">Загальна сума: </span>
                             <span className="total-val">{order.totalAmount.toFixed(2)} грн</span>
                           </div>
                           <button 
                             className="btn btn-outline admin-invoice-btn" 
                             onClick={() => window.open(`/order/${order.id}/invoice`, '_blank')}
                           >
                             📄 Рахунок-фактура
                           </button>
                         </>
                       )}
                     </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-orders">
                <span className="no-orders-icon">📂</span>
                <h3>Замовлень ще немає</h3>
                <p>Коли клієнти оформлять замовлення на сайті, вони з'являться тут у реальному часі.</p>
              </div>
            )}
          </>
        ) : (
          /* TAB 2: PRODUCTS CATALOG MANAGER (CRUD) */
          <>
            <div className="admin-catalog-header">
              <div>
                <h2 className="admin-catalog-title">Управління каталогом товарів</h2>
                <p className="admin-catalog-subtitle">Додавання, редагування та видалення солодощів</p>
              </div>
              {!isProductFormOpen && (
                <button className="btn" onClick={openCreateForm}>
                  ＋ Додати товар
                </button>
              )}
            </div>

            {/* PRODUCT EDIT/ADD FORM */}
            {isProductFormOpen && (
              <div className="admin-login-card admin-form-card">
                <h3 className="admin-form-title">
                  {editingProduct ? '📝 Редагувати товар' : '＋ Додати новий товар'}
                </h3>
                <form onSubmit={handleSaveProduct} className="admin-product-form">
                  
                  <div className="form-group">
                    <label htmlFor="prod-sku">Артикул (SKU) *</label>
                    <input id="prod-sku" type="text" required value={sku} onChange={(e) => setSku(e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label htmlFor="prod-title">Назва товару *</label>
                    <input id="prod-title" type="text" required value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label htmlFor="prod-category">Категорія *</label>
                    <select id="prod-category" value={category} onChange={(e) => setCategory(e.target.value)} className="admin-select-input">
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="prod-price">Ціна (UAH) *</label>
                    <input id="prod-price" type="number" required min="0" step="any" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                  </div>

                  <div className="form-group">
                    <label htmlFor="prod-unit">Одиниця виміру *</label>
                    <input id="prod-unit" type="text" required value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="кг, шт, уп, блок тощо" />
                  </div>

                  <div className="form-group">
                    <label htmlFor="prod-package-weight">Вага упаковки / Фасування</label>
                    <input id="prod-package-weight" type="text" value={packageWeight} onChange={(e) => setPackageWeight(e.target.value)} placeholder="наприклад, ящик 1.5 кг" />
                  </div>

                  <div className="form-group">
                    <label htmlFor="prod-shelf-life">Термін зберігання</label>
                    <input id="prod-shelf-life" type="text" value={shelfLife} onChange={(e) => setShelfLife(e.target.value)} placeholder="наприклад, 30 діб, 3 місяці" />
                  </div>

                  <div className="form-group">
                    <label htmlFor="prod-storage">Умови зберігання</label>
                    <input id="prod-storage" type="text" value={storageConditions} onChange={(e) => setStorageConditions(e.target.value)} placeholder="наприклад, від +15°С до +21°С" />
                  </div>

                  <div className="form-group">
                    <label htmlFor="prod-wholesale-price">Гуртова ціна (UAH) <span className="admin-label-note">(порожньо = без опту)</span></label>
                    <input id="prod-wholesale-price" type="number" min="0" step="any" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} placeholder="наприклад, 280.00" />
                  </div>

                  <div className="form-group">
                    <label htmlFor="prod-wholesale-qty">Мін. кількість для гурту <span className="admin-label-note">(порожньо = без опту)</span></label>
                    <input id="prod-wholesale-qty" type="number" min="1" step="1" value={wholesaleMinQty} onChange={(e) => setWholesaleMinQty(e.target.value)} placeholder="наприклад, 24" />
                  </div>

                  <div className="form-group grid-span-2">
                    <label htmlFor="prod-image">Посилання на фото</label>
                    <input id="prod-image" type="text" value={image} onChange={(e) => setImage(e.target.value)} placeholder="необов'язково" />
                  </div>

                  <div className="form-group grid-span-2">
                    <label htmlFor="prod-desc">Опис товару</label>
                    <textarea id="prod-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="необов'язково" className="admin-textarea-input" />
                  </div>

                  <div className="form-group admin-checkbox-row">
                    <input id="prod-stock" type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="admin-checkbox-input" />
                    <label htmlFor="prod-stock" className="admin-checkbox-label">Товар є в наявності</label>
                  </div>

                  <div className="admin-form-actions">
                    <button type="button" className="btn btn-outline" onClick={() => setIsProductFormOpen(false)}>
                      Скасувати
                    </button>
                    <button type="submit" className="btn" disabled={isSavingProduct}>
                      {isSavingProduct ? 'Збереження...' : 'Зберегти'}
                    </button>
                  </div>

                </form>
              </div>
            )}

            {/* PRODUCTS LIST TABLE */}
            {products.length > 0 ? (
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr className="admin-table-header-row">
                      <th>Фото</th>
                      <th>Код (SKU)</th>
                      <th>Назва</th>
                      <th>Категорія</th>
                      <th>Ціна</th>
                      <th>Гуртові умови</th>
                      <th>Од.</th>
                      <th>Характеристики</th>
                      <th>Статус</th>
                      <th style={{ textAlign: 'center' }}>Дії</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(prod => (
                      <tr key={prod.id}>
                        <td>
                          {prod.image && prod.image !== '#' ? (
                            <img src={prod.image} alt={prod.title} className="admin-table-product-img" />
                          ) : (
                            <div className="admin-table-product-placeholder">🍬</div>
                          )}
                        </td>
                        <td className="admin-table-sku-cell">{prod.sku}</td>
                        <td className="admin-table-title-cell">{prod.title}</td>
                        <td className="admin-table-category-cell">{prod.category}</td>
                        <td className="admin-table-price-cell">{prod.price.toFixed(2)} грн</td>
                        <td>
                          {prod.wholesalePrice && prod.wholesaleMinQty ? (
                            <span className="admin-table-wholesale-badge" title="Гуртова ціна та мін. об'єм">
                              {prod.wholesalePrice.toFixed(2)} грн (від {prod.wholesaleMinQty} {prod.unit || 'кг'})
                            </span>
                          ) : (
                            <span className="admin-table-empty-cell">—</span>
                          )}
                        </td>
                        <td className="admin-table-unit-cell">{prod.unit || 'кг'}</td>
                        <td className="admin-table-specs-cell">
                          {prod.packageWeight && <div>📦 {prod.packageWeight}</div>}
                          {prod.shelfLife && <div>⏱️ {prod.shelfLife}</div>}
                          {prod.storageConditions && <div>🌡️ {prod.storageConditions}</div>}
                          {!prod.packageWeight && !prod.shelfLife && !prod.storageConditions && <span>—</span>}
                        </td>
                        <td>
                          <span className={`admin-status-badge ${prod.inStock ? 'in-stock' : 'out-of-stock'}`}>
                            {prod.inStock ? 'Є' : 'Немає'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="admin-actions-row">
                            <button className="btn btn-outline admin-btn-sm" onClick={() => openEditForm(prod)}>
                              Редагувати
                            </button>
                            <button className="btn btn-outline admin-btn-sm admin-delete-product-btn" onClick={() => handleDeleteProduct(prod.id)}>
                              Видалити
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-orders">
                <span className="no-orders-icon">🍪</span>
                <h3>Каталог товарів порожній</h3>
                <p>Натисніть кнопку "Seed 20 товарів" вгорі або додайте товар вручну.</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
    </>
  );
}

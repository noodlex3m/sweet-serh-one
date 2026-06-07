import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, addDoc, deleteDoc, setDoc } from 'firebase/firestore';
import type { Order, Product, CartItem } from '../types';
import productsData from '../data/products.json';

const CATEGORIES = [
  'Печиво та пряники',
  'Кекси та рулети',
  'Вафлі та трубочки',
  'Зефір, мармелад та ірис',
  'Цукерки та шоколад',
  'Святкові та патріотичні солодощі',
  'Подарункові набори та дитячі солодощі'
];

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
    } catch (err: any) {
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
  }, [currentUser]);

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
  }, [currentUser]);

  // Seed Firestore if empty
  const handleSeedProducts = async () => {
    if (!isAdmin) return;
    if (confirm("Ви дійсно хочете завантажити початковий каталог (20 товарів) у Firestore?")) {
      try {
        const tempProducts = productsData.slice(0, 20); // Seed 20 items to respect write limits
        for (const prod of tempProducts) {
          const { id, ...prodWithoutId } = prod;
          await setDoc(doc(db, 'products', id), prodWithoutId);
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
    setImage('https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400');
    setInStock(true);
    setIsProductFormOpen(true);
  };

  // Open product form for editing
  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    setSku(product.sku);
    setTitle(product.title);
    setCategory(product.category);
    setPrice(product.price);
    setDescription(product.description);
    setImage(product.image);
    setInStock(product.inStock);
    setIsProductFormOpen(true);
  };

  // Handle product add or update
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSavingProduct(true);

    const productData = {
      sku,
      title,
      category,
      price: Number(price),
      description,
      image,
      inStock
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

  if (!isAdmin) {
    /* ADMIN LOGIN PAGE */
    return (
      <section className="admin-section" style={{ padding: '60px 0', flexGrow: 1, backgroundColor: 'var(--bg-primary)' }}>
        <div className="container" style={{ maxWidth: '420px', margin: '0 auto' }}>
          <div className="admin-login-card" style={{ margin: '0' }}>
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
              
              <button type="submit" className="btn login-btn" style={{ width: '100%', padding: '12px' }} disabled={isLoggingIn}>
                {isLoggingIn ? 'Вхід...' : 'Увійти'}
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-section" style={{ padding: '60px 0', flexGrow: 1, backgroundColor: 'var(--bg-primary)' }}>
      <div className="container">
        
        {/* ADMIN TOP BAR */}
        <div className="admin-top-bar">
          <div className="admin-user-info">
            <span>💼 Вхід виконано як: <strong>{currentUser?.email}</strong></span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-outline logout-btn" onClick={handleSeedProducts}>
              Seed 20 товарів
            </button>
            <button className="btn btn-outline logout-btn" onClick={logout}>
              Вийти з акаунта
            </button>
          </div>
        </div>

        {/* TABS BUTTONS */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '30px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
          <button 
            className={`btn ${activeTab === 'orders' ? '' : 'btn-outline'}`} 
            onClick={() => setActiveTab('orders')}
            style={{ padding: '10px 20px' }}
          >
            📋 Замовлення ({orders.length})
          </button>
          <button 
            className={`btn ${activeTab === 'products' ? '' : 'btn-outline'}`} 
            onClick={() => setActiveTab('products')}
            style={{ padding: '10px 20px' }}
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
                        <span className="order-date">
                          {new Date(order.createdAt).toLocaleString('uk-UA')}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className={`order-status status-${order.status}`}>
                          {order.status === 'new' ? 'Нове' :
                           order.status === 'processing' ? 'В роботі' :
                           order.status === 'shipped' ? 'Відправлено' :
                           order.status === 'completed' ? 'Виконано' : 'Скасовано'}
                        </span>
                        <select
                          className="status-select"
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value as Order['status'])}
                          style={{ marginLeft: '12px' }}
                        >
                          <option value="new">Нове</option>
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
                        <h4>🛍️ Товари в замовленні:</h4>
                        <ul>
                          {order.items.map((item: CartItem, idx: number) => (
                            <li key={idx}>
                              <span className="item-title">{item.product.title}</span>
                              <span className="item-qty">{item.quantity} шт.</span>
                              <span className="item-price">{(item.product.price * item.quantity).toFixed(2)} грн</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="order-card-footer">
                      <span className="total-label">Загальна сума:</span>
                      <span className="total-val">{order.totalAmount.toFixed(2)} грн</span>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div>
                <h2 style={{ fontSize: '24px', margin: '0 0 6px 0' }}>Управління каталогом товарів</h2>
                <p style={{ color: 'var(--text-muted)', margin: '0' }}>Додавання, редагування та видалення солодощів</p>
              </div>
              {!isProductFormOpen && (
                <button className="btn" onClick={openCreateForm}>
                  ＋ Додати товар
                </button>
              )}
            </div>

            {/* PRODUCT EDIT/ADD FORM */}
            {isProductFormOpen && (
              <div className="admin-login-card" style={{ maxWidth: '100%', margin: '0 0 40px 0', padding: '32px' }}>
                <h3 style={{ textAlign: 'left', marginBottom: '20px' }}>
                  {editingProduct ? '📝 Редагувати товар' : '＋ Додати новий товар'}
                </h3>
                <form onSubmit={handleSaveProduct} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  
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
                    <select id="prod-category" value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)' }}>
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="prod-price">Ціна (UAH) *</label>
                    <input id="prod-price" type="number" required min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label htmlFor="prod-image">Посилання на фото *</label>
                    <input id="prod-image" type="text" required value={image} onChange={(e) => setImage(e.target.value)} />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label htmlFor="prod-desc">Опис товару *</label>
                    <textarea id="prod-desc" required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)', outline: 'none' }} />
                  </div>

                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input id="prod-stock" type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} style={{ width: 'auto' }} />
                    <label htmlFor="prod-stock" style={{ display: 'inline', margin: '0' }}>Товар є в наявності</label>
                  </div>

                  <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
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
              <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-soft)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-light)', backgroundColor: 'rgba(60, 46, 43, 0.02)' }}>
                      <th style={{ padding: '16px' }}>Фото</th>
                      <th style={{ padding: '16px' }}>Код (SKU)</th>
                      <th style={{ padding: '16px' }}>Назва</th>
                      <th style={{ padding: '16px' }}>Категорія</th>
                      <th style={{ padding: '16px' }}>Ціна</th>
                      <th style={{ padding: '16px' }}>Статус</th>
                      <th style={{ padding: '16px', textAlign: 'center' }}>Дії</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(prod => (
                      <tr key={prod.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <img src={prod.image} alt={prod.title} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-light)' }} />
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--accent-berry)' }}>{prod.sku}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '500' }}>{prod.title}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{prod.category}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '700' }}>{prod.price.toFixed(2)} грн</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ 
                            fontSize: '11px', 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            fontWeight: '600', 
                            textTransform: 'uppercase',
                            backgroundColor: prod.inStock ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                            color: prod.inStock ? '#28a745' : '#dc3545',
                            border: prod.inStock ? '1px solid rgba(40, 167, 69, 0.2)' : '1px solid rgba(220, 53, 69, 0.2)'
                          }}>
                            {prod.inStock ? 'Є' : 'Немає'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => openEditForm(prod)}>
                              Редагувати
                            </button>
                            <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px', borderColor: '#dc3545', color: '#dc3545' }} onClick={() => handleDeleteProduct(prod.id)}>
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
                <h3>Каталог порожній</h3>
                <p>Натисніть кнопку "Seed 20 товарів" у верхній панелі, щоб автоматично заповнити каталог початковими товарами з файлу.</p>
              </div>
            )}
          </>
        )}

      </div>
    </section>
  );
}

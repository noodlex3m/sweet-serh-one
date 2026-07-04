import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import type { Order, CartItem } from '../types';
import './Account.css';

interface UserProfile {
  fullName: string;
  phone: string;
  address: string;
  telegram: string;
  viber: string;
  whatsapp: string;
  socialLink: string;
}

export default function Account() {
  const { currentUser, logout } = useAuth();
  
  // Auth states
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Profile states
  const [profile, setProfile] = useState<UserProfile>({
    fullName: '',
    phone: '',
    address: '',
    telegram: '',
    viber: '',
    whatsapp: '',
    socialLink: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'profile' | 'orders'>('profile');

  // Orders states
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Load profile data from Firestore on login
  useEffect(() => {
    const loadProfile = async () => {
      if (!currentUser) return;
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          // If no profile exists yet, initialize with default values
          setProfile({
            fullName: currentUser.displayName || '',
            phone: '',
            address: '',
            telegram: '',
            viber: '',
            whatsapp: '',
            socialLink: ''
          });
        }
      } catch (e) {
        console.error("Error loading user profile: ", e);
      }
    };

    loadProfile();
  }, [currentUser]);

  // Load client's orders from Firestore
  useEffect(() => {
    if (!currentUser || !currentUser.email) return;

    const q = query(
      collection(db, 'orders'),
      where('customerEmail', '==', currentUser.email)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: Order[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedOrders.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        } as unknown as Order);
      });
      // Sort locally by date descending
      fetchedOrders.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      setOrders(fetchedOrders);
      setLoadingOrders(false);
    }, (error) => {
      console.error("Error loading user orders: ", error);
      setLoadingOrders(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Cancel order in Firestore
  const handleCancelOrder = async (orderId: string) => {
    if (confirm("Ви дійсно хочете скасувати це замовлення?")) {
      try {
        const orderDocRef = doc(db, 'orders', orderId);
        await updateDoc(orderDocRef, { status: 'cancelled' });
      } catch (e) {
        console.error("Error cancelling order: ", e);
        alert("Не вдалося скасувати замовлення.");
      }
    }
  };

  // Handle email/password login or registration
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setAuthError('');
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setEmail('');
      setPassword('');
    } catch (err) {
      const firebaseError = err as { code?: string };
      console.error("Auth error: ", err);
      if (firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/invalid-credential') {
        setAuthError('Неправильний email або пароль');
      } else if (firebaseError.code === 'auth/email-already-in-use') {
        setAuthError('Ця електронна адреса вже використовується');
      } else if (firebaseError.code === 'auth/weak-password') {
        setAuthError('Пароль має містити щонайменше 6 символів');
      } else {
        setAuthError('Виникла помилка. Спробуйте пізніше.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Google Sign-in
  const handleGoogleSignIn = async () => {
    setIsProcessing(true);
    setAuthError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      const firebaseError = err as { code?: string };
      console.error("Google Auth error: ", err);
      if (firebaseError.code === 'auth/popup-closed-by-user') {
        setAuthError('Вікно авторизації було закрите');
      } else {
        setAuthError('Не вдалося увійти через Google. Переконайтеся, що цей провайдер увімкнено у Firebase Console.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle profile update form change
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save profile to Firestore
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await setDoc(doc(db, 'users', currentUser.uid), profile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Error saving user profile: ", e);
      alert("Не вдалося зберегти зміни профілю.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <title>Особистий кабінет | sweet-serh-one</title>
      <meta name="robots" content="noindex, nofollow" />
      <section className="account-section">
        <div className="container account-container">
        {!currentUser ? (
          /* AUTHENTICATION FORM */
          <div className="admin-login-card auth-card-wrapper">
            <h3>{isLoginMode ? 'Вхід до особистого кабінету' : 'Реєстрація особистого кабінету'}</h3>
            <p>
              {isLoginMode ? 'Увійдіть для швидкого заповнення даних доставки' : 'Створіть акаунт, щоб зберігати свої дані доставки та зв\'язку'}
            </p>

            {authError && <div className="login-error-msg">{authError}</div>}

            <form onSubmit={handleAuthSubmit}>
              <div className="form-group">
                <label htmlFor="client-email">Email</label>
                <input
                  id="client-email"
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="client-password">Пароль</label>
                <input
                  id="client-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="btn login-btn profile-save-btn" disabled={isProcessing}>
                {isProcessing ? 'Обробка...' : isLoginMode ? 'Увійти' : 'Зареєструватися'}
              </button>
            </form>

            <div className="auth-divider-row">
              <div className="auth-divider-line"></div>
              <span className="auth-divider-text">або</span>
              <div className="auth-divider-line"></div>
            </div>

            <button 
              onClick={handleGoogleSignIn} 
              className="btn btn-outline google-signin-btn" 
              disabled={isProcessing}
            >
              <span>🌐</span> Увійти через Google
            </button>

            <p className="auth-switch-text">
              {isLoginMode ? 'Ще немає акаунта? ' : 'Вже зареєстровані? '}
              <button 
                onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }} 
                className="auth-switch-btn"
              >
                {isLoginMode ? 'Створити акаунт' : 'Увійти'}
              </button>
            </p>
          </div>
        ) : (
          /* USER PROFILE DISPLAY */
          <div className="admin-login-card account-profile-card">
            <div className="account-profile-header">
              <div>
                <span className="account-profile-subtitle">Особистий кабінет</span>
                <h3 className="account-profile-title">{profile.fullName || currentUser.displayName || currentUser.email}</h3>
              </div>
              <button className="btn btn-outline account-logout-btn" onClick={logout}>
                Вийти
              </button>
            </div>

            {/* TAB BUTTONS */}
            <div className="account-tabs">
              <button 
                className={`btn ${activeTab === 'profile' ? '' : 'btn-outline'} account-tab-btn`} 
                onClick={() => setActiveTab('profile')}
              >
                👤 Мої дані
              </button>
              <button 
                className={`btn ${activeTab === 'orders' ? '' : 'btn-outline'} account-tab-btn`} 
                onClick={() => setActiveTab('orders')}
              >
                🛍️ Мої замовлення ({orders.length})
              </button>
            </div>

            {activeTab === 'profile' ? (
              <form onSubmit={handleProfileSave}>
                {saveSuccess && (
                  <div className="profile-success-msg">
                    ✓ Зміни збережено. Дані будуть автоматично підставлятися при покупці.
                  </div>
                )}

                <h4 className="profile-section-title">
                  📋 Особисті дані покупця
                </h4>

                <div className="form-group">
                  <label htmlFor="fullName">ПІБ (Прізвище, Ім'я, По батькові)</label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Ковальчук Сергій Ілліч"
                    value={profile.fullName}
                    onChange={handleProfileChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Контактний телефон</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+380991234567"
                    value={profile.phone}
                    onChange={handleProfileChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="address">Адреса доставки / Відділення Нової Пошти чи Укрпошти</label>
                  <textarea
                    id="address"
                    name="address"
                    rows={2}
                    placeholder="м. Чернівці, Відділення Нової Пошти №3"
                    value={profile.address}
                    onChange={handleProfileChange}
                    className="profile-address-textarea"
                  />
                </div>

                <h4 className="profile-section-title sec-mt">
                  💬 Канали зв'язку та соціальні мережі (необов'язково)
                </h4>

                <div className="form-group">
                  <label htmlFor="telegram">Telegram (нікнейм або номер)</label>
                  <input
                    id="telegram"
                    name="telegram"
                    type="text"
                    placeholder="@username або +380..."
                    value={profile.telegram}
                    onChange={handleProfileChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="viber">Viber (номер телефону)</label>
                  <input
                    id="viber"
                    name="viber"
                    type="text"
                    placeholder="+380..."
                    value={profile.viber}
                    onChange={handleProfileChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="whatsapp">WhatsApp (номер телефону)</label>
                  <input
                    id="whatsapp"
                    name="whatsapp"
                    type="text"
                    placeholder="+380..."
                    value={profile.whatsapp}
                    onChange={handleProfileChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="socialLink">Посилання на соцмережу (Instagram, Facebook тощо)</label>
                  <input
                    id="socialLink"
                    name="socialLink"
                    type="text"
                    placeholder="https://instagram.com/yourprofile"
                    value={profile.socialLink}
                    onChange={handleProfileChange}
                  />
                </div>

                <button type="submit" className="btn profile-save-btn" disabled={isSaving}>
                  {isSaving ? 'Збереження...' : 'Зберегти зміни профілю'}
                </button>
              </form>
            ) : (
              /* TAB: CLIENT ORDERS LIST */
              <div className="client-orders-section">
                <h4 className="profile-section-title">
                  🛍️ Історія ваших замовлень
                </h4>
                
                {loadingOrders ? (
                  <p className="orders-loading-text">Завантаження замовлень...</p>
                ) : orders.length > 0 ? (
                  <div className="orders-list-container">
                    {orders.map(order => (
                      <div key={order.id} className="order-card">
                        <div className="order-card-header">
                          <div>
                            <span className="order-card-id">Замовлення #{order.id.slice(0, 8)}</span>
                            <span className="order-card-date">
                              {new Date(order.createdAt).toLocaleString('uk-UA')}
                            </span>
                          </div>
                          <div className="order-card-header-actions">
                            <span className={`order-status status-${order.status} order-status-badge`}>
                              {order.status === 'new' ? 'Нове' :
                               order.status === 'awaiting_payment' ? 'Очікує оплати' :
                               order.status === 'paid' ? 'Оплачено' :
                               order.status === 'processing' ? 'В роботі' :
                               order.status === 'shipped' ? 'Відправлено' :
                               order.status === 'completed' ? 'Виконано' : 'Скасовано'}
                            </span>
                          </div>
                        </div>

                        <div className="order-card-items-section">
                          <span className="order-card-items-label">Товари:</span>
                          <ul className="order-card-items-list">
                            {order.items?.map((item: CartItem, idx: number) => (
                              <li key={idx} className="order-card-item">
                                <span className="order-card-item-title">{item.product.title}</span>
                                <span className="order-card-item-meta">{item.quantity} шт. × {item.product.price} грн</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {order.adminNotes && (
                          <div className="order-card-notes-box">
                            <span className="order-card-notes-label">📝 Коментар адміністратора:</span>
                            <p className="order-card-notes-content">{order.adminNotes}</p>
                          </div>
                        )}

                        {order.paymentMethod === 'iban' && order.status === 'new' && (
                          <div className="order-card-np-info">
                            ⏳ Менеджер перевіряє наявність товарів на складі. Після підтвердження тут з'явиться офіційний рахунок на оплату (IBAN).
                          </div>
                        )}

                        <div className="order-card-footer">
                          <div>
                            <span className="order-card-total-label">Сума до сплати:</span>
                            <strong className="order-card-total-value">{order.totalAmount.toFixed(2)} грн</strong>
                          </div>
                          <div className="order-card-actions">
                            {order.paymentMethod === 'iban' && order.status === 'awaiting_payment' && (
                              <button 
                                className="btn pdf-invoice-btn" 
                                onClick={() => window.open(`/order/${order.id}/invoice`, '_blank')}
                              >
                                📄 Рахунок на оплату (PDF)
                              </button>
                            )}
                            {order.status === 'new' && (
                              <button 
                                className="btn btn-outline cancel-order-btn" 
                                onClick={() => handleCancelOrder(order.id)}
                              >
                                Скасувати
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-orders-wrapper">
                    <span className="no-orders-icon">🥧</span>
                    <p>Ви ще не робили замовлень.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
    </>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

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
  const [orders, setOrders] = useState<any[]>([]);
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
      const fetchedOrders: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedOrders.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        });
      });
      // Sort locally by date descending
      fetchedOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
    } catch (err: any) {
      console.error("Auth error: ", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setAuthError('Неправильний email або пароль');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('Ця електронна адреса вже використовується');
      } else if (err.code === 'auth/weak-password') {
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
    } catch (err: any) {
      console.error("Google Auth error: ", err);
      if (err.code === 'auth/popup-closed-by-user') {
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
    <section className="account-section" style={{ padding: '60px 0', flexGrow: 1, backgroundColor: 'var(--bg-primary)' }}>
      <div className="container" style={{ maxWidth: '600px', margin: '0 auto' }}>
        {!currentUser ? (
          /* AUTHENTICATION FORM */
          <div className="admin-login-card" style={{ maxWidth: '100%', margin: '0' }}>
            <h3>{isLoginMode ? 'Вхід до особистого кабінету' : 'Реєстрація особистого кабінету'}</h3>
            <p style={{ marginBottom: '24px' }}>
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

              <button type="submit" className="btn login-btn" style={{ width: '100%', padding: '12px' }} disabled={isProcessing}>
                {isProcessing ? 'Обробка...' : isLoginMode ? 'Увійти' : 'Зареєструватися'}
              </button>
            </form>

            <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <div style={{ height: '1px', flexGrow: 1, backgroundColor: 'var(--border-light)' }}></div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>або</span>
              <div style={{ height: '1px', flexGrow: 1, backgroundColor: 'var(--border-light)' }}></div>
            </div>

            <button 
              onClick={handleGoogleSignIn} 
              className="btn btn-outline" 
              style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              disabled={isProcessing}
            >
              <span>🌐</span> Увійти через Google
            </button>

            <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)' }}>
              {isLoginMode ? 'Ще немає акаунта? ' : 'Вже зареєстровані? '}
              <button 
                onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }} 
                style={{ background: 'none', border: 'none', color: 'var(--accent-berry)', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}
              >
                {isLoginMode ? 'Створити акаунт' : 'Увійти'}
              </button>
            </p>
          </div>
        ) : (
          /* USER PROFILE DISPLAY */
          <div className="admin-login-card" style={{ maxWidth: '100%', margin: '0', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Особистий кабінет</span>
                <h3 style={{ margin: '4px 0 0 0', textAlign: 'left', fontSize: '20px' }}>{profile.fullName || currentUser.displayName || currentUser.email}</h3>
              </div>
              <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={logout}>
                Вийти
              </button>
            </div>

            {/* TAB BUTTONS */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
              <button 
                className={`btn ${activeTab === 'profile' ? '' : 'btn-outline'}`} 
                onClick={() => setActiveTab('profile')}
                style={{ padding: '8px 16px', fontSize: '14px' }}
              >
                👤 Мої дані
              </button>
              <button 
                className={`btn ${activeTab === 'orders' ? '' : 'btn-outline'}`} 
                onClick={() => setActiveTab('orders')}
                style={{ padding: '8px 16px', fontSize: '14px' }}
              >
                🛍️ Мої замовлення ({orders.length})
              </button>
            </div>

            {activeTab === 'profile' ? (
              <form onSubmit={handleProfileSave}>
                {saveSuccess && (
                  <div style={{ backgroundColor: 'rgba(40, 167, 69, 0.1)', color: '#28a745', padding: '12px', borderRadius: 'var(--border-radius-sm)', fontSize: '14px', marginBottom: '20px', border: '1px solid rgba(40, 167, 69, 0.2)', textAlign: 'center' }}>
                    ✓ Зміни збережено. Дані будуть автоматично підставлятися при покупці.
                  </div>
                )}

                <h4 style={{ fontSize: '16px', color: 'var(--text-main)', marginBottom: '16px', borderBottom: '1px dashed var(--border-light)', paddingBottom: '6px' }}>
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
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)', outline: 'none' }}
                  />
                </div>

                <h4 style={{ fontSize: '16px', color: 'var(--text-main)', marginTop: '24px', marginBottom: '16px', borderBottom: '1px dashed var(--border-light)', paddingBottom: '6px' }}>
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

                <button type="submit" className="btn" style={{ width: '100%', padding: '12px', marginTop: '12px' }} disabled={isSaving}>
                  {isSaving ? 'Збереження...' : 'Зберегти зміни профілю'}
                </button>
              </form>
            ) : (
              /* TAB: CLIENT ORDERS LIST */
              <div className="client-orders-section">
                <h4 style={{ fontSize: '16px', color: 'var(--text-main)', marginBottom: '16px', borderBottom: '1px dashed var(--border-light)', paddingBottom: '6px' }}>
                  🛍️ Історія ваших замовлень
                </h4>
                
                {loadingOrders ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>Завантаження замовлень...</p>
                ) : orders.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {orders.map(order => (
                      <div key={order.id} className="order-card" style={{ padding: '20px', margin: '0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid var(--border-light)' }}>
                          <div>
                            <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--accent-berry)', display: 'block' }}>Замовлення #{order.id.slice(0, 8)}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {new Date(order.createdAt).toLocaleString('uk-UA')}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className={`order-status status-${order.status}`} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}>
                              {order.status === 'new' ? 'Нове' :
                               order.status === 'processing' ? 'В роботі' :
                               order.status === 'shipped' ? 'Відправлено' :
                               order.status === 'completed' ? 'Виконано' : 'Скасовано'}
                            </span>
                          </div>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Товари:</span>
                          <ul style={{ listStyle: 'none', padding: '0', margin: '0' }}>
                            {order.items?.map((item: any, idx: number) => (
                              <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', color: 'var(--text-main)' }}>
                                <span style={{ fontWeight: '500' }}>{item.product.title}</span>
                                <span style={{ color: 'var(--text-muted)', marginLeft: '12px', textAlign: 'right' }}>{item.quantity} шт. × {item.product.price} грн</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px dashed var(--border-light)' }}>
                          <div>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Сума до сплати:</span>
                            <strong style={{ fontSize: '16px', color: 'var(--accent-berry)', display: 'block' }}>{order.totalAmount.toFixed(2)} грн</strong>
                          </div>
                          {order.status === 'new' && (
                            <button 
                              className="btn btn-outline" 
                              onClick={() => handleCancelOrder(order.id)}
                              style={{ padding: '6px 12px', fontSize: '12px', borderColor: '#dc3545', color: '#dc3545' }}
                            >
                              Скасувати
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>🥧</span>
                    <p style={{ margin: '0' }}>Ви ще не робили замовлень.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
                <h3 style={{ margin: '4px 0 0 0', textAlign: 'left', fontSize: '20px' }}>{currentUser.displayName || currentUser.email}</h3>
              </div>
              <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={logout}>
                Вийти
              </button>
            </div>

            {saveSuccess && (
              <div style={{ backgroundColor: 'rgba(40, 167, 69, 0.1)', color: '#28a745', padding: '12px', borderRadius: 'var(--border-radius-sm)', fontSize: '14px', marginBottom: '20px', border: '1px solid rgba(40, 167, 69, 0.2)', textAlign: 'center' }}>
                ✓ Зміни збережено. Дані будуть автоматично підставлятися при покупці.
              </div>
            )}

            <form onSubmit={handleProfileSave}>
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
          </div>
        )}
      </div>
    </section>
  );
}

import { useState, useEffect } from 'react';
import './DevNotice.css';

export default function DevNotice() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if the user has already dismissed the notice
    const isDismissed = localStorage.getItem('np_dev_notice_dismissed');
    if (!isDismissed) {
      // Show notice after a short delay for a smooth entrance
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('np_dev_notice_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="dev-notice-overlay">
      <div className="dev-notice-card">
        <button className="dev-notice-close-x" onClick={handleDismiss} aria-label="Закрити">
          ✕
        </button>
        <div className="dev-notice-icon">⚙️</div>
        <div className="dev-notice-content">
          <h4>Режим розробки</h4>
          <p>
            Вітаємо на оптово-роздрібному складі солодощів <strong>sweet-serh-one</strong>! Цей сайт зараз знаходиться на етапі активного тестування. 
            Ви можете вільно користуватися каталогом, кошиком та особистим кабінетом, проте реальне відвантаження та доставка замовлень наразі не здійснюються.
          </p>
          <button className="btn dev-notice-btn" onClick={handleDismiss}>
            Зрозуміло
          </button>
        </div>
      </div>
    </div>
  );
}

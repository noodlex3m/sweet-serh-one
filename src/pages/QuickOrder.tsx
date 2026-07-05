import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Product } from '../types';
import { getItemPrice } from '../utils/pricing';
import './QuickOrder.css';

const CATEGORIES = [
  'Печиво та пряники',
  'Кекси та рулети',
  'Вафлі та трубочки',
  'Зефір, мармелад та ірис',
  'Цукерки та шоколад',
  'Святкові та патріотичні солодощі',
  'Подарункові набори та дитячі солодощі'
];

interface QuickOrderProps {
  products: Product[];
  addMultipleToCart: (items: { product: Product; quantity: number }[]) => void;
}

export default function QuickOrder({ products, addMultipleToCart }: QuickOrderProps) {
  const navigate = useNavigate();

  // Search & Category Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Quantities state (maps productId -> quantity value)
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Load saved quantities from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('b2b_order_quantities');
      if (saved) {
        setQuantities(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading saved B2B quantities:', e);
    }
  }, []);

  // Helper to update quantity state and save to sessionStorage
  const updateQuantity = (productId: string, qty: number) => {
    const sanitisedQty = isNaN(qty) || qty < 0 ? 0 : qty;
    
    setQuantities(prev => {
      const updated = { ...prev };
      if (sanitisedQty === 0) {
        delete updated[productId];
      } else {
        updated[productId] = sanitisedQty;
      }
      
      // Sync to sessionStorage
      try {
        sessionStorage.setItem('b2b_order_quantities', JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving B2B quantities:', e);
      }
      
      return updated;
    });
  };

  // Filter products based on search query and category
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = 
        selectedCategory === 'all' || 
        p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Calculate totals and savings based on entered quantities
  const totals = useMemo(() => {
    let totalItems = 0;
    let actualSum = 0;
    let retailSum = 0;

    for (const p of products) {
      const qty = quantities[p.id];
      if (qty && qty > 0) {
        totalItems += 1;
        const appliedPrice = getItemPrice({ product: p, quantity: qty });
        actualSum += appliedPrice * qty;
        retailSum += p.price * qty;
      }
    }

    const savings = retailSum - actualSum;
    return {
      totalItems,
      actualSum: Math.round(actualSum * 100) / 100,
      savings: Math.round(savings * 100) / 100
    };
  }, [products, quantities]);

  // Handle mass addition of items to cart
  const handleAddAllToCart = () => {
    const itemsToAdd = products
      .filter(p => quantities[p.id] && quantities[p.id] > 0)
      .map(p => ({
        product: p,
        quantity: quantities[p.id]
      }));

    if (itemsToAdd.length === 0) return;

    addMultipleToCart(itemsToAdd);

    // Clear state and sessionStorage
    setQuantities({});
    try {
      sessionStorage.removeItem('b2b_order_quantities');
    } catch (e) {
      console.error('Error clearing session B2B quantities:', e);
    }

    // Redirect to home and trigger cart slider open
    navigate('/?openCart=true');
  };

  return (
    <>
      <title>Швидке замовлення B2B | sweet-serh-one</title>
      <meta name="description" content="Таблична форма швидкого замовлення для оптових покупців та торгових агентів" />
      
      <section className="quick-order-section">
        <div className="container">
          
          {/* Header */}
          <div className="quick-order-header">
            <h1 className="quick-order-title">📋 Таблиця швидкого замовлення (B2B)</h1>
            <p className="quick-order-subtitle">Зручний прайс-лист для торгових агентів та гуртових замовників</p>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="quick-order-controls">
            <div className="quick-order-search-box">
              <span className="quick-order-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Пошук товару за назвою або артикулом (SKU)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="quick-order-search-input"
              />
            </div>
            
            <div className="quick-order-categories">
              <button
                className={`category-chip ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                Всі категорії ({products.length})
              </button>
              {CATEGORIES.map(cat => {
                const count = products.filter(p => p.category === cat).length;
                return (
                  <button
                    key={cat}
                    className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid Table */}
          {filteredProducts.length > 0 ? (
            <div className="quick-order-table-container">
              <table className="quick-order-table">
                <thead>
                  <tr>
                    <th className="qo-img-cell">Фото</th>
                    <th>Код (SKU)</th>
                    <th>Назва товару</th>
                    <th>Роздріб</th>
                    <th>Гуртові умови</th>
                    <th style={{ textAlign: 'center' }}>Кількість</th>
                    <th style={{ textAlign: 'right' }}>Разом</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(prod => {
                    const qty = quantities[prod.id] || 0;
                    const subtotal = qty * getItemPrice({ product: prod, quantity: qty });
                    
                    return (
                      <tr key={prod.id}>
                        {/* 1. Image */}
                        <td className="qo-img-cell" data-label="Фото">
                          {prod.image && prod.image !== '#' ? (
                            <img src={prod.image} alt={prod.title} className="qo-product-img" />
                          ) : (
                            <div className="qo-product-placeholder">🍬</div>
                          )}
                        </td>

                        {/* 2. SKU */}
                        <td className="qo-sku-cell" data-label="Код (SKU)">
                          {prod.sku}
                        </td>

                        {/* 3. Title */}
                        <td className="qo-title-cell" data-label="Назва товару">
                          <div className="qo-title-wrapper">
                            <span>{prod.title}</span>
                            {prod.packageWeight && (
                              <span className="qo-package-info">📦 Фасування: {prod.packageWeight}</span>
                            )}
                          </div>
                        </td>

                        {/* 4. Retail Price */}
                        <td className="qo-price-retail" data-label="Роздріб">
                          {prod.price.toFixed(2)} грн / {prod.unit || 'кг'}
                        </td>

                        {/* 5. Wholesale Price */}
                        <td className="qo-price-wholesale" data-label="Гуртові умови">
                          {prod.wholesalePrice && prod.wholesaleMinQty ? (
                            <>
                              {prod.wholesalePrice.toFixed(2)} грн
                              <span className="qo-wholesale-note">від {prod.wholesaleMinQty} {prod.unit || 'кг'}</span>
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>

                        {/* 6. Quantity Input */}
                        <td data-label="Кількість" style={{ display: 'flex', justifyContent: 'center' }}>
                          <div className="qo-qty-control">
                            <button
                              type="button"
                              className="qo-qty-btn"
                              onClick={() => updateQuantity(prod.id, qty - 1)}
                              disabled={qty <= 0}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={qty === 0 ? '' : qty}
                              onChange={(e) => updateQuantity(prod.id, parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className="qo-qty-input"
                            />
                            <button
                              type="button"
                              className="qo-qty-btn"
                              onClick={() => updateQuantity(prod.id, qty + 1)}
                            >
                              +
                            </button>
                          </div>
                        </td>

                        {/* 7. Subtotal */}
                        <td className="qo-subtotal-cell" data-label="Разом" style={{ textAlign: 'right' }}>
                          {qty > 0 ? `${subtotal.toFixed(2)} грн` : '0.00 грн'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-orders" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
              <span className="no-orders-icon">📂</span>
              <h3>Товарів не знайдено</h3>
              <p>Спробуйте змінити фільтр категорій або перевірити пошуковий запит.</p>
            </div>
          )}

        </div>
      </section>

      {/* Floating Bottom Bar (visible when at least 1 item has quantity) */}
      {totals.totalItems > 0 && (
        <div className="qo-bottom-bar">
          <div className="qo-bottom-container">
            <div className="qo-summary-details">
              <div className="qo-summary-item">
                <span className="qo-summary-label">Позицій:</span>
                <span className="qo-summary-value">{totals.totalItems}</span>
              </div>
              
              {totals.savings > 0 && (
                <div className="qo-summary-item">
                  <span className="qo-summary-label">Заощаджено на опті:</span>
                  <span className="qo-summary-value highlight-green">-{totals.savings.toFixed(2)} грн</span>
                </div>
              )}

              <div className="qo-summary-item">
                <span className="qo-summary-label">Сума до сплати:</span>
                <span className="qo-summary-value highlight-berry">{totals.actualSum.toFixed(2)} грн</span>
              </div>
            </div>

            <button 
              onClick={handleAddAllToCart} 
              className="btn qo-add-to-cart-btn"
            >
              🛒 Додати все до кошика ({totals.totalItems})
            </button>
          </div>
        </div>
      )}
    </>
  );
}

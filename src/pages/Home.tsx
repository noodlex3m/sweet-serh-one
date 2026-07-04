import { useState, useMemo } from 'react'
import type { Product } from '../types'
import './Home.css'

interface HomeProps {
  products: Product[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  addToCart: (product: Product) => void;
}

const PRODUCTS_PER_PAGE = 12;

export default function Home({
  products,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  addToCart
}: HomeProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [prevCategory, setPrevCategory] = useState(selectedCategory);
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);

  if (selectedCategory !== prevCategory || searchQuery !== prevSearchQuery) {
    setPrevCategory(selectedCategory);
    setPrevSearchQuery(searchQuery);
    setCurrentPage(1);
  }

  // Lightbox state for product images
  const [activeImage, setActiveImage] = useState<{ url: string; title: string } | null>(null);

  // Get unique categories list
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => cats.add(p.category));
    return ['Всі', ...Array.from(cats)];
  }, [products]);

  // Filtered products list based on search and category
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'Всі' || p.category === selectedCategory;
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Calculate total pages
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);

  // Get products for the current page
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  // Handle page changes
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <title>sweet-serh-one | Оптово-роздрібний склад солодощів</title>
      <meta name="description" content="Великий вибір кондитерських виробів оптом та в роздріб у Чернівцях. Прямі поставки зі складу: свіже печиво, кекси, вафлі, цукерки для вашого магазину чи дому." />

      {/* HERO BANNER */}
      <section className="hero-banner">
        <div className="container hero-grid">
          <div className="hero-content">
            <span className="hero-subtitle">Оптово-роздрібні поставки кондитерських виробів</span>
            <h1 className="hero-title">Справжнє задоволення в кожному шматочку</h1>
            <p className="hero-description">
              Широкий асортимент свіжого печива, ніжних кексів, хрустких вафель та дитячих солодких наборів безпосередньо зі складу в Чернівцях. Надійне партнерство та найкращі умови для вашого бізнесу.
            </p>
            <div className="hero-actions">
              <a href="#catalog" className="btn">Переглянути асортимент</a>
              <button 
                className="btn btn-outline" 
                onClick={() => {
                  setSelectedCategory('Святкові та патріотичні солодощі');
                  document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                🇺🇦 Патріотичні набори
              </button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image-wrapper">
              <img 
                src="/images/hero_sweets.png" 
                alt="Оптово-роздрібний склад солодощів" 
                className="hero-img"
              />
              <div className="floating-badge">
                <span className="badge-title">100%</span>
                <span className="badge-text">Свіжість</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CATALOG SECTION */}
      <section id="catalog" className="catalog-section">
        <div className="container">
          <div className="catalog-header">
            <h2 className="section-title">Наш асортимент солодощів</h2>
            <p className="section-subtitle">Кондитерські вироби високої якості безпосередньо зі складу</p>
            
            {/* Search input */}
            <div className="search-wrapper">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                placeholder="Пошук солодощів за назвою чи артикулом..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>
          </div>

          {/* Horizontal Category Filters */}
          <div className="categories-filter">
            {categories.map(cat => (
              <button
                key={cat}
                className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          {paginatedProducts.length > 0 ? (
            <>
              <div className="product-grid">
                {paginatedProducts.map(product => {
                  const hasImage = product.image && product.image !== '#';
                  return (
                    <article key={product.id} className="product-card">
                      <div 
                        className="product-card-image"
                        onClick={() => {
                          if (hasImage) {
                            setActiveImage({ url: product.image!, title: product.title });
                          }
                        }}
                        style={{ cursor: hasImage ? 'pointer' : 'default' }}
                        title={hasImage ? "Натисніть для збільшення" : undefined}
                      >
                        {hasImage ? (
                          <img src={product.image} alt={product.title} loading="lazy" />
                        ) : (
                          <div className="product-card-image-placeholder">
                            <span className="product-card-image-placeholder-icon">🍬</span>
                            <span className="product-card-image-placeholder-text">Без фото</span>
                          </div>
                        )}
                        <span className="product-sku">Код: {product.sku}</span>
                        {hasImage && <div className="image-zoom-indicator">🔍</div>}
                      </div>
                      <div className="product-card-content">
                        <span className="product-category">{product.category}</span>
                        <h3 className="product-title">{product.title}</h3>
                        {product.description && (
                          <p className="product-description">{product.description}</p>
                        )}
                        
                        {/* B2B Specs Block */}
                        {(product.packageWeight || product.shelfLife || product.storageConditions) && (
                          <div className="product-specs">
                            {product.packageWeight && (
                              <div className="spec-item" title="Вага упаковки / Фасування">
                                <span className="spec-icon">📦</span>
                                <span className="spec-value">{product.packageWeight}</span>
                              </div>
                            )}
                            {product.shelfLife && (
                              <div className="spec-item" title="Термін зберігання">
                                <span className="spec-icon">⏱️</span>
                                <span className="spec-value">{product.shelfLife}</span>
                              </div>
                            )}
                            {product.storageConditions && (
                              <div className="spec-item" title="Умови зберігання">
                                <span className="spec-icon">🌡️</span>
                                <span className="spec-value">{product.storageConditions}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="product-footer product-footer-container">
                          <div className="product-price">
                            <div className="product-price-wrapper">
                              <div>
                                <span className="price-val product-price-value">{product.price.toFixed(2)}</span>
                                <span className="price-currency product-price-unit"> грн/{product.unit || 'кг'}</span>
                              </div>
                              {product.wholesalePrice && product.wholesalePrice > 0 && product.wholesaleMinQty && product.wholesaleMinQty > 0 && (
                                <div className="wholesale-promo-badge">
                                  <span>🏷️ Опт: {product.wholesalePrice.toFixed(2)} грн (від {product.wholesaleMinQty} {product.unit || 'кг'})</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <button 
                            className="btn btn-sm"
                            onClick={() => addToCart(product)}
                            disabled={!product.inStock}
                          >
                            {product.inStock ? '🛒 До кошика' : 'Немає'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button 
                    className="pagination-btn" 
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    ← Назад
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </button>
                  ))}
                  
                  <button 
                    className="pagination-btn" 
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Вперед →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="no-results">
              <span className="no-results-icon">🍪</span>
              <h3>Нічого не знайдено</h3>
              <p>Спробуйте змінити запит пошуку або обрати іншу категорію.</p>
              <button 
                className="btn btn-outline" 
                onClick={() => { setSelectedCategory('Всі'); setSearchQuery(''); }}
              >
                Скинути фільтри
              </button>
            </div>
          )}
        </div>
      </section>

      {/* LIGHTBOX MODAL */}
      {activeImage && (
        <div className="lightbox-backdrop" onClick={() => setActiveImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setActiveImage(null)}>✕</button>
            <img src={activeImage.url} alt={activeImage.title} className="lightbox-img" />
            <div className="lightbox-caption">{activeImage.title}</div>
          </div>
        </div>
      )}
    </>
  );
}

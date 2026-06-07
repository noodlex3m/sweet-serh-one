import { useState, useMemo, useEffect } from 'react'
import type { Product } from '../types'

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

  // Reset page to 1 when filters or search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery]);

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
      {/* HERO BANNER */}
      <section className="hero-banner">
        <div className="container hero-grid">
          <div className="hero-content">
            <span className="hero-subtitle">Солодкі моменти вашого життя</span>
            <h1 className="hero-title">Справжнє задоволення в кожному шматочку</h1>
            <p className="hero-description">
              Широкий асортимент свіжого печива, ніжних кексів, хрустких вафель та дитячих солодких наборів. Обирайте найкраще для своєї родини та друзів.
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
                src="https://images.unsplash.com/photo-1517433456452-f9633a875f6f?w=600&auto=format&fit=crop&q=80" 
                alt="Premium sweets collection" 
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
            <p className="section-subtitle">Свіжа випічка та ласощі прямо з кондитерського цеху</p>
            
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
                {paginatedProducts.map(product => (
                  <article key={product.id} className="product-card">
                    <div 
                      className="product-card-image"
                      onClick={() => setActiveImage({ url: product.image, title: product.title })}
                      title="Натисніть для збільшення"
                    >
                      <img src={product.image} alt={product.title} loading="lazy" />
                      <span className="product-sku">Код: {product.sku}</span>
                      <div className="image-zoom-indicator">🔍</div>
                    </div>
                    <div className="product-card-content">
                      <span className="product-category">{product.category}</span>
                      <h3 className="product-title">{product.title}</h3>
                      <p className="product-description">{product.description}</p>
                      <div className="product-footer">
                        <div className="product-price">
                          <span className="price-val">{product.price.toFixed(2)}</span>
                          <span className="price-currency"> грн</span>
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
                ))}
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

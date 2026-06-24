import { useState, useMemo, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import type { Product, CartItem, Order } from "./types";
import productsData from "./data/products.json";
import "./App.css";
import { db } from "./services/firebase";
import { collection, addDoc, doc, getDoc, getDocs } from "firebase/firestore";
import { useAuth } from "./context/AuthContext";
import { fetchCities, fetchWarehouses } from "./services/novaPoshta";
import type { NovaPoshtaCity, NovaPoshtaWarehouse } from "./services/novaPoshta";

// Import pages
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import Account from "./pages/Account";
import Invoice from "./pages/Invoice";
import DevNotice from "./components/DevNotice";

function App() {
	const { currentUser } = useAuth();
	const location = useLocation();

	// Products list state (loaded from cache / Firestore / JSON)
	const [products, setProducts] = useState<Product[]>([]);

	// Cart state
	const [cart, setCart] = useState<CartItem[]>([]);
	const [isCartOpen, setIsCartOpen] = useState(false);

	// Filter & Search states
	const [selectedCategory, setSelectedCategory] = useState<string>("Всі");
	const [searchQuery, setSearchQuery] = useState<string>("");

	// Checkout Form states
	const [name, setName] = useState("");
	const [phone, setPhone] = useState("");
	const [email, setEmail] = useState("");
	const [deliveryMethod, setDeliveryMethod] = useState<
		"nova_poshta" | "ukr_poshta" | "pickup"
	>("nova_poshta");
	const [address, setAddress] = useState("");
	const [paymentMethod, setPaymentMethod] = useState<
		"cash_on_delivery" | "iban"
	>("cash_on_delivery");

	// Order submission state
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);

	// Nova Poshta states
	const [npCityQuery, setNpCityQuery] = useState("");
	const [npCities, setNpCities] = useState<NovaPoshtaCity[]>([]);
	const [selectedNpCity, setSelectedNpCity] = useState<NovaPoshtaCity | null>(null);
	const [npWarehouses, setNpWarehouses] = useState<NovaPoshtaWarehouse[]>([]);
	const [selectedNpWarehouse, setSelectedNpWarehouse] = useState<NovaPoshtaWarehouse | null>(null);
	const [loadingCities, setLoadingCities] = useState(false);
	const [loadingWarehouses, setLoadingWarehouses] = useState(false);
	const [isNpCitiesDropdownOpen, setIsNpCitiesDropdownOpen] = useState(false);

	// Debounced City search
	useEffect(() => {
		if (npCityQuery.trim().length < 2) {
			return;
		}

		if (selectedNpCity && npCityQuery === selectedNpCity.Description) {
			return;
		}

		const timer = setTimeout(async () => {
			const cities = await fetchCities(npCityQuery);
			setNpCities(cities);
			setIsNpCitiesDropdownOpen(cities.length > 0);
			setLoadingCities(false);
		}, 400);

		return () => clearTimeout(timer);
	}, [npCityQuery, selectedNpCity]);

	// Fetch warehouses when city changes
	useEffect(() => {
		const loadWarehouses = async () => {
			if (!selectedNpCity) {
				setNpWarehouses([]);
				setSelectedNpWarehouse(null);
				return;
			}

			setLoadingWarehouses(true);
			const warehouses = await fetchWarehouses(selectedNpCity.Ref);
			setNpWarehouses(warehouses);
			if (warehouses.length > 0) {
				setSelectedNpWarehouse(warehouses[0]);
			} else {
				setSelectedNpWarehouse(null);
			}
			setLoadingWarehouses(false);
		};

		loadWarehouses();
	}, [selectedNpCity]);

	// Close city suggestions when clicking outside
	useEffect(() => {
		const handleOutsideClick = (e: MouseEvent) => {
			const container = document.querySelector(".np-autocomplete-container");
			if (container && !container.contains(e.target as Node)) {
				setIsNpCitiesDropdownOpen(false);
			}
		};

		document.addEventListener("mousedown", handleOutsideClick);
		return () => document.removeEventListener("mousedown", handleOutsideClick);
	}, []);

	// Load products list (with cache check)
	useEffect(() => {
		const fetchProducts = async () => {
			// 1. Check local storage cache (expires in 1 hour)
			const cachedData = localStorage.getItem("sweet_serh_products_cache");
			const cachedTime = localStorage.getItem("sweet_serh_products_time");
			const oneHour = 60 * 60 * 1000;

			if (
				cachedData &&
				cachedTime &&
				Date.now() - Number(cachedTime) < oneHour
			) {
				try {
					setProducts(JSON.parse(cachedData));
					return;
				} catch (e) {
					console.error("Error parsing cached products: ", e);
				}
			}

			// 2. Fetch from Firestore
			try {
				const querySnapshot = await getDocs(collection(db, "products"));
				const fetchedProducts: Product[] = [];
				querySnapshot.forEach((doc) => {
					fetchedProducts.push({ id: doc.id, ...doc.data() } as Product);
				});

				// 3. Fallback to local JSON if database is empty
				if (fetchedProducts.length === 0) {
					setProducts(productsData as Product[]);
				} else {
					setProducts(fetchedProducts);
					// Store to cache
					localStorage.setItem(
						"sweet_serh_products_cache",
						JSON.stringify(fetchedProducts),
					);
					localStorage.setItem(
						"sweet_serh_products_time",
						Date.now().toString(),
					);
				}
			} catch (e) {
				console.error(
					"Error fetching products from Firestore, falling back to JSON: ",
					e,
				);
				setProducts(productsData as Product[]);
			}
		};

		fetchProducts();
	}, [currentUser, location.pathname]);

	// Prefill checkout details from user profile
	useEffect(() => {
		const fetchUserProfile = async () => {
			if (!currentUser) {
				setName("");
				setPhone("");
				setEmail("");
				setAddress("");
				return;
			}
			try {
				const docRef = doc(db, "users", currentUser.uid);
				const docSnap = await getDoc(docRef);
				if (docSnap.exists()) {
					const profile = docSnap.data();
					if (profile.fullName) setName(profile.fullName);
					if (profile.phone) setPhone(profile.phone);
					if (currentUser.email) setEmail(currentUser.email);
					if (profile.address) setAddress(profile.address);
				} else {
					if (currentUser.email) setEmail(currentUser.email);
					if (currentUser.displayName) setName(currentUser.displayName);
				}
			} catch (e) {
				console.error("Error fetching user profile for checkout: ", e);
			}
		};
		fetchUserProfile();
	}, [currentUser]);

	// Calculate cart totals
	const cartTotals = useMemo(() => {
		const quantity = cart.reduce((acc, item) => acc + item.quantity, 0);
		const amount = cart.reduce(
			(acc, item) => acc + item.product.price * item.quantity,
			0,
		);
		return { quantity, amount };
	}, [cart]);

	// Cart actions
	const addToCart = (product: Product) => {
		setCart((prev) => {
			const existing = prev.find((item) => item.product.id === product.id);
			if (existing) {
				return prev.map((item) =>
					item.product.id === product.id
						? { ...item, quantity: item.quantity + 1 }
						: item,
				);
			}
			return [...prev, { product, quantity: 1 }];
		});
		setIsCartOpen(true);
	};

	const updateQuantity = (productId: string, delta: number) => {
		setCart((prev) => {
			return prev
				.map((item) => {
					if (item.product.id === productId) {
						const newQty = item.quantity + delta;
						return newQty > 0 ? { ...item, quantity: newQty } : null;
					}
					return item;
				})
				.filter(Boolean) as CartItem[];
		});
	};

	const removeFromCart = (productId: string) => {
		setCart((prev) => prev.filter((item) => item.product.id !== productId));
	};

	// Handle Checkout submission to Firestore
	const handleCheckout = async (e: React.FormEvent) => {
		e.preventDefault();
		if (cart.length === 0) return;

		if (deliveryMethod === "nova_poshta" && (!selectedNpCity || !selectedNpWarehouse)) {
			alert("Будь ласка, оберіть місто та відділення Нової Пошти.");
			return;
		}

		setIsSubmitting(true);

		try {
			const finalAddress = deliveryMethod === "nova_poshta"
				? `${selectedNpCity ? selectedNpCity.Description : ""}, ${selectedNpWarehouse ? selectedNpWarehouse.Description : ""}`
				: address;

			const orderData = {
				customerName: name,
				customerPhone: phone,
				customerEmail: email,
				deliveryMethod,
				deliveryAddress: finalAddress,
				paymentMethod,
				items: cart.map((item) => ({
					product: { ...item.product },
					quantity: item.quantity,
				})),
				totalAmount: cartTotals.amount,
				status: "new" as const,
				createdAt: new Date(),
			};

			const docRef = await addDoc(collection(db, "orders"), orderData);

			const newOrder: Order = {
				id: docRef.id,
				...orderData,
			};

			// Trigger Telegram notification asynchronously (don't block checkout completion)
			try {
				fetch("/.netlify/functions/telegram-notify", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ order: newOrder }),
				}).catch((err) => console.error("Async Telegram notification error:", err));
			} catch (e) {
				console.error("Error triggering Telegram notification:", e);
			}

			setSubmittedOrder(newOrder);
			setCart([]);

			// Reset checkout fields (if not logged in, otherwise keep pre-filled profile)
			if (!currentUser) {
				setName("");
				setPhone("");
				setEmail("");
				setAddress("");
			}
			// Reset Nova Poshta selections in either case
			setNpCityQuery("");
			setSelectedNpCity(null);
			setNpCities([]);
			setIsNpCitiesDropdownOpen(false);
			setNpWarehouses([]);
			setSelectedNpWarehouse(null);
		} catch (e) {
			console.error("Error creating order in Firestore: ", e);
			alert(
				"Виникла помилка під час оформлення замовлення. Спробуйте ще раз пізніше.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const isInvoicePage = location.pathname.includes("/invoice");

	return (
		<div className="app-container">
			{/* HEADER */}
			{!isInvoicePage && (
				<header className="site-header">
					<div className="container header-flex">
						<div className="logo-group">
							<span className="logo-icon">🍰</span>
							<div className="logo-text">
								<span className="logo-brand">sweet-serh-one</span>
								<span className="logo-slogan">
									Оптово-роздрібний склад солодощів
								</span>
							</div>
						</div>

						<div className="header-nav">
							<Link
								className={`nav-mode-btn ${location.pathname === "/" ? "active" : ""}`}
								to="/"
							>
								🛍️ Магазин
							</Link>
							<Link
								className={`nav-mode-btn ${location.pathname === "/account" ? "active" : ""}`}
								to="/account"
							>
								👤 Кабінет
							</Link>
							{currentUser?.email === "noodlex3m@gmail.com" && (
								<Link
									className={`nav-mode-btn ${location.pathname === "/admin" ? "active" : ""}`}
									to="/admin"
								>
									💼 Панель замовлень
								</Link>
							)}
						</div>

						<div className="header-actions">
							<button
								className="cart-btn"
								onClick={() => setIsCartOpen(true)}
								aria-label="Open cart"
							>
								<span className="cart-icon">🛒</span>
								<span className="cart-text">Кошик</span>
								{cartTotals.quantity > 0 && (
									<span className="cart-badge">{cartTotals.quantity}</span>
								)}
							</button>
						</div>
					</div>
				</header>
			)}

			{/* ROUTED CONTENT */}
			<Routes>
				<Route
					path="/"
					element={
						<Home
							products={products}
							selectedCategory={selectedCategory}
							setSelectedCategory={setSelectedCategory}
							searchQuery={searchQuery}
							setSearchQuery={setSearchQuery}
							addToCart={addToCart}
						/>
					}
				/>
				<Route path="/admin" element={<Admin />} />
				<Route path="/account" element={<Account />} />
				<Route path="/order/:orderId/invoice" element={<Invoice />} />
			</Routes>

			{/* FOOTER */}
			{!isInvoicePage && (
				<footer className="site-footer">
					<div className="container footer-grid">
						<div className="footer-info">
							<span className="footer-logo">🍰 sweet-serh-one</span>
							<p>
								Оптово-роздрібні поставки свіжих кондитерських виробів безпосередньо зі складу в Чернівцях. Найкращі умови для вашого бізнесу та дому.
							</p>
							<p className="copyright">
								© 2026 sweet-serh-one. Всі права захищено.
							</p>
						</div>
						<div className="footer-links">
							<h4>Категорії</h4>
							<ul>
								<li>
									<Link
										to="/"
										onClick={() => setSelectedCategory("Печиво та пряники")}
									>
										Печиво
									</Link>
								</li>
								<li>
									<Link
										to="/"
										onClick={() => setSelectedCategory("Кекси та рулети")}
									>
										Кекси
									</Link>
								</li>
								<li>
									<Link
										to="/"
										onClick={() => setSelectedCategory("Вафлі та трубочки")}
									>
										Вафлі
									</Link>
								</li>
								<li>
									<Link
										to="/"
										onClick={() => setSelectedCategory("Зефір, мармелад та ірис")}
									>
										Зефір
									</Link>
								</li>
							</ul>
						</div>
						<div className="footer-contacts">
							<h4>Контакти</h4>
							<p>📍 м. Чернівці, Україна</p>
							<p>📧 info@serh.one</p>
							<p>📱 +38 (050) 123-45-67</p>
						</div>
					</div>
				</footer>
			)}

			{/* SHOPPING CART DRAWER */}
			{isCartOpen && (
				<div className="cart-backdrop" onClick={() => setIsCartOpen(false)}>
					<div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
						<div className="cart-drawer-header">
							<h3>Кошик солодощів</h3>
							<button
								className="close-cart-btn"
								onClick={() => setIsCartOpen(false)}
							>
								✕
							</button>
						</div>

						{submittedOrder ? (
							/* Success Order State */
							<div className="success-order">
								<span className="success-icon">🎉</span>
								<h3>Дякуємо за замовлення!</h3>
								<p style={{ marginBottom: '10px' }}>
									Номер вашого замовлення: <strong>{submittedOrder.id.substring(0, 8).toUpperCase()}</strong>
								</p>
								{submittedOrder.paymentMethod === 'iban' ? (
									<div style={{ margin: '15px 0', padding: '12px', background: 'rgba(255, 126, 27, 0.05)', border: '1px dashed rgba(255, 126, 27, 0.3)', borderRadius: '8px', fontSize: '13px', lineHeight: '1.4', color: 'var(--text-main)', textAlign: 'left' }}>
										ℹ️ <strong>Оплата за реквізитами ФОП (IBAN):</strong><br />
										Менеджер складу зараз перевіряє наявність солодощів на складі. Офіційний рахунок для оплати буде виставлено у вашому <strong>Кабінеті</strong> (вкладка «Мої замовлення») відразу після підтвердження.
									</div>
								) : (
									<p>
										Ми зв'яжемося з вами найближчим часом для підтвердження
										доставки.
									</p>
								)}
								<button className="btn" onClick={() => setSubmittedOrder(null)}>
									Продовжити покупки
								</button>
							</div>
						) : cart.length > 0 ? (
							<>
								{/* Cart Items List */}
								<div className="cart-drawer-body">
									<div className="cart-items-list">
										{cart.map((item) => (
											<div key={item.product.id} className="cart-item">
												<img
													src={item.product.image}
													alt={item.product.title}
													className="cart-item-img"
												/>
												<div className="cart-item-details">
													<h4>{item.product.title}</h4>
													<span className="cart-item-price">
														{item.product.price.toFixed(2)} грн
													</span>
													<div className="cart-item-controls">
														<button
															onClick={() =>
																updateQuantity(item.product.id, -1)
															}
														>
															-
														</button>
														<span className="qty">{item.quantity}</span>
														<button
															onClick={() => updateQuantity(item.product.id, 1)}
														>
															+
														</button>
													</div>
												</div>
												<button
													className="remove-item-btn"
													onClick={() => removeFromCart(item.product.id)}
													aria-label="Remove item"
												>
													🗑️
												</button>
											</div>
										))}
									</div>

									{/* Checkout Form */}
									<form onSubmit={handleCheckout} className="checkout-form">
										<h3>Дані доставки</h3>

										<div className="form-group">
											<label htmlFor="client-name">ПІБ *</label>
											<input
												id="client-name"
												type="text"
												required
												placeholder="Ковальчук Сергій Ілліч"
												value={name}
												onChange={(e) => setName(e.target.value)}
											/>
										</div>

										<div className="form-group">
											<label htmlFor="client-phone">Телефон *</label>
											<input
												id="client-phone"
												type="tel"
												required
												placeholder="+380991234567"
												value={phone}
												onChange={(e) => setPhone(e.target.value)}
											/>
										</div>

										<div className="form-group">
											<label htmlFor="client-email">
												Email (необов'язково)
											</label>
											<input
												id="client-email"
												type="email"
												placeholder="your@email.com"
												value={email}
												onChange={(e) => setEmail(e.target.value)}
											/>
										</div>

										<div className="form-group">
											<label htmlFor="delivery-select">Спосіб доставки *</label>
											<select
												id="delivery-select"
												value={deliveryMethod}
												onChange={(e) =>
													setDeliveryMethod(
														e.target.value as
															| "nova_poshta"
															| "ukr_poshta"
															| "pickup",
													)
												}
											>
												<option value="nova_poshta">Нова Пошта</option>
												<option value="ukr_poshta">Укрпошта</option>
												<option value="pickup">Самовивіз (Чернівці)</option>
											</select>
										</div>

										{deliveryMethod === "nova_poshta" ? (
											<>
												<div className="form-group np-autocomplete-container" style={{ position: "relative" }}>
													<label htmlFor="np-city-search">Місто доставки *</label>
													<input
														id="np-city-search"
														type="text"
														required
														placeholder="Наприклад, Чернівці"
														value={npCityQuery}
														onChange={(e) => {
															const val = e.target.value;
															setNpCityQuery(val);
															if (val.trim().length < 2) {
																setNpCities([]);
																setIsNpCitiesDropdownOpen(false);
																setLoadingCities(false);
															} else {
																if (!selectedNpCity || val !== selectedNpCity.Description) {
																	setLoadingCities(true);
																}
															}
															if (selectedNpCity && val !== selectedNpCity.Description) {
																setSelectedNpCity(null);
																setSelectedNpWarehouse(null);
															}
														}}
														onFocus={() => {
															if (npCities.length > 0) {
																setIsNpCitiesDropdownOpen(true);
															}
														}}
														autoComplete="off"
													/>
													{loadingCities && <span className="np-loader" style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>Шукаємо міста...</span>}
													
													{isNpCitiesDropdownOpen && npCities.length > 0 && (
														<ul className="np-suggestions-list" style={{
															position: "absolute",
															top: "100%",
															left: 0,
															right: 0,
															zIndex: 100,
															backgroundColor: "var(--bg-secondary)",
															border: "1px solid var(--border-light)",
															borderRadius: "8px",
															maxHeight: "200px",
															overflowY: "auto",
															boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
															listStyle: "none",
															margin: 0,
															padding: "4px 0"
														}}>
															{npCities.map((city) => (
																<li
																	key={city.Ref}
																	onClick={() => {
																		setSelectedNpCity(city);
																		setNpCityQuery(city.Description);
																		setIsNpCitiesDropdownOpen(false);
																	}}
																	style={{
																		padding: "8px 12px",
																		cursor: "pointer",
         															fontSize: "14px",
																		color: "var(--text-main)",
																		transition: "background-color 0.2s"
																	}}
																	onMouseEnter={(e) => {
																		(e.target as HTMLElement).style.backgroundColor = "var(--bg-primary)";
																	}}
																	onMouseLeave={(e) => {
																		(e.target as HTMLElement).style.backgroundColor = "transparent";
																	}}
																>
																	{city.Description}
																</li>
															))}
														</ul>
													)}
												</div>

												<div className="form-group">
													<label htmlFor="np-warehouse-select">Відділення Нової Пошти *</label>
													{loadingWarehouses ? (
														<select id="np-warehouse-select" disabled>
															<option>Завантаження відділень...</option>
														</select>
													) : (
														<select
															id="np-warehouse-select"
															required
															disabled={!selectedNpCity}
															value={selectedNpWarehouse?.Ref || ""}
															onChange={(e) => {
																const selected = npWarehouses.find(w => w.Ref === e.target.value);
																if (selected) {
																	setSelectedNpWarehouse(selected);
																}
															}}
														>
															{!selectedNpCity && <option value="">Спершу оберіть місто</option>}
															{selectedNpCity && npWarehouses.length === 0 && <option value="">Немає доступних відділень</option>}
															{npWarehouses.map((warehouse) => (
																<option key={warehouse.Ref} value={warehouse.Ref}>
																	{warehouse.Description}
																</option>
															))}
														</select>
													)}
												</div>
											</>
										) : (
											<div className="form-group">
												<label htmlFor="delivery-addr">
													{deliveryMethod === "pickup" ? "Коментар до самовивозу *" : "Адреса доставки *"}
												</label>
												<textarea
													id="delivery-addr"
													required
													rows={2}
													placeholder={
														deliveryMethod === "pickup"
															? "Вкажіть бажаний час самовивозу"
															: "Вкажіть область, місто, вулицю, будинок та квартиру"
													}
													value={address}
													onChange={(e) => setAddress(e.target.value)}
												/>
											</div>
										)}

										<div className="form-group">
											<label htmlFor="payment-select">Спосіб оплати *</label>
											<select
												id="payment-select"
												value={paymentMethod}
												onChange={(e) =>
													setPaymentMethod(
														e.target.value as "cash_on_delivery" | "iban",
													)
												}
											>
												<option value="cash_on_delivery">
													При отриманні (післяплата)
												</option>
												<option value="iban">Оплата за IBAN</option>
											</select>
										</div>

										<div className="cart-totals-summary">
											<div className="totals-row">
												<span>Всього товарів:</span>
												<span>{cartTotals.quantity} шт.</span>
											</div>
											<div className="totals-row grand-total">
												<span>До сплати:</span>
												<span>{cartTotals.amount.toFixed(2)} грн</span>
											</div>
										</div>

										<button
											type="submit"
											className="btn submit-checkout-btn"
											disabled={isSubmitting}
										>
											{isSubmitting
												? "Надсилання..."
												: "🛍️ Підтвердити замовлення"}
										</button>
									</form>
								</div>
							</>
						) : (
							<div className="empty-cart">
								<span className="empty-cart-icon">🥧</span>
								<h3>Кошик порожній</h3>
								<p>
									Оберіть найкращі солодощі у каталозі, щоб зробити замовлення.
								</p>
								<button className="btn" onClick={() => setIsCartOpen(false)}>
									Повернутися до покупок
								</button>
							</div>
						)}
					</div>
				</div>
			)}
			<DevNotice />
		</div>
	);
}

export default App;

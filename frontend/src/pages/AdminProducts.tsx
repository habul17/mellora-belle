import { useState, useEffect } from "react"
import type { ChangeEvent } from "react"
import { Link, Navigate } from "react-router-dom"
import AdminNav from "../components/AdminNav"
import { authFetch, getToken } from "../lib/api"
import { formatPrice } from "../lib/format"
import { sized } from "../lib/images"
import { bySize } from "../lib/products"
import type { Variant } from "../lib/products"
import { DetailsTable, SizeChartTable } from "../components/ProductInfo"

const SIZES = ["S", "M", "L", "XL", "XXL"];

type Category = { id: string; name: string };

type AdminProduct = {
    id: string;
    name: string;
    slug: string;
    description: string;
    details: string;
    sizeChart: string;
    care: string;
    basePrice: number;
    compareAtPrice: number | null;
    weight: number;
    images: string[];
    isActive: boolean;
    category: Category | null;
    variants: Variant[];
};

// What a successful save sends back (an edited or added product, or a new size).
type Saved = { product: AdminProduct; variant: Variant };

// What the form holds: everything as typed, turned into numbers on save.
type Draft = {
    name: string;
    description: string;
    details: string;
    sizeChart: string;
    care: string;
    basePrice: string;
    compareAtPrice: string;
    weight: string;
    color: string;
    images: string;
    isActive: boolean;
    categoryId: string;
    stock: Record<string, string>;
};

function draftOf(product: AdminProduct): Draft {
    return {
        name: product.name,
        description: product.description,
        details: product.details ?? "",
        sizeChart: product.sizeChart ?? "",
        care: product.care ?? "",
        basePrice: String(product.basePrice),
        compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : "",
        weight: String(product.weight),
        color: product.variants[0]?.color ?? "",
        images: product.images.join("\n"),
        isActive: product.isActive,
        categoryId: product.category?.id ?? "",
        stock: {},
    };
}

const emptyDraft = (categoryId: string): Draft => ({
    name: "", description: "", details: "", sizeChart: "", care: "", basePrice: "", compareAtPrice: "", weight: "", color: "",
    images: "", isActive: false, categoryId, stock: {},
});

// A blank box means "not a number" rather than 0, so the server says what's missing.
const toNumber = (value: string) => (value.trim() === "" ? null : Number(value));

function bodyOf(draft: Draft) {
    return {
        name: draft.name,
        description: draft.description,
        details: draft.details,
        sizeChart: draft.sizeChart,
        care: draft.care,
        basePrice: toNumber(draft.basePrice),
        compareAtPrice: toNumber(draft.compareAtPrice),
        weight: toNumber(draft.weight),
        color: draft.color,
        images: draft.images.split("\n").map((line) => line.trim()).filter(Boolean),
        isActive: draft.isActive,
    };
}

function ProductForm({ draft, setDraft, categories, isNew }: {
    draft: Draft;
    setDraft: (update: (prev: Draft) => Draft) => void;
    categories: Category[];
    isNew: boolean;
}) {
    const set = (key: keyof Draft) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = e.target.value;
        setDraft((prev) => ({ ...prev, [key]: value }));
    };
    const photos = draft.images.split("\n").map((line) => line.trim()).filter(Boolean);

    return (
        <div>
            <p>
                <label>Name<br /><input value={draft.name} onChange={set("name")} maxLength={100} size={40} /></label>
            </p>
            {isNew && (
                <p>
                    <label>Category<br />
                        <select value={draft.categoryId} onChange={set("categoryId")}>
                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </label>
                </p>
            )}
            <p>
                <label>Description (a blank line starts a new paragraph)<br />
                    <textarea value={draft.description} onChange={set("description")} rows={8} cols={70} maxLength={5000} />
                </label>
            </p>
            <p>
                <label>Product details: one per line, as Label: Value (for example Fabric: Premium Rayon)<br />
                    <textarea value={draft.details} onChange={set("details")} rows={10} cols={70} maxLength={3000} />
                </label>
            </p>
            {draft.details.trim() && (
                <div style={{ maxWidth: 520, marginBottom: 12 }}>
                    How it will look: <DetailsTable text={draft.details} />
                </div>
            )}
            <p>
                <label>
                    Size chart, in inches: the headings on the first line, then one line per size, with commas
                    between (for example Size, Bust, Waist, Hip, Length and then M, 38, 36, 42, 46)<br />
                    <textarea value={draft.sizeChart} onChange={set("sizeChart")} rows={6} cols={70} maxLength={2000} spellCheck={false} />
                </label>
            </p>
            {draft.sizeChart.trim() && (
                <div style={{ maxWidth: 520, marginBottom: 12 }}>
                    How it will look: <SizeChartTable text={draft.sizeChart} />
                </div>
            )}
            <p>
                <label>Wash care: one step per line<br />
                    <textarea value={draft.care} onChange={set("care")} rows={5} cols={70} maxLength={2000} />
                </label>
            </p>
            <p>
                <label>Price (₹) <input type="number" min={1} value={draft.basePrice} onChange={set("basePrice")} style={{ width: "7em" }} /></label>
                <label>Original price (₹, optional, shown crossed out) <input type="number" min={1} value={draft.compareAtPrice} onChange={set("compareAtPrice")} style={{ width: "7em" }} /></label>
            </p>
            <p>
                <label>Packed weight (grams, sets the shipping charge) <input type="number" min={1} value={draft.weight} onChange={set("weight")} style={{ width: "7em" }} /></label>
                <label>Colour <input value={draft.color} onChange={set("color")} maxLength={50} /></label>
            </p>
            <p>
                <label>Photos: one Cloudinary image link per line, main photo first<br />
                    <textarea value={draft.images} onChange={set("images")} rows={5} cols={90} spellCheck={false} />
                </label>
            </p>
            {photos.length > 0 && (
                <p>
                    {photos.map((url, i) => (
                        <img key={`${i}-${url}`} src={sized(url, 160)} alt={`Photo ${i + 1} (link not working)`} width={80} height={107}
                            style={{ display: "inline-block", objectFit: "cover", marginRight: 6, border: "1px solid #ccc" }} />
                    ))}
                </p>
            )}
            {isNew && (
                <p>
                    Sizes and stock (leave a size blank if you don't sell it):<br />
                    {SIZES.map((size) => (
                        <label key={size}>
                            {size} <input type="number" min={0} value={draft.stock[size] ?? ""} style={{ width: "5em" }}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setDraft((prev) => ({ ...prev, stock: { ...prev.stock, [size]: value } }));
                                }} />
                        </label>
                    ))}
                </p>
            )}
            <p>
                <label>
                    <input type="checkbox" checked={draft.isActive} onChange={(e) => {
                        const checked = e.target.checked;
                        setDraft((prev) => ({ ...prev, isActive: checked }));
                    }} />
                    On sale (shown in the shop)
                </label>
            </p>
        </div>
    );
}

function AdminProducts() {
    const token = getToken();
    const [products, setProducts] = useState<AdminProduct[] | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [message, setMessage] = useState<{ id: string; text: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [newSize, setNewSize] = useState({ size: "", stock: "" });

    useEffect(() => {
        if (!token) return;

        authFetch("/admin/products")
            .then((data) => {
                if (data.products) {
                    setProducts(data.products);
                    setCategories(data.categories ?? []);
                } else setError(data.error ?? "Could not load products");
            })
            .catch(() => setError("Could not reach the server"));
    }, [token]);

    if (!token) return <Navigate to="/admin/login?from=/admin/products" replace />;
    if (error) return <div className="admin">{error}</div>;
    if (!products) return <div className="admin">Loading...</div>;

    function open(id: string, next: Draft) {
        setEditingId(id);
        setDraft(next);
        setMessage(null);
        setNewSize({ size: "", stock: "" });
    }

    function close() {
        setEditingId(null);
        setDraft(null);
    }

    function replace(product: AdminProduct) {
        setProducts((prev) => {
            if (!prev) return prev;
            const rest = prev.filter((p) => p.id !== product.id);
            return [...rest, product].sort((a, b) => a.name.localeCompare(b.name));
        });
    }

    async function send(id: string, path: string, method: string, body: unknown, onDone: (data: Saved) => void) {
        setBusy(true);
        setMessage(null);
        try {
            const data = await authFetch(path, { method, body: JSON.stringify(body) });
            if (data.error) setMessage({ id, text: data.error });
            else onDone(data);
        } catch {
            setMessage({ id, text: "Could not reach the server. Nothing was saved." });
        } finally {
            setBusy(false);
        }
    }

    function saveEdit(product: AdminProduct) {
        if (!draft) return;
        send(product.id, `/admin/products/${product.id}`, "PATCH", bodyOf(draft), (data) => {
            replace(data.product);
            close();
            setMessage({ id: product.id, text: "Saved" });
        });
    }

    function saveNew() {
        if (!draft) return;
        const sizes = SIZES.filter((size) => (draft.stock[size] ?? "").trim() !== "")
            .map((size) => ({ size, stockQuantity: Number(draft.stock[size]) }));
        send("new", "/admin/products", "POST", { ...bodyOf(draft), categoryId: draft.categoryId, sizes }, (data) => {
            replace(data.product);
            close();
            setMessage({ id: data.product.id, text: data.product.isActive ? "Added, and on sale now" : "Added. Tick \"On sale\" when it's ready to sell." });
        });
    }

    function addSize(product: AdminProduct) {
        send(product.id, `/admin/products/${product.id}/sizes`, "POST", { size: newSize.size, stockQuantity: toNumber(newSize.stock) }, (data) => {
            const updated = { ...product, variants: [...product.variants, data.variant] };
            replace(updated);
            setNewSize({ size: "", stock: "" });
            setMessage({ id: product.id, text: `Size ${data.variant.size} added` });
        });
    }

    const note = (id: string) => message?.id === id && <strong> {message.text}</strong>;

    return (
        <main className="admin">
            <AdminNav />
            <h1>Products</h1>
            <p>Changes show in the shop straight away. Stock is set on the Stock page.</p>

            {products.map((product) => {
                const missing = SIZES.filter((size) => !product.variants.some((v) => v.size === size));
                return (
                    <section key={product.id} style={{ borderTop: "1px solid #ccc", paddingTop: 8, marginTop: 8 }}>
                        <h2>{product.name}</h2>
                        <p>
                            {product.isActive ? <>On sale · <Link to={`/products/${product.slug}`}>view in shop</Link></> : "Hidden from the shop"}
                            {" · "}{formatPrice(product.basePrice)}
                            {product.compareAtPrice ? ` (was ${formatPrice(product.compareAtPrice)})` : ""}
                            {" · "}sizes {bySize(product.variants).map((v) => v.size).join(", ")}
                            {" · "}{product.weight} g
                        </p>
                        {editingId === product.id && draft ? (
                            <>
                                <ProductForm draft={draft} setDraft={(update) => setDraft((prev) => prev && update(prev))} categories={categories} isNew={false} />
                                <p>
                                    <button onClick={() => saveEdit(product)} disabled={busy}>Save changes</button>
                                    <button onClick={close} disabled={busy}>Cancel</button>
                                    {note(product.id)}
                                </p>
                                {missing.length > 0 && (
                                    <p>
                                        Add a size:{" "}
                                        <select value={newSize.size} onChange={(e) => setNewSize((prev) => ({ ...prev, size: e.target.value }))}>
                                            <option value="">Size</option>
                                            {missing.map((size) => <option key={size} value={size}>{size}</option>)}
                                        </select>
                                        <label>stock <input type="number" min={0} value={newSize.stock} style={{ width: "5em" }}
                                            onChange={(e) => setNewSize((prev) => ({ ...prev, stock: e.target.value }))} /></label>
                                        <button onClick={() => addSize(product)} disabled={busy || !newSize.size}>Add size</button>
                                    </p>
                                )}
                            </>
                        ) : (
                            <p>
                                <button onClick={() => open(product.id, draftOf(product))}>Edit</button>
                                {note(product.id)}
                            </p>
                        )}
                    </section>
                );
            })}

            <section style={{ borderTop: "1px solid #ccc", paddingTop: 8, marginTop: 8 }}>
                <h2>Add a product</h2>
                {editingId === "new" && draft ? (
                    <>
                        <ProductForm draft={draft} setDraft={(update) => setDraft((prev) => prev && update(prev))} categories={categories} isNew />
                        <p>
                            <button onClick={saveNew} disabled={busy}>Add product</button>
                            <button onClick={close} disabled={busy}>Cancel</button>
                            {note("new")}
                        </p>
                    </>
                ) : (
                    <p>
                        Upload the photos to Cloudinary first, then copy each photo's link.{" "}
                        <button onClick={() => open("new", emptyDraft(categories[0]?.id ?? ""))} disabled={categories.length === 0}>New product</button>
                    </p>
                )}
            </section>
        </main>
    );
}

export default AdminProducts

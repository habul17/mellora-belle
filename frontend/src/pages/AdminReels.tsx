import { useState, useEffect } from "react"
import { Navigate } from "react-router-dom"
import AdminNav from "../components/AdminNav"
import { authFetch, getToken } from "../lib/api"
import { reelCover } from "../lib/reels"

type AdminReel = {
    id: string;
    videoUrl: string;
    instagramUrl: string;
    createdAt: string;
    product: { id: string; name: string; isActive: boolean } | null;
};

type ProductChoice = { id: string; name: string; isActive: boolean };

const emptyForm = { videoUrl: "", instagramUrl: "", productId: "" };

// Only a link that looks like a Cloudinary video gets a cover preview.
const looksLikeVideo = (url: string) => /^https:\/\/res\.cloudinary\.com\/[^/\s]+\/video\/upload\/\S+$/.test(url.trim());

// The reels on the home page ("Shop our reels"). Adding one: upload the
// reel's video to Cloudinary, then paste its link with the reel's Instagram
// link, and choose the product it shows.
function AdminReels() {
    const token = getToken();
    const [reels, setReels] = useState<AdminReel[] | null>(null);
    const [products, setProducts] = useState<ProductChoice[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ id: string; text: string } | null>(null);

    useEffect(() => {
        if (!token) return;

        Promise.all([authFetch("/admin/reels"), authFetch("/admin/products")])
            .then(([reelData, productData]) => {
                if (reelData.reels && productData.products) {
                    setReels(reelData.reels);
                    setProducts(productData.products);
                } else setError(reelData.error ?? productData.error ?? "Could not load reels");
            })
            .catch(() => setError("Could not reach the server"));
    }, [token]);

    if (!token) return <Navigate to="/admin/login?from=/admin/reels" replace />;
    if (error) return <div className="admin">{error}</div>;
    if (!reels) return <div className="admin">Loading...</div>;

    async function addReel() {
        setBusy(true);
        setMessage(null);
        try {
            const data = await authFetch("/admin/reels", {
                method: "POST",
                body: JSON.stringify({ videoUrl: form.videoUrl, instagramUrl: form.instagramUrl, productId: form.productId || null }),
            });
            if (!data.reel) {
                setMessage({ id: "new", text: data.error ?? "Could not add the reel" });
                return;
            }
            setReels((prev) => prev && [data.reel, ...prev]);
            setForm(emptyForm);
            setMessage({ id: "new", text: "Added. It's first on the home page now." });
        } catch {
            setMessage({ id: "new", text: "Could not reach the server. Nothing was saved." });
        } finally {
            setBusy(false);
        }
    }

    async function removeReel(reel: AdminReel) {
        if (!window.confirm("Remove this reel from the home page? It stays on Instagram.")) return;
        setBusy(true);
        setMessage(null);
        try {
            const data = await authFetch(`/admin/reels/${reel.id}`, { method: "DELETE" });
            if (data.deleted) {
                setReels((prev) => prev && prev.filter((r) => r.id !== reel.id));
                setMessage({ id: "list", text: "Removed" });
            } else setMessage({ id: reel.id, text: data.error ?? "Could not remove it" });
        } catch {
            setMessage({ id: reel.id, text: "Could not reach the server. Nothing was changed." });
        } finally {
            setBusy(false);
        }
    }

    const note = (id: string) => message?.id === id && <strong> {message.text}</strong>;
    const set = (key: keyof typeof emptyForm) => (e: { target: { value: string } }) => {
        const value = e.target.value;
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    return (
        <main className="admin">
            <AdminNav />
            <h1>Reels</h1>
            <p>The newest 12 show on the home page, newest first. Removing one here doesn't touch Instagram.</p>

            <section style={{ borderTop: "1px solid #ccc", paddingTop: 8, marginTop: 8 }}>
                <h2>Add a reel</h2>
                <p>Upload the reel's video to Cloudinary first (the file from your phone), then copy its link.</p>
                <p>
                    <label>Video: the Cloudinary video link<br />
                        <input value={form.videoUrl} onChange={set("videoUrl")} size={90} spellCheck={false}
                            placeholder="https://res.cloudinary.com/…/video/upload/…" />
                    </label>
                </p>
                {looksLikeVideo(form.videoUrl) && (
                    <p>
                        Cover:<br />
                        <img src={reelCover(form.videoUrl.trim(), 240)} alt="Cover (link not working)" width={90} height={160}
                            style={{ objectFit: "cover", border: "1px solid #ccc" }} />
                    </p>
                )}
                <p>
                    <label>Instagram: the reel's link (in the app, tap ⋯ or the share button, then Copy link)<br />
                        <input value={form.instagramUrl} onChange={set("instagramUrl")} size={90} spellCheck={false}
                            placeholder="https://www.instagram.com/reel/…" />
                    </label>
                </p>
                <p>
                    <label>Product it shows (for "Shop this")<br />
                        <select value={form.productId} onChange={set("productId")}>
                            <option value="">No product (a reel about the shop)</option>
                            {products.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}{p.isActive ? "" : " (hidden from the shop)"}</option>
                            ))}
                        </select>
                    </label>
                </p>
                <p>
                    <button onClick={addReel} disabled={busy || !form.videoUrl.trim() || !form.instagramUrl.trim()}>Add reel</button>
                    {note("new")}
                </p>
            </section>

            <section style={{ borderTop: "1px solid #ccc", paddingTop: 8, marginTop: 8 }}>
                <h2>On the home page</h2>
                {note("list")}
                {reels.length === 0 ? <p>No reels yet. The home page hides the section until you add one.</p> : (
                    <table>
                        <thead>
                            <tr>
                                <th>Cover</th>
                                <th>Product</th>
                                <th>Instagram</th>
                                <th>Added</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {reels.map((reel, i) => (
                                <tr key={reel.id}>
                                    <td>
                                        <a href={reel.videoUrl} target="_blank" rel="noopener noreferrer">
                                            <img src={reelCover(reel.videoUrl, 120)} alt="Cover (link not working)" width={45} height={80} style={{ objectFit: "cover" }} />
                                        </a>
                                    </td>
                                    <td>{reel.product ? `${reel.product.name}${reel.product.isActive ? "" : " (hidden, so no Shop this)"}` : "None"}</td>
                                    <td><a href={reel.instagramUrl} target="_blank" rel="noopener noreferrer">Open</a></td>
                                    <td>{new Date(reel.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}{i >= 12 ? " (not shown: only the newest 12 are)" : ""}</td>
                                    <td>
                                        <button onClick={() => removeReel(reel)} disabled={busy}>Remove</button>
                                        {note(reel.id)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </main>
    );
}

export default AdminReels

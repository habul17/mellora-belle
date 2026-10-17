import { useEffect, useRef, useState } from "react"
import type { TouchEvent } from "react"
import { Link } from "react-router-dom"
import { Container } from "./ui"
import { ChevronLeft, ChevronRight, CloseIcon, InstagramIcon, PlayIcon, SoundOffIcon, SoundOnIcon } from "./icons"
import { fetchReels, reelCover, reelVideo } from "../lib/reels"
import type { Reel } from "../lib/reels"
import { business } from "../lib/business"
import { formatPrice } from "../lib/format"
import { sized } from "../lib/images"
import { eyebrowClass } from "../lib/styles"

const COVER_WIDTHS = [240, 360, 480, 720];

// "Shop our reels" on the home page: covers in a row that scrolls sideways
// (five across on a computer, two and a bit on a phone). A tap plays the reel
// over the page, with its product and a link to it on Instagram. Only the
// covers load with the page; a video loads when it's opened. Nothing shows
// until the admin adds a reel, or if the server can't be reached.
export function ReelsSection() {
    const [reels, setReels] = useState<Reel[]>([]);
    const [open, setOpen] = useState<number | null>(null);
    const row = useRef<HTMLDivElement>(null);
    const [more, setMore] = useState({ back: false, forward: false });

    useEffect(() => {
        let live = true;
        fetchReels()
            .then((list) => { if (live) setReels(list); })
            .catch(() => { /* the section stays hidden */ });
        return () => { live = false; };
    }, []);

    // The arrows only show when there's more to see that way.
    useEffect(() => {
        const el = row.current;
        if (!el) return;
        const update = () => setMore({
            back: el.scrollLeft > 4,
            forward: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
        });
        update();
        el.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);
        return () => {
            el.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
        };
    }, [reels]);

    if (reels.length === 0) return null;

    const scroll = (direction: number) => {
        const el = row.current;
        el?.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
    };
    const arrow = "absolute top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-ivory text-ink shadow-md transition-colors hover:bg-white sm:flex";

    return (
        <section className="pt-20 sm:pt-28" aria-labelledby="reels-title">
            <Container>
                <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
                    <div>
                        <p className={eyebrowClass}>On Instagram</p>
                        <h2 id="reels-title" className="mt-3 text-4xl sm:text-5xl">Shop our reels</h2>
                    </div>
                    <a href={business.instagram.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-2 border-b border-ink pb-0.5 text-[13px] tracking-[0.16em] uppercase transition-colors hover:border-plum hover:text-plum">
                        <InstagramIcon width={16} height={16} /> Follow {business.instagram.handle}
                    </a>
                </div>

                <div className="relative">
                    {/* On phones the row runs to the screen's edges. A short row
                        sits in the middle (the auto margins), a long one scrolls. */}
                    <div ref={row} className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
                        {reels.map((reel, i) => (
                            <button key={reel.id} type="button" onClick={() => setOpen(i)}
                                aria-label={`Play reel${reel.product ? `: ${reel.product.name}` : ""}`}
                                className="group relative aspect-[9/16] w-[44%] shrink-0 snap-start overflow-hidden bg-sand text-left first:ml-auto last:mr-auto sm:w-[calc((100%-1.5rem)/3)] lg:w-[calc((100%-3rem)/5)]">
                                <img src={reelCover(reel.videoUrl, 480)} srcSet={COVER_WIDTHS.map((w) => `${reelCover(reel.videoUrl, w)} ${w}w`).join(", ")}
                                    sizes="(min-width: 1024px) 210px, (min-width: 640px) 30vw, 44vw" alt="" loading="lazy"
                                    className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                                <span className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-ink/60 to-transparent" aria-hidden="true" />
                                <PlayIcon className="absolute top-3 right-3 text-ivory drop-shadow" width={22} height={22} />
                                {reel.product && (
                                    <span className="absolute inset-x-2 bottom-2 flex items-center gap-2 bg-ink/45 p-1.5 pr-2 text-ivory backdrop-blur-sm">
                                        {reel.product.image && (
                                            <img src={sized(reel.product.image, 96)} alt="" loading="lazy" className="aspect-[3/4] w-8 shrink-0 object-cover sm:w-9" />
                                        )}
                                        <span className="min-w-0">
                                            <span className="line-clamp-2 text-[13px] leading-tight font-medium">{reel.product.name}</span>
                                            <span className="mt-0.5 block text-[12px] leading-tight text-ivory/85">{formatPrice(reel.product.basePrice)}</span>
                                        </span>
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                    {more.back && (
                        <button type="button" onClick={() => scroll(-1)} aria-label="Earlier reels" className={`${arrow} -left-5`}>
                            <ChevronLeft />
                        </button>
                    )}
                    {more.forward && (
                        <button type="button" onClick={() => scroll(1)} aria-label="More reels" className={`${arrow} -right-5`}>
                            <ChevronRight />
                        </button>
                    )}
                </div>
            </Container>

            <ReelPlayer reels={reels} index={open} onChange={setOpen} />
        </section>
    );
}

// The reel over a dark page. Tap the video to pause; arrows, swipes or the
// keyboard's arrow keys move to the next one; Esc, × or the dark area closes.
function ReelPlayer({ reels, index, onChange }: { reels: Reel[]; index: number | null; onChange: (index: number | null) => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const video = useRef<HTMLVideoElement>(null);
    const touchX = useRef<number | null>(null);
    const [paused, setPaused] = useState(false);
    const [muted, setMuted] = useState(false);
    const reel = index === null ? null : reels[index] ?? null;

    // × and the dark area close it here; Esc closes the dialog itself, which
    // then says so (onClose). That "close" comes a moment later, so a reel
    // reopened in between stays open.
    useEffect(() => {
        const d = dialog.current;
        if (!d) return;
        if (index !== null && !d.open) d.showModal();
        if (index === null && d.open) d.close();
    }, [index]);

    // The page behind doesn't scroll while a reel is open.
    const isOpen = index !== null;
    useEffect(() => {
        if (!isOpen) return;
        // Padding where the scrollbar was stops the page jumping sideways.
        const root = document.documentElement;
        const before = { overflow: root.style.overflow, padding: document.body.style.paddingRight };
        const scrollbar = window.innerWidth - root.clientWidth;
        root.style.overflow = "hidden";
        if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
        return () => {
            root.style.overflow = before.overflow;
            document.body.style.paddingRight = before.padding;
        };
    }, [isOpen]);

    // Plays with sound, since a tap opened it. Where the browser still says no
    // (an iPhone in low power mode), it plays muted with the sound button on.
    useEffect(() => {
        const v = video.current;
        if (!v || !reel) return;
        v.muted = muted;
        v.play().catch(() => {
            v.muted = true;
            setMuted(true);
            v.play().catch(() => setPaused(true));
        });
        // Only a new reel restarts playback; the sound button sets v.muted itself.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reel?.id]);

    const go = (step: number) => {
        if (index === null) return;
        const next = index + step;
        if (next >= 0 && next < reels.length) onChange(next);
    };

    function toggleSound() {
        const v = video.current;
        if (!v) return;
        v.muted = !muted;
        setMuted(!muted);
    }

    function togglePlay() {
        const v = video.current;
        if (!v) return;
        if (v.paused) v.play().catch(() => { });
        else v.pause();
    }

    const swipeStart = (e: TouchEvent) => { touchX.current = e.touches[0]?.clientX ?? null; };
    const swipeEnd = (e: TouchEvent) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start === null || end === undefined || Math.abs(end - start) < 50) return;
        go(end < start ? 1 : -1);
    };

    const round = "flex size-11 items-center justify-center rounded-full text-ivory backdrop-blur-sm transition-colors";

    return (
        // A click on the dark area lands on the dialog itself and closes it.
        <dialog ref={dialog} aria-label={reel?.product ? `Reel: ${reel.product.name}` : "Reel"}
            onClose={() => { if (!dialog.current?.open) onChange(null); }}
            onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.backdrop) onChange(null); }}
            onKeyDown={(e) => {
                if (e.key === "ArrowRight") go(1);
                if (e.key === "ArrowLeft") go(-1);
            }}
            className="m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-ivory backdrop:bg-ink/90">
            {reel && (
                <div data-backdrop="1" className="flex h-full flex-col items-center justify-center gap-5 px-4 py-14">
                    <button type="button" onClick={() => onChange(null)} aria-label="Close" className={`${round} absolute top-3 right-3 bg-ivory/15 hover:bg-ivory/30`}>
                        <CloseIcon />
                    </button>

                    <div className="relative">
                        <div className="relative aspect-[9/16] h-[min(76dvh,calc((100vw-2rem)*16/9))] overflow-hidden bg-black"
                            onTouchStart={swipeStart} onTouchEnd={swipeEnd}>
                            <video ref={video} key={reel.id} src={reelVideo(reel.videoUrl)} poster={reelCover(reel.videoUrl, 720)}
                                playsInline loop preload="auto" onClick={togglePlay}
                                onPlay={() => setPaused(false)} onPause={() => setPaused(true)}
                                className="absolute inset-0 size-full cursor-pointer object-cover" />
                            {paused && (
                                <button type="button" onClick={togglePlay} aria-label="Play"
                                    className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink/40 text-ivory backdrop-blur-sm">
                                    <PlayIcon width={30} height={30} />
                                </button>
                            )}
                            <button type="button" onClick={toggleSound} aria-label={muted ? "Turn sound on" : "Turn sound off"}
                                className={`${round} absolute top-3 left-3 bg-ink/35 hover:bg-ink/55`}>
                                {muted ? <SoundOffIcon width={20} height={20} /> : <SoundOnIcon width={20} height={20} />}
                            </button>
                            {reel.product && (
                                <Link to={`/products/${reel.product.slug}`}
                                    className="absolute inset-x-3 bottom-3 flex items-center gap-3 bg-ivory p-2 pr-3 text-ink transition-colors hover:bg-white">
                                    {reel.product.image && (
                                        <img src={sized(reel.product.image, 120)} alt="" className="aspect-[3/4] w-11 shrink-0 object-cover" />
                                    )}
                                    <span className="min-w-0 flex-1">
                                        <span className="line-clamp-2 font-serif text-lg leading-tight">{reel.product.name}</span>
                                        <span className="mt-0.5 block text-sm">{formatPrice(reel.product.basePrice)}</span>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium tracking-[0.16em] uppercase">
                                        Shop <ChevronRight width={16} height={16} />
                                    </span>
                                </Link>
                            )}
                        </div>

                        {index !== null && index > 0 && (
                            <button type="button" onClick={() => go(-1)} aria-label="Previous reel"
                                className={`${round} absolute top-1/2 left-2 -translate-y-1/2 bg-ink/35 hover:bg-ink/55 sm:-left-16 sm:bg-ivory/15 sm:hover:bg-ivory/30`}>
                                <ChevronLeft />
                            </button>
                        )}
                        {index !== null && index < reels.length - 1 && (
                            <button type="button" onClick={() => go(1)} aria-label="Next reel"
                                className={`${round} absolute top-1/2 right-2 -translate-y-1/2 bg-ink/35 hover:bg-ink/55 sm:-right-16 sm:bg-ivory/15 sm:hover:bg-ivory/30`}>
                                <ChevronRight />
                            </button>
                        )}
                    </div>

                    <a href={reel.instagramUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 border-b border-ivory/60 pb-0.5 text-[12px] tracking-[0.16em] uppercase transition-colors hover:border-gold hover:text-gold">
                        <InstagramIcon width={16} height={16} /> View on Instagram
                    </a>
                </div>
            )}
        </dialog>
    );
}

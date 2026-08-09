/**
 * Faqosja e nje liste: vargu i shfaqur, numrat e faqeve dhe kalimi.
 *
 * Numrat jepen ne nje dritare te ngushte rreth faqes ku ndodhemi. Nje
 * rresht me te gjitha faqet do te ishte me i gjate se vete lista sapo
 * te dales viti i dyte i te dhenave, ndaj mbahen pese, plus kercimi te
 * e para dhe te e fundit.
 */

const WINDOW = 5;

function windowOf(current, total) {
    let start = Math.max(1, current - Math.floor(WINDOW / 2));
    const end = Math.min(total, start + WINDOW - 1);
    start = Math.max(1, end - WINDOW + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function Pager({
    page, pages, total, limit, busy = false, onPage, noun = 'rezultate',
}) {
    if (!pages || pages <= 1) return null;

    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    return (
        <div className="pager">
            <span className="muted pager-range">
                {from}–{to} nga {total.toLocaleString('de-DE')} {noun}
            </span>

            <span className="pager-btns">
                <button
                    type="button"
                    className="pager-btn"
                    title="Faqja e parë"
                    disabled={page <= 1 || busy}
                    onClick={() => onPage(1)}
                >
                    «
                </button>
                <button
                    type="button"
                    className="pager-btn"
                    disabled={page <= 1 || busy}
                    onClick={() => onPage(page - 1)}
                >
                    ‹
                </button>

                {windowOf(page, pages).map((n) => (
                    <button
                        key={n}
                        type="button"
                        className={`pager-btn${n === page ? ' active' : ''}`}
                        disabled={busy}
                        onClick={() => onPage(n)}
                    >
                        {n}
                    </button>
                ))}

                <button
                    type="button"
                    className="pager-btn"
                    disabled={page >= pages || busy}
                    onClick={() => onPage(page + 1)}
                >
                    ›
                </button>
                <button
                    type="button"
                    className="pager-btn"
                    title="Faqja e fundit"
                    disabled={page >= pages || busy}
                    onClick={() => onPage(pages)}
                >
                    »
                </button>
            </span>
        </div>
    );
}
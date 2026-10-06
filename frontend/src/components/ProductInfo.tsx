import { parseCare, parseDetails, parseSizeChart } from "../lib/productInfo"

// The size chart as a table, sizes down the side. A row missing a number gets
// a blank cell, so the columns stay lined up.
export function SizeChartTable({ text }: { text: string }) {
    const { head, rows } = parseSizeChart(text);
    if (head.length === 0) return null;

    const columns = Math.max(head.length, ...rows.map((row) => row.length));
    const padded = (cells: string[]) => Array.from({ length: columns }, (_, i) => cells[i] ?? "");

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm tabular-nums">
                <thead>
                    <tr className="border-b border-ink/25">
                        {padded(head).map((cell, i) => (
                            <th key={i} scope="col" className="py-2 pr-3 text-left font-medium text-ink last:pr-0">{cell}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, r) => (
                        <tr key={r} className="border-b border-stone">
                            {padded(row).map((cell, i) => i === 0
                                ? <th key={i} scope="row" className="py-2 pr-3 text-left font-medium text-ink">{cell}</th>
                                : <td key={i} className="py-2 pr-3 last:pr-0">{cell}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// "Label: Value" lines as two columns, then any rows every product has.
export function DetailsTable({ text, extra = [] }: { text: string; extra?: { label: string; value: string }[] }) {
    const rows = [...parseDetails(text), ...extra];
    if (rows.length === 0) return null;

    return (
        <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            {rows.map((row, i) => row.label ? (
                <div key={i} className="contents">
                    <dt className="border-b border-stone py-2 pr-4 text-ink">{row.label}</dt>
                    <dd className="border-b border-stone py-2">{row.value}</dd>
                </div>
            ) : (
                <dd key={i} className="col-span-2 border-b border-stone py-2">{row.value}</dd>
            ))}
        </dl>
    );
}

export function CareList({ text }: { text: string }) {
    const steps = parseCare(text);
    if (steps.length === 0) return null;

    return (
        <ul className="list-disc space-y-1 pl-5">
            {steps.map((step, i) => <li key={i}>{step}</li>)}
        </ul>
    );
}

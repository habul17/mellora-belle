// A product's details, size chart and wash care are plain text the admin
// types on the Products page, one entry per line. These turn that text into
// rows for the product page (and the admin's preview).

function lines(text: string) {
    return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

// "Fabric: Premium Rayon" -> { label: "Fabric", value: "Premium Rayon" }.
// A line without a label shows on its own.
export function parseDetails(text: string) {
    return lines(text).map((line) => {
        const colon = line.indexOf(":");
        return colon > 0
            ? { label: line.slice(0, colon).trim(), value: line.slice(colon + 1).trim() }
            : { label: "", value: line };
    });
}

// The first line is the headings ("Size, Bust, Waist, Hip, Length"), then
// one line per size ("M, 38, 36, 42, 46"). Commas, tabs or "|" split the
// columns; a line with none of those splits on spaces, as pasted from a
// document ("M 38 36 42 46").
export function parseSizeChart(text: string) {
    const [head = [], ...rows] = lines(text).map((line) =>
        line.split(/[,|\t]/.test(line) ? /\s*[,|\t]\s*/ : /\s+/).filter(Boolean));
    return { head, rows };
}

// One step per line. Bullets pasted from a document ("•", "-", "*") go.
export function parseCare(text: string) {
    return lines(text).map((line) => line.replace(/^[•·\-*\s]+/, "")).filter(Boolean);
}

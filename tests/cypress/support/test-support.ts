export function cleanFromHTML(html: string) : string {
    // Get rid of the zero-width spaces which occur in the HTML:
    return html.replace("\u200B", "");
}

export function getDefaultStrypeProjectDocumentationFullLine(mode: string): string {
    return (mode == "microbit") 
        ? "'''This is the default Strype starter project for micro:bit'''\n"
        : "'''This is the default Strype starter project'''\n";
}
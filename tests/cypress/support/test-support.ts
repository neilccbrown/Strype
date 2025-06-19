export function cleanFromHTML(html: string) : string {
    // Get rid of the zero-width spaces which occur in the HTML:
    return html.replace("\u200B", "");
}

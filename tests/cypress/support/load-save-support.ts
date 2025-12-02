import i18n from "@/i18n";
import path from "path";

export function checkDownloadedFileEquals(strypeElIds: {[varName: string]: (...args: any[]) => string}, fullContent: string, filename: string, firstSave?: boolean) : void {
    const downloadsFolder = Cypress.config("downloadsFolder");
    const destFile = path.join(downloadsFolder, filename);
    cy.task("deleteFile", destFile);
    // Save is located in the menu, so we need to open it first, then find the link and click on it
    // Force these because sometimes cypress gives false alarm about webpack overlay being on top:
    cy.get("button#" + strypeElIds.getEditorMenuUID()).click({force: true});
    // Note we use the ID because cy.contains is awkward when "Save" and "Save as" begin the same.
    cy.get("#saveStrypeProjLink").click({force: true});
    if (firstSave) {
        // For testing, we always want to save to this device:
        cy.contains(i18n.t("appMessage.targetFS") as string).click({force: true});
        cy.contains(i18n.t("OK") as string).click({force: true});
    }

    cy.readFile(destFile).then((p : string) => {
        // Print out full version in message (without escaped \n), to make it easier to diff:
        expect(p, "Actual unescaped:\n" + p).to.equal(fullContent.replaceAll("\r\n", "\n"));
    });
}

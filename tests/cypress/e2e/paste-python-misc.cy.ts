require("cypress-terminal-report/src/installLogsCollector")();
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();

import "../support/paste-test-support"; // Adds the paste command we use
import { focusEditorAndClear } from "../support/paste-test-support";

describe("Check empty slots after paste", () => {
    it("Should not set non-required empty slots to white after paste", () => {
        // Delete existing:
        focusEditorAndClear();
        
        (cy.get("body") as any).paste("inv = {\"apples\":5, \"oranges\":3}");
        cy.wait(1000);

        // Now no slots should have a "white" (actually: 255,255,255,0.6) background:
        const forbiddenStyle = /background-color:\s*rgba\(255,\s*255,\s*255,\s*0\.6\)\s*!important/i;

        cy.get("span.code-slot").each(($el) => {
            const style = $el.attr("style") || "";

            expect(style, "Element: " + $el.attr("id")).not.to.match(forbiddenStyle);
        });
    });
});

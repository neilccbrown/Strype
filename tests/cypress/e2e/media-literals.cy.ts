// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();
// eslint-disable-next-line @typescript-eslint/no-var-requires
import {PNG} from "pngjs";
import pixelmatch from "pixelmatch";
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();


// Must clear all local storage between tests to reset the state:
beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit("/",  {onBeforeLoad: (win) => {
        win.localStorage.clear();
        win.sessionStorage.clear();
    }});
});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
Cypress.Commands.add("paste",
    {prevSubject : true},
    ($element, data : string | Buffer, type : string) => {
        const clipboardData = new DataTransfer();
        if (typeof data === "string") {
            clipboardData.setData(type, data);
        }
        else {
            const file = new File([new Blob([new Uint8Array(data)], {type: type})], "anon", { type: type });
            clipboardData.items.add(file);
        }
        
        const pasteEvent = new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData,
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        cy.get($element).then(() => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            $element[0].dispatchEvent(pasteEvent);
        });
    });

function focusEditorPasteAndClear(): void {
    // Not totally sure why this hack is necessary, I think it's to give focus into the webpage via an initial click:
    // (on the main code container frame -- would be better to retrieve it properly but the file won't compile if we use Apps.ts and/or the store)
    cy.get("#frame_id_-3").focus();
    // Delete existing content (bit of a hack):
    cy.get("body").type("{uparrow}{uparrow}{uparrow}{del}{downarrow}{downarrow}{downarrow}{downarrow}{backspace}{backspace}");
}

enum ImageComparison {
    COMPARE_TO_EXISTING,
    // If we want to set a new expected image after a change in the code, you can pass
    // this value but you should not commit this because it effectively stops the test
    // from ever being able to fail.  So if you see a committed use of this as a parameter,
    // reject the commit!
    WRITE_NEW_EXPECTED_DO_NOT_COMMIT_USE_OF_THIS
}

// This code uses an image capture of the graphics canvas to check that the Python code
// produces the same output as before, to check for us breaking something. 
//
// There are some cypress plugins which do roughly the same thing.  The problem is that they
// use generic browser screenshotting to capture the content.  It turns out that, at least on Mac,
// browser screenshotting can transform color spaces.  This means that the screenshot taken on Mac
// can be noticeably different than on Linux, which is a problem if (like me) you write a test on Mac
// then try to run again on Linux and compare the output to the Mac output.  For example, rendering
// #ff0000 squares on Mac once screenshotted can become e.g. #ff2300, which is a high enough difference
// to fail the test.
//
// So we write our own which reads the pixel data direct from the graphics canvas, avoiding any
// transformation.  Unfortunately this means we also have to write our own code to save the images etc
function checkImageMatch(expectedImageFileName: string, actual : PNG, comparison: ImageComparison) {
    if (comparison == ImageComparison.COMPARE_TO_EXISTING) {
        cy.readFile(`tests/cypress/expected-screenshots/baseline/${expectedImageFileName}.png`, "base64").then((expectedData) => {
            // load both pictures
            const expected = PNG.sync.read(Buffer.from(expectedData, "base64"));
            cy.writeFile(`tests/cypress/expected-screenshots/comparison/${expectedImageFileName}.png`, PNG.sync.write(actual));

            const {width, height} = expected;
            const diff = new PNG({width, height});

            // calling pixelmatch return how many pixels are different
            const numDiffPixels = pixelmatch(expected.data, actual.data, diff.data, width, height, {threshold: 0.05});

            cy.writeFile(`tests/cypress/expected-screenshots/diff/${expectedImageFileName}.png`, PNG.sync.write(diff));

            // calculating a percent diff
            const diffPercent = (numDiffPixels / (width * height) * 100);

            expect(diffPercent).to.be.below(10);
        });
    }
    else {
        // Just save to expected:
        cy.writeFile(`tests/cypress/expected-screenshots/baseline/${expectedImageFileName}.png`, PNG.sync.write(actual));
    }
}

// but it's not very long:
function checkGraphicsCanvasContent(expectedImageFileName : string, comparison = ImageComparison.COMPARE_TO_EXISTING) {
    cy.get("#pythonGraphicsCanvas").then((canvas) => {
        return (canvas[0] as HTMLCanvasElement).toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
    }).then((actualImageBase64) => {
        const actual = PNG.sync.read(Buffer.from(actualImageBase64, "base64"));
        checkImageMatch(expectedImageFileName, actual, comparison);
    });
}

function checkConsoleContent(expectedContent : string) {
    cy.get("#pythonConsole").should("have.value", expectedContent);
}

function enterImports() {
    cy.get("body").type("{uparrow}{uparrow}");
    (cy.get("body") as any).paste("from strype.graphics import *\nfrom strype.sound import *\nfrom time import sleep\nimport math\n", "text");
    cy.wait(2000);
    cy.get("body").type("{downarrow}{downarrow}");
}
function executeCode(switchToGraphics = true) {
    if (switchToGraphics) {
        cy.contains("a", "\uD83D\uDC22 Graphics").click();
    }
    cy.get("#runButton").contains("Run");
    cy.get("#runButton").click();
    // Wait for it to finish:
    cy.wait(2000);
    // Assert it has finished, by looking at the run button:
    cy.get("#runButton").contains("Run");
}

describe("Paste image literals", () => {
    if (Cypress.env("mode") == "microbit") {
        // Graphics tests can't run in microbit
        return;
    }
    
    it("Paste and show image", () => {
        cy.readFile("public/graphics_images/cat-test.jpg", null).then((catJPEG) => {
            focusEditorPasteAndClear();
            enterImports();
            cy.get("body").type(" Actor(");
            cy.wait(1000);
            (cy.focused() as any).paste(catJPEG, "image/jpeg");
            cy.wait(1000);
            executeCode();
            checkGraphicsCanvasContent("paste-and-show");
        });
    });

    it("Can call method on pasted image", () => {
        cy.readFile("public/graphics_images/cat-test.jpg", null).then((catJPEG) => {
            focusEditorPasteAndClear();
            enterImports();
            cy.get("body").type(" set_background(");
            cy.wait(1000);
            (cy.focused() as any).paste(catJPEG, "image/jpeg");
            cy.wait(1000);
            // A yellowy-greeny colour from his eye:
            cy.get("body").type(".get_pixel(270, 150");
            executeCode();
            checkGraphicsCanvasContent("paste-and-color-pick");
        });
    });

    it("Can delete pasted image with backspace", () => {
        cy.readFile("public/graphics_images/cat-test.jpg", null).then((catJPEG) => {
            focusEditorPasteAndClear();
            enterImports();
            cy.get("body").type(" set_background(");
            cy.wait(1000);
            (cy.focused() as any).paste(catJPEG, "image/jpeg");
            cy.wait(1000);
            // Delete the image and write "red" instead:
            cy.get("body").type("{backspace}\"red");
            executeCode();
            checkGraphicsCanvasContent("paste-and-backspace");
        });
    });

    it("Can delete pasted image with delete", () => {
        cy.readFile("public/graphics_images/cat-test.jpg", null).then((catJPEG) => {
            focusEditorPasteAndClear();
            enterImports();
            cy.get("body").type(" set_background(");
            cy.wait(1000);
            (cy.focused() as any).paste(catJPEG, "image/jpeg");
            cy.wait(1000);
            // Delete the image and write "red" instead:
            cy.get("body").type("{leftarrow}{del}\"red");
            executeCode();
            checkGraphicsCanvasContent("paste-and-delete");
        });
    });

    it("Can delete and retype operator after pasted image", () => {
        cy.readFile("public/graphics_images/cat-test.jpg", null).then((catJPEG) => {
            focusEditorPasteAndClear();
            enterImports();
            cy.get("body").type(" set_background(");
            cy.wait(1000);
            (cy.focused() as any).paste(catJPEG, "image/jpeg");
            cy.wait(1000);
            // A yellowy-greeny colour from his eye:
            cy.get("body").type(".get_pixel(270,150");
            for (let i = 0; i < ".get_pixel(270,150".length; i++) {
                cy.get("body").type("{leftarrow}");
            }
            cy.wait(1000);
            cy.get("body").type("{del}");
            cy.wait(1000);
            cy.get("body").type(".");
            executeCode();
            checkGraphicsCanvasContent("paste-and-color-pick-with-delete");
        });
    });

    it("Can paste image in existing slot", () => {
        cy.readFile("public/graphics_images/cat-test.jpg", null).then((catJPEG) => {
            focusEditorPasteAndClear();
            enterImports();
            cy.get("body").type(" set_background(dontget_pixel(270,150");
            cy.wait(1000);
            // Then we go back to between "dont" and "get":
            for (let i = 0; i < "get_pixel(270,150".length; i++) {
                cy.get("body").type("{leftarrow}");
            }
            // Then we paste:
            (cy.focused() as any).paste(catJPEG, "image/jpeg");
            cy.wait(1000);
            // Then we type a dot:
            cy.get("body").type(".");
            // Then we go back to before the image and delete the "dont":
            cy.get("body").type("{leftarrow}{leftarrow}{backspace}{backspace}{backspace}{backspace}");
            cy.wait(1000);
            
            executeCode();
            checkGraphicsCanvasContent("paste-in-text");
        });
    });
    
    // TODO check the downloaded Python file (and check for double data: item) (and ideally re-load the images as images from the .py)
});

describe("Paste sound literals", () => {
    if (Cypress.env("mode") == "microbit") {
        // Graphics tests can't run in microbit
        return;
    }

    it("Paste and show preview", () => {
        cy.readFile("public/sounds/cat-test-meow.wav", null).then((catWAV) => {
            focusEditorPasteAndClear();
            enterImports();
            // No point playing the sound as we can't test that, but at least check the preview shows up:
            cy.get("body").type("=s=");
            cy.wait(1000);
            (cy.focused() as any).paste(catWAV, "audio/wav");
            cy.wait(1000);
            // We can also check that a sample is fetched correctly:
            cy.get("body").type("{downarrow}=sa=s.copy_to_mono().get_samples(){downarrow}psa[int(len(sa)/2)]");
            executeCode(false);
            checkConsoleContent("0.001913396408781409\n");
        });
    });
});

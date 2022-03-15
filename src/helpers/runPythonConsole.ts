// refs: http://skulpt.org/using.html#html and for the input/event part https://stackoverflow.com/questions/43733896/wait-for-an-event-to-occur-within-a-function-in-javascript-for-skulpt

// Declation of JS objects required for using Skulpt:
// the output HTML object, a text area in our case. Declared globally in the script for ease of usage
// a Sk object that is FROM THE SKULPT LIBRARY, it is the main entry point of Skulpt
let consoleTextArea: HTMLTextAreaElement = {} as HTMLTextAreaElement; 
declare const Sk: any;

// The function used for "output" from Skulpt, to be registered against the Skulpt object
function outf(text: string) { 
    consoleTextArea.value = consoleTextArea.value + text; 
}

// The function used for "input" from Skulpt, to be registered against the Skulpt object
// (not to clear on its role exactly, that's from their example case)
function builtinRead(x: any) {
    if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined) {
        throw "File not found: '" + x + "'";
    }
    return Sk.builtinFiles["files"][x];
}

// The function used for "transpiling" the input function of Python ot some JS handled by Skupt.
// THe function is to be registered against the Skulpt object.
function sInput(prompt: string) {
    // the function returns a promise to give a result back later...
    return new Promise(function(resolve,reject){
        outf(prompt) 
        // make the text area enabled to allow the user to type something (if it was disabled)
        const isConsoleTextAreaLocked = consoleTextArea.disabled;
        if(isConsoleTextAreaLocked){
            consoleTextArea.disabled = false
            // set the text caret to the end of the prompt
            consoleTextArea.focus();
        }

        const initialConsoleTextAreaCaretPos = consoleTextArea.selectionStart;

        function consoleKeyListener(event: KeyboardEvent){
            const eventKeyLowerCase = event.key.toLowerCase()
            // monitor a key hit on "enter" to validate input
            if (eventKeyLowerCase == "enter") {
                // remove keyup handler from #console
                consoleTextArea.removeEventListener("keydown", consoleKeyListener)
                // resolve the promise with the value of the input field
                const inputText = consoleTextArea.value.substring(initialConsoleTextAreaCaretPos);
                // add a line return to the console after we have retrieved the input text from user
                outf("\n");
                // restore the textare disable status if required
                if(isConsoleTextAreaLocked){
                    consoleTextArea.disabled = true;
                }
                // cancel the event (we are doing a line return ourselves anyway)
                event.stopImmediatePropagation();
                event.preventDefault();
                // now we can return the promise with the input text
                resolve(inputText);                
                return;
            }
            
            // monitor where the keyboard input is on the output textarea: we cannot edit anything that is not after the prompt
            // so before the prompt we only allow the direction arrow keys and some key combinations
            if(consoleTextArea.selectionStart < initialConsoleTextAreaCaretPos
                && !(eventKeyLowerCase.startsWith("arrow") 
                    || (event.ctrlKey || event.metaKey) && (["C","Z","Y"].includes(eventKeyLowerCase)))) {
                // we can't have a caret move further back, we break the event loop
                event.stopImmediatePropagation();
                event.preventDefault();
            }
            else if (eventKeyLowerCase=="backspace" && consoleTextArea.selectionStart == initialConsoleTextAreaCaretPos){
                // forbid delete text with backspace from the input start position
                event.stopImmediatePropagation();
                event.preventDefault();
            }
        }

        consoleTextArea.addEventListener("keydown", consoleKeyListener)
    })
}

// Entry point function for running Python code with Skulpt - the UI is responsible for calling it,
// and providing the code (usually, user defined code) and the text area to display the output
export function runPythonConsole(aConsoleTextArea: HTMLTextAreaElement, userCode: string){
    consoleTextArea = aConsoleTextArea;
    consoleTextArea.innerHTML = ""; 
    Sk.pre = consoleTextArea.id;
    Sk.configure({output:outf, read:builtinRead, inputfun:sInput, inputfunTakesPrompt: true});
    const myPromise = Sk.misceval.asyncToPromise(function() {
        return Sk.importMainWithBody("<stdin>", false, userCode, true);
    });
    // Show error in console (for debugging) if error happens
    myPromise.then(() => {
        return
    },
    (err: any) => {
        console.log("Error from Skulpt " + err.toString());
    });
}
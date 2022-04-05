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
// (this is the default behaviour that can be overwritten if needed)
function builtinRead(x: any) {
    if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined) {
        throw "File not found: '" + x + "'";
    }
    return Sk.builtinFiles["files"][x];
}

// The function used for "transpiling" the input function of Python to some JS handled by Skulpt.
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

        let initialConsoleTextAreaCaretPos = consoleTextArea.selectionStart;
        let compositionStartSelectStart = -1, compositionStartSelectEnd = -1; // this is used for dealing with composition, cf. below

        function consoleCompositionListener(event: CompositionEvent){
            // Listened to handle the problem with IMEs: when used, they trigger text writing even if the key events prevent default behaviour.
            // So the approach to deal with it is to keep them anywhere, but if they appear in some parts of the console that shouldn't be edited
            // then we just update the flag of the input point of entry (initialConsoleTextAreaCaretPos)
            if(event.type.toLocaleLowerCase() === "compositionstart"){
                // Keep indicators of the selection when the composition occurs, in case there is a full portion of text replaced
                compositionStartSelectStart = consoleTextArea.selectionStart;
                compositionStartSelectEnd = consoleTextArea.selectionEnd;
            }
            else {
                // Compute the new position of the input point of entry when the composition is done, if it was performed within the non editable part
                // of the textarea (it might then overshoot the initial position if users selected, but at this stage we can't do much...)
                if(compositionStartSelectEnd < initialConsoleTextAreaCaretPos){
                    const addedTextFromIME = event.data;
                    initialConsoleTextAreaCaretPos = initialConsoleTextAreaCaretPos - ( compositionStartSelectEnd - compositionStartSelectStart) + addedTextFromIME.length;
                }               
            }
        }

        function consoleKeyListener(event: KeyboardEvent){
            const eventKeyLowerCase = event.key.toLowerCase()
            // monitor a key hit on "enter" to validate input
            if (eventKeyLowerCase == "enter") {
                // remove keyup handler from #console
                consoleTextArea.removeEventListener("keydown", consoleKeyListener)
                consoleTextArea.removeEventListener("compositionstart", consoleCompositionListener)
                consoleTextArea.removeEventListener("compositionend", consoleCompositionListener)
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
                    || ((event.ctrlKey || event.metaKey) && (["c","z","y"].includes(eventKeyLowerCase))))) {
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
        consoleTextArea.addEventListener("compositionstart", consoleCompositionListener)
        consoleTextArea.addEventListener("compositionend", consoleCompositionListener)

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
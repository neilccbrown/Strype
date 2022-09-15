// We only use this for a GUI detail at the moment, so it's safe to mock it as doing nothing:
global.MutationObserver = class {
    constructor(callback) {}
    disconnect() {}
    observe(element, initObject) {}
};

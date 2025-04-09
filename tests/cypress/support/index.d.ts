// TS definitions used in our tests with Cypress
declare namespace Cypress {
    interface Chainable {
      // Used to share the Strype HTML IDs and CSS class names
      // shared from the app for the tests (see support files).
      initialiseSupportStrypeGlobals(): Chainable<void>;
    }
  }
  
<img src="public/favicon.png" width="64" align="left">

# Strype

Strype is a frame-based editor for Python that runs entirely in the browser, designed for use in secondary schools.  You can learn more and use the free public release at <a href="https://strype.org/">strype.org</a>. 

Strype is maintained by Michael Kölling and the K-PET group at King's College London, alongside their other tools, BlueJ and Greenfoot.

License
---

This repository contains the source code for Strype, licensed under the AGPLv3 (see [LICENSE.txt](LICENSE.txt)).  You can use and modify the code according to that license, but be aware that the Strype name, logo, and other visual assets belong to the Strype team.

Building and running
---

Strype is a <a href="https://v2.vuejs.org/">Vue 2</a> project (upgrading to Vue 3 is planned for 2025) that uses NPM as its core tool.  To build you will first need to install <a href="https://nodejs.org/en">Node.js</a> (or <a href="https://docs.npmjs.com/downloading-and-installing-node-js-and-npm">another method</a>) to get NPM.

Then, to run a local test version you can run the following commands in the top level of the checked out repository:

```
npm install
npm run serve:python
```

If you want to create a packaged version to distribute or host somewhere, run:

```
npm run build
```

Strype is currently an entirely client-side tool; there is no server component to run alongside.

Development
---

To work on the project, you can use a variety of tools: our team members use <a href="https://code.visualstudio.com/">VS Code</a> or <a href="https://www.jetbrains.com/webstorm/">Webstorm</a>.  To run the full test suite (which takes around 50 minutes) you can run:

```
npm test:cypress
```

To speed up the tests locally, we can target specific tests by editing package.json to run only the files of interest (**when doing so, remember not to commit the changes!**).
For example, adding the ```--spec``` argument like in this example:
```
"cy:run:microbit": "cypress run --env mode=microbit --spec tests/cypress/e2e/autocomplete.cy.ts",
"cy:run:python": "cypress run --env mode=python --spec tests/cypress/e2e/autocomplete.cy.ts",
```

You can also change the relevant ```describe``` function call in the test file into ```describe.only``` to only run that test in the file. Be aware that it will silently turns off all the other tests!  **Do not commit this change, either!**

The tests and linter are run automatically in Github actions and they should always pass before changes are merged in.  You can run the linter manually with:

```
npm run lint:check
```


Contributing
---

We readily accept pull requests for translations or bug fixes.  If you plan to add an entirely new feature or noticeably change existing behaviour we advise you to get in contact with us first, as we are likely to refuse any pull requests which are not part of our plan for Strype.  Our experience is that one of the important features for novice tools is their simplicity, which is achieved by being very conservative in which features we choose to add.

Roadmap
---

Strype is currently under very active development.  A rough roadmap of some major planned features (beyond the general bugfixing and polishing):

 - Improved editor features (including copy-as-image): Q4 2024
 - Add class frames (for object-oriented programming): Q1 2025
 - Add a graphics and sound API: Q1 2025
 - Add support for third-party library import: Q2 2025
 - Add support for data processing and/or charting: Q3 2025

The dates and choices may change as we receive more user feedback.

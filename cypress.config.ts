import { defineConfig } from "cypress"
import {rm} from "fs";

export default defineConfig({
    downloadsFolder: "tests/cypress/downloads",
    fixturesFolder:	"tests/cypress/fixtures",
    screenshotsFolder: "tests/cypress/screenshots",
    supportFolder: "tests/cypress/support",
    videosFolder: "tests/cypress/videos",
    video: true,
    e2e: {
        experimentalMemoryManagement: true,
        specPattern: "tests/cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
        supportFile: false,
        // Inspired by https://docs.cypress.io/api/plugins/configuration-api#Usage
        setupNodeEvents(on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) {
            require('cypress-terminal-report/src/installLogsPrinter')(on, {defaultTrimLength: 5000});

            on("task", {
                deleteFile(filePath) {
                    console.log("deleting file %s", filePath)

                    return new Promise((resolve, reject) => {
                        rm(filePath, {maxRetries: 10}, (err) => {
                            if (err && !err.message.startsWith("ENOENT")) {
                                console.error(err)
                                return reject(err)
                            }
                            resolve(null)
                        })
                    })
                },
            })
            // Allow logging to console (although only the first message seems to get logged?)
            on('task', {
                log (message) {
                    console.log(message) 
                    return null
                }
            })
            
            config.baseUrl = config.env.mode == "microbit" ? "http://localhost:8081/microbit/" : "http://localhost:8081/editor/"
            return config
        },
    },
})

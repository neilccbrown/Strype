import { PiniaVuePlugin, createPinia } from "pinia"
import { createLocalVue, mount, Wrapper, WrapperArray } from "@vue/test-utils"
import App from "../App.vue"
import i18n from "../i18n"
import { expect } from "chai"

function testApp() {
    const localVue = createLocalVue()
    localVue.use(PiniaVuePlugin)
    const wrapper = mount(App, {
        localVue,
        i18n,
        pinia: createPinia(),
    })
    return wrapper
}

function checkTextIs(ws: WrapperArray<any>, expecteds : string[]) {
    expect(ws.length).to.equal(expecteds.length)
    for (let i = 0; i < ws.length; i++) {
        expect(ws.at(i).text()).to.equal(expecteds[i])
    }
}

/**
 * Gets all the text from the labels and fields in a frame and glues
 * it together into one string.
 * @param w A wrapper representing a .frameDiv element
 */
function getFrameText(w : Wrapper<any, any>) {
    const parts = w.findAll("input,.frameColouredLabel")
    let s = ""
    for (let i = 0; i < parts.length; i++) {
        const p = parts.at(i)
        if (p.element instanceof HTMLInputElement) {
            s += (p.element as HTMLInputElement).value
        }
        else {
            s += p.element.textContent
        }
    }
    return s
}

describe("App.vue Basic Test", () => {
    it("has correct frame containers", () => {
        const wrapper = testApp()

        // check that the sections are present and correct:
        const headers = wrapper.findAll(".frame-container-label-span")
        checkTextIs(headers, ["Imports:", "Function definitions:", "My code:"])
    })
    it("translates correctly", async () => {
        const wrapper = testApp()

        // Starts as English:
        expect((wrapper.get("select#appLangSelect").element as HTMLSelectElement).value).to.equal("en")

        // Swap to French and check it worked:
        await wrapper.get("button#showHideMenu").trigger("click")
        await wrapper.get("select#appLangSelect").setValue("fr")
        expect((wrapper.get("select#appLangSelect").element as HTMLSelectElement).value).to.equal("fr")

        // check that the sections are present and translated:
        const headers = wrapper.findAll(".frame-container-label-span")
        checkTextIs(headers, ["Imports :", "Définitions de fonctions :", "Mon code :"])
    })
    it("has correct default state", async () => {
        const wrapper = testApp()

        expect(getFrameText(wrapper.get("#frame_id_1"))).to.equal("myString ⇐ \"Hello from Python!\"")
    })
})

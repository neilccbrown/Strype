import {StateObjects}  from "@/types/types";
import longStateExample from "@/store/initial-states/long-state-example";
import initialTestState from "@/store/initial-states/initial-test-state";
import emptyState from "@/store/initial-states/empty-state";
import initialDemoState from "@/store/initial-states/initial-demo-state";
import initialPythonState from "@/store/initial-states/initial-python-state";
import initialMicrobitState from "@/store/initial-states/initial-microbit-state";

const initialStates: StateObjects = {

    "usabilityEvalState": {
        debugging: false,
        initialState: emptyState,
        showKeystroke: true,
        nextAvailableId: 1,
    },

    "demoState": {
        debugging: false,
        initialState: initialDemoState,
        showKeystroke: true,
        nextAvailableId: 5,
    },

    "debugging": {
        debugging: true,
        initialState: initialTestState,
        showKeystroke: true,
        nextAvailableId: 8, 
    },

    "longDemoState": {
        debugging: false,
        initialState: longStateExample,
        showKeystroke: false,
        nextAvailableId: 18,
    },

    "initialPythonState": {
        debugging: false,
        initialState: initialPythonState,
        showKeystroke: true,
        nextAvailableId: 3,
    },

    "initialMicrobitState": {
        debugging: false,
        initialState: initialMicrobitState,
        showKeystroke: true,
        nextAvailableId: 3,
    },


};

export default initialStates;



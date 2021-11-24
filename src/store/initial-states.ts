import {StateObjects}  from "@/types/types";
import longStateExample from "@/store/long-state-example";
import initialTestState from "@/store/initial-test-state";
import emptyState from "@/store/empty-state";
import initialDemoState from "@/store/initial-demo-state";

const initialStates: StateObjects = {

    "usabilityEvalState": {
        debugging: false,
        initialState: emptyState,
        frameMap:[-1,-2,-3] as number[],
        showKeystroke: true,
    },

    "demoState": {
        debugging: false,
        initialState: initialDemoState,
        frameMap: [-1,1,-2,-3,2,3,4] as number[],
        showKeystroke: false,
    },

    "debugging": {
        debugging: true,
        initialState: initialTestState,
        frameMap: [-1,-2,-3,1,2,3,4,5,6,7] as number[],
        showKeystroke: true,
    },

    "longDemoState": {
        debugging: false,
        initialState: longStateExample,
        frameMap: [-1,1,2,-2,-3,3,4,5,6,7,8,9,10,11,14,15,12,16,13,17] as number[],
        showKeystroke: false,
    },



};

export default initialStates;



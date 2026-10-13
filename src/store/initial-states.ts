import { StateAppObjects }  from "@/types/types";
import emptyState from "@/store/initial-states/empty-state";
import initialPythonState from "@/store/initial-states/initial-python-state";
import initialMicrobitState from "@/store/initial-states/initial-microbit-state";

const initialStates: StateAppObjects = {
    
    "initialEmptyState": {
        debugging: false,
        initialState: emptyState,
        showKeystroke: false,
        nextAvailableId: 1,
    },

    "initialPythonState": {
        debugging: false,
        initialState: initialPythonState,
        showKeystroke: false,
        nextAvailableId: 7, // frames 1 to 6 are used by the starter project (including test_main in Testing)
    },

    "initialMicrobitState": {
        debugging: false,
        initialState: initialMicrobitState,
        showKeystroke: false,
        nextAvailableId: 4,
    },


};

export default initialStates;



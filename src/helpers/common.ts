import {ObjectPropertyDiff} from "@/types/types"

//Function to get the difference between two states (properties) of an object.
//It takes the two objects as arguments and returns a list of differences. 
//Each entry of the result contains :
//  propertyPath --> the path of the object properties (. separated)
//  value        --> the value of the difference (null if deletion, actual value if addition or update)

const findDiffDeep = (obj1: {[id: string]: any}, obj2: {[id: string]: any}, result: ObjectPropertyDiff[], path: string) => {
    const pathSeparator = (path.length > 0) ? "." : "";

    for(const obj1property in obj1) {
        const obj1value = obj1[obj1property]
     
        //if property exists in obj2, check recursive difference if value is of type object
        //or check the difference of value and remove from obj2 anyway if value isn't of type object
        if(obj2[obj1property] !== undefined){
            //call recursive checking only if BOTH entries are of type object
            if(typeof obj1value === "object" && typeof obj2[obj1property] === "object"){
                findDiffDeep(obj1value, obj2[obj1property], result, path + pathSeparator + obj1property);
            }
            else {
                if(obj2[obj1property] !== obj1value){
                    result.push({propertyPath: (path + pathSeparator + obj1property), value: obj2[obj1property] });
                }
                delete obj2[obj1property];
            }
        }
        //else it's a deletion from obj1, put "null" value in the result
        else{
            result.push({propertyPath: (path + pathSeparator + obj1property),value: null });
        }
    }
} 

export const checkAddedValues = (obj: {[id: string]: any}, result: ObjectPropertyDiff[], path: string) => {
    const pathSeparator = (path.length > 0) ? "." : "";
    
    for(const objProperty in obj){
        const objValue = obj[objProperty];
        //undefined values might be the remains of previous deletions on obj2, so we don't care about them
        if(objValue !== undefined){
            if(typeof objValue === "object") {
                //the value is a property, we check deeper recursively
                checkAddedValues(objValue, result, path + pathSeparator + objProperty);
            }
            else{
                result.push({propertyPath: path + pathSeparator + objProperty, value: objValue});
            }
        }
    }
}

export const getObjectPropertiesDiffferences = (obj1: {[id: string]: any}, obj2: {[id: string]: any}): ObjectPropertyDiff[]  => {
    const result = [] as ObjectPropertyDiff[];
    
    //To find the differences, we'll remove objects from obj2 ---> so we use a copy
    const obj2copy = JSON.parse(JSON.stringify(obj2));

    //we then parse through all properties to find a difference
    //if there is a difference, we add it in the result and remove the property from obj2copy (to keep only additions)
    findDiffDeep(obj1, obj2copy, result, "");

    //at this stage, what is left on obj2copy are the additions that we put this in the result too.
    //note that any property without value isn't an addition (it can be the remaining of the deletion done in the loop above)
    checkAddedValues(obj2copy,result, "");

    return result;
}
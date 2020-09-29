
export function checkStateDataIntegrity(obj: {[id: string]: any}): boolean  {
    //check the checksum property is present, if not, the document doesn't have integrity
    if(obj["checksum"] !== undefined){
        return true;
    }
    else{
        return false;
    }
}

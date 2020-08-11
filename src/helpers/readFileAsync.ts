export function readFileAsync(file: Blob): Promise<BufferSource>  {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onloadend = () => {
            resolve(reader.result as BufferSource);
        };

        reader.onerror = reject;

        reader.readAsArrayBuffer(file);
    });
}

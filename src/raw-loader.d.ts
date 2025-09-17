// Make Typescript happy with raw-loader module paths:
declare module "!!raw-loader!*" {
    const content: string;
    export default content;
}


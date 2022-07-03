export class PackageNewestVersionInstalled extends Error {
    constructor(message) {
        super(message);
        this.name = "PackageNewestVersionInstalled";
    }
}
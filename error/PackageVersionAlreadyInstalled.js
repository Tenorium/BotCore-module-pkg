export class PackageVersionAlreadyInstalled extends Error {
    constructor(message) {
        super(message);
        this.name = "PackageVersionAlreadyInstalled";
    }
}
export class VersionOfPackageNotFound extends Error {
    constructor(message) {
        super(message);
        this.name = 'VersionOfPackageNotFound';
    }
}
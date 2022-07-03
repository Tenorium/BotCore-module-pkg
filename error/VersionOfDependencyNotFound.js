export class VersionOfDependencyNotFound extends Error {
    constructor(message) {
        super(message);
        this.name = 'VersionOfDependencyNotFound';
    }
}
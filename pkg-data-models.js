export class Model {
    #data;

    /**
     *
     * @param {Object} obj
     */
    constructor(obj) {
        this.#data = obj;
    }

    /**
     *
     * @param name
     * @return {*|undefined}
     */
    getField(name) {
        return this.#data[name] ?? undefined;
    }

    setField(name, value) {
        this.#data[name] = value;
    }

    unsetField(name) {
        if (typeof this.#data[name] !== undefined) {
            delete this.#data[name];
        }
    }

    getData() {
        return this.#data;
    }
}

export class StateModel extends Model
{

    /**
     *
     * @param {STATUS_INSTALLED|STATUS_INSTALLING|STATUS_REMOVING,STATUS_DOWNLOADING} status
     */
    setStatus(status) {
        this.setField('status', status);
    }

    /**
     *
     * @return {STATUS_INSTALLED|STATUS_INSTALLING|STATUS_REMOVING,STATUS_DOWNLOADING}
     */
    getStatus() {
        return this.getField('status');
    }

    /**
     *
     * @param {string} version
     */
    setVersion(version) {
        this.setField('version', version)
    }

    /**
     *
     * @return {string}
     */
    getVersion() {
        return this.getField('version');
    }

    /**
     *
     * @param {string|null} oldVersion
     */
    setOldVersion(oldVersion) {
        this.setField('oldVersion')
    }

    /**
     *
     * @return {string|null}
     */
    getOldVersion() {
        return this.getField('oldVersion');
    }

}

export class RepositoryModel extends Model {
    /**
     *
     * @param {string} url
     */
    setUrl(url) {
        this.setField('url', url);
    }

    /**
     *
     * @return {string}
     */
    getUrl() {
        return this.getField('url');
    }

    /**
     *
     * @return {string[]}
     */
    getAllBranches() {
        return this.getField('branches')
    }

    /**
     *
     * @param {string[]} branches
     */
    setAllBranches(branches) {
        this.setField('branches', branches);
    }

    /**
     *
     * @param {string} name
     */
    addBranch(name) {
        let allBranches = this.getAllBranches();
        if (!allBranches.includes(name)) {
            allBranches.push(name);
            this.setAllBranches(allBranches);
        }
    }

    /**
     *
     * @param {string} name
     */
    removeBranch(name) {
        let allBranches = this.getAllBranches();
        let index = allBranches.indexOf(name);
        if (index !== -1) {
            allBranches.splice(index, 1);
            this.setAllBranches(allBranches);
        }
    }

    /**
     *
     * @return {string[]}
     */
    getActiveBranches() {
        return this.getField('active-branches');
    }

    /**
     *
     * @param {string[]} activeBranches
     */
    setActiveBranches(activeBranches) {
        this.setField('active-branches', activeBranches);
    }

    /**
     *
     * @param {string} name
     */
    activateBranch(name) {
        let activeBranches = this.getActiveBranches();
        if (!activeBranches.includes(name)) {
            activeBranches.push(name);
            this.setActiveBranches(activeBranches);
        }
    }

    /**
     *
     * @param {string} name
     */
    deactivateBranch(name) {
        let activeBranches = this.getActiveBranches();
        let index = activeBranches.indexOf(name);
        if (index !== -1) {
            activeBranches.splice(index, 1);
            this.setActiveBranches(activeBranches);

        }
    }
}

export class ManifestModel extends Model
{
    /**
     *
     * If true then package can't be removed
     * @return {boolean}
     */
    getIsSystem() {
        return this.getField('system') ?? false;
    }

    /**
     *
     * @param {boolean} value
     */
    setIsSystem(value) {
        if (value) {
            this.setField('system', value);
            return;
        }

        this.unsetField('system');
    }

    /**
     * If true then upgrading must be version-by-version (not directly to latest)
     * @return {boolean}
     */
    getIsChainUpdate() {
        return this.getField('chainUpdate');
    }

    /**
     *
     * @param {boolean} value
     */
    setIsChainUpdate(value) {
        return this.setField('chainUpdate', value);
    }

    /**
     *
     * @return {Object<string,ManifestVersionModel|ManifestVersionAliasModel>}
     */
    getVersions() {
        let rawVersions = this.getField('versions');
        let data = {};

        Object.keys(rawVersions).forEach(key => {
            let obj = rawVersions[key];
            switch (obj.type) {
                case 'alias':
                    data[key] = new ManifestVersionAliasModel(obj);
                    break;
                case 'version':
                    data[key] = new ManifestVersionModel(obj);
                    break;
            }
        });

        return data;
    }

    /**
     *
     * @param {Object<string, ManifestVersionModel>} data
     */
    setVersions(data) {
        this.setField('versions', Object.keys(data).map(value => data[value].getData()));
    }
}

export class VersionFile extends Model
{
    /**
     *
     * @param {string} hashsum
     */
    setHashsum(hashsum) {
        this.setField('hashsum', hashsum);
    }

    /**
     *
     * @return {string}
     */
    getHashsum() {
        return this.getField('hashsum');
    }

    /**
     *
     * @param {'remove', 'ignore'} action
     */
    setUninstallAction(action) {
        this.setField('uninstall-action', action);
    }

    /**
     *
     * @return {'remove', 'ignore'}
     */
    getUninstallAction() {
        return this.getField('uninstall-action');
    }
}

export class ManifestVersionAliasModel extends Model
{
    /**
     *
     * @return {string}
     */
    getAlias() {
        return this.getField('alias');
    }

    /**
     *
     * @param {string} alias
     */
    setAlias(alias) {
        this.setField('alias', alias);
    }

    /**
     *
     * @return {'alias'}
     */
    getType() {
        return 'alias';
    }
}

export class ManifestVersionModel extends Model
{
    /**
     * @return {'version'}
     */
    getType() {
        return 'version';
    }

    /**
     *
     * @param {string} alias
     */
    setAlias(alias) {
        this.setField('alias', alias);
    }

    /**
     *
     * @return {string}
     */
    getSHA256() {
        return this.getField('sha-256');
    }

    /**
     *
     * @param {string} hash
     */
    setSHA256(hash) {
        this.setField('sha-256');
    }

    /**
     *
     * @param {Object<string, string>} dependencies
     */
    setDependencies(dependencies) {
        this.setField('dependencies', dependencies);
    }

    /**
     *
     * @return {Object<string,string>}
     */
    getDependencies() {
        return this.getField('dependencies');
    }

    /**
     *
     * @param {Object<string, string>} dependencies
     */
    setNodeDependencies(dependencies) {
        this.setField('nodeDependencies', dependencies);
    }

    /**
     *
     * @return {Object<string, string>}
     */
    getNodeDependencies() {
        return this.getField('nodeDependencies');
    }

    /**
     *
     * @param {Object<string, VersionFile>} files
     */
    setFiles(files) {
        this.setField('files', Object.keys(files).map(key => files[key].getData()));
    }

    getFiles() {
        let rawFiles = this.getField('files');
        let data = {};

        Object.keys(rawFiles).forEach(key => {
            data[key] = new VersionFile(rawFiles[key]);
        });

        return data;
    }
}
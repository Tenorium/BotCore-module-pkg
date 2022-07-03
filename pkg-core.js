import {
    getMetadata,
    getStates,
    LockedError,
    setLock, setPackageMetadata, setPackageState,
    STATUS_DOWNLOADING,
    STATUS_INSTALLED,
    STATUS_INSTALLING
} from "./pkg-util.js";
import {downloadInfo, downloadPackage, getManifestAndUrlFromInfo, resolveAlias} from "./pkg-repo.js";
import semver from "semver";
import {PackageNewestVersionInstalled} from "./error/PackageNewestVersionInstalled.js";
import {StateModel} from "./pkg-data-models.js";
import AdmZip from "adm-zip";
import * as fs from "fs";
import {addScript, hasScript, runScript} from "./pkg-script.js";
import * as path from "path";

/**
 *
 * @param {string} name
 * @param {string} version
 * @param {?boolean} chainUpdate
 */
export const install = async function (name, version = 'latest', chainUpdate = false) {
    setLock(true);
    try {
        let packageMetadata = getMetadata()[name] ?? null;
        let packageState = getStates()[name] ?? null;

        let {manifest: currentManifest} = getManifestAndUrlFromInfo(await downloadInfo(name), version);
        let resolvedRequired = resolveAlias(currentManifest, version);
        let resolvedCurrent = null;

        if (packageState && packageMetadata) {
            resolvedCurrent = resolveAlias(packageMetadata, packageState.getVersion());
        }

        if (currentManifest.getIsChainUpdate() && version === 'latest' || chainUpdate) {
            let allVersions = currentManifest.getVersions();
            let filteredVersions = Object.keys(currentManifest.getVersions())
                .filter(key => allVersions[key].getType() === "version");

            let nextVersion = getNextVersion(filteredVersions, resolvedCurrent);
            if (nextVersion !== resolvedCurrent) {
                await install(name,nextVersion);
                await install(name, 'latest', chainUpdate);
                return;
            }
        }

        setPackageMetadata(name, currentManifest);

        if ((resolvedCurrent !== null) && version === 'latest' && packageState.getStatus() === STATUS_INSTALLED) {
            if (semver.eq(resolvedCurrent, resolvedRequired)) {
                throw new PackageNewestVersionInstalled(`Newest version of ${name} already installed`);
            }
        }

        console.log(`Preparing for download ${name}`);

        let oldPackageState = packageState;

        if (packageState === null) {
            packageState = new StateModel({
                status: STATUS_DOWNLOADING,
                oldVersion: null,
                version: version
            });
        } else {
            packageState.setOldVersion(packageState.getVersion());
            packageState.setVersion(resolvedRequired);
            packageState.setStatus(STATUS_DOWNLOADING);
        }

        console.log(`Updating state...`);

        setPackageState(name, packageState);


        try {
            await downloadPackage(name, version);
            console.log(`Unpacking ${name}...`);

            packageState.setStatus(STATUS_INSTALLING);
            setPackageState(name, packageState);

            let path = `data/tmp/${name}-${resolvedCurrent ?? resolvedRequired}`;

            let zip = new AdmZip(new URL(`${path}.zip`, import.meta.url).pathname);
            let zipEntries = zip.getEntries();

            zipEntries.forEach(/**ZipEntry*/entry => {
                if (entry.entryName === '__scripts/install.js') {
                    zip.extractEntryTo(entry.entryName, `${path}-scripts/install.js`);
                    return;
                }

                if (entry.entryName === '__scripts/uninstall.js') {
                    zip.extractEntryTo(entry.entryName, `${path}-scripts/uninstall.js`);
                }
            });

            zip.deleteFile('__scripts');

            zip.extractAllTo(basePath, true, true);

            addScript(name, `${path}-scripts/install.js`, 'install');
            addScript(name, `${path}-scripts/uninstall.js`, 'uninstall');

            if (fs.existsSync(`${path}-scripts`)) {
                fs.rmdirSync(`${path}-scripts`);
            }

            if (hasScript(name, 'install')) {
                console.log(`Configuring ${name}...`);
                await runScript(name, 'install');
            }

            packageState.setStatus(STATUS_INSTALLED);
            setPackageState(name, packageState)

            console.log("Installed successfully");
        } catch (e) {
            console.log(e);
            console.log("Reverting states...");

            setPackageState(name, oldPackageState);
            setLock(false);
            return;
        }
    } catch (e) {
        if (!(e instanceof LockedError)) {
            console.log(e);
            setLock(false);
            return;
        }
    }

    setLock(false);
}

/**
 *
 * @param {string} name
 */
export const remove = async function (name) {
    setLock(true);
    try {
        let packageManifest = getMetadata()[name] ?? null;
        let packageState = getStates()[name] ?? null;

        if (packageState === null || packageState.getStatus() !== STATUS_INSTALLED) {
            console.log(`Package ${name} not installed`);
            setLock(false);
            return;
        }

        if (packageManifest === null) {
            packageManifest = getManifestAndUrlFromInfo(await downloadInfo(name), packageState.getVersion()).manifest;
        }

        if (packageManifest.getIsSystem()) {
            console.log(`System package ${name} cannot be removed`);
        }

        let files = packageManifest.getVersions()[packageState.getVersion()].getFiles();

        console.log(`Removing package ${name}...`);

        Object.keys(files).forEach(key => {
            /**@type VersionFile*/
            let file = files[key];
            if (file.getUninstallAction() === 'remove') {
                fs.rmSync(path.join(basePath, key));
            }
        });

        setPackageState(name, null);
        setPackageMetadata(name, null);

        console.log(`Package ${name} removed.`);
    } catch (e) {
        setLock(false);
        throw e;
    }

    setLock(false);
}

export const listInstalledPackages = function () {
    let states = getStates();
    Object.keys(states).forEach(key => {
        let state = states[key];
        if (state.getStatus() === STATUS_INSTALLED) {
            console.log(key);
        }
    });
}

/**
 *
 * @param {string[]} allVersions
 * @param {string|null} current
 */
const getNextVersion = function (allVersions, current) {
    let sorted = allVersions.sort(semver.compare);

    if (current === null) {
        return sorted[0];
    }

    let index = sorted.indexOf(current);
    if (index !== (sorted.length - 1)) {
        return sorted[index+1];
    }

    return current;
}
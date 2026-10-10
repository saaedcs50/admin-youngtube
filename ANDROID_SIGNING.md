# YoungTube Admin — Android Signing & Update Guide

## 1. App Identity
- **Package Name / ApplicationId**: `app.youngtube.admin`
- **Capacitor App ID**: `app.youngtube.admin`
- **Target App**: YoungTube Admin only (do NOT confuse with kid app `app.youngtube.app`).

## 2. Upgrade / Over-The-Air Compatibility Rule
Android will refuse an in-place update (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`) or wipe data if:
1. The **applicationId** differs between APKs.
2. The **signing key (certificate fingerprint)** differs between APKs.
3. The **versionCode** is lower than or equal to the currently installed APK in standard package managers (versionCode must strictly increase).

**To preserve local admin credentials (`ADMIN_KEY` and WebView storage):**
- **Every release must be signed with the SAME keystore / key alias**.
- If a previous release was signed with a debug key or a different keystore, the user must uninstall **one last time** to start the consistent signing lineage. Thereafter, every newer APK will install smoothly as an **update**, retaining all saved session and admin settings without needing to uninstall.

## 3. Version Code Management
In `android/app/build.gradle`:
```groovy
// BUMP versionCode before every admin sideload release
versionCode (project.findProperty("versionCode") ?: 1).toInteger()
versionName (project.findProperty("versionName") ?: "1.0").toString()
```

When building via Gradle CLI, you can override values dynamically:
```bash
./gradlew assembleRelease -PversionCode=2 -PversionName="1.1"
```

## 4. Keystore Configuration

### Generating the Admin Keystore (One-Time)
Run the following command locally to generate a dedicated keystore for YoungTube Admin:
```bash
keytool -genkey -v -keystore admin-release.keystore -alias youngtube-admin -keyalg RSA -keysize 2048 -validity 10000
```
> **Warning**: Keep `admin-release.keystore` safe and NEVER commit it or its passwords to git!

### Local Build with Keystore
Set environment variables before running `./gradlew assembleRelease`:
```bash
export ADMIN_RELEASE_KEYSTORE_PATH="/absolute/path/to/admin-release.keystore"
export ADMIN_RELEASE_KEYSTORE_PASSWORD="your-keystore-password"
export ADMIN_RELEASE_KEY_ALIAS="youngtube-admin"
export ADMIN_RELEASE_KEY_PASSWORD="your-key-password"

cd android
./gradlew assembleRelease -PversionCode=2 -PversionName="1.0.1"
```

### GitHub Actions CI/CD Configuration
Configure these repository secrets in GitHub Actions:
- `ADMIN_RELEASE_KEYSTORE_BASE64`: Base64-encoded content of `admin-release.keystore` (`base64 -w 0 admin-release.keystore`)
- `ADMIN_RELEASE_KEYSTORE_PASSWORD`: The keystore password
- `ADMIN_RELEASE_KEY_ALIAS`: `youngtube-admin`
- `ADMIN_RELEASE_KEY_PASSWORD`: The private key password

If the secrets are configured, `.github/workflows/build-apk.yml` automatically produces a signed release APK. If absent, it safely falls back to `assembleDebug`.

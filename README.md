# Create Application Version in Fortify Software Security Center

Build secure software fast with [Fortify](https://www.microfocus.com/en-us/solutions/application-security). Fortify offers end-to-end application security solutions with the flexibility of testing on-premises and on-demand to scale and cover the entire software development lifecycle.  With Fortify, find security issues early and fix at the speed of DevOps.

This GitHub Action utilizes [fcli](https://github.com/fortify/fcli) to create an Application Version in Fortify Software Security Center.
The Action can copy the Application State and the Values from another Application version

## Table of Contents

* [Requirements](#requirements)
    * [FoD or SSC instance](#fod-or-ssc-instance)
    * [Network connectivity](#network-connectivity)
    * [Java](#java)
* [Usage](#usage)
    * [Export FoD vulnerability data](#export-fod-vulnerability-data)
        * [FoD to GitHub Code Scanning Alerts](#fod-to-github-code-scanning-alerts)
        * [FoD to other output formats](#fod-to-other-output-formats)
        * [FoD Inputs](#fod-inputs)
    * [Export SSC vulnerability data](#export-ssc-vulnerability-data)
        * [SSC to GitHub Code Scanning Alerts](#ssc-to-github-code-scanning-alerts)
        * [SSC to other output formats](#ssc-to-other-output-formats)
        * [SSC Inputs](#ssc-inputs)
* [Docker-based alternative](#docker-based-alternative)
* [Information for Developers](#information-for-developers)

## Requirements

### SSC instance
Obviously you will need to have an SSC instance from which you can retrieve Fortify scan results. If you are not already a Fortify customer, check out our [Free Trial](https://www.microfocus.com/en-us/products/application-security-testing/free-trial).

### Network connectivity
The SSC instance in which you want to create an Application Version needs to be accessible from the GitHub Runner where this action is being executed. Following table lists some considerations:

| Source | Runner        | Considerations |
| ------ | ------------- | -------------- |
| SSC    | GitHub-hosted | GitHub lists [IP addresses for GitHub-hosted runners](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners#ip-addresses) that need to be allowed network access to SSC. Exposing an SSC instance to the internet, even if limited to only GitHub IP addresses, could pose a security risk. |
| SSC    | Self-hosted   | May need to allow network access from the self-hosted runner to SSC if in different network segments |

## Usage

The primary use case for this action is before the executioo of a Fortify scan. See the [Fortify ScanCentral Scan](https://github.com/marketplace/actions/fortify-scancentral-scan) action for more details on how to initiate SAST scans on Fortify ScanCentral SAST. 


### Create Application Version

This example workflow demonstrates how to create an application version in SSC, using the repo and branch names as app:version

```yaml
name: (FTFY) Create Application Version
on: [workflow dispatch]
      
jobs:                                                  
  CreateAppVersion:
    runs-on: ubuntu-latest
    
    container:
      image: fortifydocker/fortify-ci-tools

    steps:
      # Pull SAST issues from Fortify on Demand and generate GitHub-optimized SARIF output
      - name: Create Application Version
        uses: agendry-pub/gha-ssc-create-application-version@v1
        with:
          ssc_url: ${{ vars.FTFY_SSC_URL}}
          ssc_ci_username: ${{ secrets.FTFY_CI_USERNAME }}
          ssc_ci_password: ${{ secrets.FTFY_CI_PASSWORD }}
          ssc_app: ${{ github.event.repository.name }}
          ssc_version: ${{ github.ref_name }}
      
```

#### SSC Considerations

* Username and Password are required to copy the application version state from another one

#### Create Application Version with Copy State and Vulns

This example workflow demonstrates how to create an application version in SSC, and copying the Rule, Tags and Vulns from a source application version

```yaml
name: (FTFY) Create Application Version
on: [workflow dispatch]

jobs:
  CreateAppVersion:
    runs-on: ubuntu-latest

    container:
      image: fortifydocker/fortify-ci-tools

    steps:
      # Pull SAST issues from Fortify on Demand and generate GitHub-optimized SARIF output
      - name: Create Application Version
        uses: agendry-pub/gha-ssc-create-application-version@v1
        with:
          ssc_url: ${{ vars.FTFY_SSC_URL}}
          ssc_ci_username: ${{ secrets.FTFY_CI_USERNAME }}
          ssc_ci_password: ${{ secrets.FTFY_CI_PASSWORD }}
          ssc_app: ${{ github.event.repository.name }}
          ssc_version: ${{ github.ref_name }}
          ssc_source_app: ${{ github.event.repository.name }}
          ssc_source_version: main
          copy_vulns: true
          
```

#### SSC Considerations

* if you specify the source app:version, only the Rules, Tags and BugTracker settings will be copied. Set `copy_vulns` to `true`if you want to copy the Vulnerability as well

#### SSC Inputs

**`ssc_url`**  
*Required* The base URL for the Fortify Software Security Center instance where your data resides.

**`ssc_ci_username` + `ssc_ci_password`**  
*Required* Credentials for authenticating to Software Security Center. Strongly recommend use of GitHub Secrets for credential management.

**`ssc_app`**  
*Required* The target SSC application name to create

**`ssc_version`**  
*Required* The target SSC application version name to create

**`ssc_source_app`**  
*Optional* The source SSC application name to copy from

**`ssc_source_version`**  
*Optional* The source SSC application version name to copy from

**`copy_vulns`**  
*Optional* Enable to copy vulnerabilities from source to target application version

**`export_target`**  
*Optional* Output format or system to export to. This input parameter is ignored if the `export_config` input parameter is defined. This input parameter supports any of the export targets for which a corresponding `SSCTo<export_target>.yml` is shipped with FortifyVulnerabilityExporter. The value of the `export_target` input parameter is case-sensitive when running on a platform with case-sensitive file names. Based on the FortifyVulnerabilityExporter version available at the time of writing, the following export targets are supported:

## Information for Developers

All commits to the `main` or `master` branch should follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) convention. In particular, commits using the `feat: Some feature` and `fix: Some fix` convention are used to automatically manage version numbers and for updating the [CHANGELOG.md](https://github.com/fortify/gha-export-vulnerabilities/blob/master/CHANGELOG.md) file.

Whenever changes are pushed to the `main` branch, the [`.github/workflows/publish-release.yml`](https://github.com/fortify/ghassc-create-application-version/blob/main/.github/workflows/publish-release.yml) workflow will be triggered. If there have been any commits with the `feat:` or `fix:` prefixes, the [`release-please-action`](https://github.com/google-github-actions/release-please-action) will generate a pull request with the appropriate changes to the CHANGELOG.md file and version number in `package.json`. If there is already an existing pull request, based on earlier feature or fix commits, the pull request will be updated.

Once the pull request is accepted, the `release-please-action` will publish the new release to the GitHub Releases page and tag it with the appropriate `v{major}.{minor}.{patch}` tag. The two `richardsimko/update-tag` action instances referenced in the `publish-release.yml` workflow will create or update the appropriate `v{major}.{minor}` and `v{major}` tags, allowing users to reference the action by major, minor or patch version.
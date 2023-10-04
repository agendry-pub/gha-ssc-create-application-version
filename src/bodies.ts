import * as core from '@actions/core'

/**
 * Generate the HTTP body for creating an SSC Application Version
 * Application can be either provided by id (if it exists), or by name (if it does not exists)
 * @param app The application name or id
 * @param version The version name
 * @returns {any} returns the HTTP body as JSON object
 */
export function getCreateAppVersionBody(app: any, version: string): any {
  const bodyJson = JSON.parse(`
    {
        "name": "${version}",
        "description": "",
        "active": true,
        "committed": false,
        "project": {
        }
    }`)

  switch (typeof app) {
    case 'string':
      bodyJson['project']['name'] = app
      break
    case 'number':
      bodyJson['project']['id'] = app
      break
    default:
      core.error(
        `app parameter should be of type string or number. Not: ${typeof app}`
      )
      core.setFailed('AppVersion HTTP body creation failed')
  }

  return bodyJson
}

/**
 * Generate the HTTP body for SSC Application Version Copy State
 * @param source The source application Version id
 * @param target The target application Version id
 * @returns {any} returns the HTTP body as JSON object
 */
export function getCopyStateBody(source: string, target: string): any {
  const bodyJson = JSON.parse(`
        {
            "copyAnalysisProcessingRules": "true",
            "copyBugTrackerConfiguration": "true",
            "copyCustomTags": "true",
            "previousProjectVersionId": "${source}",
            "projectVersionId": "${target}"
        }`)

  return bodyJson
}

/**
 * Generate the HTTP body for SSC Application Version Copy Vulns
 * @param source The source application Version id
 * @param target The target application Version id
 * @returns {any} returns the HTTP body as JSON object
 */
export function getCopyVulnsBody(source: string, target: string): any {
  const bodyJson = JSON.parse(`
          {
              "previousProjectVersionId": "${source}",
              "projectVersionId": "${target}"
          }`)

  return bodyJson
}

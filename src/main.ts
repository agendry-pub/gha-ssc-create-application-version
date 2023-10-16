import * as core from '@actions/core'
import * as exec from '@actions/exec'
import {
  getCreateAppVersionBody,
  getCopyStateBody,
  getCopyVulnsBody
} from './bodies'

const INPUT = {
  ssc_base_url: core.getInput('ssc_base_url', { required: true }),
  ssc_ci_token: core.getInput('ssc_ci_token', { required: false }),
  ssc_ci_username: core.getInput('ssc_ci_username', { required: false }),
  ssc_ci_password: core.getInput('ssc_ci_password', { required: false }),
  ssc_app: core.getInput('ssc_app', { required: true }),
  ssc_version: core.getInput('ssc_version', { required: true }),
  ssc_source_app: core.getInput('ssc_source_app', { required: false }),
  ssc_source_version: core.getInput('ssc_source_version', { required: false }),
  copy_vulns: core.getBooleanInput('copy_vulns', { required: false }),
  sha: core.getInput('sha', { required: false }),
  ssc_version_attributes: core.getMultilineInput('ssc_version_attributes', {
    required: false
  })
}

async function getExecutablePath(name: string): Promise<string> {
  if (process.env.FCLI_EXECUTABLE_PATH) {
    return `${process.env.FCLI_EXECUTABLE_PATH.replace(/\/+$/, '')}`
  } else if (process.env.FCLI_EXECUTABLE_LOCATION) {
    return `${process.env.FCLI_EXECUTABLE_LOCATION.replace(/\/+$/, '')}/fcli`
  } else {
    return 'fcli'
  }
}

async function checkLoggedIn(base_url: string): Promise<boolean> {
  let responseData = ''
  let errorData = ''

  const options = {
    listeners: {
      stdout: (data: Buffer) => {
        responseData += data.toString()
      },
      stderr: (data: Buffer) => {
        errorData += data.toString()
      }
    },
    silent: true
  }

  try {
    const response = await exec.exec(
      await getExecutablePath('fcli'),
      ['ssc', 'session', 'list', '--query=name=default', '--output=json'],
      options
    )
    core.debug(response.toString())
    core.debug(responseData)

    const jsonRes = JSON.parse(responseData)

    if (jsonRes.length > 0) {
      if (jsonRes[0]['expired'] === 'No') {
        return true
      }
    }

    return false
  } catch (err) {
    core.error('Failed to check existing SSC sessions')
    core.error(errorData)
    throw new Error(`${err}`)
  }
}

async function loginToken(base_url: string, token: string): Promise<any> {
  let responseData = ''
  let errorData = ''

  const options = {
    listeners: {
      stdout: (data: Buffer) => {
        responseData += data.toString()
      },
      stderr: (data: Buffer) => {
        errorData += data.toString()
      }
    },
    silent: true
  }

  try {
    const response = await exec.exec(
      await getExecutablePath('fcli'),
      [
        'ssc',
        'session',
        'login',
        `--url`,
        base_url,
        '-t',
        token,
        process.env.FCLI_DEFAULT_TOKEN_EXPIRE
          ? `--expire-in=${process.env.FCLI_DEFAULT_TOKEN_EXPIRE}`
          : '',
        process.env.FCLI_DISABLE_SSL_CHECKS ? `--insecure` : '',
        '--output=json'
      ],
      options
    )
    core.debug(response.toString())
    core.debug(responseData)

    const jsonRes = JSON.parse(responseData)

    if (jsonRes['__action__'] === 'CREATED') {
      return jsonRes
    } else {
      throw new Error(
        `Login Failed: SSC returned __action__ = ${jsonRes['__action__']}`
      )
    }
  } catch (err) {
    core.error(errorData)
    throw new Error(`${err}`)
  }
}

async function loginUsernamePassword(
  base_url: string,
  username: string,
  password: string
): Promise<any> {
  let responseData = ''
  let errorData = ''

  const options = {
    listeners: {
      stdout: (data: Buffer) => {
        responseData += data.toString()
      },
      stderr: (data: Buffer) => {
        errorData += data.toString()
      }
    },
    silent: true
  }
  try {
    const response = await exec.exec(
      await getExecutablePath('fcli'),
      [
        'ssc',
        'session',
        'login',
        `--url`,
        base_url,
        '-u',
        username,
        '-p',
        password,
        '--expire-in',
        process.env.FCLI_DEFAULT_TOKEN_EXPIRE
          ? process.env.FCLI_DEFAULT_TOKEN_EXPIRE
          : '1d',
        process.env.FCLI_DISABLE_SSL_CHECKS ? `--insecure` : '',
        '--output=json'
      ],
      options
    )
    core.debug(response.toString())
    core.debug(responseData)

    const jsonRes = JSON.parse(responseData)

    if (jsonRes['__action__'] === 'CREATED') {
      return jsonRes
    } else {
      throw new Error(
        `Login Failed: SSC returned __action__ = ${jsonRes['__action__']}`
      )
    }
  } catch (err) {
    core.error(errorData)
    throw new Error(`${err}`)
  }
}

async function getAppVersionId(app: string, version: string): Promise<number> {
  let responseData = ''
  let error = ''

  const options = {
    listeners: {
      stdout: (data: Buffer) => {
        responseData += data.toString()
      },
      stderr: (data: Buffer) => {
        error += data.toString()
      }
    },
    silent: true
  }
  try {
    const response = await exec.exec(
      await getExecutablePath('fcli'),
      [
        'ssc',
        'appversion',
        'ls',
        `-q=application.name=${app}`,
        `-q=name=${version}`,
        '--output=json'
      ],
      options
    )

    core.debug(response.toString())

    const jsonRes = JSON.parse(responseData)

    if (jsonRes.length === 0) {
      core.debug(`AppVersion "${app}":"${version}" not found`)
      return 0
    } else {
      core.debug(`AppVersion "${app}":"${version}" exists`)
      return jsonRes[0].id
    }
  } catch (err) {
    core.error('Something went wrong during AppVersion retrieval')
    core.error(error)
    core.error(`${err}`)
    core.error(`AppVersion : "${app}":"${version}"`)
    core.setFailed('Something went wrong during AppVersion retrieval')
  }

  return -1
}

async function getAppId(app: string): Promise<number> {
  let responseData = ''
  let error = ''

  const options = {
    listeners: {
      stdout: (data: Buffer) => {
        responseData += data.toString()
      },
      stderr: (data: Buffer) => {
        error += data.toString()
      }
    },
    silent: true
  }
  try {
    const response = await exec.exec(
      await getExecutablePath('fcli'),
      ['ssc', 'app', 'ls', `-q=name=${app}`, '--output=json'],
      options
    )

    core.debug(response.toString())

    const jsonRes = JSON.parse(responseData)

    if (jsonRes.length === 0) {
      core.debug(`Application "${app}" not found`)
      return 0
    } else {
      core.debug(`Application "${app}" exists`)
      return jsonRes[0].id
    }
  } catch {
    core.error('Something went wrong during Application retrieval')
    core.error(error)
    core.error(`Application : "${app}"`)
    core.setFailed('Something went wrong during Application retrieval')
  }

  return -1
}

async function createAppVersion(app: any, version: string): Promise<any> {
  core.debug(`Creating AppVersion ${app}:${version}`)

  const appId = await getAppId(app)
  let createAppVersionBodyJson
  if (appId > 0) {
    core.debug(`Application ${app} exists`)
    createAppVersionBodyJson = getCreateAppVersionBody(appId, version)
  } else {
    core.debug(`Application ${app} not found. Creating new Application as well`)
    createAppVersionBodyJson = getCreateAppVersionBody(app, version)
  }

  core.debug(JSON.stringify(createAppVersionBodyJson))

  let responseData = ''
  let errorData = ''

  const options = {
    listeners: {
      stdout: (data: Buffer) => {
        responseData += data.toString()
      },
      stderr: (data: Buffer) => {
        errorData += data.toString()
      }
    },
    silent: true
  }
  try {
    const response = await exec.exec(
      await getExecutablePath('fcli'),
      [
        'ssc',
        'rest',
        'call',
        '/api/v1/projectVersions',
        '-d',
        JSON.stringify(createAppVersionBodyJson),
        `-X`,
        'POST',
        '--output=json',
        `--store=${INPUT.sha}_appVersionId`
      ],
      options
    )

    core.debug(response.toString())
    core.debug(responseData)

    const jsonRes = JSON.parse(responseData)
    const responseCode = jsonRes[0].responseCode
    core.debug(responseCode)

    if (200 <= Number(responseCode) && Number(responseCode) < 300) {
      return jsonRes[0].data
    } else {
      core.error(`AppVersion creation return code ${responseCode}`)
      throw new Error(`AppVersion creation return code ${responseCode}`)
    }
  } catch {
    core.error('Something went wrong during Application Version creation')
    core.error(errorData)
    core.error(`Application : "${app}":"${version}"`)
    core.setFailed('Something went wrong during Application Version creation')
  }
}

async function deleteAppVersion(id: any): Promise<boolean> {
  core.debug(`Deleting AppVersion ${id}`)

  let responseData = ''
  let errorData = ''

  const options = {
    listeners: {
      stdout: (data: Buffer) => {
        responseData += data.toString()
      },
      stderr: (data: Buffer) => {
        errorData += data.toString()
      }
    },
    silent: true
  }
  try {
    const response = await exec.exec(
      await getExecutablePath('fcli'),
      [
        'ssc',
        'rest',
        'call',
        `/api/v1/projectVersions/${id}`,
        `-X`,
        'DELETE',
        '--output=json'
      ],
      options
    )

    core.debug(response.toString())
    core.debug(responseData)

    const jsonRes = JSON.parse(responseData)
    const responseCode = jsonRes[0].responseCode
    core.debug(responseCode)

    if (200 <= Number(responseCode) && Number(responseCode) < 300) {
      return true
    } else {
      core.error(`AppVersion Deletion failed with code ${responseCode}`)
      throw new Error(`AppVersion Commit Deletion with code ${responseCode}`)
    }
  } catch {
    core.error('Something went wrong during Application Version Deletion')
    core.error(errorData)
    core.error(`AppVersion ${id}`)
    core.setFailed('Something went wrong during Application Version Deletion')
  }

  return false
}

async function copyAppVersionState(
  source: string,
  target: string
): Promise<any> {
  core.debug(`Copying AppVersion State ${source} -> ${target}`)

  const copyStateBodyJson = getCopyStateBody(source, target)
  core.debug(JSON.stringify(copyStateBodyJson))

  let responseData = ''
  let errorData = ''

  const options = {
    listeners: {
      stdout: (data: Buffer) => {
        responseData += data.toString()
      },
      stderr: (data: Buffer) => {
        errorData += data.toString()
      }
    },
    silent: true
  }
  try {
    const response = await exec.exec(
      await getExecutablePath('fcli'),
      [
        'ssc',
        'rest',
        'call',
        '/api/v1/projectVersions/action/copyFromPartial',
        '-d',
        JSON.stringify(copyStateBodyJson),
        `-X`,
        'POST',
        '--output=json'
      ],
      options
    )

    core.debug(response.toString())
    core.debug(responseData)

    const jsonRes = JSON.parse(responseData)
    const responseCode = jsonRes[0].responseCode
    core.debug(responseCode)

    if (200 <= Number(responseCode) && Number(responseCode) < 300) {
      return true
    } else {
      core.error(`AppVersion Copy State failed with code ${responseCode}`)
      throw new Error(`AppVersion Copy State failed with code ${responseCode}`)
    }
  } catch {
    core.error('Something went wrong during Application Version Copy State')
    core.error(errorData)
    core.error(`Version ${source}" to Version "${target}"`)
    core.setFailed('Something went wrong during Application Version Copy State')

    return false
  }
}

async function copyAppVersionVulns(
  source: string,
  target: string
): Promise<any> {
  core.debug(`Copying AppVersion Vulnerabilities ${source} -> ${target}`)

  const copyVulnsBodyJson = getCopyVulnsBody(source, target)
  core.debug(JSON.stringify(copyVulnsBodyJson))

  let responseData = ''
  let errorData = ''

  const options = {
    listeners: {
      stdout: (data: Buffer) => {
        responseData += data.toString()
      },
      stderr: (data: Buffer) => {
        errorData += data.toString()
      }
    },
    silent: true
  }
  try {
    const response = await exec.exec(
      await getExecutablePath('fcli'),
      [
        'ssc',
        'rest',
        'call',
        '/api/v1/projectVersions/action/copyCurrentState',
        '-d',
        JSON.stringify(copyVulnsBodyJson),
        `-X`,
        'POST',
        '--output=json'
      ],
      options
    )

    core.debug(response.toString())
    core.debug(responseData)

    const jsonRes = JSON.parse(responseData)
    const responseCode = jsonRes[0].responseCode
    core.debug(responseCode)

    if (200 <= Number(responseCode) && Number(responseCode) < 300) {
      return true
    } else {
      core.error(`AppVersion Copy Vulns failed with code ${responseCode}`)
      throw new Error(`AppVersion Copy Vulns failed with code ${responseCode}`)
    }
  } catch {
    core.error('Something went wrong during Application Version Copy Vulns')
    core.error(errorData)
    core.error(`Version ${source}" to Version "${target}"`)
    core.setFailed('Something went wrong during Application Version Copy Vulns')

    return false
  }
}

async function setAppVersionAttribute(
  appId: string,
  attribute: string
): Promise<boolean> {
  let responseData = ''
  let errorData = ''

  const options = {
    listeners: {
      stdout: (data: Buffer) => {
        responseData += data.toString()
      },
      stderr: (data: Buffer) => {
        errorData += data.toString()
      }
    },
    silent: true
  }
  try {
    const response = await exec.exec(
      await getExecutablePath('fcli'),
      [
        'ssc',
        'appversion-attribute',
        'set',
        attribute,
        `--appversion=${appId}`,
        '--output=json'
      ],
      options
    )

    core.debug(response.toString())

    return true
  } catch {
    core.error('Something went wrong during Application Attribute assignment')
    core.error(errorData)

    return false
  }
}

async function setAppVersionAttributes(
  appId: string,
  attributes: string[]
): Promise<boolean> {
  await Promise.all(
    attributes.map(async attribute => {
      core.debug(`Assigning ${attribute} to ${appId}`)
      let status = await setAppVersionAttribute(appId, attribute)
      core.debug(`Assigned = ${status}`)
      if (!status) {
        core.warning(`Attribute assignment failed: ${attribute}`)
        return false
      }
    })
  )

  return true
}

async function commitAppVersion(id: string): Promise<any> {
  core.debug(`Committing AppVersion ${id}`)

  const commitBodyJson = JSON.parse(`{"committed": "true"}`)
  core.debug(JSON.stringify(commitBodyJson))

  let responseData = ''
  let errorData = ''

  const options = {
    listeners: {
      stdout: (data: Buffer) => {
        responseData += data.toString()
      },
      stderr: (data: Buffer) => {
        errorData += data.toString()
      }
    },
    silent: true
  }
  try {
    const response = await exec.exec(
      await getExecutablePath('fcli'),
      [
        'ssc',
        'rest',
        'call',
        `/api/v1/projectVersions/${id}`,
        '-d',
        JSON.stringify(commitBodyJson),
        `-X`,
        'PUT',
        '--output=json'
      ],
      options
    )

    core.debug(response.toString())
    core.debug(responseData)

    const jsonRes = JSON.parse(responseData)
    const responseCode = jsonRes[0].responseCode
    core.debug(responseCode)

    if (200 <= Number(responseCode) && Number(responseCode) < 300) {
      return true
    } else {
      core.error(`AppVersion Commit failed with code ${responseCode}`)
      throw new Error(`AppVersion Commit failed with code ${responseCode}`)
    }
  } catch {
    core.error('Something went wrong during Application Version Commit')
    core.error(errorData)
    core.error(`AppVersion ${id}`)
    core.setFailed('Something went wrong during Application Version Commit')
  }

  return false
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    try {
      /** Login  */
      core.info(`Login to Fortify Software Security Center`)
      if (INPUT.ssc_ci_token) {
        await loginToken(INPUT.ssc_base_url, INPUT.ssc_ci_token)
      } else if (INPUT.ssc_ci_username && INPUT.ssc_ci_password) {
        await loginUsernamePassword(
          INPUT.ssc_base_url,
          INPUT.ssc_ci_username,
          INPUT.ssc_ci_password
        )
      } else if (await checkLoggedIn(INPUT.ssc_base_url)) {
        core.info('Existing default SSC login session found.')
      } else {
        core.setFailed(
          'Missing credentials. Specify CI Token or Username+Password'
        )
        throw new Error(
          'Credentials missing and no existing default login session exists'
        )
      }
    } catch (err) {
      core.setFailed(`${err}`)
      throw new Error('Login failed!')
    }

    /** Is AppVersion already created ? */
    core.info(
      `Checking if AppVersion ${INPUT.ssc_app}:${INPUT.ssc_version} exists`
    )
    const appVersionId = await getAppVersionId(INPUT.ssc_app, INPUT.ssc_version)
    if (appVersionId > 0) {
      /** AppVersion EXISTS */
      core.info(
        `AppVersion ${INPUT.ssc_app}:${INPUT.ssc_version} already exist (${appVersionId})`
      )
      core.info(`Skipping`)
    } else {
      /** CREATION: AppVersion */
      core.info(`AppVersion ${INPUT.ssc_app}:${INPUT.ssc_version} not found`)
      core.info(
        `Creating ApplicationVersion ${INPUT.ssc_app}:${INPUT.ssc_version}`
      )
      const appVersion = await createAppVersion(
        INPUT.ssc_app,
        INPUT.ssc_version
      )
      core.info(
        `AppVersion ${appVersion['project']['name']}:${appVersion['name']} created (id: ${appVersion['id']})`
      )

      /** COPY STATE: run the AppVersion Copy  */
      let sourceAppVersionId
      if (INPUT.ssc_source_app && INPUT.ssc_source_version) {
        core.info(
          `Copying state from ${INPUT.ssc_source_app}:${INPUT.ssc_source_version} to ${INPUT.ssc_app}:${INPUT.ssc_version}`
        )

        sourceAppVersionId = await getAppVersionId(
          INPUT.ssc_source_app,
          INPUT.ssc_source_version
        )
        if (sourceAppVersionId) {
          /** Copy Rules, Bug Tracker and Tags */
          if (
            await copyAppVersionState(
              sourceAppVersionId.toString(),
              appVersion['id']
            )
          ) {
            core.info(
              `SUCCESS: Copying state from ${INPUT.ssc_source_app}:${INPUT.ssc_source_version} to ${INPUT.ssc_app}:${INPUT.ssc_version}`
            )
          } else {
            core.warning(
              `FAILURE: Copying state from ${INPUT.ssc_source_app}:${INPUT.ssc_source_version} to ${INPUT.ssc_app}:${INPUT.ssc_version}`
            )
            core.warning(`SKIPPING`)
          }
        } else {
          core.warning(
            `Source AppVersion ${INPUT.ssc_source_app}:${INPUT.ssc_source_version} not found. SKIPPING`
          )
        }
      }

      /** ATTRIBUTES : set AppVersion attributes */
      await setAppVersionAttributes(
        appVersion['id'],
        INPUT.ssc_version_attributes
      )

      /** COMMIT: Commit the AppVersion */
      core.info(
        `Committing AppVersion ${appVersion['project']['name']}:${appVersion['name']} (id: ${appVersion['id']})`
      )
      if (await commitAppVersion(appVersion['id'])) {
        core.info(
          `SUCCESS: Committing AppVersion ${appVersion['project']['name']}:${appVersion['name']} (id: ${appVersion['id']})`
        )
      } else {
        core.error(
          `FAILURE: Committing AppVersion ${appVersion['project']['name']}:${appVersion['name']} (id: ${appVersion['id']})`
        )
        /** delete uncommited AppVersion */
        await deleteAppVersion(appVersion['id'])
        throw new Error(
          `Failed to commit AppVersion ${appVersion['project']['name']}:${appVersion['name']} (id: ${appVersion['id']})`
        )
      }

      /** COPY VULNS: run the AppVersion Copy vulns */
      if (INPUT.copy_vulns && sourceAppVersionId) {
        core.info(
          `Copying Vulnerabilities from ${INPUT.ssc_source_app}:${INPUT.ssc_source_version} to ${INPUT.ssc_app}:${INPUT.ssc_version}`
        )
        if (
          await copyAppVersionVulns(
            sourceAppVersionId.toString(),
            appVersion['id']
          )
        ) {
          core.info(
            `SUCCESS: Copying Vulnerabilities from ${INPUT.ssc_source_app}:${INPUT.ssc_source_version} to ${INPUT.ssc_app}:${INPUT.ssc_version}`
          )
        } else {
          core.warning(
            `FAILURE: Copying Vulnerabilities from ${INPUT.ssc_source_app}:${INPUT.ssc_source_version} to ${INPUT.ssc_app}:${INPUT.ssc_version}`
          )
          core.warning(`SKIPPING`)
        }
      }
    }

    // Set outputs for other workflow steps to use
    core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

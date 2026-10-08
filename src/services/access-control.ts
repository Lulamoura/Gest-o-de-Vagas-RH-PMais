import type { RecordModel } from 'pocketbase'

import pb from '@/lib/pocketbase/client'

export interface AuthenticatedAccessResponse {
  type: 'authenticated'
  token: string
  record: RecordModel
}

export interface RemoteMfaChallengeResponse {
  type: 'remote_mfa_required'
  challengeId: string
  maskedEmail: string
  expiresIn: number
  resendAfter: number
}

export type AccessLoginResponse = AuthenticatedAccessResponse | RemoteMfaChallengeResponse

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseAccessResponse(value: unknown): AccessLoginResponse {
  if (!isObject(value)) throw new Error('Resposta de autenticação inválida.')

  if (
    (value.type === 'authenticated' || value.type === undefined) &&
    typeof value.token === 'string' &&
    value.token.length > 0 &&
    isObject(value.record) &&
    typeof value.record.id === 'string' &&
    value.record.id.length > 0
  ) {
    return {
      ...(value as unknown as AuthenticatedAccessResponse),
      type: 'authenticated',
    }
  }

  if (
    value.type === 'remote_mfa_required' &&
    typeof value.challengeId === 'string' &&
    value.challengeId.length > 0 &&
    typeof value.maskedEmail === 'string' &&
    value.maskedEmail.length > 0 &&
    typeof value.expiresIn === 'number' &&
    value.expiresIn > 0 &&
    typeof value.resendAfter === 'number' &&
    value.resendAfter >= 0
  ) {
    return value as unknown as RemoteMfaChallengeResponse
  }

  throw new Error('Resposta de autenticação inválida.')
}

function storeAuthentication(response: AccessLoginResponse): AccessLoginResponse {
  if (response.type === 'authenticated') {
    pb.authStore.save(response.token, response.record)
  }
  return response
}

export async function startAccessLogin(
  identity: string,
  password: string,
): Promise<AccessLoginResponse> {
  const response = parseAccessResponse(
    await pb.send<unknown>('/backend/v1/access/login', {
      method: 'POST',
      body: { identity: identity.trim(), password },
    }),
  )
  return storeAuthentication(response)
}

export async function verifyRemoteAccessCode(
  challengeId: string,
  code: string,
): Promise<AuthenticatedAccessResponse> {
  const response = parseAccessResponse(
    await pb.send<unknown>('/backend/v1/access/verify', {
      method: 'POST',
      body: { challengeId, code },
    }),
  )
  if (response.type !== 'authenticated') throw new Error('Resposta de autenticação inválida.')
  storeAuthentication(response)
  return response
}

export async function setRemoteAccessSettings(
  restrictionEnabled: boolean,
  officeNetworks: string[],
): Promise<{ restrictionEnabled: boolean; officeNetworks: string[] }> {
  const response = await pb.send<unknown>('/backend/v1/access/settings', {
    method: 'PUT',
    body: { restrictionEnabled, officeNetworks },
  })
  if (
    !isObject(response) ||
    typeof response.restrictionEnabled !== 'boolean' ||
    !Array.isArray(response.officeNetworks) ||
    !response.officeNetworks.every((network) => typeof network === 'string')
  ) {
    throw new Error('Resposta de configuração remota inválida.')
  }
  return {
    restrictionEnabled: response.restrictionEnabled,
    officeNetworks: response.officeNetworks as string[],
  }
}

export async function setUserActiveStatus(
  userId: string,
  active: boolean,
): Promise<{ userId: string; active: boolean }> {
  const response = await pb.send<unknown>(
    `/backend/v1/access/users/${encodeURIComponent(userId)}/active-status`,
    {
      method: 'PUT',
      body: { active },
    },
  )
  if (!isObject(response) || response.userId !== userId || typeof response.active !== 'boolean') {
    throw new Error('Resposta de administração inválida.')
  }
  return { userId: response.userId, active: response.active }
}

export async function setRemoteAccessPermission(
  userId: string,
  allowed: boolean,
): Promise<{ userId: string; allowed: boolean }> {
  const response = await pb.send<unknown>(
    `/backend/v1/access/users/${encodeURIComponent(userId)}/remote-permission`,
    {
      method: 'PUT',
      body: { allowed },
    },
  )
  if (
    !isObject(response) ||
    typeof response.userId !== 'string' ||
    response.userId !== userId ||
    typeof response.allowed !== 'boolean'
  ) {
    throw new Error('Resposta de autorização remota inválida.')
  }
  return { userId: response.userId, allowed: response.allowed }
}

export async function validateAccessSession(): Promise<RecordModel> {
  const response = await pb.send<unknown>('/backend/v1/access/session', { method: 'GET' })
  if (
    !isObject(response) ||
    !isObject(response.record) ||
    typeof response.record.id !== 'string' ||
    response.record.id.length === 0
  ) {
    throw new Error('Sessão inválida.')
  }
  return response.record as unknown as RecordModel
}

export async function resendRemoteAccessCode(
  challengeId: string,
): Promise<RemoteMfaChallengeResponse> {
  const response = parseAccessResponse(
    await pb.send<unknown>('/backend/v1/access/resend', {
      method: 'POST',
      body: { challengeId },
    }),
  )
  if (response.type !== 'remote_mfa_required') {
    throw new Error('Resposta de autenticação inválida.')
  }
  return response
}

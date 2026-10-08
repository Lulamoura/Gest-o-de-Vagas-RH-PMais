import { beforeEach, describe, expect, it, vi } from 'vitest'

const { send, save } = vi.hoisted(() => ({
  send: vi.fn(),
  save: vi.fn(),
}))

vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    send,
    authStore: { save },
  },
}))

import {
  resendRemoteAccessCode,
  setRemoteAccessPermission,
  setRemoteAccessSettings,
  setUserActiveStatus,
  startAccessLogin,
  validateAccessSession,
  verifyRemoteAccessCode,
} from '@/services/access-control'

describe('access control authentication service', () => {
  beforeEach(() => {
    send.mockReset()
    save.mockReset()
  })

  it('stores the returned PocketBase authentication when login is completed without MFA', async () => {
    const record = { id: 'user-1', email: 'lula@example.com' }
    send.mockResolvedValue({ type: 'authenticated', token: 'token-1', record })

    await expect(startAccessLogin(' lula@example.com ', 'senha-segura')).resolves.toEqual({
      type: 'authenticated',
      token: 'token-1',
      record,
    })

    expect(send).toHaveBeenCalledWith('/backend/v1/access/login', {
      method: 'POST',
      body: { identity: 'lula@example.com', password: 'senha-segura' },
    })
    expect(save).toHaveBeenCalledWith('token-1', record)
  })

  it('returns a remote challenge without creating an authenticated session', async () => {
    send.mockResolvedValue({
      type: 'remote_mfa_required',
      challengeId: 'challenge-1',
      maskedEmail: 'l***@example.com',
      expiresIn: 300,
      resendAfter: 60,
    })

    await expect(startAccessLogin('lula@example.com', 'senha-segura')).resolves.toMatchObject({
      type: 'remote_mfa_required',
      challengeId: 'challenge-1',
    })
    expect(save).not.toHaveBeenCalled()
  })

  it('stores the PocketBase authentication only after a valid remote code', async () => {
    const record = { id: 'user-1', email: 'lula@example.com' }
    send.mockResolvedValue({ type: 'authenticated', token: 'token-2', record })

    await expect(verifyRemoteAccessCode('challenge-1', '123456')).resolves.toMatchObject({
      token: 'token-2',
      record,
    })

    expect(send).toHaveBeenCalledWith('/backend/v1/access/verify', {
      method: 'POST',
      body: { challengeId: 'challenge-1', code: '123456' },
    })
    expect(save).toHaveBeenCalledWith('token-2', record)
  })

  it('normalizes the standard PocketBase auth response returned after OTP verification', async () => {
    const record = { id: 'user-1', email: 'lula@example.com' }
    send.mockResolvedValue({ token: 'token-3', record })

    await expect(verifyRemoteAccessCode('challenge-1', '654321')).resolves.toEqual({
      type: 'authenticated',
      token: 'token-3',
      record,
    })
    expect(save).toHaveBeenCalledWith('token-3', record)
  })

  it('rejects malformed authentication responses without storing a token', async () => {
    send.mockResolvedValue({ type: 'authenticated', token: '', record: { id: 'user-1' } })

    await expect(startAccessLogin('lula@example.com', 'senha-segura')).rejects.toThrow(
      'Resposta de autenticação inválida.',
    )
    expect(save).not.toHaveBeenCalled()
  })

  it('rejects malformed challenge responses without creating a session', async () => {
    send.mockResolvedValue({
      type: 'remote_mfa_required',
      challengeId: '',
      maskedEmail: 'l***@example.com',
      expiresIn: 300,
      resendAfter: 60,
    })

    await expect(startAccessLogin('lula@example.com', 'senha-segura')).rejects.toThrow(
      'Resposta de autenticação inválida.',
    )
    expect(save).not.toHaveBeenCalled()
  })

  it('validates the current token without rotating it', async () => {
    const record = { id: 'user-1', email: 'lula@example.com' }
    send.mockResolvedValue({ record })

    await expect(validateAccessSession()).resolves.toEqual(record)
    expect(send).toHaveBeenCalledWith('/backend/v1/access/session', { method: 'GET' })
    expect(save).not.toHaveBeenCalled()
  })

  it('changes global remote-access settings only through the SuperAdmin backend route', async () => {
    const expected = {
      restrictionEnabled: false,
      officeNetworks: ['143.208.130.134/32'],
    }
    send.mockResolvedValue(expected)

    await expect(
      setRemoteAccessSettings(expected.restrictionEnabled, expected.officeNetworks),
    ).resolves.toEqual(expected)
    expect(send).toHaveBeenCalledWith('/backend/v1/access/settings', {
      method: 'PUT',
      body: expected,
    })
  })

  it('changes active status only through the audited backend route', async () => {
    send.mockResolvedValue({ userId: 'user-1', active: false })

    await expect(setUserActiveStatus('user-1', false)).resolves.toEqual({
      userId: 'user-1',
      active: false,
    })
    expect(send).toHaveBeenCalledWith('/backend/v1/access/users/user-1/active-status', {
      method: 'PUT',
      body: { active: false },
    })
  })

  it('changes remote permission only through the SuperAdmin backend route', async () => {
    send.mockResolvedValue({ userId: 'user-1', allowed: true })

    await expect(setRemoteAccessPermission('user-1', true)).resolves.toEqual({
      userId: 'user-1',
      allowed: true,
    })
    expect(send).toHaveBeenCalledWith('/backend/v1/access/users/user-1/remote-permission', {
      method: 'PUT',
      body: { allowed: true },
    })
  })

  it('requests a replacement code without accepting an email address from the browser', async () => {
    send.mockResolvedValue({
      type: 'remote_mfa_required',
      challengeId: 'challenge-1',
      maskedEmail: 'l***@example.com',
      expiresIn: 300,
      resendAfter: 60,
    })

    await resendRemoteAccessCode('challenge-1')

    expect(send).toHaveBeenCalledWith('/backend/v1/access/resend', {
      method: 'POST',
      body: { challengeId: 'challenge-1' },
    })
  })
})

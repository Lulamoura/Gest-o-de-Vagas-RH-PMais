import type {
  IrisOperationalStatus,
  IrisOperationalState,
  IrisSuggestionProof,
} from '@/services/requisitions'

const STATUS_LABELS: Record<IrisOperationalState, string> = {
  HEALTHY: 'Disponível',
  DEGRADED: 'Atenção',
  UNAVAILABLE: 'Indisponível',
  UNKNOWN: 'Estado não confirmado',
}

export const shouldLoadIrisOperationalStatus = (status: string, canManage: boolean) =>
  status === 'Aprovada' && canManage

export const canUseManualContingency = (
  requisitionStatus: string,
  canManage: boolean,
  status: IrisOperationalStatus | null,
) =>
  shouldLoadIrisOperationalStatus(requisitionStatus, canManage) &&
  status?.status === 'UNAVAILABLE' &&
  status.manual_contingency_allowed === true

export const buildIrisReviewedPublication = ({
  title,
  publicDescription,
  internalProfile,
  suggestionProof,
}: {
  title: string
  publicDescription: string
  internalProfile: string
  suggestionProof: IrisSuggestionProof
}) => ({
  titulo_publico_iris: title,
  descricao_publica_iris: publicDescription,
  perfil_interno_triagem_iris: internalProfile,
  suggestion_proof: suggestionProof,
})

export const getIrisOperationalStatusView = (status: IrisOperationalStatus) => {
  const parsedLastSuccess = status.last_successful_check_at
    ? new Date(status.last_successful_check_at)
    : null
  const hasValidLastSuccess = parsedLastSuccess && !Number.isNaN(parsedLastSuccess.getTime())

  return {
    label: STATUS_LABELS[status.status],
    showManualAction: status.status === 'UNAVAILABLE' && status.manual_contingency_allowed === true,
    lastSuccessfulCheckLabel: hasValidLastSuccess
      ? `Última verificação bem-sucedida: ${new Intl.DateTimeFormat('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(parsedLastSuccess)}`
      : null,
  }
}

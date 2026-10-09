import { apiClient } from './client';

export interface IniciarViagemRequest {
  motoristaId?: string;
  veiculoId: number;
  linhaId: number;
  rotaId: number;
}

export interface MotoristaVinculoResponse {
  motoristaId?: string;
  motoristaNome?: string;
  hasViagemAtiva: boolean;
  viagemId?: number | null;
  veiculoId?: number | null;
  veiculoCodigo?: string | null;
  veiculoPlaca?: string | null;
  linhaId?: number | null;
  linhaCodigo?: string | null;
  linhaDescricao?: string | null;
  rotaId?: number | null;
  sentido?: string | null;
}

export interface ViagemResponse {
  id: number;
  motoristaId?: string;
  motoristaNome?: string;
  veiculoId: number;
  veiculoPlaca?: string;
  veiculoCodigo?: string;
  operadorId?: number;
  operadorNome?: string;
  linhaId: number;
  linhaCodigo?: string;
  linhaDescricao?: string;
  rotaId: number;
  rotaPrefixo?: string;
  sentido?: string;
  dataInicio?: string;
  dataFim?: string;
  status: 'EM_ANDAMENTO' | 'FINALIZADA' | 'CANCELADA';
}

export interface TelemetriaPingPayload {
  viagemId: number;
  latitude: number;
  longitude: number;
  velocidade: number;
  bearing: number;
  odometer: number;
  sequenciaParadaAtual?: number;
  statusParadaAtual?: string;
  paradaId?: number;
}

export interface LinhaItem {
  id: number;
  codigoLinha: string;
  descricao?: string;
  nome?: string;
  rotas?: { id: number; prefixo?: string; sentido?: string }[];
}

export interface VeiculoItem {
  id: number;
  codigoVeiculo?: string;
  placa: string;
  status?: string;
}

/**
 * Start active trip for driver
 */
export async function iniciarViagemApi(req: IniciarViagemRequest): Promise<ViagemResponse> {
  const response = await apiClient.post<any>('/v1/api/viagens/iniciar', req);
  const data = response.data?.data || response.data;
  return data as ViagemResponse;
}

/**
 * Finish an active trip
 */
export async function finalizarViagemApi(viagemId: number): Promise<ViagemResponse> {
  const response = await apiClient.patch<any>(`/v1/api/viagens/${viagemId}/finalizar`);
  const data = response.data?.data || response.data;
  return data as ViagemResponse;
}

/**
 * Send GPS telemetry coordinate ping
 */
export async function registrarPingApi(payload: TelemetriaPingPayload): Promise<any> {
  const response = await apiClient.post<any>('/v1/api/telemetria/ping', payload);
  return response.data;
}

/**
 * Fetch current assigned vehicle/route or active trip for authenticated driver
 */
export async function getVinculoAtualMotoristaApi(): Promise<MotoristaVinculoResponse | null> {
  try {
    const response = await apiClient.get<any>('/v1/api/viagens/motorista/atual');
    const data = response.data?.data ?? response.data;
    return data || null;
  } catch {
    return null;
  }
}

/**
 * Query currently active trips
 */
export async function getViagensAtivasApi(): Promise<ViagemResponse[]> {
  try {
    const response = await apiClient.get<any>('/v1/api/viagens/ativas');
    const data = response.data?.data || response.data;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Fetch list of operational lines
 */
export async function getLinhasApi(): Promise<LinhaItem[]> {
  try {
    const response = await apiClient.get<any>('/v1/api/linhas');
    const data = response.data?.data || response.data;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Fetch list of operational vehicles
 */
export async function getVeiculosApi(): Promise<VeiculoItem[]> {
  try {
    const response = await apiClient.get<any>('/v1/api/veiculos');
    const data = response.data?.data || response.data;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
